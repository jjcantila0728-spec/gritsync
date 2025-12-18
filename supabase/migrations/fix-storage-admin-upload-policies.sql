-- Fix Storage RLS Policies for Admin Uploads
-- This fixes issues where admin users cannot upload files to user folders
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Drop existing storage policies that might conflict
-- ============================================================================
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
      OR policyname LIKE '%admin%'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Ensure is_admin_user() function exists (SECURITY DEFINER)
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
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR app_metadata->>'role' = 'admin'
    )
  );
END;
$$;

-- ============================================================================
-- STEP 3: Create storage policies for documents bucket
-- ============================================================================

-- Policy 1: Users can upload their own documents
-- Checks that the first folder in the path matches their user ID
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view/download their own documents (needed for signed URLs)
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 5: Admins can upload ANY document (any user folder)
-- This is critical for admin operations
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 6: Admins can view ANY document (any user folder)
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 7: Admins can update ANY document (any user folder)
CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 8: Admins can delete ANY document (any user folder)
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

-- Check that all policies were created
SELECT 
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname LIKE '%documents%' 
    OR policyname LIKE '%admin%'
  )
ORDER BY policyname;

-- Test that is_admin_user() function works
SELECT 
  auth.uid() as current_user_id,
  public.is_admin_user() as is_admin;






