-- COMPLETE RLS FIX - Fixes all tables (users, applications, quotations)
-- Run this in Supabase SQL Editor to fix all 403 errors

-- ============================================================================
-- PART 1: Fix Users Table (from SIMPLE_RLS_SETUP.sql)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- Simple SELECT policy - Users can read their own profile
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Simple UPDATE policy
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Simple INSERT policy
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

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- PART 2: Fix Applications Table
-- ============================================================================

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on applications
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'applications') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON applications', r.policyname);
  END LOOP;
END $$;

-- Users can view their own applications
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

-- Admins can view all applications (using auth.users to avoid recursion)
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;

-- ============================================================================
-- PART 3: Fix Quotations Table
-- ============================================================================

-- Enable RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on quotations
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'quotations') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON quotations', r.policyname);
  END LOOP;
END $$;

-- Users can view their own quotations
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

-- Admins can view all quotations (using auth.users to avoid recursion)
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT '✅ RLS Setup Complete!' as status;

-- Check policies count
SELECT 
  'Users policies' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'users'
UNION ALL
SELECT 
  'Applications policies' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'applications'
UNION ALL
SELECT 
  'Quotations policies' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'quotations';

-- Check RLS is enabled
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'applications', 'quotations')
ORDER BY tablename;

-- ============================================================================
-- SUCCESS
-- ============================================================================
SELECT 
  '🎉 Complete RLS Fix Applied!' as message,
  'All tables (users, applications, quotations) now have working RLS policies.' as note;

