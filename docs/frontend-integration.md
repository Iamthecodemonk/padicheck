# PadiCheck frontend integration handoff

This document describes the implemented backend as of 19 October 2026. Start
with signup and authentication, then media and investigations. The generated
[API reference](api-reference.md) contains every registered operation, path/query
parameters, exact request schemas and success/error response envelopes. The
[OpenAPI snapshot](openapi.json) can be imported into Postman or a client
generator. Record fields and workflow rules that are not exhaustively typed in
Swagger are explained here.

## Copy this prompt to your frontend AI

```text
Integrate the existing PadiCheck frontend with the implemented backend.
Read docs/frontend-integration.md, docs/api-reference.md and docs/openapi.json
before changing code. Preserve the frontend's existing framework and design.

Use a shared API client and configurable API base URL. Do not invent endpoints,
payload fields, pagination totals, refresh tokens or password-reset support.
Implement in this order:
1. Password signup -> email OTP verification -> login -> /v1/auth/me -> logout.
2. Google Identity Services sign-in and explicit authenticated account linking.
3. Authenticated multipart uploads and short-lived private media delivery.
4. Investigation creation, list pagination, polling, results, sources, findings,
   cancellation and retry, including service-disabled and queued/deferred states.
5. Public directory, evidence-backed verification requests, reports and disputes.
6. Owner-controlled completed-investigation sharing and anonymous redemption.
7. Permission-gated staff screens for existing admin/review/AI registry APIs.

Implement loading, empty, validation, 401, 403, 404, 409, 429 and 503 states.
Use permissions returned by /v1/auth/me, while allowing backend authorization to
remain authoritative. Display AI limitations and distinguish unverified findings,
user allegations and staff verification decisions. Render external text safely.

The backend does not enable browser CORS: use a same-origin reverse proxy or the
frontend dev-server proxy. Never expose backend credentials in public env vars.
Implement billing from the current OpenAPI routes: offers, owned checkout,
status polling, balance, subscriptions and customer portal. Respect enabled=false;
merchant keys, offers and BILLING_ENABLED still need backend configuration.
Both one-time purchases and subscription-period allowances are supported.
Do not change the database or backend contracts to make a screen appear to work.

Verify real requests against Swagger and test registration, OTP resend, login,
expired tokens, uploads, pagination and polling. Report unsupported features
explicitly rather than simulating successful backend responses.
```

## Connection and common conventions

| Item | Value |
| --- | --- |
| Default API origin | `http://127.0.0.1:3000` |
| Versioned base | `http://127.0.0.1:3000/v1` |
| Interactive documentation | `http://127.0.0.1:3000/docs/` |
| Live OpenAPI | `/docs/json` and `/docs/yaml` |
| Authentication | `Authorization: Bearer <PadiCheck access_token>` |
| JSON bodies | `Content-Type: application/json` |
| File body | Browser `FormData`, field name `file`; let the browser set Content-Type |
| Identifiers | UUID strings unless a field explicitly says otherwise |
| Dates | ISO 8601 strings; nullable database timestamps may be `null` |
| SQL bigints/numerics | May arrive as decimal strings, including `size_bytes`, confidence and cost |

There is no deployed API URL recorded in this repository. Configure the public
origin in the frontend's own environment, for example `VITE_API_BASE_URL` if it
uses Vite, or the equivalent for its framework. That variable is frontend
configuration, not an existing backend environment key. Avoid adding `/v1`
twice if your API helper already includes it. All paths below are relative to
the API origin and already contain `/v1` where appropriate.

The backend does not currently register CORS. Calls from a separate browser
origin will need a proxy or a separately implemented CORS policy. A development
proxy can forward `/v1`, `/health` and `/ready` to `http://127.0.0.1:3000`, with
the browser requesting relative paths. Production can use an equivalent reverse
proxy. Do not use `mode: 'no-cors'`: it does not solve authenticated API access.

There are no session cookies. Keep the access token in memory by default and
send it in the Authorization header. A page reload then requires login again
unless the frontend has an explicitly agreed persistence policy. There is no
refresh endpoint or automatic refresh token. Use HTTPS in deployed environments.

Most JSON schemas reject unknown properties. Send documented fields only; omit
optional values rather than sending `null` unless the schema explicitly allows
null. Empty lists are normal success responses. List endpoints do not return a
total count unless documented; do not invent one. Do not automatically retry
POST operations, which may create duplicates or consume a challenge.

### Shared error handling

```json
{
  "error": { "code": "invalid_request", "message": "Request validation failed" },
  "request_id": "req-example"
}
```

