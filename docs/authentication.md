# Email OTP signup and Google login

The approved [platform extension](platform-extension.md) adds registered sessions,
logout everywhere and authenticator 2FA/recovery codes. When enabled, enrolled
users receive `mfa_required` from password/Google login and must complete
`POST /v1/auth/mfa/verify` before receiving an access token. Session persistence
remains 15 minutes, no refresh token, in-memory browser storage.

Signup now requires email verification. This is an intentional API contract
change: `POST /v1/auth/register` returns **202 and a challenge**, not an account or
JWT. Existing password login/logout and backend RBAC remain available.

## Email and password signup

1. `POST /v1/auth/register` with `display_name`, `email`, `password` (12–128
   characters). The API hashes the password, stores a pending challenge in Redis
   and queues a six-digit email code. It returns `{challenge_id, expires_in: 600,
   message}`. No PostgreSQL user or identity exists yet.
2. `POST /v1/auth/register/verify` with `email`, `challenge_id`, `code` (a six-digit
   **string**, including leading zeros). On success the API atomically creates
   `users` with `email_verified_at`, the password identity in `user_auth_accounts`,
   and the existing trigger's default role. It returns 201 and the normal
   15-minute bearer JWT response.
3. Later logins still use `POST /v1/auth/login` with email/password. Logout remains
   `POST /v1/auth/logout`. `GET /v1/auth/me` includes `email_verified` and the stored
   verification timestamp.

Codes expire after ten minutes, allow at most five attempts, and are single-use.
Requesting signup again after a 60-second cooldown replaces the old challenge;
use the newly returned challenge ID/code. Each normalized email has a limit of
five sends/requests in a one-hour window, shared across API instances. Per-IP
limits also apply. Email case is normalized; provider-specific aliases are not.

An unconfirmed signup does not register or reserve the email. It can restart
signup after the cooldown, including after the previous code expires. Only
successful OTP verification creates the account and makes later signup requests
return `account_exists`.

As of 22 October 2026, existing emails (case-insensitive) return
`409 account_exists` with a sign-in message. No challenge is created and no email
is queued. This intentionally makes account existence observable instead of
showing an OTP screen where no message will arrive. Pending new-account signup
still uses the existing cooldown, per-email quotas and per-IP limits. Wrong,
exhausted, expired or already-consumed codes return `400 invalid_otp`.

Pending Redis records contain a password **hash**, never the password, and a
keyed HMAC of the code bound to email/purpose/challenge ID. Email keys are also
HMAC-derived. Redis Lua scripts apply limits and consume challenges atomically.
No raw code is returned, persisted in PostgreSQL or logged. Redis must be treated
as a protected data store because pending records contain email/profile data and
password hashes. Expired records disappear automatically. JWT-secret rotation
invalidates outstanding OTP/nonces as well as old JWTs.

A queue submission failure invalidates that challenge but retains anti-abuse limits. A
successful code check consumes the challenge before the database transaction.
If database creation fails, no partial account remains; request a fresh code
after the cooldown. This deliberately does not promise cross-store exactly-once
delivery or automatic replay after a database outage.

Existing accounts are not retroactively locked out by their previously null
verification timestamp. To verify an existing email while signed in:

- `POST /v1/auth/email/request` with the normal bearer JWT; sends to the account's
  current email.
- `POST /v1/auth/email/verify` with the JWT and `{email, challenge_id, code}`.

Signup and existing-account verification codes cannot substitute for each other.
Password reset, refresh tokens and passwordless OTP login are outside this change.

## Google Identity Services

Use your Google **Web OAuth client ID** in `GOOGLE_CLIENT_ID`. This implementation
accepts Google ID tokens from a future client callback; it does not implement an
OAuth authorization-code redirect or require `GOOGLE_CLIENT_SECRET`.

1. `POST /v1/auth/google/challenge` with `{"action":"login"}` (or `{}`) returns a
   random `nonce` valid for five minutes.
2. Supply that exact nonce when initializing Google Identity Services on the
   client. The signed Google ID token must contain it.
3. `POST /v1/auth/google` with `{"id_token":"<Google ID token>"}`. The backend
   verifies the token using Google's official library and the configured audience,
   validates verified-email/issuer/expiry/nonce claims, consumes the nonce once,
   and returns the normal PadiCheck JWT.

Google tokens are identified by their stable `sub` in
`user_auth_accounts.provider_subject` with `provider='google'`. A changed email
claim does not remap an identity or overwrite the local account's email. Active
account checks still apply; Google sign-in grants no elevated roles. Raw Google
tokens and Google access/refresh tokens are not stored.

