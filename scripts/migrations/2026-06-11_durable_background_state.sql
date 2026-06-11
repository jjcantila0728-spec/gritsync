-- Durable background-processing state (P1 of docs/IMPROVEMENT-PLAN.md).
-- Replaces in-process state that dies on restart / serverless cold start:
--   * push_tickets  — Expo push receipt tracking (was an in-memory Set that
--                     was never even populated; receipt polling was a no-op)
--   * webhook_queue — raw Meta webhook payloads persisted before the 200 ack
--                     so a crash mid-processing can be retried
--   * cron_runs     — observability for /api/cron/tick (was: silence)
-- email_queue already exists in init.sql but is recreated here defensively —
-- DBs provisioned before init.sql grew it won't have the table.

CREATE TABLE IF NOT EXISTS push_tickets (
  ticket_id  TEXT PRIMARY KEY,
  token      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_tickets_created ON push_tickets (created_at);

CREATE TABLE IF NOT EXISTS webhook_queue (
  id           BIGSERIAL PRIMARY KEY,
  platform     TEXT NOT NULL,
  payload      JSONB NOT NULL,
  -- processing | pending | done | failed
  status       TEXT NOT NULL DEFAULT 'processing',
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status ON webhook_queue (status, created_at);

CREATE TABLE IF NOT EXISTS cron_runs (
  id          BIGSERIAL PRIMARY KEY,
  job         TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  ok          BOOLEAN,
  log         JSONB
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started ON cron_runs (job, started_at DESC);

CREATE TABLE IF NOT EXISTS email_queue (
  id             SERIAL PRIMARY KEY,
  to_address     TEXT NOT NULL,
  from_address   TEXT,
  subject        TEXT,
  html_body      TEXT,
  text_body      TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  retry_count    INTEGER NOT NULL DEFAULT 0,
  scheduled_at   TIMESTAMPTZ,
  processed_at   TIMESTAMPTZ,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS error_message TEXT;
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue (status, scheduled_at);