| HTTP status | Frontend behavior |
| --- | --- |
| 400 | Show validation/domain error. Schema failures provide a generic message, not a field-error map. |
| 401 | Current token or supplied credentials are invalid. Clear stale session state on protected calls and show login. |
| 402 | Billing is enabled but no investigation units are available. Show offer selection; do not auto-retry creation. |
| 403 | Keep the session; show insufficient permissions or conflict-of-interest message. |
| 404 | Resource missing or hidden by access rules; do not infer another user's records exist. |
| 409 | Account/link/state conflict; refresh state or follow the documented recovery flow. |
| 413 / 415 | File too large / unsupported or mismatched file content. |
| 429 | Show cooldown and honor Retry-After when present. OTP cooldown errors may have no such header. |
| 502 / 503 | Provider failure / unavailable or unconfigured service. Do not report success. |
| 500 | Unexpected server failure; retain request_id for support without logging secrets. |

`POST /v1/auth/logout` and `DELETE /v1/media/{media_id}` return **204 with no
body**. Do not call `response.json()` unconditionally. `/ready` returns
`{"status":"unavailable"}` on 503 rather than the normal error envelope.

### Framework-neutral fetch helper

```ts
export class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string,
    public requestId?: string, public retryAfter?: string | null) {
    super(message);
  }
}

export async function api<T>(base: string, path: string, options: {
  method?: string; token?: string; json?: unknown; file?: File; signal?: AbortSignal;
} = {}): Promise<T | undefined> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  let body: BodyInit | undefined;
  if (options.file) {
    const form = new FormData();
    form.append('file', options.file);
    body = form;
  } else if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: options.method ?? 'GET', headers, body,
    signal: options.signal, cache: 'no-store',
  });
  if (response.status === 204) return undefined;
  const data = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiFailure(response.status,
    data?.error?.code ?? 'request_failed', data?.error?.message ?? 'Request failed',
    data?.request_id, response.headers.get('Retry-After'));
  return data as T;
}
```

Use AbortController to cancel screen requests on unmount. Keep tokens, OTPs,
Google credentials, share secrets and response contents out of client logs.

## Signup, OTP and password login

### Start signup

`POST /v1/auth/register`, public:

```json
{ "display_name": "Ada", "email": "ada@example.com", "password": "ExamplePassword123!" }
```

Display name: 1-120 characters and nonblank after trimming. Email: valid email,
maximum 254 characters. Password: 12-128 characters. Response **202**:

```json
{
  "challenge_id": "00000000-0000-4000-8000-000000000001",
  "expires_in": 600,
  "message": "If eligible, a verification code has been sent to this email."
}
```

Store the email and challenge ID in signup screen state and show a six-digit OTP
input. This response does not create a user and contains no access token.
For existing accounts it intentionally returns the same generic response and
does not send a new signup email. Do not promise account creation at this step.

### Complete signup

`POST /v1/auth/register/verify`, public:

```json
{
  "email": "ada@example.com",
  "challenge_id": "00000000-0000-4000-8000-000000000001",
  "code": "012345"
}
```

Send `code` as a **string**, preserving leading zeros. Success **201** creates
the verified account and returns a session:

