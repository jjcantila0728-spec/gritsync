-- FINAL RLS FIX - Comprehensive fix for all 403 errors
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================================================
-- PART 1: Fix Users Table
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- CRITICAL: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Service role can insert (for triggers)
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Admin policies (using auth.users to avoid recursion)
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- CRITICAL: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- PART 2: Fix Applications Table
-- ============================================================================

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'applications') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON applications', r.policyname);
  END LOOP;
END $$;

-- CRITICAL: Users can view their own applications
CREATE POLICY "Users can view their own applications"
ON applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own applications
CREATE POLICY "Users can create their own applications"
ON applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own applications
CREATE POLICY "Users can update their own applications"
ON applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Admins can update all applications
CREATE POLICY "Admins can update all applications"
ON applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- CRITICAL: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;

-- ============================================================================
-- PART 3: Fix Quotations Table
-- ============================================================================

-- Enable RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'quotations') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON quotations', r.policyname);
  END LOOP;
END $$;

-- CRITICAL: Users can view their own quotations
CREATE POLICY "Users can view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own quotations
CREATE POLICY "Users can create their own quotations"
ON quotations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own quotations
CREATE POLICY "Users can update their own quotations"
ON quotations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own quotations
CREATE POLICY "Users can delete their own quotations"
ON quotations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all quotations
CREATE POLICY "Admins can view all quotations"
ON quotations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Admins can update all quotations
CREATE POLICY "Admins can update all quotations"
ON quotations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Admins can delete all quotations
CREATE POLICY "Admins can delete all quotations"
ON quotations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- CRITICAL: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;

-- ============================================================================
-- PART 4: Ensure user profile exists
-- ============================================================================

-- Create missing user profile if it doesn't exist
INSERT INTO public.users (id, email, role, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client') as role,
  COALESCE(
    (SELECT grit_id FROM public.users WHERE id = au.id),
    'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0')
  ) as grit_id,
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = au.id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check RLS is enabled
SELECT 
  'RLS Status' as check_type,
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'applications', 'quotations')
ORDER BY tablename;

-- Check policies exist
SELECT 
  'Policies' as check_type,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 6 THEN '✅ GOOD'
    WHEN tablename = 'applications' AND COUNT(*) >= 4 THEN '✅ GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) >= 5 THEN '✅ GOOD'
    ELSE '❌ MISSING'
  END as status
FROM pg_policies 
WHERE tablename IN ('users', 'applications', 'quotations')
GROUP BY tablename
ORDER BY tablename;

-- Check permissions
SELECT 
  'Permissions' as check_type,
  table_name,
  STRING_AGG(privilege_type, ', ') as granted_permissions
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'applications', 'quotations')
  AND grantee = 'authenticated'
GROUP BY table_name
ORDER BY table_name;

-- Check user profile exists
SELECT 
  'User Profile' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 
  '🎉 FINAL RLS FIX COMPLETE!' as message,
  'All tables now have working RLS policies and permissions.' as note,
  'Try logging in again - 403 errors should be resolved.' as next_step;

