-- Migration: Add EAD Document Types
-- This script updates the user_documents table to support EAD document types
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Drop the existing CHECK constraint on document_type
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 2: Add new CHECK constraint that allows EAD document types
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
);

-- ============================================================================
-- STEP 3: Verify the constraint was added correctly
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







