from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi.testclient import TestClient

from app.core.config import get_settings
from tests.conftest import auth_headers, register


def test_register_login_and_me_return_safe_user(client: TestClient):
    registered = register(
        client,
        email=f"seeker-{uuid4().hex}@example.com",
        role="job_seeker",
        name="Jamie Taylor",
    )

    assert registered["tokenType"] == "bearer"
    assert registered["user"]["name"] == "Jamie Taylor"
    assert registered["user"]["role"] == "job_seeker"
    assert "password" not in registered["user"]
    assert "password_hash" not in registered["user"]

    me = client.get("/api/auth/me", headers=auth_headers(registered))
    assert me.status_code == 200
    assert me.json()["email"] == registered["user"]["email"]

    login = client.post(
        "/api/auth/login",
        json={
            "email": registered["user"]["email"].upper(),
            "password": "correct-horse-battery",
        },
    )
    assert login.status_code == 200
    assert login.json()["user"]["id"] == registered["user"]["id"]


def test_auth_rejects_invalid_inputs_duplicate_email_and_bad_password(client: TestClient):
    response = client.post(
        "/api/auth/register",
        json={"name": "A", "email": "bad-email", "password": "short", "role": "admin"},
    )
    assert response.status_code == 422

    register(client, email="same@example.com", role="employer")
    duplicate = client.post(
        "/api/auth/register",
        json={
            "name": "Again",
            "email": "SAME@example.com",
            "password": "correct-horse-battery",
            "role": "employer",
        },
    )
    assert duplicate.status_code == 409

    failed_login = client.post(
        "/api/auth/login",
        json={"email": "same@example.com", "password": "incorrect-password"},
    )
    assert failed_login.status_code == 401


def test_me_requires_a_valid_token(client: TestClient):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-token"}
    ).status_code == 401


def test_me_rejects_expired_access_token(client: TestClient):
    user = register(
        client,
        email="expired-token@example.com",
        role="job_seeker",
    )["user"]
    settings = get_settings()
    expired_token = jwt.encode(
        {
            "sub": user["id"],
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.secret_key.get_secret_value(),
        algorithm=settings.algorithm,
    )
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


def test_cors_allows_configured_frontend_and_rejects_other_origins(client: TestClient):
    settings = get_settings()
    assert settings.cors_origin_list == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://job-portal-web-application-sigma.vercel.app",
    ]

    for origin in settings.cors_origin_list:
        allowed = client.options(
            "/api/auth/register",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
        )
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == origin
        allowed_headers = allowed.headers["access-control-allow-headers"].lower()
        assert "authorization" in allowed_headers
        assert "content-type" in allowed_headers

    rejected = client.options(
        "/api/auth/register",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers


def test_profile_update_is_authenticated_persistent_and_rejects_duplicate_email(client: TestClient):
    registered = register(client, email="profile@example.com", role="job_seeker")
    other = register(client, email="other-profile@example.com", role="employer")
    headers = auth_headers(registered)

    updated = client.patch(
        "/api/auth/me",
        headers=headers,
        json={"name": "Updated Name", "email": "updated@example.com"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Name"
    assert updated.json()["email"] == "updated@example.com"
    assert "password_hash" not in updated.json()
    assert client.get("/api/auth/me", headers=headers).json()["email"] == "updated@example.com"

    duplicate = client.patch(
        "/api/auth/me",
        headers=headers,
        json={"email": other["user"]["email"]},
    )
    assert duplicate.status_code == 409
    assert client.patch("/api/auth/me", json={"name": "No auth"}).status_code == 401
    assert client.patch("/api/auth/me", headers=headers, json={}).status_code == 422
    assert client.patch(
        "/api/auth/me", headers=headers, json={"email": None}
    ).status_code == 422
