# Backend / frontend audit — 21 October 2026

Subsequent approved implementation: [platform extension](platform-extension.md)
supersedes missing entries for sessions, 2FA/recovery, bookmarks, in-app
notifications, business teams and scoped API keys. Cloudinary is now configured
and passed a real private upload/signed download/public denial/cleanup test.
The inventory below records the earlier audit state, not the post-extension state.

Backend: `C:\Users\HP\Desktop\projects\padicheck`.
Frontend reviewed read-only: `C:\Users\HP\Desktop\projects\padicheckui`.
Scope: the supplied eleven-part backlog. This report is an implementation inventory
and gap assessment, not a claim that the whole backlog has been delivered.
No migrations were applied, prices selected, charges created, or provider results fabricated.

Status labels:

- **Tested**: implemented with automated tests; live acceptance is stated separately.
- **Configuration**: implementation exists but requires local services/credentials/routing.
- **Decision**: requires a product/security/data-retention decision before implementation.
- **Missing**: no supported backend contract currently exists; a frontend demo is not implementation.

## Immediate frontend integration gaps

| Evidence in frontend | Actual backend behavior / required correction |
| --- | --- |
| `src/api/auth.ts`, `src/contexts/UserContext.tsx` | Real password/OTP/Google API clients. Access tokens stay in memory; `/me` supplies authoritative permissions. Signup password is retained only in component state for resend. |
| `src/api/investigations.ts`, `src/hooks/useCheckFlow.ts` | Real creation/polling/history/evidence clients. Upload mode currently limits inputs to PDFs and reports ambiguous submissions instead of silently retrying creates. |
| `src/components/billing/CheckoutSheet.tsx` | Simulates payment completion using a timer. Replace with the existing Bachs checkout, status and balance APIs before enabling purchases. Never grant units from this animation. |
| `src/contexts/UserContext.tsx`, `src/data/credits.ts`, `src/data/plans.ts` | Local initial credits, transactions, prices and advertised allowances are not backend balances/offers. Read `/v1/billing/offers` and `/v1/billing/me`; respect `enabled=false`. Each paid investigation currently consumes one server-side unit, not the different per-check prices in UI data. |
| `src/contexts/AdminSessionContext.tsx`, `src/contexts/AdminDataContext.tsx` | Locally seeded admin identity, role definitions and audit entries do not authenticate staff. Use normal backend authentication and server-returned permissions. UI role names `superAdmin`/`finance` do not match the backend's seeded role keys. This does not grant backend access. |
| `src/data/developer.ts` | `/v1/verify/business`, `/v1/verify/phone`, `/v1/verify/url`, `/v1/verify/listing`, `/v1/risk-score/{entity_id}` are advertised examples, not registered backend APIs. No API-key login, quotas or customer webhook platform exists. |
| `src/utils/trustScore.ts`, `src/data/scoring.ts`, trust/certificate views | Local numeric scores, bands, weights and certificates are not an approved server scoring/certification model. Do not publish them as verified server results. |
| `src/pages/business/BusinessTeam.tsx`, `BusinessReviews.tsx` | Local invitations, responses and success toasts have no corresponding team/review service. |
| `src/pages/consumer/Security.tsx`, `src/pages/auth/ForgotPassword.tsx` | Correctly identify reset, 2FA and several account controls as unavailable. Keep them unavailable until implemented. |
| `src/hooks/useOfflineQueue.ts` | Explicitly rejects offline submission; there is no durable server batch/offline-submit API. |
| `vite.config.ts` | Already proxies `/v1`, `/health`, `/ready` to `API_PROXY_TARGET`, default `http://127.0.0.1:3000`. Use relative browser requests; no backend CORS policy exists. |

Frontend files were not edited. Their directory is outside this session's writable
workspace. This audit provides handoff evidence for the frontend implementer.

## 1. Services and operations

Read-only current-environment probes:

