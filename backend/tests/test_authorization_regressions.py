from fastapi.testclient import TestClient

from tests.conftest import auth_headers, create_job, register


def _job_payload(title: str = "Platform Engineer") -> dict:
    return {
        "title": title,
        "company": "Northstar",
        "location": "Remote",
        "category": "Engineering",
        "employmentType": "Full-time",
        "salary": "$120k-$150k",
        "description": "Build reliable services for a thoughtful product team.",
        "skills": ["Python"],
    }


def test_identity_and_ownership_fields_cannot_be_forged(client: TestClient):
    employer = register(client, email="owner@example.com", role="employer")
    other_employer = register(client, email="other-owner@example.com", role="employer")
    seeker = register(client, email="seeker@example.com", role="job_seeker")
    other_seeker = register(client, email="other-seeker@example.com", role="job_seeker")

    job = client.post(
        "/api/jobs",
        headers=auth_headers(employer),
        json={
            **_job_payload(),
            "employer_id": other_employer["user"]["id"],
            "applicant_id": other_seeker["user"]["id"],
            "user_id": other_employer["user"]["id"],
            "role": "job_seeker",
        },
    )
    assert job.status_code == 201
    job_id = job.json()["id"]
    assert [item["id"] for item in client.get(
        "/api/jobs/mine", headers=auth_headers(employer)
    ).json()] == [job_id]
    assert client.get(
        "/api/jobs/mine", headers=auth_headers(other_employer)
    ).json() == []

    forged_job_update = client.put(
        f"/api/jobs/{job_id}",
        headers=auth_headers(other_employer),
        json={
            **_job_payload("Attempted takeover"),
            "employer_id": other_employer["user"]["id"],
            "user_id": other_employer["user"]["id"],
            "role": "employer",
        },
    )
    assert forged_job_update.status_code == 403

    profile = client.patch(
        f"/api/auth/me?user_id={other_employer['user']['id']}&role=job_seeker",
        headers=auth_headers(employer),
        json={
            "name": "Owner Updated",
            "employer_id": other_employer["user"]["id"],
            "applicant_id": other_seeker["user"]["id"],
            "user_id": other_employer["user"]["id"],
            "id": other_employer["user"]["id"],
            "role": "job_seeker",
        },
    )
    assert profile.status_code == 200
    assert profile.json()["id"] == employer["user"]["id"]
    assert profile.json()["role"] == "employer"
    assert profile.json()["name"] == "Owner Updated"

    application = client.post(
        f"/api/jobs/{job_id}/apply?user_id={other_seeker['user']['id']}",
        headers=auth_headers(seeker),
        json={
            "employer_id": other_employer["user"]["id"],
            "applicant_id": other_seeker["user"]["id"],
            "user_id": other_seeker["user"]["id"],
            "role": "employer",
        },
    )
    assert application.status_code == 201
    assert application.json()["applicantId"] == seeker["user"]["id"]

    status_update = client.patch(
        f"/api/applications/{application.json()['id']}/status"
        f"?user_id={other_employer['user']['id']}",
        headers=auth_headers(employer),
        json={
            "status": "Shortlisted",
            "employer_id": other_employer["user"]["id"],
            "applicant_id": other_seeker["user"]["id"],
            "user_id": other_employer["user"]["id"],
            "role": "job_seeker",
        },
    )
    assert status_update.status_code == 200
    assert status_update.json()["applicantId"] == seeker["user"]["id"]
    assert status_update.json()["status"] == "Shortlisted"


def test_every_protected_route_rejects_unauthenticated_requests(client: TestClient):
    employer = register(client, email="owner@example.com", role="employer")
    seeker = register(client, email="seeker@example.com", role="job_seeker")
    job = create_job(client, employer).json()
    application = client.post(
        f"/api/jobs/{job['id']}/apply", headers=auth_headers(seeker)
    ).json()

    requests = [
        ("GET", "/api/auth/me", None),
        ("PATCH", "/api/auth/me", {"name": "Unauthenticated"}),
        ("GET", "/api/jobs/mine", None),
        ("POST", "/api/jobs", _job_payload()),
        ("PUT", f"/api/jobs/{job['id']}", _job_payload("Updated Engineer")),
        ("DELETE", f"/api/jobs/{job['id']}", None),
        ("POST", f"/api/jobs/{job['id']}/apply", {}),
        ("GET", f"/api/jobs/{job['id']}/applications", None),
        ("GET", "/api/applications/my", None),
        (
            "PATCH",
            f"/api/applications/{application['id']}/status",
            {"status": "Shortlisted"},
        ),
    ]
    for method, path, body in requests:
        response = client.request(method, path, json=body)
        assert response.status_code == 401, f"{method} {path} returned {response.status_code}"
