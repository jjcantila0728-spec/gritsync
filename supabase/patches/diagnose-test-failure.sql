-- DIAGNOSE: Why E2E Tests Are Failing
-- Run this in Supabase SQL Editor to check what's wrong

-- ============================================================================
-- CHECK 1: Does generate_grit_id() function exist?
-- ============================================================================
SELECT 
  'CHECK 1: generate_grit_id() function' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'generate_grit_id'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run FIX_REGISTRATION_ERROR.sql'
  END as status;

-- ============================================================================
-- CHECK 2: Does handle_new_user() trigger function exist?
-- ============================================================================
SELECT 
  'CHECK 2: handle_new_user() function' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'handle_new_user'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run FIX_REGISTRATION_ERROR.sql'
  END as status;

-- ============================================================================
-- CHECK 3: Does the trigger exist?
-- ============================================================================
SELECT 
  'CHECK 3: on_auth_user_created trigger' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'auth' 
        AND event_object_table = 'users'
        AND trigger_name = 'on_auth_user_created'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run FIX_REGISTRATION_ERROR.sql'
  END as status;

-- ============================================================================
-- CHECK 4: Are INSERT policies configured?
-- ============================================================================
SELECT 
  'CHECK 4: INSERT policies' as check_name,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ CONFIGURED'
    WHEN COUNT(*) = 1 THEN '⚠️  PARTIAL - Need 2 policies'
    ELSE '❌ MISSING - Run FIX_REGISTRATION_ERROR.sql'
  END as status
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';

-- List the INSERT policies
SELECT 
  'CHECK 4b: INSERT policy details' as check_name,
  policyname,
  cmd,
  roles::text as roles
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';

-- ============================================================================
-- CHECK 5: Is RLS enabled?
-- ============================================================================
SELECT 
  'CHECK 5: RLS enabled' as check_name,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED - Run: ALTER TABLE users ENABLE ROW LEVEL SECURITY;'
  END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- ============================================================================
-- CHECK 6: Test generate_grit_id() function
-- ============================================================================
SELECT 
  'CHECK 6: Test generate_grit_id()' as check_name,
  generate_grit_id() as test_grit_id,
  CASE 
    WHEN generate_grit_id() IS NOT NULL THEN '✅ WORKS'
    ELSE '❌ FAILS'
  END as status;

-- ============================================================================
-- CHECK 7: Check trigger function definition
-- ============================================================================
SELECT 
  'CHECK 7: Trigger function definition' as check_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_new_user' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
LIMIT 1;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
  'SUMMARY' as section,
  'Run FIX_REGISTRATION_ERROR.sql if any checks failed' as recommendation;