```json
{
  "user": {
    "users_id": "00000000-0000-4000-8000-000000000002",
    "display_name": "Ada",
    "email": "ada@example.com",
    "email_verified": true
  },
  "access_token": "<PadiCheck JWT>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

Save the token and call `/v1/auth/me` to load roles/permissions before building
protected navigation. Do not derive staff privileges from the signup response.

### Resend and recovery

There is no separate signup resend URL. After a 60-second cooldown, repeat
`POST /v1/auth/register` with the same signup fields; replace the old challenge
ID with the newly returned ID. Keep the pending password in transient state
only, or ask for it again if the signup flow was reloaded. Do not persist it.

Codes expire after 10 minutes, permit at most five attempts, and are single-use.
Each email can request at most five codes/challenges per hour; IP rate limits
also apply. `400 invalid_otp` covers wrong, expired, exhausted or used codes.
If a verified code was consumed but account creation failed, request a new code
after the cooldown. Handle `409 account_exists` by offering password login.

### Later login, current account and logout

`POST /v1/auth/login` with `{"email":"ada@example.com","password":"..."}`
returns **200** with the same session shape. `401 invalid_credentials` does not
distinguish unknown email from a wrong password.

`GET /v1/auth/me`, JWT required, returns **200**:

```json
{
  "user": {
    "users_id": "00000000-0000-4000-8000-000000000002",
    "display_name": "Ada",
    "email": "ada@example.com",
    "email_verified_at": "2026-10-19T10:00:00.000Z",
    "roles": ["user"],
    "permissions": ["investigations.create", "investigations.read_own", "reports.submit"],
    "email_verified": true
  }
}
```

Permission/role order is not guaranteed. A user may have multiple roles. Active
account status and current permissions are checked on protected requests;
previously issued tokens do not bypass a suspension.

`POST /v1/auth/logout`, JWT required and no body, returns **204** and revokes that
token. Clear the frontend session and private caches. If the call fails due to
network loss, local logout does not prove the server revoked the token.

For a legacy unverified account, authenticated `POST /v1/auth/email/request`
(no body) returns a 202 challenge. Then authenticated
`POST /v1/auth/email/verify` accepts `{email, challenge_id, code}` and returns
`{"email_verified":true}`. Refresh `/me`. Signup and account-email challenges
are purpose-specific and cannot replace each other.

## Google sign-in and linking

The Google Web client ID is public frontend configuration and must match the
backend's `GOOGLE_CLIENT_ID`. Use Google Identity Services with the frontend
origin registered in Google. Never expose a Google client secret or backend key.

1. Public `POST /v1/auth/google/challenge` with `{"action":"login"}` (or `{}`)
   returns `{"nonce":"<random nonce>","expires_in":300}`.
2. Initialize the Google Identity Services sign-in flow with that exact nonce.
3. In its callback, send public `POST /v1/auth/google` with
   `{"id_token":"<Google callback credential>"}`.
4. Success **200** returns the normal PadiCheck session; fetch `/me`.

The nonce expires in five minutes and is single-use. On a consumed/expired nonce
start a fresh challenge and Google flow. Google ID tokens are not PadiCheck API
access tokens. The backend accepts JSON callback submission, not Google's
automatic form-post flow or an OAuth code redirect.

`409 account_link_required` means an existing password account must log in and
link explicitly. `409 email_verification_required` means a new third-party
Google email needs normal email OTP signup first. To link:

1. Log in to PadiCheck and verify the local account email if needed.
2. JWT-authenticated `POST /v1/auth/google/challenge` with `{"action":"link"}`.
3. Obtain a fresh Google ID token using this nonce.
4. JWT-authenticated `POST /v1/auth/google/link` with `{id_token}` returns
   `{"linked":true}` on 200.

The Google email must match the locally verified email. Nonces are scoped to
login or to a specific linking account. There is no unlink endpoint currently.
See [authentication.md](authentication.md) for complete setup and error behavior.

## Private media uploads and delivery

All media routes require JWT. Upload using `POST /v1/media` with exactly one
multipart file named `file`, no extra form fields. Success **201**:

```json
{
  "media": {
    "media_id": "00000000-0000-4000-8000-000000000003",
    "uploaded_by_user_id": "00000000-0000-4000-8000-000000000002",
    "storage_provider": "cloudinary",
    "provider_asset_id": "<asset identifier>",
    "provider_public_id": "padicheck/<user-id>/<media-id>.pdf",
    "provider_resource_type": "raw",
    "provider_delivery_type": "authenticated",
    "provider_version": "1",
    "original_filename": "contract.pdf",
    "media_type": "document",
    "mime_type": "application/pdf",
    "size_bytes": "12345",
    "sha256": "<SHA256 hex>",
    "visibility": "private",
    "upload_status": "ready",
    "created_at": "2026-10-19T10:00:00.000Z"
  }
}
```

Do not upload directly to Cloudinary from the frontend. The API validates actual
file contents. Supported formats: JPEG, PNG, WebP, GIF, MP4, WebM, MP3, WAV,
FLAC, OGG, PDF. Default limit is 10 MiB, configurable server-side up to 25 MiB;
the live Swagger description shows the configured limit. Uploading unsupported
content, a spoofed MIME type or extra parts fails before storage is called.

| Method | Path | Success |
| --- | --- | --- |
| GET | `/v1/media/{media_id}` | 200 `{media: MediaRecord}` |
| POST | `/v1/media/{media_id}/delivery` | 200 `{url, expires_at}` |
| DELETE | `/v1/media/{media_id}` | 204, no body |

Delivery `expires_at` is a Unix timestamp in seconds; the signed URL expires in
300 seconds. Request a fresh URL when opening a document; do not persist signed
URLs as permanent file identifiers. Owners and `media.manage` can access media;
reviewers can read evidence linked to submissions they are authorized to review.
Only the owner or media manager may delete it. `409 media_in_use` means a record
references the upload. Documents sent to investigations must be ready, private
or restricted, authenticated document uploads owned by the caller. Supported
audio/video upload does not imply audio/video AI analysis is implemented.

## Investigations and research results

`POST /v1/investigations`, JWT and `investigations.create`:

```json
{
  "investigation_type": "company_research",
  "title": "Example business review",
  "user_prompt": "Research this business using the submitted references.",
  "input_data": {
    "urls": ["https://example.com/"],
    "media_ids": [],
    "targets": [{
      "entity_type": "business",
      "canonical_name": "Example Business",
      "target_role": "primary",
      "identifiers": [{ "identifier_type": "domain", "value": "example.com" }]
    }]
  }
}
```

Only `investigation_type` and `user_prompt` are schema-required. The full nested
schema, limits and enums are in the generated reference. Each of URLs, document
IDs and targets permits at most ten entries; each target has at most ten
identifiers. Business rules add these requirements:

| Type | Additional input |
| --- | --- |
| `company_research` | Prompt; optional targets, URLs and documents |
| `web_analysis` | At least one HTTP/HTTPS URL |
| `job_search` | Prompt; optional context |
| `contract_review` | At least one owned ready document media ID |
| `phone_lookup` | A target with a phone identifier including international country code |
| `general_research` | Prompt; optional context |

Phone identifiers use international form such as `+2348012345678`. Domains have
no URL scheme/path. URLs must not include embedded credentials. Title maximum
200 characters; prompt maximum 10,000. The service further restricts fetched
hosts and formats; a valid URL does not guarantee it is fetchable.

Response **202**, `Location: /v1/investigations/{investigation_id}`:

```json
{
  "investigation": {
    "investigation_id": "00000000-0000-4000-8000-000000000004",
    "user_id": "00000000-0000-4000-8000-000000000002",
    "investigation_type": "company_research",
    "title": "Example business review",
    "user_prompt": "Research this business using the submitted references.",
    "input_data": { "urls": ["https://example.com/"], "media_ids": [], "targets": [] },
    "status": "queued",
    "result_summary": null,
    "error_code": null,
    "created_at": "2026-10-19T10:00:00.000Z",
    "updated_at": "2026-10-19T10:00:00.000Z",
    "started_at": null,
    "completed_at": null
  },
  "dispatch": "queued",
  "capabilities": { "independent_search": false, "ai_analysis": false }
}
```

The real `input_data` returns the normalized submitted inputs, including targets;
the abbreviated example above illustrates the record fields. `dispatch` may be
`deferred` even on 202: the row was saved but delivery awaits reconciliation or
queue setup. Do not automatically create a second investigation.

### Lists, polling and action URLs

| Method | Path | Response |
| --- | --- | --- |
| GET | `/v1/investigations?scope=own&limit=20&cursor=...` | `{investigations: InvestigationSummary[], next_cursor: string \| null}` |
| GET | `/v1/investigations/{investigation_id}` | `{investigation, targets, source_collection_complete, capabilities, limitations}` |
| GET | `/v1/investigations/{investigation_id}/sources?limit=20&offset=0` | `{sources, capabilities}` |
| GET | `/v1/investigations/{investigation_id}/findings?limit=20&offset=0` | `{findings, limitations}` |
| GET | `/v1/investigations/{investigation_id}/model-runs?limit=20&offset=0` | `{model_runs}` |
| POST | `/v1/investigations/{investigation_id}/cancel` | 200 `{investigation}` |
| POST | `/v1/investigations/{investigation_id}/retry` | 202 `{investigation, dispatch}` |

`scope=all` requires `investigations.read_all`; ordinary users use `scope=own`.
Investigation reads require `investigations.read_own` or `investigations.read_all`.
Treat next_cursor as opaque and URL-encode it; use it for the next page and stop
at null. There is no offset pagination for this list. Summary rows include
investigation_id, user_id, investigation_type, title, status, error_code,
created_at, updated_at, started_at and completed_at; prompts/input/result_summary
are retrieved through the detail endpoint.

Poll the detail endpoint every few seconds while mounted, backing off on errors
and pausing when hidden. States are `queued`, `collecting_sources`, `analyzing`,
`completed`, `failed`, `cancelled`. Stop polling on the last three. There is no
WebSocket, SSE or percentage-progress endpoint. Only active investigations can
be cancelled; only failed ones retried. Actions require ownership plus
`investigations.create`; read-all access alone does not allow those actions.

With research disabled, submitted sources can be collected while the status
remains `collecting_sources`; `source_collection_complete` can become true but
does not mean AI analysis is complete. Show the capability flags and limitations
instead of promising an imminent AI result. With research enabled, UltraSearch
and Gemini need working provider configuration and database registry entries.

### Result record fields

- **Target:** investigation_target_id, target_role, result_rank, is_selected,
  entity_id, entity_type, canonical_name, identifiers. Each identifier has
  identifier_id, identifier_type, value, normalized_value.
- **Source:** source_id, source_type, url, media_id, title, publisher, excerpt,
  content_hash, fetched_at, visibility, metadata, created_at, discovery_method,
  relevance_rank, used_in_analysis, added_at. Many text/date fields are nullable.
- **Finding:** finding_id, investigation_id, entity_id (nullable), model_run_id
  (nullable), finding_type, category, title, explanation, confidence (nullable
  decimal string/number in 0-1), verification_status, display_order, created_at,
  sources. Linked finding sources contain source_id, url, media_id, title,
  support_type, evidence_note. support_type is supports/contradicts/context.
- **Model run:** model_run_id, task_type, provider, model_name, prompt_version,
  status (queued/running/succeeded/failed), input_tokens, output_tokens,
  estimated_cost_usd, error_code, started_at, completed_at, created_at. Token
  counts/cost/times can be null. This API omits internal prompts and raw outputs.

Finding types: fact, claim, positive_signal, risk_signal, missing_information,
recommendation. AI-generated findings remain unverified. Display the actual
verification_status and limitations, sources, uncertainty and missing evidence.
Do not portray a risk_signal or an allegation as a verified conclusion. Escape
provider/user text and validate URLs before making clickable external links.

## Public directory and staff business management

Anonymous endpoints:

| Method | Path | Response |
| --- | --- | --- |
| GET | `/v1/directory?q=Example&category=Services&limit=20&offset=0` | `{businesses: PublicBusiness[]}` |
| GET | `/v1/directory/{id}` | `{business, identifiers, verification_review, limitations}` |
| GET | `/v1/directory/{id}/reports?limit=20&offset=0` | `{reports: PublishedReport[], limitations}` |

`{id}` in directory URLs is **business_profile_id**, not entity_id. Public
business fields: business_profile_id, entity_id, business_category,
profile_description, canonical_name, country_code, city, created_at, updated_at.
country_code/city/description can be null. Identifiers expose identifier_type and
value only for public entries. verification_review is null or
`{status: "approved" | "rejected", reviewed_at}`. It is a staff evidence review,
not a guarantee about business behavior. Search q is a case-insensitive name
substring; category is an exact match. Only published profiles appear.

Published report fields: user_report_id, entity_id, report_category, title,
description, incident_at, submitted_at, is_disputed. Submitter/reviewer identities
and private evidence are not included. Treat published reports as moderated
user-submitted allegations.

Staff endpoints:

| Method | Path | Permission / body |
| --- | --- | --- |
| GET | `/v1/admin/businesses?limit=20&offset=0` | businesses.manage |
| POST | `/v1/admin/businesses` | businesses.manage; create body below; 201 `{business}` |
| PATCH | `/v1/admin/businesses/{id}` | businesses.manage; business_category and/or profile_description; 200 `{business}` |
| POST | `/v1/admin/businesses/{id}/publication` | directory.manage; `{status, note}`; 200 `{business}` |

Create with either existing business `entity_id` OR new `canonical_name` with
optional country_code/city, plus required business_category and optional
profile_description. Do not mix the existing-entity and new-entity fields.

```json
{ "canonical_name": "Example Business", "country_code": "NG", "city": "Lagos",
  "business_category": "Services", "profile_description": "Example description" }
