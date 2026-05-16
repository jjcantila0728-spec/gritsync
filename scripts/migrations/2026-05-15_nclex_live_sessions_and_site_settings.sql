-- ============================================================================
-- NCLEX live lectures (Zoom-powered) + group support URL setting.
-- ----------------------------------------------------------------------------
-- Feeds the Live Lectures section on review.gritsync.com. Admin creates rows
-- via /admin/nclex → Live Sessions. Client lists upcoming + past via
-- GET /api/nclex/live-sessions. No Zoom API integration here — admin pastes
-- the join URL they create in Zoom themselves.
--
-- Also seeds the group_support_url setting so the "Group Support" nav item on
-- the review subapp picks up the right Facebook group link from the database
-- rather than hardcoding it.
--
-- Idempotent. Safe to re-run.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-15_nclex_live_sessions_and_site_settings.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nclex_live_sessions (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    INT NOT NULL DEFAULT 60,
  zoom_join_url   TEXT,
  zoom_meeting_id TEXT,
  zoom_passcode   TEXT,
  recording_url   TEXT,
  instructor      TEXT,
  topic           TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | past | cancelled
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nclex_live_sessions_scheduled_at_idx
  ON nclex_live_sessions (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS nclex_live_sessions_active_status_idx
  ON nclex_live_sessions (is_active, status);

-- Seed the group_support_url setting if missing. Admin can override via the
-- Plans & Pricing tab later.
INSERT INTO nclex_site_settings (id, key, value)
SELECT gen_random_uuid()::text, 'group_support_url',
       'https://www.facebook.com/share/g/1EfkpWjCvf/?mibextid=wwXIfr'
WHERE NOT EXISTS (
  SELECT 1 FROM nclex_site_settings WHERE key = 'group_support_url'
);

COMMIT;
