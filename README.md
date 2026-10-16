# PadiCheck backend

Backend-only modular monolith using TypeScript and Fastify. Background workers
run separately and reuse the API's domain modules and provider adapters.

## Current implementation

- Required PostgreSQL and JWT configuration with environment validation.
- `GET /health` liveness endpoint.
- `GET /ready` database schema-column and token-revocation-store checks.
- Password registration/login with salted scrypt hashes and 15-minute JWTs; logout revokes the submitted token.
- Live server-side RBAC with suspension enforcement.
- Superadmin-only role grants with transactional audit records.
- Backend-controlled Cloudinary uploads, private delivery, and media lifecycle tracking.
- Investigation creation, owner cancellation/retry, scoped reads, targets and identifiers.
- BullMQ workers for collecting submitted source references, with durable PostgreSQL reconciliation.
- Opt-in UltraSearch discovery, bounded page/PDF text retrieval, and registry-routed Gemini analysis.
- Evidence-linked unverified findings, model-run records, and audited AI configuration APIs.
- Structured logging with authorization and cookie redaction.
- Graceful shutdown.

The supplied schema is present and copied unchanged to the baseline migration.
The configured local database has been aligned with the supplied schema using
the approved legacy migration. See [schema-alignment.md](docs/schema-alignment.md)
for the inspection and application record. Directory, verification, and moderation
workflows remain later milestones. Research stays disabled until configured.

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
connectivity, the auth/RBAC/media/investigation/source columns used by this
milestone, and the token revocation store. When Redis jobs are configured it also
checks queue connectivity. Complete schema verification remains `npm run db:verify`.

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
| POST | `/v1/investigations` | `investigations.create`; returns 202 |
| GET | `/v1/investigations` | Own scope by default; `scope=all` requires `investigations.read_all` |
| GET | `/v1/investigations/:investigation_id` | Owner with `investigations.read_own`, or `investigations.read_all` |
| GET | `/v1/investigations/:investigation_id/sources` | Same read permissions |
| POST | `/v1/investigations/:investigation_id/cancel` | Owner with `investigations.create`; active requests only |
| POST | `/v1/investigations/:investigation_id/retry` | Owner with `investigations.create`; failed requests only |
| GET | `/v1/investigations/:investigation_id/findings` | Same investigation read permissions; includes source links/quotes |
| GET | `/v1/investigations/:investigation_id/model-runs` | Same investigation read permissions; execution/usage metadata |
| GET/POST/PATCH | `/v1/admin/ai/{resource}` | `ai_config.manage`; see milestone 3 for resources and credential restrictions |

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

## Investigations and source collection

Example creation body:

```json
{
  "investigation_type": "web_analysis",
  "title": "Review Example",
  "user_prompt": "Record these references for later investigation.",
  "input_data": {
    "urls": ["https://example.com/"],
    "targets": [{
      "entity_type": "website",
      "canonical_name": "Example",
      "target_role": "primary",
      "identifiers": [{ "identifier_type": "domain", "value": "example.com" }]
    }]
  }
}
```

Creation persists the investigation and target relationships in one transaction,
then attempts job dispatch. The response includes `dispatch: "queued"` or
`"deferred"`; deferred requests remain durable in PostgreSQL and are recovered by
the worker reconciler. HTTP retries of the create endpoint create new requests;
use the returned investigation ID for subsequent reads/cancellation/retry.

Supported types are the six types in the supplied schema. `web_analysis` requires
at least one URL, `contract_review` requires at least one `input_data.media_ids`
document, and `phone_lookup` requires a target with a phone identifier. Phones
must include an international country code, for example `+2348012345678`.
Attachments must be ready authenticated documents owned by the requester. Up to
10 URLs, 10 document IDs, and 10 targets (10 identifiers each) are accepted. The
prompt limit is 10,000 characters, with a 64 KiB total creation-body limit.

Submitted URLs and documents become private `sources` linked through
`investigation_sources`, with `discovery_method = user_submission` and
`used_in_analysis = false`. The collector records references and existing hashes;
when research is disabled, it does not fetch URLs, download documents, independently
search, or run AI. Sources have no fabricated fetched timestamp, excerpt, or
verification claim. The optional research stage below retrieves actual excerpts.

The current lifecycle is `queued -> collecting_sources`, with explicit failure,
owner retry (`failed -> queued`), and owner cancellation. After successful
reference collection, status stays `collecting_sources` and detail responses
include `source_collection_complete: true` plus the current capability limits.
With research disabled, no investigation is marked `analyzing` or `completed`. Read-all
permission does not allow someone to cancel or retry another user's request.

List requests support `limit` (1–100) and an opaque `cursor`; responses include
`next_cursor`. Source lists support `limit` (1–100) and `offset` (0–10000).
Creation, cancellation, and retry each allow 20 requests per minute per client IP
per API process. All investigation responses use `Cache-Control: no-store`.

Configure a working `REDIS_URL`, then run the API and worker in separate terminals:

```powershell
npm.cmd run dev
```

```powershell
npm.cmd run worker:dev
```

