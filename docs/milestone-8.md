# Milestone 8: API handoff and Bachs billing

Completed 19 October 2026. Backend only; no frontend implementation or deployment.

## Delivered

- Swagger/OpenAPI for every registered application route, with JWT Authorize,
  upload file input, OTP examples, response envelopes and route coverage check.
- [Frontend handoff](frontend-integration.md) with a copyable AI prompt, URLs,
  request/response examples, browser proxy/auth conventions, IDs, pagination,
  polling, role restrictions and unsupported features.
- Offline [API reference](api-reference.md) and [OpenAPI export](openapi.json),
  generated from the actual application. The snapshot covers **87 operations**.
- Bachs one-time checkouts and subscription-period investigation allowances;
  owned/idempotent checkout APIs, verified durable webhook inbox, API background
  processing, customer portal and audited superadmin offer/grant management.
- Investigation-unit consumption in the same transaction as creation, with
  ownership/environment checks and retry of the same investigation at no extra
  unit cost. Billing remains disabled until explicitly configured/enabled.

## Schema authorization and application

The complete supplied SQL was re-read. It has no billing data model. A separate
six-table proposal was presented, and the user approved proceeding with that
extension and configurable one-time/subscription allowances. The approved
`db/migrations/003_billing.sql` was then applied to the development database.
The root schema, original baseline and existing tables were not edited.
No merchant offers, prices, credentials or payment records were inserted into
the main database by tests or migration.

The new explicit billing migration command does not overwrite a partial schema.
The verifier compares installed extension definitions alongside the exact
baseline; a baseline-only installation remains supported while billing is off.

## Main files

- `src/documentation.ts`, `tests/documentation.test.ts`, Swagger dependencies in
  package.json/package-lock.json, and registration in `src/app.ts`.
- `src/adapters/bachs.ts`, `src/modules/billing/{types,verification,service,routes}.ts`.
- `src/config.ts`, `.env.example`, `src/logger.ts`, and runtime integration probes.
- Investigation routes/service for optional transactional unit consumption.
- `db/migrations/003_billing.sql`, original approved proposal, billing migration
  script and schema-verifier extension.
- `scripts/export-api-docs.ts`, `scripts/smoke-billing.ts`, `tests/billing.test.ts`,
  runtime test probe update, README and frontend/payment documentation.

## Commands and results

| Command | Result |
| --- | --- |
| npm.cmd run typecheck | Passed |
| npm.cmd run build | Passed |
| npm.cmd test | **129 passed, zero failed**, final full run |
| node --import tsx --test tests/billing.test.ts tests/documentation.test.ts | Passed during focused verification |
| npm.cmd run db:verify | Passed before installing the extension |
| npm.cmd run db:billing-migrate | Applied approved 003 |
| npm.cmd run db:verify -- --billing | Passed, no drift |
| npm.cmd run billing:smoke | Passed against real PostgreSQL, scratch database removed |
| npm.cmd run docs:export | Exported 87 operations |
| npm.cmd run docs:check | Snapshot current |
| npm.cmd run integrations:check | Database passed; other providers unconfigured; research/billing disabled |
| git diff --check | Passed |

Tests cover raw-byte signature tampering, replay-age rejection, multiple V2
signatures, environment/key mismatch, ownership, idempotency, unconfirmed reads,
amount mismatch, duplicate events/period grants, invoice-before-subscription
ordering, grant failure rollback/retry, lost checkout mapping recovery, expiry,
revocation and free investigation retry. The real PostgreSQL smoke forces both
investigation inserts to happen before they compete for the last allowance,
verifying that exactly one succeeds and the other rolls back without a deadlock.
No Bachs API was called and no email was sent by these tests.

## Activation blockers and next milestone

Actual Bachs merchant credentials, mapped products/prices, webhook destination,
return URLs and live sandbox acceptance remain unconfigured. Redis/SMTP/Google,
Cloudinary and research providers also require their existing private setup for
the corresponding frontend flows; the handoff documents their 503/disabled states.

Refund issuance, automatic refund/chargeback entitlement reversal, plan-change
proration and automatic credit restoration for failed work are not implemented.
Reversal events require staff reconciliation and audited grant revocation.
See [payments.md](payments.md) before enabling live billing.

Next: configure the merchant sandbox and verify a real hosted checkout, signed
webhook and subscription renewal; settle the reversal/refund policy before live
activation. Frontend implementation can begin from the handoff independently.
Those external acceptance actions and frontend work were not started here.
