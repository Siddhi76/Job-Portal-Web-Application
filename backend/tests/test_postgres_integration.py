import os
import re
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_db
from tests.conftest import auth_headers, create_job, register

POSTGRES_TEST_DATABASE_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_TEST_DATABASE_URL,
    reason="Set POSTGRES_TEST_DATABASE_URL to a dedicated PostgreSQL test database",
)


@pytest.fixture
def migrated_postgres_client():
    parsed_url = make_url(POSTGRES_TEST_DATABASE_URL)
    if parsed_url.get_backend_name() != "postgresql":
        pytest.fail("POSTGRES_TEST_DATABASE_URL must use PostgreSQL")
    if not re.search(r"(?:_test|-test)(?:_db)?$", parsed_url.database or ""):
        pytest.fail(
            "Refusing integration test: PostgreSQL database name must end in "
            "'_test', '-test', '_test_db', or '-test_db'"
        )

    schema = f"qiro_it_{uuid.uuid4().hex}"
    admin_engine = create_engine(POSTGRES_TEST_DATABASE_URL, pool_pre_ping=True)
    with admin_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))

    isolated_url = parsed_url.update_query_dict(
        {"options": f"-csearch_path={schema}"}
    )
    previous_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = isolated_url.render_as_string(hide_password=False)
    get_settings.cache_clear()
    migration_engine = None
    test_engine = None
    application = None
    try:
        migration_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        command.upgrade(migration_config, "head")

        migration_engine = create_engine(isolated_url, pool_pre_ping=True)
        tables = set(inspect(migration_engine).get_table_names())
        assert {"users", "jobs", "applications", "alembic_version"} <= tables
        with migration_engine.connect() as connection:
            assert connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one() == "0002_postgres_integrity"

        test_engine = create_engine(isolated_url, pool_pre_ping=True)
        TestSession = sessionmaker(
            bind=test_engine, autoflush=False, expire_on_commit=False
        )

        def override_get_db():
            db = TestSession()
            try:
                yield db
            finally:
                db.close()

        from app.main import app

        app.dependency_overrides[get_db] = override_get_db
        application = app
        with TestClient(app) as client:
            yield client, test_engine
    finally:
        if application is not None:
            application.dependency_overrides.clear()
        if migration_engine is not None:
            migration_engine.dispose()
        if test_engine is not None:
            test_engine.dispose()
        if previous_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_url
        get_settings.cache_clear()
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()


def test_empty_postgres_migration_and_persistent_workflows(migrated_postgres_client):
    client, engine = migrated_postgres_client
    employer = register(client, email="postgres-employer@example.com", role="employer")
    other_employer = register(
        client, email="postgres-other-employer@example.com", role="employer"
    )
    seeker = register(client, email="postgres-seeker@example.com", role="job_seeker")

    login = client.post(
        "/api/auth/login",
        json={
            "email": "postgres-seeker@example.com",
            "password": "correct-horse-battery",
        },
    )
    assert login.status_code == 200
    assert client.get("/api/auth/me", headers=auth_headers(seeker)).status_code == 200

    created = create_job(client, employer, title="PostgreSQL Engineer", category="Engineering")
    assert created.status_code == 201
    job = created.json()
    assert job["status"] == "open"
    assert create_job(client, seeker, title="Unauthorized job").status_code == 403
    assert client.get("/api/jobs", params={"q": "postgresql"}).json()["total"] == 1
    assert client.get(f"/api/jobs/{job['id']}").status_code == 200
    assert client.put(
        f"/api/jobs/{job['id']}",
        headers=auth_headers(other_employer),
        json={"title": "Unauthorized edit"},
    ).status_code == 403
    assert client.delete(
        f"/api/jobs/{job['id']}", headers=auth_headers(other_employer)
    ).status_code == 403
    assert client.get(
        f"/api/jobs/{job['id']}/applications",
        headers=auth_headers(other_employer),
    ).status_code == 403

    updated = client.put(
        f"/api/jobs/{job['id']}",
        headers=auth_headers(employer),
        json={
            "title": "Senior PostgreSQL Engineer",
            "company": "Northstar",
            "location": "Remote",
            "category": "Engineering",
            "employmentType": "Full-time",
            "salary": "$140k-$180k",
            "description": "Build and maintain reliable PostgreSQL-backed services.",
            "skills": ["PostgreSQL", "Python"],
            "status": "open",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Senior PostgreSQL Engineer"

    applied = client.post(
        f"/api/jobs/{job['id']}/apply",
        headers=auth_headers(seeker),
        json={
            "resumeUrl": "https://example.com/resume.pdf",
            "coverLetter": "I am excited to work on reliable services.",
        },
    )
    assert applied.status_code == 201
    application = applied.json()
    assert application["resumeUrl"] == "https://example.com/resume.pdf"
    assert len(client.get("/api/applications/my", headers=auth_headers(seeker)).json()) == 1

    assert client.post(
        f"/api/jobs/{job['id']}/apply", headers=auth_headers(seeker)
    ).status_code == 409
    assert len(client.get(f"/api/jobs/{job['id']}/applications", headers=auth_headers(employer)).json()) == 1
    assert client.patch(
        f"/api/applications/{application['id']}/status",
        headers=auth_headers(employer),
        json={"status": "Shortlisted"},
    ).json()["status"] == "Shortlisted"
    assert client.patch(
        f"/api/applications/{application['id']}/status",
        headers=auth_headers(other_employer),
        json={"status": "Accepted"},
    ).status_code == 403
    history_after_status_update = client.get(
        "/api/applications/my", headers=auth_headers(seeker)
    )
    assert history_after_status_update.status_code == 200
    assert history_after_status_update.json()[0]["status"] == "Shortlisted"
    assert client.get(f"/api/jobs/{job['id']}").json()["title"] == "Senior PostgreSQL Engineer"

    with engine.connect() as connection:
        db_user = connection.execute(
            text("SELECT password_hash FROM users WHERE email = :email"),
            {"email": "postgres-seeker@example.com"},
        ).scalar_one()
        columns = {
            column["name"] for column in inspect(engine).get_columns("applications")
        }
    assert db_user != "correct-horse-battery"
    assert {"job_seeker_id", "resume_url", "cover_letter"} <= columns
    unique_constraints = inspect(engine).get_unique_constraints("applications")
    assert any(
        constraint["column_names"] == ["job_id", "job_seeker_id"]
        for constraint in unique_constraints
    )

    assert client.delete(
        f"/api/jobs/{job['id']}", headers=auth_headers(employer)
    ).status_code == 204
    assert client.get(f"/api/jobs/{job['id']}").status_code == 404
