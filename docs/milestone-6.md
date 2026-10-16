# Milestone 6: deployment readiness

Added environment/dependency gates, startup/shutdown handling, a live integration
preflight and an [operational runbook](deployment.md). No hosting resources or
public deployment were created. The supplied database schema is unchanged;
readiness reuses the existing tables and columns and makes no schema changes.

Changes:

- `src/config.ts`: bounded startup/shutdown/request timeouts, trusted proxy
  IP/CIDR validation, enabled production/worker research configuration checks.
- `src/runtime/readiness.ts`: shared database checks and enabled registry/tool
  validation for API and worker. No external HTTP during readiness.
- `src/runtime/lifecycle.ts`, `api.ts`: bounded, idempotent shutdown and production
  readiness before the HTTP listener opens.
- `src/app.ts`: dependency readiness, explicit optional capability states,
  noncacheable health, trusted proxies, query-free request logs and HTTP drain
  handling; resource cleanup attempts all owned resources.
- `src/server.ts`, `src/workers/source-collection.ts`: sanitized startup errors,
  signal handling, worker readiness before consumption, active work/status-write
  draining and cleanup after failures.
- `src/runtime/integrations.ts`, `scripts/check-integrations.ts`: bounded
  connectivity/configuration checks with sanitized statuses; `--require-all` gate.
- `tests/runtime.test.ts`: configuration, proxy trust, dependency gates, error
  cleanup, deadline behavior, real HTTP draining and missing-Redis worker exit.
- `.env.example`, `package.json`, README and runbook: setup, commands and limits.

Local configuration inspection and the real preflight found PostgreSQL available;
Redis, Cloudinary, UltraSearch and Gemini are unconfigured; research remains
disabled. The existing `.env` was not changed, no credentials were printed, and
no synthetic provider calls were made in this environment. No Redis server or
Docker executable was found locally. Real Redis/BullMQ consumption/drain,
Cloudinary upload/delivery and UltraSearch/Gemini end-to-end analysis still need
services/credentials. Provider doubles from earlier milestones remain useful
tests, not proof of those live integrations.

The real HTTP test initially exposed a long drain delay. Draining responses now
close their connection, and the test consumes response bodies; its rerun drained
the active request in under a second. No in-flight request was terminated early.

Validation results:

- `npm.cmd test`: all **101 tests passed**, including the ten runtime checks.
- `npm.cmd run typecheck` and `npm.cmd run build`: passed.
- `npm.cmd run db:verify`: passed; no schema drift or application database writes.
- `npm.cmd run integrations:check`: PostgreSQL passed; optional services were
  explicitly reported unconfigured and research disabled. Exit 0 in partial mode.
- `npm.cmd run integrations:check -- --require-all`: exit 1 as designed because
  Redis, Cloudinary, UltraSearch and Gemini are missing and research is disabled.
  No configured service connection failed; no live provider check was skipped
  while being reported as passed.
- `git diff --check`: passed with Git line-ending conversion warnings only.

Deployment-readiness implementation is complete. Full live acceptance remains
blocked by missing services/credentials and a chosen staging deployment target.
Set the corresponding variables in the protected environment, configure registry
entries as described in milestone 3, then rerun the strict preflight and the
staging acceptance steps in the runbook. Credentials should stay out of chat.

Next milestone: full staging acceptance with configured Redis, Cloudinary,
UltraSearch, Gemini and registry entries, followed by a deployment to the chosen
hosting environment. No staging deployment or external account configuration was
started in this milestone.
