-- VERIFY USER AND RLS POLICIES
-- Run this to check if a specific user exists and RLS is configured correctly
-- Replace '03a0bd9f-c3e3-4b1d-ab74-93318b295f50' with the user ID you want to check

-- Check 1: Does user exist in auth.users?
SELECT 
  'auth.users' as table_name,
  id,
  email,
  raw_user_meta_data->>'role' as role_in_metadata,
  created_at
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 2: Does user exist in public.users?
SELECT 
  'public.users' as table_name,
  id,
  email,
  role,
  first_name,
  last_name,
  grit_id,
  created_at
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 3: Are RLS policies active on users table?
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Check 4: List all RLS policies on users table
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Check 5: Test RLS policy (simulate as this user)
-- Note: To properly test RLS, you need to be authenticated as this user
-- In Supabase SQL Editor, this query will run with service role (bypasses RLS)
-- To test RLS, use the application or REST API with the user's JWT token
SELECT 
  'RLS Test (Service Role - bypasses RLS)' as test_name,
  id,
  email,
  role
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 6: Count users in each table
SELECT 
  'auth.users count' as table_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'public.users count' as table_name,
  COUNT(*) as count
FROM public.users;

-- Check 7: Find users in auth.users but not in public.users (missing profiles)
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
LIMIT 10;

