-- ============================================================================
-- Bring `donations` in line with the columns the app actually reads/writes.
-- ----------------------------------------------------------------------------
-- Symptom this fixes:
--   * 500 on POST /api/db/donations from /donate
--       → "Could not find the 'donor_phone' column of 'donations' in the
--          schema cache"
--   * Same root cause for is_anonymous, payment_method, stripe_payment_intent_id,
--     transaction_id, sponsorship_id, updated_at — all present in
--     src/lib/database.types.ts but missing from init.sql.
--
-- All ALTERs are idempotent (`ADD COLUMN IF NOT EXISTS`). The legacy column
-- `stripe_intent_id` is left in place; the app uses `stripe_payment_intent_id`,
-- so we backfill the new column from the old one for any pre-existing rows.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-20_donations_align_with_app.sql
-- ============================================================================

BEGIN;

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS donor_phone              TEXT,
  ADD COLUMN IF NOT EXISTS is_anonymous             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method           TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id           TEXT,
  ADD COLUMN IF NOT EXISTS sponsorship_id           INTEGER REFERENCES nclex_sponsorships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill the new payment-intent column from the legacy one so the admin UI
-- continues to render pre-existing rows.
UPDATE donations
   SET stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, stripe_intent_id);

CREATE INDEX IF NOT EXISTS idx_donations_sponsorship_id ON donations(sponsorship_id);
CREATE INDEX IF NOT EXISTS idx_donations_status         ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at     ON donations(created_at);

COMMIT;
