# Qiro Tech Job Portal — Implementation and Test Report

## Implementation completed

- Removed mock/demo success fallbacks from job and application API services. Backend/network failures now reject to the UI and are reported instead of being presented as saved data.
- Connected homepage/listings/details, employer job management and applicant/status views, seeker application history, resume URL and cover-letter submission, and profile editing to existing FastAPI routes.
- Added authenticated `PATCH /api/auth/me` for current-user name/email updates, with validation and duplicate-email conflict handling. This uses the existing user model and requires no schema migration.
- Added session-scoped token/user persistence, API validation of protected routes, role-specific dashboard redirects, a working logout action, and honest API error/empty/loading states.
- Added server-side keyword matching against job skills, in addition to title/company/category, with a backend regression test.
- Added employer delete confirmation and displayed applicant application date/cover letter without exposing internal applicant UUIDs as contact details.
- Removed sample jobs/applications from runtime frontend data. The remaining category metadata is presentation-only; automated tests use isolated mocked API responses.
- Added Vercel/Netlify SPA rewrite configuration, root `.gitignore`, root setup/API/deployment instructions, and updated backend instructions.
- Removed all five `react(set-state-in-effect)` lint warnings while preserving initial loading, filter/retry loading, and dashboard refresh behavior.
- Strengthened the opt-in PostgreSQL integration test to assert the Alembic head revision, seeker/employer role restrictions, cross-employer job/applicant authorization, and persisted job/application status across separate requests. This test was not run because the dedicated test URL is not configured.
- Added CORS regression coverage proving the configured local frontend origin can preflight an Authorization request and an untrusted origin is rejected.
- Documented safe creation and verification of a separate disposable PostgreSQL database. Production hosting instructions now list database, backend, frontend, CORS, migration, and URL verification steps; no deployment was performed.

## Test results

| Check | Result |
|---|---:|
| Backend pytest | 20 passed, 1 skipped |
| Frontend Vitest | 27 passed |
| Frontend auth request tests | 5 passed |
| Combined executed test cases | 52 passed, 1 skipped |
| Frontend lint | Exit 0; no warnings |
| Frontend production build | Passed |
| Alembic upgrade on explicit in-memory SQLite | Passed |
| PostgreSQL integration | Skipped; no dedicated test URL configured |
| Playwright E2E | Not run; Playwright packages unavailable |

Latest commands were run on 2026-10-17. The PostgreSQL test is **not** evidence of PostgreSQL connectivity, PostgreSQL migration success, or PostgreSQL persistence because its dedicated URL was absent and the test was skipped.

## Coverage

### Backend

The isolated pytest suite covers health/error behavior, registration/login/JWT behavior, password hashing and safe profile responses, role/ownership restrictions, configured-origin CORS preflight/rejection, job CRUD/search/filter/pagination, application creation/duplicate rejection/privacy, applicant listing/status changes, and database integrity/persistence using an isolated SQLite test fixture. Additional coverage checks profile updates (including duplicate email, auth, empty/null input) and job skill search. The PostgreSQL test code now also checks schema migration, ownership, duplicate application handling, and persistence; those assertions remain unexecuted until the dedicated PostgreSQL test database is available.

### Frontend

Vitest tests cover auth forms and API request contracts, correct route/payload construction, API error propagation, expired-session cleanup, job listing search/filters/retry/empty states, job detail rendering and apply payload/duplicate handling/history refresh, seeker profile/application states and API updates, employer CRUD/status requests and job-list refresh after mutations, delete confirmation, API failure behavior, and protected route role/unauthenticated redirects. Network boundaries are mocked; these tests do not prove PostgreSQL persistence.

## Exact commands run

