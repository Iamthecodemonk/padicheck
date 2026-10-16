# Milestone 5: investigation sharing

Owner-managed, expiring, revocable bearer capabilities for completed investigation
results. Backend only; there is no share webpage or frontend URL builder.

## Schema and policy

The supplied schema remains unchanged. This feature uses
`investigation_share_links.share_link_id/investigation_id/created_by_user_id/
token_hash/expires_at/revoked_at/created_at`, including its unique hash and cascade
foreign keys. Access checks use investigation ownership/status, active `users`,
and the existing RBAC tables. Shared content comes from `investigations`,
`findings`, `finding_sources`, `sources`, and `investigation_sources`. Creation and
revocation are recorded transactionally in `admin_audit_logs`.

Only the owner can create, list or revoke shares. An administrator's
`investigations.read_all` does not grant the right to share someone else's
investigation. Creation requires `investigations.create` and either
`investigations.read_own` or `investigations.read_all`; superadmin wildcard access
is recognized consistently with existing authorization. List/revoke require an
active owner but remain available if investigation permissions are removed.

Only `completed` investigations can be shared. Validity is checked against live
data on every redemption: owner still active, still owns the investigation, still
has create/read access, investigation still completed, link not revoked, and
expiration still in the future. Nonexpiring legacy links and links with a lifetime
above 30 days fail closed. Restoring account permissions/status can make an
otherwise unexpired link usable again; revoke a link for permanent invalidation.

## API

Create with the owner's normal JWT:

```http
POST /v1/investigations/<investigation_id>/share-links
Authorization: Bearer <access_token>
Content-Type: application/json

{"acknowledge_sensitive_content":true,"ttl_seconds":604800}
```

`ttl_seconds` defaults to 604800 (seven days), with a minimum of 60 seconds and
maximum of 2592000 (30 days). Null/indefinite expiration is not accepted. At most
10 unrevoked, unexpired shares may exist per investigation; exceeding the cap
returns `409 share_limit_reached`. Revoke an existing share to free a slot.

Creation returns HTTP 201 with `{share, token}`. `share` contains its UUID,
investigation UUID, creation/expiration/revocation timestamps. **`token` is returned
only at creation.** It is 32 cryptographically random bytes encoded as 43
base64url characters. PostgreSQL stores only its SHA-256 digest. Neither raw token
nor digest is included in audit snapshots or list responses. If the response is
lost, list/revoke the resulting share and create another; there is no token
recovery endpoint.

```http
GET /v1/investigations/<investigation_id>/share-links?limit=20&offset=0
Authorization: Bearer <access_token>
```

Returns `{shares}` with metadata only. Pagination is bounded to 100 rows, offset
10000, with stable descending creation-time/UUID order. The `active` metadata flag
describes expiration/revocation only; live account/permission/status checks also
apply when redeeming.

```http
POST /v1/investigations/<investigation_id>/share-links/<share_link_id>/revoke
Authorization: Bearer <access_token>
```

Revocation is idempotent and returns `{share}`. A repeated revocation preserves
the timestamp and does not create another audit record. No endpoint extends a
share or reverses revocation; create a new share instead.

Recipients redeem without a PadiCheck account:

```http
POST /v1/shared-investigations/resolve
Content-Type: application/json

{"token":"<secret returned at creation>"}
```

Send the secret in the body, never a path, query parameter or application JWT.
The resolver rejects query parameters, does not redirect, and returns a bounded
JSON result. Invalid/unknown/revoked/expired/unavailable canonical secrets return
the same `404 share_unavailable`. Requests outside the body-size/type/schema
constraints return the usual 400/413 response.

Creation is limited to 10 requests/minute/IP; revocation and redemption each to
30/minute/IP. This uses the existing per-process rate limiter; centralized edge
limits for multiple API instances remain deployment work. Management and
redemption responses, including errors, send `Cache-Control: no-store`,
`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive` and
`X-Content-Type-Options: nosniff`.

## Shared content and privacy

