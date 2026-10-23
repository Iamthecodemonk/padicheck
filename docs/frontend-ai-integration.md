# Frontend AI implementation brief

Current contract: 22 October 2026. Backend has **115 OpenAPI operations**.
This is the starting document for completing the existing frontend integration.
Keep the current React/Vite UI and replace demo state with supported API behavior.

## Copy this prompt to your frontend AI

```text
Complete integration of the EXISTING PadiCheck frontend with its backend.

Frontend workspace: C:\Users\HP\Desktop\projects\padicheckui
Backend reference workspace: C:\Users\HP\Desktop\projects\padicheck

Read these files from the BACKEND workspace first:
  docs/frontend-ai-integration.md
  docs/frontend-integration.md
  docs/platform-extension.md
  docs/api-reference.md
  docs/openapi.json
  docs/payments.md

Work in padicheckui, preserving its React, TypeScript, Vite, routing and design.
Reuse src/api/client.ts and existing auth/media/investigation clients; inspect
current code before replacing anything. Treat the backend reference files as
read-only. Do not modify the schema/backend to make a screen appear supported.
Never read/copy backend .env secrets into frontend code or public variables.

Complete the supported flows in the implementation order and file map in this
brief. First fix the auth response union: password AND Google login may return
mfa_required with a challenge_token, not an access_token. Finish MFA before /me.
Then add sessions, security controls, Saved, notifications, business teams and
API-key management. Finish existing media/investigation/directory/moderation/share
flows. Replace simulated billing and admin identity with authoritative APIs.

Use the existing Vite proxy with relative API paths. Keep user access tokens and
MFA challenges in memory. No refresh endpoint exists. Never persist passwords,
OTP codes, Google credentials, MFA secrets/recovery codes or API-key secrets.
Render MFA QR locally; do not upload it to Cloudinary. Show generated recovery
codes and API-key secrets once in intentional private UI, then discard them.

Remove demo success behavior from production flows. Do not treat a checkout
redirect/timer/local credit count as payment. Respect service-disabled states.
Do not fabricate Trust Scores, certificates, invoices, team emails, analytics,
developer sandbox responses, private-data access or authoritative verification.
Keep unsupported controls visibly unavailable with an accurate explanation.

Persist public UI preferences only where appropriate; clear private user state
on logout/account switch. Do not cache auth, /v1 private data, signed downloads
or secret-bearing responses in the service worker. Check the current cache rules.

Run existing frontend tests and build, add meaningful tests for new integrations,
and perform the acceptance checklist below where providers are configured.
Distinguish client tests with mocks from real browser/provider acceptance.
If a live service or endpoint is unavailable, report the precise blocker and
continue independent supported work. Do not fake successful responses.
Finish with changed files, test commands/results, live acceptance evidence,
configuration blockers and remaining unsupported screens.
```

## Read order and source of truth

| Reference | Purpose |
| --- | --- |
| [Frontend integration guide](frontend-integration.md) | Existing auth, uploads, investigations, directory, moderation, shares and billing workflows; response record fields. |
| [Platform extension](platform-extension.md) | Every new session/MFA/bookmark/notification/team/key endpoint, payload, response, authorization, limits and errors. |
| [Generated API reference](api-reference.md) | Exact registered methods, paths, request schemas, status codes and response envelopes. |
| [OpenAPI JSON](openapi.json) | Machine-readable contract; live `/docs/json` is available when backend runs. Record schemas may allow additional properties; use the workflow guides for their fields. |
| [Payments](payments.md) | Bachs configuration, allowances, reconciliation and known limitations. |
| [Earlier audit](backend-frontend-audit.md) | Evidence of frontend demo areas. Its missing entries for the six platform features are superseded by the implementation guide. |

If live API and docs disagree, capture the method/path/status/request_id and
report the discrepancy. Do not silently invent a replacement contract.

## Development connection and services

Backend commands, in separate terminals inside `padicheck`:

```powershell
npm run dev
npm run email:worker:dev
npm run worker:dev
```

The API defaults to `http://127.0.0.1:3000`; Swagger is `/docs/`. The email worker
sends queued OTPs; the investigation worker handles collection/analysis and
deferred dispatch reconciliation. They serve no frontend. Existing schema is
already migrated locally; do not rerun the baseline or reset the database.
Use `/health` and `/ready` before acceptance. `/ready` configuration indicators
do not prove live external delivery or worker liveness.

Frontend commands inside `padicheckui`:

```powershell
npm run dev
npm run test:api
npm run build
```

