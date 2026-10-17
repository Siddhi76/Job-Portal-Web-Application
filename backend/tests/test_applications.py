from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.application import Application
from tests.conftest import auth_headers, create_job, register


def test_apply_duplicate_and_role_restrictions(client: TestClient):
    employer = register(client, email="employer@example.com", role="employer")
    seeker = register(client, email="seeker@example.com", role="job_seeker")
    job = create_job(client, employer).json()
    path = f"/api/jobs/{job['id']}/apply"

    applied = client.post(path, headers=auth_headers(seeker))
    assert applied.status_code == 201
    assert applied.json()["status"] == "Pending"

    duplicate = client.post(path, headers=auth_headers(seeker))
    assert duplicate.status_code == 409
    with SessionLocal() as db:
        existing = db.scalar(
            select(Application).where(Application.job_id == UUID(job["id"]))
        )
        assert existing is not None
        duplicate_row = Application(
            job_id=existing.job_id,
            applicant_id=existing.applicant_id,
        )
        db.add(duplicate_row)
        try:
            db.commit()
            raise AssertionError("Database unique constraint did not reject duplicate")
        except IntegrityError:
            db.rollback()
        assert db.scalar(
            select(func.count(Application.id)).where(Application.job_id == existing.job_id)
        ) == 1
    assert client.post(path, headers=auth_headers(employer)).status_code == 403
    assert client.post(path).status_code == 401


def test_apply_rejects_unknown_job_and_invalid_resume_url(client: TestClient):
    seeker = register(client, email="seeker@example.com", role="job_seeker")
    headers = auth_headers(seeker)
    unknown_job_id = "00000000-0000-0000-0000-000000000000"
    assert client.post(
        f"/api/jobs/{unknown_job_id}/apply",
        headers=headers,
    ).status_code == 404

    employer = register(client, email="employer@example.com", role="employer")
    job = create_job(client, employer).json()
    invalid_resume = client.post(
        f"/api/jobs/{job['id']}/apply",
        headers=headers,
        json={"resumeUrl": "not a URL"},
    )
    assert invalid_resume.status_code == 422


def test_applicants_are_private_and_owned_employer_can_update_status(client: TestClient):
    employer = register(client, email="employer@example.com", role="employer")
    other_employer = register(client, email="other@example.com", role="employer")
    seeker = register(client, email="seeker@example.com", role="job_seeker")
    other_seeker = register(client, email="other-seeker@example.com", role="job_seeker")
    job = create_job(client, employer).json()
    other_job = create_job(client, other_employer, title="Data Analyst").json()

    application = client.post(
        f"/api/jobs/{job['id']}/apply", headers=auth_headers(seeker)
    ).json()
    other_application = client.post(
        f"/api/jobs/{other_job['id']}/apply",
        headers=auth_headers(other_seeker),
    ).json()

    mine = client.get("/api/applications/my", headers=auth_headers(seeker))
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["id"] == application["id"]

    assert client.get("/api/applications/my", headers=auth_headers(employer)).status_code == 403
    other_seeker_applications = client.get(
        "/api/applications/my", headers=auth_headers(other_seeker)
    )
    assert other_seeker_applications.status_code == 200
    assert [item["id"] for item in other_seeker_applications.json()] == [
        other_application["id"]
    ]
    assert application["id"] not in {
        item["id"] for item in other_seeker_applications.json()
    }
    assert client.get(
        f"/api/jobs/{job['id']}/applications", headers=auth_headers(other_employer)
    ).status_code == 403
    assert client.get(f"/api/jobs/{job['id']}/applications", headers=auth_headers(seeker)).status_code == 403

    applicants = client.get(
        f"/api/jobs/{job['id']}/applications", headers=auth_headers(employer)
    )
    assert applicants.status_code == 200
    assert len(applicants.json()) == 1

    changed = client.patch(
        f"/api/applications/{application['id']}/status",
        headers=auth_headers(employer),
        json={"status": "Shortlisted"},
    )
    assert changed.status_code == 200
    assert changed.json()["status"] == "Shortlisted"
    assert client.patch(
        f"/api/applications/{application['id']}/status",
        headers=auth_headers(other_employer),
        json={"status": "Accepted"},
    ).status_code == 403
    assert client.patch(
        f"/api/applications/{application['id']}/status",
        headers=auth_headers(employer),
        json={"status": "Interview"},
    ).status_code == 422
