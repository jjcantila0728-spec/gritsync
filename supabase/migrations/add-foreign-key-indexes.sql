-- Migration: Add indexes for unindexed foreign keys
-- This migration adds indexes to foreign key columns to improve query performance
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- ============================================================================
-- PART 1: Add indexes for foreign keys without covering indexes
-- ============================================================================

-- career_applications table
CREATE INDEX IF NOT EXISTS idx_career_applications_reviewed_by ON career_applications(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- careers table
CREATE INDEX IF NOT EXISTS idx_careers_created_by ON careers(created_by) WHERE created_by IS NOT NULL;

-- email_logs table
CREATE INDEX IF NOT EXISTS idx_email_logs_donation_id ON email_logs(donation_id) WHERE donation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_quotation_id ON email_logs(quotation_id) WHERE quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_sponsorship_id ON email_logs(sponsorship_id) WHERE sponsorship_id IS NOT NULL;

-- email_templates table
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by ON email_templates(updated_by) WHERE updated_by IS NOT NULL;

-- nclex_cases table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_cases') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_cases_created_by ON nclex_cases(created_by) WHERE created_by IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_nclex_cases_subject_id ON nclex_cases(subject_id) WHERE subject_id IS NOT NULL;
  END IF;
END $$;

-- nclex_exams table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_exams') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_exams_created_by ON nclex_exams(created_by) WHERE created_by IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_nclex_exams_subject_id ON nclex_exams(subject_id) WHERE subject_id IS NOT NULL;
  END IF;
END $$;

-- nclex_questions table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_questions') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_questions_created_by ON nclex_questions(created_by) WHERE created_by IS NOT NULL;
  END IF;
END $$;

-- nclex_sponsorships table
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_reviewed_by ON nclex_sponsorships(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- nclex_user_performance table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_user_performance') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_user_performance_subject_id ON nclex_user_performance(subject_id) WHERE subject_id IS NOT NULL;
  END IF;
END $$;

-- password_reset_tokens table
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- processing_accounts table
CREATE INDEX IF NOT EXISTS idx_processing_accounts_created_by ON processing_accounts(created_by) WHERE created_by IS NOT NULL;

-- promo_code_usage table
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_application_id ON promo_code_usage(application_id) WHERE application_id IS NOT NULL;

-- receipts table
CREATE INDEX IF NOT EXISTS idx_receipts_application_id ON receipts(application_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);

-- received_emails table
CREATE INDEX IF NOT EXISTS idx_received_emails_recipient_email_address_id ON received_emails(recipient_email_address_id) WHERE recipient_email_address_id IS NOT NULL;

-- ============================================================================
-- PART 2: Note about unused indexes
-- ============================================================================
-- Many indexes are reported as unused. This is normal for:
-- 1. Newly created indexes that haven't been used yet
-- 2. Indexes that support future queries or features
-- 3. Indexes that are used infrequently but are important when needed
--
-- Consider monitoring index usage over time before removing them.
-- Unused indexes do consume storage and slow down writes slightly, but
-- they don't cause errors. You can remove them if you're certain they
-- won't be needed, but keeping them is often safer for future queries.
--
-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan;

-- ============================================================================
-- PART 3: Note about Auth DB connections
-- ============================================================================
-- The Auth DB connection strategy is configured to use absolute values (10 connections)
-- rather than percentage-based allocation. This requires configuration via Supabase Dashboard:
--
-- 1. Go to Project Settings > Database
-- 2. Configure connection pooling settings
-- 3. Switch to percentage-based allocation for better scalability
--
-- This cannot be fixed via SQL migration and requires dashboard configuration.