Existing `vite.config.ts` proxies `/v1`, `/health`, `/ready`. Frontend environment
example (public client ID placeholder only):

```dotenv
VITE_API_BASE_URL=
API_PROXY_TARGET=http://127.0.0.1:3000
VITE_GOOGLE_CLIENT_ID=<public web client ID matching backend GOOGLE_CLIENT_ID>
```

Leave `VITE_API_BASE_URL` empty for relative same-origin requests via the Vite
proxy. Do not add `/v1` twice. The backend has no browser CORS middleware; pointing
the browser directly at another origin will not be fixed by `mode:no-cors`.
Production should use same-origin HTTPS reverse proxying, or a separately approved
restricted CORS policy. Do not invent a deployed API URL.

For ngrok browser testing, the shared frontend API client adds
`ngrok-skip-browser-warning: true` when the actual request hostname is an ngrok
domain, including relative requests from a tunneled frontend. Keep this header:
without it, ngrok can return a 200 warning response instead of JSON for `/me`
after signup verification has already created the account. Confirmed locally on
22 October 2026: the bypass restores API JSON responses. Do not retry the consumed
OTP if verification succeeded; sign in with the signup password instead.

Google Authorized JavaScript origins must contain the actual **frontend browser
origin**, including its port. If Vite serves `http://localhost:5173`, authorizing
only backend/test origin `http://localhost:3000` is insufficient. Use the origin
Vite actually reports if it selects another port. Keep the web client ID consistent
with the backend; no Google client secret belongs in the frontend.

Last local acceptance: PostgreSQL/Redis/SMTP/Google and Cloudinary passed relevant
checks; private Cloudinary upload/download/public-denial/cleanup passed. Platform
extension is enabled locally. Independent research and Bachs were disabled pending
configuration. Read current API responses rather than hardcoding this snapshot.

## Implementation order and current UI file map

Paths in this table are relative to `padicheckui`. Inspect current contents first.

| Order | Existing files / screens | Required integration |
| --- | --- | --- |
| 1 | `src/api/client.ts`, `src/api/auth.ts`, `src/contexts/UserContext.tsx` | Preserve shared fetch/error handling; add discriminated login response, pending MFA state, verify call, expiry and private-state cleanup. |
| 2 | `src/pages/auth/SignUp.tsx`, `VerifyCode.tsx`, `src/pages/consumer/SignIn.tsx`, `src/components/auth/GoogleSignIn.tsx` | Retain working OTP/password/Google flows, route both login methods through MFA when required. No duplicate signup/resend API. |
| 3 | `src/pages/consumer/Security.tsx` | Replace outdated unsupported labels for sessions/MFA with real listing, revoke/logout-all, local provisioning QR, confirmation and recovery flows. Keep password reset/change and personal-profile/deletion/export unsupported. |
| 4 | `src/api/media.ts`, `src/hooks/useCheckFlow.ts`, `src/api/investigations.ts`, `src/hooks/useInvestigation.ts`, `useInvestigationHistory.ts` | Preserve real client wiring; complete loading/errors/cancel/retry/pagination/evidence access. PDF investigation uploads only; storage upload support is broader than analysis support. |
| 5 | `src/pages/consumer/Saved.tsx`, `src/components/consumer/ResultRow.tsx`, `InvestigationRow.tsx`, result/history screens | Wire server bookmarks using investigation UUIDs; no seeded `r-*` IDs or invented result fields. |
| 6 | `src/pages/trust/Notifications.tsx`, `src/components/consumer/account/NotificationSheet.tsx`, `UserContext.tsx` | Server in-app notification lists/read state/preferences. Reconcile old preference keys with the three supported event types. |
| 7 | `src/contexts/TrustContext.tsx`, `src/utils/trustApi.ts`, directory/verification/report/dispute/share screens | Replace mock adapters and seeds only where a real resource API exists; map backend IDs/DTOs and keep AI findings, user allegations and staff decisions distinct. |
| 8 | `src/pages/business/BusinessTeam.tsx`, `BusinessProfileEdit.tsx`, `src/contexts/TrustContext.tsx` | Owner/member routes, matching-email invitations, role-aware category/description edits. Invitations are in-app; no "email sent" success toast. |
| 9 | `src/components/billing/CheckoutSheet.tsx`, `PlanPicker.tsx`, `src/pages/consumer/Billing.tsx`, `Credits.tsx`, `src/data/plans.ts`, `credits.ts` | Remove timer/card-input payment simulation and browser credit grants. Use configured offers, checkout URL, owned status, authoritative balance/subscriptions and portal. |
| 10 | `src/pages/developer/DevKeys.tsx`, `DevDocs.tsx`, `DevSandbox.tsx`, `DevWebhooks.tsx`, `DevRequests.tsx`, `src/data/developer.ts` | Implement available key management. Replace advertised examples with supported investigation contracts; disable unsupported sandbox/webhook/log/usage features. |
| 11 | `src/contexts/AdminSessionContext.tsx`, `AdminDataContext.tsx`, admin login/review/AI/billing pages | Use normal JWT/MFA login and `/me` permissions; remove seeded staff identity and local role-based elevation. Wire registered APIs only. |
| 12 | `src/utils/serviceWorker.ts`, `shareInbox.ts`, private contexts/hooks | Network-only private API/secret responses; clear account-bound state and transient share files on the appropriate lifecycle. No offline private-report feature is approved. |

