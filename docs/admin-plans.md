# Admin plans — naira

- Manage plans: `/admin/plans`.
- Create a plan: `/admin/plans/new`.
- Review the original Plus example without saving it: `/admin/plans/new?template=plus`.

The existing admin shell and public card styles are retained. The plan form saves name, tagline, monthly/yearly naira price, credit allowance, audience, benefit descriptions, published state and the admin-selected **Most popular** badge. Only one published plan per audience/environment can have that badge. Revisions prevent stale edits; mutations are audited. Only superadmins can manage plans.

All plan amounts are **NGN**. Allowances are **credits**, since each check type may cost a different amount. Benefits are descriptions: saving text does not activate unavailable PDF exports, alerts, verification badges, automatic feature restrictions, or any other unfinished feature.

## Naira payment mode

Bachs currently documents recurring subscriptions as USD/card-only. These plans do not convert naira to dollars or create a dollar subscription. After publishing, the admin can explicitly choose **Enable naira checkout** and acknowledge **manual renewal**. This creates fixed-price NGN one-time products/offers:

- Monthly pass: credits valid for 30 days.
- Yearly pass: credits valid for 365 days, granted for the whole paid period rather than monthly installments.
- No automatic recurring charges. The customer buys another pass deliberately.

Checkout uses the existing signed-webhook and payment-verification pipeline. A verified payment grants the configured quantity exactly once; its saved offer snapshot carries the validity period. Unused credits expire. Existing non-plan packages and previously purchased credits keep their original terms. Changing a plan's money or quota disables its old offers for new purchases, preserves sold snapshots/grants, and requires checkout to be enabled for the new terms.

Prices for a paid naira checkout must be at least NGN 100. Bachs product creation uses stable idempotency keys. The plan API validates remote product price/currency and requires a one-time product before activating an offer. Metadata and publishing can be saved without contacting Bachs.

## Catalog and previews

The optional database copy of the original catalog was not approved, so it was not applied. The admin catalog starts empty. Existing original cards remain unavailable previews while an audience has no published plans. Published admin plans replace those previews; the comparison table follows published metadata. The optional Plus template is only unsaved form state; pressing Save is required to persist it, and publishing/checkout activation are separate choices.

## API and migration

- `GET /v1/billing/plans`: published current-environment cards and checkout availability.
- `GET/POST /v1/admin/billing/plans`: superadmin list/create.
- `PUT /v1/admin/billing/plans/:id`: revision-checked edit.
- `POST /v1/admin/billing/plans/:id/enable-checkout`: requires `{ "acknowledge_manual_renewal": true }`.

Apply additive migration `008_billing_plans.sql` with `node --import tsx scripts/migrate-plans.ts` before starting this version. No plan products, published catalog entries or purchases are automatically seeded by the migration.

## Requested local test accounts

Created with generated, hashed passwords and synthetic reserved `.test` addresses, with no real emails, payment grants or welcome-credit awards:

- `padi.demo.admin@example.test`: superadmin.
- `padi.demo.buyer1@example.test`: consumer (`user`).
- `padi.demo.buyer2@example.test`: consumer (`user`).

Passwords are stored only in ignored local `.tmp/plan-test-accounts.txt`, not this document or source control. Vite denies serving `.tmp` over HTTP. Account creation/role selection were explicitly authorized by the user and logged as test operator setup. Existing accounts were not reset and no browser sessions were fabricated.

## Validation

Tests cover role boundaries, NGN-only validation, private drafts, exclusive featured selection, stale edits, explicit manual-renewal acknowledgement, idempotent product creation, matching offers, signed payment verification, replay deduplication, exact quota/30- or 365-day expiry, and immutable past purchases. Provider product tests use explicit fixtures, not real charges.
