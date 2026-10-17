import os

# Test-only database and key; production settings are read from backend/.env.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SECRET_KEY"] = "qiro-test-only-key-not-for-any-deployment"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "5"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.db.base import Base
from app.db.session import SessionLocal, engine, get_db
from app.main import app
from app import models  # noqa: F401

@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(connection, _):
    if engine.dialect.name == "sqlite":
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def register(client: TestClient, *, email: str, role: str, name: str = "Taylor"):
    response = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "correct-horse-battery",
            "role": role,
        },
    )
    assert response.status_code == 201
    return response.json()


def auth_headers(auth_response: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_response['accessToken']}"}


def create_job(
    client: TestClient,
    employer: dict,
    *,
    title: str = "Product Designer",
    category: str = "Design",
):
    return client.post(
        "/api/jobs",
        headers=auth_headers(employer),
        json={
            "title": title,
            "company": "Northstar",
            "location": "Remote",
            "category": category,
            "employmentType": "Full-time",
            "salary": "$100k-$130k",
            "description": "Design useful experiences with a thoughtful product team.",
            "skills": ["Figma", "Research"],
        },
    )
