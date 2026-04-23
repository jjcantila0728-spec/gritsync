-- ============================================================================
-- COMPLETE FIX FOR 403 ERRORS - Admin Access to Users Table
-- Run this ENTIRE script in Supabase SQL Editor
-- This will fix all permission denied errors
-- ============================================================================

-- ============================================================================
-- PART 1: Ensure Admin Role is Set in auth.users
-- ============================================================================
-- Sync admin role from public.users to auth.users for all admin users
-- This ensures consistency between both tables

-- Check current status of all users
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as role_in_auth_users,
  pu.role as role_in_public_users
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.role = 'admin' OR au.raw_user_meta_data->>'role' = 'admin'
ORDER BY au.email;

-- Update admin role in auth.users for all users who are admin in public.users
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id IN (
  SELECT id FROM public.users WHERE role = 'admin'
);

-- Also update specific user if needed (replace with your user ID)
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Ensure public.users role matches auth.users for admins
UPDATE public.users 
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'admin'
);

-- ============================================================================
-- PART 2: Fix RLS Policies on Users Table
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: Create User Policies (Users can access their own data)
-- ============================================================================

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- PART 4: Create Admin Policies (Admins can access all data)
-- ============================================================================
-- CRITICAL: Use auth.users directly to avoid RLS recursion

-- Policy 4: Admins can view all users
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Policy 5: Admins can update all users
CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================================
-- PART 5: Create Service Role Policies (For triggers/functions)
-- ============================================================================

-- Policy 6: Service role can insert users
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- PART 6: Grant Permissions (CRITICAL - Without this, policies won't work)
-- ============================================================================

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- PART 7: Fix RLS Policies on application_payments Table
-- ============================================================================

-- Enable RLS on application_payments
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on application_payments
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'application_payments') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON application_payments', r.policyname);
  END LOOP;
END $$;

-- Policy 1: Users can view their own payments
CREATE POLICY "Users can view their own payments"
ON application_payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Admins can view ALL payments (for dashboard stats)
CREATE POLICY "Admins can view all payments"
ON application_payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Policy 3: Users can insert their own payments
CREATE POLICY "Users can insert their own payments"
ON application_payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can update their own payments
CREATE POLICY "Users can update their own payments"
ON application_payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 5: Admins can update all payments
CREATE POLICY "Admins can update all payments"
ON application_payments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Grant permissions on application_payments
GRANT SELECT, INSERT, UPDATE ON public.application_payments TO authenticated;

-- ============================================================================
-- PART 8: Verify Everything is Set Up Correctly
-- ============================================================================

-- Check policies were created
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Verify admin role is set correctly for all admins
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as role_in_auth_users,
  pu.role as role_in_public_users,
  CASE 
    WHEN au.raw_user_meta_data->>'role' = 'admin' AND pu.role = 'admin' THEN '✓ Synced'
    ELSE '✗ Mismatch'
  END as sync_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.raw_user_meta_data->>'role' = 'admin' OR pu.role = 'admin'
ORDER BY au.email;

-- Test admin check for all admin users (should all return true)
SELECT 
  au.id,
  au.email,
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = au.id
    AND raw_user_meta_data->>'role' = 'admin'
  ) as is_admin_check
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'admin';

-- Check policies were created for application_payments
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'application_payments'
ORDER BY policyname;

-- ============================================================================
-- PART 9: Create Helper Function for Admin Check (Optional but useful)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Use auth.users metadata directly (no RLS on auth schema = no recursion)
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

-- Summary: Check all policies created
SELECT 
  'users' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'users'
UNION ALL
SELECT 
  'application_payments' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'application_payments';

-- ============================================================================
-- DONE! 
-- After running this script:
-- 1. **CRITICAL**: Refresh your browser session completely:
--    - Option A: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
--    - Option B: Clear browser cache and reload
--    - Option C: Log out and log back in (RECOMMENDED)
-- 2. The admin should now be able to access:
--    - users table (for clients page)
--    - application_payments table (for dashboard stats)
-- 3. Check the browser console - all 403 errors should be gone
-- ============================================================================

