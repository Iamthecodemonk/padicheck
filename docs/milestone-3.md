# Milestone 3: UltraSearch, Gemini, extraction, and evidence-backed findings

The user selected the self-hosted UltraSearch repository at
https://github.com/Ramcharan747/UltraSearch and Gemini. The existing
Fastify/TypeScript modular monolith and BullMQ worker
were extended; no schema migration or model-ID replacement was needed.

## Tables and behavior

Before implementation, the schema and live database were checked. The following
existing fields support this stage:

| Tables | Use |
| --- | --- |
| `sources`, `investigation_sources` | URLs, uploaded media references, title, excerpt, content hash, actual retrieval timestamps, visibility, metadata, discovery method, rank and `used_in_analysis` |
| `ai_providers`, `ai_models` | Provider code, external secret reference, provider model identifier, active status, safe generation/pricing configuration |
| `ai_agents`, `ai_task_types`, `ai_task_assignments` | Agent instructions and prompt version, enabled backend task, enabled priority assignments and overrides |
| `ai_tools`, `ai_agent_tools` | Enabled search/fetch/PDF tools and allowed agent-tool relationships |
| `model_runs` | Task/assignment/agent/model IDs, provider/model name, prompt version, status, request ID where returned, tokens, estimated cost, failure code and execution timestamps |
| `findings`, `finding_sources` | Unverified claim/signal/recommendation findings, explanations, confidence, model-run reference, source IDs, support type and exact evidence quotations |
| `investigations`, users/RBAC | Lifecycle, result summary, error code, owner/permission checks and completion timestamps |
| `admin_audit_logs` | Atomic before/after records of registry changes |

The schema supports a prompt version, not an immutable full model-input/output
payload field. This implementation records supported execution metadata and
quoted evidence, without inventing columns or storing payloads in unrelated
tables. Agent instruction edits require a new prompt version and are audited.
Full payload snapshots would need a separately proposed migration if required.

## Enable and configure

1. Deploy the selected UltraSearch service separately using its documentation.
   PadiCheck does not install its crawler/browser stack. Set `ULTRASEARCH_URL` to
   the trusted operator-controlled service URL, e.g. `http://127.0.0.1:8082` for a
   service listening locally. Requests use its documented `GET /search` interface
   with `ai_mode=none`, `content=false`, `engine=google`, and at most five results per query.
   The local registry now enables six focused queries and up to 25 discovered source URLs.
   Rank-zero AI Overview entries are excluded. `ULTRASEARCH_API_KEY` is optional
   bearer authentication for your reverse proxy; it is not a claim that upstream
   UltraSearch natively requires an API key.
2. Put a Gemini API key in `GEMINI_API_KEY` and configure Redis and the worker as
   in milestone 2. Cloudinary credentials are needed for document downloads.
3. Use a superadmin token to create the provider and its secret reference; an
   admin with `ai_config.manage` can configure ordinary routing entries.
4. Set `RESEARCH_ENABLED=true` in the API and worker only after configuration.
   Default `false` retains milestone 2 behavior and makes no research-provider
   calls. Enabled-but-unconfigured work fails with an explicit code rather than
   fabricating findings or silently selecting a model/provider.

All registry requests require `Authorization: Bearer <access_token>`.
Resources use `GET /v1/admin/ai/{resource}` to list, `POST` to create, and
`PATCH /v1/admin/ai/{resource}/{id}` to update. List endpoints accept `limit`
(1–100) and `offset` (0–10000). Responses contain `entry` or `entries`.

Create entries in this order, using returned UUIDs in subsequent requests:

