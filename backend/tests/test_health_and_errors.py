from sqlalchemy.exc import SQLAlchemyError
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app


def test_health_and_unknown_endpoint(client: TestClient):
    assert client.get("/health").status_code == 200
    assert client.get("/health").json() == {"status": "ok"}
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert "traceback" not in response.text.lower()


def test_validation_error_is_structured_and_does_not_echo_secrets(client: TestClient):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "",
            "email": "not-an-email",
            "password": "short",
            "role": "administrator",
            "untrusted": "do-not-echo-this-value",
        },
    )
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)
    assert "do-not-echo-this-value" not in response.text
    assert "traceback" not in response.text.lower()


def test_database_errors_have_generic_client_response(client: TestClient):
    def fail_database_dependency():
        raise SQLAlchemyError("private database connection details")
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = fail_database_dependency
    try:
        response = client.get("/api/jobs")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Database operation failed. Please try again."
    }
    assert "private database connection details" not in response.text
    assert "traceback" not in response.text.lower()
