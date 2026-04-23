-- CREATE MISSING USER PROFILE
-- Run this if a user exists in auth.users but not in public.users
-- Replace the user ID below with the actual user ID

-- Step 1: Check if user exists in auth.users
SELECT 
  'Checking auth.users...' as step,
  id,
  email,
  raw_user_meta_data->>'role' as role_in_metadata,
  created_at
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Step 2: Check if user exists in public.users
SELECT 
  'Checking public.users...' as step,
  id,
  email,
  role,
  first_name,
  last_name,
  grit_id
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Step 3: Create missing profile (only if user exists in auth.users but not public.users)
-- This will create the profile with proper first_name, last_name, and grit_id
INSERT INTO public.users (id, email, role, first_name, last_name, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client') as role,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'first_name', '')), '') as first_name,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'last_name', '')), '') as last_name,
  generate_grit_id() as grit_id,
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Verify profile was created
SELECT 
  'Profile created/verified' as step,
  id,
  email,
  role,
  first_name,
  last_name,
  grit_id,
  created_at
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Step 5: Update auth metadata with role (if missing)
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND (raw_user_meta_data->>'role' IS NULL OR raw_user_meta_data->>'role' = '');

