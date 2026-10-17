# Qiro Tech Job Portal API

FastAPI API for Qiro authentication, job listings, and applications. SQLAlchemy 2 connects using the required `DATABASE_URL`; there is no implicit SQLite fallback. PostgreSQL uses psycopg 3. SQLite is supported only when its URL is explicitly configured, including the isolated default automated-test database.

## Requirements

- Python 3.11 or newer
- PostgreSQL 14+ for PostgreSQL integration
- `psql` / PostgreSQL command-line tools for database administration (optional if using a managed database)

## PostgreSQL setup

### Local PostgreSQL

Install PostgreSQL using the official Windows installer and keep the database service running. In the `psql` shell opened as a database administrator, create a dedicated application role and database (replace the example identifiers and choose a private password):

```sql
CREATE ROLE qiro_app WITH LOGIN PASSWORD 'REPLACE_WITH_A_PRIVATE_PASSWORD';
CREATE DATABASE qiro_portal OWNER qiro_app;
```

The role/database names above are examples, not credentials. Do not commit a real password or paste it into issue reports or logs.

### Managed PostgreSQL

Create a PostgreSQL database and restricted application user with your provider. Copy the provider's connection settings into `DATABASE_URL`. Use the SQLAlchemy psycopg 3 URL form:

```text
postgresql+psycopg://DB_USER:URL_ENCODED_DB_PASSWORD@DB_HOST:5432/DB_NAME
```

URL-encode reserved characters in the password. Use the provider's TLS options if required.

## Windows PowerShell setup and startup

From the repository root:

```powershell
Set-Location 'D:\intern project\qiro-job-portal\backend'
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `backend/.env` and replace `DATABASE_URL` with the PostgreSQL URL for the database created above. Generate and set a private JWT secret; do not use the example placeholder:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set `SECRET_KEY` in `.env` to the generated value. Configure `ACCESS_TOKEN_EXPIRE_MINUTES` and comma-separated `CORS_ORIGINS` as needed. The example CORS values allow the local Vite frontend.

Apply database migrations and start the API:

```powershell
alembic upgrade head
uvicorn app.main:app --reload
```

The API is at `http://127.0.0.1:8000`; Swagger UI is at `http://127.0.0.1:8000/docs`; ReDoc is at `http://127.0.0.1:8000/redoc`; liveness is at `http://127.0.0.1:8000/health`. The health endpoint is a liveness check and does not prove database connectivity.

Configure the React app separately in `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Then run the frontend from another PowerShell window:

```powershell
Set-Location 'D:\intern project\qiro-job-portal\frontend'
npm run dev
```

## Migrations

Migrations are incremental and preserve existing application records. Revision `0002_postgres_integrity` adds job status and update timestamp, application resume/cover-letter fields, role/status constraints, and renames the application user column to `job_seeker_id`. Existing application records remain linked by the renamed column.

```powershell
# Apply all migrations
alembic upgrade head

# Show the current database revision
alembic current

# Inspect migration history
alembic history

# Check model metadata against the configured database
alembic check
```

Do not use `alembic downgrade` against a database containing data unless you have reviewed the migration and have a verified backup. The follow-up migration's downgrade removes the newly added resume and cover-letter fields.

## Automated testing

The default test suite explicitly uses in-memory SQLite. It does not connect to or modify the configured developer database:

```powershell
Set-Location 'D:\intern project\qiro-job-portal\backend'
.\.venv\Scripts\Activate.ps1
python -m pytest -q
```

There is also an opt-in PostgreSQL integration test. It requires `POSTGRES_TEST_DATABASE_URL` to point to a newly created, disposable PostgreSQL database and uses/drops only a uniquely named temporary schema in that database. The test refuses database names without a test suffix and skips when the variable is absent. It verifies Alembic migration and persistence-backed API workflows; skipping it is not evidence of PostgreSQL support.

Use the safe, credential-redacting database creation and PowerShell configuration steps in the [root README](../README.md#safe-postgresql-integration-test-setup). Only after verifying the reported backend and database name, run:

```powershell
Set-Location 'D:\intern project\qiro-job-portal\backend'
python -m pytest -q tests\test_postgres_integration.py
```

Do not set this variable to the development `DATABASE_URL`, a production database, or any database containing important data.

## API endpoints

Resource routes use the `/api` prefix.

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public liveness |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| PATCH | `/api/auth/me` | Authenticated; updates own name/email |
| GET | `/api/jobs` | Public; open jobs, search/filter/pagination |
| GET | `/api/jobs/{id}` | Public |
| POST | `/api/jobs` | Employer |
| PUT | `/api/jobs/{id}` | Owning employer |
| DELETE | `/api/jobs/{id}` | Owning employer |
| POST | `/api/jobs/{id}/apply` | Job seeker |
| GET | `/api/applications/my` | Job seeker |
| GET | `/api/jobs/{id}/applications` | Owning employer |
| PATCH | `/api/applications/{id}/status` | Owning employer |

`GET /api/jobs` accepts `q` or `title`, `location`, `category`, `employmentType` (or `employment_type`), `page`, and `pageSize` (or `page_size`). The paginated response is `{ items, total, page, pageSize, pages }`. User roles are `job_seeker` and `employer`; application statuses are `Pending`, `Shortlisted`, `Rejected`, and `Accepted`. The API uses camelCase JSON field names to fit the existing React services.

Registration/login responses contain `accessToken`, `tokenType`, and safe user information. Send the JWT as `Authorization: Bearer <accessToken>`. Password hashes are never returned.

## Troubleshooting

- **Connection refused / timeout:** confirm PostgreSQL is running, its host/port are reachable, and the database is accepting connections. Local defaults commonly use port `5432`.
- **Authentication failed:** verify the database role/password, URL-encode reserved password characters, and make sure credentials have not been accidentally surrounded by quotes in `.env`.
- **Database does not exist:** create the database first; `alembic upgrade head` creates tables, not the PostgreSQL database itself.
- **Missing table / undefined column:** check `alembic current` and apply `alembic upgrade head` using the same `DATABASE_URL` as the API.
- **CORS in the browser:** add the exact frontend origin (including scheme and port) to `CORS_ORIGINS`, then restart the API.
- **Generic 503 response:** the API intentionally hides database-driver details from clients. Review the local API process logs and validate the connection privately; do not share URLs containing passwords.

## Current integration status and remaining limitations

Frontend job listing/detail, employer job CRUD and applicant management, seeker application history and application submission, profile changes, and application-status updates use the API. API errors are shown to the user; the frontend does not treat network failures as successful persistence.

PostgreSQL integration must still be verified against a reachable PostgreSQL server with the opt-in test above. SQLite tests and migration checks do not establish that PostgreSQL is connected.

- JWT expiry is supported; refresh/revocation, email verification, password reset, rate limiting, and audit history are not implemented.
- Job status is `open`, `closed`, or `draft`; public listing returns open jobs only.
- The health endpoint is a liveness probe, not a database readiness probe.
- Resume URLs are recorded as references; file upload and protected resume storage are not implemented.
- Hosting accounts, deployment, and live URL verification remain the project owner's action.
