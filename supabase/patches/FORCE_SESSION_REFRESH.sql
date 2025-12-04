-- FORCE SESSION REFRESH - This ensures the role is set correctly
-- After running this, you MUST sign out and sign back in to refresh your session

-- ============================================================================
-- STEP 1: Verify and set admin role (using your specific user ID)
-- ============================================================================
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

UPDATE public.users 
SET role = 'admin'
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 2: Verify it's set correctly
-- ============================================================================
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role_in_auth,
  (SELECT role FROM public.users WHERE id = auth.users.id) as role_in_public
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- ============================================================================
-- STEP 3: Test the admin check (should return true)
-- ============================================================================
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND raw_user_meta_data->>'role' = 'admin'
) as is_admin;

-- ============================================================================
-- IMPORTANT: After running this SQL:
-- 1. Sign out of your application
-- 2. Sign back in
-- 3. This will refresh your session with the new role
-- 4. Then try accessing AdminClients again
-- ============================================================================

