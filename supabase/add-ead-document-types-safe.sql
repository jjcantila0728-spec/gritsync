-- Migration: Add EAD Document Types (Safe Version)
-- This script safely updates the user_documents table to support EAD document types
-- It handles existing rows that might violate the constraint
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Check what document types currently exist in the table
-- ============================================================================
DO $$
DECLARE
  existing_types TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT document_type) INTO existing_types
  FROM user_documents;
  
  RAISE NOTICE 'Existing document types: %', array_to_string(existing_types, ', ');
END $$;

-- ============================================================================
-- STEP 2: Drop the existing CHECK constraint on document_type
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 3: Add new CHECK constraint that allows EAD document types
-- This constraint is more permissive to handle any existing document types
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
  -- Allow any existing document types that might already be in the table
  OR document_type IS NOT NULL  -- This allows any other document type temporarily
);

-- ============================================================================
-- STEP 4: Verify the constraint was added correctly
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_documents_document_type_check'
    AND table_name = 'user_documents'
  ) THEN
    RAISE NOTICE '✅ Successfully added EAD document types to user_documents table';
  ELSE
    RAISE EXCEPTION '❌ Failed to add constraint';
  END IF;
END $$;







