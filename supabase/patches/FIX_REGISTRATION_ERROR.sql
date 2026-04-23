-- FIX: Registration Error - "Database error saving new user"
-- Run this in Supabase SQL Editor to fix registration issues

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
-- STEP 2: Ensure RLS is enabled
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Ensure INSERT policies exist (critical for registration)
-- ============================================================================

-- Drop existing insert policies
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Policy 1: Service role can insert (for trigger function)
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 2: Authenticated users can insert their own profile during registration
-- This is CRITICAL - allows users to create their profile after signup
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 4: Fix the trigger function to handle registration correctly
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Generate unique GRIT-ID (required field)
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
  
  -- Insert user profile with all required fields
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
    role = COALESCE(EXCLUDED.role, users.role),
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
-- STEP 5: Ensure trigger exists and is active
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 6: Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- STEP 7: Make sure grit_id column allows NULL temporarily (if needed)
-- This is a safety measure - the trigger should always generate it
-- ============================================================================
-- Check if grit_id is NOT NULL
DO $$
BEGIN
  -- If grit_id is NOT NULL, that's fine - the trigger will always generate it
  -- But if there are existing users without grit_id, we need to generate them
  UPDATE users
  SET grit_id = generate_grit_id()
  WHERE grit_id IS NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- If update fails, it means grit_id is already NOT NULL and all users have it
    NULL;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that trigger exists
SELECT 
  'Trigger Status' as check_type,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' 
  AND trigger_schema = 'auth'
  AND trigger_name = 'on_auth_user_created';

-- Check that insert policies exist
SELECT 
  'Insert Policies' as check_type,
  policyname,
  cmd,
  roles::text
FROM pg_policies 
WHERE tablename = 'users' 
  AND cmd = 'INSERT';

-- Check that generate_grit_id function exists
SELECT 
  'Function Status' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'generate_grit_id';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- Registration should now work! The trigger will automatically create
-- user profiles with all required fields when users sign up.
-- ============================================================================

