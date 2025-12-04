-- DIAGNOSE RLS ISSUES - Run this to see what's wrong
-- This will help identify why you're getting 403 errors

-- Check 1: Is RLS enabled on all tables?
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'applications', 'quotations')
ORDER BY tablename;

-- Check 2: What policies exist on each table?
SELECT 
  tablename,
  policyname,
  cmd as command,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Reading data'
    WHEN cmd = 'INSERT' THEN 'Creating data'
    WHEN cmd = 'UPDATE' THEN 'Updating data'
    WHEN cmd = 'DELETE' THEN 'Deleting data'
    ELSE cmd
  END as description
FROM pg_policies 
WHERE tablename IN ('users', 'applications', 'quotations')
ORDER BY tablename, cmd, policyname;

-- Check 3: What permissions are granted?
SELECT 
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'applications', 'quotations')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

-- Check 4: Does the user profile exist?
SELECT 
  'User profile exists' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  ) THEN '✅ YES' ELSE '❌ NO' END as status;

-- Check 5: Show the user profile
SELECT 
  id,
  email,
  role,
  grit_id
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 6: Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 6 THEN '✅ GOOD'
    WHEN tablename = 'applications' AND COUNT(*) >= 4 THEN '✅ GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) >= 5 THEN '✅ GOOD'
    ELSE '❌ MISSING POLICIES'
  END as status
FROM pg_policies 
WHERE tablename IN ('users', 'applications', 'quotations')
GROUP BY tablename
ORDER BY tablename;