Sharing deliberately authorizes disclosure of the investigation title, result
summary and finding text. Those fields can contain names or sensitive text
derived from private documents. They are **not automatically redacted**.
`acknowledge_sensitive_content: true` is required and recorded in the creation
audit event. The owner should review the result before issuing a capability.
Anyone receiving or forwarding the token can read this content until it becomes
unavailable. Revocation cannot erase a recipient's saved copy.

The result contains investigation type/title/summary/completion timestamp and at
most 100 findings ordered by display order/UUID. `findings_truncated` indicates
additional findings. Findings include type, category, title, explanation,
confidence, stored verification status, display order and evidence references.
AI-generated findings remain unverified under the existing research pipeline.

An evidence reference is included only when the source is explicitly `public`,
has no media association, is a web page/user-provided link, and is linked to this
same investigation. It contains the source UUID, URL/title/publisher/fetch time,
support type and evidence note. Unsafe literal/local/credential-bearing URLs and
query-bearing URLs are excluded; fragments are removed. No DNS resolution or
external HTTP request occurs during redemption. This is URL syntax filtering,
not verification of the linked site's current safety or accuracy.

Each finding includes `hidden_evidence_count`. Private/restricted source details,
uploaded documents (even if mistakenly marked public), unrelated sources,
source excerpts/metadata, prompts, input JSON, private entity identifiers,
user identities, model execution details, Cloudinary IDs and delivery URLs are
not part of the shared DTO. Tokens cannot authenticate to normal investigation
or media APIs. A share never changes source visibility, and the research pipeline
continues to create private sources by default. Consequently a shared finding
may have all its evidence hidden; the response explains that limitation.

Shares read the current completed result rather than a frozen snapshot. The
schema has no share-specific field grants, recipient identity, read counters,
immutable snapshots or per-link redaction policy. These are not invented in
JSON columns or new tables. A future richer sharing policy requires schema
review. No email/message is sent, and no public webpage is published.

## Concurrency and auditing

Creation locks the investigation row before counting/inserting shares, preventing
concurrent requests from exceeding the active cap. Revocation locks investigation
then share. Redemption follows the same order using shared locks, avoiding a
read/revoke deadlock. Expiration and access are checked again before returning
the DTO. After a revocation commits, subsequent redemption fails; an already
authorized response may finish before revocation takes effect.

Creation/revocation audit writes share their transaction with the state change.
Audit failure rolls it back. Normal request logs include neither request/response
bodies nor bearer tokens; the test suite checks the configured logging behavior.
Infrastructure/body logging outside this application must likewise avoid secrets.

## Files and validation

Added `src/modules/sharing/routes.ts`, `src/modules/sharing/service.ts`,
`tests/sharing.test.ts`, `scripts/smoke-sharing.ts` and this document. Updated
`src/app.ts` for route registration/readiness, `package.json` for `sharing:smoke`,
and README. No environment variables, dependencies, schema migrations, provider
calls or existing local secrets were added/changed.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run db:verify
npm.cmd run sharing:smoke
```

The live smoke command requires CREATEDB and creates/drops only its generated
scratch database. It applies the supplied baseline, verifies the concurrent
active-link cap with real sessions, then queues a revocation ahead of a redemption
behind an independent row lock and confirms the redemption fails after revocation.
It inspects lock waits through `pg_stat_activity` and makes no external provider
calls. The configured application database is not reset.

Verification results:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd test`: all **91 tests passed**, including nine sharing scenarios
  covering ownership, secret storage, response privacy, expiration/revocation,
  live account/permission changes, audit rollback, logging, limits and throttling.
- `npm.cmd run db:verify`: passed; no schema drift or application database writes.
- `npm.cmd run sharing:smoke`: passed against real PostgreSQL. Concurrent creates
  respected the active-link cap; redemption queued behind revocation failed as
  expected. Its generated scratch database was removed.
- `git diff --check`: passed, with only Git line-ending conversion warnings.

No implementation blockers remain. No migrations were necessary. This feature
does not require external providers, and it does not change the outstanding live
Redis/Cloudinary/UltraSearch/Gemini setup requirements from earlier milestones.

Next milestone: deployment readiness and live integration checks for Redis,
Cloudinary, UltraSearch and Gemini, with environment validation, operational
documentation and startup/shutdown checks. Not started here; external testing
will require the relevant services and credentials.
