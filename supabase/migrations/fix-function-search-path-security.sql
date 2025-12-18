-- Migration: Fix function search_path security issues
-- This migration sets search_path for all functions to prevent security vulnerabilities
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Fix all functions by setting search_path to public (since they all use public schema)
-- Using SET search_path = public is secure when functions only reference public schema
-- This migration uses dynamic SQL to only alter functions that exist, making it idempotent

DO $$
DECLARE
  func_record RECORD;
  func_signature TEXT;
BEGIN
  -- Loop through all functions in the public schema and set their search_path
  -- We'll handle functions that are known to exist, checking each one
  
  -- Updated_at trigger functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'update_user_preferences_updated_at',
      'update_email_signatures_updated_at',
      'update_business_logos_updated_at',
      'update_email_logs_updated_at',
      'update_email_addresses_updated_at',
      'update_email_templates_updated_at',
      'update_promo_codes_updated_at',
      'update_user_details_updated_at',
      'update_received_emails_updated_at',
      'update_notification_types_updated_at',
      'update_updated_at_column'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Function might have different signature, skip it
      NULL;
    END;
  END LOOP;

  -- Login and security functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'get_failed_login_attempts',
      'is_account_locked',
      'lock_account',
      'unlock_account',
      'cleanup_old_login_attempts'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Signature and logo functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'cleanup_expired_signatures',
      'ensure_one_default_signature',
      'ensure_one_default_logo',
      'generate_signature_html',
      'increment_logo_usage'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Payment and reminder functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'generate_payment_reminders',
      'notify_credentialing_reminder'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Session management functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'cleanup_expired_sessions',
      'get_user_active_session_count',
      'revoke_all_user_sessions',
      'update_session_activity'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Admin and permission functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'is_admin_for_quotations',
      'check_is_admin',
      'is_admin_user',
      'is_admin',
      'is_admin_safe'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Email functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'refresh_email_analytics',
      'create_client_email_address',
      'generate_client_email',
      'get_user_primary_email',
      'get_admin_email_addresses',
      'set_primary_client_email',
      'enforce_single_active_client_email'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Template functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'render_email_template',
      'increment_template_usage'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- User management functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'handle_new_user',
      'text_to_boolean',
      'generate_grit_app_id',
      'generate_grit_id'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Promo code functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'validate_promo_code'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Career and statistics functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'increment_career_views',
      'increment_career_applications',
      'get_career_statistics',
      'get_sponsorship_statistics',
      'get_donation_statistics'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Profile and document functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'check_incomplete_profile',
      'check_missing_documents',
      'generate_document_reminders',
      'generate_profile_completion_reminders'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Notification functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'notify_timeline_step_update',
      'notify_payment_status_update'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Received emails functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'associate_received_email_with_user'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

END $$;

-- Fix materialized view API access issue
-- Materialized views don't support RLS, so we revoke direct access
-- and create a function wrapper that checks permissions
REVOKE SELECT ON email_analytics FROM anon, authenticated;

-- Create a function wrapper for accessing email_analytics with admin check
CREATE OR REPLACE FUNCTION get_email_analytics()
RETURNS TABLE (
  date DATE,
  email_type TEXT,
  email_category TEXT,
  status TEXT,
  count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  failed_count BIGINT,
  bounced_count BIGINT,
  avg_send_time_seconds NUMERIC
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT * FROM email_analytics;
END;
$$;

-- Grant execute permission to authenticated users (function will check admin status)
GRANT EXECUTE ON FUNCTION get_email_analytics() TO authenticated;

-- Note: auth_leaked_password_protection must be enabled via Supabase Dashboard
-- Go to Authentication > Settings > Password Security
-- Enable "Leaked Password Protection"
-- This cannot be fixed via SQL migration
