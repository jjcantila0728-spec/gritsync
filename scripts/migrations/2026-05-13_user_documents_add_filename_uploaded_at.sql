-- ============================================================================
-- Align `user_documents` with what the app reads/writes.
-- ----------------------------------------------------------------------------
-- Symptoms this fixes:
--   * 500 on POST /api/db/user_documents from /documents and the application
--     uploader. Insert payload includes `filename` and `uploaded_at`, but
--     init.sql only had `file_name` and `created_at`/`updated_at`.
--   * AdminClients, Documents, TimelineStep and DocumentsTab all read
--     `uploaded_at` directly — without it, every "Uploaded: ..." line in the
--     admin UI showed blank.
--
-- All ALTERs are idempotent. The legacy `file_name` column is kept; it stores
-- the same value (the display filename) and other reads still use it.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-13_user_documents_add_filename_uploaded_at.sql
-- ============================================================================

BEGIN;

ALTER TABLE user_documents
  ADD COLUMN IF NOT EXISTS filename    TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Backfill the new columns from the existing ones so previously uploaded
-- documents still render.
UPDATE user_documents
   SET filename    = COALESCE(filename, file_name),
       uploaded_at = COALESCE(uploaded_at, created_at);

COMMIT;
