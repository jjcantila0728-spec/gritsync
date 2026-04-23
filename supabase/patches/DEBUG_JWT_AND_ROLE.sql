-- ============================================================================
-- DEBUG: Check JWT Token and Role Information
-- Run this to see what's in your JWT token and role metadata
-- ============================================================================

-- Check current user's auth.users record
SELECT 
  'Current User Auth Record' as check_name,
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'role' as role_in_metadata,
  created_at,
  updated_at
FROM auth.users
WHERE id = auth.uid();

-- Check current user's public.users record
SELECT 
  'Current User Public Record' as check_name,
  id,
  email,
  role,
  first_name,
  last_name,
  created_at
FROM public.users
WHERE id = auth.uid();

-- Test is_admin() function
SELECT 
  'is_admin() Function Test' as check_name,
  public.is_admin() as result,
  auth.uid() as user_id;

-- Check JWT claims (if available in SQL context)
-- Note: This might not work in SQL Editor, but works in RLS policies
SELECT 
  'JWT Claims Test' as check_name,
  current_setting('request.jwt.claims', true) as jwt_claims;

-- Check all admin users
SELECT 
  'All Admin Users' as check_name,
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  pu.role as public_role,
  public.check_is_admin(au.id) as function_check
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE 
  au.raw_user_meta_data->>'role' = 'admin' 
  OR pu.role = 'admin';

-- Check if RLS policies are working
SELECT 
  'RLS Policy Check' as check_name,
  tablename,
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE tablename IN ('users', 'application_payments')
ORDER BY tablename, policyname;

-- Count total users vs visible users (if you're admin, should see all)
-- Note: In SQL Editor, this runs as service role, so bypasses RLS
SELECT 
  'User Count Test' as check_name,
  COUNT(*) as total_users_in_table,
  COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
  COUNT(*) FILTER (WHERE role = 'client') as client_count
FROM public.users;

