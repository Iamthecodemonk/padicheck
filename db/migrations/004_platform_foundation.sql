-- Approved additive account/platform extension. Original baseline is unchanged.
BEGIN;
CREATE TABLE auth_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  jti_hash text NOT NULL UNIQUE CHECK (length(jti_hash)=64),
  authenticated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at>authenticated_at)
);
CREATE INDEX auth_sessions_owner ON auth_sessions(users_id,expires_at DESC);
CREATE TABLE auth_totp_factors (
  users_id uuid PRIMARY KEY REFERENCES users(users_id) ON DELETE CASCADE,
  secret_ciphertext text,
  pending_ciphertext text,
  pending_expires_at timestamptz,
  enabled_at timestamptz,
  last_counter bigint NOT NULL DEFAULT -1,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts>=0),
  locked_until timestamptz,
  CHECK ((secret_ciphertext IS NULL)=(enabled_at IS NULL)),
  CHECK ((pending_ciphertext IS NULL)=(pending_expires_at IS NULL))
);
CREATE TABLE auth_recovery_codes (
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK(length(code_hash)=64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(users_id,code_hash)
);
CREATE TABLE auth_login_challenges (
  challenge_id uuid PRIMARY KEY,
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_login_challenges_owner ON auth_login_challenges(users_id,expires_at);
CREATE TABLE investigation_bookmarks (
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  investigation_id uuid NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(users_id,investigation_id)
);
CREATE TABLE notification_preferences (
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK(notification_type IN ('investigation.completed','investigation.failed','business.invitation')),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY(users_id,notification_type)
);
CREATE TABLE user_notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK(notification_type IN ('investigation.completed','investigation.failed','business.invitation')),
  event_key text NOT NULL,
  related_id uuid NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(users_id,event_key)
);
CREATE INDEX user_notifications_owner ON user_notifications(users_id,created_at DESC,notification_id);
CREATE TABLE business_memberships (
  business_profile_id uuid NOT NULL REFERENCES business_profiles(business_profile_id) ON DELETE CASCADE,
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  member_role text NOT NULL CHECK(member_role IN ('manager','editor','viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(business_profile_id,users_id)
);
CREATE TABLE business_invitations (
  invitation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id uuid NOT NULL REFERENCES business_profiles(business_profile_id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  email text NOT NULL CHECK(email=lower(email)),
  member_role text NOT NULL CHECK(member_role IN ('manager','editor','viewer')),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(expires_at>created_at)
);
CREATE INDEX business_invitations_recipient ON business_invitations(email,expires_at);
CREATE TABLE user_api_keys (
  api_key_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  users_id uuid NOT NULL REFERENCES users(users_id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE CHECK(length(key_hash)=64),
  scopes text[] NOT NULL CHECK(cardinality(scopes)>0 AND scopes <@ ARRAY['investigations:read','investigations:create']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  rate_window timestamptz NOT NULL DEFAULT date_trunc('minute',now()),
  rate_count integer NOT NULL DEFAULT 0 CHECK(rate_count>=0),
  CHECK(expires_at>created_at)
);
CREATE INDEX user_api_keys_owner ON user_api_keys(users_id,created_at DESC);

-- Notification creation shares the investigation state transaction. No polling gap.
CREATE FUNCTION notify_investigation_terminal() RETURNS trigger AS $$
DECLARE kind text;
BEGIN
  IF NEW.status NOT IN ('completed','failed') OR (TG_OP='UPDATE' AND OLD.status=NEW.status) THEN RETURN NEW; END IF;
  kind := 'investigation.' || NEW.status;
  IF COALESCE((SELECT enabled FROM notification_preferences WHERE users_id=NEW.user_id AND notification_type=kind),true) THEN
    INSERT INTO user_notifications(users_id,notification_type,event_key,related_id)
    VALUES (NEW.user_id,kind,NEW.investigation_id::text || ':' || NEW.status,NEW.investigation_id)
    ON CONFLICT(users_id,event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_investigation_notification AFTER INSERT OR UPDATE OF status ON investigations
FOR EACH ROW EXECUTE FUNCTION notify_investigation_terminal();
CREATE FUNCTION reset_business_team_on_owner_change() RETURNS trigger AS $$
BEGIN
  IF OLD.claimed_by_user_id IS DISTINCT FROM NEW.claimed_by_user_id THEN
    DELETE FROM business_memberships WHERE business_profile_id=NEW.business_profile_id;
    UPDATE business_invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE business_profile_id=NEW.business_profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_business_team_owner_change AFTER UPDATE OF claimed_by_user_id ON business_profiles
FOR EACH ROW EXECUTE FUNCTION reset_business_team_on_owner_change();
COMMIT;
