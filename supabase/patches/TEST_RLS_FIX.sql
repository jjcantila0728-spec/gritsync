-- TEST RLS FIX - Run this AFTER running IMMEDIATE_FIX_403.sql
-- This simulates what happens when the user tries to query their profile

-- Replace this with your actual user ID if different
\set user_id '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'

-- ============================================================================
-- Test 1: Check if user profile exists (bypasses RLS - service role)
-- ============================================================================
SELECT 'Test 1: User profile exists (service role)' as test;
SELECT 
  id,
  email,
  role,
  grit_id,
  first_name,
  last_name
FROM public.users 
WHERE id = :'user_id';

-- ============================================================================
-- Test 2: Simulate RLS check (this is what the app does)
-- Note: In SQL Editor, this runs as service role, so it bypasses RLS
-- To properly test RLS, you need to use the REST API with the user's JWT token
-- ============================================================================
SELECT 'Test 2: RLS Policy Check (simulated)' as test;
SELECT 
  'auth.uid() would return' as info,
  :'user_id' as expected_user_id,
  'If policies are correct, user can read their own profile' as note;

-- ============================================================================
-- Test 3: Check all policies are in place
-- ============================================================================
SELECT 'Test 3: RLS Policies' as test;
SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN cmd = 'SELECT' AND policyname LIKE '%view%' THEN '✅ Critical for reading profile'
    WHEN cmd = 'UPDATE' AND policyname LIKE '%update%' THEN '✅ For profile updates'
    WHEN cmd = 'INSERT' THEN '✅ For new registrations'
    ELSE 'ℹ️ Other'
  END as importance
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================================================
-- Test 4: Verify grants are in place
-- ============================================================================
SELECT 'Test 4: Permissions' as test;
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND grantee = 'authenticated'
ORDER BY privilege_type;

-- ============================================================================
-- Test 5: Check if auth.uid() function is available
-- ============================================================================
SELECT 'Test 5: auth.uid() function' as test;
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'uid' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    ) THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status;

-- ============================================================================
-- IMPORTANT NOTE
-- ============================================================================
SELECT 
  '⚠️ IMPORTANT' as note,
  'SQL Editor runs as service role (bypasses RLS)' as info,
  'To test RLS properly, use the REST API with user JWT token' as instruction,
  'Or test by logging into your application' as alternative;


