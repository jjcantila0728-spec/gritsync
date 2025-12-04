-- SIMPLE DIRECT FIX FOR 403 ERROR
-- Run this in Supabase SQL Editor
-- This is a minimal fix that should work immediately

-- Step 1: Drop all policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- Step 2: Create the ESSENTIAL policy first - this is what allows users to read their own data
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Step 3: Create update policy
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 4: Create admin policies
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

-- Step 5: Create insert policies
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 6: Ensure the user profile exists
INSERT INTO public.users (id, email, role, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client'),
  COALESCE(
    (SELECT grit_id FROM public.users WHERE id = au.id),
    'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0')
  ),
  COALESCE(
    (SELECT created_at FROM public.users WHERE id = au.id),
    au.created_at
  ),
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = COALESCE(EXCLUDED.role, users.role),
  updated_at = NOW();

-- Step 7: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Verification
SELECT 'Policies created:' as status, COUNT(*) as count FROM pg_policies WHERE tablename = 'users';
SELECT 'User profile exists:' as status, COUNT(*) as count FROM public.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';







