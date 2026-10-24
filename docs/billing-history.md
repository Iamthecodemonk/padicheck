# Billing history

The consumer Subscription & billing screen now reads `GET /v1/billing/history?limit=20&offset=0` instead of the empty prototype invoice list. Its existing responsive table and receipt sheet are preserved.

The authenticated endpoint returns only records owned by the current user in the server-selected billing environment. It reads existing local records without contacting Bachs, creating payments or granting credits. Historical records remain readable when new purchases are disabled.

Entries include `id`, `kind`, `at`, `description`, decimal-string `amount`, `currency`, `status`, package `credits`, and provider `reference`. Responses contain `entries` and `has_more`. Limit defaults to 20, maximum 100; offset is bounded by the existing pagination schema.

- One-time payments use the saved checkout snapshot and recorded paid/refunded/failed state. Unpaid open/creating/expired sessions are not shown as invoices.
- Subscription payments use validated invoice grants and their immutable offer prices. Paid subscription checkout rows are omitted so the first charge is not repeated as both checkout and invoice.
- Credit-grant revocation is not represented as a refund unless the payment itself has a recorded refunded state.
- Payment amounts use the stored currency, including NGN and USD. No VAT, payment-card method, tax invoice number or provider PDF URL is invented.
- The payment-detail sheet shows the provider, reference and package quantity, with a print action. It is not a generated tax invoice.

The page has loading, error, empty, manual refresh and pagination states. When checkout polling first confirms payment, it refreshes history and balance so a return before webhook processing does not leave an empty table.

Verification covers account privacy, authenticated access, pagination, invoice deduplication, historical reads after billing is disabled and decimal/currency rendering. The live lookup returns paid Demo sandbox records at NGN 100 with 10 credits per package.
