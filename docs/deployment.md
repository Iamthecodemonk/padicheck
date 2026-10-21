# Deployment runbook

This repository deploys as two Node.js processes: the HTTP API and the BullMQ
source/research worker. No frontend, hosting account or public deployment is
created by these instructions. This release was developed on Node 22.22.2.

## Release preparation

On the build/release host, install the locked dependencies and run the checks:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run db:verify
npm.cmd run integrations:check -- --require-all
```

Use `npm` instead of `npm.cmd` on Linux. Keep development dependencies on the
release/check host: the migration, bootstrap and smoke commands use `tsx`.
Runtime hosts need `dist/`, `package.json`, `package-lock.json` and dependencies
installed with `npm ci --omit=dev`. Never copy `.env` into a published artifact.
Supply secrets through the host's protected environment/secret store. Preserve
the private PDF worker's dependencies, including optional platform packages.

The full preflight requires configured Redis, Cloudinary, UltraSearch, Gemini, SMTP and Google login,
`RESEARCH_ENABLED=true`, and a usable AI registry. If deploying a deliberately
limited API with research disabled, use the normal preflight, inspect its explicit
`unconfigured`/`disabled` results, and treat those features as unavailable.

## Environment

Deploy the OTP email worker as a separate process with
`npm.cmd run email:worker:start` after building. It must use the same Redis and
JWT secret as the API, plus SMTP configuration. It verifies SMTP at startup and
logs sanitized send duration, queue wait time, retry failures and exhausted
attempts. Monitor this process separately: API readiness checks queue access,
not whether an email worker is running. Without it, OTP jobs wait until their
challenges expire. See [background delivery](authentication.md#background-otp-delivery).

Start from `.env.example` without copying real secrets into source control.

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | Set `production` on deployed API and worker |
| `HOST`, `PORT` | Bind address/port; default loopback `127.0.0.1:3000`; set `0.0.0.0` only when required by the hosting network |
| `DATABASE_URL` | Dedicated PostgreSQL connection; use the database provider's authenticated/TLS connection settings |
| `REDIS_URL` | Shared Redis for token revocation and BullMQ; required in production and for every worker |
| `JWT_SECRET` | At least 32 bytes from a secure random generator; keep consistent across API replicas |
| `PLATFORM_EXTENSIONS_ENABLED` | Enable sessions/MFA/bookmarks/notifications/teams/API keys only after migration 004 and encryption-key configuration |
| `ACCOUNT_ENCRYPTION_KEY` | Stable private 32-byte key encoded as 64 hex characters; encrypts authenticator secrets; back up separately from JWT configuration |
| `SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP configuration for OTP signup; see the authentication guide |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID for Google ID-token login/linking; no client secret required |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | All three or none; missing storage keeps media routes unavailable |
| `RESEARCH_ENABLED` | Explicit `true` or `false`; default false |
| `ULTRASEARCH_URL`, `GEMINI_API_KEY` | Required for enabled production/worker research |
| `ULTRASEARCH_API_KEY` | Optional bearer secret for your UltraSearch proxy, referenced by the registry tool |
| `TRUST_PROXY` | Comma-separated trusted proxy IPs/CIDRs; blank trusts none; booleans/hostnames are rejected |
| `STARTUP_TIMEOUT_MS` | Default 30000, supported range 1000–120000 |
| `SHUTDOWN_TIMEOUT_MS` | Default 180000, supported range 1000–600000 |
| `REQUEST_TIMEOUT_MS` | Incoming HTTP request deadline; default 65000, range 1000–120000; does not cancel model processing |
| `WORKER_CONCURRENCY` | Default 2, range 1–10; consider the ten-connection pool and external provider capacity |
| `INVESTIGATION_RECONCILE_INTERVAL_MS` | Default 10000; durable dispatch recovery interval |

Model identifiers, instructions, tools and assignments remain in the AI registry.
No production model is selected by environment variable. Configure the registry
through the audited APIs described in [milestone 3](milestone-3.md).

Production API configuration validation checks research secrets/endpoints when
enabled. Worker configuration applies those requirements in every environment.
API startup also checks live database/schema, Redis revocation/queue access and,
when enabled, research routing before opening its HTTP listener. The worker checks
those dependencies before it begins processing or reconciliation. Invalid
configuration/startup exits nonzero with sanitized diagnostics.

Research readiness requires an enabled analysis task and active assignment(s),
supported Gemini provider/model references, and the primary agent's enabled
`ultrasearch_search`, `public_url_fetch` and `pdf_extract` tools. These tools cover
the supported web/document workflows; a fallback model cannot repair missing
collection tools. An optional search credential reference must resolve to
`ULTRASEARCH_API_KEY`. Readiness does not make external provider HTTP calls.

## Database and bootstrap

Provision an empty, dedicated application database for a fresh installation. Run
`npm.cmd run db:migrate` once from the release host; the baseline runner deliberately
refuses an existing public schema. For an existing installation run
`npm.cmd run db:verify`; do not rerun the baseline or reset data. There is no new
migration in milestones 4–6. The legacy-alignment command is only for the reviewed
legacy database case described in [schema alignment](schema-alignment.md).

Keep schema/migration operations separate from API startup and run them once per
release, rather than from every replica. Back up PostgreSQL before changes and
exercise restores in an isolated database. Keep Redis persistent and shared
between API replicas/workers; lost revocations can let an unexpired JWT work
again, and lost queue state requires durable-state reconciliation.

