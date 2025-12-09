-- Migration: Add Career Applications and Partner Agencies tables

-- Partner Agencies table
CREATE TABLE IF NOT EXISTS partner_agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Agency Information
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'USA',
  zipcode TEXT,
  
  -- Contact Person
  contact_person_name TEXT,
  contact_person_email TEXT,
  contact_person_phone TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Additional Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique agency name
  UNIQUE(name)
);

-- Career Applications table
CREATE TABLE IF NOT EXISTS career_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  date_of_birth TEXT,
  country TEXT,
  
  -- Professional Information
  nursing_school TEXT,
  graduation_date TEXT,
  years_of_experience TEXT,
  current_employment_status TEXT,
  license_number TEXT,
  license_state TEXT,
  
  -- Application Details
  resume_path TEXT,
  cover_letter_path TEXT,
  additional_documents_path TEXT,
  
  -- Partner Agency Assignment
  partner_agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  forwarded_to_agency_at TIMESTAMP WITH TIME ZONE,
  forwarded_email_sent BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'forwarded', 'interviewed', 'accepted', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE partner_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_agencies
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view all partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Admins can create partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Admins can update partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Admins can delete partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Everyone can view active partner agencies" ON partner_agencies;

-- Everyone can view active partner agencies (for public career page)
CREATE POLICY "Everyone can view active partner agencies"
ON partner_agencies FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

-- Admins can view all partner agencies
CREATE POLICY "Admins can view all partner agencies"
ON partner_agencies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can create partner agencies
CREATE POLICY "Admins can create partner agencies"
ON partner_agencies FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update partner agencies
CREATE POLICY "Admins can update partner agencies"
ON partner_agencies FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete partner agencies
CREATE POLICY "Admins can delete partner agencies"
ON partner_agencies FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- RLS Policies for career_applications
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Everyone can create career applications" ON career_applications;
DROP POLICY IF EXISTS "Anonymous can view recent career applications" ON career_applications;
DROP POLICY IF EXISTS "Users can view their own career applications" ON career_applications;
DROP POLICY IF EXISTS "Users can update their own pending career applications" ON career_applications;
DROP POLICY IF EXISTS "Admins can view all career applications" ON career_applications;
DROP POLICY IF EXISTS "Admins can update all career applications" ON career_applications;
DROP POLICY IF EXISTS "Admins can delete career applications" ON career_applications;

-- Allow everyone (including anonymous) to create career applications
CREATE POLICY "Everyone can create career applications"
ON career_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view career applications they just created
CREATE POLICY "Anonymous can view recent career applications"
ON career_applications FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can view their own career applications
CREATE POLICY "Users can view their own career applications"
ON career_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own career applications (only if pending)
CREATE POLICY "Users can update their own pending career applications"
ON career_applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all career applications
CREATE POLICY "Admins can view all career applications"
ON career_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update all career applications
CREATE POLICY "Admins can update all career applications"
ON career_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete career applications
CREATE POLICY "Admins can delete career applications"
ON career_applications FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_career_applications_user_id ON career_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_status ON career_applications(status);
CREATE INDEX IF NOT EXISTS idx_career_applications_partner_agency_id ON career_applications(partner_agency_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_created_at ON career_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_agencies_is_active ON partner_agencies(is_active);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_partner_agencies_updated_at ON partner_agencies;
CREATE TRIGGER update_partner_agencies_updated_at
  BEFORE UPDATE ON partner_agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_career_applications_updated_at ON career_applications;
CREATE TRIGGER update_career_applications_updated_at
  BEFORE UPDATE ON career_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

