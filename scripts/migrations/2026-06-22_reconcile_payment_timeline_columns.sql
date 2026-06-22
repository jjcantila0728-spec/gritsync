-- Migration: reconcile application_payments + application_timeline_steps with
-- the columns the app actually reads/writes.
--
-- The frontend (src/lib/api-service.ts) and several read paths
-- (Admin/Client payment pages, Dashboard, timeline UI) reference columns that
-- never existed on the live "thin" tables, which produced PGRST204
-- "Could not find the '<col>' column ... in the schema cache" errors on the
-- payment-checkout and application-timeline flows. The /api/db proxy now drops
-- unknown columns so writes no longer 500, but these columns carry real data
-- (proof of payment, GCash refs, stored PDF paths, timeline step identity), so
-- we add them here to keep the features working.
--
-- All ADD COLUMN IF NOT EXISTS — safe to re-run.

-- ── application_payments ──────────────────────────────────────────────────
ALTER TABLE public.application_payments
  ADD COLUMN IF NOT EXISTS proof_of_payment_file_path text,
  ADD COLUMN IF NOT EXISTS proof_url                  text,
  ADD COLUMN IF NOT EXISTS transaction_id             text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   text,
  ADD COLUMN IF NOT EXISTS gcash_number               text,
  ADD COLUMN IF NOT EXISTS gcash_reference            text,
  ADD COLUMN IF NOT EXISTS receipt_file_path          text,
  ADD COLUMN IF NOT EXISTS invoice_file_path          text,
  ADD COLUMN IF NOT EXISTS service_fee_amount         numeric;

-- Backfill the new stripe column from the legacy stripe_intent_id where present
-- so existing rows keep their reference under the name the app reads.
UPDATE public.application_payments
   SET stripe_payment_intent_id = stripe_intent_id
 WHERE stripe_payment_intent_id IS NULL
   AND stripe_intent_id IS NOT NULL;

-- ── application_timeline_steps ────────────────────────────────────────────
-- The API identifies steps by a stable key/name and tracks an optional parent
-- and the payment type a step belongs to; none of these existed as columns.
ALTER TABLE public.application_timeline_steps
  ADD COLUMN IF NOT EXISTS step_key     text,
  ADD COLUMN IF NOT EXISTS step_name    text,
  ADD COLUMN IF NOT EXISTS parent_step  text,
  ADD COLUMN IF NOT EXISTS payment_type text;
