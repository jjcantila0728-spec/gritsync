-- FIX: 403 Errors - Comprehensive Final Fix
-- Run this ENTIRE script in Supabase SQL Editor
-- This fixes all 403 permission errors for users and application_payments tables

-- ============================================================================
-- STEP 1: Verify admin role exists in auth.users
-- IMPORTANT: Replace 'your-admin-email@example.com' with your actual admin email
-- Run this query first to find your admin user ID:
-- SELECT id, email, raw_user_meta_data->>'role' as role FROM auth.users WHERE email = 'your-admin-email@example.com';
-- ============================================================================

-- Uncomment and update the line below with your admin email:
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'your-admin-email@example.com';

-- Also ensure public.users table has matching role:
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE email = 'your-admin-email@example.com';

-- ============================================================================
-- STEP 2: Drop all existing policies on users table to start fresh
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create comprehensive user policies
-- ============================================================================

-- Policy 1: Users can view their own profile (any columns)
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

-- Policy 4: Admins can view ALL users (any columns, any filters)
-- This uses EXISTS to check auth.users directly (no RLS recursion)
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

-- Policy 6: Service role can insert (for triggers)
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- STEP 4: Fix application_payments policies
-- ============================================================================

-- Drop existing policies
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

-- Policy 2: Admins can view ALL payments (any columns, any filters)
CREATE POLICY "Admins can view all payments"
ON application_payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
  OR auth.uid() = user_id
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

-- ============================================================================
-- STEP 5: Update is_admin() function to check metadata
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

-- ============================================================================
-- STEP 6: Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.application_payments TO authenticated;

-- ============================================================================
-- STEP 7: Verify RLS is enabled on both tables
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DIAGNOSTIC QUERIES - Run these to verify everything is set up correctly
-- ============================================================================

-- Check your current user's role in auth.users:
-- SELECT id, email, 
--   raw_user_meta_data->>'role' as role
-- FROM auth.users 
-- WHERE id = auth.uid();

-- Check if you can see all users (should work if you're admin):
-- SELECT COUNT(*) FROM users WHERE role = 'client';

-- Check if you can see all payments (should work if you're admin):
-- SELECT COUNT(*) FROM application_payments WHERE status = 'paid';

-- Check RLS policies on users table:
-- SELECT * FROM pg_policies WHERE tablename = 'users';

-- Check RLS policies on application_payments table:
-- SELECT * FROM pg_policies WHERE tablename = 'application_payments';

-- Test specific queries that were failing:
-- SELECT avatar_path FROM users WHERE id = auth.uid();
-- SELECT * FROM users WHERE role = 'client';
-- SELECT amount FROM application_payments WHERE status = 'paid';

-- ============================================================================
-- MANUAL FIX - If you're still getting 403, run these with your admin email
-- Replace 'your-admin-email@example.com' with your actual admin email
-- ============================================================================
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'your-admin-email@example.com';

-- Also update the public.users table to match:
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE email = 'your-admin-email@example.com';

