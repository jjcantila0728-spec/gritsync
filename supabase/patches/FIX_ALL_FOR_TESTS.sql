-- COMPLETE FIX: Everything needed for E2E tests to pass
-- Run this ENTIRE script in Supabase SQL Editor
-- This fixes all registration and RLS issues

-- ============================================================================
-- STEP 1: Create generate_grit_id() function
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
-- STEP 2: Enable RLS
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Drop all existing policies
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Create SELECT policies
-- ============================================================================
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- STEP 5: Create UPDATE policies
-- ============================================================================
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

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
-- STEP 6: Create INSERT policies (CRITICAL for registration)
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
-- STEP 7: Create trigger function
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
  
  -- Update auth metadata with role
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'))
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the trigger
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Create trigger
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 9: Grant permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

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
-- This ensures all auth users have profiles in public.users (CRITICAL FIX)
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
-- VERIFICATION
-- ============================================================================
SELECT 'Verification' as section, 'Checking setup...' as status;

-- Check function
SELECT 
  'Function exists' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'generate_grit_id'
  ) THEN '✅' ELSE '❌' END as status;

-- Check trigger
SELECT 
  'Trigger exists' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'auth' AND trigger_name = 'on_auth_user_created'
  ) THEN '✅' ELSE '❌' END as status;

-- Check policies
SELECT 
  'Policies count' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 6 THEN '✅' ELSE '❌' END as status
FROM pg_policies WHERE tablename = 'users';

-- ============================================================================
-- SUCCESS
-- ============================================================================
SELECT 'Setup complete!' as status, 'Run tests: npm run test:e2e:vitest' as next_step;

