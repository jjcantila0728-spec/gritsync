-- FIX ADMIN ROLE - Run this to set your admin role correctly
-- This will fix the "is_admin_check" returning false

-- ============================================================================
-- STEP 1: Check your current user ID and email
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as current_role_in_auth,
  (SELECT role FROM public.users WHERE id = auth.users.id) as current_role_in_public
FROM auth.users 
WHERE id = auth.uid();

-- ============================================================================
-- STEP 2: Set admin role in auth.users (using your current user ID)
-- ============================================================================
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = auth.uid();

-- ============================================================================
-- STEP 3: Set admin role in public.users (using your current user ID)
-- ============================================================================
UPDATE public.users 
SET role = 'admin'
WHERE id = auth.uid();

-- ============================================================================
-- STEP 4: Verify the fix worked
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role_in_auth,
  (SELECT role FROM public.users WHERE id = auth.users.id) as role_in_public
FROM auth.users 
WHERE id = auth.uid();

-- ============================================================================
-- STEP 5: Test admin check again (should now return true)
-- ============================================================================
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = auth.uid() 
  AND raw_user_meta_data->>'role' = 'admin'
) as is_admin_check;

-- ============================================================================
-- STEP 6: Test if you can now see clients (should return 1)
-- ============================================================================
SELECT 
  COUNT(*) as total_clients_visible
FROM public.users
WHERE role = 'client';

-- ============================================================================
-- STEP 7: Test the exact query the frontend uses
-- ============================================================================
SELECT *
FROM public.users
WHERE role = 'client'
ORDER BY created_at DESC;

-- If you can see the client in step 7, the fix worked!
-- Refresh your AdminClients page and the client should appear.

