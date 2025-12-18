-- Check and Fix Storage Bucket Configuration
-- This checks if the documents bucket has any settings forcing application/json

-- ============================================================================
-- STEP 1: Check current bucket configuration
-- ============================================================================
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'documents';

-- ============================================================================
-- STEP 2: Check if there are any file_size_limit or allowed_mime_types restrictions
-- ============================================================================
-- If allowed_mime_types is set and doesn't include image types, that could be the issue

-- ============================================================================
-- STEP 3: Update bucket to allow all MIME types
-- ============================================================================
UPDATE storage.buckets
SET allowed_mime_types = NULL  -- NULL means all types are allowed
WHERE id = 'documents';

-- ============================================================================
-- STEP 4: Verify the update
-- ============================================================================
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'documents';

-- ============================================================================
-- STEP 5: Check if there are any triggers on storage.objects
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'storage'
  AND event_object_table = 'objects';

-- ============================================================================
-- STEP 6: Check for any functions that might modify metadata
-- ============================================================================
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname LIKE '%storage%' OR proname LIKE '%content%'
  OR prosrc LIKE '%application/json%';