Bookmarks save investigations, not arbitrary local TrustEntity objects. Notifications
link through `related_id`, not a demo slug. A business team requires a real
`business_profile_id` from a supported directory/verification/claim context.
There is no `/v1/me/businesses` discovery API: flag a missing discovery workflow
instead of using `MY_BUSINESS_ID` fixtures or guessing IDs/ownership.

## Required authentication state machine

Unenrolled login, password or Google, HTTP 200:

```json
{"user":{"users_id":"<uuid>","display_name":"Ada","email":"ada@example.com","email_verified":true},"access_token":"<JWT>","token_type":"Bearer","expires_in":900}
```

Enrolled login, HTTP 200:

```json
{"mfa_required":true,"challenge_token":"<short-lived challenge JWT>","expires_in":300}
```

Use a response union rather than calling `acceptSession` unconditionally:

```ts
type AccessSession = {
  user: { users_id: string; display_name: string; email: string; email_verified: boolean };
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
};
type MfaChallenge = { mfa_required: true; challenge_token: string; expires_in: number };
type LoginResponse = AccessSession | MfaChallenge;

// Both password and Google callbacks must share this branch.
async function handleLogin(result: LoginResponse) {
  if ('mfa_required' in result && result.mfa_required) {
    // Keep challenge + countdown in transient state. Show second-factor screen.
    // Do not setAccessToken, call /me, or enter protected routes yet.
    return;
  }
  if ('access_token' in result) await acceptSession(result);
}
```

Complete MFA with public `POST /v1/auth/mfa/verify`:

```json
{"challenge_token":"<pending challenge>","code":"012345"}
```

`code` is a six-digit authenticator string OR a 24-character hex recovery code.
Send no Authorization header for this public exchange. Its success is an
`AccessSession`; then load `/me`, store live roles/permissions, and clear pending
MFA state. Wrong MFA code must not be misreported as wrong email/password.
Stop after expiry/exhaustion and let the user start a fresh login deliberately;
do not loop first-factor login, create new challenges on each keystroke, or
automatically retry factor requests. Handle `invalid_mfa_code`,
`invalid_mfa_challenge`, `mfa_rate_limited` distinctly.

Keep token/challenge/password/OTP/Google credential out of localStorage,
sessionStorage, IndexedDB, URLs, caches and analytics. Existing `UserContext`
memory state and shared client's current-token 401 behavior are useful; preserve
them. Login response does not contain authoritative roles: `/me` does.

Signup `POST /v1/auth/register` returns 202 + challenge, not access. Keep signup
pending until `POST /v1/auth/register/verify` returns 201. Email OTP is valid ten
minutes from the request; 202 means queued, not delivered. Resend repeats signup
after 60 seconds and replaces challenge ID; preserve leading zeros.
MFA enrollment is optional and separate from email verification.
Existing email now returns `409 account_exists`, not a generic 202. Show the
sign-in message and stay on signup; no OTP is sent. After verify returns 201,
clear the consumed challenge even if the following `/me` request fails. Recover
session initialization through the issued token or password sign-in; never
resubmit the consumed OTP and mislabel its rejection as the original failure.

Session/security integration details:

- No invented device/browser/location fields: sessions expose only ID, timestamps
  and `is_current`. Revoking current session or logout-all clears private state.
- `recent_login_required` (403) means sign in again, then return to the intended
  security action; do not log out merely because an arbitrary 403 occurred.
- MFA confirm, disable and recovery regeneration revoke all sessions. Clear the
  revoked token immediately but keep newly returned recovery codes only in an
  intentional transient completion screen until the user saves/acknowledges them.
  A protected-route redirect must not silently discard the one-time codes.
