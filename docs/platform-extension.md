# Platform foundation extension

Approved on 21 October 2026: sessions, authenticator 2FA/recovery codes, bookmarks,
in-app notifications, business teams and scoped API keys. Migration
`004_platform_foundation.sql` adds ten tables and two triggers; the supplied
baseline SQL remains unchanged. Cloudinary stores files; SQL stores metadata.

## Configuration and rollout

```powershell
npm run db:platform-migrate
npm run db:verify
npm run typecheck
npm run build
```

The migration takes the existing advisory lock and refuses a partial installation.
It requires the baseline; billing 003 is independent. The verifier recognizes
both approved extensions and checks columns, constraints, indexes and triggers.

```dotenv
PLATFORM_EXTENSIONS_ENABLED=true
ACCOUNT_ENCRYPTION_KEY=<32 random bytes encoded as 64 hexadecimal characters>
```

Keep the encryption key private, stable across replicas/deployments, and backed
up securely. Losing it prevents authenticator verification. Do not regenerate it
or rotate it without planning factor re-encryption/recovery. It is separate from
`JWT_SECRET`; neither key belongs in frontend variables, logs or Cloudinary.
With the feature flag false, legacy login behavior is retained and new APIs return
`503 platform_unavailable`. Apply the migration/key before enabling the flag.

Enabling registered sessions requires current users to sign in again: old JWTs
have no session record. Accounts remain. Session policy stays 15-minute bearer
tokens, browser memory storage, no refresh token, sign in again after reload.

## Sessions

| Endpoint | Contract |
| --- | --- |
| `GET /v1/auth/sessions` | Own active `{sessions:[{session_id,authenticated_at,expires_at,is_current}]}`, newest first, maximum 100. |
| `DELETE /v1/auth/sessions/{id}` | Own session, 204; foreign/unknown ID is 404. Revocation takes effect on the next request. |
| `POST /v1/auth/logout-all` | 204; revokes all sessions and pending MFA login challenges, including current session. |
| Existing `POST /v1/auth/logout` | Redis token revocation plus persistent current-session revocation. |

JWT identifiers are hashed; raw tokens are not stored. Every protected request
checks session expiry/revocation, active account and live RBAC. Login issuance and
account security changes serialize on the user row. API keys are separate
credentials: logout-all does not revoke them. Expiration excludes old sessions
from access/listing but is not a physical database retention/deletion schedule.

## Authenticator 2FA and recovery

