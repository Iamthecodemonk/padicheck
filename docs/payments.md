# Bachs billing backend

Implemented on 19 October 2026 for **one-time purchases and subscription
investigation allowances**. The additive six-table schema was explicitly
approved and applied to the local database. The supplied root SQL and baseline
migration remain unchanged. Billing is disabled by default; prices/products
are not seeded and `.env` credentials have not been changed.

## Install and configure

For a fresh database run `npm.cmd run db:migrate`, then
`npm.cmd run db:billing-migrate`. For an existing aligned installation use only
the second command. It acquires the existing migration advisory lock, refuses
a partially installed billing schema and never drops/replaces an existing
table. It uses the approved `db/migrations/003_billing.sql`. Verify with
`npm.cmd run db:verify -- --billing`. The verifier understands the installed
extension in addition to the original baseline; `db:verify` still accepts a
baseline-only installation when no billing tables are present.

Configure privately on the backend:

```dotenv
BILLING_ENABLED=false
BACHS_ENVIRONMENT=sandbox
BACHS_API_KEY=<merchant sandbox key>
BACHS_WEBHOOK_SECRET=<endpoint signing secret>
BACHS_ORGANIZATION_ID=<merchant acct_ identifier>
BACHS_SUCCESS_URL=https://your-frontend.example/billing/return
BACHS_CANCEL_URL=https://your-frontend.example/billing/cancel
```

Leave all Bachs secret/organization/URL fields blank when unconfigured. Partial
configuration is rejected. The environment is sandbox or production, and its
key must start with sk_sandbox_ or sk_live_ respectively. Return URLs must be
public HTTPS URLs; localhost is not supported by Bachs. Use a real approved
development return origin when testing checkout, without changing the API's
local listening address. No arbitrary provider origin can be passed by a client.

Create real merchant products with fixed one-time or recurring pricing in the
Bachs sandbox. Current mapped currencies are USD and NGN, with subscriptions
restricted to USD. Ensure each product's currency/mode matches its PadiCheck
offer. Configure the provider customer portal for that environment if using
subscription self-service.

Through a superadmin account, call `POST /v1/admin/billing/offers`:

```json
{
  "offer_key": "<your-offer-key>",
  "display_name": "<customer-visible name>",
  "billing_mode": "one_time",
  "provider_product_id": "prod_REPLACE",
  "currency": "USD",
  "amount": "10.00",
  "investigation_units": 1,
  "is_enabled": false
}
```

Values above are examples, not configured prices. Choose the actual amount and
allowance. For a recurring product use billing_mode=subscription and its
per-paid-period unit allowance. Money is a decimal string in currency units,
not integer minor units. The SQL numeric column may return six decimal places.
Only offer names/enabled state can later be patched; for changed product,
amount, currency, mode or units create a new offer. This preserves prior sold
terms and immutable checkout snapshots. All offer mutations are audited.

Register a Bachs webhook destination pointing to the backend's public HTTPS
`/v1/webhooks/bachs`, with the configured organization and signing secret.
Subscribe to checkout.completed, checkout.expired, collection.succeeded,
collection.failed, collection.underpaid, customer.subscription.created,
customer.subscription.updated, customer.subscription.deleted and invoice.paid.
Refund/dispute notifications can also be ingested for explicit staff review;
see limitations below. Local signature forwarding can use the provider's
documented CLI. Do not create a webhook from the frontend.

After the sandbox flow and operational review pass, enable the intended offers,
set `BILLING_ENABLED=true`, and restart the backend. This explicitly enables
collections **and requires paid units for new investigations**. Installing the
tables alone does neither. Existing investigations remain readable. With billing
disabled, existing investigation behavior is retained and the public offer
endpoint returns enabled=false. A production switch also needs the live product
mappings, live credentials and production webhook destination; sandbox units
cannot be consumed in production.

## Implemented API and behavior

Full schemas: [API reference](api-reference.md), [OpenAPI](openapi.json), or
`/docs/`. Frontend examples: [frontend-integration.md](frontend-integration.md).

| Operation | Behavior |
| --- | --- |
| GET /v1/billing/offers | Public, enabled catalog; no provider product IDs or credentials |
| GET /v1/billing/me | JWT, usable-unit balance and owned subscription summaries |
| POST /v1/billing/checkouts | JWT + verified email, offer_key and UUID request_key; 201 owned checkout |
| GET /v1/billing/checkouts/{id} | JWT, owned local UUID checkout status; no fulfilment from reads |
| POST /v1/billing/portal | JWT, owned billing_subscription_id; fresh provider portal URL |
| POST /v1/webhooks/bachs | Provider signature, no JWT; durable 202 event receipt |
| GET/POST /v1/admin/billing/offers | Superadmin, list/create configured offers |
| PATCH /v1/admin/billing/offers/{id} | Superadmin, display_name/is_enabled only |
| GET /v1/admin/billing/events | Superadmin, processing/error status for reconciliation |
| GET /v1/admin/billing/grants | Superadmin, allowance ledger inspection |
| POST /v1/admin/billing/grants/{id}/revoke | Superadmin, audited idempotent revocation with note |