Register the first owner account, then run `npm.cmd run admin:bootstrap --
owner@example.com` from a controlled release host. It refuses a second bootstrap.
Use the audited role APIs for subsequent role grants. Neither bootstrap nor
registry seeding is performed automatically during deployment.

## Process supervision and shutdown

Run the API and worker as separately supervised, unprivileged processes:

```powershell
node dist/server.js
node dist/workers/otp-email.js
node dist/workers/source-collection.js
```

Configure automatic restart on an unexpected nonzero exit. Send SIGTERM for a
rolling restart on hosts that support it; SIGINT is also handled. Windows service
managers must deliver a supported graceful signal/control action; forcibly killing
a process does not drain jobs. Set the supervisor's termination grace above
`SHUTDOWN_TIMEOUT_MS` (for example 190 seconds for the default 180-second deadline).

The API stops accepting new requests, closes idle connections and sends
`Connection: close` on draining responses, while allowing active responses to
complete. It attempts owned database/Redis/queue cleanup even when another close
fails. The worker stops reconciliation, drains the BullMQ worker, waits for
in-flight reconciliation and failure-status writes, then closes queue/database
resources. Cleanup errors do not skip later steps. Shutdown is idempotent and
exits nonzero if the configured hard deadline is reached. In-flight external
requests are not cancelled; a forced exit can cause retry/reconciliation, including
repeated model requests and charges. There is no exactly-once provider billing.

Worker readiness is announced with `Source-collection worker ready`; it does not
have an HTTP health listener. Monitor process restarts, the age of queued/active
investigations, failed jobs, missing model-run completion and reconciliation
errors. The startup check proves dependency access at startup, not perpetual
worker availability.

## HTTP health and proxy settings

- `GET /health` is process liveness only. It remains 200 during dependency outages.
- `GET /ready` is the load-balancer readiness check. It returns 503 for database,
  configured Redis/queue, or enabled research-registry problems. Responses are not
  cacheable and contain no connection strings or raw failure messages.
- Readiness includes `background_jobs`, `media_storage` and `research` configuration
  states. Cloudinary/Gemini/UltraSearch connectivity is checked by the operator
  preflight, not on every load-balancer probe. `configured` is not a successful
  external round-trip claim. Development can serve the API without Redis/media;
  production always requires Redis, while media remains explicitly optional.

Terminate HTTPS at a trusted reverse proxy and restrict direct access to the
application listener. Match proxy body limits to `MEDIA_MAX_BYTES` plus multipart
overhead, and proxy timeouts to expected upload/request durations. Set
`TRUST_PROXY` only to the actual connecting proxy addresses/subnets so forwarded
client IPs cannot bypass rate limits. A broad trusted subnet trusts every host in
that subnet. The default trusts no forwarded addresses.

Application rate limiting is still per API process. For multiple replicas, apply
centralized limits at the edge. The API has no configured browser CORS policy or
cookie login; adding a frontend requires an explicit origin/authentication design.
Do not cache private investigation, evidence, auth or share responses.

Normal logs omit request/response bodies, redact auth/cookie headers and strip
query strings from request URL logs. Startup/shutdown diagnostics exclude raw
provider/driver errors. Configure proxy/APM logs similarly: do not capture
passwords, API keys, share tokens, private documents or signed delivery URLs.

## Live integration preflight

```powershell
npm.cmd run integrations:check
npm.cmd run integrations:check -- --require-all
```

The report prints fixed service names/statuses, never credentials, service URLs,
provider result bodies, registered prompt text or raw errors. Its default mode
exits 1 for failed configured checks; missing optional services are reported
`unconfigured` and a disabled registry `disabled`. `fully_configured` is false
unless every check passes. `--require-all` also exits 1 for any missing/disabled
check. The command has an overall 180-second bound.

| Check | Actual operation |
| --- | --- |
| Database | Schema-column readiness queries; no application records changed |
| Redis | Shared revocation PING and BullMQ queue-count access; initializes queue metadata if needed, but submits no jobs or revocations |
| Cloudinary | Authenticated `GET /ping`; no uploads, deletions or delivery URLs |
| UltraSearch | One fixed `example.com` search, `limit=1`, `ai_mode=none`, `content=false`; no user records or document content sent |
| Gemini | `models.list` metadata; when research is enabled, `models.get` for registered routes and generation-method checks; no inference |
| Registry | Current enabled routes, tool access and expected secret references |
| SMTP | TLS connection/authentication verification; no message is sent |
| Google | Public OIDC discovery metadata; does not validate a particular client ID or exercise sign-in |

These are connectivity/configuration checks, not complete end-to-end acceptance.
Before opening the full feature set in staging, use a dedicated test user to
upload a synthetic PDF, confirm another user cannot deliver it, run a small
investigation and inspect source/finding/run records. Confirm cancellation/retry,
private evidence delivery and share expiration/revocation. Use staging provider
accounts/budgets and remove fixture media after references are no longer needed.
Do not use customer contracts or identities as test fixtures. Gemini inference
can incur charges; no content-generation call is made by this preflight.

External endpoint references: [Cloudinary ping](https://cloudinary.com/documentation/admin_api#ping),
[Gemini model metadata](https://ai.google.dev/api/models), and
[UltraSearch API](https://github.com/Ramcharan747/UltraSearch).

The database smoke commands (`db:smoke`, `research:smoke`, `trust:smoke`,
`sharing:smoke`) retain their earlier scopes. Scratch-database checks require
CREATEDB and remove only their generated databases. Run them on the release/test
host; do not grant CREATEDB to the production API role merely to run a smoke test.