- Provisioning QR should use existing `qrcode.react` locally. TOTP code used for
  confirmation cannot be reused for the following login; wait for the next code
  or use a recovery code. No external QR/image service or Cloudinary upload.

## API client modules to add

Use the existing shared `api()` helper, exact schemas from OpenAPI and typed
DTOs from the guides. Suitable frontend modules are `security.ts`, `bookmarks.ts`,
`notifications.ts`, `businessTeams.ts`, `billing.ts`, `apiKeys.ts`; these are
suggested filenames, not additional backend route prefixes.

| Domain | Supported paths |
| --- | --- |
| Sessions | GET `/v1/auth/sessions`, DELETE `/v1/auth/sessions/{id}`, POST `/v1/auth/logout-all` |
| MFA | GET `/v1/auth/mfa`; POST `/v1/auth/mfa/setup`, `/v1/auth/mfa/confirm`, `/v1/auth/mfa/verify`, `/v1/auth/mfa/disable`, `/v1/auth/mfa/recovery-codes` |
| Bookmarks | POST/DELETE `/v1/investigations/{id}/bookmark`, GET `/v1/me/bookmarks` |
| Notifications | GET `/v1/me/notifications`, POST `/v1/me/notifications/{id}/read`, GET/PATCH `/v1/me/notification-preferences` |
| Teams | GET `/v1/businesses/{id}/team`, POST `/v1/businesses/{id}/invitations`, DELETE `/v1/businesses/{id}/invitations/{invitation_id}`, PATCH/DELETE `/v1/businesses/{id}/team/{users_id}` |
| Invitations/profile | GET `/v1/me/business-invitations`, POST `/v1/me/business-invitations/{id}/accept`, PATCH `/v1/businesses/{id}/profile` |
| API-key management | GET/POST `/v1/me/api-keys`, POST `/v1/me/api-keys/{id}/rotate`, DELETE `/v1/me/api-keys/{id}` |
| Billing | GET `/v1/billing/offers`, GET `/v1/billing/me`, POST `/v1/billing/checkouts`, GET `/v1/billing/checkouts/{id}`, POST `/v1/billing/portal` |

Use Bearer user sessions for all management calls. The MFA verify exchange and
billing offers are public. Key-management UI may show/copy the owner-requested
secret once; it must not automatically use that key as browser app auth or store
it for later. Customer server-to-server API examples use `X-API-Key` only for the
supported investigation read/create scopes. Do not send both credential headers.

Lists do not all paginate the same way: investigations use opaque
`next_cursor`; findings/sources/bookmarks/notifications/invitations and many
staff lists use bounded limit/offset. Sessions/keys return at most 100 records
without a cursor; team listing has its own contract. No invented total counts,
search/filter parameters, or numbered paging for cursor APIs.

## Replacing billing and demo authority

1. Load `/v1/billing/offers` and `/v1/billing/me`. On `enabled:false`, show billing
   unavailable, hide purchase controls, and do not present zero as an enforced
   paid allowance or decrement local credits. Billing-disabled investigations
   retain current free behavior.
2. Render backend offer amounts/currencies/unit allowances, not hardcoded plans.
   Amounts are decimal currency strings, not minor units. One investigation
   currently consumes one unit when billing is enabled. Frontend check-type
   credit labels do not change server pricing. Retry of the same failed record
   does not buy another investigation.
3. POST `{offer_key,request_key:<UUID>}` once per purchase attempt; reuse the key
   on an explicit retry. Do not submit price, currency, user ID or redirect URL.
4. Save the **local** `billing_checkout_id` as non-secret return state and redirect
   to backend-provided open `checkout_url`. Remove direct card-number collection
   and simulated success from `CheckoutSheet`; payment is provider-hosted Bachs.
5. Poll owned checkout status and balance after return. Browser return parameters,
   a provider checkout ID, animation or redirect do not prove payment. With
   memory-only auth, external navigation/reload requires reauthentication;
   preserve only the non-secret local checkout UUID for resuming the status check.
6. Pending payment/reconciliation is a real state. Do not automatically create a
   second checkout on timeout or mint credits. Customer subscription management
   uses POST `{billing_subscription_id}` to `/v1/billing/portal` and its URL.
7. Purchase history, invoice/receipt downloads, direct plan-change/refund APIs and
   failed-investigation recredits are not implemented. Do not show seeded invoices
   as real transactions. Never call provider-only `/v1/webhooks/bachs` from the UI.

