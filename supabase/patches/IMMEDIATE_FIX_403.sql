-- IMMEDIATE FIX FOR 403 ERROR - Run this NOW in Supabase SQL Editor
-- This script will diagnose and fix the issue for user: 03a0bd9f-c3e3-4b1d-ab74-93318b295f50

-- ============================================================================
-- DIAGNOSIS: Check current state
-- ============================================================================
SELECT '=== DIAGNOSIS ===' as step;

-- Check 1: Does user exist in auth.users?
SELECT 
  'User in auth.users' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM auth.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check 2: Does user exist in public.users?
SELECT 
  'User in public.users' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check 3: Is RLS enabled?
SELECT 
  'RLS enabled' as check_name,
  CASE WHEN rowsecurity THEN '✅ YES' ELSE '❌ NO' END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Check 4: Count existing policies
SELECT 
  'Existing policies' as check_name,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'users';

-- ============================================================================
-- STEP 1: Ensure generate_grit_id() function exists
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_grit_id()
RETURNS TEXT AS $$
DECLARE
  new_grit_id TEXT;
  exists_check INTEGER;
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  LOOP
    new_grit_id := 'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0');
    SELECT COUNT(*) INTO exists_check FROM users WHERE grit_id = new_grit_id;
    EXIT WHEN exists_check = 0;
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique GRIT-ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  RETURN new_grit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Enable RLS (if not already enabled)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Create the CRITICAL SELECT policy FIRST
-- This is the most important policy - users must be able to read their own data
-- ============================================================================
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ============================================================================
-- STEP 5: Create UPDATE policy
-- ============================================================================
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 6: Create admin policies (using auth.users to avoid recursion)
-- ============================================================================
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
-- STEP 7: Create INSERT policies
-- ============================================================================
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 8: Grant permissions (CRITICAL - without this, policies won't work)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- STEP 9: Create/Update the user profile for the specific user
-- This ensures the user exists in public.users table
-- ============================================================================
INSERT INTO public.users (id, email, role, first_name, last_name, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client') as role,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'first_name', '')), '') as first_name,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'last_name', '')), '') as last_name,
  COALESCE(
    (SELECT grit_id FROM public.users WHERE id = au.id),
    generate_grit_id()
  ) as grit_id,
  COALESCE(
    (SELECT created_at FROM public.users WHERE id = au.id),
    au.created_at
  ) as created_at,
  NOW() as updated_at
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = COALESCE(EXCLUDED.role, users.role),
  first_name = COALESCE(EXCLUDED.first_name, users.first_name),
  last_name = COALESCE(EXCLUDED.last_name, users.last_name),
  grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
  updated_at = NOW();

-- ============================================================================
-- STEP 10: Create missing profiles for ALL auth users (not just this one)
-- ============================================================================
INSERT INTO public.users (id, email, role, first_name, last_name, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client') as role,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'first_name', '')), '') as first_name,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'last_name', '')), '') as last_name,
  COALESCE(
    (SELECT grit_id FROM public.users WHERE id = au.id),
    generate_grit_id()
  ) as grit_id,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = COALESCE(EXCLUDED.role, users.role),
  first_name = COALESCE(EXCLUDED.first_name, users.first_name),
  last_name = COALESCE(EXCLUDED.last_name, users.last_name),
  grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
  updated_at = NOW();

-- ============================================================================
-- STEP 11: Update auth metadata with roles (for admin policy checks)
-- ============================================================================
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE raw_user_meta_data->>'role' IS NULL;

-- ============================================================================
-- STEP 12: Generate grit_id for any users missing it
-- ============================================================================
UPDATE users
SET grit_id = generate_grit_id()
WHERE grit_id IS NULL;

-- ============================================================================
-- VERIFICATION: Check that everything is set up correctly
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

-- Verify user exists
SELECT 
  'User profile exists' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  ) THEN '✅ YES' ELSE '❌ NO' END as status;

-- Verify policies exist
SELECT 
  'Policies count' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 6 THEN '✅ GOOD' ELSE '❌ MISSING' END as status
FROM pg_policies 
WHERE tablename = 'users';

-- List all policies
SELECT 
  policyname,
  cmd as command
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Verify RLS is enabled
SELECT 
  'RLS status' as check_name,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Show the user profile
SELECT 
  'User profile data' as check_name,
  id,
  email,
  role,
  grit_id
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 
  '✅ FIX COMPLETE!' as status,
  'Now try logging in again. The 403 error should be resolved.' as next_step;