New Google-only accounts are created with verified email when Google is
authoritative for it (Gmail or a verified Workspace domain). Third-party email
accounts must first complete normal OTP signup and then explicitly link Google.
An existing password account is **never automatically merged by matching email**.
It returns `409 account_link_required` and needs authenticated linking:

1. Sign in to the existing account and verify its local email if needed.
2. `POST /v1/auth/google/challenge` with `{"action":"link"}` and the PadiCheck JWT.
3. Obtain a Google ID token using the returned nonce.
4. `POST /v1/auth/google/link` with `{id_token}` and that same account's JWT.

The Google email must match the account's verified email, and the identity must
not belong to someone else. Link nonces are bound to the authenticated user and
cannot be used for public login or another user. Linking writes a security audit
record in the same transaction. Nonce/token replay fails. If a request consumes a
nonce but the account transaction fails, obtain a new challenge/token to retry.

Endpoints accept JSON bodies, not the Google automatic form-post/redirect flow.
The frontend must hold its own nonce from the initiated login/link flow and submit
its callback token over HTTPS; it must not accept arbitrary tokens from URL/query
parameters. No session cookies or browser CORS policy are introduced here.

## Configuration and readiness

Set these values privately in `.env` or the deployment's secret store:

```dotenv
REDIS_URL=<protected Redis connection>
SMTP_HOST=<mail server>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=<verified sender email>
SMTP_USER=<SMTP username>
SMTP_PASSWORD=<SMTP password or app password>
GOOGLE_CLIENT_ID=<web client ID ending in .apps.googleusercontent.com>
```

For implicit TLS on port 465 use `SMTP_SECURE=true`. Port 587 requires STARTTLS;
TLS certificate verification stays enabled. The sender must be a plain email
address. Auth is optional for a trusted relay, but username/password must be
configured together. SMTP timeouts are bounded and protocol/body logging is off.
If SMTP is unconfigured, leave **all** SMTP example variables blank.