| Service | Result | Remaining action |
| --- | --- | --- |
| PostgreSQL and schema | Passed | Verifier recognizes supplied baseline plus approved billing extension; no migration replay needed. |
| Redis | Passed | Existing shared revocations, OTP/nonces and BullMQ are available. Use protected, durable, no-eviction Redis in deployment. |
| SMTP | Passed outside sandbox | Connection/authentication succeeds. Existing live mailbox test confirmed code receipt; final OTP verification was not confirmed in that test. |
| Google metadata | Passed outside sandbox | Prior real-account acceptance also passed login, `/me`, replay rejection, logout and revoked-token rejection. Metadata alone would not prove consent/client configuration. |
| Cloudinary | Unconfigured | Supply all three private Cloudinary credentials. Upload/signed-delivery implementation and test doubles exist; live upload acceptance is pending. |
| UltraSearch | Unconfigured | Deploy the selected UltraSearch service and set its URL/optional credential. |
| Gemini | Unconfigured | Supply Gemini credential and valid model/routing configuration through the AI registry. |
| Research registry | Disabled | `RESEARCH_ENABLED=false`. Do not enable until real search/model access and active primary tools/assignments pass checks. |
| Billing | Disabled | Billing schema installed; merchant configuration, approved offers/prices and sandbox acceptance remain. No live payment was created. |

Sandbox SMTP/Google probes failed due to restricted network access; outside-sandbox
read-only probes passed. The latter are the service assessment above.

Existing sources: `src/app.ts`, `src/runtime/{integrations,readiness,api}.ts`,
`src/adapters/{investigation-jobs,auth-challenges,otp-email-jobs}.ts`, and
`src/workers/{otp-email,source-collection}.ts`.

| Requirement | Status / boundary |
| --- | --- |
| Token revocation, OTP challenges, Google nonces | Tested; real Redis probe passed. Logout revokes the submitted token, not every login. |
| OTP email background delivery | Tested; encrypted BullMQ jobs, pooled SMTP, bounded retries, current challenge/expiry checks. A worker startup check passed in the preceding work. |
| Collection queues and deferred-job reconciliation | Tested; database-persisted investigations survive initial queue dispatch failure and are reconciled by the source worker. |
| Accurate readiness | `/health` is liveness. `/ready` checks database/Redis/queue and enabled routing. Configured flags do not assert live external access or current worker liveness. Monitor workers separately. |
| Process startup and supervision | Existing commands below; automatic deployment supervision still belongs to the hosting/service manager. |

## 2. Account functionality

| Requirement | Status / next dependency |
| --- | --- |
| Password signup + email OTP, password login/logout | Tested; real mail receipt confirmed, full live OTP account verification still pending. |
| Google login and explicit linking | Tested; real Google login passed. Existing password account is never silently merged by email. |
| Secure password reset / password change | Missing. Reuse password hashing, email delivery, rate limits and challenge infrastructure, but add purpose-separated recovery and account-wide token invalidation before issuing these APIs. Do not repurpose signup codes. |
| Profile editing | Missing API; `users.display_name`, `phone_number`, `avatar_media_id` already support a bounded implementation. Avatar must be an owned ready image; email changes require a separate verified flow. |
| Active sessions, individual revoke, logout everywhere | Missing. JWTs have random `jti`, but no session registry or per-user credential epoch exists. Current token revocation alone cannot list or invalidate every outstanding session. |
| 2FA and recovery codes | Missing; requires chosen factor, step-up/recovery policy, encrypted secret storage and hashed single-use recovery codes. Email signup OTP is not 2FA. |
| Account export/deletion | Missing; requires export scope and deletion/retention rules for evidence, reports, moderation/audit and financial records. A `deleted` enum is not a complete deletion workflow. |
| Google unlink | Missing; require recent proof of identity and a verified remaining login method, serialized against credential changes. |
| Session persistence / renewal | Current supported policy: 15-minute bearer token in memory, no refresh token, page reload requires login. Frontend implements this policy. Persistent/rolling sessions are a new security decision, not an existing capability. |

Schema evidence: baseline `users`, `user_auth_accounts`, RBAC and audit tables.
There are no supplied sessions, MFA, recovery-code or export-job tables.

## 3. Investigation input and processing

