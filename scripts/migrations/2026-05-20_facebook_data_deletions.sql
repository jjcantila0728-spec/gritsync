-- ============================================================================
-- Track Facebook's data-deletion callbacks so the status URL Meta shows the
-- user can be looked up later. Required by Meta's "Data Deletion Callback
-- URL" spec for any app that uses Facebook Login.
-- ----------------------------------------------------------------------------
-- How it works:
--   1. User goes to facebook.com → Settings → Apps → GritSync → Remove.
--   2. Meta posts a signed_request to our callback URL with the fb_user_id.
--   3. We delete all social_accounts rows owned by that fb_user_id and
--      insert one row here as proof, generating a confirmation_code.
--   4. Meta shows the user our status URL with ?id=<row id>, and our
--      public status page reads this table to display the confirmation.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-20_facebook_data_deletions.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS facebook_data_deletions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_user_id         TEXT NOT NULL,
  confirmation_code  TEXT NOT NULL,
  rows_deleted       INTEGER NOT NULL DEFAULT 0,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS facebook_data_deletions_fb_user_id_idx
  ON facebook_data_deletions (fb_user_id);

COMMIT;
