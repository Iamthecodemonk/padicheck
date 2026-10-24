-- Additive credit policy; existing purchases and historical one-unit usage are preserved.
BEGIN;
CREATE TABLE credit_policies (
 environment text PRIMARY KEY CHECK(environment IN ('sandbox','production')),
 welcome_credits integer NOT NULL DEFAULT 0 CHECK(welcome_credits BETWEEN 0 AND 100000),
 costs jsonb NOT NULL DEFAULT '{"company_research":1,"phone_lookup":1,"property":1,"job_search":1,"web_analysis":1,"contract_review":1,"general_research":1,"shopping":1,"freelance":1,"person":1,"social":1,"listing":1}',
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO credit_policies(environment) VALUES ('sandbox'),('production');
-- Replace only checks governing grant provenance, preserving all other checks/FKs.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='billing_grants'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%source_type%' LOOP
 EXECUTE format('ALTER TABLE billing_grants DROP CONSTRAINT %I',r.conname);
 END LOOP;
END $$;
ALTER TABLE billing_grants ADD CONSTRAINT billing_grants_provenance CHECK (
 (source_type='checkout' AND billing_checkout_id IS NOT NULL AND billing_subscription_id IS NULL) OR
 (source_type='invoice' AND billing_subscription_id IS NOT NULL AND billing_checkout_id IS NULL AND expires_at IS NOT NULL) OR
 (source_type='welcome' AND billing_checkout_id IS NULL AND billing_subscription_id IS NULL));
CREATE TABLE welcome_credit_awards (
 users_id uuid PRIMARY KEY REFERENCES users(users_id) ON DELETE RESTRICT,
 environment text NOT NULL REFERENCES credit_policies(environment),
 amount integer NOT NULL CHECK(amount BETWEEN 0 AND 100000),
 policy_revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE billing_usage DROP CONSTRAINT billing_usage_pkey;
ALTER TABLE billing_usage ADD PRIMARY KEY(investigation_id,billing_grant_id);
ALTER TABLE billing_usage ADD COLUMN units integer NOT NULL DEFAULT 1 CHECK(units>0);
CREATE TABLE credit_charges (
 investigation_id uuid PRIMARY KEY REFERENCES investigations(investigation_id) ON DELETE RESTRICT,
 users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
 environment text NOT NULL REFERENCES credit_policies(environment),
 check_type text NOT NULL,
 amount integer NOT NULL CHECK(amount BETWEEN 0 AND 100000),
 policy_revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