Uses [OTPAuth](https://github.com/hectorm/otpauth): TOTP, six digits, SHA-1,
30-second steps and one-step clock tolerance. Secrets use AES-256-GCM with
account-bound authenticated data. Email signup OTP is not a second factor.

1. Sign in with a verified account. Security changes require login within five minutes.
2. `POST /v1/auth/mfa/setup` returns `{secret,otpauth_uri,expires_in:600}`.
   Add to an authenticator or render its QR **locally**. Never log/store the secret
   in browser storage, put it in query strings, or upload a provisioning QR to
   Cloudinary. Repeating setup replaces pending enrollment, never an enabled factor.
3. `POST /v1/auth/mfa/confirm` with `{"code":"123456"}` returns
   `{enabled:true,recovery_codes:[...],sign_in_required:true}`. Ten random
   24-character hex recovery codes are returned once; only SHA-256 hashes are kept.
   Enabling revokes all sessions/challenges. Save recovery codes privately.
4. Password **and Google** login for an enrolled user return HTTP 200
   `{mfa_required:true,challenge_token,expires_in:300}` with no access token.
5. `POST /v1/auth/mfa/verify`, public, accepts
   `{"challenge_token":"...","code":"123456"}` or a 24-character recovery code.
   Success returns the normal `{user,access_token,token_type:"Bearer",expires_in:900}`.
   Only then store the token in memory and call `/v1/auth/me`.

Challenge tokens cannot authorize ordinary requests. They are single-use, expire
in five minutes and allow five attempts; maximum five outstanding per account.
Five failed factor attempts lock verification for five minutes. Failed attempts
commit even when verification returns an error. Valid TOTP time steps cannot be
reused, including a code just used to enroll; wait for the next code or use recovery.

| Endpoint | Result / proof |
| --- | --- |
| `GET /v1/auth/mfa` | `{enabled,recovery_codes_remaining}`; no secrets/codes. |
| `POST /v1/auth/mfa/recovery-codes` | Recent login + `{code}`; replaces all recovery codes, returns ten new codes once, revokes all sessions/challenges. |
| `POST /v1/auth/mfa/disable` | Recent login + `{code}`; removes factor/recovery hashes, revokes sessions/challenges; `{enabled:false,sign_in_required:true}`. |

Secret-free audit events record enrollment/disable/regeneration. Errors include
`recent_login_required` / `verified_email_required` (403), `mfa_already_enabled`
(409), `mfa_rate_limited` (429), `invalid_mfa_code` (400 for factor management,
401 for login), `invalid_mfa_challenge` (401). There is no support bypass, SMS
factor, password-reset implementation or automatic session renewal in this release.

## Bookmarks and notifications

| Endpoint | Contract |
| --- | --- |
| `POST /v1/investigations/{id}/bookmark` | Owned investigation + live read permission, idempotent `{bookmarked:true}`. |
| `DELETE /v1/investigations/{id}/bookmark` | Owned investigation + read permission, 204. |
| `GET /v1/me/bookmarks` | `{bookmarks:[{investigation_id,bookmarked_at,title,status,investigation_type}]}`. |
| `GET /v1/me/notifications` | `{notifications:[{notification_id,notification_type,related_id,read_at,created_at}]}`, optional `unread_only=true`. |
| `POST /v1/me/notifications/{id}/read` | Own notification; idempotent `{notification:{notification_id,read_at}}`. |
| `GET /v1/me/notification-preferences` | `{preferences:[{notification_type,enabled}]}`, enabled by default. |
| `PATCH /v1/me/notification-preferences` | `{notification_type,enabled}` -> `{preference:{notification_type,enabled}}`. |

These require normal user sessions. Lists use `limit` default 20/max 100 and
`offset` default 0/max 10000. Foreign/unknown private records return 404.
Supported types: `investigation.completed`, `investigation.failed`, `business.invitation`.
Terminal investigation notifications share the status-change transaction through
a trigger, respect preferences and deduplicate per investigation/status. Repeat
failures after retry do not create another identical event. Payloads contain IDs,
not private evidence; related-resource access still requires authorization.
Preferences affect future notifications, not existing records. Delivery is in-app;
email/push notifications and configurable data-retention jobs are not included.

## Business teams

`business_profiles.claimed_by_user_id` remains owner authority. Only the owner
manages teams. Members have business-scoped `manager`, `editor` or `viewer` roles;
manager/editor may edit category/description. Team membership grants no staff
RBAC, verification, ownership transfer, billing or private evidence-review rights.

| Endpoint | Contract |
| --- | --- |
| `GET /v1/businesses/{id}/team` | Owner only; `{owner_user_id,members:[{users_id,display_name,member_role,joined_at}],invitations:[...]}`; invitations newest 100. |
| `POST /v1/businesses/{id}/invitations` | Owner `{email,member_role}` -> 201 `{invitation:{invitation_id,email,member_role,expires_at},delivery:"in_app"}`. |
| `DELETE /v1/businesses/{id}/invitations/{invitation_id}` | Owner, 204. Revoke accepted membership separately. |
| `GET /v1/me/business-invitations` | Verified matching email's active `{invitations:[{invitation_id,business_profile_id,member_role,expires_at}]}`, standard limit/offset. |
| `POST /v1/me/business-invitations/{id}/accept` | Verified matching recipient, `{accepted:true}`; repeated acceptance idempotent while valid. |
| `PATCH /v1/businesses/{id}/team/{users_id}` | Owner `{member_role}` -> `{updated:true}`. |
| `DELETE /v1/businesses/{id}/team/{users_id}` | Owner, 204. Ownership is not a deletable membership row. |
| `PATCH /v1/businesses/{id}/profile` | Owner/editor/manager: `business_category` and/or nullable `profile_description` -> `{business:{business_profile_id,profile_description,business_category}}`. |

All require verified user-session auth. Ownership/publication/verification fields
cannot be changed through profile editing. Invitations expire in seven days;
new invites replace old pending invitations to the same email; maximum 100
outstanding per business. Responses do not reveal whether the recipient has an
account. Existing recipients may receive an in-app notification; new users can
list invitations after verifying the matching email. No SMTP invite email or paid
seat entitlement is implied. Owner changes atomically clear memberships and
revoke invitations. Mutations are audited; unrelated business access returns 404.

## Scoped API keys

| Endpoint | Contract |
| --- | --- |
| `GET /v1/me/api-keys` | Own `{api_keys:[...]}`, newest 100; metadata only. |
| `POST /v1/me/api-keys` | Recent verified login, `{name,scopes,expires_in_days?}` -> 201 `{api_key,secret}`. |
| `POST /v1/me/api-keys/{id}/rotate` | Recent verified login, 201 replacement `{api_key,secret}`; old key revoked atomically; original expiry/scopes retained. |
| `DELETE /v1/me/api-keys/{id}` | Own key, immediate revocation, 204. |

Metadata: `api_key_id,name,key_prefix,scopes,created_at,expires_at,revoked_at,last_used_at`.
Random `pc_key_` secrets are returned once and stored only as hashes. Default
expiry 30 days, allowed 1–90 days, maximum 20 active keys. These are technical
security limits, not commercial plans. Management endpoints require user sessions.

Server-to-server callers send `X-API-Key` **instead of** a Bearer token:

- `investigations:read`: existing GET investigation list/detail/findings/sources/
  model-runs, own data only. `scope=all` is forbidden even for a superadmin's key.
- `investigations:create`: existing POST `/v1/investigations`; live account
  permissions, validation and configured billing allowances still apply.

No key access to auth, teams, notifications/bookmarks, uploads, sharing, billing or
admin. Keys never exceed current owner permissions; suspension/role removal take
effect on subsequent calls. A shared database minute counter allows 60 requests
per key per UTC minute across replicas, plus existing operation/IP limits.
Never bundle API keys into browser code. Errors: `invalid_api_key` (401),
`api_key_scope_forbidden` / `scope_forbidden` (403), `ambiguous_credentials` (400),
`api_key_rate_limited` (429), `api_key_limit` (409). Key mutations are audited.

This does not implement the whole developer-platform backlog: customer webhooks,
request-log portal, isolated sandbox, `/v1/verify/*` or numeric Trust Scores are
not introduced. Existing investigation contracts are reused.

## Cloudinary and acceptance

Reused routes: multipart `POST /v1/media`, metadata `GET /v1/media/{media_id}`,
`POST /v1/media/{media_id}/delivery` for a 300-second signed URL, and DELETE for
unreferenced owned media. Backend-only `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` configure authenticated assets.
Image upload does not imply image/vision investigation analysis.

Live acceptance passed: credential authentication; upload 201; signed download
200; public unsigned access rejected 401; backend deletion 204. The tiny test
asset and isolated PostgreSQL database were removed. `npm run media:smoke`
repeats this real-provider test without email or credential/signed-URL logging.
If asset cleanup fails it retains the scratch database for reconciliation.

Validation for this milestone: migration 004 applied to local PostgreSQL; schema
drift verification passed; all 145 backend tests passed; TypeScript/build passed;
OpenAPI export/check passed with 115 operations. The private encryption key was
generated in ignored local `.env`, not in the repository. Real authenticator-app
browser acceptance and frontend wiring are separate from automated API tests.

`tests/platform.test.ts` tests all six domains with the supplied baseline plus
extension and explicit mail/Google doubles, including Google MFA, challenge and
recovery replay protection, ownership, owner transfers, scopes and rotation.

Frontend files were not changed. Add `mfa_required` handling before exposing 2FA
enrollment. This document supersedes the audit's missing entries for these six
foundation features. Scoring/refund/retention/marketplace decisions and independent
research-provider configuration remain outside this milestone.
