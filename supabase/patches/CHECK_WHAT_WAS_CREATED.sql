-- Check what was actually created after running SIMPLE_FIX_403.sql
-- Run this to see the current state

-- Check 1: How many policies exist?
SELECT 
  'Policies Status' as check_type,
  COUNT(*) as total_policies,
  STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies 
WHERE tablename = 'users';

-- Check 2: List all policies with details
SELECT 
  'Policy Details' as check_type,
  policyname,
  cmd as command_type,
  roles::text as roles
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Check 3: Does user profile exist?
SELECT 
  'User Profile Status' as check_type,
  COUNT(*) as exists_count,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS ✅' ELSE 'MISSING ❌' END as status
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 4: User profile details
SELECT 
  'User Profile Details' as check_type,
  id,
  email,
  role,
  grit_id,
  created_at
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 5: Is RLS enabled?
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';







