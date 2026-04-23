-- FIX: 403 Error on Login - Users Cannot Read Their Own Profile
-- Run this in Supabase SQL Editor to fix the RLS policy issue

-- Step 1: Ensure RLS is enabled on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

-- Step 3: Recreate the "Users can view their own profile" policy
-- This is the critical policy that allows users to read their own data
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Step 4: Recreate the "Users can update their own profile" policy
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 5: Fix the admin policies to avoid recursion
-- Use auth.users metadata instead of querying public.users
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

-- Step 6: Ensure trigger function can insert users (for new registrations)
-- The SECURITY DEFINER function should bypass RLS, but we add policies as backup
DROP POLICY IF EXISTS "Service role can insert users" ON users;
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow authenticated users to insert their own profile during registration
-- This is needed if the trigger runs with the user's context
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 7: Update the trigger function to set role in auth metadata
-- This prevents RLS recursion issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'), NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = NOW();
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'))
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 9: Update existing users to have role in auth metadata
-- This fixes recursion for existing users
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE raw_user_meta_data->>'role' IS NULL;

-- Step 10: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Verification queries (run these to check if the fix worked):
-- 1. Check if policies exist
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users';

-- 2. Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';

-- 3. Test as a logged-in user (replace with your user ID):
-- SET request.jwt.claim.sub = 'your-user-id-here';
-- SELECT * FROM users WHERE id = 'your-user-id-here';

