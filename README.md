# Qiro Tech Job Portal

A responsive job portal for job seekers and employers, with a React/Vite frontend and a FastAPI backend backed by SQLAlchemy and PostgreSQL. The frontend uses the real API for job listings, job management, applications, application statuses, and profile updates; failed requests are surfaced instead of being turned into fake successful mutations.

## Features

- Public homepage with current jobs, category browsing, title/company/skill search, and location search.
- Job listings with server-side keyword/category/location/employment-type filters and pagination.
- Job details with salary, company, location, job type, skills, resume URL, and cover-letter fields.
- Registration/login with job-seeker and employer roles, validation, JWT authentication, and protected role-specific dashboards.
- Job-seeker dashboard with API-backed profile editing and application/status history.
- Employer dashboard with owned-job CRUD, deletion confirmation, applicant lists, and allowed application-status updates.
- API-side authorization, ownership enforcement, duplicate-application rejection, validation, and database integrity constraints.
- Alembic migrations; PostgreSQL is required for normal backend operation. The automated backend unit suite uses its explicitly configured isolated SQLite fixture.

## Technology and design

- Frontend: React, Vite, React Router, Axios, Lucide, Tailwind CSS.
- Backend: Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic, Alembic, psycopg 3, JWT, Argon2 password hashing.
- The frontend has one Axios client whose base URL is `VITE_API_BASE_URL`. API services do not substitute mock data when calls fail.
- Login credentials are kept in browser `sessionStorage` for the tab session and validated by the backend on protected routes. The server remains the authority for identity, role, and ownership.
- Database schema changes are incremental Alembic migrations. Do not run schema resets against a database containing data.

## Requirements

- Python 3.11 or later.
- Node.js/npm compatible with the Vite version in `frontend/package.json`.
- PostgreSQL 14 or later for local app runtime and real persistence.

## Local setup (Windows PowerShell)

### 1. Configure PostgreSQL

Create a PostgreSQL database and an application role using your local PostgreSQL tools or managed provider. Keep credentials private. For example, in `psql` as an administrator (replace names and set a private password):

```sql
CREATE ROLE qiro_app WITH LOGIN PASSWORD 'REPLACE_WITH_A_PRIVATE_PASSWORD';
CREATE DATABASE qiro_portal OWNER qiro_app;
```

Create `backend/.env` from `backend/.env.example` and configure `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, and `CORS_ORIGINS`. Use the psycopg 3 SQLAlchemy URL form:

```text
postgresql+psycopg://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:5432/DB_NAME
```

Generate a new local JWT key; do not use the example placeholder:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the generated key only in the ignored `backend/.env`. Never commit `.env` or share its contents.

### 2. Install backend dependencies, migrate, and start

```powershell
Set-Location 'D:\intern project\qiro-job-portal\backend'
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env with your private PostgreSQL URL and generated secret.
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API liveness: `http://127.0.0.1:8000/health`  
Swagger: `http://127.0.0.1:8000/docs`  
ReDoc: `http://127.0.0.1:8000/redoc`

The health route is a liveness probe, not a database-readiness test.

### 3. Configure and start frontend

In another PowerShell window:

```powershell
Set-Location 'D:\intern project\qiro-job-portal\frontend'
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Set VITE_API_BASE_URL=http://127.0.0.1:8000/api in frontend/.env.
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. Vite reads environment variables at startup; restart it after changing `frontend/.env`.

## Database schema and migrations

- `users`: unique email, Argon2 password hash, role (`job_seeker` or `employer`), created timestamp.
- `jobs`: owning employer foreign key, title/company/location/category/employment type/salary/description/JSON skills/status/timestamps.
- `applications`: job and job-seeker foreign keys, optional resume URL and cover letter, status, created timestamp; database unique constraint on `(job_id, job_seeker_id)`.
- Foreign keys and check constraints protect roles, job statuses, and application statuses. Deletion cascades are configured for owner/job records and associated applications.

Use the `backend` directory for Alembic commands:

```powershell
Set-Location 'D:\intern project\qiro-job-portal\backend'
alembic current
alembic history
alembic upgrade head
alembic check
```

Back up important databases before applying schema changes. Do not use downgrade as a reset mechanism.

## API endpoints

Paths use the `/api` prefix unless noted. User data responses exclude password hashes.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness |
| POST | `/api/auth/register` | Public | Register job seeker or employer |
| POST | `/api/auth/login` | Public | Obtain access token |
| GET | `/api/auth/me` | Authenticated | Current safe profile |
| PATCH | `/api/auth/me` | Authenticated | Update current user's name/email |
| GET | `/api/jobs` | Public | Open jobs with search/filter/pagination |
| GET | `/api/jobs/{job_id}` | Public | Open job detail |
| GET | `/api/jobs/mine` | Employer | Current employer's jobs |
| POST | `/api/jobs` | Employer | Create job |
| PUT | `/api/jobs/{job_id}` | Owning employer | Update job |
| DELETE | `/api/jobs/{job_id}` | Owning employer | Delete job |
| POST | `/api/jobs/{job_id}/apply` | Job seeker | Submit application |
| GET | `/api/applications/my` | Job seeker | Current seeker's applications |
| GET | `/api/jobs/{job_id}/applications` | Owning employer | Applicants for owned job |
| PATCH | `/api/applications/{application_id}/status` | Owning employer | Set Pending/Shortlisted/Rejected/Accepted |

`GET /api/jobs` accepts `q` or `title`, `location`, `category`, `employmentType` (also `employment_type`), `page`, and `pageSize` (also `page_size`). Its response is `{ items, total, page, pageSize, pages }`. Job statuses are `open`, `closed`, and `draft`; only open jobs appear publicly. Registration roles are `job_seeker` and `employer`.

## Tests and quality checks

Run commands in their respective directories:

```powershell
# Isolated backend suite (does not use the configured development DB)
Set-Location 'D:\intern project\qiro-job-portal\backend'
python -m pytest -q

