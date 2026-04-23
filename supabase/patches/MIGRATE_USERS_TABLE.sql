-- MIGRATION: Change full_name to first_name and last_name, and make grit_id NOT NULL with auto-generation
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns (first_name and last_name)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Step 2: Migrate existing full_name data to first_name and last_name
-- Split full_name into first_name and last_name for existing records
UPDATE users
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' THEN
      TRIM(SPLIT_PART(full_name, ' ', 1))
    ELSE NULL
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' THEN
      TRIM(SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2))
    ELSE NULL
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Step 3: Create function to generate unique GRIT-ID
CREATE OR REPLACE FUNCTION generate_grit_id()
RETURNS TEXT AS $$
DECLARE
  new_grit_id TEXT;
  exists_check INTEGER;
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  LOOP
    -- Generate 6 digit number (100000 to 999999)
    new_grit_id := 'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0');
    
    -- Check if it already exists
    SELECT COUNT(*) INTO exists_check
    FROM users
    WHERE grit_id = new_grit_id;
    
    -- If unique, return it
    EXIT WHEN exists_check = 0;
    
    -- Prevent infinite loop
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique GRIT-ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  RETURN new_grit_id;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Generate grit_id for existing users who don't have one
UPDATE users
SET grit_id = generate_grit_id()
WHERE grit_id IS NULL;

-- Step 5: Make grit_id NOT NULL and ensure it's unique
-- First, ensure all NULL values are filled
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM users WHERE grit_id IS NULL
  LOOP
    UPDATE users
    SET grit_id = generate_grit_id()
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- Now make it NOT NULL
ALTER TABLE users
ALTER COLUMN grit_id SET NOT NULL;

-- Ensure uniqueness (should already be there, but verify)
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_grit_id_key;

ALTER TABLE users
ADD CONSTRAINT users_grit_id_key UNIQUE (grit_id);

-- Step 6: Update the trigger function to use first_name, last_name and generate grit_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Insert user profile with first_name, last_name, and generated grit_id
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'),
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    updated_at = NOW();
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'))
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Drop the old full_name column (optional - comment out if you want to keep it for now)
-- ALTER TABLE users DROP COLUMN IF EXISTS full_name;

-- Step 8: Update existing users' auth metadata to include first_name and last_name
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object(
    'first_name', (SELECT first_name FROM public.users WHERE id = auth.users.id),
    'last_name', (SELECT last_name FROM public.users WHERE id = auth.users.id)
  )
WHERE id IN (SELECT id FROM public.users);

-- Verification queries:
-- Check the new structure
-- SELECT id, email, first_name, last_name, grit_id, role FROM users LIMIT 5;

-- Check if any users still have NULL grit_id (should be 0)
-- SELECT COUNT(*) FROM users WHERE grit_id IS NULL;

-- Check if any users still have NULL first_name or last_name
-- SELECT COUNT(*) FROM users WHERE first_name IS NULL OR last_name IS NULL;

