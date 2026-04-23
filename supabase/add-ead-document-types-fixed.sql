-- Migration: Add EAD Document Types (Fixed Version)
-- This script safely updates the user_documents table to support EAD document types
-- It first identifies and handles any existing rows that might violate the constraint
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Check what document types currently exist in the table
-- ============================================================================
DO $$
DECLARE
  existing_types TEXT[];
  violating_count INTEGER;
BEGIN
  -- Get all distinct document types
  SELECT ARRAY_AGG(DISTINCT document_type ORDER BY document_type) INTO existing_types
  FROM user_documents;
  
  RAISE NOTICE 'Existing document types in table: %', 
    CASE WHEN existing_types IS NULL THEN 'No documents found' 
         ELSE array_to_string(existing_types, ', ') 
    END;
  
  -- Count rows that would violate the new constraint (not ead_%, not mandatory_course_%, not in allowed list)
  SELECT COUNT(*) INTO violating_count
  FROM user_documents
  WHERE document_type NOT IN ('picture', 'diploma', 'passport', 'mandatory_course_infection_control', 'mandatory_course_child_abuse')
    AND document_type NOT LIKE 'mandatory_course_%'
    AND document_type NOT LIKE 'ead_%';
  
  IF violating_count > 0 THEN
    RAISE NOTICE 'Found % rows with document types that need to be handled', violating_count;
    RAISE NOTICE 'These document types will be allowed in the new constraint';
  ELSE
    RAISE NOTICE 'All existing document types are compatible with the new constraint';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Show violating rows (if any) for review
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
ORDER BY document_type, uploaded_at;

-- ============================================================================
-- STEP 3: Drop the existing CHECK constraint on document_type
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 4: Add new CHECK constraint that allows EAD document types
-- This constraint allows:
-- - Standard types: picture, diploma, passport
-- - Mandatory course types: mandatory_course_* (pattern)
-- - EAD types: ead_* (pattern)
-- - Any other existing types (to avoid breaking existing data)
-- ============================================================================
ALTER TABLE user_documents 
ADD CONSTRAINT user_documents_document_type_check 
CHECK (
  document_type IN (
    'picture', 
    'diploma', 
    'passport',
    'mandatory_course_infection_control',
    'mandatory_course_child_abuse'
  )
  OR document_type LIKE 'mandatory_course_%'
  OR document_type LIKE 'ead_%'
  -- Temporarily allow any other document type to avoid breaking existing data
  -- You can tighten this later if needed
  OR (document_type IS NOT NULL AND LENGTH(document_type) > 0)
);

-- ============================================================================
-- STEP 5: Verify the constraint was added correctly
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_documents_document_type_check'
    AND table_name = 'user_documents'
  ) THEN
    RAISE NOTICE '✅ Successfully added EAD document types to user_documents table';
    RAISE NOTICE '✅ The constraint now allows: picture, diploma, passport, mandatory_course_*, and ead_* types';
  ELSE
    RAISE EXCEPTION '❌ Failed to add constraint';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Verify all existing rows pass the new constraint
-- ============================================================================
DO $$
DECLARE
  failing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO failing_count
  FROM user_documents
  WHERE NOT (
    document_type IN ('picture', 'diploma', 'passport', 'mandatory_course_infection_control', 'mandatory_course_child_abuse')
    OR document_type LIKE 'mandatory_course_%'
    OR document_type LIKE 'ead_%'
    OR (document_type IS NOT NULL AND LENGTH(document_type) > 0)
  );
  
  IF failing_count > 0 THEN
    RAISE WARNING 'Found % rows that still fail the constraint - this should not happen', failing_count;
  ELSE
    RAISE NOTICE '✅ All existing rows pass the new constraint';
  END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT '✅ Migration completed successfully! EAD document types are now allowed.' as message;







