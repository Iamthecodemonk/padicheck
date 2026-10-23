BEGIN;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS profile_details jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