Latest backend command, from `backend\`:

```powershell
python -m pytest -q -rs
```

Result: `20 passed, 1 skipped`. The skipped case reported: `Set POSTGRES_TEST_DATABASE_URL to a dedicated PostgreSQL test database`. The test URL was checked without displaying credentials and was not configured, so no PostgreSQL connection was attempted.

An isolated SQLite migration smoke test used an in-memory database URL and a temporary test-only signing key in the current PowerShell process:

```powershell
$env:DATABASE_URL='sqlite+pysqlite:///:memory:'
$env:SECRET_KEY='isolated-migration-test-only-key'
Set-Location 'D:\intern project\qiro-job-portal\backend'
alembic upgrade head
Remove-Item Env:DATABASE_URL
Remove-Item Env:SECRET_KEY
```

Alembic applied revisions `0001_initial` and `0002_postgres_integrity`. This was an SQLite-only smoke test, not a PostgreSQL migration test.

From `frontend\`:

```powershell
npm test
npm run test:auth
npm run lint
npm run build
npm ls @playwright/test playwright --depth=0
```

- `npm test`: 27 tests passed across 3 test files (including the final session-expiry and mutation-refresh changes).
- `npm run test:auth`: 5 tests passed.
- `npm run lint`: exit code 0 with no warnings.
- `npm run build`: Vite production build passed.
- Playwright dependency check returned an empty dependency tree; browser E2E was not run.

A source scan for common embedded credential patterns returned documentation and test references only; it did not print any credential values. `backend/.env` exists but was not opened, copied, or modified. The root `.gitignore` excludes `.env` files, Python environments/caches, `node_modules`, build outputs, local databases, and logs while allowing `.env.example` files. The workspace has no Git metadata, so `git check-ignore` and tracked-file verification could not be run.

## PostgreSQL and end-to-end status

- `POSTGRES_TEST_DATABASE_URL` was not configured. No development or production database was contacted or modified. The opt-in test was skipped by pytest.
- No PostgreSQL server connection, empty PostgreSQL migration, or actual PostgreSQL persistence test was verified.
- No browser E2E workflow ran. Playwright packages are unavailable, and without a dedicated PostgreSQL test environment a browser run could not establish real persistence.
- The automated backend tests use an explicit isolated in-memory SQLite fixture and are safe to run without touching the configured local database.
- The SQLite Alembic smoke test reported in the prior test run applied revisions `0001_initial` and `0002_postgres_integrity`; this was not run against PostgreSQL.

## Authentication, environment, and deployment review

- JWTs are signed using `SECRET_KEY` loaded as a Pydantic `SecretStr`; the token subject resolves to the user on every request, and authorization derives role/ownership from the database. Password hashes use `pwdlib`'s recommended Argon2 hasher; response schemas omit hashes.
- CORS uses an explicit allowlist from `CORS_ORIGINS`, with localhost defaults for local development. Production must set exact frontend origins and must not use wildcard origins.
- Frontend API origin is build-time `VITE_API_BASE_URL`; no backend credential belongs in the frontend environment.
- Root `.gitignore` covers env files and local generated data, but this cannot be verified against Git tracking because the workspace has no `.git` directory.
- `.env` contents were not inspected and no real credential was printed.
- Vercel/Netlify SPA rewrite files and provider-specific setup steps are documented. No provider configuration, production migration, or live deployment was executed.

## Remaining risks / limitations

- PostgreSQL integration must be run using a newly created disposable database whose name satisfies the guarded integration test; do not use a production or normal development database.
- Applications support validated resume URLs and cover letters. File upload/storage/access control is not implemented.
- Browser storage uses `sessionStorage` for the tab session; production hardening should consider HttpOnly secure cookies or another XSS-resistant token strategy.
- Email verification, password reset, token refresh/revocation, rate limiting, and audit logging are not implemented.
- No Git repository/remote, GitHub URL, hosting account, deployed URL, evaluator account, or demo video exists in this workspace. Those deliverables require project-owner accounts and actions.

## Rerun commands

```powershell
Set-Location 'D:\intern project\qiro-job-portal\backend'
python -m pytest -q

Set-Location 'D:\intern project\qiro-job-portal\frontend'
npm test
npm run test:auth
npm run lint
npm run build
```

Only run the opt-in PostgreSQL test after creating and verifying a separate disposable database as described in [`README.md`](./README.md#safe-postgresql-integration-test-setup). It was not run in this environment.
