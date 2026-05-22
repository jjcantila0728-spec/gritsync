-- ============================================================================
-- Align email_queue, email_analytics, business_logos with the column names the
-- client APIs actually query. Vercel runtime logs were 500ing with
-- "column ... does not exist" because the existing schema uses
-- to_address/html_body/scheduled_at on email_queue, name/file_path on
-- business_logos, and event-log columns on email_analytics — while
-- src/lib/email-queue-api.ts, src/lib/email-signatures-api.ts, and
-- src/lib/email-api.ts query recipient_email/body_html/scheduled_for,
-- file_name/storage_path/logo_type, and date/sent_count/delivered_count.
--
-- Strategy: ADD COLUMN IF NOT EXISTS for every column the client expects,
-- so queries succeed (returning NULL/0 for empty rows) without disturbing
-- existing data. Old columns stay in place for backward compat.
-- ----------------------------------------------------------------------------
-- Idempotent. Safe to re-run.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-22_align_email_and_logos_with_app.sql
-- ============================================================================

BEGIN;

-- ── email_queue ──────────────────────────────────────────────────────────────
-- Client (src/lib/email-queue-api.ts EmailQueueItem) expects these columns:
ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS recipient_email        TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name         TEXT,
  ADD COLUMN IF NOT EXISTS recipient_user_id      UUID,
  ADD COLUMN IF NOT EXISTS body_html              TEXT,
  ADD COLUMN IF NOT EXISTS body_text              TEXT,
  ADD COLUMN IF NOT EXISTS sender_email           TEXT,
  ADD COLUMN IF NOT EXISTS sender_name            TEXT,
  ADD COLUMN IF NOT EXISTS from_email_address_id  UUID,
  ADD COLUMN IF NOT EXISTS scheduled_for          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone               TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS email_type             TEXT,
  ADD COLUMN IF NOT EXISTS email_category         TEXT,
  ADD COLUMN IF NOT EXISTS priority               INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_retries            INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS application_id         UUID,
  ADD COLUMN IF NOT EXISTS quotation_id           UUID,
  ADD COLUMN IF NOT EXISTS donation_id            UUID,
  ADD COLUMN IF NOT EXISTS sponsorship_id         UUID,
  ADD COLUMN IF NOT EXISTS metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags                   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by_user_id     UUID,
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill the new columns from the legacy ones so existing rows still work.
UPDATE email_queue
   SET recipient_email = COALESCE(recipient_email, to_address),
       body_html       = COALESCE(body_html, html_body),
       body_text       = COALESCE(body_text, text_body),
       sender_email    = COALESCE(sender_email, from_address),
       scheduled_for   = COALESCE(scheduled_for, scheduled_at)
 WHERE recipient_email IS NULL
    OR body_html IS NULL
    OR body_text IS NULL
    OR sender_email IS NULL
    OR scheduled_for IS NULL;

-- Drop the NOT NULL on to_address so new INSERTs that only set recipient_email
-- don't 23502. Same idea as the email_logs version of this DO block.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='email_queue'
                AND column_name='to_address'
                AND is_nullable='NO') THEN
    EXECUTE 'ALTER TABLE email_queue ALTER COLUMN to_address DROP NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_queue_scheduled_for_idx     ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS email_queue_recipient_email_idx   ON email_queue(recipient_email);
CREATE INDEX IF NOT EXISTS email_queue_email_type_idx        ON email_queue(email_type);
CREATE INDEX IF NOT EXISTS email_queue_email_category_idx    ON email_queue(email_category);
CREATE INDEX IF NOT EXISTS email_queue_created_by_user_id_idx ON email_queue(created_by_user_id);

-- ── business_logos ───────────────────────────────────────────────────────────
-- Client (src/lib/email-signatures-api.ts BusinessLogo) expects these:
ALTER TABLE business_logos
  ADD COLUMN IF NOT EXISTS file_name         TEXT,
  ADD COLUMN IF NOT EXISTS file_size         BIGINT,
  ADD COLUMN IF NOT EXISTS file_type         TEXT,
  ADD COLUMN IF NOT EXISTS storage_path      TEXT,
  ADD COLUMN IF NOT EXISTS public_url        TEXT,
  ADD COLUMN IF NOT EXISTS width             INTEGER,
  ADD COLUMN IF NOT EXISTS height            INTEGER,
  ADD COLUMN IF NOT EXISTS logo_type         TEXT NOT NULL DEFAULT 'company_logo',
  ADD COLUMN IF NOT EXISTS uploaded_by       UUID,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS usage_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alt_text          TEXT,
  ADD COLUMN IF NOT EXISTS associated_email  TEXT,
  ADD COLUMN IF NOT EXISTS metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill from legacy columns where possible.
