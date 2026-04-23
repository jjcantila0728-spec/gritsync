-- FIX: Storage Policies - 400 Errors when creating signed URLs
-- Run this ENTIRE script in Supabase SQL Editor
-- This fixes storage policies to avoid RLS recursion

-- Note: RLS on storage.objects is automatically enabled by Supabase
-- We only need to manage the policies

-- ============================================================================
-- STEP 1: Drop ALL existing storage policies for documents bucket
-- ============================================================================
-- Drop policies by name (these are the common ones from schema.sql)
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;

-- Also drop any other policies that might exist
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND (
      policyname LIKE '%documents%' 
      OR policyname LIKE '%document%'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Create helper function to check admin status (bypasses RLS)
-- Note: This function may already exist from fix-permissions-definitive.sql
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
-- STEP 3: Create storage policies for documents bucket
-- ============================================================================

-- Users can upload their own documents
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view/download their own documents (needed for signed URLs)
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all documents (using SECURITY DEFINER function - NO RECURSION)
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Admins can upload all documents
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Admins can delete all documents
CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check storage policies
SELECT 
  'Storage Policies' as check_type,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%documents%'
ORDER BY policyname;

-- ============================================================================
-- SUCCESS
-- ============================================================================
SELECT '✅ Storage policies fixed! Try accessing documents again.' as message;

