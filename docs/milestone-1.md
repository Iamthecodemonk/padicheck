# Milestone 1: database, authentication, authorization, and media

The complete project schema was re-read before changes. Live database verification
confirmed that its columns, constraints, indexes, and triggers match the supplied
schema. The original SQL and initial migration remain unchanged. No new database
tables or columns were introduced during this milestone.

## Feature-to-schema mapping

Existing auth and RBAC mapping is documented in `schema-alignment.md`.

Cloudinary uploads use `media_files.media_id`, `uploaded_by_user_id`,
`storage_provider`, `provider_asset_id`, `provider_public_id`,
`provider_resource_type`, `provider_delivery_type`, `provider_version`,
`original_filename`, `media_type`, `mime_type`, `size_bytes`, `sha256`,
`visibility`, `upload_status`, and `created_at`. Defaults and permitted values
are preserved. Removal checks the existing media references in `users`, `sources`,
`verification_evidence`, and `user_report_evidence`; admin removal writes to
`admin_audit_logs`.

Logout uses a hash-based token revocation store outside PostgreSQL, so the absence
of a session table does not require a schema change. Google sign-in is conditional
on existing configuration; the inspected environment has no Google credentials.

## Files added or changed in this milestone

| Files | Change |
| --- | --- |
| `src/database/migrate.ts` | Preserve the baseline-only workflow; bound lock waits and clean up failed connections |
| `src/config.ts`, `.env.example` | Cloudinary, Redis, upload limits, and placeholders |
| `src/app.ts` | Inject storage/revocation adapters, register media routes, expand readiness |
| `src/modules/auth/routes.ts` | Unique JWTs and token-revoking logout |
| `src/modules/auth/revocations.ts` | Redis adapter and development/test memory store |
| `src/modules/authorization/index.ts` | Validate JWT subject/expiry and reject revoked tokens |
| `src/adapters/cloudinary.ts` | Backend uploads, deletion, and expiring download signatures |
| `src/modules/media/types.ts`, `validation.ts`, `routes.ts` | Storage contract, MIME/result checks, upload lifecycle and access controls |
| `scripts/smoke-database.ts` | Live PostgreSQL smoke test now includes logout |
| `scripts/verify-database.ts`, `tests/backend.test.ts` | Type annotations for broader type checking |
| `tests/support/database.ts` | Embedded PostgreSQL fixture initialized from the exact supplied SQL |
| `tests/database.test.ts`, `logout.test.ts`, `media.test.ts` | Connection failure, logout, authorization, media and SDK adapter coverage |
| `tsconfig.check.json`, `package.json`, `package-lock.json` | Type-check source/scripts/tests; add dependencies; run memory-intensive test files sequentially |
| `README.md`, `docs/schema-alignment.md`, this file | API/run instructions, schema mapping and milestone record |

## Verification

Commands used:

```powershell
npm.cmd install cloudinary @fastify/multipart file-type redis --fetch-retries=0 --fetch-timeout=20000
npm.cmd run db:verify
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run db:smoke
```

The npm download required execution outside the network-restricted sandbox.
The baseline migration entrypoint was also run directly with
`node --import tsx src/database/migrate.ts`, using a generated temporary database
connection supplied through `DATABASE_URL`. It created all 32 public tables. The
temporary database was removed afterward. The configured application database
was not reset or given a second baseline application.

Tests cover baseline execution and schema constraints, registration rollback,
password verification, invalid/expired/revoked tokens, suspension and live RBAC,
superadmin restrictions, audit rollback, auth rate limits, database failure,
media ownership, image/video/audio/document resource mapping, pending/ready/failed
states, MIME spoofing, size and multipart limits, provider metadata validation,
upload cleanup, database finalization failure, referenced-media protection,
audited admin removal, SDK option/error handling, and signed-download expiry.

Final results: all 29 tests passed; source/script/test type checking and build
passed; live schema verification found no drift; live PostgreSQL registration,
login, logout, default-role, authorization-denial, and readiness smoke checks
passed. Smoke-test writes were rolled back. Concurrent compiler/database test
execution initially exhausted available memory; the final checks ran sequentially
and the npm test runner now limits file concurrency to one.

## Environment limits and next milestone

Cloudinary credentials and a Redis URL are absent from the local environment.
Media tests use a provider adapter double and mock the Cloudinary SDK transport;
they do not upload real assets. Signed URL generation is exercised with the real
SDK using test-only credentials. Production shared Redis behavior is implemented
but has not been exercised against a live Redis server. Local logout tests use
the documented memory store, including cross-instance tests sharing that store
and failure handling. Production requires Redis with persistence and no eviction;
memory revocations are lost on local process restart.

The next milestone is investigation creation and lifecycle, followed by worker
processing and evidence/source collection. It was not started here; AI routing
and full investigation workflows remain outside this milestone.
