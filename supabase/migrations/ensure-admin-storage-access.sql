-- ============================================================================
-- Ensure Admin Storage Access for Proof of Payment Files
-- ============================================================================
-- This migration ensures admins can view proof of payment files
-- Note: Storage policies must be created in Supabase Dashboard
-- This file documents what policies should exist and verifies the function
-- ============================================================================

-- Step 1: Ensure is_admin_user() function exists and works correctly
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check auth.users directly to avoid RLS recursion
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon;

-- Step 2: Verify function works
-- This should return true for admin users
SELECT 
  'is_admin_user function' as check_name,
  public.is_admin_user() as is_admin,
  auth.uid() as current_user_id;

-- ============================================================================
-- Step 3: Storage Policies (Must be created in Supabase Dashboard)
-- ============================================================================
-- Go to: Supabase Dashboard > Storage > documents bucket > Policies
-- 
-- Create the following policy:
--
-- Policy Name: "Admins can view all documents"
-- Allowed operation: SELECT
-- Policy definition:
--   (bucket_id = 'documents' AND public.is_admin_user())
--
-- Policy Name: "Admins can view public payment documents"
-- Allowed operation: SELECT  
-- Policy definition:
--   (bucket_id = 'documents' AND (
--     public.is_admin_user() OR
--     (storage.foldername(name))[1] = 'public'
--   ))
--
-- ============================================================================
-- Step 4: Verify storage bucket exists
-- ============================================================================
SELECT 
  name,
  id,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'documents';

-- ============================================================================
-- Step 5: Check existing storage policies
-- ============================================================================
SELECT 
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (
  policyname LIKE '%admin%' 
  OR policyname LIKE '%document%'
)
ORDER BY policyname;

-- ============================================================================
-- Instructions for Manual Setup in Supabase Dashboard:
-- ============================================================================
-- 1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/storage/buckets/documents/policies
-- 2. Click "New Policy" or edit existing "Admins can view all documents" policy
-- 3. Set:
--    - Policy Name: "Admins can view all documents"
--    - Allowed operation: SELECT
--    - Policy definition:
--        (bucket_id = 'documents' AND public.is_admin_user())
-- 4. Save the policy
-- 5. Test by trying to view a proof of payment file as admin
-- ============================================================================

