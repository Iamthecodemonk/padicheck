# Schema inspection and applied alignment

Source of truth: `padicheck_mvp_schema.sql`, copied unchanged from the supplied
Downloads file. `db/migrations/001_baseline.sql` is a byte-preserving copy.

The existing PostgreSQL database is reachable on port 5433. It initially contained
a legacy schema. Read-only inspection found these differences:

| Table | Existing database | Supplied schema |
| --- | --- | --- |
| `users` | Extra `role` column restricted to user/moderator/admin | Roles use `user_roles`, `roles`, and `role_permissions` |
| `media_files` | Required unique `storage_key` | `storage_provider`, `provider_asset_id`, `provider_public_id`, `provider_resource_type`, `provider_delivery_type`, `provider_version`, and provider indexes/checks |
| `model_runs` | No registry foreign keys | Nullable `task_id`, `assignment_id`, `agent_id`, `model_id`, referencing the existing registry |

Columns, constraints, indexes, and triggers were compared against a fresh
PostgreSQL instance initialized from the supplied SQL. Full structural
differences were recorded in `database-drift.json`. The inspected `users`, `media_files`,
`model_runs`, and `user_auth_accounts` tables were empty. No database writes were
performed during inspection.

## Approved and applied change

After user approval on October 8, 2026, `db/migrations/002_align_legacy_schema.sql`
was applied using `npm run db:align-legacy`. It aligns those differences with the
supplied schema. It removes obsolete `users.role` and `media_files.storage_key`,
adds the exact Cloudinary columns and constraints, and adds the model-run registry
references. No application table names are changed.

The proposal takes locks and refuses to proceed if any affected table has rows.
It uses no `CASCADE`. This prevents guessing Cloudinary identifiers from legacy
storage keys or losing legacy role assignments. If those tables gain data, a
separate backfill plan is required. The transaction rolls back on failure.

The original draft remains at `db/proposals/002_align_legacy_schema.sql` as the
review artifact. `db:migrate` still applies only the unchanged baseline to an
empty public schema; the alignment command targets the inspected legacy variant
explicitly. Reapplying alignment to an already aligned database fails and rolls
back. Post-application `npm run db:verify` passed for all compared columns,
constraints, indexes, and triggers; `database-drift.json` is now empty (`{}`).

## Feature mapping for the current slice

- Registration: `users.users_id`, `display_name`, `email`, `account_status`;
  `user_auth_accounts.users_id`, `provider`, `password_hash`, `provider_email`.
  The supplied trigger assigns the default `user` role.
- Login: password identity above plus `auth_account_id`, `last_used_at` and
  `users.last_login_at`. Account status is checked before token issuance.
- Authorization: `user_roles.users_id/role_id`, `roles.role_key/role_id`,
  `role_permissions.role_id/permission_id`, `permissions.permission_key`.
  Live database permissions and active account status are checked on requests;
  wildcard access requires the superadmin role.
- Role grants: `user_roles.granted_by_user_id`, with an `admin_audit_logs` row
  containing `actor_user_id`, `action`, `target_type`, `target_id`, `before_state`,
  `after_state`, and `request_id` in the same transaction.
- Superadmin bootstrap: existing active account, one-time role assignment and
  audit entry. No automatic elevation at registration.

The schema has no session or refresh-token table. The current slice uses
15-minute bearer access tokens, has no refresh or server-side logout endpoint,
and checks suspension and changed permissions immediately. Google credentials
are not configured, so Google sign-in remains pending.

Redis workers, Cloudinary operations, investigations, evidence collection, AI
adapters/routing, and AI configuration admin APIs remain later slices. Model
runs support prompt versions but have no full prompt field; full prompt storage
would require a separately proposed migration if it becomes necessary.
