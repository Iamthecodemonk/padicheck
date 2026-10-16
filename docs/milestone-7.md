# Email OTP, Google identity and shared logging

Implemented the requested password signup plus email OTP verification, Google
ID-token login/explicit linking, and a shared project logger. This is backend-only.

The existing `users.email_verified_at`, `user_auth_accounts` identity constraints,
default-role trigger and `admin_audit_logs` support these features. No schema,
baseline or SQL migration was changed. OTP/nonces are short-lived Redis state;
production has no memory or console-code fallback.

The registration contract intentionally changed: `/v1/auth/register` starts a
challenge (202); `/v1/auth/register/verify` consumes the emailed code and creates
the verified account/JWT (201). Existing password login remains supported.
Google identities use a verified Google token's stable subject and a single-use
nonce; matching email never silently merges accounts. See
[authentication.md](authentication.md) for payloads, expiry/attempt/resend limits,
legacy email verification, Google linking and required service configuration.

Pino is now a direct dependency. `src/logger.ts` provides the shared logger used
by Fastify, worker, database and scripts. Credentials, OTPs, auth tokens, request
bodies and URL queries are excluded/redacted from normal structured logs. Raw
provider error messages/stacks are omitted. CLI report JSON remains stdout; logs
use stderr. No runtime console calls remain in `src/` or `scripts/`. See
[logging.md](logging.md) for usage and redaction limits.

Files added: auth challenge/SMTP/Google adapters; auth identity types, email and
Google routes, session helper; shared logger; identity/logger tests and explicit
test-only auth doubles; PostgreSQL `auth:smoke`; authentication/logging docs.
Existing auth/config/app/readiness/authorization, release preflight, API fixtures,
earlier smoke commands, operational log calls, README and `.env.example` were
updated for the new contract. The supplied SQL files and local `.env` remain
unchanged. Dependencies added: Nodemailer, Google Auth Library, Pino and SMTP
TypeScript definitions. npm reported zero vulnerabilities.

Initial
parallel targeted tests exceeded local memory limits; sequential execution was
used thereafter. One full-suite run timed out in the existing 15-second PDF
worker; its focused rerun passed in about two seconds without parser changes.
The final isolated suite result is recorded below.

Final validation:

- `npm.cmd test`: **117 passed**, zero failures on the standalone full rerun.
- `npm.cmd run typecheck` and `npm.cmd run build`: passed.
- `npm.cmd run db:verify`: passed; no schema drift.
- `npm.cmd run auth:smoke`: passed with real PostgreSQL and explicit challenge/mail
  doubles; generated scratch database removed.
- `npm.cmd run db:smoke`: passed after updating its app configuration to explicit
  test mode for the mail/challenge fixture; temporary writes rolled back.
- `npm.cmd run integrations:check`: database passed; Redis, SMTP, Google and other
  external providers reported unconfigured; research remained disabled. No live
  mail/Google check was represented as a successful authentication test.
- `git diff --check`: passed. Searching `src/` and `scripts/` found no remaining
  `console.log/info/warn/error/debug` calls.

The live PostgreSQL auth smoke passed for delayed account creation, concurrent
one-time OTP consumption, verified password login and the default role. It used
explicit challenge/mail doubles and removed its generated scratch database. It
did not send mail or use Google. Real Redis Lua, SMTP delivery and Google token
round trips remain unverified until Redis/SMTP/Google settings are supplied.
`auth:smoke -- --redis` is available for the Redis check; it never sends email.

No Google console application, SMTP account, external messages or public
deployment was created. Configure the environment privately as documented;
credentials should stay out of chat.
