-- FIX: Registration Success but User Not in Table
-- Run this in Supabase SQL Editor to fix the issue

-- Step 1: Ensure the trigger function exists and has correct permissions
-- Also sets role in auth metadata to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'client', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "client"}'::jsonb
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Recreate the trigger (ensures new signups create profiles)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Create profiles for existing auth users who don't have profiles
-- This fixes users who registered but don't appear in the users table
INSERT INTO public.users (id, email, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'client' as role,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 4: Fix RLS policies to avoid infinite recursion
-- Replace admin policies to check auth.users metadata instead of querying public.users
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can update all users" ON users;
CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Ensure trigger can insert
DROP POLICY IF EXISTS "Service role can insert users" ON users;
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
WITH CHECK (true);

-- Step 5: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Step 6: Verify the fix
-- Check if there are any auth users without profiles
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  pu.id as profile_id,
  pu.email as profile_email
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- If the query above returns rows, those users need profiles created
-- The INSERT above should have fixed them, but if not, run this:
-- INSERT INTO public.users (id, email, role, created_at, updated_at)
-- SELECT id, email, 'client', created_at, NOW()
-- FROM auth.users
-- WHERE id NOT IN (SELECT id FROM public.users)
-- ON CONFLICT (id) DO NOTHING;

-- Step 7: Update existing users to have role in auth metadata (fixes recursion for existing users)
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE raw_user_meta_data->>'role' IS NULL;

-- Done! Now try registering again.
-- The recursion error should be fixed.