```

Publication status: draft/published/hidden. Both status and nonblank note are
required. PATCH must include at least one supported property; profile_description
may explicitly be null. Staff business records contain all business_profiles
fields: business_profile_id, entity_id, business_category, profile_description,
claimed_by_user_id, profile_status, created_at, updated_at. The admin list also
includes canonical_name, but create/update responses need not include it.

## Business verification, reports and disputes

These workflows are separate from AI investigations. All submission/self-service
URLs require JWT. List pagination uses limit (1-100, default 20) and offset
(0-10,000, default 0). No total count is returned.

### Business verification and claim

`POST /v1/verifications`:

```json
{ "business_profile_id": "00000000-0000-4000-8000-000000000005",
  "media_ids": ["00000000-0000-4000-8000-000000000003"] }
```

At least one and at most ten owned ready private evidence files are required.
Returns **201** `{verification}`. No separate claim API exists: an approved
verification assigns the business claim. The profile must be published or
already claimed by the caller, cannot belong to another claimant, and cannot
have another pending/in-review request by the same submitter.

| Method | Path | Response / rule |
| --- | --- | --- |
| GET | `/v1/verifications` | `{verifications}` owned submissions |
| GET | `/v1/verifications/{id}` | `{verification, evidence}` owner or verifier |
| POST | `/v1/verifications/{id}/withdraw` | `{verification}`; owner; pending/in_review only |
| GET | `/v1/admin/verifications` | `{verifications}`; verifications.review |
| POST | `/v1/admin/verifications/{id}/review` | `{status, note}` -> `{verification}`; verifications.review |

Review accepts in_review/approved/rejected. Pending can move to any of those;
in_review can move to approved/rejected. Terminal requests cannot be reopened.
Staff cannot review their own submission or a business they claim.

Verification fields: verification_request_id, business_profile_id,
submitted_by_user_id, status, submitted_at, reviewed_at, reviewed_by_user_id,
decision_note. Evidence fields: verification_evidence_id, media_id,
evidence_type, created_at. Use the media delivery endpoint to view evidence.

### User reports

`POST /v1/reports` requires reports.submit:

```json
{
  "entity_id": "00000000-0000-4000-8000-000000000006",
  "report_category": "service_experience",
  "title": "Example report",
  "description": "Describe the reported incident and available evidence.",
  "incident_at": "2026-10-19T10:00:00.000Z",
  "media_ids": []
}
```

entity_id, report_category, title and description are required. The entity must
be a published directory business or a target in the caller's investigation.
Optional media_ids must be owned ready private evidence. Returns **201**
`{report}`. report_category is free text within its validation limit, not an enum
catalog supplied by the API.

| Method | Path | Response / rule |
| --- | --- | --- |
| GET | `/v1/reports` | `{reports}` owned submissions |
| GET | `/v1/reports/{id}` | `{report, evidence}` owner or authorized moderator/resolver |
| POST | `/v1/reports/{id}/withdraw` | `{report}`; owner; submitted/under_review/published only |
| GET | `/v1/admin/reports` | `{reports}`; reports.moderate |
| POST | `/v1/admin/reports/{id}/review` | `{status, note}` -> `{report}`; reports.moderate |

Staff review accepts under_review/published/rejected. Submitted and under_review
can transition to the appropriate other review/terminal states; published can
move to under_review or rejected. Withdrawn/rejected records cannot be reopened
by review. Self-review and claimed-business conflicts are blocked.

Report fields: user_report_id, entity_id, submitted_by_user_id, report_category,
title, description, incident_at, status, submitted_at, reviewed_at,
reviewed_by_user_id, moderation_note. Private detail evidence fields:
report_evidence_id, media_id, evidence_note, created_at.

### Report disputes

JWT-authenticated `POST /v1/reports/{id}/disputes` with
`{"reason":"Explain why this published report is disputed"}` returns **201**
`{dispute}`. Only visible published reports can be disputed; a user cannot create
another active dispute for the same report. Reasons are nonblank, max 5,000.

| Method | Path | Response / rule |
| --- | --- | --- |
| GET | `/v1/disputes` | `{disputes}` owned disputes |
| GET | `/v1/disputes/{id}` | `{dispute}` owner or disputes.resolve |
| POST | `/v1/disputes/{id}/withdraw` | `{dispute}`; owner; submitted/under_review only |
| GET | `/v1/admin/disputes` | `{disputes}`; disputes.resolve |
| POST | `/v1/admin/disputes/{id}/review` | `{status, note, report_action?}` -> `{dispute}` |

Staff status accepts under_review/resolved/rejected. When resolving, require
report_action=keep or unpublish; other statuses must omit it. Unpublishing also
requires reports.moderate and moves the associated report to under_review.
Self-review, disputes about one's own report and claimed-business conflicts
are rejected. Terminal disputes cannot be reopened.

Dispute fields: dispute_id, user_report_id, filed_by_user_id, reason, status,
reviewer_user_id, decision_note, created_at, updated_at, resolved_at.

## Completed-investigation sharing

Only owners can manage shares, including when a staff user can read all
investigations. Creation requires investigations.create plus an investigation
read permission, a completed result and explicit sensitive-content acknowledgment.

`POST /v1/investigations/{investigation_id}/share-links`:

```json
{ "acknowledge_sensitive_content": true, "ttl_seconds": 604800 }
```

Returns **201** `{share, token}`. share fields: share_link_id,
investigation_id, created_at, expires_at, revoked_at. **token appears only in
this creation response**; it cannot be recovered from list/detail APIs.
Default expiry seven days, allowed 60 seconds to 30 days, max ten active links.
Offer copying a frontend share URL only when an actual frontend route exists.
Prefer carrying the token in a fragment that the frontend reads and removes,
then send it to the API in the JSON body; do not send it as an API query string.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/v1/investigations/{investigation_id}/share-links?limit=20&offset=0` | `{shares}`; rows add active boolean, no raw tokens |
| POST | `/v1/investigations/{investigation_id}/share-links/{share_link_id}/revoke` | `{share}`, idempotent for an already revoked share |
| POST | `/v1/shared-investigations/resolve` | Public `{token}` -> `{investigation, findings, findings_truncated, limitations}` |

