-- ============================================================================
-- Create the social_content_bank table used by the /admin/social "Compose"
-- post generator. Without it, GET /api/social/ai/content-bank (and the
-- /generate-batch + /content-bank/:id/refresh-media endpoints) return 500.
-- ----------------------------------------------------------------------------
-- Idempotent. Safe to re-run.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-20_social_content_bank.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS social_content_bank (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caption               TEXT NOT NULL,
  media_url             TEXT,
  media_type            TEXT NOT NULL,
  prediction_id         TEXT,
  source_image_url      TEXT,
  source_topic          TEXT,
  enhanced_prompt       TEXT,
  generation_settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'available',
  created_by_user_id    UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_content_bank_media_type_check
    CHECK (media_type IN ('image', 'video')),
  CONSTRAINT social_content_bank_status_check
    CHECK (status IN ('available', 'pending_media', 'media_failed', 'archived'))
);

CREATE INDEX IF NOT EXISTS social_content_bank_status_idx
  ON social_content_bank (status);
CREATE INDEX IF NOT EXISTS social_content_bank_created_at_idx
  ON social_content_bank (created_at DESC);

COMMIT;
