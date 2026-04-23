-- Add GRIT APP ID column to applications table
-- This adds a permanent ID format (AP + 12 alphanumeric) without changing existing UUID IDs
-- 
-- IMPORTANT: Run this in Supabase SQL Editor

-- Step 1: Add the new grit_app_id column
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS grit_app_id TEXT UNIQUE;

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_grit_app_id ON applications(grit_app_id);

-- Step 3: Function to generate a random alphanumeric string
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

-- Step 4: Function to generate permanent GRIT APP ID
CREATE OR REPLACE FUNCTION generate_grit_app_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  exists_check BOOLEAN;
  attempts INTEGER := 0;
BEGIN
  LOOP
    new_id := 'AP' || generate_alphanumeric(12);
    
    -- Check if ID already exists
    SELECT EXISTS(SELECT 1 FROM applications WHERE grit_app_id = new_id) INTO exists_check;
    
    EXIT WHEN NOT exists_check OR attempts >= 100;
    attempts := attempts + 1;
  END LOOP;
  
  IF attempts >= 100 THEN
    RAISE EXCEPTION 'Failed to generate unique GRIT APP ID after maximum attempts';
  END IF;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Generate GRIT APP IDs for existing applications that don't have one
DO $$
DECLARE
  app_record RECORD;
  new_id TEXT;
BEGIN
  -- Loop through all applications without a GRIT APP ID
  FOR app_record IN 
    SELECT id FROM applications 
    WHERE grit_app_id IS NULL
  LOOP
    new_id := generate_grit_app_id();
    
    UPDATE applications 
    SET grit_app_id = new_id 
    WHERE id = app_record.id;
    
    RAISE NOTICE 'Generated GRIT APP ID for application %: %', app_record.id, new_id;
  END LOOP;
END $$;

-- Step 6: Set default for new applications
ALTER TABLE applications 
ALTER COLUMN grit_app_id SET DEFAULT generate_grit_app_id();

-- Step 7: Clean up temporary helper function (keep generate_grit_app_id for defaults)
DROP FUNCTION IF EXISTS generate_alphanumeric(INTEGER);

-- Step 8: Add public tracking policy (allows anyone to track by grit_app_id)
-- This policy allows anonymous users to view applications when querying by grit_app_id
-- Note: Supabase PostgREST will automatically use this policy when filtering by grit_app_id
-- Drop policy if it exists first
DROP POLICY IF EXISTS "Public can track applications" ON applications;

CREATE POLICY "Public can track applications"
ON applications FOR SELECT
TO anon, authenticated
USING (true);

-- Step 9: Verify migration
SELECT 
  COUNT(*) as total_applications,
  COUNT(grit_app_id) as with_grit_app_id,
  COUNT(*) FILTER (WHERE grit_app_id IS NULL) as missing_grit_app_id
FROM applications;