Resolve returns a limited completed-result view. Investigation fields:
investigation_type, title, result_summary, completed_at. Finding fields:
finding_id, finding_type, category, title, explanation, confidence,
verification_status, display_order, sources, hidden_evidence_count. Public source
fields: source_id, url, title, publisher, fetched_at, support_type, evidence_note.
Private evidence, signed uploads, prompts, input data, user IDs and model-run
records are excluded. Summaries themselves may still contain sensitive text.
At most 100 findings are returned; findings_truncated indicates more exist.
Invalid, expired, revoked or otherwise unavailable shares all return
`404 share_unavailable`. Show one unavailable screen without distinguishing them.

## Roles, permissions and AI registry

Default roles are user, support, moderator, verifier, admin and superadmin.
Accounts may hold multiple roles. Render UI capabilities from `/v1/auth/me`:

```ts
const can = (user: { roles: string[]; permissions: string[] }, permission: string) =>
  user.permissions.includes(permission) ||
  (user.roles.includes('superadmin') && user.permissions.includes('*'));
```

| Capability | Permission |
| --- | --- |
| Create/cancel/retry investigations | investigations.create, plus ownership for actions |
| Read own / all investigations | investigations.read_own / investigations.read_all |
| Submit reports | reports.submit |
| Moderate reports | reports.moderate |
| Resolve disputes | disputes.resolve |
| Manage businesses / publication | businesses.manage / directory.manage |
| Review verification | verifications.review |
| Manage media | media.manage |
| Read roles | roles.read |
| Grant roles | roles.manage and superadmin role |
| Configure research registry | ai_config.manage |

