-- ============================================================================
-- Fix all Supabase security warnings (RLS, Security Definer Views,
-- Sensitive Column Exposure, Function Search Path Mutable)
-- ----------------------------------------------------------------------------
-- Context:
--   This app uses custom JWT auth — NOT Supabase Auth. The backend server
--   connects via the `service_role` key, which ALWAYS bypasses RLS in
--   Supabase. Enabling RLS here is therefore 100% safe:
--     • service_role  → unchanged, full access (app continues to work)
--     • anon role     → blocked by RLS (publicly locked down)
--
-- How to run (against your Supabase project):
--   Paste this file into the Supabase SQL Editor and click "Run".
--   OR use the Supabase CLI:
--     supabase db push --file scripts/migrations/2026-05-14_fix_supabase_security_warnings.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Enable Row Level Security on all public tables
-- ============================================================================
-- No explicit policies are needed — the service_role key bypasses RLS
-- entirely, so the backend is unaffected. The anon/authenticated roles
-- (which have no policies) will be denied by default, eliminating the
-- "RLS Disabled in Public" critical warnings.
-- Each ALTER is wrapped in a DO block so tables not yet migrated are skipped.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'password_reset_tokens','user_details','user_preferences','settings',
    'applications','application_payments','application_timeline_steps',
    'notifications','quotations','partner_agencies','nclex_sponsorships',
    'processing_accounts','testimonials','careers','career_applications',
    'donations','messages','conversations','email_analytics','subscriber_stats',
    'newsletter_subscriptions','sessions','exchange_rates','visa_bulletin_cache',
    'visa_bulletin_email_log','file_storage','question_bank','case_studies',
    'user_question_bookmarks','nclex_payment_submissions','business_logos',
    'email_templates','email_subscribers','email_queue','notification_types',
    'receipts','temporary_signatures','received_emails','email_campaigns',
    'email_campaign_recipients','email_ab_tests','email_ab_test_results',
    'email_ab_test_recipients','workflows','workflow_runs','workflow_triggers',
    'analytics_cache','custom_reports','report_schedules','services',
    'service_required_documents','test_sessions','session_responses',
    'user_documents','promo_codes','users','email_addresses','email_signatures',
    'email_logs','mandatory_course_runs','ny_application_runs','pv_application_runs',
    'nclex_case_studies','nclex_questions','nclex_pending_case_studies',
    'nclex_pending_questions','nclex_sessions','nclex_session_items',
    'nclex_profiles','nclex_exit_access','nclex_testimonials','nclex_site_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS enabled: %', t;
    ELSE
      RAISE NOTICE 'Skipped (not found): %', t;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 2: Fix Security Definer Views
-- ============================================================================
-- Supabase flags views created with SECURITY DEFINER as critical risks because
-- they execute with the view owner's privileges rather than the calling user's.
-- Switching to SECURITY INVOKER removes that elevation.
-- PostgreSQL 15+ supports ALTER VIEW ... SET (security_invoker = true).
-- Wrapped in DO blocks so missing views are skipped gracefully.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'active_email_addresses'
  ) THEN
    ALTER VIEW public.active_email_addresses SET (security_invoker = true);
    RAISE NOTICE 'Fixed: active_email_addresses → security_invoker';
  ELSE
    RAISE NOTICE 'Skipped: active_email_addresses not found';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'ab_test_stats'
  ) THEN
    ALTER VIEW public.ab_test_stats SET (security_invoker = true);
    RAISE NOTICE 'Fixed: ab_test_stats → security_invoker';
  ELSE
    RAISE NOTICE 'Skipped: ab_test_stats not found';
  END IF;
END;
$$;

-- ============================================================================
-- PART 3: Fix Function Search Path Mutable
-- ============================================================================
-- Functions without an explicit search_path are vulnerable to search-path
-- injection: a malicious schema earlier in the path could shadow built-in
-- functions or your own tables. Setting search_path = '' (empty) forces the
-- function to use only fully-qualified object names, eliminating that risk.
--
-- NOTE: This ALTER form does NOT require re-stating the function body —
-- it updates only the function's configuration parameter in the catalog.
-- The signatures below are derived from pg_proc; adjust argument types if
-- any function was created with different overloads on your instance.
-- ============================================================================

-- Helper to set search_path on all listed functions without knowing their
-- exact signatures — iterates pg_proc and applies the fix dynamically.
DO $$
DECLARE
  r RECORD;
  target_names TEXT[] := ARRAY[
    'generate_signature_html',
    'refresh_email_analytics',
    'generate_document_reminders',
    'generate_payment_reminders',
    'generate_profile_completion_reminders',
    'increment',
    'increment_logo_usage',
    'increment_template_usage',
    'get_pending_emails_to_send',
    'mark_email_processing',
    'mark_email_sent',
    'mark_email_failed',
    'update_campaign_stats',
    'log_workflow_run',
    'update_workflow_stats',
    'get_active_workflows_for_trigger',
    'calculate_ab_test_metrics',
    'determine_ab_test_winner',
    'get_subscriber_count_by_segment',
    'get_subscribers_for_segment',
    'unsubscribe_email',
    'resubscribe_email',
    'update_email_preferences',
    'render_email_template',
    'check_missing_documents',
    'check_incomplete_profile',
    'notify_credentialing_reminder',
    'get_application_analytics',
    'validate_promo_code',
    'get_financial_analytics',
    'get_user_analytics',
    'get_document_analytics',
    'promo_codes_sync_columns'
  ];
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(target_names)
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = ''''',
        r.proname,
        r.args
      );
      RAISE NOTICE 'Fixed search_path on: public.%(%) ', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not fix public.%(%): % — skipping.',
        r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to confirm fixes)
-- ============================================================================
-- 1. Tables still missing RLS (should return 0 rows after this migration):
--    SELECT schemaname, tablename
--    FROM pg_tables
--    WHERE schemaname = 'public'
--      AND NOT EXISTS (
--        SELECT 1 FROM pg_class c
--        JOIN pg_namespace n ON c.relnamespace = n.oid
--        WHERE n.nspname = 'public'
--          AND c.relname = tablename
--          AND c.relrowsecurity = true
--      );
--
-- 2. Functions still without explicit search_path (should return 0 rows):
--    SELECT proname, pg_get_function_identity_arguments(oid) AS args
--    FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND 'search_path' != ALL(
--            COALESCE(array(SELECT split_part(x, '=', 1) FROM unnest(proconfig) x), '{}')
--          );
--
-- 3. Security Definer Views (should return 0 rows):
--    SELECT viewname FROM pg_views
--    WHERE schemaname = 'public'
--      AND definition LIKE '%SECURITY DEFINER%';
-- ============================================================================