| Input or check | Status / truthful frontend contract |
| --- | --- |
| Text prompt and public HTTP(S) links | Tested. Bounded URL fetching/search/model adapters exist; live analysis requires configured services. |
| PDF documents | Tested upload/ownership/extraction pipeline. Only owned ready authenticated documents can be attached; Gemini sees extracted evidence, not automatically every upload. |
| Images / screenshots / camera photos | Upload storage supports JPEG/PNG/WebP/GIF. Investigation attachment validation currently requires `media_type='document'`; image OCR/vision analysis is missing. Do not treat successful image upload as analysis. |
| DOCX / plain-text file uploads | Missing upload/extraction support. Plain text can already be supplied as the prompt, which is distinct from accepting a text file. |
| Audio / video | Upload/storage supports selected formats; transcription, audio reasoning, video frame extraction and analysis are missing. |
| Processing reliability | Tested retries, deadlines, cancellation, ownership/permission rechecks and error codes. Provider calls can repeat after crashes; no exactly-once external billing guarantee. |
| Provenance and uncertainty | Sources/model runs/findings/evidence links exist. Exact quote/source checks reject unsupported findings. AI output stays unverified; staff decisions and user allegations are separate records. |
| Business registration | General evidence research and staff business verification exist. No authoritative registration-provider integration. |
| Domain / phone | Can research submitted identifiers/web content. No authoritative domain age, telecom subscriber identity, carrier age or ownership guarantee. |
| Property / shopping | General evidence research only; no land registry, certified title, image-duplication index, seller authentication or market-price provider. |
| Job offers / social profiles | General evidence research only; no employer identity guarantee, platform-private account data, hiring marketplace, or social ownership verification. |

Use existing `/v1/investigations` with the supported type/prompt/inputs rather than
inventing the frontend's `/v1/verify/*` endpoints. The baseline type enum is not
proof of a specialized external data integration.

## 4. Investigation management

| Requirement | Status / next dependency |
| --- | --- |
| Owner history, pagination, detail, polling, cancel/retry | Tested. Staff `scope=all` requires `investigations.read_all`. |
| Saved/bookmarked investigations | Missing backend persistence; frontend `pc-saved` is local demo data. |
| Server search, filters, sorting | Missing beyond current own/all scope, opaque cursor and newest-first ordering. Existing table supports a bounded extension without a new collection API. |
| Completion/failure notifications and preferences | Missing; needs durable notification/outbox/preferences model and delivery policy. |
| Generated PDF reports | Missing. PDF input extraction is not PDF report generation. |
| Bulk submission / batch status | Missing. Requires batch storage, per-item idempotency/authorization/allowance policy and queue limits. |
| Sharing / anonymous redemption | Tested owner-only creation on completed investigations, secret hashes, expiry/revoke, bounded anonymous result DTO and no private media disclosure. |
| Retention / offline caching | Decision. Current private APIs use no-store and signed delivery expires after 300 seconds. No scheduled data-retention policy/job exists. Offline private-result retention is not approved; inspect share-inbox caches separately before enabling persistent private data. |

## 5. Trust Score

**Decision; numerical scoring is not implemented on the backend.** Before a
scoring migration/API, agree evidence inputs and admissibility, provenance,
weights, confidence calculation, missing/conflicting data behavior, versioning,
explanations, corrections/appeals and evaluation criteria. Missing evidence must
not silently imply trust or guilt. Local frontend weighted averages/bands are
not approval of a model. Score history/change alerts depend on that decision.
Keep AI interpretation, user allegations and staff verification distinct.

## 6. Businesses

| Requirement | Status / next dependency |
| --- | --- |
| Directory / staff creation and publication | Tested, existing entities/business profiles/public directory APIs. |
| Consumer listing request and staff approval workflow | Missing dedicated request workflow. Staff directory creation is not a self-service listing request. |
| Claimed owner profile edits | Missing owner edit API. Existing staff patch route requires `businesses.manage`. |
| Evidence-backed verification / claim / reports / disputes | Tested state transitions, owned evidence, reviewer permissions, conflict/self-review guards and audit rollback. Existing verification decision can assign the claim; no team membership exists. |
| Team invitations / membership / permissions | Missing storage/APIs. Decide business roles, seats, invite expiry and paid entitlement first. |
| Customer reviews / responses / moderation | Missing; `user_reports` are allegations, not star reviews. Do not reuse them as reviews. |
| Certificates / QR / public validation | Missing signed/versioned certificate issuance, expiry/revocation and public validation contract. Existing staff approval is not a certificate service. |
| Profile analytics / reputation alerts | Missing measurement/event/notification model; frontend fixtures are not operational metrics. |

## 7. Billing