Some permission seeds, including users.manage and audit.read, exist without
corresponding HTTP APIs. Do not build fictitious users-management/audit endpoints
because a permission name appears in the session.

`GET /v1/admin/roles` returns `{roles}`; each role includes role_id, role_key,
display_name, description and permissions. Superadmin-only
`POST /v1/admin/users/{users_id}/roles` with `{"role_key":"support"}` returns
`{"granted":true}` or false if already granted. No role revoke endpoint exists.

AI registry requires ai_config.manage. For each of providers, models, agents,
tasks, tools, assignments, the implemented URLs are:

- `GET /v1/admin/ai/{resource}?limit=50&offset=0` -> `{entries}`.
- `POST /v1/admin/ai/{resource}` -> **201** `{entry}`.
- `PATCH /v1/admin/ai/{resource}/{id}` -> **200** `{entry}`.

The path resource is one of the six literal names above, not an arbitrary
backend table. Read exact per-resource writable fields and enums from the
generated reference. `GET /v1/admin/ai/agent-tools?agent_id=...&limit=50&offset=0`
returns `{entries}`; `POST /v1/admin/ai/agent-tools` with
`{agent_id, tool_id, is_enabled?}` returns **200** `{entry}`.

Registry IDs: provider_id/model_id/agent_id/task_id/tool_id/assignment_id.
Supported provider: gemini. Supported task: investigation_analysis. Supported
tools: ultrasearch_search, public_url_fetch, pdf_extract. Tool types must match
their adapter. Credential references accept only supported environment names;
only superadmins can set them, and other admins see credential_configured instead
of credential_secret_ref. Never accept/store actual API keys in registry forms.
Changing instructions_template requires a different prompt_version. Lower
assignment priority runs first; an enabled priority is unique for each task.
There are no delete registry endpoints.

