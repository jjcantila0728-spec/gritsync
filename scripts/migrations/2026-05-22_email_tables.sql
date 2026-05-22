-- ============================================================================
-- Create the email_logs, email_queue, and email_analytics tables used by
-- /admin/emails/{analytics,scheduled}. Without these tables prod returns
-- "Failed to load scheduled emails / analytics. Table may not exist yet."
-- ----------------------------------------------------------------------------
-- Idempotent — safe to re-run. Mirrors the shape defined in init.sql, with the
-- later ALTER TABLE migrations flattened into a single CREATE.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-22_email_tables.sql
-- ============================================================================

BEGIN;

-- ── email_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id                      SERIAL PRIMARY KEY,
  to_address              TEXT,
  from_address            TEXT,
  subject                 TEXT,
  body                    TEXT,
  status                  TEXT NOT NULL DEFAULT 'sent',
  error                   TEXT,
  sent_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columns added by later in-line migrations in init.sql.
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS recipient_email        TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name         TEXT,
  ADD COLUMN IF NOT EXISTS recipient_user_id      UUID,
  ADD COLUMN IF NOT EXISTS body_html              TEXT,
  ADD COLUMN IF NOT EXISTS body_text              TEXT,
  ADD COLUMN IF NOT EXISTS sender_email           TEXT,
  ADD COLUMN IF NOT EXISTS sender_name            TEXT,
  ADD COLUMN IF NOT EXISTS sent_by_user_id        UUID,
  ADD COLUMN IF NOT EXISTS email_type             TEXT,
  ADD COLUMN IF NOT EXISTS email_category         TEXT,
  ADD COLUMN IF NOT EXISTS email_provider         TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id    TEXT,
  ADD COLUMN IF NOT EXISTS provider_response      JSONB,
  ADD COLUMN IF NOT EXISTS error_message          TEXT,
  ADD COLUMN IF NOT EXISTS error_code             TEXT,
  ADD COLUMN IF NOT EXISTS retry_count            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries            INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS application_id         UUID,
  ADD COLUMN IF NOT EXISTS quotation_id           UUID,
  ADD COLUMN IF NOT EXISTS donation_id            UUID,
  ADD COLUMN IF NOT EXISTS sponsorship_id         UUID,
  ADD COLUMN IF NOT EXISTS metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags                   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS from_email_address_id  UUID,
  ADD COLUMN IF NOT EXISTS to_email_address_id    UUID,
  ADD COLUMN IF NOT EXISTS delivered_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Drop the legacy NOT NULL on to_address now that we use to_email_address_id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='email_logs'
                AND column_name='to_address'
                AND is_nullable='NO') THEN
    EXECUTE 'ALTER TABLE email_logs ALTER COLUMN to_address DROP NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_logs_from_email_address_id_idx ON email_logs(from_email_address_id);
CREATE INDEX IF NOT EXISTS email_logs_to_email_address_id_idx   ON email_logs(to_email_address_id);
CREATE INDEX IF NOT EXISTS email_logs_recipient_user_id_idx     ON email_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS email_logs_status_idx                ON email_logs(status);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx            ON email_logs(created_at DESC);

-- ── email_queue ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_queue (
  id                   SERIAL PRIMARY KEY,
  to_address           TEXT NOT NULL,
  from_address         TEXT,
  subject              TEXT,
  html_body            TEXT,
  text_body            TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  retry_count          INTEGER NOT NULL DEFAULT 0,
  scheduled_at         TIMESTAMPTZ,
  processed_at         TIMESTAMPTZ,
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS sent_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id  TEXT,
  ADD COLUMN IF NOT EXISTS provider_response    JSONB,
  ADD COLUMN IF NOT EXISTS error_message        TEXT;

CREATE INDEX IF NOT EXISTS email_queue_status_idx       ON email_queue(status);
CREATE INDEX IF NOT EXISTS email_queue_scheduled_at_idx ON email_queue(scheduled_at);

-- ── email_analytics (event log referenced by refresh_email_analytics RPC) ───
CREATE TABLE IF NOT EXISTS email_analytics (
  id          SERIAL PRIMARY KEY,
  email_id    INTEGER REFERENCES email_logs(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_analytics_email_id_idx    ON email_analytics(email_id);
CREATE INDEX IF NOT EXISTS email_analytics_event_type_idx  ON email_analytics(event_type);
CREATE INDEX IF NOT EXISTS email_analytics_occurred_at_idx ON email_analytics(occurred_at DESC);

-- The frontend calls this RPC after writing an event; it's a no-op stub today
-- so the call doesn't 404.
CREATE OR REPLACE FUNCTION refresh_email_analytics()
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;

COMMIT;
