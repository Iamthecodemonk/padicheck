# Milestone 4: directory and trust workflows

Backend APIs for business listings, evidence-backed business claims, user
allegations, moderation and disputes. No frontend or paid developer API is added.

## Schema alignment

The complete supplied `padicheck_mvp_schema.sql` was re-read before implementation.
Its tables, relationships and constraints support this milestone unchanged. No
migration was added or applied; `001_baseline.sql` remains the supplied schema.

| Feature | Existing tables and columns |
| --- | --- |
| Business listings | `entities.entity_id/entity_type/canonical_name/country_code/city`, `business_profiles.business_profile_id/entity_id/business_category/profile_description/claimed_by_user_id/profile_status` |
| Public identifiers | `identifiers.entity_id/identifier_type/value/visibility`; only `public` rows appear |
| Verification submissions | `business_verification_requests.business_profile_id/submitted_by_user_id/status`, `verification_evidence.verification_request_id/media_id/evidence_type` |
| Verification decisions | Request `reviewed_at/reviewed_by_user_id/decision_note`; profile `claimed_by_user_id` |
| User allegations | `user_reports.entity_id/submitted_by_user_id/report_category/title/description/incident_at/status`; review timestamps, reviewer and moderation note |
| Report evidence | `user_report_evidence.user_report_id/media_id`; private `media_files` metadata |
| Moderation history | `moderation_actions.moderator_user_id/user_report_id/verification_request_id/action_type/note` |
| Disputes | `report_disputes.user_report_id/filed_by_user_id/reason/status/reviewer_user_id/decision_note/resolved_at`; existing update trigger |
| Audit trail | `admin_audit_logs.actor_user_id/action/target_type/target_id/before_state/after_state/request_id` |

Existing timestamps/defaults and triggers are retained. All application values use
parameterized SQL. Evidence files remain authenticated Cloudinary assets; no file
contents or base64 are stored in PostgreSQL.

## API reference

Protected routes require `Authorization: Bearer <access_token>`. All list routes
accept `limit` (1–100, default 20) and `offset` (0–10000, default 0), with stable
timestamp/UUID ordering. Trust, admin and directory responses use `Cache-Control:
no-store`, including public report lists that can be withdrawn or unpublished.

| Method and path | Access and behavior |
| --- | --- |
| `GET /v1/directory?q=&category=` | Anonymous; published business summaries only, literal name substring and exact category filters |
| `GET /v1/directory/:id` | Anonymous; published profile, public identifiers, latest completed verification review status/date and limitations |
| `GET /v1/directory/:id/reports` | Anonymous; published allegations for a published business only; includes `is_disputed` for active disputes |
| `GET /v1/admin/businesses` | `businesses.manage`; includes draft/hidden entries |
| `POST /v1/admin/businesses` | `businesses.manage`; creates a draft listing and new business entity, or links an existing business entity |
| `PATCH /v1/admin/businesses/:id` | `businesses.manage`; edits category/description only |
| `POST /v1/admin/businesses/:id/publication` | `directory.manage`; `{status: draft\|published\|hidden, note}` |
| `POST /v1/verifications` | Active authenticated account; `{business_profile_id, media_ids}`; 1–10 evidence uploads |
| `GET /v1/verifications` | Own verification requests |
| `GET /v1/verifications/:id` | Submitter or `verifications.review`; includes evidence IDs |
| `GET /v1/admin/verifications` | `verifications.review`; review queue |
| `POST /v1/verifications/:id/withdraw` | Submitter; pending/in-review requests only |
| `POST /v1/admin/verifications/:id/review` | `verifications.review`; `{status: in_review\|approved\|rejected, note}` |
| `POST /v1/reports` | `reports.submit`; creates a private submitted allegation |
| `GET /v1/reports` | Own reports |
| `GET /v1/reports/:id` | Submitter or report/dispute review staff; includes evidence IDs |
| `GET /v1/admin/reports` | `reports.moderate`; review queue |
| `POST /v1/reports/:id/withdraw` | Submitter; submitted, under-review or published reports |
| `POST /v1/admin/reports/:id/review` | `reports.moderate`; `{status: under_review\|published\|rejected, note}` |
| `POST /v1/reports/:id/disputes` | Active authenticated account; `{reason}`; report must be visible and published |
| `GET /v1/disputes` | Own disputes |
| `GET /v1/disputes/:id` | Filer or `disputes.resolve` |
| `GET /v1/admin/disputes` | `disputes.resolve`; review queue |
| `POST /v1/disputes/:id/withdraw` | Filer; submitted/under-review disputes |
| `POST /v1/admin/disputes/:id/review` | `disputes.resolve`; `{status: under_review\|resolved\|rejected, note, report_action?}` |

The directory `:id` is a **business_profile_id**, not an entity ID. Review IDs are
the relevant request/report/dispute UUIDs.

Create a business as an admin:

```json
{
  "canonical_name": "Example Services",
  "business_category": "professional_services",
  "profile_description": "Directory description reviewed by staff.",
  "country_code": "NG",
  "city": "Lagos"
}
```

Alternatively provide `entity_id` and category/description to attach an existing
business entity. Do not supply a new name/location with an existing entity ID.
Attaching an existing entity does not publish its private identifiers. Duplicate
profiles are rejected. Ownership and publication status cannot be supplied in
creation/edit payloads.

Submit a report after obtaining an entity ID from a published directory entry or
one of your investigation targets:

```json
{
  "entity_id": "<entity UUID>",
  "report_category": "service_experience",
  "title": "Description of my experience",
  "description": "A specific user-submitted allegation for staff review.",
  "incident_at": "2026-10-01T10:00:00Z",
  "media_ids": ["<owned ready private media UUID>"]
}
```