## Health, readiness and current limits

`GET /health` -> `{"status":"ok","service":"padicheck-backend"}` proves
liveness only. `GET /ready` checks database/readiness and returns background_jobs,
media_storage, research, email_signup and google_signin configuration indicators.
Those flags do not prove real SMTP delivery, Google consent or Cloudinary
connectivity. Read [deployment.md](deployment.md) for backend startup setup.

| Feature | Required backend services |
| --- | --- |
| Signup OTP / account email verification | PostgreSQL, Redis and SMTP |
| Password login / JWT and RBAC | PostgreSQL and JWT secret; production requires Redis revocation |
| Google sign-in | PostgreSQL, Redis, GOOGLE_CLIENT_ID and actual Google token flow |
| Uploads / signed media | Cloudinary configured server-side |
| Background collection | Redis/BullMQ and a running worker |
| Independent search and AI | RESEARCH_ENABLED, UltraSearch, Gemini and valid registry routing |
| Billing | Implemented, disabled by default; requires approved migration, Bachs credentials, configured offers and explicit BILLING_ENABLED=true |

Currently unavailable: password reset, passwordless OTP login, refresh tokens,
profile editing, Google unlink, user list/suspension APIs, audit-list APIs,
real-time streaming, generated report/PDF downloads, automated refund issuance,
automatic failed-investigation credit refunds and direct in-app subscription
plan changes. Subscription self-service uses the provider portal. Do not label
intended capabilities as implemented.

## Bachs payments: one-time purchases and subscriptions

The integration is implemented behind `BILLING_ENABLED=false` by default.
The approved six-table migration is separate from the unchanged supplied SQL.
No merchant prices/products are seeded and no live/sandbox charge has been
performed. Read [payments.md](payments.md) for backend configuration and
operational limitations before enabling collections.

| Method | URL | Access and result |
| --- | --- | --- |
| GET | `/v1/billing/offers` | Public; `{enabled, offers}` |
| GET | `/v1/billing/me` | JWT; `{enabled, available_units, subscriptions}` |
| POST | `/v1/billing/checkouts` | JWT + verified email; 201 `{checkout}` |
| GET | `/v1/billing/checkouts/{id}` | JWT; owned local checkout; `{checkout}` |
| POST | `/v1/billing/portal` | JWT; owned local subscription; `{url}` |
| POST | `/v1/webhooks/bachs` | Bachs only; signed raw request; 202 `{received:true}`; never call from frontend |

When disabled, offers returns `{"enabled":false,"offers":[]}` and `/billing/me`
returns `{"enabled":false,"available_units":0,"subscriptions":[]}`. Hide
purchase controls then; investigation creation retains its existing behavior.
When enabled, every new investigation requires one available unit and otherwise
returns 402 payment_required. Retrying the same failed investigation is free.
Existing records remain readable. There is no staff exemption from paid creation.

