-- Migration: reconcile processing_accounts with the columns the app uses.
--
-- Both the dedicated route (server/routes/processing-accounts.ts, raw SQL) and
-- the frontend API (src/lib/api-service.ts) treat processing_accounts as
-- application-scoped with credential + security-question columns, but the live
-- table was thin (user_id, account_type, username, password_hint, notes) and
-- had none of them. The route's raw INSERT therefore failed with
-- 42703 "column application_id does not exist", and the /api/db proxy's
-- application-scoped ownership filter (keyed on application_id) 42703'd on
-- reads. Add the missing columns so both paths work.
--
-- Also drop the NOT NULL on user_id: the code keys rows by application_id and
-- never populates user_id on insert, so the existing constraint would reject
-- every new row.
--
-- All idempotent — safe to re-run.

ALTER TABLE public.processing_accounts
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.processing_accounts
  ADD COLUMN IF NOT EXISTS application_id      uuid,
  ADD COLUMN IF NOT EXISTS name                text,
  ADD COLUMN IF NOT EXISTS link                text,
  ADD COLUMN IF NOT EXISTS email               text,
  ADD COLUMN IF NOT EXISTS password            text,
  ADD COLUMN IF NOT EXISTS security_question_1 text,
  ADD COLUMN IF NOT EXISTS security_question_2 text,
  ADD COLUMN IF NOT EXISTS security_question_3 text,
  ADD COLUMN IF NOT EXISTS status              text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by          uuid;

-- Index the new scoping column for the per-application lookups both paths run.
CREATE INDEX IF NOT EXISTS processing_accounts_application_id_idx
  ON public.processing_accounts (application_id);
