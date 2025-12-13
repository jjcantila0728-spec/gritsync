-- Migration: Add "additional" document types to user_documents table
-- This allows saving generated forms (G-1145, I-765, Cover Letter) to /documents/additional
-- Each form gets its own document type to prevent overwriting

-- ============================================================================
-- STEP 1: Drop the existing CHECK constraint on document_type
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 2: Add new CHECK constraint that includes additional document types
-- ============================================================================
ALTER TABLE user_documents 
ADD CONSTRAINT user_documents_document_type_check 
CHECK (
  document_type IN (
    'picture', 
    'diploma', 
    'passport',
    'mandatory_course_infection_control',
    'mandatory_course_child_abuse',
    'additional',
    'additional_g1145',
    'additional_i765',
    'additional_cover_letter'
  )
  OR document_type LIKE 'mandatory_course_%'
  OR document_type LIKE 'additional_%'
);

-- ============================================================================
-- STEP 3: Update the unique index to exclude additional documents
-- This allows multiple additional documents per user
-- ============================================================================
-- The existing unique index only applies to required documents (picture, diploma, passport)
-- Additional documents can have multiple entries per user

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.user_documents'::regclass
AND conname = 'user_documents_document_type_check';

-- ============================================================================
-- SUCCESS
-- ============================================================================
SELECT '✅ Additional document types added successfully!' as message;

