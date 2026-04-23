-- Diagnostic Queries to Check User Login Issues
-- Run these in Supabase SQL Editor to diagnose the problem

-- 1. Check if user exists in auth.users
-- Replace 'your-email@example.com' with your email
SELECT id, email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- 2. Check if user profile exists in public.users
-- Replace the UUID with your user ID from step 1
SELECT id, email, role, full_name, created_at 
FROM public.users 
WHERE id = 'paste-user-id-here';

-- 3. Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 4. Check if function exists
SELECT 
  routine_name, 
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- 5. Check RLS policies on users table
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
WHERE tablename = 'users';

-- 6. Check if RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

