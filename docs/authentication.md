# Email OTP signup and Google login

Signup now requires email verification. This is an intentional API contract
change: `POST /v1/auth/register` returns **202 and a challenge**, not an account or
JWT. Existing password login/logout and backend RBAC remain available.

## Email and password signup

1. `POST /v1/auth/register` with `display_name`, `email`, `password` (12–128
   characters). The API hashes the password, stores a pending challenge in Redis
   and sends a six-digit email code. It returns `{challenge_id, expires_in: 600,
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

Existing emails receive the same 202 challenge response without a new email or
identity being created. Cooldowns/quotas apply to both existing and new addresses.
This avoids an explicit account-existence response at the request step, although
SMTP latency is not a constant-time anonymity guarantee. Wrong, exhausted,
expired or already-consumed codes return `400 invalid_otp`.

Pending Redis records contain a password **hash**, never the password, and a
keyed HMAC of the code bound to email/purpose/challenge ID. Email keys are also
HMAC-derived. Redis Lua scripts apply limits and consume challenges atomically.
No raw code is returned, persisted in PostgreSQL or logged. Redis must be treated
as a protected data store because pending records contain email/profile data and
password hashes. Expired records disappear automatically. JWT-secret rotation
invalidates outstanding OTP/nonces as well as old JWTs.

A delivery failure invalidates that challenge but retains anti-abuse limits. A
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

The existing `users.email_verified_at` and `user_auth_accounts` columns/constraints
support this feature. No PostgreSQL schema or baseline migration was changed.
Ephemeral OTP/nonces use Redis, not fabricated SQL tables or provider subjects.

Tests use explicit mail/challenge/Google doubles, never a production bypass.
`npm.cmd run auth:smoke` creates/removes a scratch PostgreSQL database and tests
OTP account creation, concurrent consumption and password login with a mail sink
and memory challenge double. `npm.cmd run auth:smoke -- --redis` uses configured
real Redis Lua scripts; its synthetic HMAC-keyed cooldown/quota records expire
within one hour. Neither command sends email or verifies a live Google token.

Implementation references: [Google server-side ID-token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
and [Nodemailer SMTP transport](https://nodemailer.com/smtp).