Staff must authenticate through the same real login/MFA flow, not client-selected
`superAdmin` or `finance` roles. Backend seeded role keys are `user`, `support`,
`moderator`, `verifier`, `admin`, `superadmin`. Use `/me` permissions and handle
403 even when a control was visible. The backend exposes no user-search,
suspension, audit-list, arbitrary credit-adjustment, CMS/support-ticket or
analytics API yet; do not fake those calls. Existing role listing/grants,
AI registry, business publication, verification/report/dispute review and billing
operations are documented. These review workflows are separate from customer reviews.

## Features that must remain unavailable

| UI concept | Current boundary |
| --- | --- |
| Forgot/reset/change password, personal profile edits, Google unlink, account export/deletion | No supported API. Business description/category editing is a separate supported feature. |
| Trust Scores/bands and change alerts | No agreed server scoring model or numerical score API. Do not compute demo scores from AI confidence or user reports. |
| Certificates/QR public verification, reviews/responses, business analytics | No certificate/review/analytics service. A staff verification decision is not an issued certificate. |
| Image/screenshot/camera/DOCX/TXT/audio/video investigation analysis | Upload storage supports selected images/audio/video/PDF; investigation attachments currently accept PDF documents. Prompt text is supported. No OCR/vision/transcription/DOCX pipeline yet. |
| Authoritative registration/domain-age/phone-owner/property-title checks | General evidence research is not authoritative verification; providers are not integrated. |
| Bulk submission, PDF report generation, server history search/filter/sort | No such contracts. Existing history searches may filter loaded pages only and must say so. |
| Notification email/push, invitation email, arbitrary notification kinds | Current notifications/invitations are in-app only; only documented event types. |
| Developer `/v1/verify/*`, `/v1/risk-score/*`, webhook subscriptions, request logs, usage/quota plans, isolated sandbox | Not implemented; key lifecycle and limited existing investigation access are implemented. |
| Jobs & Talent marketplace | Job-offer research is supported as a context; hiring/candidate marketplace is not. |
| Offline private reports / silent offline replay | Not approved/implemented. Private data remains network-only; do not make delayed duplicate submissions. |

Disable or clearly label unavailable actions; do not add success toasts or fixture
data in production paths. Unconfigured research/billing must show a real service
state. With analysis disabled, investigations may remain in source collection;
do not fake a completed report to stop a spinner.

## Acceptance checklist and delivery evidence

- Signup: real mailbox test, leading-zero code, wrong/expired code, resend/cooldown,
  pending signup with no session, duplicate email behavior; no password persistence.
- Login: normal and MFA-required password/Google branches, recovery code reuse
  rejection, challenge expiry/attempt exhaustion, link-required Google behavior.
- Security: session list/revoke/logout-all; MFA setup/confirm/disable/regeneration;
  one-time recovery display survives forced signout without persistent storage.
- Uploads: one FormData `file`, no manual multipart header, unauthorized/foreign
  access rejected, fresh POST delivery URLs, unsupported/oversized content errors.
- Investigations: creation not double-submitted, uncertain status reconciled via
  History, cursor pagination, correct polling/cancel/retry, disabled analysis and
  evidence/uncertainty fields preserved; private content not cached.
- Bookmarks/notifications: two-account isolation, pagination, empty/error states,
  idempotent bookmark/read operations, actual supported preferences and related IDs.
- Teams: owner manages membership, verified invited email accepts, editor edits,
  viewer cannot edit, unrelated account denied, expired/revoked invite handled;
  no global staff elevation or false email delivery claims.
- Sharing/moderation: completed owner shares, secret-body redemption, expiry/revoke,
  no private media in anonymous results; correct staff permissions/state transitions.
- Billing: disabled state first; configured sandbox checkout/idempotency/return
  reauthentication/status/balance/portal only when merchant services exist. Without
  credentials, record live acceptance as blocked, not passed.
- API keys: create/show-once/list/rotate/revoke with user JWT; no secret in storage,
  logs or bundles; unsupported developer controls remain unavailable.
- Admin: real authentication/permissions, no seeded staff identity or locally
  elevated roles; unsupported admin actions do not report success.
- Build and existing client tests pass; add meaningful request/response and
  auth-state tests for new flows. Keep passwords/codes/tokens out of test output.

At handoff, report: changed frontend files, implemented screens/API methods,
commands and test results, which live flows were actually observed, all provider
or missing-contract blockers, and remaining unsupported controls. A mocked fetch
test is not a live end-to-end pass. The backend's previous 145 passing tests and
live Google/Cloudinary checks are baseline evidence, not proof the frontend works.
