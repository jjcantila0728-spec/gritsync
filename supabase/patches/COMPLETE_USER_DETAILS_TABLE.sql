-- ============================================================================
-- COMPLETE USER_DETAILS TABLE FOR SUPABASE
-- ============================================================================
-- This script creates the complete user_details table with all fields,
-- Row Level Security policies, indexes, and triggers.
-- ============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DROP EXISTING TABLE (if you need to recreate it)
-- ============================================================================
-- Uncomment the following lines if you need to drop and recreate the table
-- DROP TABLE IF EXISTS user_details CASCADE;

-- ============================================================================
-- CREATE USER_DETAILS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_details (
  -- Primary Key
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  mobile_number TEXT,
  email TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL),
  marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed') OR marital_status IS NULL),
  single_full_name TEXT,
  date_of_birth TEXT, -- Format: YYYY-MM-DD
  birth_place TEXT,
  
  -- Address Information
  house_number TEXT,
  street_name TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  zipcode TEXT,
  
  -- Elementary School Information
  elementary_school TEXT,
  elementary_city TEXT,
  elementary_province TEXT,
  elementary_country TEXT,
  elementary_years_attended TEXT,
  elementary_start_date TEXT, -- Format: YYYY-MM
  elementary_end_date TEXT, -- Format: YYYY-MM
  
  -- High School Information
  high_school TEXT,
  high_school_city TEXT,
  high_school_province TEXT,
  high_school_country TEXT,
  high_school_years_attended TEXT,
  high_school_start_date TEXT, -- Format: YYYY-MM
  high_school_end_date TEXT, -- Format: YYYY-MM
  high_school_graduated TEXT,
  high_school_diploma_type TEXT,
  high_school_diploma_date TEXT, -- Format: YYYY-MM-DD
  
  -- Nursing School Information
  nursing_school TEXT,
  nursing_school_city TEXT,
  nursing_school_province TEXT,
  nursing_school_country TEXT,
  nursing_school_years_attended TEXT,
  nursing_school_start_date TEXT, -- Format: YYYY-MM
  nursing_school_end_date TEXT, -- Format: YYYY-MM
  nursing_school_major TEXT,
  nursing_school_diploma_date TEXT, -- Format: YYYY-MM-DD
  
  -- Application Details
  signature TEXT,
  payment_type TEXT CHECK (payment_type IN ('full', 'step1', 'step2', 'retake') OR payment_type IS NULL),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_details_email ON user_details(email);
CREATE INDEX IF NOT EXISTS idx_user_details_mobile_number ON user_details(mobile_number);
CREATE INDEX IF NOT EXISTS idx_user_details_created_at ON user_details(created_at);

-- ============================================================================
-- CREATE TRIGGER FOR UPDATED_AT TIMESTAMP
-- ============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row update
DROP TRIGGER IF EXISTS trigger_update_user_details_updated_at ON user_details;
CREATE TRIGGER trigger_update_user_details_updated_at
  BEFORE UPDATE ON user_details
  FOR EACH ROW
  EXECUTE FUNCTION update_user_details_updated_at();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Users can SELECT their own user_details
DROP POLICY IF EXISTS "Users can view their own details" ON user_details;
CREATE POLICY "Users can view their own details"
  ON user_details
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own user_details
DROP POLICY IF EXISTS "Users can insert their own details" ON user_details;
CREATE POLICY "Users can insert their own details"
  ON user_details
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE their own user_details
DROP POLICY IF EXISTS "Users can update their own details" ON user_details;
CREATE POLICY "Users can update their own details"
  ON user_details
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE their own user_details
DROP POLICY IF EXISTS "Users can delete their own details" ON user_details;
CREATE POLICY "Users can delete their own details"
  ON user_details
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Admins can do everything (optional - uncomment if you have admin role)
-- DROP POLICY IF EXISTS "Admins can manage all user details" ON user_details;
-- CREATE POLICY "Admins can manage all user details"
--   ON user_details
--   FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid()
--       AND users.role = 'admin'
--     )
--   );

-- ============================================================================
-- ADD TABLE COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE user_details IS 'Stores user profile and application details that auto-fill application forms';
COMMENT ON COLUMN user_details.user_id IS 'Primary key, references auth.users(id)';
COMMENT ON COLUMN user_details.date_of_birth IS 'Date format: YYYY-MM-DD';
COMMENT ON COLUMN user_details.elementary_start_date IS 'Date format: YYYY-MM';
COMMENT ON COLUMN user_details.elementary_end_date IS 'Date format: YYYY-MM';
COMMENT ON COLUMN user_details.high_school_start_date IS 'Date format: YYYY-MM';
COMMENT ON COLUMN user_details.high_school_end_date IS 'Date format: YYYY-MM';
COMMENT ON COLUMN user_details.high_school_diploma_date IS 'Date format: YYYY-MM-DD';
COMMENT ON COLUMN user_details.nursing_school_start_date IS 'Date format: YYYY-MM';
COMMENT ON COLUMN user_details.nursing_school_end_date IS 'Date format: YYYY-MM';
COMMENT ON COLUMN user_details.nursing_school_diploma_date IS 'Date format: YYYY-MM-DD';

-- ============================================================================
-- VERIFICATION QUERIES (Optional - for testing)
-- ============================================================================
-- Uncomment to verify the table was created correctly:

-- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_details'
-- ORDER BY ordinal_position;

-- Check RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'user_details';

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'user_details';

-- ============================================================================
-- MIGRATION SCRIPT (If you need to add missing columns to existing table)
-- ============================================================================
-- Run this if the table already exists and you need to add missing columns:

DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_details' AND column_name = 'high_school_graduated') THEN
    ALTER TABLE user_details ADD COLUMN high_school_graduated TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_details' AND column_name = 'high_school_diploma_type') THEN
    ALTER TABLE user_details ADD COLUMN high_school_diploma_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_details' AND column_name = 'high_school_diploma_date') THEN
    ALTER TABLE user_details ADD COLUMN high_school_diploma_date TEXT;
  END IF;
END $$;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