Checkout identity is saved before the bounded provider request. Retries reuse a
stable provider idempotency key and unique reference. Reusing a client request
key for another offer returns 409. The service verifies the created checkout's
amount/currency/product/quantity/mode before returning its URL. An old uncertain
attempt requires reconciliation rather than creating a new checkout blindly.
Signed checkout events can recover a lost local provider-ID mapping through
the original reference after provider retrieval and validation.

Successful checkout or collection events retrieve current provider state and
compare it with the saved snapshot before recording payment. A one-time checkout
grants once. For a subscription, a signed paid invoice grants once per mapped
paid period; checkout/subscription-created events alone do not grant subscription
units. Duplicate event IDs, duplicate invoice IDs, and another invoice for the
same subscription period cannot grant again. Period units expire; one-time units
do not expire in this milestone. Unpaid/paused subscriptions cannot spend units.
Ending renewal does not erase already paid units before their expiry.

Investigation insertion, unit selection/increment and usage recording share one
transaction. A failed insertion/denied unit rolls back the whole create. Two
concurrent requests cannot spend the last unit twice. Retrying an existing failed
investigation consumes no new unit; cancellation/failure does not automatically
restore a spent unit. Every account, including staff, is subject to this gate
when billing is enabled.

## Event processing and operations

The webhook verifies raw bytes, timestamp tolerance (five minutes), HMAC and
merchant identity. V2 accepts any matching v1 signature during key rotation;
legacy timestamp/signature headers are also accepted. It stores a payload hash
and minimal facts, excluding customer email/address and raw body. Provider HTTP
errors are sanitized; provider/portal response bodies and secrets are not logged.

Each enabled API process runs a five-second inbox poller with at most one batch
in flight. PostgreSQL row locking with SKIP LOCKED supports multiple API
instances. Pending rows survive crashes; processing is transactional. Failures
retain a safe processing_error_code and rejoin the queue for retry. Shutdown
stops and awaits the current batch before resource cleanup. No separate Redis
queue is required for billing events. At least one enabled API process must be
running to process them.

`/ready` adds billing=enabled/disabled and, when enabled, checks required billing
tables. Startup also refuses enabled billing without those tables. This checks
schema/configuration, not merchant credentials or a completed real charge.
Inspect pending events through the superadmin API and the Bachs dashboard.
The frontend waits for backend-confirmed balance after a redirect, including
subscription invoices arriving before the subscription-created notification.

## Explicit limitations and live acceptance

- No actual Bachs merchant key, product, webhook delivery or checkout has been
  exercised yet. Unit tests use provider doubles; the real PostgreSQL smoke
  verifies database behavior without calling a payment provider.
- Fixed-price, single-product, quantity-one offers are supported. Trials give
  no free allowance. Plan changes, quantity/seats, coupons/taxes/prorated invoices
  that differ from saved terms require review, not an automatic grant.
- Automated refund issuance and automatic refund/chargeback entitlement reversal
  are not implemented. Refund/dispute events remain pending with
  billing_reversal_review_required. Staff must identify affected grants and revoke
  unused access through the audited API. This requires an operational review
  process before live activation. Already consumed work is not undone.
- There is no frontend-driven reconciliation or arbitrary balance adjustment
  endpoint. Older uncertain checkouts without recoverable signed events require
  operator reconciliation against the provider, not a new request key.
- Provider idempotency and unique references protect checkout retries; they do
  not make PostgreSQL and an external provider one atomic transaction.

Verification commands:

```powershell
npm.cmd run typecheck
node --import tsx --test tests/billing.test.ts tests/documentation.test.ts
npm.cmd run billing:smoke
npm.cmd run db:verify -- --billing
npm.cmd run docs:export
npm.cmd run docs:check
```

The billing smoke creates and drops only a generated guarded scratch database;
it uses the supplied baseline plus 003 and verifies concurrent last-unit
consumption. It sends no email, performs no payment request and does not create
offers in the main database. Migration approval/design is recorded in
[payments-plan.md](payments-plan.md).

Provider references: [Checkout](https://docs.bachs.io/guides/checkout/checkout-sessions),
[webhook verification](https://docs.bachs.io/guides/webhooks/overview),
[invoice.paid](https://docs.bachs.io/guides/webhooks/events/invoice-paid),
[subscription object](https://docs.bachs.io/api-reference/subscriptions/object),
and [customer portal](https://docs.bachs.io/api-reference/customer-sessions/create-a-customer-portal-session).
