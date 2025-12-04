-- Migration: Add Mandatory Course Document Types
-- This script updates the user_documents table to support mandatory course document types
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Drop the existing CHECK constraint on document_type
-- ============================================================================
ALTER TABLE user_documents 
DROP CONSTRAINT IF EXISTS user_documents_document_type_check;

-- ============================================================================
-- STEP 2: Update the PRIMARY KEY constraint if needed
-- Note: The current PRIMARY KEY is (user_id, document_type)
-- For mandatory courses, we want to allow multiple files per user
-- So we need to change the primary key to include an id column
-- ============================================================================

-- First, check if id column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_documents' 
    AND column_name = 'id'
  ) THEN
    -- Add id column
    ALTER TABLE user_documents ADD COLUMN id UUID DEFAULT uuid_generate_v4();
    
    -- Populate id for existing rows
    UPDATE user_documents SET id = uuid_generate_v4() WHERE id IS NULL;
    
    -- Make id NOT NULL
    ALTER TABLE user_documents ALTER COLUMN id SET NOT NULL;
    
    -- Drop the old composite primary key
    ALTER TABLE user_documents DROP CONSTRAINT IF EXISTS user_documents_pkey;
    
    -- Create new primary key on id
    ALTER TABLE user_documents ADD PRIMARY KEY (id);
  END IF;
END $$;

-- ============================================================================
-- STEP 2.5: Create partial unique index for required documents
-- This ensures users can only have one of each required document type
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS user_documents_user_type_unique 
ON user_documents(user_id, document_type) 
WHERE document_type IN ('picture', 'diploma', 'passport');

-- ============================================================================
-- STEP 3: Add new CHECK constraint that allows mandatory course types
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
);

-- ============================================================================
-- STEP 4: Add index for better query performance on document_type
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_documents_document_type 
ON user_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_id 
ON user_documents(user_id);

-- ============================================================================
-- STEP 5: Ensure is_admin_user() function exists (from fix-permissions-definitive.sql)
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
-- STEP 6: Add admin policy for inserting mandatory course documents
-- ============================================================================
-- Check if the policy already exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_documents' 
    AND policyname = 'Admins can insert documents for any user'
  ) THEN
    CREATE POLICY "Admins can insert documents for any user"
    ON user_documents FOR INSERT
    TO authenticated
    WITH CHECK (
      public.is_admin_user()
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Add admin policy for deleting documents
-- ============================================================================
-- Check if the policy already exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_documents' 
    AND policyname = 'Admins can delete all documents'
  ) THEN
    CREATE POLICY "Admins can delete all documents"
    ON user_documents FOR DELETE
    TO authenticated
    USING (
      public.is_admin_user()
    );
  END IF;
END $$;

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

-- Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'user_documents'
ORDER BY indexname;

-- Check policies
SELECT 
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_documents'
ORDER BY policyname;

-- ============================================================================
-- SUCCESS
-- ============================================================================
SELECT '✅ Mandatory course document types added successfully!' as message;

