-- ============================================================================
-- Bring `quotations` in line with the columns the app actually reads/writes.
-- ----------------------------------------------------------------------------
-- Symptoms this fixes:
--   * 500 on POST /api/db/quotations from /quote (createPublic / NewQuotation)
--       → "column \"description\" of relation \"quotations\" does not exist"
--   * Same root cause for service, payment_type, line_items, client_first_name,
--     client_last_name, client_email, client_mobile, validity_date — all
--     present in src/lib/database.types.ts but missing from init.sql.
--
-- All ALTERs are idempotent (`ADD COLUMN IF NOT EXISTS`). The legacy columns
-- (full_name, email, mobile, service_type, notes) are left in place so any
-- old rows that pre-date the schema split still load.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-13_quotations_align_with_app.sql
-- ============================================================================

BEGIN;

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS service           TEXT,
  ADD COLUMN IF NOT EXISTS payment_type      TEXT,
  ADD COLUMN IF NOT EXISTS line_items        JSONB,
  ADD COLUMN IF NOT EXISTS client_first_name TEXT,
  ADD COLUMN IF NOT EXISTS client_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS client_email      TEXT,
  ADD COLUMN IF NOT EXISTS client_mobile     TEXT,
  ADD COLUMN IF NOT EXISTS validity_date     TIMESTAMPTZ;

-- Backfill the new columns from the legacy ones so existing rows continue
-- to render in the UI. Only fills where the new column is still NULL.
UPDATE quotations
   SET description  = COALESCE(description, notes),
       service      = COALESCE(service, service_type),
       client_email = COALESCE(client_email, email),
       client_mobile = COALESCE(client_mobile, mobile);

-- Split full_name into first/last when the new columns are still empty.
UPDATE quotations
   SET client_first_name = COALESCE(client_first_name, split_part(full_name, ' ', 1)),
       client_last_name  = COALESCE(
         client_last_name,
         NULLIF(regexp_replace(full_name, '^\S+\s*', ''), '')
       )
 WHERE full_name IS NOT NULL AND full_name <> '';

COMMIT;