| Resource | Example JSON body (replace placeholders) |
| --- | --- |
| `providers` | `{"provider_code":"gemini","display_name":"Gemini","credential_secret_ref":"env:GEMINI_API_KEY"}` |
| `models` | `{"provider_id":"<provider UUID>","provider_model_id":"<your supported Gemini model ID>","display_name":"Primary analysis model","model_config":{"max_output_tokens":4096}}` |
| `agents` | `{"agent_code":"evidence_reviewer","display_name":"Evidence reviewer","instructions_template":"Identify claims, risks, unclear clauses and questions to ask. Use only supplied evidence and state uncertainty.","prompt_version":"v1"}` |
| `tasks` | `{"task_code":"investigation_analysis","display_name":"Investigation evidence analysis"}` |
| `tools` | `{"tool_code":"ultrasearch_search","display_name":"UltraSearch","tool_type":"external_api","tool_config":{"max_results":5}}` |
| `tools` | `{"tool_code":"public_url_fetch","display_name":"Public URL fetch","tool_type":"internal"}` |
| `tools` | `{"tool_code":"pdf_extract","display_name":"PDF text extraction","tool_type":"internal"}` |
| `assignments` | `{"task_id":"<task UUID>","agent_id":"<agent UUID>","model_id":"<model UUID>","priority":1}` |

For each tool, enable its relationship with
`POST /v1/admin/ai/agent-tools`:
`{"agent_id":"<agent UUID>","tool_id":"<tool UUID>","is_enabled":true}`.
`GET /v1/admin/ai/agent-tools?agent_id=<UUID>` lists relationships. Posting the
same pair updates its enabled flag and writes an audit entry. Other registry
entries can be disabled using their status/is_enabled fields; destructive delete
endpoints are not introduced.

Create additional active model/agent assignments at priorities 2 and 3 for
fallback. Only the first three enabled, active assignments are attempted. The
backend supports the `investigation_analysis` task code; creating arbitrary task
names does not add handlers. Supported provider code is `gemini`. Generation
configuration currently supports `max_output_tokens` (512–8192). Optional model
pricing fields `input_usd_per_million` and `output_usd_per_million` are configured
estimates, not provider billing facts; absent pricing yields a null cost estimate.

Secret references are limited to `env:GEMINI_API_KEY` for the provider and
`env:ULTRASEARCH_API_KEY` for the optional search gateway credential. The resolver
cannot read arbitrary environment names such as `JWT_SECRET`. Ordinary admins
cannot set credential references and see only a configured boolean; raw keys are
never accepted in registry JSON. Configuration objects have explicit field
allowlists. Audit snapshots omit credential references and unsafe config fields.

## Research execution and limits

Search is an external tool, not an AI model. Search requests use bounded query
text from target names/public identifiers or the user prompt. Contract review
does not send the contract or its question to UltraSearch; it uses authenticated
document extraction and Gemini analysis. Queries/excerpts are sent to the
configured providers as part of opted-in processing; provider data handling
depends on the deployed service and Gemini account terms.

The pipeline stores organic search links as private sources, retrieves public
pages through pinned public IP connections, and labels any retained search
snippet as a snippet. Failed page retrieval records a sanitized failure code.
Snippets can remain partial evidence when pages are unavailable; they are not
presented to the model as independently retrieved page text.

DNS answers must all be public unicast addresses. Literal private/reserved IPs,
mapped loopback, credentials in URLs, nonstandard ports, HTTPS downgrades, and
private redirect destinations are rejected. Requests do not forward application
credentials. Up to three redirects, five seconds for DNS, ten seconds per HTTP
request, and a 2 MiB page-body limit are enforced. Static UTF-8 HTML/plain text
is supported; the fetcher does not execute JavaScript or defeat access controls.

Uploaded PDFs are downloaded using authenticated Cloudinary delivery. The
returned bytes are checked against the recorded upload hash where present, then
processed in a separate resource-limited thread with PDF JavaScript evaluation
disabled. Limits are 25 MiB, 50 pages, 15 seconds, and 16,000 text characters.
Image-only PDFs have no OCR fallback; empty/unreadable evidence does not produce
findings. No uploaded bytes or base64 data are written to PostgreSQL.

Gemini receives up to 20 evidence excerpts, each capped at 6,000 characters
within a total 96,000-character excerpt budget,
plus the user question and registered instructions. The request uses structured
JSON output; external source text is explicitly treated as untrusted data.
Each finding must reference one of those source IDs and contain an exact quote
from that supplied excerpt. Validation checks source provenance, not semantic
entailment or truth. Confidence is a model estimate. Findings remain `unverified`
and automated output is never a business/identity/contract verification decision.

