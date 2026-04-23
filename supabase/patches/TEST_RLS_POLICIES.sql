-- TEST RLS POLICIES - Run this to verify RLS is working correctly
-- This will help identify if RLS policies are blocking the query

-- ============================================================================
-- STEP 1: Verify admin role in auth.users
-- ============================================================================
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'role' as role_in_metadata
FROM auth.users 
WHERE id = auth.uid();

-- ============================================================================
-- STEP 2: Check if RLS is enabled on users table
-- ============================================================================
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- ============================================================================
-- STEP 3: List all RLS policies on users table
-- ============================================================================
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- STEP 4: Test if admin policy works (should return all users if you're admin)
-- ============================================================================
-- This simulates what the frontend query does
SELECT 
  id,
  email,
  role,
  first_name,
  last_name
FROM public.users
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 5: Test the exact query the frontend uses
-- ============================================================================
SELECT *
FROM public.users
WHERE role = 'client'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 6: Check if admin policy expression is correct
-- ============================================================================
-- This should return true if you're admin
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = auth.uid() 
  AND raw_user_meta_data->>'role' = 'admin'
) as is_admin_check;

-- ============================================================================
-- FIX: If the admin check returns false, update your role:
-- ============================================================================
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE id = auth.uid();
--
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE id = auth.uid();

