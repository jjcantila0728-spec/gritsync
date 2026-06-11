-- P2 idempotency (docs/IMPROVEMENT-PLAN.md):
--  * email_analytics.svix_id — dedup key so Resend webhook replays don't
--    double-count opens/deliveries (partial unique: rows recorded before
--    this migration have NULL svix_id and never conflict)
--  * application_payments.tasks_triggered_at — guards the followup-task
--    trigger against double-clicks after the first batch was read

ALTER TABLE email_analytics ADD COLUMN IF NOT EXISTS svix_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_analytics_svix
  ON email_analytics (svix_id) WHERE svix_id IS NOT NULL;

ALTER TABLE application_payments ADD COLUMN IF NOT EXISTS tasks_triggered_at TIMESTAMPTZ;