UPDATE business_logos
   SET file_name    = COALESCE(file_name, name),
       storage_path = COALESCE(storage_path, file_path)
 WHERE file_name IS NULL OR storage_path IS NULL;

-- Constrain logo_type to the values the client filters on.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_logos_logo_type_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE business_logos
        ADD CONSTRAINT business_logos_logo_type_check
        CHECK (logo_type IN ('company_logo','email_header','email_signature','favicon','avatar'))
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS business_logos_logo_type_idx  ON business_logos(logo_type);
CREATE INDEX IF NOT EXISTS business_logos_is_active_idx  ON business_logos(is_active);
CREATE INDEX IF NOT EXISTS business_logos_is_default_idx ON business_logos(is_default);

-- ── email_signatures ─────────────────────────────────────────────────────────
-- Client (src/lib/email-signatures-api.ts EmailSignature) queries:
--   .or('user_id.eq.<id>,signature_type.eq.company').eq('is_active', true)
-- and selects signature_html / signature_text / many display fields. Add the
-- ones it expects; existing `html` is preserved.
ALTER TABLE email_signatures
  ADD COLUMN IF NOT EXISTS signature_html       TEXT,
  ADD COLUMN IF NOT EXISTS signature_text       TEXT,
  ADD COLUMN IF NOT EXISTS signature_type       TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS font_family          TEXT,
  ADD COLUMN IF NOT EXISTS font_size            INTEGER,
  ADD COLUMN IF NOT EXISTS text_color           TEXT,
  ADD COLUMN IF NOT EXISTS link_color           TEXT,
  ADD COLUMN IF NOT EXISTS full_name            TEXT,
  ADD COLUMN IF NOT EXISTS job_title            TEXT,
  ADD COLUMN IF NOT EXISTS department           TEXT,
  ADD COLUMN IF NOT EXISTS company_name         TEXT,
  ADD COLUMN IF NOT EXISTS email                TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS mobile               TEXT,
  ADD COLUMN IF NOT EXISTS website              TEXT,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS social_links         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url             TEXT,
  ADD COLUMN IF NOT EXISTS logo_width           INTEGER,
  ADD COLUMN IF NOT EXISTS logo_height          INTEGER,
  ADD COLUMN IF NOT EXISTS show_logo            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_disclaimer      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disclaimer_text      TEXT,
  ADD COLUMN IF NOT EXISTS show_company_tagline BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS company_tagline      TEXT,
  ADD COLUMN IF NOT EXISTS custom_css           TEXT,
  ADD COLUMN IF NOT EXISTS metadata             JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill signature_html from the legacy `html` column.
UPDATE email_signatures
   SET signature_html = COALESCE(signature_html, html)
 WHERE signature_html IS NULL AND html IS NOT NULL;

-- Constrain signature_type to the union the client uses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_signatures_signature_type_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE email_signatures
        ADD CONSTRAINT email_signatures_signature_type_check
        CHECK (signature_type IN ('personal','company','department'))
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_signatures_user_id_idx        ON email_signatures(user_id);
CREATE INDEX IF NOT EXISTS email_signatures_signature_type_idx ON email_signatures(signature_type);
CREATE INDEX IF NOT EXISTS email_signatures_is_active_idx      ON email_signatures(is_active);

-- ── email_analytics ──────────────────────────────────────────────────────────
-- Client (src/lib/email-api.ts EmailAnalytics) expects these aggregate columns
-- — even though our existing email_analytics table is an event log, adding
-- these columns makes the `SELECT * .gte('date', …)` query succeed (it just
-- returns rows with NULL aggregates for now). The Resend webhook still writes
-- event-log rows via the original (email_id, event_type, occurred_at) columns,
-- which stay in place.
ALTER TABLE email_analytics
  ADD COLUMN IF NOT EXISTS date                   DATE,
  ADD COLUMN IF NOT EXISTS email_type             TEXT,
  ADD COLUMN IF NOT EXISTS email_category         TEXT,
  ADD COLUMN IF NOT EXISTS status                 TEXT,
  ADD COLUMN IF NOT EXISTS count                  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_count             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_count          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_send_time_seconds  NUMERIC NOT NULL DEFAULT 0;

-- Backfill `date` from `occurred_at` so existing event rows show up in the
-- dashboard's day-grouping logic instead of vanishing under .gte('date',…).
UPDATE email_analytics
   SET date = (occurred_at AT TIME ZONE 'UTC')::DATE
 WHERE date IS NULL AND occurred_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_analytics_date_idx ON email_analytics(date);

COMMIT;
