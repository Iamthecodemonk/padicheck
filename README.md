# PadiCheck backend

Backend-only modular monolith using TypeScript and Fastify. Background workers
will run separately and reuse the API's domain modules and provider adapters.

## Current implementation

- Required PostgreSQL and JWT configuration with environment validation.
- `GET /health` liveness endpoint.
- `GET /ready` database connectivity and users-table check.
- Password registration/login with salted scrypt hashes and 15-minute JWTs.
- Live server-side RBAC with suspension enforcement.
- Superadmin-only role grants with transactional audit records.
- Structured logging with authorization and cookie redaction.
- Graceful shutdown.

The supplied schema is present and copied unchanged to the baseline migration.
The configured local database has been aligned with the supplied schema using
the approved legacy migration. See [schema-alignment.md](docs/schema-alignment.md)
for the inspection and application record. Cloudinary, investigations, workers, AI, and
directory/moderation workflows remain to be implemented.

## Local setup

Use Node.js 22 or newer and npm. In PowerShell:

```powershell
npm.cmd install
Copy-Item .env.example .env
# Configure DATABASE_URL and JWT_SECRET before starting.
npm.cmd run dev
```

The server defaults to `http://127.0.0.1:3000`. Check liveness:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Validate and run the compiled server:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

`DATABASE_URL` must point to PostgreSQL. `JWT_SECRET` must contain at least 32
bytes; generate a random value, for example with
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
Never commit `.env` or real credentials. The local database service inspected in
this environment uses port 5433. Redis and Cloudinary settings are reserved for
future adapters. `/health` checks process liveness; `/ready` checks database
connectivity and the users table, not complete schema alignment.

## Database and tests

```powershell
# Fresh empty public schema only; applies the supplied SQL unchanged.
npm.cmd run db:migrate
# Compare an existing database against the supplied schema (read-only).
npm.cmd run db:verify
# Test auth and RBAC against the configured database; all writes are rolled back.
npm.cmd run db:smoke
npm.cmd test
```

The baseline runner refuses existing public tables and uses an advisory lock to
serialize application. There is no migration-history table or destructive reset
command. `db:align-legacy` applies the approved 002 migration only to the legacy
variant with empty affected tables; do not run it on an already aligned database.
Later versioned migrations and any tracking-table addition must be reviewed
explicitly. `db:verify` exits with status 1 on drift and writes a structural
report to `docs/database-drift.json`; it clears the report when alignment passes.
Tests execute the exact SQL in
embedded PostgreSQL (PGlite); they do not mutate your configured database or
require external provider credentials.

## Current API

| Method | Path | Access |
| --- | --- | --- |
| GET | `/health` | Public liveness |
| GET | `/ready` | Public database readiness |
| POST | `/v1/auth/register` | Public; `display_name`, `email`, `password` |
| POST | `/v1/auth/login` | Public; `email`, `password` |
| GET | `/v1/auth/me` | Bearer token |
| GET | `/v1/admin/roles` | `roles.read` permission |
| POST | `/v1/admin/users/:users_id/roles` | `roles.manage` and superadmin; body `role_key` |

Passwords must be 12–128 characters. Authentication endpoints allow 10 requests
per minute per client IP in each API process. Use `Authorization: Bearer
<access_token>` for protected endpoints. Errors use
`{"error":{"code":"...","message":"..."},"request_id":"..."}`. Client input
cannot assign roles. Refresh tokens, password reset, email verification, Google
sign-in, and individual token revocation are not implemented. Deploy behind
HTTPS. JWTs use fixed issuer/audience and HS256; permissions are read from the
database on every protected request.

After registration, a database operator can bootstrap the first superadmin:

```powershell
npm.cmd run admin:bootstrap -- owner@example.com
```

The command refuses an existing superadmin and writes an audit entry. Subsequent
role grants require an authenticated superadmin and are audited atomically.

## Planned modules and implementation order

1. Review the complete SQL schema; document exact feature-to-column mappings.
2. Add PostgreSQL access with parameterized queries and schema-based migrations.
3. Add accounts, login identities, server-side RBAC, and audited admin operations.
4. Add a Cloudinary storage adapter and the `media_files` upload lifecycle,
   preserving provider asset identifiers and authenticated delivery for sensitive
   assets. Store metadata only in PostgreSQL.
5. Add investigations, target identifiers, source collection, and findings linked
   to evidence; use the schema's permitted status transitions.
6. Add Redis/BullMQ workers, search tools, registry-driven AI routing and fallback,
   and model run records. Reconcile durable investigation state with queued jobs
   and make retries idempotent.
7. Add permission-protected admin APIs for the AI registry and trust workflows.
8. Run database integration tests and tests for permissions, uploads, routing,
   retries, and source attribution; document required services.

Planned directories within `src/`: `modules/` for auth, authorization, media,
investigations, evidence, AI, directory, moderation, and admin; `adapters/` for
Cloudinary, AI, and search; `database/` for connections and repositories;
`workers/` for background entrypoints. SQL migrations will live in
`db/migrations/`. Each feature will identify its existing tables and columns
before implementation. Google sign-in will be added when configured. Admin
management is provided through APIs; this repository has no frontend scope.

Findings must communicate evidence, uncertainty, limitations, and source links;
they must not assert that an investigation proves a claim true.
