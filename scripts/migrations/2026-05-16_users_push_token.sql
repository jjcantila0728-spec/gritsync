-- ============================================================================
-- Add mobile push notification columns to users.
--
-- The mobile app (mobile/) registers an Expo push token via
-- `Notifications.getExpoPushTokenAsync()` and PUTs it to /api/auth/update.
-- The server fans out from notifications-table INSERTs via
-- server/lib/push.ts (uses expo-server-sdk).
--
-- Columns:
--   push_token    — Expo push token (ExponentPushToken[...] format, ~80 chars)
--                   or APNs / FCM token if a future build bypasses Expo.
--                   NULL when the user has opted out / signed out.
--   push_platform — 'ios' | 'android' | 'web' — informational, lets the worker
--                   pick the right service when we eventually split off APNs.
--   push_token_updated_at — last time we received a token from the device.
--                           Used by the cron pruner to drop stale tokens.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_platform TEXT,
  ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Track when the token was last set/refreshed so the cron pruner can drop
-- tokens that haven't checked in for >90 days.
CREATE OR REPLACE FUNCTION users_touch_push_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.push_token IS DISTINCT FROM OLD.push_token THEN
    NEW.push_token_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_push_token_touch ON users;
CREATE TRIGGER users_push_token_touch
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION users_touch_push_token_updated_at();

-- Index used by the worker to pull `users` rows when fanning out a
-- notification to N recipients in bulk.
CREATE INDEX IF NOT EXISTS users_push_token_idx
  ON users (id)
  WHERE push_token IS NOT NULL;