# Frontend unit tests, auth request tests, lint, and production bundle
Set-Location 'D:\intern project\qiro-job-portal\frontend'
npm test
npm run test:auth
npm run lint
npm run build
```

### Safe PostgreSQL integration test setup

The integration test runs only when `POSTGRES_TEST_DATABASE_URL` is explicitly set. It requires PostgreSQL and a database name ending in `_test`, `-test`, `_test_db`, or `-test_db`. It creates a uniquely named temporary schema, runs Alembic migrations in that schema, verifies the migrated tables and current revision, exercises API workflows, and drops only that temporary schema. Still use a new disposable database dedicated to these tests; a matching suffix alone does not make a development or production database safe.

1. Create a **new, empty database** and dedicated login role using your PostgreSQL administrator tools. Do not reuse the development database, its role, or its URL. For a locally administered PostgreSQL server, run these statements in `psql` connected to the administrative database; replace the password with a new private value:

   ```sql
   CREATE ROLE qiro_test LOGIN PASSWORD 'SET_A_NEW_PRIVATE_TEST_PASSWORD';
   CREATE DATABASE qiro_portal_test OWNER qiro_test;
   ```

   Keep `qiro_portal_test` disposable and exclusively for integration tests. Do not point the test variable at `backend/.env`'s `DATABASE_URL`.
2. Build a SQLAlchemy psycopg URL of this shape, percent-encoding reserved characters in the password:

   ```text
   postgresql+psycopg://qiro_test:<URL_ENCODED_TEST_PASSWORD>@127.0.0.1:5432/qiro_portal_test
   ```

3. In the same PowerShell window, enter the URL at a secure prompt and set it only in that process. This does not print or write the URL:

   ```powershell
   $secureUrl = Read-Host 'Dedicated disposable PostgreSQL test URL' -AsSecureString
   $urlPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
   try {
       $env:POSTGRES_TEST_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($urlPointer)
   } finally {
       [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($urlPointer)
       Remove-Variable secureUrl, urlPointer
   }
   ```

4. Before running tests, print only the parsed backend and database name (never the URL or credentials):

   ```powershell
   Set-Location 'D:\intern project\qiro-job-portal\backend'
   python -c "import os; from sqlalchemy.engine import make_url; u=make_url(os.environ['POSTGRES_TEST_DATABASE_URL']); print(f'backend={u.get_backend_name()}, database={u.database}')"
   ```

   Confirm this reports `backend=postgresql, database=qiro_portal_test` (or the dedicated test database name you created). Stop if it reports a normal development or production database.
5. Run the guarded PostgreSQL integration test first, and the full backend suite only if it passes:

   ```powershell
   Set-Location 'D:\intern project\qiro-job-portal\backend'
   try {
       python -m pytest -q tests\test_postgres_integration.py
       if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL integration test failed; full suite not run.' }
       python -m pytest -q
       if ($LASTEXITCODE -ne 0) { throw 'Backend test suite failed.' }
   } finally {
       Remove-Item Env:POSTGRES_TEST_DATABASE_URL -ErrorAction SilentlyContinue
   }
   ```

A skipped PostgreSQL test is not evidence of PostgreSQL connectivity or migration success. The integration test verifies the Alembic head revision, job creation/editing/deletion, application submission and duplicate rejection, ownership restrictions, status updates, and persistence across API requests. It applies migrations only inside its temporary schema and never runs a migration against the database's `public` schema. Current execution status is recorded in [`TEST_REPORT.md`](./TEST_REPORT.md).

## Testing both roles

1. Register one account as **Job seeker** and another as **Employer**. Registration creates real database records.
2. Sign in as the employer, create an open listing, and verify it appears under Find jobs and remains after refresh.
3. Sign in as the seeker, open that listing, submit an optional resume URL and cover letter, and verify it appears in the seeker dashboard.
4. Sign back in as employer, review the applicant, and change its status to one of the supported statuses.
5. Sign back in as seeker and verify the new status after refresh.
6. Try the duplicate application and confirm the API rejects it; verify a different employer cannot access or change the first employer's job/application.

The repository intentionally contains no default evaluator account or demo password. Create evaluation accounts through registration in the environment prepared for evaluation.

## Deployment preparation (not deployed)

Deployment requires accounts and provider-side configuration and has not been performed or verified.

### Production PostgreSQL

1. Create a managed PostgreSQL database in the intended production region using your provider account.
2. Create or select a dedicated application role with access only to the portal database. Configure the provider-issued connection string as backend `DATABASE_URL` in SQLAlchemy `postgresql+psycopg://...` form. Keep it in backend provider secrets, never frontend variables or source.
3. Set a new randomly generated `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, and `CORS_ORIGINS` in the backend provider. `CORS_ORIGINS` must be a comma-separated list of exact frontend origins (scheme + host, no path); do not use `*`.
4. Back up the database, run `alembic upgrade head` using the production backend environment, and verify `/health`, `/docs`, registration, login, and persisted job/application workflows.

### Frontend (Vercel or Netlify)

1. Import the repository and set the project/root directory to `frontend`.
2. Use `npm run build` as the build command and `dist` as the output directory.
3. Set build-time `VITE_API_BASE_URL` to `https://<your-api-host>/api`. This is public frontend configuration, not a secret.
4. Deploy and verify direct page loads and refreshes for `/jobs` and both dashboard routes. The SPA rewrite configuration routes browser paths to `index.html`.
5. Add the exact deployed frontend origin to backend `CORS_ORIGINS`, restart/redeploy the API, and verify browser API requests and preflight handling.

### Backend (Render or Railway)

1. Create a Python 3.11+ web service using `backend` as its root directory.
2. Install dependencies with `python -m pip install -r requirements.txt`. Set the start command to:

  ```text
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```

3. Configure `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, and `CORS_ORIGINS` as provider-managed variables/secrets. Generate a new production secret; do not reuse local, test, or example values.
4. Run migrations before serving traffic. Confirm provider logs do not echo environment values.
5. Verify `https://<your-api-host>/health`, `/docs`, CORS, both account roles, and actual database persistence after refresh before publishing URLs.

## Submission deliverables and limitations

- No Git repository/remote is configured in this workspace, so a repository URL cannot be provided or committed from here.
- No frontend/backend has been deployed; live URLs must be supplied after provider account setup and verification.
- Evaluator credentials should be created privately through the deployed registration flow; none are hardcoded.
- A 5–10 minute demo video requires a recording and submission action from the project owner.
- PostgreSQL integration is not considered verified unless the dedicated PostgreSQL integration test and migration run complete against a real disposable PostgreSQL database.
- Email verification, password reset, refresh/revocation, rate limiting, protected resume storage, and audit history are outside the current implementation.
