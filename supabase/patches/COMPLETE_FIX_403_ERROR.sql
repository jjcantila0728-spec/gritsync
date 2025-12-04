-- COMPLETE FIX: 403 Error on Login - Comprehensive Solution
-- Run this ENTIRE script in Supabase SQL Editor to fix all RLS and user profile issues
-- This script is self-contained and includes all necessary functions and policies

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
    -- Generate 6 digit number (100000 to 999999)
    new_grit_id := 'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0');
    
    -- Check if it already exists
    SELECT COUNT(*) INTO exists_check
    FROM users
    WHERE grit_id = new_grit_id;
    
    -- If unique, return it
    EXIT WHEN exists_check = 0;
    
    -- Prevent infinite loop
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique GRIT-ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  RETURN new_grit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Ensure RLS is enabled on users table
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Drop all existing policies to recreate them cleanly
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- ============================================================================
-- STEP 4: Recreate the "Users can view their own profile" policy
-- This is the CRITICAL policy that allows users to read their own data
-- ============================================================================
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ============================================================================
-- STEP 5: Recreate the "Users can update their own profile" policy
-- ============================================================================
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 6: Fix the admin policies to avoid recursion
-- Use auth.users metadata instead of querying public.users (which causes RLS recursion)
-- ============================================================================
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- STEP 7: Ensure trigger function can insert users (for new registrations)
-- ============================================================================
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow authenticated users to insert their own profile during registration
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 8: Update the trigger function to handle new user creation
-- This includes first_name, last_name, and grit_id generation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Insert user profile with first_name, last_name, and generated grit_id
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
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
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'))
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Ensure trigger exists
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 10: Update existing users to have role in auth metadata
-- This fixes recursion for existing users by storing role in auth.users metadata
-- ============================================================================
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE raw_user_meta_data->>'role' IS NULL;

-- ============================================================================
-- STEP 11: Generate grit_id for existing users who don't have one
-- ============================================================================
UPDATE users
SET grit_id = generate_grit_id()
WHERE grit_id IS NULL;

-- ============================================================================
-- STEP 12: Create missing user profiles for existing auth users
-- This ensures all auth users have profiles in public.users
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
-- STEP 13: Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- VERIFICATION (Optional - uncomment to run)
-- ============================================================================

-- 1. Check if policies exist
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users';

-- 2. Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';

-- 3. Check for users without profiles
-- SELECT au.id, au.email 
-- FROM auth.users au
-- LEFT JOIN public.users pu ON au.id = pu.id
-- WHERE pu.id IS NULL;

-- 4. Test as a logged-in user (replace with your user ID):
-- SET request.jwt.claim.sub = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
-- SELECT * FROM users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
-- RESET request.jwt.claim.sub;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- If you see "Success. No rows returned" or similar, the fix has been applied!
-- Try logging in again - the 403 errors should be resolved.
-- ============================================================================







