-- Migration: Add EAD Document Types (Step-by-Step)
-- This script safely updates the user_documents table to support EAD document types
-- Run each step separately if you encounter errors
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: First, let's see what document types exist in your table
-- ============================================================================
SELECT 
  document_type,
  COUNT(*) as count
FROM user_documents
GROUP BY document_type
ORDER BY document_type;

-- ============================================================================
-- STEP 2: Check which rows would violate the new constraint
-- ============================================================================
SELECT 
  id,
  user_id,
  document_type,
  file_name,
  uploaded_at
FROM user_documents
WHERE document_type NOT IN ('picture', 'diploma', 'passport', 'mandatory_course_infection_control', 'mandatory_course_child_abuse')
  AND document_type NOT LIKE 'mandatory_course_%'
  AND document_type NOT LIKE 'ead_%'
ORDER BY document_type;

-- ============================================================================
-- STEP 3: If you see violating rows above, you have two options:
-- 
-- OPTION A: Delete the violating rows (if they're not needed)
-- Uncomment the line below and run it:
-- DELETE FROM user_documents WHERE document_type NOT IN ('picture', 'diploma', 'passport', 'mandatory_course_infection_control', 'mandatory_course_child_abuse') AND document_type NOT LIKE 'mandatory_course_%' AND document_type NOT LIKE 'ead_%';
--
-- OPTION B: Update violating rows to a valid type (if you want to keep them)
-- Example: UPDATE user_documents SET document_type = 'picture' WHERE document_type = 'some_invalid_type';
--
-- OPTION C: Make the constraint permissive to allow all existing types
-- (This is what we'll do in the next step)
-- ============================================================================

-- ============================================================================
-- STEP 4: Drop the existing constraint
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 5: Add a permissive constraint that allows all existing document types
-- This will allow any non-empty document_type to avoid breaking existing data
-- ============================================================================
ALTER TABLE user_documents 
ADD CONSTRAINT user_documents_document_type_check 
CHECK (
  document_type IS NOT NULL 
  AND LENGTH(TRIM(document_type)) > 0
);

-- ============================================================================
-- STEP 6: Verify the constraint was added
-- ============================================================================
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.user_documents'::regclass
AND conname = 'user_documents_document_type_check';

-- ============================================================================
-- SUCCESS: The constraint is now permissive and allows EAD document types
-- ============================================================================
SELECT '✅ Migration completed! EAD document types (and any other types) are now allowed.' as message;
SELECT '⚠️  Note: The constraint is currently permissive. You can tighten it later if needed.' as warning;







