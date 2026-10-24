# Admin-controlled credits

The existing admin screens now use persisted backend policy:

- **Settings → Accounts & credits → Welcome credits**: one bonus after email verification or creation of a new authoritative Google identity. Zero disables the bonus. Login, linking Google and retries do not grant again. Changes apply to future registrations, with no automatic backfill for existing users.
- **Credits → What checks cost**: separate costs for business, phone, property, jobs, websites/links, contracts, shopping, freelance, people, social profiles, listings and general research. Zero makes a category free.
- Both controls require the backend **superadmin** role. Valid amounts are whole credits from 0 through 100,000. Saves require the current policy revision and write the old/new values and actor to the audit log.

## Deployment

1. Apply existing billing migration `003_billing.sql` if it is not already installed.
2. From the backend run `node --import tsx scripts/migrate-credits.ts`. This applies additive `006_credits.sql`; the runner is safe to repeat.
3. Sign in as superadmin, set welcome credits and category costs in the existing screens, and save using **Save credit settings**. Sandbox and production policies are separate, selected by backend `BACHS_ENVIRONMENT`.
4. Set `CREDITS_ENABLED=true` privately in the backend `.env`, then restart the API. Payment-provider credentials and `BILLING_ENABLED` are not required for welcome credits or enforcement. Set up paid checkout separately when ready.

The initial policy deliberately awards **0** welcome credits and preserves the previous **1-credit** check cost until admin chooses amounts. Enforcement stays off by default; do not enable it before configuring the intended policy and considering existing users' balances. Existing users do not receive a retroactive bonus. Their previously purchased units remain credits available for spending.

## Charging rules

The server derives the category from the validated investigation type/context and charges inside the transaction that creates the investigation. The confirmation sheet displays the current price. A stale `expected_credit_cost` returns `409 credit_price_changed`, with no debit or saved investigation. Insufficient balance returns `402 insufficient_credits`, also with no debit or saved investigation.

Per-user database locks serialize concurrent spending. A charge may use several unexpired, unrevoked grants, respecting subscription eligibility. The saved charge records its amount and policy revision; later price edits do not change past charges. Repeating the debit for the same investigation does not charge again. Separate accepted investigation requests remain separate purchases; clients prevent double-click submission and direct users to History when a response is uncertain.

Credits are charged when an investigation is accepted. A failed, cancelled or inconclusive investigation is **not automatically refunded** in this implementation. Retrying the same investigation does not add another charge. A refund policy and refund ledger require a separate decision; the UI must not promise automatic refunds.

## API

- `GET /v1/credits/policy`: public enabled flag and active policy when enforcement is enabled.
- `GET /v1/admin/credits/policy`: superadmin policy, including when enforcement is disabled.
- `PUT /v1/admin/credits/policy`: `{ welcome_credits, costs, revision }`; all category costs required.
- `GET /v1/credits/me`: owned available balance and latest 100 grant/debit entries. Reading never grants credits.
- `POST /v1/investigations`: optional `expected_credit_cost` guards the price the user confirmed. The server always determines the actual amount.
- Existing `GET /v1/billing/me` also returns welcome-credit balances without paid checkout being enabled.

## Checks

Backend: `node --import tsx --test --test-concurrency=1 tests/credits.test.ts tests/identity.test.ts tests/billing.test.ts tests/investigations.test.ts tests/documentation.test.ts`.

Real PostgreSQL concurrency: `node --import tsx scripts/check-credit-concurrency.ts`. Creates a random isolated `credit_test_` schema, exercises real production creation/debit code with two competing requests, and removes only that schema afterward. It does not insert into public user or investigation tables.

Frontend: `node --test --test-concurrency=1 tests/*.test.mjs`, TypeScript check and production build.
