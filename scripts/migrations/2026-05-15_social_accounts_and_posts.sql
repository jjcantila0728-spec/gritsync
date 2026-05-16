-- ============================================================================
-- Create the social_accounts + social_posts tables that /admin/social and the
-- scheduler in server/routes/social.ts read/write. Without these tables prod
-- returns 500 on GET /api/social/accounts and GET /api/social/posts.
-- ----------------------------------------------------------------------------
-- Idempotent. Safe to re-run.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-15_social_accounts_and_posts.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS social_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform              TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  platform_user_id      TEXT NOT NULL,
  access_token          TEXT,
  refresh_token         TEXT,
  token_expires_at      TIMESTAMPTZ,
  profile_url           TEXT,
  avatar_url            TEXT,
  scopes                TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'connected',
  last_error            TEXT,
  connected_by_user_id  TEXT,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_accounts_platform_user_unique UNIQUE (platform, platform_user_id)
);

CREATE INDEX IF NOT EXISTS social_accounts_platform_idx
  ON social_accounts (platform);
CREATE INDEX IF NOT EXISTS social_accounts_status_idx
  ON social_accounts (status);

CREATE TABLE IF NOT EXISTS social_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_ids           UUID[] NOT NULL DEFAULT '{}',
  content               TEXT NOT NULL,
  media_urls            JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_at          TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'draft',
  results               JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error            TEXT,
  created_by_user_id    UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_posts_status_idx
  ON social_posts (status);
CREATE INDEX IF NOT EXISTS social_posts_scheduled_at_idx
  ON social_posts (scheduled_at);

COMMIT;
