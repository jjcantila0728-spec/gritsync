-- FIX: Permission Denied for Tables: users and user_documents
-- Run this ENTIRE script in Supabase SQL Editor
-- This fixes RLS policies and grants proper permissions for both tables

-- ============================================================================
-- PART 1: Fix Users Table
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on users table
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

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Service role can insert (for triggers and backend operations)
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Admin policies (using auth.users to avoid RLS recursion)
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

-- Grant permissions for users table
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- PART 2: Fix User Documents Table
-- ============================================================================

-- Enable RLS
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on user_documents table
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_documents') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_documents', r.policyname);
  END LOOP;
END $$;

-- CRITICAL: Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON user_documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
ON user_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON user_documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON user_documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admin policies (using auth.users to avoid RLS recursion - CRITICAL FIX)
CREATE POLICY "Admins can view all documents"
ON user_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can update all documents"
ON user_documents FOR UPDATE
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

CREATE POLICY "Admins can delete all documents"
ON user_documents FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Grant permissions for user_documents table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if RLS is enabled on both tables
SELECT 
  'RLS Status' as check_type,
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'user_documents')
ORDER BY tablename;

-- Check policies exist for both tables
SELECT 
  'Policies' as check_type,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('users', 'user_documents')
ORDER BY tablename, cmd, policyname;

-- Check permissions for both tables
SELECT 
  'Permissions' as check_type,
  table_name,
  STRING_AGG(privilege_type, ', ') as granted_permissions
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_documents')
  AND grantee = 'authenticated'
GROUP BY table_name
ORDER BY table_name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 
  '✅ Users and User Documents permissions fixed!' as message,
  'RLS policies and grants have been configured for both tables.' as note,
  'The 403 errors should now be resolved. Try accessing the documents page again.' as next_step;

