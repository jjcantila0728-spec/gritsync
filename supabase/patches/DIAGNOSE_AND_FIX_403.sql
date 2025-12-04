-- COMPREHENSIVE DIAGNOSE AND FIX FOR 403 ERRORS
-- Run this ENTIRE script in Supabase SQL Editor
-- This will diagnose the issue and apply fixes

-- ============================================================================
-- PART 1: DIAGNOSIS
-- ============================================================================

-- Check 1: Does the user exist in auth.users?
SELECT 
  'DIAGNOSIS: User in auth.users' as check_name,
  id,
  email,
  raw_user_meta_data->>'role' as role_in_metadata,
  created_at
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 2: Does the user exist in public.users?
SELECT 
  'DIAGNOSIS: User in public.users' as check_name,
  id,
  email,
  role,
  first_name,
  last_name,
  grit_id,
  created_at
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 3: Are RLS policies active?
SELECT 
  'DIAGNOSIS: RLS Status' as check_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Check 4: List all policies on users table
SELECT 
  'DIAGNOSIS: Existing Policies' as check_name,
  policyname,
  cmd as command,
  roles::text as roles,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- PART 2: AGGRESSIVE FIX - DROP AND RECREATE EVERYTHING
-- ============================================================================

-- Step 1: Ensure generate_grit_id() function exists
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

-- Step 2: Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 3: DROP ALL EXISTING POLICIES (comprehensive cleanup)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- Step 4: Create the CRITICAL policy - Users can view their own profile
-- This MUST be created first and MUST work
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Step 5: Create update policy
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 6: Create admin policies (using auth.users to avoid recursion)
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role' = 'admin')
  )
);

CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role' = 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role' = 'admin')
  )
);

-- Step 7: Create insert policies
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 8: Update trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  new_grit_id := generate_grit_id();
  
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  INSERT INTO public.users (
    id, email, role, first_name, last_name, grit_id, created_at, updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'),
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    updated_at = NOW();
  
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'))
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 10: Update auth metadata for existing users
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE raw_user_meta_data->>'role' IS NULL;

-- Step 11: CRITICAL - Create/Update the specific user profile
-- This ensures the user profile exists for the user getting 403 errors
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

-- Step 12: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- PART 3: VERIFICATION
-- ============================================================================

-- Verify policies were created
SELECT 
  'VERIFICATION: Policies' as check_name,
  policyname,
  cmd as command
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Verify user profile exists
SELECT 
  'VERIFICATION: User Profile' as check_name,
  id,
  email,
  role,
  grit_id
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Verify RLS is enabled
SELECT 
  'VERIFICATION: RLS Enabled' as check_name,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- If you see "Success" and the verification queries return results,
-- the fix has been applied. Try logging in again!
-- ============================================================================







