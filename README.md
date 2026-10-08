# PadiCheck backend

Backend-only modular monolith using TypeScript and Fastify. Background workers
will run separately and reuse the API's domain modules and provider adapters.

## Current implementation

- Environment validation for server settings.
- `GET /health` liveness endpoint.
- Structured logging with authorization and cookie redaction.
- Graceful shutdown.

Database, authentication, media, investigations, AI, and admin endpoints are not
implemented yet. The required `padicheck_mvp_schema.sql` is missing from the
workspace. Supply it in the project root before implementing migrations or
schema-dependent features. Its exact names, constraints, and relationships are
the source of truth; any necessary changes must be proposed as migrations first.

## Local setup

Use Node.js 22 or newer and npm. In PowerShell:

```powershell
npm.cmd install
Copy-Item .env.example .env
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

`/health` checks process liveness only. PostgreSQL, Redis, Cloudinary, and provider
credentials are not required or connected in this initial slice. Their example
environment settings are reserved for future adapters. Never commit `.env` or
real credentials.

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
