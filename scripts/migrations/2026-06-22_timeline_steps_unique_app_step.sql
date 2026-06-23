-- Migration: add the UNIQUE (application_id, step_key) constraint that the
-- timeline upsert relies on.
--
-- src/lib/api-service.ts -> timelineStepsAPI.update() saves every timeline step
-- (and sub-step) with:
--     db.from('application_timeline_steps')
--       .upsert(upsertData, { onConflict: 'application_id,step_key' })
--
-- The 2026-06-22_reconcile_payment_timeline_columns migration added the
-- `step_key` column but never created a matching unique constraint/index, so
-- PostgREST's INSERT ... ON CONFLICT (application_id, step_key) failed with:
--     "there is no unique or exclusion constraint matching the ON CONFLICT
--      specification"
--
-- This affected EVERY step that went through the upsert (the "Generate Letter
-- for school" sub-step is just where it first surfaced). A unique index on
-- (application_id, step_key) is what ON CONFLICT inference needs, and fixes the
-- whole timeline at once.
--
-- Verified safe before writing: 0 duplicate (application_id, step_key) rows and
-- 0 NULL step_key rows in the live table, so the index builds cleanly.
-- CREATE UNIQUE INDEX IF NOT EXISTS is idempotent — safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS application_timeline_steps_app_step_uniq
  ON public.application_timeline_steps (application_id, step_key);
