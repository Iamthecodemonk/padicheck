-- Approved additive billing migration (19 October 2026).
-- Additive billing extension for Bachs one-time purchases and subscriptions.
-- Preserve padicheck_mvp_schema.sql and its existing relationships unchanged.
-- No prices, products, allowances, permissions or payment gates are seeded.
BEGIN;

CREATE TABLE billing_offers (
    offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    offer_key text NOT NULL CHECK (length(offer_key) BETWEEN 1 AND 80),
    display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
    billing_mode text NOT NULL CHECK (billing_mode IN ('one_time', 'subscription')),
    provider_product_id text NOT NULL CHECK (provider_product_id LIKE 'prod\_%' ESCAPE '\'),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    amount numeric(18,6) NOT NULL CHECK (amount > 0),
    investigation_units integer NOT NULL CHECK (investigation_units > 0),
    is_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (environment, offer_key),
    UNIQUE (environment, provider_product_id),
    UNIQUE (offer_id, environment)
);

CREATE TABLE billing_checkouts (
    billing_checkout_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    offer_id uuid NOT NULL,
    request_key uuid NOT NULL,
    request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    -- Immutable server-created snapshot: price, currency, product, units and mode.
    offer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(offer_snapshot) = 'object'),
    provider_checkout_id text,
    checkout_url text,
    status text NOT NULL DEFAULT 'creating'
      CHECK (status IN ('creating', 'open', 'paid', 'expired', 'failed', 'refunded')),
    provider_customer_id text,
    expires_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (offer_id, environment) REFERENCES billing_offers(offer_id, environment) ON DELETE RESTRICT,
    UNIQUE (users_id, environment, request_key),
    UNIQUE (environment, provider_checkout_id),
    UNIQUE (billing_checkout_id, users_id, environment),
    CHECK (status NOT IN ('paid', 'refunded') OR paid_at IS NOT NULL)
);

CREATE TABLE billing_subscriptions (
    billing_subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    offer_id uuid NOT NULL,
    provider_subscription_id text NOT NULL,
    provider_customer_id text NOT NULL,
    provider_status text NOT NULL CHECK (length(provider_status) > 0),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    -- Used with provider retrieval to prevent stale events overwriting newer state.
    provider_updated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (offer_id, environment) REFERENCES billing_offers(offer_id, environment) ON DELETE RESTRICT,
    UNIQUE (environment, provider_subscription_id),
    UNIQUE (billing_subscription_id, users_id, environment),
    CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start)
);

CREATE TABLE billing_webhook_events (
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    provider_event_id text NOT NULL,
    organization_id text NOT NULL,
    event_type text NOT NULL,
    provider_created_at timestamptz NOT NULL,
    payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    -- Validated minimal resource references/financial facts, not raw request bytes.
    event_data jsonb NOT NULL CHECK (jsonb_typeof(event_data) = 'object'),
    processing_status text NOT NULL DEFAULT 'pending'
      CHECK (processing_status IN ('pending', 'processed', 'ignored')),
    processing_error_code text,
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    PRIMARY KEY (environment, provider_event_id),
    CHECK ((processing_status = 'pending' AND processed_at IS NULL)
      OR (processing_status IN ('processed', 'ignored') AND processed_at IS NOT NULL))
);

CREATE TABLE billing_grants (
    billing_grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    billing_checkout_id uuid,
    billing_subscription_id uuid,
    source_type text NOT NULL CHECK (source_type IN ('checkout', 'invoice')),
    provider_source_id text NOT NULL,
    units_granted integer NOT NULL CHECK (units_granted > 0),
    units_used integer NOT NULL DEFAULT 0 CHECK (units_used >= 0 AND units_used <= units_granted),
    valid_from timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (billing_checkout_id, users_id, environment)
      REFERENCES billing_checkouts(billing_checkout_id, users_id, environment) ON DELETE RESTRICT,
    FOREIGN KEY (billing_subscription_id, users_id, environment)
      REFERENCES billing_subscriptions(billing_subscription_id, users_id, environment) ON DELETE RESTRICT,
    UNIQUE (environment, source_type, provider_source_id),
    UNIQUE (billing_grant_id, users_id),
    CHECK ((source_type = 'checkout' AND billing_checkout_id IS NOT NULL AND billing_subscription_id IS NULL)
      OR (source_type = 'invoice' AND billing_subscription_id IS NOT NULL AND billing_checkout_id IS NULL)),
    CHECK (expires_at IS NULL OR expires_at > valid_from),
    CHECK (source_type <> 'invoice' OR expires_at IS NOT NULL)
);

CREATE TABLE billing_usage (
    investigation_id uuid PRIMARY KEY REFERENCES investigations(investigation_id) ON DELETE RESTRICT,
    users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
    billing_grant_id uuid NOT NULL,
    consumed_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (billing_grant_id, users_id) REFERENCES billing_grants(billing_grant_id, users_id) ON DELETE RESTRICT
);

CREATE INDEX billing_checkouts_owner_time ON billing_checkouts (users_id, environment, created_at DESC);
CREATE INDEX billing_subscriptions_owner ON billing_subscriptions (users_id, environment);
CREATE INDEX billing_events_pending ON billing_webhook_events (received_at)
  WHERE processing_status = 'pending';
CREATE INDEX billing_grants_available ON billing_grants (users_id, environment, expires_at, created_at)
  WHERE revoked_at IS NULL AND units_used < units_granted;

CREATE TRIGGER billing_offers_updated_at BEFORE UPDATE ON billing_offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER billing_checkouts_updated_at BEFORE UPDATE ON billing_checkouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER billing_subscriptions_updated_at BEFORE UPDATE ON billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
