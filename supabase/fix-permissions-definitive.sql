-- DEFINITIVE FIX: Permission Denied for users and user_documents
-- Run this ENTIRE script in Supabase SQL Editor
-- This uses SECURITY DEFINER functions to completely avoid RLS recursion

-- ============================================================================
-- STEP 1: Create helper function to check admin status (bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- ============================================================================
-- STEP 2: Fix Users Table
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- Users can view their own profile
CREATE POLICY "users_select_own"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "users_insert_own"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Admins can view all users (using SECURITY DEFINER function)
CREATE POLICY "users_select_admin"
ON users FOR SELECT
TO authenticated
USING (public.is_admin_user());

-- Admins can update all users
CREATE POLICY "users_update_admin"
ON users FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Service role can insert
CREATE POLICY "users_insert_service"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- STEP 3: Fix User Documents Table
-- ============================================================================

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_documents') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_documents', r.policyname);
  END LOOP;
END $$;

-- Users can view their own documents
CREATE POLICY "user_documents_select_own"
ON user_documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "user_documents_insert_own"
ON user_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "user_documents_update_own"
ON user_documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "user_documents_delete_own"
ON user_documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all documents (using SECURITY DEFINER function)
CREATE POLICY "user_documents_select_admin"
ON user_documents FOR SELECT
TO authenticated
USING (public.is_admin_user());

-- Admins can update all documents
CREATE POLICY "user_documents_update_admin"
ON user_documents FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Admins can delete all documents
CREATE POLICY "user_documents_delete_admin"
ON user_documents FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  '✅ Setup Complete!' as status,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('users', 'user_documents')
GROUP BY tablename
ORDER BY tablename;

SELECT 'Refresh your browser and try again. The 403 errors should be fixed!' as next_step;