| Requirement | Status / next dependency |
| --- | --- |
| Configured offers / authoritative balance | Tested existing `/v1/billing/offers`, `/v1/billing/me`; currently disabled. Never use browser-local credits as entitlements. |
| Checkout idempotency / reconciliation / subscription allowances | Tested with explicit provider doubles and scratch PostgreSQL; live merchant acceptance pending. Signed webhook inbox is durable and processed asynchronously. |
| Customer subscription portal | Implemented/tested adapter/ownership contract; live portal requires merchant setup. |
| Purchase history / invoices / receipts | Owned checkout status exists; full paginated purchase history, downloadable receipts/invoices and customer invoice listing are missing. Provider support must be validated rather than invented. |
| Refunds, chargebacks, failed-investigation refunds | Decision and missing automation. Existing notifications can require manual review; no approved automatic refund/recredit rules or refund-action API. Decide eligible failures, consumed-unit reversal, partial/refund amounts and subscription effects. |
| Currencies / payment methods / allowance expiry | Current backend offer validation allows USD/NGN one-time and USD subscriptions. These are backend restrictions, not proof all methods are enabled on the merchant account. One-time grants currently have no automatic expiry; subscription grants use paid periods. Confirm commercial policy before changing it. |

Do not enable billing until real products/offers, prices/allowances, return URLs,
webhook verification, portal access and sandbox end-to-end payment have passed.

## 8. Developer platform

All of the following are **missing**, not merely unconfigured:

| Requirement | Dependency |
| --- | --- |
| API-key create/store/scopes/rotate/revoke | Hashed secret/key lifecycle model, scoped customer principals and recent-auth policy. |
| Customer API auth, quotas/rate limits | Tenant/environment isolation, authoritative quota ledger and abuse controls. Existing JWT RBAC is user auth, not customer-key auth. |
| Usage metrics / customer request logs | Durable privacy-bounded usage events, filters/retention and tenant access rules. Pino operational logs alone are not a customer log API. |
| Customer-facing investigation/verification contracts | Reuse existing domain services through an approved principal/scope layer. Do not add shallow duplicates of internal routes or promise unsupported authoritative checks. |
| Customer webhooks | Subscription ownership, SSRF-safe endpoint validation, per-subscription signing secrets, outbox/retry/delivery logs and rotation. Bachs inbound merchant webhook is a different feature. |
| Isolated sandbox | Separate credentials/data/quotas/provider effects and explicit routing. Browser `pc_test_*` sample strings are not isolation. |

Frontend advertised endpoints listed above must remain explicitly unsupported
until this platform exists; OpenAPI is the supported contract.

## 9. Staff and admin

| Requirement | Status / next dependency |
| --- | --- |
| User search/detail/suspend/reactivate | Missing APIs, although `users.read` / `users.manage` permissions and account status are already seeded. Add explicit safe DTOs and audited status transitions; protect the final active superadmin. |
| Audit log access | Records and `audit.read` exist; paginated audit read API missing. Avoid exposing credential/body data in future audit DTOs. |
| Role grants / role list | Tested existing APIs; grants require superadmin in addition to permission checks. |
| Role removal / staff/team management | Missing APIs; require serialized last-superadmin protection and defined invitation/recent-auth policy. |
| Investigation monitoring / health | Existing permissioned `scope=all`, detail/model-run APIs and health/preflight can be reused. No full queue/provider analytics dashboard API. |
| Billing/support / allowance adjustments / refunds | Superadmin offer/event/grant listing and grant revocation exist. Arbitrary unit adjustments and refund actions missing/decision-gated. |
| Support tickets | Missing tables, status policy, assignment/access and APIs. |
| Help/content management / notification administration | Missing persisted CMS and notification services; frontend local document/campaign state is a demo. |
| Dashboard metrics | Missing aggregate endpoints. Derive from real records; do not return the seeded frontend numbers. |
| Existing business/review/AI registry authorization | Covered by backend integration tests. Frontend route visibility is not authorization. |

## 10. Jobs & Talent

Job-offer research uses the supported `job_search` investigation context. A hiring
marketplace is **not implemented**. Frontend `src/data/talent.ts`, matching utilities
and candidate/job cards do not supply employer listings, candidate consent/access,
applications, skills storage, moderation or safe contact permissions. Decide
whether to remove/disable marketplace UI or approve it as a separate product and
schema. Do not fold it into investigation research implicitly.

## 11. Integration and acceptance evidence

