-- Migration: Fix RLS performance issues and duplicate indexes
-- This migration optimizes RLS policies by wrapping auth.uid() in SELECT subqueries
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================================
-- PART 1: Fix RLS policies to use (select auth.uid()) instead of auth.uid()
-- ============================================================================
-- This prevents re-evaluation of auth.uid() for each row, improving performance

DO $$
DECLARE
  r RECORD;
  policy_def TEXT;
  new_policy_def TEXT;
BEGIN
  -- Loop through all RLS policies that contain auth.uid() or current_setting()
  FOR r IN 
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR qual LIKE '%current_setting(%' 
           OR with_check LIKE '%auth.uid()%' OR with_check LIKE '%current_setting(%')
  LOOP
    -- Get the current policy definition
    SELECT pg_get_expr(pol.polqual, pol.polrelid) as qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check
    INTO policy_def, new_policy_def
    FROM pg_policy pol
    JOIN pg_class pc ON pc.oid = pol.polrelid
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    WHERE pn.nspname = r.schemaname
      AND pc.relname = r.tablename
      AND pol.polname = r.policyname;
    
    -- Skip if we can't get the definition
    CONTINUE WHEN policy_def IS NULL AND new_policy_def IS NULL;
    
    -- Replace auth.uid() with (select auth.uid()) in USING clause
    -- Skip if already wrapped in (select ...)
    IF policy_def IS NOT NULL AND policy_def !~ '\(select auth\.uid\(\)\)' THEN
      -- Replace all instances of auth.uid() that aren't already in a select
      policy_def := regexp_replace(
        policy_def,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Also replace current_setting calls (if not already wrapped)
      IF policy_def !~ '\(select current_setting\(' THEN
        policy_def := regexp_replace(
          policy_def,
          '\bcurrent_setting\(',
          '(select current_setting(',
          'g'
        );
      END IF;
    END IF;
    
    -- Replace auth.uid() with (select auth.uid()) in WITH CHECK clause
    -- Skip if already wrapped in (select ...)
    IF new_policy_def IS NOT NULL AND new_policy_def !~ '\(select auth\.uid\(\)\)' THEN
      -- Replace all instances of auth.uid() that aren't already in a select
      new_policy_def := regexp_replace(
        new_policy_def,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Also replace current_setting calls (if not already wrapped)
      IF new_policy_def !~ '\(select current_setting\(' THEN
        new_policy_def := regexp_replace(
          new_policy_def,
          '\bcurrent_setting\(',
          '(select current_setting(',
          'g'
        );
      END IF;
    END IF;
    
    -- Drop and recreate the policy with optimized definition
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                   r.policyname, r.schemaname, r.tablename);
    
    -- Recreate policy with optimized USING and WITH CHECK clauses
    -- Handle permissive vs restrictive policies
    IF r.permissive = 'PERMISSIVE' THEN
      IF policy_def IS NOT NULL AND new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s) WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def, new_policy_def
        );
      ELSIF policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def
        );
      ELSIF new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), new_policy_def
        );
      END IF;
    ELSE
      -- RESTRICTIVE policies
      IF policy_def IS NOT NULL AND new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s AS RESTRICTIVE USING (%s) WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def, new_policy_def
        );
      ELSIF policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s AS RESTRICTIVE USING (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def
        );
      ELSIF new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s AS RESTRICTIVE WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), new_policy_def
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: Fix duplicate indexes
-- ============================================================================

-- Drop duplicate index on application_payments
-- Keep idx_application_payments_application_id, drop idx_payments_application_id
DROP INDEX IF EXISTS idx_payments_application_id;

-- Drop duplicate index on application_timeline_steps
-- Keep idx_application_timeline_steps_application_id, drop idx_timeline_steps_application_id
DROP INDEX IF EXISTS idx_timeline_steps_application_id;

-- ============================================================================
-- PART 3: Note about multiple permissive policies
-- ============================================================================
-- Multiple permissive policies are detected on many tables. While this works,
-- it can impact performance as PostgreSQL must evaluate each policy.
-- Consider consolidating policies where possible, but this is often intentional
-- to separate concerns (e.g., user policies vs admin policies).
--
-- Example consolidation approach:
-- Instead of:
--   - "Users can view their own X"
--   - "Admins can view all X"
-- You could use:
--   - "Users can view X" USING (user_id = (select auth.uid()) OR 
--                                EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'admin'))
--
-- However, keeping them separate is often clearer and more maintainable.
-- The performance impact is usually minimal unless dealing with very large datasets.