An offer contains offer_key, display_name, billing_mode (one_time/subscription),
currency (USD/NGN; subscriptions USD), amount (decimal currency string) and
investigation_units. A subscription offer's units apply per paid invoice period;
unused units expire. One-time units have no expiry in this milestone. These are
not unlimited subscriptions. Amounts are not integer minor units.

To purchase, generate a UUID request key once for the purchase attempt:

```json
{ "offer_key": "<key returned by offers>", "request_key": "00000000-0000-4000-8000-000000000007" }
```

Send it to `POST /v1/billing/checkouts` and retain the same key on retries; using
it for another offer gives 409 idempotency_conflict. Client-supplied price,
currency, user ID, provider product and redirect URLs are not accepted. A legacy
unverified account must complete email verification first.

The 201 response has the following shape (values are illustrative, not seeded):

```json
{
  "checkout": {
    "billing_checkout_id": "00000000-0000-4000-8000-000000000008",
    "offer_key": "single-investigation",
    "billing_mode": "one_time",
    "amount": "10.000000",
    "currency": "USD",
    "investigation_units": 1,
    "status": "open",
    "checkout_url": "https://sandbox-checkout.bachs.io/c/example",
    "provider_checkout_id": "chk_example",
    "expires_at": "2026-10-19T11:00:00.000Z",
    "paid_at": null,
    "created_at": "2026-10-19T10:00:00.000Z"
  }
}
```

Save the local billing_checkout_id and navigate to checkout_url only while its
status is open. An idempotent retry can return an already paid/expired checkout;
show its existing state instead of redirecting to an old URL. On return,
ignore any claim that the browser query proves payment: poll
`GET /v1/billing/checkouts/{billing_checkout_id}` and `/v1/billing/me` until
payment/allowance processing completes or the checkout expires. The provider's
checkout_id appended to the return URL is a different identifier from the
local UUID. Retain the local ID in transient purchase state (or sessionStorage
for this non-secret ID) before leaving. Do not put the API token in the URL.

Local status can be creating/open/paid/expired/failed/refunded; failed/refunded
are reserved/reconciliation states, not proof of an automated refund feature.
Checkout status paid may precede an invoice grant for subscriptions. Wait for
the balance/subscription response to reflect fulfilled allowance, and allow a
pending state for delayed/review-required events. Do not automatically open a
new checkout after a timeout. `409 checkout_requires_reconciliation` requires
support reconciliation of an old uncertain attempt.

Subscription summaries contain billing_subscription_id, provider_status,
current_period_start, current_period_end and cancel_at_period_end. Send
`{"billing_subscription_id":"<local UUID>"}` to `/v1/billing/portal` for a fresh
provider-hosted management URL. It carries a credential: do not log/persist it.
Portal price changes/proration are not supported by automatic allowance mapping
in this milestone; maintain fixed-price mapped plans. Billing state remains
authoritative on the backend; do not infer access from provider_status alone.

Superadmin billing screens use GET/POST `/v1/admin/billing/offers`, PATCH
`/v1/admin/billing/offers/{id}`, GET `/v1/admin/billing/events`, GET
`/v1/admin/billing/grants`, and POST `/v1/admin/billing/grants/{id}/revoke`.
Lists use standard limit/offset pagination. Exact request schemas are in the
generated reference. Offer price/product/mode/units are immutable; PATCH permits
display_name and is_enabled only. Revocation needs a nonblank note and is audited.

## Frontend acceptance checklist

1. Signup shows OTP only after 202; no protected navigation until verification.
2. Leading-zero codes work, resend replaces the challenge, cooldown/expiry/error
   states are visible, and account-existence responses are not misrepresented.
3. Password and Google sessions load `/me`; expired/revoked tokens clear private
   caches. Link-required Google responses route to login and explicit linking.
4. Upload uses one FormData file with no manually set multipart Content-Type;
   documents open through fresh delivery URLs and unsupported/oversized files
   show the correct API error.
5. Investigation list uses opaque cursor pagination; detail polls and stops on
   terminal states, handles deferred dispatch and disabled analysis honestly.
6. Sources/findings preserve evidence and limitations; reports stay separate
   from AI findings and staff verification decisions.
7. Wrong-owner/permission errors show an appropriate screen. Directory uses
   business_profile_id, submissions use the correct entity/media/request IDs.
8. Sharing stores no recoverable token in list state, handles revoked links and
   uses JSON-body redemption. Private evidence never appears in anonymous UI.
9. All request paths/bodies match the generated API reference. No unsupported
   endpoint is called; no backend credentials are exposed by frontend config.

Regenerate the offline API files with `npm.cmd run docs:export` and verify they
match registered routes with `npm.cmd run docs:check`. The export is offline and
does not connect to PostgreSQL or external providers.
