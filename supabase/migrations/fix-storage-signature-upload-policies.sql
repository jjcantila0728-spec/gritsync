-- Fix Storage RLS Policies for Signature Uploads and Document Access
-- This migration fixes 400 errors when accessing documents and RLS violations when uploading signatures

-- ============================================================================
-- STEP 1: Drop existing storage policies that might be causing issues
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
      OR policyname LIKE '%signature%'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Ensure is_admin_user() function exists (bypasses RLS)
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
-- STEP 3: Create improved storage policies for documents bucket
-- ============================================================================

-- Policy 1: Users can upload to their own folder
-- This allows users to upload files to folders matching their user ID
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (
    -- Allow if folder name matches user ID
    auth.uid()::text = (string_to_array(name, '/'))[1]
    OR
    -- Allow if it's a signature file in user's folder
    (
      name LIKE '%signature%' AND
      auth.uid()::text = (string_to_array(name, '/'))[1]
    )
  )
);

-- Policy 2: Users can view/download their own documents (needed for signed URLs)
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Allow if folder name matches user ID
    auth.uid()::text = (string_to_array(name, '/'))[1]
    OR
    -- Allow if it's a signature file in user's folder
    (
      name LIKE '%signature%' AND
      auth.uid()::text = (string_to_array(name, '/'))[1]
    )
  )
);

-- Policy 3: Users can update their own documents (for upsert operations)
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy 5: Admins can view all documents (using SECURITY DEFINER function - NO RECURSION)
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 6: Admins can upload all documents
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 7: Admins can update all documents
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

-- Policy 8: Admins can delete all documents
CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- ============================================================================
-- STEP 4: Fix temporary_signatures RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow insert for temporary signatures" ON temporary_signatures;
DROP POLICY IF EXISTS "Allow read unconsumed signatures by session" ON temporary_signatures;
DROP POLICY IF EXISTS "Allow update to mark consumed" ON temporary_signatures;

-- Recreate with better conditions
CREATE POLICY "Allow insert for temporary signatures"
  ON temporary_signatures
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow read unconsumed signatures by session"
  ON temporary_signatures
  FOR SELECT
  TO authenticated, anon
  USING (
    is_consumed = false 
    AND expires_at > NOW()
  );

CREATE POLICY "Allow update to mark consumed"
  ON temporary_signatures
  FOR UPDATE
  TO authenticated, anon
  USING (is_consumed = false)
  WITH CHECK (is_consumed = true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check storage policies
SELECT 
  'Storage Policies' as check_type,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%documents%'
ORDER BY policyname;

-- Check temporary_signatures policies
SELECT 
  'Temporary Signatures Policies' as check_type,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'temporary_signatures'
ORDER BY policyname;






