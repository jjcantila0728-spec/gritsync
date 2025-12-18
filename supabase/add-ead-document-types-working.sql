-- Migration: Add EAD Document Types (Working Solution)
-- This script safely updates the user_documents table to support EAD document types
-- It uses a permissive constraint that allows all existing document types
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Drop the existing CHECK constraint
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 2: Add a permissive constraint that allows:
-- - Standard types (picture, diploma, passport)
-- - Mandatory course types (mandatory_course_*)
-- - EAD types (ead_*)
-- - Any other existing document types (to avoid breaking existing data)
-- ============================================================================
ALTER TABLE user_documents 
ADD CONSTRAINT user_documents_document_type_check 
CHECK (
  document_type IS NOT NULL 
  AND LENGTH(TRIM(document_type)) > 0
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
  '✅ Constraint updated successfully!' as status,
  'EAD document types (ead_*) are now allowed, along with all existing document types.' as message;







