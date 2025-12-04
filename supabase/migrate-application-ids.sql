-- Migration script to update existing applications with permanent IDs
-- This script generates permanent IDs (AP + 12 alphanumeric) for applications
-- that don't already have them in the new format.
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- This will migrate UUID-based IDs to the new permanent format

-- Step 1: Drop all RLS policies that reference applications.id
-- These policies depend on the column type, so we need to drop them first

-- Drop policies on processing_accounts that reference applications.id
DROP POLICY IF EXISTS "Users can view accounts for their applications" ON processing_accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON processing_accounts;
DROP POLICY IF EXISTS "Admins can insert accounts" ON processing_accounts;
DROP POLICY IF EXISTS "Admins can update accounts" ON processing_accounts;

-- Drop policies on application_timeline_steps that reference applications.id
DROP POLICY IF EXISTS "Users can view steps for their applications" ON application_timeline_steps;
DROP POLICY IF EXISTS "Admins can view all steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "Admins can insert steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "Admins can update steps" ON application_timeline_steps;

-- Drop policies on application_payments that reference applications.id (if any)
-- Note: Check your actual policy names
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'application_payments' 
    AND definition LIKE '%applications.id%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON application_payments', r.policyname);
  END LOOP;
END $$;

-- Step 2: Drop foreign key constraints temporarily
ALTER TABLE application_timeline_steps DROP CONSTRAINT IF EXISTS application_timeline_steps_application_id_fkey;
ALTER TABLE application_payments DROP CONSTRAINT IF EXISTS application_payments_application_id_fkey;
ALTER TABLE processing_accounts DROP CONSTRAINT IF EXISTS processing_accounts_application_id_fkey;

-- Step 3: Change the column type from UUID to TEXT
ALTER TABLE applications ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Step 4: Function to generate a random alphanumeric string
CREATE OR REPLACE FUNCTION generate_alphanumeric(length INTEGER)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Function to generate permanent application ID
CREATE OR REPLACE FUNCTION generate_permanent_app_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  exists_check BOOLEAN;
  attempts INTEGER := 0;
BEGIN
  LOOP
    new_id := 'AP' || generate_alphanumeric(12);
    
    -- Check if ID already exists
    SELECT EXISTS(SELECT 1 FROM applications WHERE id = new_id) INTO exists_check;
    
    EXIT WHEN NOT exists_check OR attempts >= 100;
    attempts := attempts + 1;
  END LOOP;
  
  IF attempts >= 100 THEN
    RAISE EXCEPTION 'Failed to generate unique Application ID after maximum attempts';
  END IF;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Migration: Update all applications that don't have the new format
DO $$
DECLARE
  app_record RECORD;
  new_id TEXT;
  old_id TEXT;
BEGIN
  -- Loop through all applications that are UUIDs (not in new format)
  FOR app_record IN 
    SELECT id::TEXT as id FROM applications 
    WHERE id::TEXT !~ '^AP[0-9A-Z]{12}$'  -- Not in new format
  LOOP
    old_id := app_record.id;
    new_id := generate_permanent_app_id();
    
    RAISE NOTICE 'Migrating % -> %', old_id, new_id;
    
    -- Update related tables first (to avoid foreign key issues)
    UPDATE application_timeline_steps 
    SET application_id = new_id 
    WHERE application_id::TEXT = old_id;
    
    UPDATE application_payments 
    SET application_id = new_id 
    WHERE application_id::TEXT = old_id;
    
    UPDATE processing_accounts 
    SET application_id = new_id 
    WHERE application_id::TEXT = old_id;
    
    -- Update quotations if it has application_id column
    BEGIN
      UPDATE quotations 
      SET application_id = new_id 
      WHERE application_id::TEXT = old_id;
    EXCEPTION WHEN OTHERS THEN
      -- Column might not exist, that's okay
      NULL;
    END;
    
    -- Finally, update the applications table
    UPDATE applications 
    SET id = new_id 
    WHERE id::TEXT = old_id;
    
    RAISE NOTICE 'Successfully migrated % -> %', old_id, new_id;
  END LOOP;
END $$;

-- Step 7: Update foreign key columns to TEXT as well
ALTER TABLE application_timeline_steps ALTER COLUMN application_id TYPE TEXT;
ALTER TABLE application_payments ALTER COLUMN application_id TYPE TEXT;
ALTER TABLE processing_accounts ALTER COLUMN application_id TYPE TEXT;

-- Step 8: Re-add foreign key constraints
ALTER TABLE application_timeline_steps 
  ADD CONSTRAINT application_timeline_steps_application_id_fkey 
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;

ALTER TABLE application_payments 
  ADD CONSTRAINT application_payments_application_id_fkey 
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;

ALTER TABLE processing_accounts 
  ADD CONSTRAINT processing_accounts_application_id_fkey 
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;

-- Step 9: Recreate RLS policies that reference applications.id

-- Processing Accounts policies
CREATE POLICY "Users can view accounts for their applications"
ON processing_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = processing_accounts.application_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all accounts"
ON processing_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert accounts"
ON processing_accounts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update accounts"
ON processing_accounts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Application Timeline Steps policies
CREATE POLICY "Users can view steps for their applications"
ON application_timeline_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all steps"
ON application_timeline_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert steps"
ON application_timeline_steps FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update steps"
ON application_timeline_steps FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Step 10: Create function for default ID generation (for new applications)
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TEXT AS $$
BEGIN
  RETURN generate_permanent_app_id();
END;
$$ LANGUAGE plpgsql;

-- Step 11: Update default for new applications
ALTER TABLE applications ALTER COLUMN id SET DEFAULT generate_application_id();

-- Step 12: Clean up temporary helper function (keep generate_application_id for defaults)
DROP FUNCTION IF EXISTS generate_alphanumeric(INTEGER);
DROP FUNCTION IF EXISTS generate_permanent_app_id();

-- Step 13: Verify migration
SELECT 
  COUNT(*) as total_applications,
  COUNT(*) FILTER (WHERE id ~ '^AP[0-9A-Z]{12}$') as new_format_count,
  COUNT(*) FILTER (WHERE id !~ '^AP[0-9A-Z]{12}$') as old_format_count
FROM applications;