An advisory lock on a dedicated PostgreSQL session excludes concurrent research
for one investigation, without holding a database transaction over network work.
Publication checks cancellation, account permissions and active routing again.
Findings, evidence links, successful run state and completion are published in one
transaction. Bad output/provider failure can fall back in priority order; each
attempt retains its execution record. Failed/aborted attempts never publish
partial findings. Interrupted runs are marked `worker_interrupted` on recovery.
Provider requests can repeat after a process/network interruption; usage is not
promised to be exactly once.

With research enabled, reconciliation also considers `analyzing` requests and
resumes completed reference-collection jobs left from milestone 2. It does not
automatically restart exhausted research jobs forever; an owner retry or explicit
operator correction is required. All successful processing ends with
`status=completed`, which means execution finished, not a verified conclusion.

Read results through the existing protected investigation routes, plus:

- `GET /v1/investigations/:investigation_id/findings`: findings with supporting
  URLs/media IDs, exact evidence notes and support type.
- `GET /v1/investigations/:investigation_id/model-runs`: status, model/provider,
  prompt version, tokens, configured cost estimate and sanitized failures.

Both support `limit` and `offset` and require the same owner/read-all permissions
as other investigation reads. Neither exposes provider credentials or full model
prompts. Uploaded evidence still uses the separately authorized media delivery API.

## Changed files and verification

New research modules: `src/modules/research/{types,registry,output,pipeline,admin-routes}.ts`.
New adapters: `src/adapters/{public-web,pdf-text,provider-http,ultrasearch,gemini,research}.ts`.
Existing app/config/worker, database-session support, investigation routes/job
processing/reconciliation, queue continuation, `.env.example`, package files,
test fixtures, and documentation were updated. `scripts/smoke-research.ts` and
three research test files were added; existing queue tests gained continuation
coverage. The schema and both existing migrations were preserved.

Validation commands:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run research:smoke
npm.cmd run db:verify
npm.cmd run db:smoke
```

All 67 tests passed. Type checking, build, schema verification and the existing
live database smoke passed. The research smoke applied the unchanged baseline
to a generated scratch PostgreSQL database, verified advisory-lock exclusion
between two real sessions, then tested registry routing, source enrichment,
execution records, evidence links and duplicate-completion handling using provider
doubles. Its scratch database was removed; the configured app database was not
reset. The PDF test executed the real parser in its worker thread.

HTML parsing, IP validation and PDF dependencies were installed with
`npm.cmd install cheerio ipaddr.js pdfjs-dist --fetch-retries=0 --fetch-timeout=20000`.
The sandbox denied registry access; the approved escalated installation completed
and npm reported zero vulnerabilities.

Live UltraSearch, Gemini, Cloudinary and Redis round trips remain unverified until
the services/credentials are configured. Tests use HTTP/queue/provider doubles
for those integrations. `RESEARCH_ENABLED` stays false in the example and the
existing local environment has not been changed to trigger paid provider calls.

Next milestone: business directory, verification requests, user reports,
moderation and disputes, using the remaining existing schema. Live research
integration should be exercised with the configured services before deployment.

## Implementation references

- [UltraSearch upstream API documentation](https://github.com/Ramcharan747/UltraSearch)
- [Gemini structured output and REST format](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en)
- [Node HTTPS request options](https://nodejs.org/api/https.html)
- [Mozilla PDF.js](https://github.com/mozilla/pdf.js)

## Deeper search configuration (24 October 2026)

The search tool now accepts max_queries (1-8), max_sources (5-30), and max_seconds (30-180), alongside max_results (1-5 per query). The local registry is configured to 6 queries, 5 results per query, 25 discovered URLs and a 180-second collection budget. Omitting max_queries retains one-query compatibility. New operator setup uses the deeper configuration.

Plans cover identity, exact name, official/contact/registration information, reviews/complaints, news/public records and ownership. Tracking duplicates are removed, queries are interleaved and host diversity is preferred. Successfully retrieved pages take precedence over search snippets in analysis. An in-flight bounded request may finish after the collection budget; no new query/fetch starts after it. Partial query failures preserve other sources and are disclosed to the model as limited collection.

Contracts bypass web search. Every query and page fetch still checks account ownership and permitted tools, and result publication still validates active routing and exact source quotations. Deeper search increases coverage rather than certifying identity or truth.