`incident_at` and report evidence are optional. Evidence arrays accept at most
10 unique UUIDs. Business verification requires at least one upload. Text and
request sizes are bounded; whitespace-only text and unknown fields are rejected.

## Review policies and transitions

- Listings start `draft`. Publication requires a separate `directory.manage`
  action and audit note. Verification approval never changes publication state.
- Users can request verification of an unclaimed published business or their
  already claimed business. A business claimed by someone else returns 409.
  Approval atomically assigns `claimed_by_user_id` to the submitter. Competing
  applications can be reviewed, but only a compatible claim can be approved.
  Active duplicates by the same submitter/business are rejected.
- Verification transitions: `pending -> in_review/approved/rejected/withdrawn`;
  `in_review -> approved/rejected/withdrawn`. Final decisions cannot be rewritten
  through this API. New evidence requires a new request after a final decision.
- Report transitions: `submitted -> under_review/published/rejected/withdrawn`;
  `under_review -> published/rejected/withdrawn`; `published -> under_review/
  rejected/withdrawn`. Rejected/withdrawn reports are final. Returning a report to
  review immediately removes it from public results.
- Disputes apply to published reports accessible through the directory or owned
  by their submitter. Active duplicate disputes by the same filer/report are
  rejected. Transitions: `submitted -> under_review/resolved/rejected/withdrawn`;
  `under_review -> resolved/rejected/withdrawn`. Final disputes cannot reopen.
- A `resolved` dispute requires `report_action: keep` or `unpublish`. Other
  statuses must omit that field. `unpublish` additionally requires
  `reports.moderate`, and atomically returns a currently published report to
  `under_review`. Resolution never automatically deletes a report or republishes
  withdrawn/rejected reports.
- Staff cannot review their own submissions. Claimed owners cannot moderate
  reports or resolve disputes about their own business. Dispute reviewers also
  cannot adjudicate disputes about their own reports. These restrictions apply
  to superadmins too; another reviewer is needed.
- Verification/report decisions write `moderation_actions` and
  `admin_audit_logs` within the same transaction as the decision. Dispute
  decisions write audit records; an unpublication also writes the report's
  moderation history and audit record. Audit failure rolls back all changes.

Row locks serialize duplicate submissions, verification decisions, and report
review/dispute transitions. Business ownership checks hold profile locks until
commit. Evidence linkage locks upload rows in stable UUID order, matching the
existing media-deletion lock and protecting against deletion/linking races. No
new uniqueness constraints have been invented.

## Privacy and limits

Evidence must belong to the submitter and be ready, private, authenticated
Cloudinary media. Verifiers can read/deliver media linked to verification
evidence; moderators and dispute reviewers can read/deliver media linked to
report evidence. Unrelated uploads remain inaccessible. This extends read and
five-minute signed delivery access only: deletion still requires ownership or
`media.manage`, and linked uploads cannot be deleted.

Public report DTOs omit submitter/reviewer identities, moderation notes and
evidence IDs. The application never publishes evidence files automatically.
Report authors may include personal information in their narrative, so staff
must assess that content before publication. An unverified allegation label and
limitations accompany public reports; these records never create or modify AI
`findings`. Public verification review metadata describes a staff decision,
not proof of legitimacy or a guarantee of conduct.

The existing schema has no claimant membership/transfer history, field-level
redaction, evidence revisions, public report redaction versions, dispute evidence
table, or reviewer assignment system. This milestone does not add them. Business
owners cannot self-edit directory profiles; staff edits remain audited. Ownership
transfer and revoking an approved claim need a separately designed workflow and
schema review. Investigation share links and paid APIs remain unimplemented.

## Files and validation

Added `src/modules/directory/routes.ts`, `src/modules/trust/{routes,shared,
verifications,reports,disputes}.ts`, `tests/trust.test.ts`, and
`scripts/smoke-trust.ts`. Updated app registration/readiness, media read policy,
package scripts, README and this document. No dependencies or secrets were added.

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run db:verify
npm.cmd run trust:smoke
```

The live smoke command requires CREATEDB on the configured role. It creates only
a uniquely generated scratch database, applies the unchanged baseline, exercises
the API with real PostgreSQL sessions, and drops that generated database. It
tests simultaneous duplicate submissions, competing claim approvals, the
moderation/dispute lifecycle and audit rollback. It does not reset the configured
application database or call external providers. Test media are metadata fixtures;
actual uploads/delivery remain covered by the earlier storage adapter tests and
require configured Cloudinary for a live external round trip.

Validation completed:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed on the approved run outside the sandbox. The
  restricted run reported `ENOSPC` while writing generated JavaScript.
- `npm.cmd test`: all **81 tests passed** on the standalone full-suite run,
  including 13 new trust workflow scenarios. An earlier run alongside other
  checks failed two existing PGlite initializations with allocation errors; the
  standalone rerun passed those tests without code changes.
- `npm.cmd run db:verify`: passed before and after implementation; no drift.
- `npm.cmd run trust:smoke`: passed against real PostgreSQL, including concurrent
  duplicate submissions, competing approvals and audit rollback. Its generated
  database was removed.
- `git diff --check`: passed; Git only reported line-ending conversion warnings.

There are no remaining implementation blockers for this milestone. Live
Cloudinary evidence upload/delivery remains untested without provider credentials;
the new reviewer delivery tests use a storage double. Existing research service
configuration requirements from milestone 3 are unchanged.

Next milestone: secure investigation sharing with expiration/revocation using
`investigation_share_links`, followed by deployment readiness and live provider
integration checks. Not started in this milestone.
