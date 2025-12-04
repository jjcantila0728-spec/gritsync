-- ============================================================================
-- COMPLETE OVERHAUL - Fix All 403 Errors
-- This uses a completely different approach with SECURITY DEFINER functions
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: NUCLEAR OPTION - Temporarily disable RLS to fix everything
-- ============================================================================
-- This ensures we can fix things without being blocked

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Fix Admin Role in auth.users (CRITICAL)
-- ============================================================================

-- First, let's see all admin users
SELECT 
  'BEFORE FIX' as status,
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  pu.role as public_role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.role = 'admin' OR au.raw_user_meta_data->>'role' = 'admin';

-- Fix ALL admin users - sync from public.users to auth.users
-- IMPORTANT: Set raw_user_meta_data (this is what Supabase uses for JWT claims)
UPDATE auth.users 
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data IS NULL THEN '{"role": "admin"}'::jsonb
    ELSE raw_user_meta_data || '{"role": "admin"}'::jsonb
  END
WHERE id IN (
  SELECT id FROM public.users WHERE role = 'admin'
);

-- Also sync the other way - from auth.users to public.users
UPDATE public.users 
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'admin'
);

-- Verify after fix
SELECT 
  'AFTER FIX' as status,
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  pu.role as public_role,
  CASE 
    WHEN au.raw_user_meta_data->>'role' = 'admin' AND pu.role = 'admin' THEN '✓ SYNCED'
    ELSE '✗ MISMATCH'
  END as sync_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.role = 'admin' OR au.raw_user_meta_data->>'role' = 'admin';

-- ============================================================================
-- STEP 3: Create SECURITY DEFINER Function to Check Admin (Bypasses RLS)
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_admin(UUID) CASCADE;

-- Create a SECURITY DEFINER function that bypasses RLS
-- This function runs with the privileges of the function owner (postgres)
-- So it can read auth.users without RLS restrictions
CREATE OR REPLACE FUNCTION public.check_is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Check auth.users directly (no RLS on auth schema)
  -- Check raw_user_meta_data (this is what Supabase uses)
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = check_user_id
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR (raw_user_meta_data->>'role')::text = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create simpler version for current user
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.check_is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin(UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Re-enable RLS and Create Simple, Direct Policies
-- ============================================================================

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  -- Drop users policies
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
  
  -- Drop application_payments policies
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'application_payments') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON application_payments', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Create Users Table Policies (Simple and Direct)
-- ============================================================================

-- Policy 1: Users can view their own profile
CREATE POLICY "users_select_own"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own profile
CREATE POLICY "users_insert_own"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy 4: Admins can view ALL users (using SECURITY DEFINER function)
CREATE POLICY "users_select_admin"
ON users FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy 5: Admins can update ALL users
CREATE POLICY "users_update_admin"
ON users FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy 6: Service role can insert (for triggers)
CREATE POLICY "users_insert_service"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- STEP 6: Create application_payments Table Policies
-- ============================================================================

-- Policy 1: Users can view their own payments
CREATE POLICY "payments_select_own"
ON application_payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Admins can view ALL payments (for dashboard stats)
CREATE POLICY "payments_select_admin"
ON application_payments FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy 3: Users can insert their own payments
CREATE POLICY "payments_insert_own"
ON application_payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can update their own payments
CREATE POLICY "payments_update_own"
ON application_payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 5: Admins can update ALL payments
CREATE POLICY "payments_update_admin"
ON application_payments FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 7: Grant All Necessary Permissions
-- ============================================================================

-- Schema usage
GRANT USAGE ON SCHEMA public TO authenticated;

-- Table permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.application_payments TO authenticated;

-- ============================================================================
-- STEP 8: Verify Everything
-- ============================================================================

-- Check RLS is enabled
SELECT 
  'RLS Status' as check_name,
  tablename,
  rowsecurity as enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'application_payments');

-- Count policies
SELECT 
  'Policy Count' as check_name,
  tablename,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename IN ('users', 'application_payments')
GROUP BY tablename;

-- List all policies
SELECT 
  'All Policies' as check_name,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('users', 'application_payments')
ORDER BY tablename, policyname;

-- Test is_admin() function
SELECT 
  'Function Test' as check_name,
  public.is_admin() as is_admin_result,
  auth.uid() as current_user_id;

-- Verify admin users
SELECT 
  'Admin Users' as check_name,
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  pu.role as public_role,
  public.check_is_admin(au.id) as function_check
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.raw_user_meta_data->>'role' = 'admin' OR pu.role = 'admin';

-- ============================================================================
-- STEP 9: Test Queries (Should work now)
-- ============================================================================

-- Test: Can we see all users as admin? (This will only work if you're logged in as admin)
-- Note: In SQL Editor, this runs as service role, so it bypasses RLS
-- But in the app, RLS will apply

SELECT 
  'Test Query' as check_name,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE role = 'client') as client_count,
  COUNT(*) FILTER (WHERE role = 'admin') as admin_count
FROM public.users;

-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this script:
-- 
-- 1. **CRITICAL**: You MUST log out and log back in completely
--    - Close all browser tabs
--    - Log out
--    - Wait 5 seconds
--    - Log back in
--    - This refreshes your JWT token with the updated role
--
-- 2. Test in the application:
--    - Go to /admin/clients - should load without 403 errors
--    - Check dashboard - stats should load
--    - Check browser console - no 403 errors
--
-- 3. If still not working:
--    - Run: SELECT public.is_admin(); (should return true if you're admin)
--    - Check: SELECT * FROM auth.users WHERE id = auth.uid();
--    - Verify role is set in raw_user_meta_data
-- ============================================================================

