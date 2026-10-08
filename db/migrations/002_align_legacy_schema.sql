-- Approved legacy alignment migration. Applied explicitly by db:align-legacy.
-- Align the inspected legacy database with the supplied MVP schema.
-- This version deliberately refuses populated affected tables. A populated
-- database needs a separate, reviewed data backfill using Cloudinary metadata
-- and a decision about mapping legacy users.role values to RBAC.
BEGIN;

LOCK TABLE users, media_files, model_runs IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users)
       OR EXISTS (SELECT 1 FROM media_files)
       OR EXISTS (SELECT 1 FROM model_runs) THEN
        RAISE EXCEPTION 'Alignment proposal requires empty users, media_files, and model_runs; refusing data loss';
    END IF;
END $$;

ALTER TABLE users DROP COLUMN role;

ALTER TABLE media_files
    DROP COLUMN storage_key,
    ADD COLUMN storage_provider text NOT NULL DEFAULT 'cloudinary',
    ADD COLUMN provider_asset_id text UNIQUE,
    ADD COLUMN provider_public_id text NOT NULL,
    ADD COLUMN provider_resource_type text NOT NULL
        CHECK (provider_resource_type IN ('image', 'video', 'raw')),
    ADD COLUMN provider_delivery_type text NOT NULL DEFAULT 'authenticated'
        CHECK (provider_delivery_type IN ('upload', 'private', 'authenticated')),
    ADD COLUMN provider_version bigint;

CREATE UNIQUE INDEX uq_media_provider_public_id
    ON media_files (storage_provider, provider_resource_type, provider_public_id);

ALTER TABLE model_runs
    ADD COLUMN task_id uuid REFERENCES ai_task_types(task_id) ON DELETE SET NULL,
    ADD COLUMN assignment_id uuid REFERENCES ai_task_assignments(assignment_id) ON DELETE SET NULL,
    ADD COLUMN agent_id uuid REFERENCES ai_agents(agent_id) ON DELETE SET NULL,
    ADD COLUMN model_id uuid REFERENCES ai_models(model_id) ON DELETE SET NULL;

COMMIT;
