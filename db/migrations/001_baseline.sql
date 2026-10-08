-- PadiCheck MVP database schema
-- PostgreSQL 13+
-- Designed for a fresh PadiCheck database.
-- Profile files and uploads are stored in private/public object storage; PostgreSQL stores metadata.
-- AI findings are distinct from user-submitted allegations.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Users and authentication
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    users_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name         text NOT NULL,
    email                text NOT NULL,
    phone_number         text,
    avatar_media_id      uuid,
    account_status       text NOT NULL DEFAULT 'active'
                         CHECK (account_status IN ('active', 'suspended', 'deleted')),
    email_verified_at    timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    last_login_at        timestamptz
);

-- Enforce case-insensitive email uniqueness while preserving the entered address.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
    ON users (lower(email));

-- Role-based access control (RBAC): users may hold multiple roles.
CREATE TABLE IF NOT EXISTS roles (
    role_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key            text NOT NULL UNIQUE,
    display_name        text NOT NULL,
    description         text,
    is_system_role      boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key      text NOT NULL UNIQUE,
    display_name        text NOT NULL,
    description         text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    users_id            uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    role_id             uuid NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    granted_by_user_id  uuid REFERENCES users(users_id) ON DELETE SET NULL,
    granted_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (users_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id             uuid NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id       uuid NOT NULL REFERENCES permissions(permission_id) ON DELETE RESTRICT,
    granted_by_user_id  uuid REFERENCES users(users_id) ON DELETE SET NULL,
    granted_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO roles (role_key, display_name, description, is_system_role) VALUES
    ('user', 'User', 'Standard PadiCheck account.', true),
    ('support', 'Support', 'Handles user support requests.', true),
    ('moderator', 'Moderator', 'Reviews user-submitted reports and disputes.', true),
    ('verifier', 'Verifier', 'Reviews business verification requests.', true),
    ('admin', 'Admin', 'Manages platform operations and configuration.', true),
    ('superadmin', 'Superadmin', 'Full platform access, including role and permission management.', true)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO permissions (permission_key, display_name, description) VALUES
    ('*', 'All permissions', 'Wildcard permission reserved for the superadmin role.'),
    ('investigations.create', 'Create investigations', 'Start research and analysis requests.'),
    ('investigations.read_own', 'Read own investigations', 'View investigations owned by the signed-in user.'),
    ('investigations.read_all', 'Read all investigations', 'View investigations for support or administration.'),
    ('reports.submit', 'Submit reports', 'Submit a report about an entity.'),
    ('reports.moderate', 'Moderate reports', 'Review, publish, reject, or remove user-submitted reports.'),
    ('disputes.resolve', 'Resolve disputes', 'Review and resolve disputes about reports.'),
    ('users.read', 'Read users', 'View user account details.'),
    ('users.manage', 'Manage users', 'Suspend, restore, or manage user accounts.'),
    ('roles.read', 'Read roles', 'View roles and permissions.'),
    ('roles.manage', 'Manage roles', 'Assign roles and manage role permissions.'),
    ('ai_config.manage', 'Manage AI configuration', 'Manage AI providers, models, agents, tools, and task routing.'),
    ('businesses.manage', 'Manage businesses', 'Manage business directory profiles.'),
    ('verifications.review', 'Review verifications', 'Approve or reject business verification requests.'),
    ('directory.manage', 'Manage directory', 'Publish, hide, or edit directory entries.'),
    ('media.manage', 'Manage media', 'Review or remove uploaded media.'),
    ('audit.read', 'Read audit log', 'View administrative audit events.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r CROSS JOIN permissions p
WHERE (r.role_key = 'user' AND p.permission_key IN (
           'investigations.create', 'investigations.read_own', 'reports.submit'
       ))
   OR (r.role_key = 'support' AND p.permission_key IN (
           'users.read', 'investigations.read_all'
       ))
   OR (r.role_key = 'moderator' AND p.permission_key IN (
           'reports.moderate', 'disputes.resolve'
       ))
   OR (r.role_key = 'verifier' AND p.permission_key = 'verifications.review')
   OR (r.role_key = 'admin' AND p.permission_key IN (
           'users.read', 'users.manage', 'roles.read', 'ai_config.manage',
           'businesses.manage', 'verifications.review', 'reports.moderate',
           'disputes.resolve', 'investigations.read_all', 'directory.manage',
           'media.manage', 'audit.read'
       ))
   OR (r.role_key = 'superadmin' AND p.permission_key = '*')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO user_roles (users_id, role_id)
SELECT u.users_id, r.role_id FROM users u CROSS JOIN roles r WHERE r.role_key = 'user'
ON CONFLICT (users_id, role_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id, users_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions (permission_id, role_id);

-- After the first account is created, assign superadmin through a controlled one-time bootstrap:
-- INSERT INTO user_roles (users_id, role_id)
-- SELECT u.users_id, r.role_id FROM users u CROSS JOIN roles r
-- WHERE lower(u.email) = lower('owner@example.com') AND r.role_key = 'superadmin'
-- ON CONFLICT (users_id, role_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    audit_log_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id       uuid REFERENCES users(users_id) ON DELETE SET NULL,
    action              text NOT NULL,
    target_type         text NOT NULL,
    target_id           uuid,
    before_state        jsonb,
    after_state         jsonb,
    request_id          text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_time
    ON admin_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_time
    ON admin_audit_logs (target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_auth_accounts (
    auth_account_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    users_id            uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    provider            text NOT NULL,
    provider_subject    text,
    -- Store only a strong password hash from the backend; never store a raw password.
    password_hash       text,
    provider_email      text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_used_at        timestamptz,
    CHECK (
        (provider = 'password' AND password_hash IS NOT NULL AND provider_subject IS NULL)
        OR
        (provider <> 'password' AND password_hash IS NULL AND provider_subject IS NOT NULL)
    )
);

-- An OAuth identity can only belong to one PadiCheck account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_provider_subject
    ON user_auth_accounts (provider, provider_subject)
    WHERE provider_subject IS NOT NULL;

-- A PadiCheck account can have at most one password credential.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_password_auth
    ON user_auth_accounts (users_id)
    WHERE provider = 'password';

-- -----------------------------------------------------------------------------
-- 2. Uploaded media
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_files (
    media_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by_user_id  uuid REFERENCES users(users_id) ON DELETE SET NULL,
    -- Cloudinary is the MVP storage provider. Keep provider identifiers rather
    -- than a delivery URL: URLs can be regenerated and signed URLs can expire.
    storage_provider     text NOT NULL DEFAULT 'cloudinary',
    provider_asset_id    text UNIQUE,
    provider_public_id   text NOT NULL,
    provider_resource_type text NOT NULL
                         CHECK (provider_resource_type IN ('image', 'video', 'raw')),
    provider_delivery_type text NOT NULL DEFAULT 'authenticated'
                         CHECK (provider_delivery_type IN ('upload', 'private', 'authenticated')),
    provider_version     bigint,
    original_filename    text NOT NULL,
    media_type           text NOT NULL
                         CHECK (media_type IN ('image', 'video', 'audio', 'document', 'other')),
    mime_type            text NOT NULL,
    size_bytes           bigint NOT NULL CHECK (size_bytes > 0),
    sha256               text,
    visibility           text NOT NULL DEFAULT 'private'
                         CHECK (visibility IN ('private', 'public', 'restricted')),
    upload_status        text NOT NULL DEFAULT 'pending'
                         CHECK (upload_status IN ('pending', 'ready', 'failed', 'deleted')),
    created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_provider_public_id
    ON media_files (storage_provider, provider_resource_type, provider_public_id);

-- The avatar foreign key is added after media_files exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_avatar_media'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_avatar_media
            FOREIGN KEY (avatar_media_id) REFERENCES media_files(media_id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Investigations and entities
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investigations (
    investigation_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    investigation_type  text NOT NULL
                        CHECK (investigation_type IN (
                            'company_research', 'web_analysis', 'job_search',
                            'contract_review', 'phone_lookup', 'general_research'
                        )),
    title               text,
    user_prompt         text NOT NULL,
    input_data          jsonb NOT NULL DEFAULT '{}'::jsonb,
    status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN (
                            'queued', 'collecting_sources', 'analyzing',
                            'completed', 'failed', 'cancelled'
                        )),
    result_summary      text,
    error_code          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    started_at          timestamptz,
    completed_at        timestamptz
);

CREATE TABLE IF NOT EXISTS entities (
    entity_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type         text NOT NULL
                        CHECK (entity_type IN (
                            'business', 'person', 'website', 'job_listing',
                            'property_listing', 'service_provider', 'other'
                        )),
    canonical_name      text NOT NULL,
    description         text,
    country_code        char(2),
    city                text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_type_name
    ON entities (entity_type, lower(canonical_name));

CREATE TABLE IF NOT EXISTS identifiers (
    identifier_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           uuid NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    identifier_type     text NOT NULL
                        CHECK (identifier_type IN (
                            'phone', 'email', 'url', 'domain', 'social_profile',
                            'registration_number', 'address', 'other'
                        )),
    value               text NOT NULL,
    normalized_value    text NOT NULL,
    visibility          text NOT NULL DEFAULT 'private'
                        CHECK (visibility IN ('public', 'private', 'restricted')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (entity_id, identifier_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_identifiers_lookup
    ON identifiers (identifier_type, lower(normalized_value));

-- Entities selected or returned by a search within an investigation.
CREATE TABLE IF NOT EXISTS investigation_targets (
    investigation_target_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id        uuid NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    entity_id               uuid NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    target_role             text NOT NULL DEFAULT 'candidate'
                            CHECK (target_role IN ('primary', 'candidate', 'comparison')),
    result_rank             integer CHECK (result_rank IS NULL OR result_rank > 0),
    is_selected             boolean NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (investigation_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_targets_rank
    ON investigation_targets (investigation_id, result_rank);

-- -----------------------------------------------------------------------------
-- 4. Sources, model runs, and AI findings
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sources (
    source_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type         text NOT NULL
                        CHECK (source_type IN (
                            'web_page', 'user_provided_link', 'uploaded_document',
                            'business_directory', 'external_api', 'other'
                        )),
    url                 text,
    media_id            uuid REFERENCES media_files(media_id) ON DELETE RESTRICT,
    title               text,
    publisher           text,
    excerpt             text,
    content_hash        text,
    fetched_at          timestamptz,
    visibility          text NOT NULL DEFAULT 'private'
                        CHECK (visibility IN ('public', 'private', 'restricted')),
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (source_type <> 'uploaded_document' OR media_id IS NOT NULL),
    CHECK (source_type NOT IN ('web_page', 'user_provided_link') OR url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sources_url
    ON sources (url) WHERE url IS NOT NULL;

CREATE TABLE IF NOT EXISTS investigation_sources (
    investigation_id    uuid NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    source_id           uuid NOT NULL REFERENCES sources(source_id) ON DELETE RESTRICT,
    discovery_method    text NOT NULL DEFAULT 'web_search',
    relevance_rank      integer CHECK (relevance_rank IS NULL OR relevance_rank > 0),
    used_in_analysis    boolean NOT NULL DEFAULT true,
    added_at            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (investigation_id, source_id)
);

-- Configurable AI registry. Admins enable/disable entries and route supported tasks.
-- Store API credentials in a secret manager or environment, never as plain DB values.
CREATE TABLE IF NOT EXISTS ai_providers (
    provider_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code           text NOT NULL UNIQUE,
    display_name            text NOT NULL,
    status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'disabled')),
    credential_secret_ref   text,
    provider_config         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id      uuid REFERENCES users(users_id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_models (
    model_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             uuid NOT NULL REFERENCES ai_providers(provider_id) ON DELETE RESTRICT,
    provider_model_id       text NOT NULL,
    display_name            text NOT NULL,
    capabilities            jsonb NOT NULL DEFAULT '{}'::jsonb,
    model_config            jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'disabled', 'retired')),
    created_by_user_id      uuid REFERENCES users(users_id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, provider_model_id)
);

CREATE TABLE IF NOT EXISTS ai_agents (
    agent_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_code              text NOT NULL UNIQUE,
    display_name            text NOT NULL,
    description             text,
    instructions_template   text NOT NULL,
    prompt_version          text NOT NULL DEFAULT 'v1',
    settings                jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'disabled')),
    created_by_user_id      uuid REFERENCES users(users_id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Task codes are registered here, but each task still needs a supported backend handler.
CREATE TABLE IF NOT EXISTS ai_task_types (
    task_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code               text NOT NULL UNIQUE,
    display_name            text NOT NULL,
    description             text,
    is_enabled              boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Tools are separate from models: examples include web search, URL fetching, and document parsing.
CREATE TABLE IF NOT EXISTS ai_tools (
    tool_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_code               text NOT NULL UNIQUE,
    display_name            text NOT NULL,
    tool_type               text NOT NULL
                            CHECK (tool_type IN ('provider_native', 'external_api', 'internal')),
    provider_id             uuid REFERENCES ai_providers(provider_id) ON DELETE RESTRICT,
    credential_secret_ref   text,
    tool_config             jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'disabled')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CHECK (tool_type <> 'provider_native' OR provider_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS ai_agent_tools (
    agent_id                uuid NOT NULL REFERENCES ai_agents(agent_id) ON DELETE CASCADE,
    tool_id                 uuid NOT NULL REFERENCES ai_tools(tool_id) ON DELETE RESTRICT,
    is_enabled              boolean NOT NULL DEFAULT true,
    tool_config_override    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, tool_id)
);

-- Lower priority number runs first (1 = primary; 2+ can be fallbacks).
CREATE TABLE IF NOT EXISTS ai_task_assignments (
    assignment_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                 uuid NOT NULL REFERENCES ai_task_types(task_id) ON DELETE RESTRICT,
    agent_id                uuid NOT NULL REFERENCES ai_agents(agent_id) ON DELETE RESTRICT,
    model_id                uuid NOT NULL REFERENCES ai_models(model_id) ON DELETE RESTRICT,
    priority                integer NOT NULL DEFAULT 1 CHECK (priority > 0),
    is_enabled              boolean NOT NULL DEFAULT true,
    config_override         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id      uuid REFERENCES users(users_id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_id, agent_id, model_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_task_assignment_priority
    ON ai_task_assignments (task_id, priority)
    WHERE is_enabled;

CREATE TABLE IF NOT EXISTS model_runs (
    model_run_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id    uuid NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    task_id             uuid REFERENCES ai_task_types(task_id) ON DELETE SET NULL,
    assignment_id       uuid REFERENCES ai_task_assignments(assignment_id) ON DELETE SET NULL,
    agent_id            uuid REFERENCES ai_agents(agent_id) ON DELETE SET NULL,
    model_id            uuid REFERENCES ai_models(model_id) ON DELETE SET NULL,
    task_type           text NOT NULL,
    provider            text NOT NULL,
    model_name          text NOT NULL,
    prompt_version      text NOT NULL,
    status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    provider_request_id text,
    input_tokens        integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
    output_tokens       integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
    estimated_cost_usd  numeric(12,6)
                        CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
    error_code          text,
    started_at          timestamptz,
    completed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_runs_investigation
    ON model_runs (investigation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS findings (
    finding_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id    uuid NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    entity_id           uuid REFERENCES entities(entity_id) ON DELETE SET NULL,
    model_run_id        uuid REFERENCES model_runs(model_run_id) ON DELETE SET NULL,
    finding_type        text NOT NULL
                        CHECK (finding_type IN (
                            'fact', 'claim', 'positive_signal', 'risk_signal',
                            'missing_information', 'recommendation'
                        )),
    category            text NOT NULL,
    title               text NOT NULL,
    explanation         text NOT NULL,
    confidence          numeric(4,3)
                        CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    verification_status text NOT NULL DEFAULT 'unverified'
                        CHECK (verification_status IN (
                            'verified', 'partially_verified', 'unverified', 'disputed'
                        )),
    display_order       integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_findings_investigation_order
    ON findings (investigation_id, display_order);

CREATE TABLE IF NOT EXISTS finding_sources (
    finding_id          uuid NOT NULL REFERENCES findings(finding_id) ON DELETE CASCADE,
    source_id           uuid NOT NULL REFERENCES sources(source_id) ON DELETE RESTRICT,
    support_type        text NOT NULL DEFAULT 'supports'
                        CHECK (support_type IN ('supports', 'contradicts', 'context')),
    evidence_note       text,
    PRIMARY KEY (finding_id, source_id)
);

-- -----------------------------------------------------------------------------
-- 5. Business directory and verification
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_profiles (
    business_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           uuid NOT NULL UNIQUE REFERENCES entities(entity_id) ON DELETE CASCADE,
    business_category   text NOT NULL,
    profile_description text,
    claimed_by_user_id  uuid REFERENCES users(users_id) ON DELETE SET NULL,
    profile_status      text NOT NULL DEFAULT 'draft'
                        CHECK (profile_status IN ('draft', 'published', 'hidden')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_category_status
    ON business_profiles (business_category, profile_status);

CREATE TABLE IF NOT EXISTS business_verification_requests (
    verification_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id     uuid NOT NULL REFERENCES business_profiles(business_profile_id) ON DELETE CASCADE,
    submitted_by_user_id    uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
    status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'withdrawn')),
    submitted_at            timestamptz NOT NULL DEFAULT now(),
    reviewed_at             timestamptz,
    reviewed_by_user_id     uuid REFERENCES users(users_id) ON DELETE SET NULL,
    decision_note           text
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
    ON business_verification_requests (status, submitted_at);

CREATE TABLE IF NOT EXISTS verification_evidence (
    verification_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_request_id   uuid NOT NULL REFERENCES business_verification_requests(verification_request_id) ON DELETE CASCADE,
    media_id                  uuid NOT NULL REFERENCES media_files(media_id) ON DELETE RESTRICT,
    evidence_type             text NOT NULL,
    created_at                timestamptz NOT NULL DEFAULT now(),
    UNIQUE (verification_request_id, media_id)
);

-- -----------------------------------------------------------------------------
-- 6. User-submitted reports, evidence, moderation, and disputes
-- -----------------------------------------------------------------------------

-- These are user claims and must not be presented as verified AI findings.
CREATE TABLE IF NOT EXISTS user_reports (
    user_report_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           uuid NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    submitted_by_user_id uuid REFERENCES users(users_id) ON DELETE SET NULL,
    report_category     text NOT NULL,
    title               text NOT NULL,
    description         text NOT NULL,
    incident_at         timestamptz,
    status              text NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'under_review', 'published', 'rejected', 'withdrawn')),
    submitted_at        timestamptz NOT NULL DEFAULT now(),
    reviewed_at         timestamptz,
    reviewed_by_user_id uuid REFERENCES users(users_id) ON DELETE SET NULL,
    moderation_note     text
);

CREATE INDEX IF NOT EXISTS idx_user_reports_entity_status
    ON user_reports (entity_id, status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS user_report_evidence (
    report_evidence_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_report_id      uuid NOT NULL REFERENCES user_reports(user_report_id) ON DELETE CASCADE,
    media_id            uuid NOT NULL REFERENCES media_files(media_id) ON DELETE RESTRICT,
    evidence_note       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_report_id, media_id)
);

-- Each action applies to exactly one user report or one verification request.
CREATE TABLE IF NOT EXISTS moderation_actions (
    moderation_action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_user_id    uuid NOT NULL REFERENCES users(users_id) ON DELETE RESTRICT,
    user_report_id       uuid REFERENCES user_reports(user_report_id) ON DELETE CASCADE,
    verification_request_id uuid REFERENCES business_verification_requests(verification_request_id) ON DELETE CASCADE,
    action_type          text NOT NULL,
    note                 text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(user_report_id, verification_request_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_report
    ON moderation_actions (user_report_id, created_at DESC)
    WHERE user_report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moderation_actions_verification
    ON moderation_actions (verification_request_id, created_at DESC)
    WHERE verification_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS report_disputes (
    dispute_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_report_id      uuid NOT NULL REFERENCES user_reports(user_report_id) ON DELETE CASCADE,
    filed_by_user_id    uuid REFERENCES users(users_id) ON DELETE SET NULL,
    reason              text NOT NULL,
    status              text NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'under_review', 'resolved', 'rejected', 'withdrawn')),
    reviewer_user_id    uuid REFERENCES users(users_id) ON DELETE SET NULL,
    decision_note       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    resolved_at         timestamptz
);

-- Share links store only a hash of the secret token. Never store the raw token.
CREATE TABLE IF NOT EXISTS investigation_share_links (
    share_link_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id    uuid NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    created_by_user_id  uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
    token_hash          text NOT NULL UNIQUE,
    expires_at          timestamptz,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. updated_at triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION assign_default_user_role()
RETURNS trigger AS $$
BEGIN
    INSERT INTO user_roles (users_id, role_id)
    SELECT NEW.users_id, r.role_id FROM roles r WHERE r.role_key = 'user'
    ON CONFLICT (users_id, role_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_default_user_role ON users;
CREATE TRIGGER trg_assign_default_user_role AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION assign_default_user_role();

DROP TRIGGER IF EXISTS trg_investigations_updated_at ON investigations;
CREATE TRIGGER trg_investigations_updated_at BEFORE UPDATE ON investigations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_entities_updated_at ON entities;
CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_identifiers_updated_at ON identifiers;
CREATE TRIGGER trg_identifiers_updated_at BEFORE UPDATE ON identifiers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_business_profiles_updated_at ON business_profiles;
CREATE TRIGGER trg_business_profiles_updated_at BEFORE UPDATE ON business_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_report_disputes_updated_at ON report_disputes;
CREATE TRIGGER trg_report_disputes_updated_at BEFORE UPDATE ON report_disputes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_providers_updated_at ON ai_providers;
CREATE TRIGGER trg_ai_providers_updated_at BEFORE UPDATE ON ai_providers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_models_updated_at ON ai_models;
CREATE TRIGGER trg_ai_models_updated_at BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER trg_ai_agents_updated_at BEFORE UPDATE ON ai_agents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_task_types_updated_at ON ai_task_types;
CREATE TRIGGER trg_ai_task_types_updated_at BEFORE UPDATE ON ai_task_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_tools_updated_at ON ai_tools;
CREATE TRIGGER trg_ai_tools_updated_at BEFORE UPDATE ON ai_tools
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
