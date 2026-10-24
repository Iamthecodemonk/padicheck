BEGIN;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS browser_token_hash text CHECK(browser_token_hash IS NULL OR browser_token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS browser_jti uuid;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS browser_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_browser_token ON auth_sessions(browser_token_hash) WHERE browser_token_hash IS NOT NULL;
COMMIT;