| Evidence | Result / limitation |
| --- | --- |
| Backend test suite from preceding implementation | 134/135 passed; unrelated PDF extraction timeout passed in isolation. Auth/OTP/queue changes passed. This is not 135 live provider tests. |
| Frontend `node --test tests/api.test.mjs` in this audit | 16/16 passed. Real API client modules exercised with fetch doubles, not a live browser/provider end-to-end run. |
| `node --import tsx scripts/verify-database.ts` | Passed; baseline plus approved billing extension matches. Read-only; no migrations applied. |
| `node --import tsx scripts/check-integrations.ts` outside sandbox | PostgreSQL/Redis/SMTP/Google passed; Cloudinary/UltraSearch/Gemini unconfigured; research/billing disabled. Sends no mail/charges. |
| Real Google acceptance | Prior live test passed login 200, account 200, replay 401, logout 204, revoked access 401. |
| Real email acceptance | Prior mailbox receipt passed; final signup verification/persistence/password-login result remains unconfirmed. Repeat live test with worker running. |
| Live uploads, full investigation analysis, moderation/sharing browser flows, Bachs payment | Not demonstrated against real configured providers in this audit. Existing automated integration tests are separate evidence. |

OpenAPI and [frontend integration guide](frontend-integration.md) cover the current
87 operations, permissions, payloads, pagination, states and errors. No APIs were
added during this audit. Do not advertise a backlog endpoint before its runtime
handler, authorization, OpenAPI, integration guide and acceptance evidence exist.

Test account setup: create a normal account through OTP signup using a mailbox
you own. Use a different unused address/alias from a Google-only account. For
staff, follow the controlled `admin:bootstrap` procedure; never use frontend role
selection or client-supplied roles to elevate an account. Fixtures live in
`tests/support` and test files; smoke scripts use isolated scratch data. Do not
seed realistic-looking fake business findings/transactions into the main database.

## Startup and the email worker command

Open separate terminals in the backend directory:

```powershell
# Terminal 1: HTTP API
npm run dev

# Terminal 2: OTP email delivery
npm run email:worker:dev

# Terminal 3: investigation collection / enabled analysis / reconciliation
npm run worker:dev
```

`npm run email:worker:dev` maps in `package.json` to
`node --import tsx src/workers/otp-email.ts`. It loads `.env`, verifies Redis/SMTP,
waits for encrypted OTP jobs, skips stale codes, sends the HTML/plain-text email
and retries failures. It serves no HTTP port and must keep running. The current
command does not watch source changes; restart it after editing worker code.

Request flow: signup -> password hash + pending Redis challenge -> queued email
-> HTTP 202 -> worker SMTP send -> user submits OTP -> database account + JWT.
202 means queued, not delivered. The code expires ten minutes from the request.
An SMTP worker cannot force a mail provider to deliver instantly.

For built deployments:

```powershell
npm run build
# Separate supervised processes:
npm start
npm run email:worker:start
npm run worker:start
```

Use the same Redis and JWT secret across the API/email worker. Keep credentials
server-side. Frontend development uses its existing Vite proxy; production should
use same-origin HTTPS proxying unless an explicit restricted CORS design is added.

## Implementation sequence and required decisions

1. Existing-schema work can be developed first: bounded profile edits, history
   search/filters, staff user/audit reads and guarded status/role changes. Reuse
   existing routes/resources and permissions, with meaningful authorization tests.
2. Account security needs a reviewed additive design: session registry/credential
   invalidation, recovery, 2FA and recent-auth proof. Do not bolt reset onto signup
   OTP or simply delete Google identity rows without remaining-access checks.
3. Investigation input extensions need bounded parsers/vision provider support,
   safe private-media fetching, provenance and real provider acceptance; then add
   management storage for bookmarks/notifications/batches/report jobs as approved.
4. Business teams/reviews/certificates, customer developer APIs and support/CMS
   require separate reviewed schema/permission extensions. The only previously
   approved extension is billing 003, not blanket permission to invent all tables.
5. Product decisions required before dependent implementation: Trust Score model;
   persistent-session/MFA policy; retention/export/deletion and offline storage;
   refund/failed-investigation allowance policy; commercial prices/expiry; business
   team/certificate rules; developer quotas/sandbox; Jobs & Talent marketplace scope.
6. Supply Cloudinary/UltraSearch/Gemini and merchant sandbox configuration privately,
   then run genuine end-to-end acceptance. Do not enable unconfigured services or
   translate local demos into successful API responses.

The original supplied SQL is preserved. Missing tables for the new domains are a
schema gap under the user's schema-preservation instruction. They require an
explicit additive proposal/review before migrations and dependent implementation.
