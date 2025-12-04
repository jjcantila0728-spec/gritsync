-- VERIFY RLS POLICY IS WORKING
-- This will help us understand why the admin policy isn't working

-- ============================================================================
-- STEP 1: Check if admin role is set correctly
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role_in_auth,
  raw_user_meta_data as full_metadata
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 2: Test the admin check expression (should return true)
-- ============================================================================
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND raw_user_meta_data->>'role' = 'admin'
) as admin_check_result;

-- ============================================================================
-- STEP 3: Check what RLS policies exist
-- ============================================================================
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'users'
AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- STEP 4: Check if RLS is enabled
-- ============================================================================
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- ============================================================================
-- STEP 5: Test query as if you're the admin user (using the user ID directly)
-- ============================================================================
-- This simulates what happens when the admin user queries
-- Note: This won't work in SQL Editor because auth.uid() will be different
-- But it shows the query structure

-- ============================================================================
-- STEP 6: Check if there's a conflict with multiple policies
-- ============================================================================
-- If both "Users can view their own profile" and "Admins can view all users" 
-- exist, they should both apply (OR logic), but let's verify

-- ============================================================================
-- IMPORTANT: The issue might be that you need to sign out and sign back in
-- to refresh your session. RLS policies check auth.users at query time,
-- but the session token might be cached.
-- ============================================================================

