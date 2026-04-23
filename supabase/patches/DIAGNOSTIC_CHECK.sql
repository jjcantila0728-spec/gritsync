-- DIAGNOSTIC CHECK - Run this to verify your setup
-- This will help identify why clients are not showing

-- ============================================================================
-- STEP 1: Check your current user and admin role
-- ============================================================================
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'role' as role_in_metadata,
  created_at
FROM auth.users 
WHERE id = auth.uid();

-- ============================================================================
-- STEP 2: Check if your user exists in public.users table
-- ============================================================================
SELECT 
  id, 
  email, 
  role,
  first_name,
  last_name,
  created_at
FROM public.users 
WHERE id = auth.uid();

-- ============================================================================
-- STEP 3: Count total users by role
-- ============================================================================
SELECT 
  role,
  COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- ============================================================================
-- STEP 4: Check if there are any clients
-- ============================================================================
SELECT COUNT(*) as total_clients
FROM public.users
WHERE role = 'client';

-- ============================================================================
-- STEP 5: List all clients (if you can see them, RLS is working)
-- ============================================================================
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  grit_id,
  created_at
FROM public.users
WHERE role = 'client'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 6: Check RLS policies on users table
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- STEP 7: Test if you can query as admin (should return all users if admin)
-- ============================================================================
-- This should work if you're admin and RLS policies are correct
SELECT 
  COUNT(*) as total_users_visible,
  COUNT(*) FILTER (WHERE role = 'client') as clients_visible
FROM public.users;

-- ============================================================================
-- FIX: If your role is not 'admin', run this (replace with your email):
-- ============================================================================
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'your-admin-email@example.com';
--
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE email = 'your-admin-email@example.com';