OTP signup requires SMTP plus Redis; Google requires client ID plus Redis. Missing
services return a sanitized 503 rather than logging codes, bypassing verification
or silently using local memory. `/ready` exposes `email_signup` and `google_signin`
configuration states and checks the challenge store when used. The preflight now
includes SMTP connection/auth verification (without sending email) and Google's
public OIDC metadata (which cannot prove a particular client ID's configuration).
Actual signup/mailbox delivery and Google tokens still need live acceptance.

## Background OTP delivery

If email delivery is slow, run `npm run email:status`. This read-only check shows
connected email workers, paused state and queue counts without exposing message
data. No connected worker means jobs wait even while the HTTP API reports ready.
Start `npm run email:worker:dev` in another terminal and keep it running alongside
the API. In production supervise `npm run email:worker:start` with automatic restart.
The status command exits nonzero for missing SMTP configuration, no connected
worker, a paused queue or failed Redis access. A connected worker is not an inbox
delivery guarantee.

### Clearing stale queued emails

Use expiry-aware cleanup instead of clearing Redis or draining the entire queue:

```powershell
npm run email:status
npm run email:prune
npm run email:prune -- --apply
```

`email:prune` previews changes by default. `--apply` removes only waiting,
delayed or failed OTP jobs whose code has expired, has less than 30 seconds left,
or no longer matches the current Redis challenge (consumed or replaced by a
resend). Valid jobs and active sends are preserved. This never deletes accounts,
challenge records, resend cooldowns or rate-limit counters, and never sends email.
Unreadable encrypted jobs are preserved and reported; check the shared secret
before doing any further maintenance. Output includes counts only.

Each invocation inspects at most 500 jobs; `scan_limited` indicates more remain
outside that batch. The running worker automatically checks every job at send
time and removes skipped/completed jobs; routine expiry does not require a cron
cleanup job. Pruning is an operator recovery tool, not a substitute for a running
worker. SMTP failures retain the existing three-attempt retry policy. Supervise
the worker with automatic restart and monitor worker count, queue wait and
exhausted attempts. Never use `FLUSHDB`, `FLUSHALL`, queue obliteration or an
unfiltered drain to fix slow email: those can destroy valid work or auth state.

Worker logs separate `queue_wait_ms` (time since enqueue, including retry delays)
from `elapsed_ms` (processing including SMTP). Long queue wait suggests a stopped,
backlogged or retrying worker. Long processing suggests SMTP/network latency;
additional delay after a successful send is with the mail provider/inbox. Codes
older than ten minutes are skipped; request a fresh code after restoring workers.

Run `npm.cmd run email:worker:dev` alongside the API during development. After
building, deploy a separate process with `npm.cmd run email:worker:start`.
The API and email worker must share `REDIS_URL` and `JWT_SECRET`. The worker
verifies SMTP and Redis on startup, uses two pooled SMTP connections, and drains
active sends before shutting down. This worker is separate from source collection.

The API now returns 202 after queue acceptance rather than waiting for SMTP.
202 does **not** guarantee inbox delivery. The existing response shape is unchanged;
its generic message now says the email is queued. SMTP failures occur in the worker;
queue submission failures retain the existing `503 email_delivery_failed` code.
The API readiness check checks the email queue, not worker liveness or SMTP delivery.
Run/monitor the worker separately and alert on exhausted delivery attempts.

The BullMQ queue `padicheck-otp-email-v1` retries up to three times with exponential
backoff starting at five seconds. Each attempt checks the current Redis challenge
and its TTL: replaced, consumed, expired, or less-than-30-seconds-remaining codes
are skipped. Expiry is still ten minutes from the request, not from delivery.
After an exhausted send failure the challenge expires normally; the user can
request a fresh code after the existing cooldown. In-flight SMTP delivery cannot
be recalled, and ambiguous SMTP acknowledgments/restarted workers can cause
duplicate messages containing the same code. OTP consumption remains single-use.

Job payloads (recipient/code/context) use AES-256-GCM with a separate key derived
from `JWT_SECRET`; raw codes do not appear in Redis job metadata or logs. Completed
and terminal failed jobs are removed. Waiting jobs remain encrypted in Redis until
processed, including during worker downtime; use authenticated Redis and a durable
no-eviction deployment. Secret rotation makes outstanding jobs unreadable, so users
must request fresh codes. No PostgreSQL schema changes are needed.

The HTML email uses inline styles, selectable code text, a plain-text alternative,
expiry guidance and no remote images/tracking. Preview the dummy-code rendering in
[otp-email-preview.html](otp-email-preview.html). SMTP pooling reduces repeated
connection handshakes, but provider/inbox latency remains outside the API's control.

Implementation references: [Nodemailer pooling](https://nodemailer.com/smtp/pooled)
and [BullMQ retries](https://docs.bullmq.io/guide/retrying-failing-jobs).

`npm.cmd run email:smoke` uses a unique scratch Redis queue and an explicit mail
sink to check real BullMQ enqueueing without a worker, retries, stale-code skipping
and cleanup. It sends no real emails. Per-email synthetic cooldown/quota keys expire
within an hour. It never changes the production email queue.

The existing `users.email_verified_at` and `user_auth_accounts` columns/constraints
support this feature. No PostgreSQL schema or baseline migration was changed.
Ephemeral OTP/nonces use Redis, not fabricated SQL tables or provider subjects.

For a real Google account acceptance test, stop any server using port 3000, set
the Google web client's Authorized JavaScript origin to `http://localhost:3000`,
and run `npm.cmd run google:test`. Open `http://localhost:3000/__google-test/`
and click the Google button. This development-only harness uses the real database,
Redis and Google verifier. It may create an account, verifies protected access and
single-use nonce rejection, then logs out and checks session revocation. Tokens
stay out of logs and the PadiCheck access token stays on the server. An existing
password account requires explicit linking through the normal authenticated API.
The harness binds loopback, requires its local origin for test requests, and closes
after 15 minutes. Its routes are never registered by the production server.

For live email signup acceptance, configure SMTP and Redis, start the email worker, then run
`npm.cmd run email:test` and open `http://localhost:3000/__email-test/`. Enter an
unused email address you own and a new password on the local page, then enter the
code delivered to that mailbox. Submitting sends real mail; verification creates
a persistent account. The harness checks no account/password login exists before
verification, verifies database persistence and a hashed password, rejects OTP
reuse, tests password login, and revokes both test sessions. Passwords/codes never
go in chat or logs. This loopback-only development harness expires after 20
minutes; pending codes expire after ten. It is absent from the normal server.

Tests use explicit mail/challenge/Google doubles, never a production bypass.
`npm.cmd run auth:smoke` creates/removes a scratch PostgreSQL database and tests
OTP account creation, concurrent consumption and password login with a mail sink
and memory challenge double. `npm.cmd run auth:smoke -- --redis` uses configured
real Redis Lua scripts; its synthetic HMAC-keyed cooldown/quota records expire
within one hour. Neither command sends email or verifies a live Google token.

Implementation references: [Google server-side ID-token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
and [Nodemailer SMTP transport](https://nodemailer.com/smtp).
