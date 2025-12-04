-- QUICK FIX: Set Admin Role Correctly
-- Run this to fix admin role in both auth.users and public.users
-- Replace 'your-admin-email@example.com' with your actual admin email

-- ============================================================================
-- STEP 1: Find your admin user email
-- ============================================================================
SELECT id, email, raw_user_meta_data->>'role' as current_role
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'admin' OR id IN (
  SELECT id FROM public.users WHERE role = 'admin'
);

-- ============================================================================
-- STEP 2: Set admin role in auth.users (REPLACE EMAIL BELOW)
-- ============================================================================
-- IMPORTANT: Replace 'your-admin-email@example.com' with your actual admin email
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';

-- ============================================================================
-- STEP 3: Set admin role in public.users (REPLACE EMAIL BELOW)
-- ============================================================================
UPDATE public.users 
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';

-- ============================================================================
-- STEP 4: Verify it worked
-- ============================================================================
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as auth_role,
  p.role as public_role
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'your-admin-email@example.com';

-- ============================================================================
-- STEP 5: Test if you can now see clients
-- ============================================================================
SELECT 
  COUNT(*) as total_clients_visible
FROM public.users
WHERE role = 'client';

-- If this returns 1, the fix worked!

