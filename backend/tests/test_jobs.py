from fastapi.testclient import TestClient

from tests.conftest import auth_headers, create_job, register


def test_job_search_pagination_and_employer_crud(client: TestClient):
    employer = register(client, email="employer@example.com", role="employer")
    first = create_job(client, employer)
    assert first.status_code == 201
    job = first.json()
    assert job["employmentType"] == "Full-time"
    assert job["logo"] == "N"
    assert job["applicants"] == 0
    assert client.get("/api/jobs/mine", headers=auth_headers(employer)).json()[0]["id"] == job["id"]

    create_job(client, employer, title="Backend Engineer")
    listing = client.get(
        "/api/jobs",
        params={"q": "backend", "location": "remote", "category": "Engineering", "page": 1},
    )
    assert listing.status_code == 200
    assert listing.json()["total"] == 0

    filtered = client.get("/api/jobs", params={"q": "designer", "pageSize": 1})
    assert filtered.json()["total"] == 1
    assert len(filtered.json()["items"]) == 1

    updated = client.put(
        f"/api/jobs/{job['id']}",
        headers=auth_headers(employer),
        json={
            "title": "Senior Product Designer",
            "company": "Northstar",
            "location": "Remote",
            "category": "Design",
            "employmentType": "Full-time",
            "salary": "$120k-$150k",
            "description": "Lead thoughtful design across the product experience.",
            "skills": ["Figma"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Senior Product Designer"

    deleted = client.delete(f"/api/jobs/{job['id']}", headers=auth_headers(employer))
    assert deleted.status_code == 204
    assert client.get(f"/api/jobs/{job['id']}").status_code == 404


def test_only_employers_can_create_jobs_and_owners_can_change_them(client: TestClient):
    seeker = register(client, email="seeker@example.com", role="job_seeker")
    employer_one = register(client, email="one@example.com", role="employer")
    employer_two = register(client, email="two@example.com", role="employer")

    assert create_job(client, seeker).status_code == 403
    job = create_job(client, employer_one).json()
    assert client.post("/api/jobs", json={}).status_code == 401
    assert client.get("/api/jobs/mine", headers=auth_headers(seeker)).status_code == 403
    assert client.get("/api/jobs/mine", headers=auth_headers(employer_two)).json() == []
    headers = auth_headers(employer_two)

    response = client.put(
        f"/api/jobs/{job['id']}",
        headers=headers,
        json={
            "title": "Changed title",
            "company": "Northstar",
            "location": "Remote",
            "category": "Design",
            "employmentType": "Full-time",
            "salary": "$100k",
            "description": "A sufficiently detailed description for validation.",
            "skills": [],
        },
    )
    assert response.status_code == 403
    assert client.delete(f"/api/jobs/{job['id']}", headers=headers).status_code == 403


def test_job_creation_validates_required_fields(client: TestClient):
    employer = register(client, email="employer@example.com", role="employer")
    response = client.post(
        "/api/jobs",
        headers=auth_headers(employer),
        json={"title": "", "company": "Example"},
    )
    assert response.status_code == 422


def test_public_job_detail_hides_unpublished_jobs(client: TestClient):
    employer = register(client, email="employer@example.com", role="employer")
    job = client.post(
        "/api/jobs",
        headers=auth_headers(employer),
        json={
            "title": "Draft Engineer",
            "company": "Northstar",
            "location": "Remote",
            "category": "Engineering",
            "employmentType": "Full-time",
            "salary": "$100k-$130k",
            "description": "Build thoughtful software for a global team.",
            "skills": [],
            "status": "draft",
        },
    ).json()
    assert client.get(f"/api/jobs/{job['id']}").status_code == 404
    assert client.get("/api/jobs/mine", headers=auth_headers(employer)).json()[0]["id"] == job["id"]


def test_job_list_filters_and_pagination(client: TestClient):
    employer = register(client, email="employer@example.com", role="employer")
    create_job(client, employer, title="Product Designer")
    create_job(client, employer, title="Product Engineer", category="Engineering")
    create_job(client, employer, title="Marketing Lead", category="Marketing")

    response = client.get(
        "/api/jobs",
        params={"q": "product", "category": "Design", "employmentType": "Full-time", "pageSize": 1},
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["pages"] == 1
    assert response.json()["items"][0]["title"] == "Product Designer"

    skill_search = client.get("/api/jobs", params={"q": "research"})
    assert skill_search.status_code == 200
    assert skill_search.json()["total"] == 3
    assert all("Research" in item["skills"] for item in skill_search.json()["items"])

    assert client.get("/api/jobs", params={"page": 0}).status_code == 422
