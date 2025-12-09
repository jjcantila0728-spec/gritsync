-- Migration: Add Careers/Jobs table
-- NOTE: This migration requires partner_agencies table to exist first
-- Run add-career-applications-and-partner-agencies.sql before this migration

-- Ensure partner_agencies table exists (for foreign key reference)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    RAISE EXCEPTION 'partner_agencies table must exist. Please run add-career-applications-and-partner-agencies.sql first.';
  END IF;
END $$;

-- Careers table
CREATE TABLE IF NOT EXISTS careers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Job Information
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  responsibilities TEXT,
  location TEXT,
  employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'temporary', 'internship')),
  salary_range TEXT,
  department TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Application Details
  application_deadline TIMESTAMP WITH TIME ZONE,
  application_instructions TEXT,
  
  -- Partner Agency (optional - if this career is associated with a partner agency)
  partner_agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  
  -- Metadata
  views_count INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Update career_applications to reference a specific career
-- Ensure career_applications table exists first
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    RAISE EXCEPTION 'career_applications table must exist. Please run add-career-applications-and-partner-agencies.sql first.';
  END IF;
END $$;

ALTER TABLE career_applications 
ADD COLUMN IF NOT EXISTS career_id UUID REFERENCES careers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE careers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for careers
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Everyone can view active careers" ON careers;
DROP POLICY IF EXISTS "Admins can view all careers" ON careers;
DROP POLICY IF EXISTS "Admins can create careers" ON careers;
DROP POLICY IF EXISTS "Admins can update careers" ON careers;
DROP POLICY IF EXISTS "Admins can delete careers" ON careers;

-- Everyone can view active careers (for public career listing page)
CREATE POLICY "Everyone can view active careers"
ON careers FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

-- Admins can view all careers (including inactive)
CREATE POLICY "Admins can view all careers"
ON careers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can create careers
CREATE POLICY "Admins can create careers"
ON careers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update careers
CREATE POLICY "Admins can update careers"
ON careers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete careers
CREATE POLICY "Admins can delete careers"
ON careers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_careers_is_active ON careers(is_active);
CREATE INDEX IF NOT EXISTS idx_careers_is_featured ON careers(is_featured);
CREATE INDEX IF NOT EXISTS idx_careers_created_at ON careers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_careers_partner_agency_id ON careers(partner_agency_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_career_id ON career_applications(career_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_careers_updated_at ON careers;
CREATE TRIGGER update_careers_updated_at
  BEFORE UPDATE ON careers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment views_count (can be called from application)
CREATE OR REPLACE FUNCTION increment_career_views(career_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE careers
  SET views_count = views_count + 1
  WHERE id = career_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment applications_count (can be called from application)
CREATE OR REPLACE FUNCTION increment_career_applications(career_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE careers
  SET applications_count = applications_count + 1
  WHERE id = career_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

