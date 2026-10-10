# PadiCheck backend

Backend-only modular monolith using TypeScript and Fastify. Background workers
will run separately and reuse the API's domain modules and provider adapters.

## Current implementation

- Required PostgreSQL and JWT configuration with environment validation.
- `GET /health` liveness endpoint.
- `GET /ready` database schema-column and token-revocation-store checks.
- Password registration/login with salted scrypt hashes and 15-minute JWTs; logout revokes the submitted token.
- Live server-side RBAC with suspension enforcement.
- Superadmin-only role grants with transactional audit records.
- Backend-controlled Cloudinary uploads, private delivery, and media lifecycle tracking.
- Structured logging with authorization and cookie redaction.
- Graceful shutdown.

The supplied schema is present and copied unchanged to the baseline migration.
The configured local database has been aligned with the supplied schema using
the approved legacy migration. See [schema-alignment.md](docs/schema-alignment.md)
for the inspection and application record. Investigations, workers, AI, and
directory/moderation workflows remain later milestones.

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
this environment uses port 5433. Set all of `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable uploads. Leave all three
blank to keep auth available while media endpoints return 503. Partial credentials
are rejected at startup. `/health` checks process liveness; `/ready` checks database
connectivity, the auth/RBAC/media columns used by this milestone, and the token
revocation store. Complete schema verification remains `npm run db:verify`.

`REDIS_URL` enables shared token revocation and is required in production. Use
persistent Redis with no key eviction to retain revoked tokens until their TTL
expires; revocation-store failures reject protected requests with 503. Without
Redis, development uses an in-memory store: revocations are local to one process
and are lost on restart. Do not use that mode for production. Only token hashes
are stored, with a TTL ending at the JWT's expiry. The original JWT and secrets
are never stored. Logout invalidates the submitted access token; other login
sessions remain valid. After 204, clients should discard their local token.

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
| POST | `/v1/auth/logout` | Bearer token; returns 204 on revocation |
| GET | `/v1/auth/me` | Bearer token |
| GET | `/v1/admin/roles` | `roles.read` permission |
| POST | `/v1/admin/users/:users_id/roles` | `roles.manage` and superadmin; body `role_key` |
| POST | `/v1/media` | Active account; multipart file named `file` |
| GET | `/v1/media/:media_id` | Owner or `media.manage` |
| POST | `/v1/media/:media_id/delivery` | Owner or `media.manage`; ready media only |
| DELETE | `/v1/media/:media_id` | Owner or `media.manage`; unreferenced media only |

Passwords must be 12–128 characters. Authentication endpoints allow 10 requests
per minute per client IP in each API process. Use `Authorization: Bearer
<access_token>` for protected endpoints. Errors use
`{"error":{"code":"...","message":"..."},"request_id":"..."}`. Client input
cannot assign roles. Refresh tokens, password reset, email verification, and Google
sign-in are not implemented. Google credentials are not configured. Deploy behind
HTTPS. JWTs use fixed issuer/audience and HS256; permissions are read from the
database on every protected request.

## Media handling

Send exactly one binary multipart part named `file`; URL uploads, base64 bodies,
extra form fields, and extra files are rejected. Supported content is JPEG, PNG,
WebP, GIF, MP4, WebM, MP3, WAV, FLAC, Ogg audio, and PDF. The backend detects MIME
from file signatures and rejects mismatched declarations. This is file-type
validation, not malware scanning or document-content analysis. SVG, HTML, and
other formats are excluded from this milestone.

`MEDIA_MAX_BYTES` defaults to 10 MiB and may be configured up to 25 MiB. Files are
buffered within that limit for validation, hashing, and server-side upload;
PostgreSQL receives metadata only. Uploads are limited to 20 requests per minute
per client IP in each API process. Upload permission is ownership-based for active
accounts; the supplied schema has no separate media-upload permission. The
`media.manage` permission controls cross-user review/removal.

All uploads use Cloudinary `authenticated` delivery and database visibility
`private`, including images. Image media maps to Cloudinary `image`, audio and
video to `video`, and PDFs to `raw`. The backend generates collision-resistant
public IDs, includes extensions for raw assets, disables overwrite, and validates
returned asset/public IDs, resource/delivery types, byte counts, and version.
Stored provider IDs, rather than URLs, identify each asset.

The flow is `pending -> ready` on success, `pending -> failed` on failure, and
`ready/failed -> deleted` on removal. Failed uploads attempt cleanup using only
the backend-generated public ID. If cleanup or database finalization cannot be
completed, logs identify the `media_id` needing reconciliation; interrupted
requests can leave pending rows that require operator review in this milestone.
Deletion is refused for records referenced by avatars, sources, verification
evidence, or report evidence. Cross-user admin removal is audited.

The delivery endpoint generates a signed five-minute Cloudinary download URL
after checking authorization. It returns `Cache-Control: no-store`; URLs are not
written to the database. Signed download links remain usable until expiry even
after logout, so clients must handle them as temporary access credentials. This
uses Cloudinary's [time-limited download API](https://cloudinary.com/documentation/control_access_to_media#providing_time-limited_access_to_private_media_assets).

See [milestone-1.md](docs/milestone-1.md) for changed files, verification commands,
and provider-test limitations.

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
