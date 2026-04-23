-- ============================================================================
-- DIAGNOSTIC SCRIPT - Check Current State of RLS Policies
-- Run this FIRST to see what's wrong before running the fix
-- ============================================================================

-- ============================================================================
-- CHECK 1: Verify Admin Role in auth.users
-- ============================================================================
SELECT 
  'CHECK 1: Admin Role in auth.users' as check_name,
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as role_in_auth_users,
  pu.role as role_in_public_users,
  CASE 
    WHEN au.raw_user_meta_data->>'role' = 'admin' AND pu.role = 'admin' THEN '✓ OK'
    WHEN au.raw_user_meta_data->>'role' = 'admin' AND pu.role != 'admin' THEN '✗ Mismatch (public.users)'
    WHEN au.raw_user_meta_data->>'role' != 'admin' AND pu.role = 'admin' THEN '✗ Mismatch (auth.users)'
    ELSE '✗ Not Admin'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.role = 'admin' OR au.raw_user_meta_data->>'role' = 'admin'
ORDER BY au.email;

-- ============================================================================
-- CHECK 2: Verify RLS is Enabled
-- ============================================================================
SELECT 
  'CHECK 2: RLS Status' as check_name,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✓ Enabled'
    ELSE '✗ DISABLED - This is a problem!'
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'application_payments')
ORDER BY tablename;

-- ============================================================================
-- CHECK 3: List All Policies on users Table
-- ============================================================================
SELECT 
  'CHECK 3: Users Table Policies' as check_name,
  policyname,
  cmd as command,
  roles,
  CASE 
    WHEN policyname LIKE '%admin%' AND cmd = 'SELECT' THEN '✓ Admin SELECT policy'
    WHEN policyname LIKE '%Users can view%' AND cmd = 'SELECT' THEN '✓ User SELECT policy'
    ELSE 'Policy exists'
  END as status
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Count policies
SELECT 
  'CHECK 3b: Users Policy Count' as check_name,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 6 THEN '✓ OK (6+ policies)'
    WHEN COUNT(*) >= 3 THEN '⚠ Partial (3-5 policies)'
    ELSE '✗ INSUFFICIENT (Less than 3 policies)'
  END as status
FROM pg_policies 
WHERE tablename = 'users';

-- ============================================================================
-- CHECK 4: List All Policies on application_payments Table
-- ============================================================================
SELECT 
  'CHECK 4: application_payments Table Policies' as check_name,
  policyname,
  cmd as command,
  roles,
  CASE 
    WHEN policyname LIKE '%admin%' AND cmd = 'SELECT' THEN '✓ Admin SELECT policy'
    WHEN policyname LIKE '%Users can view%' AND cmd = 'SELECT' THEN '✓ User SELECT policy'
    ELSE 'Policy exists'
  END as status
FROM pg_policies 
WHERE tablename = 'application_payments'
ORDER BY policyname;

-- Count policies
SELECT 
  'CHECK 4b: application_payments Policy Count' as check_name,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✓ OK (5+ policies)'
    WHEN COUNT(*) >= 2 THEN '⚠ Partial (2-4 policies)'
    ELSE '✗ INSUFFICIENT (Less than 2 policies)'
  END as status
FROM pg_policies 
WHERE tablename = 'application_payments';

-- ============================================================================
-- CHECK 5: Verify Grants (Permissions)
-- ============================================================================
SELECT 
  'CHECK 5: Table Grants' as check_name,
  table_name,
  grantee,
  privilege_type,
  CASE 
    WHEN privilege_type IN ('SELECT', 'INSERT', 'UPDATE') AND grantee = 'authenticated' THEN '✓ OK'
    ELSE 'Check needed'
  END as status
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'application_payments')
AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

-- ============================================================================
-- CHECK 6: Test Admin Check Function
-- ============================================================================
SELECT 
  'CHECK 6: is_admin() Function' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) as function_exists,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'is_admin' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN '✓ Function exists'
    ELSE '✗ Function missing'
  END as status;

-- ============================================================================
-- SUMMARY: Overall Status
-- ============================================================================
SELECT 
  'SUMMARY' as check_name,
  CASE 
    WHEN (
      -- RLS enabled on both tables
      (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'application_payments') AND rowsecurity = true) = 2
      -- At least 6 policies on users
      AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users') >= 6
      -- At least 2 policies on application_payments
      AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'application_payments') >= 2
      -- Grants exist
      AND (SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name IN ('users', 'application_payments') AND grantee = 'authenticated') >= 4
    ) THEN '✓ All checks passed - RLS should be working'
    ELSE '✗ Issues detected - Run COMPLETE_FIX_403_ERRORS.sql'
  END as overall_status;

