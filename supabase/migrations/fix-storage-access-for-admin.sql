-- ============================================================================
-- Fix Storage Access for Admin - Proof of Payment Viewing
-- ============================================================================
-- This migration ensures admins can view proof of payment files in storage
-- ============================================================================

-- Step 1: Check if storage bucket exists and has proper policies
-- Note: Storage policies are managed through Supabase Dashboard or API
-- This SQL file documents what policies should exist

-- ============================================================================
-- Required Storage Bucket Policies for 'documents' bucket
-- ============================================================================
-- These policies should be created in Supabase Dashboard > Storage > Policies
-- Or via Supabase Management API
-- ============================================================================

-- Policy 1: Authenticated users can view their own files
-- Name: "Users can view their own documents"
-- Bucket: documents
-- Operation: SELECT
-- Policy:
--   USING: (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)

-- Policy 2: Admins can view ALL files
-- Name: "Admins can view all documents"
-- Bucket: documents
-- Operation: SELECT
-- Policy:
--   USING: (
--     bucket_id = 'documents' AND
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid() 
--       AND users.role = 'admin'
--     )
--   )

-- Policy 3: Public users can view files in public/payments folder (for checkout)
-- Name: "Public can view payment documents"
-- Bucket: documents
-- Operation: SELECT
-- Policy:
--   USING: (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'public')

-- Policy 4: Authenticated users can upload their own files
-- Name: "Users can upload their own documents"
-- Bucket: documents
-- Operation: INSERT
-- Policy:
--   WITH CHECK: (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)

-- Policy 5: Public users can upload to public/payments folder
-- Name: "Public can upload payment documents"
-- Bucket: documents
-- Operation: INSERT
-- Policy:
--   WITH CHECK: (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'public')

-- ============================================================================
-- Alternative: Use Supabase Storage API to create policies programmatically
-- ============================================================================

-- Note: Storage policies cannot be created via SQL directly
-- They must be created through:
-- 1. Supabase Dashboard: Storage > documents > Policies
-- 2. Supabase Management API
-- 3. Supabase CLI: supabase storage policies

-- ============================================================================
-- Verify Storage Bucket Configuration
-- ============================================================================

-- Check if bucket exists (this will show bucket info if accessible)
SELECT 
  name,
  id,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'documents';

-- ============================================================================
-- Instructions for Manual Setup:
-- ============================================================================
-- 1. Go to Supabase Dashboard > Storage > documents bucket
-- 2. Click on "Policies" tab
-- 3. Create the following policies:
--
--    Policy Name: "Admins can view all documents"
--    Allowed operation: SELECT
--    Policy definition:
--      (bucket_id = 'documents' AND
--       EXISTS (
--         SELECT 1 FROM users
--         WHERE users.id = auth.uid() 
--         AND users.role = 'admin'
--       ))
--
--    Policy Name: "Users can view their own documents"
--    Allowed operation: SELECT
--    Policy definition:
--      (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
--
--    Policy Name: "Public can view payment documents"
--    Allowed operation: SELECT
--    Policy definition:
--      (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'public')
--
-- 4. Save all policies
-- ============================================================================

