-- FIX ADMIN ROLE FINAL - This will fix the permission denied error
-- The frontend shows role: 'admin' but RLS checks raw_user_meta_data in auth.users
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Check current status
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role_in_auth_users,
  raw_user_meta_data as full_metadata,
  (SELECT role FROM public.users WHERE id = auth.users.id) as role_in_public_users
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 2: Set admin role in auth.users (using your specific user ID)
-- ============================================================================
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 3: Set admin role in public.users
-- ============================================================================
UPDATE public.users 
SET role = 'admin'
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role_in_auth_users,
  (SELECT role FROM public.users WHERE id = auth.users.id) as role_in_public_users
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 5: Test admin check (should now return true)
-- ============================================================================
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND raw_user_meta_data->>'role' = 'admin'
) as is_admin_check;

-- ============================================================================
-- STEP 6: Test if you can see clients (should return 1)
-- ============================================================================
-- This simulates what the RLS policy does
SELECT 
  COUNT(*) as total_clients_visible
FROM public.users
WHERE role = 'client';

-- ============================================================================
-- STEP 7: Test the exact query (should show the client)
-- ============================================================================
SELECT *
FROM public.users
WHERE role = 'client'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 8: Verify RLS policies exist
-- ============================================================================
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- After running this, refresh your browser and the client should appear!

