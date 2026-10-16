# Milestone 2: investigation intake, lifecycle, and submitted references

Scope was confirmed with the user: investigation APIs and background collection
of submitted links/document references. Independent search, document-content
analysis, AI routing, and findings are deferred. The collector leaves successful
requests in `collecting_sources`; it does not pretend analysis has completed.

## Schema alignment

The project schema was reviewed and live verification passed before changes.
No migration, schema modification, or replacement table was needed.

| Existing table | Columns used |
| --- | --- |
| `investigations` | `investigation_id`, `user_id`, `investigation_type`, `title`, `user_prompt`, `input_data`, `status`, `result_summary`, `error_code`, `created_at`, `updated_at`, `started_at`, `completed_at` |
| `entities` | `entity_id`, `entity_type`, `canonical_name` |
| `identifiers` | `identifier_id`, `entity_id`, `identifier_type`, `value`, `normalized_value`, default private `visibility` |
| `investigation_targets` | `investigation_target_id`, `investigation_id`, `entity_id`, `target_role`, `result_rank`, default `is_selected = false` |
| `sources` | `source_id`, `source_type`, `url`, `media_id`, `content_hash`, `visibility`, `metadata`; read optional attribution fields without inventing values |
| `investigation_sources` | `investigation_id`, `source_id`, `discovery_method`, `relevance_rank`, `used_in_analysis`, `added_at` |
| `media_files` | `media_id`, `uploaded_by_user_id`, `upload_status`, `media_type`, `provider_delivery_type`, `visibility`, `sha256` |
| `users`, RBAC tables | Existing active-account checks, role/permission relationships and permission keys |

Targets and identifiers are created with their investigation. No global entity
search API or automatic cross-user entity merge is introduced. `input_data` is
validated user input, not a place for credentials or hidden job state. SQL aliases
for dispatch revision and pagination are derived from existing timestamps; they
are not database columns.

## Queue and recovery

The Redis-backed queue is `padicheck-source-collection-v1`; job IDs use the
investigation UUID. PostgreSQL is authoritative for ownership, inputs, and
lifecycle. Creation commits before enqueueing. Dispatch failure returns 202 with
`dispatch = deferred`, so clients should keep the returned ID rather than submit
the same investigation again.

The worker reconciles queued/collecting rows in ascending keyset pages of 100,
then starts a new scan. Its default interval is ten seconds. A queue outage cannot
roll back an accepted investigation or permanently lose its dispatch. Recovery
requires Redis and a running worker; there is no in-memory job fallback.

The queue allows three attempts with exponential backoff. Deterministic input,
account, and permission failures are recorded in PostgreSQL immediately. Exhausted
unexpected failures are marked `source_collection_failed`; reconciliation repairs
missed failure writes. Timestamp revisions prevent late failure notifications
from overwriting a newer owner retry. A finished job is restarted only for a new
queued request revision. The worker stamps that revision before collecting, so
dispatch does not have an update-then-requeue crash window.

Collection locks the investigation row, checks the owner's current account and
permissions, validates/locks uploaded documents, and writes sources and links in
one transaction. Duplicate delivery reuses existing investigation-scoped source
links. Cancellation is serialized by the same investigation lock; cancelled,
completed, or missing requests are ignored by collection jobs. The owner can
cancel queued/collecting/analyzing requests and retry failed ones. Staff read-all
access grants no cross-user mutations.

Completed queue jobs are retained up to one day/10,000 jobs; failed jobs up to
seven days/10,000 jobs. An expired/lost collection job can be recreated from the
database and replayed safely. Source collection completion is derived from the
persisted source links and request state, not from a Redis-only flag. Existing
`updated_at` triggers retain their intended behavior. Successful collection does
not set `completed_at` or write an investigation result summary.

The worker drains active work on SIGINT/SIGTERM, with a 30-second shutdown
deadline. API queue calls have a bounded wait; any late dispatch is safe because
jobs are deduplicated and the collector checks the current database status.

## Files

- `src/modules/investigations/`: request/input types, validation/normalization,
  transactional creation, protected routes, collection, job processing, recovery.
- `src/adapters/investigation-jobs.ts`: BullMQ transport, deduplication and retry.
- `src/workers/source-collection.ts`: worker entrypoint and graceful shutdown.
- `src/app.ts`, `src/config.ts`, `.env.example`: wiring, readiness and worker settings.
- `package.json`, `package-lock.json`: BullMQ dependency and worker run commands.
- `tests/investigations.test.ts`, `tests/investigation-jobs.test.ts`: permissions,
  reference collection, retries, outage recovery, rollback and pagination coverage.
- `scripts/smoke-database.ts`: live PostgreSQL investigation smoke checks, using
  rollback-only rows and an injected queue so no test IDs enter a real Redis queue.
- `README.md`, this document: API, schema mapping and run instructions.

## Verification and limits

Commands: `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test`,
`npm.cmd run db:verify`, and `npm.cmd run db:smoke`. BullMQ was installed through
`npm.cmd install bullmq --fetch-retries=0 --fetch-timeout=20000`; network access
required sandbox escalation. No new migration was applied because schema
verification found no drift and this slice adds no schema objects.

The full suite passed all 45 tests. Type checking and build passed. Live
PostgreSQL smoke checks passed for auth/RBAC, readiness, creation, target and
identifier persistence, source collection, source reads, and cancellation. All
smoke writes were rolled back. Live schema verification passed again afterward.

Redis remains unconfigured in the local environment. Queue adapter behavior is
tested with a transport double; worker processing and reconciliation execute
against embedded PostgreSQL, and collection also runs against live PostgreSQL.
A real BullMQ/Redis worker round trip and multi-process outage recovery have not
yet been exercised. Configure `REDIS_URL` before using background processing.
Cloudinary live-test limitations from milestone 1 remain unchanged.

Next milestone: independent source search/fetching and document extraction,
then registry-driven AI analysis with evidence-linked findings. These require
configured provider adapters and credentials. No such processing was started here.
