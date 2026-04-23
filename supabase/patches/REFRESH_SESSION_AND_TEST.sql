-- REFRESH SESSION AND TEST - Run this to verify everything is set correctly
-- After running this, you may need to sign out and sign back in

-- ============================================================================
-- STEP 1: Verify admin role is set correctly
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role_in_auth,
  raw_user_meta_data as full_metadata
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 2: Double-check the admin policy expression
-- ============================================================================
-- This should return true
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND raw_user_meta_data->>'role' = 'admin'
) as admin_check;

-- ============================================================================
-- STEP 3: Test if RLS allows the query (run this as the authenticated user)
-- ============================================================================
-- This should return 1 client if RLS is working
SELECT COUNT(*) as clients_visible
FROM public.users
WHERE role = 'client';

-- ============================================================================
-- STEP 4: Check RLS policies
-- ============================================================================
SELECT 
  policyname,
  cmd,
  roles,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'users'
AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- IMPORTANT: After verifying the role is set, you may need to:
-- 1. Sign out of your application
-- 2. Sign back in
-- 3. This will refresh the session with the new role metadata
-- ============================================================================

