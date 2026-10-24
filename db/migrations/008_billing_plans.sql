BEGIN;
CREATE TABLE billing_plans (
 plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL CHECK(environment IN ('sandbox','production')),
 plan_key text NOT NULL CHECK(plan_key ~ '^[a-z0-9_-]{1,50}$'),
 audience text NOT NULL CHECK(audience IN ('consumer','business')),
 display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 100),
 tagline text NOT NULL DEFAULT '',currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 monthly_amount numeric(18,2) NOT NULL CHECK(monthly_amount>=0),
 yearly_amount numeric(18,2) NOT NULL CHECK(yearly_amount>=0),
 monthly_credits integer NOT NULL CHECK(monthly_credits BETWEEN 0 AND 100000),
 yearly_credits integer NOT NULL CHECK(yearly_credits BETWEEN 0 AND 1000000),
 features jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(features)='array'),
 is_popular boolean NOT NULL DEFAULT false,is_published boolean NOT NULL DEFAULT false,
 monthly_offer_id uuid REFERENCES billing_offers(offer_id),yearly_offer_id uuid REFERENCES billing_offers(offer_id),
 revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(environment,plan_key)
);
CREATE UNIQUE INDEX billing_plans_popular ON billing_plans(environment,audience) WHERE is_popular AND is_published;
ALTER TABLE billing_offers ADD COLUMN plan_id uuid REFERENCES billing_plans(plan_id);
ALTER TABLE billing_offers ADD COLUMN validity_days integer CHECK(validity_days IN (30,365));
COMMIT;
