-- VERIFY AND FIX ADMIN ACCESS
-- Run this to ensure your admin role is set correctly and RLS policies work

-- ============================================================================
-- STEP 1: Check your current admin status
-- ============================================================================
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'role' as role_in_auth_users,
  (SELECT role FROM public.users WHERE id = auth.users.id) as role_in_public_users
FROM auth.users 
WHERE id = auth.uid();

-- ============================================================================
-- STEP 2: If role is not 'admin', fix it (replace with your email)
-- ============================================================================
-- IMPORTANT: Replace 'your-admin-email@example.com' with your actual admin email
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';

UPDATE public.users 
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';

-- ============================================================================
-- STEP 3: Verify the admin policy expression works
-- ============================================================================
-- This should return true if you're admin
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = auth.uid() 
  AND raw_user_meta_data->>'role' = 'admin'
) as admin_check_result;

-- ============================================================================
-- STEP 4: Test if you can see all users (should work if admin)
-- ============================================================================
SELECT 
  COUNT(*) as total_users_visible,
  COUNT(*) FILTER (WHERE role = 'client') as clients_visible
FROM public.users;

-- ============================================================================
-- STEP 5: Test the exact query the frontend uses
-- ============================================================================
SELECT *
FROM public.users
WHERE role = 'client'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 6: If still not working, check if policies exist
-- ============================================================================
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- STEP 7: Recreate admin policy if needed (only if policies are missing)
-- ============================================================================
-- Only run this if the admin policy doesn't exist or isn't working
-- DROP POLICY IF EXISTS "Admins can view all users" ON users;
-- CREATE POLICY "Admins can view all users"
-- ON users FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM auth.users
--     WHERE id = auth.uid() 
--     AND raw_user_meta_data->>'role' = 'admin'
--   )
-- );

