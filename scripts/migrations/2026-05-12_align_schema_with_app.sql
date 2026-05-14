-- ============================================================================
-- Bring the live local-Postgres database in line with what the app expects.
-- ----------------------------------------------------------------------------
-- Symptoms this fixes (observed on /app/admin/settings/services):
--   * 500 on  GET /api/db/service_required_documents?...order=sort_order.asc
--       → column `sort_order` did not exist
--   * 500 on  GET /api/db/users?id=...
--       → Header.tsx selects `default_avatar_design`, missing on users
--   * 500 on  GET /api/db/email_addresses?...is_primary=true
--       → Header.tsx fetchClientEmail filters by `address_type` etc.; the
--         live `email_addresses` table only had {id,user_id,address,label,
--         is_primary,created_at,updated_at} — far from what the app needs
--   * `services` could be created but step/tax totals were silently dropped
--     because the columns were not present
--
-- All ALTER statements are idempotent (`ADD COLUMN IF NOT EXISTS`) so this
-- script is safe to re-run.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-12_align_schema_with_app.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. services — staggered / tax columns used by Admin → Settings → Services.
-- ---------------------------------------------------------------------------
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS total_step1 NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS total_step2 NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_amount  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_step1   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_step2   NUMERIC(10,2);

-- ---------------------------------------------------------------------------
-- 2. service_required_documents — columns the admin UI orders/filters by.
-- ---------------------------------------------------------------------------
ALTER TABLE service_required_documents
  ADD COLUMN IF NOT EXISTS service_type     TEXT,
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS accepted_formats TEXT[] NOT NULL DEFAULT ARRAY['.pdf','.jpg','.jpeg','.png'],
  ADD COLUMN IF NOT EXISTS sort_order       INTEGER NOT NULL DEFAULT 0;

-- The new admin UI keys requirements by service_type, not service_id; relax
-- the legacy FK column so inserts without a service_id are allowed.
ALTER TABLE service_required_documents
  ALTER COLUMN service_id DROP NOT NULL;

-- Backfill the new `name` column from the legacy `label` column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'service_required_documents' AND column_name = 'label'
  ) THEN
    EXECUTE 'UPDATE service_required_documents
                SET name = COALESCE(NULLIF(name, ''''), label)
              WHERE name IS NULL OR name = ''''';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. users — Header.tsx selects this; ensure it exists.
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_avatar_design TEXT;

-- ---------------------------------------------------------------------------
-- 4. email_addresses — the live table only had {id,user_id,address,label,
--    is_primary,...}. The app reads/writes a much richer shape. Add the
--    missing columns and backfill email_address from the legacy `address`.
-- ---------------------------------------------------------------------------
ALTER TABLE email_addresses
  ADD COLUMN IF NOT EXISTS email_address        TEXT,
  ADD COLUMN IF NOT EXISTS display_name         TEXT,
  ADD COLUMN IF NOT EXISTS is_system_address    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_type         TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS department           TEXT,
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_send             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_receive          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS forward_to_email     TEXT,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_message   TEXT,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at         TIMESTAMPTZ;

-- The user_id NOT NULL constraint blocks the app from creating system
-- (admin/support/department) addresses with no owning user.
ALTER TABLE email_addresses
  ALTER COLUMN user_id DROP NOT NULL;

-- The legacy `address` column is NOT NULL but the app now writes
-- `email_address` exclusively. Relax the constraint so new inserts succeed.
-- (No code path still reads `address`; it's kept for historical rows only.)
ALTER TABLE email_addresses
  ALTER COLUMN address DROP NOT NULL;

-- Backfill the new `email_address` column from the legacy `address` column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'email_addresses' AND column_name = 'address'
  ) THEN
    EXECUTE 'UPDATE email_addresses
                SET email_address = COALESCE(NULLIF(email_address, ''''), address)
              WHERE email_address IS NULL OR email_address = ''''';
  END IF;
END $$;

-- Useful indexes for the queries the app issues.
CREATE INDEX IF NOT EXISTS email_addresses_address_type_idx ON email_addresses(address_type);
CREATE INDEX IF NOT EXISTS email_addresses_email_address_idx ON email_addresses(email_address);
CREATE INDEX IF NOT EXISTS email_addresses_is_active_idx     ON email_addresses(is_active);

-- ---------------------------------------------------------------------------
-- 4b. email_signatures — the live table has `is_default` but the app filters
--     by `is_active`. Add it; default true so existing rows count as active.
-- ---------------------------------------------------------------------------
ALTER TABLE email_signatures
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 4c. email_logs — full-feature log shape used by the Emails admin / client
--     pages and the email-service. Baseline only had {id, to/from_address,
--     subject, body, status, error, sent_at}; expand to the application's
--     expected fields (see src/lib/email-api.ts EmailLog interface).
-- ---------------------------------------------------------------------------
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

-- Backfill the new recipient_email / sender_email from the legacy
-- to_address / from_address columns so historical rows still surface
-- meaningfully in the UI.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'email_logs' AND column_name = 'to_address'
  ) THEN
    EXECUTE 'UPDATE email_logs
                SET recipient_email = COALESCE(NULLIF(recipient_email, ''''), to_address)
              WHERE recipient_email IS NULL OR recipient_email = ''''';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'email_logs' AND column_name = 'from_address'
  ) THEN
    EXECUTE 'UPDATE email_logs
                SET sender_email = COALESCE(NULLIF(sender_email, ''''), from_address)
              WHERE sender_email IS NULL OR sender_email = ''''';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'email_logs' AND column_name = 'error'
  ) THEN
    EXECUTE 'UPDATE email_logs
                SET error_message = COALESCE(NULLIF(error_message, ''''), error)
              WHERE error_message IS NULL OR error_message = ''''';
  END IF;
END $$;

-- Relax the legacy to_address NOT NULL — new inserts only set
-- recipient_email / to_email_address_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'email_logs' AND column_name = 'to_address' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE email_logs ALTER COLUMN to_address DROP NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_logs_from_email_address_id_idx ON email_logs(from_email_address_id);
CREATE INDEX IF NOT EXISTS email_logs_to_email_address_id_idx   ON email_logs(to_email_address_id);
CREATE INDEX IF NOT EXISTS email_logs_recipient_user_id_idx     ON email_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS email_logs_status_idx                ON email_logs(status);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx            ON email_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. user_details — same unified-profile work from the earlier migration.
--    Re-stated here so a single script brings everything in line. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS first_name              TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS middle_name             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS last_name               TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS email                   TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS mobile_number           TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS marital_status          TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS single_full_name        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS birth_place             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS country_of_birth        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS house_number            TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS street_name             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS province                TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS zipcode                 TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_school           TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_city             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_province         TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_country          TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_years_attended   TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_start_date       DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_end_date         DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school                 TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_city            TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_province        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_country         TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_years_attended  TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_start_date      DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_end_date        DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_graduated       TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_diploma_type    TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_diploma_date    DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school                 TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_city            TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_province        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_country         TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_years_attended  TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_start_date      DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_end_date        DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_major           TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_diploma_date    DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS signature              TEXT;

COMMIT;

-- ============================================================================
-- Done.  Verify by re-running:
--   node scripts/_diag_schema.cjs
-- ============================================================================
