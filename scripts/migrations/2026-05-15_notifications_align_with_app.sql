-- ============================================================================
-- Align the `notifications` table with what the app actually reads/writes.
-- ----------------------------------------------------------------------------
-- Symptoms this fixes:
--   * 500 on DELETE /api/db/notifications from Header.tsx
--       → "column notifications.read does not exist"
--   * Silent failure of notificationsAPI.markAsRead / markAllAsRead /
--     getUnreadCount which all filter or update by `read` (DB has `is_read`).
--   * Server-side INSERTs in routes/payments.ts and routes/questions.ts that
--     write `message` and `application_id` (both missing from the live DB).
--
-- Strategy: rename DB columns to match the code (single source of truth is
-- src/lib/database.types.ts and the dozens of call sites that use `read` /
-- `message` / `application_id`). `link` and `extra` are kept — payments.ts
-- writes them. All statements are guarded so the script is idempotent.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-15_notifications_align_with_app.sql
-- ============================================================================

BEGIN;

-- 1. is_read → read
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read'
  ) THEN
    EXECUTE 'ALTER TABLE notifications RENAME COLUMN is_read TO read';
  END IF;
END $$;

-- 2. body → message
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'body'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message'
  ) THEN
    EXECUTE 'ALTER TABLE notifications RENAME COLUMN body TO message';
  END IF;
END $$;

-- 3. application_id — referenced by Header.tsx, payments.ts INSERT, etc.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_application_id_idx ON notifications(application_id);

COMMIT;