For compiled deployment use `npm.cmd run build`, `npm.cmd start`, and
`npm.cmd run worker:start`. `WORKER_CONCURRENCY` defaults to 2 (maximum 10).
`INVESTIGATION_RECONCILE_INTERVAL_MS` defaults to 10000. Without Redis configured,
the API can persist requests, but processing remains deferred; there is no
automatic in-process queue fallback. `/ready` reports `background_jobs` as
`unconfigured` in that mode. It checks connectivity when jobs are configured,
not whether a separate worker process is currently running.

The worker uses bounded retries, idempotent collection, row locks, and recovery
scans in pages of 100. Job data contains an investigation ID and database revision,
not prompts, uploaded bytes, source URLs, or credentials. See
[milestone-2.md](docs/milestone-2.md) for schema mapping, recovery semantics, tests,
and remaining integration limits.

## UltraSearch and Gemini research

Research is opt-in (`RESEARCH_ENABLED=false` by default). This preserves submitted
reference collection while providers are unconfigured. To enable the full path,
configure `REDIS_URL`, `ULTRASEARCH_URL`, and `GEMINI_API_KEY`, create the AI registry
entries described in [milestone-3.md](docs/milestone-3.md), then set
`RESEARCH_ENABLED=true` in both API and worker environments and restart them.
Set Cloudinary credentials as well for private document extraction.

The supported search service is the user-selected
[Ramcharan747/UltraSearch](https://github.com/Ramcharan747/UltraSearch) REST API.
The adapter requests organic links with `ai_mode=none` and `content=false`;
PadiCheck fetches returned pages through its own public-address checks. Gemini
uses the model ID stored in `ai_models` and task assignments ordered by priority.
No production model ID is hard-coded or inferred from an environment variable.

Enabled processing follows `collecting_sources -> analyzing -> completed`, or a
recorded failure/cancellation. `completed` means processing finished, not that a
claim is verified. Every AI finding is stored as `unverified`, cites an allowed
source ID, and includes an exact quotation present in the supplied excerpt.
Quotation validation checks provenance, not whether a conclusion follows from
the evidence. The API includes limitations; users must judge the sources and
interpretation.

The worker blocks nonpublic addresses and validates/pins DNS results and
redirect destinations. Public pages are bounded to 2 MiB and extracted excerpts
to 16,000 characters. PDF extraction is bounded to 25 MiB/50 pages in a separate
worker thread with a 15-second deadline. Image-only/scanned PDFs need OCR, which
is not implemented. Source excerpts and extraction metadata are stored in
`sources`; uploaded file bytes remain outside PostgreSQL.

For a live PostgreSQL pipeline check with provider doubles:

```powershell
npm.cmd run research:smoke
```

This command requires database-creation permission, creates an isolated generated
scratch database, applies the unchanged baseline, tests the pipeline and advisory
lock exclusion, and removes that scratch database. It does not reset your app
database or call real UltraSearch/Gemini services. See milestone 3 for test results
and live-integration limits.

After registration, a database operator can bootstrap the first superadmin:

```powershell
npm.cmd run admin:bootstrap -- owner@example.com
```

The command refuses an existing superadmin and writes an audit entry. Subsequent
role grants require an authenticated superadmin and are audited atomically.

## Business directory and trust workflows

The backend now supports published directory listings, private verification
evidence and staff-reviewed business claims, user-submitted reports, moderation,
and disputes. Publication and claim approval are separate permission-controlled,
audited actions. Public reports remain labeled allegations; private evidence is
delivered only through authenticated media endpoints to owners and authorized
reviewers.

See [milestone 4](docs/milestone-4.md) for endpoint payloads, permissions,
transitions, privacy rules, schema mappings and limits. To check the workflows and
concurrency against an isolated temporary PostgreSQL database:

```powershell
npm.cmd run trust:smoke
```

This requires CREATEDB permission, removes only its generated scratch database,
and makes no external provider calls.

## Investigation sharing

Owners can create expiring, revocable capabilities for completed investigation
results. Creation requires acknowledgment that summaries and finding text may
contain sensitive information. Secrets are returned once, stored only as hashes,
and redeemed in a POST body; the shared response excludes private evidence files,
prompts, inputs, account details and model runs.

See [milestone 5](docs/milestone-5.md) for endpoint payloads, expiration limits,
privacy rules and concurrency guarantees. Run `npm.cmd run sharing:smoke` for
the isolated live PostgreSQL concurrency check (requires CREATEDB, removes its
generated database, makes no external provider calls).

## Deployment and integration checks

See the [deployment runbook](docs/deployment.md) for production configuration,
separate API/worker processes, database release steps, health checks, trusted
proxies and graceful shutdown. Production starts only after dependency readiness;
enabled research also needs configured providers and an active registry.

Run `npm.cmd run integrations:check` for sanitized connectivity/configuration
statuses, or add `-- --require-all` to fail on missing services too. Checks use
provider metadata and one synthetic public search; they do not run Gemini
inference or upload files. The [milestone 6 report](docs/milestone-6.md) records
validation and the live integrations still awaiting configuration.

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
