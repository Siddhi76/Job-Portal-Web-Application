from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from tests.conftest import auth_headers, create_job, register


def test_password_hash_and_unique_email_are_enforced_in_database(client):
    first = register(client, email="unique@example.com", role="job_seeker")
    first_user_id = UUID(first["user"]["id"])
    with SessionLocal() as db:
        user = db.get(User, first_user_id)
        assert user is not None
        assert user.password_hash != "correct-horse-battery"
        assert user.password_hash.startswith("$argon2")

        db.add(
            User(
                name="Duplicate",
                email="unique@example.com",
                password_hash="not-a-real-password-hash",
                role="job_seeker",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    with SessionLocal() as db:
        assert db.scalar(select(func.count(User.id)).where(User.email == "unique@example.com")) == 1


def test_application_foreign_keys_uniqueness_and_deletion_cascade(client):
    employer = register(client, email="owner@example.com", role="employer")
    seeker = register(client, email="applicant@example.com", role="job_seeker")
    job_response = create_job(client, employer)
    assert job_response.status_code == 201
    job_id = UUID(job_response.json()["id"])
    applicant_id = UUID(seeker["user"]["id"])

    response = client.post(
        f"/api/jobs/{job_id}/apply",
        headers=auth_headers(seeker),
    )
    assert response.status_code == 201

    with SessionLocal() as db:
        persisted = db.scalar(
            select(Application).where(
                Application.job_id == job_id,
                Application.applicant_id == applicant_id,
            )
        )
        assert persisted is not None
        duplicate = Application(job_id=job_id, applicant_id=applicant_id)
        db.add(duplicate)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    with SessionLocal() as first_session:
        assert first_session.scalar(
            select(func.count(Application.id)).where(Application.job_id == job_id)
        ) == 1

    deleted = client.delete(
        f"/api/jobs/{job_id}",
        headers=auth_headers(employer),
    )
    assert deleted.status_code == 204
    with SessionLocal() as db:
        assert db.get(Job, job_id) is None
        assert db.scalar(
            select(func.count(Application.id)).where(Application.job_id == job_id)
        ) == 0


def test_database_rejects_invalid_roles_and_statuses(client):
    with SessionLocal() as db:
        db.add(
            User(
                name="Invalid role",
                email=f"invalid-{uuid4().hex}@example.com",
                password_hash="hash",
                role="administrator",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
