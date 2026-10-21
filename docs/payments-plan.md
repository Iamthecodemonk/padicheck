# Bachs billing integration: approved design record

Status: **approved and implemented; disabled until configured**. The user selected Bachs and confirmed
both one-time purchases and subscriptions. The supplied baseline SQL contains no
payment, subscription, allowance or usage tables. Following the earlier
instruction to preserve the supplied schema and stop on mismatches,
the additive extension was presented separately and explicitly approved on
19 October 2026. The approved migration was applied to the local development
database. Current API/configuration instructions are in [payments.md](payments.md).

The original review SQL is [003_billing.sql](../db/proposals/003_billing.sql).
The approved executable version is in `db/migrations/003_billing.sql`. It does not replace or edit
`padicheck_mvp_schema.sql`, existing tables, permissions or routes. It has no
price/offer seeds and cannot charge anyone on its own.

## Approved data model

| New table | Purpose |
| --- | --- |
| billing_offers | Server-controlled Bachs product mapping, mode, amount, currency and investigation allowance; disabled by default |
| billing_checkouts | Owned checkout attempts, immutable offer snapshot and unique client request key for idempotency |
| billing_subscriptions | Owned provider subscription identity, status and billing period |
| billing_webhook_events | Durable, deduplicated verified event inbox; minimal validated facts rather than raw payment payloads |
| billing_grants | One-time purchased units or paid-invoice period units, with expiry/revocation and consumed-unit count |
| billing_usage | One unit reservation per created investigation, linked to its grant |

Provider IDs and event deduplication are scoped to sandbox/production. Foreign
keys constrain grants to the same owner/environment as their checkout or
subscription. Ledger records restrict deletion. The usage service must also
verify investigation ownership transactionally; the existing investigation
table is not modified. A schema-level usage-to-investigation owner constraint
would require a further unique constraint on that existing table and is not
included in this additive proposal.

The explicit `db:billing-migrate` workflow installs 003 after the baseline;
db:verify recognizes installed billing tables and compares their exact expected
columns/constraints/indexes/triggers as well as the unchanged baseline. Pass
`--billing` to require their presence. Baseline-only installations continue
working with billing disabled; enabled billing requires the extension at startup.

## Approved product behavior

These policies were approved together with the schema:

- A one-time offer grants its configured number of investigations after a
  confirmed payment. A single-investigation offer can set that number to one.
- A subscription grants the configured number for each paid invoice period;
  unused period units expire at period end. It does not grant unlimited usage.
- A new investigation consumes one available unit inside the same database
  transaction as investigation creation. Retrying the same failed investigation
  consumes no additional unit. Automatic refunds for failed/cancelled work need
  an explicit product policy before implementation; no assumption is made here.
- Existing investigations remain readable. Enabling paid creation is a separate
  explicit rollout decision, not a side effect of installing billing tables.
- An unpaid/underpaid checkout, browser redirect or subscription-created event
  alone never grants units. Duplicates and out-of-order events cannot double
  grant or double consume. Subscription invoice grants use invoice identity;
  one-time grants use checkout identity, so overlapping event types do not grant
  twice. Refunded/disputed grants need a defined revocation/review policy.

Prices, currencies, Bachs product IDs, subscription cycles, allowed units,
one-time expiry (if any), free allowances and refund policies are **not supplied**.
They must be configured/reviewed rather than invented by a frontend or adapter.
No real product or amount is seeded by the proposal.

## Provider contract verified in the official documentation

Checkout is created server-side with a product cart or raw pricing, and returns
a hosted checkout URL. We propose catalog products mapped by a server offer,
not client-supplied amounts. A recurring product creates its subscription through
checkout. Bachs documents subscription checkout as USD card-only currently;
confirm the supported payment options for the merchant before defining plans.
Money is a decimal string, not integer minor units. Success/cancel URLs must be
public addresses; localhost is refused, including sandbox. These details come
from the [checkout guide](https://docs.bachs.io/guides/checkout/checkout-sessions)
and [provider conventions](https://docs.bachs.io/llms.txt).

Webhooks must be authenticated from the raw body. The preferred V2 header carries
a timestamp and one or more signatures; verify the timestamp, HMAC and all
candidate signatures, then deduplicate event IDs durably. Provider events may
arrive out of order. Store the verified event before acknowledgement and process
durably with retry/reconciliation. Check merchant organization, environment,
owned checkout mapping, product, amount and currency before fulfilment. The
browser success redirect is not payment proof. See
[Bachs webhook documentation](https://docs.bachs.io/guides/webhooks/overview).

## Backend surface

These endpoints are now implemented and included in current OpenAPI:

| Proposed method/path | Intended function |
| --- | --- |
| GET /v1/billing/offers | Enabled catalog offers and server-controlled pricing |
| POST /v1/billing/checkouts | JWT; offer_key and request_key; create/reuse owned checkout |
| GET /v1/billing/checkouts/{id} | JWT; read owned checkout and fulfilment state |
| GET /v1/billing/me | JWT; available units and subscription status |
| POST /v1/billing/portal | JWT; provider-hosted customer billing management |
| POST /v1/webhooks/bachs | Provider only; raw-body signature verification, no user JWT |

The frontend would choose an offer, request an owned checkout, follow the
returned URL, then reload backend-confirmed billing state on return. It must
handle pending webhook processing and canceled/expired checkout, not unlock
access from a query parameter. Hosted payment entry keeps payment credentials
out of the PadiCheck frontend/backend request bodies.

Backend-only environment configuration: BACHS_API_KEY,
BACHS_WEBHOOK_SECRET, BACHS_ORGANIZATION_ID, BACHS_ENVIRONMENT,
BACHS_SUCCESS_URL, BACHS_CANCEL_URL and a separate BILLING_ENABLED rollout flag.
These variables are validated by current config.
Sandbox/live key prefix must match environment. No arbitrary API base URL should
be accepted from a request. Secrets must never enter frontend bundles, docs,
logs or an API response.

## Validation and remaining activation

Implementation includes bounded provider HTTP, configuration, the explicit
migration workflow, owned idempotent checkouts, raw-body verified durable events,
subscription period allowances, transactional unit consumption, customer portal,
readiness and documentation. Focused tests and the real PostgreSQL concurrency
smoke cover the critical paths. Configure actual merchant products and private
credentials for sandbox acceptance before enabling live collections. Automatic
refund issuance, plan-change proration and credit restoration for failed work
remain outside this milestone; reversal events require staff review and grant
revocation. No production charge is needed for development verification.
