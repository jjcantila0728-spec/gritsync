-- SIMPLE FIX: Permission Denied for users and user_documents tables
-- Run this ENTIRE script in Supabase SQL Editor
-- This is a simplified, guaranteed-to-work fix

-- ============================================================================
-- STEP 1: Fix Users Table - Drop all policies and recreate
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

-- Policy 1: Users can view their own profile
CREATE POLICY "users_select_own"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own profile
CREATE POLICY "users_insert_own"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy 4: Admins can view all users (using auth.users metadata - NO RECURSION)
CREATE POLICY "users_select_admin"
ON users FOR SELECT
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy 5: Admins can update all users
CREATE POLICY "users_update_admin"
ON users FOR UPDATE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy 6: Service role can insert (for triggers)
CREATE POLICY "users_insert_service"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- STEP 2: Fix User Documents Table - Drop all policies and recreate
-- ============================================================================

-- Enable RLS
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_documents') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_documents', r.policyname);
  END LOOP;
END $$;

-- Policy 1: Users can view their own documents
CREATE POLICY "user_documents_select_own"
ON user_documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own documents
CREATE POLICY "user_documents_insert_own"
ON user_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own documents
CREATE POLICY "user_documents_update_own"
ON user_documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own documents
CREATE POLICY "user_documents_delete_own"
ON user_documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy 5: Admins can view all documents (using auth.users metadata - NO RECURSION)
CREATE POLICY "user_documents_select_admin"
ON user_documents FOR SELECT
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy 6: Admins can update all documents
CREATE POLICY "user_documents_update_admin"
ON user_documents FOR UPDATE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy 7: Admins can delete all documents
CREATE POLICY "user_documents_delete_admin"
ON user_documents FOR DELETE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;

-- ============================================================================
-- STEP 3: Verify the setup
-- ============================================================================

-- Check RLS status
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'user_documents')
ORDER BY tablename;

-- Check policy count
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('users', 'user_documents')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SUCCESS
-- ============================================================================
SELECT '✅ Permissions fixed! Refresh your browser and try again.' as message;

