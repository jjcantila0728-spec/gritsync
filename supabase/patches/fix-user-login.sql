-- Fix User Login Issues
-- This script fixes common login problems after Supabase migration

-- 1. Check if trigger exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Create user profiles for existing auth users who don't have profiles
-- This fixes users who signed up before the trigger was created
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

-- 3. Add missing INSERT policy for users table (needed for trigger)
-- The trigger needs to be able to insert user profiles
DROP POLICY IF EXISTS "Service role can insert users" ON users;
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
WITH CHECK (true);  -- Allow trigger to insert

-- Note: The SECURITY DEFINER function should bypass RLS, but this policy ensures it works

-- 4. Grant necessary permissions for the trigger function
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- 5. Ensure the trigger function has proper permissions
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;

-- Run this in Supabase SQL Editor to fix login issues

