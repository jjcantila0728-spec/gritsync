-- Migration: Add NCLEX Sponsorships and Donations tables

-- NCLEX Sponsorships table
CREATE TABLE IF NOT EXISTS nclex_sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  date_of_birth TEXT,
  country TEXT,
  
  -- Application Details
  nursing_school TEXT,
  graduation_date TEXT,
  current_employment_status TEXT,
  years_of_experience TEXT,
  financial_need_description TEXT NOT NULL,
  motivation_statement TEXT NOT NULL,
  how_will_this_help TEXT,
  
  -- Supporting Documents (optional)
  resume_path TEXT,
  transcript_path TEXT,
  recommendation_letter_path TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'awarded')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Donor Information (optional - can be anonymous)
  donor_name TEXT,
  donor_email TEXT,
  donor_phone TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  
  -- Donation Details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  transaction_id TEXT,
  
  -- Optional: Link to specific sponsorship
  sponsorship_id UUID REFERENCES nclex_sponsorships(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Message (optional)
  message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE nclex_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nclex_sponsorships
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Users can create their own sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Everyone can create sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Anonymous can view recent sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Users can update their own pending sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Admins can view all sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Admins can update all sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Admins can delete sponsorships" ON nclex_sponsorships;

-- Allow everyone (including anonymous) to create sponsorships
CREATE POLICY "Everyone can create sponsorships"
ON nclex_sponsorships FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view sponsorships they just created
-- This is needed for the .select('*') after insert to work
CREATE POLICY "Anonymous can view recent sponsorships"
ON nclex_sponsorships FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can view their own sponsorships
CREATE POLICY "Users can view their own sponsorships"
ON nclex_sponsorships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own sponsorships (only if pending)
CREATE POLICY "Users can update their own pending sponsorships"
ON nclex_sponsorships FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all sponsorships
CREATE POLICY "Admins can view all sponsorships"
ON nclex_sponsorships FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update all sponsorships
CREATE POLICY "Admins can update all sponsorships"
ON nclex_sponsorships FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete sponsorships
CREATE POLICY "Admins can delete sponsorships"
ON nclex_sponsorships FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- RLS Policies for donations
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Everyone can create donations" ON donations;
DROP POLICY IF EXISTS "Anonymous can view recent donations" ON donations;
DROP POLICY IF EXISTS "Users can view their own donations" ON donations;
DROP POLICY IF EXISTS "Admins can view all donations" ON donations;
DROP POLICY IF EXISTS "Admins can update donations" ON donations;

-- Everyone can create donations (including anonymous)
CREATE POLICY "Everyone can create donations"
ON donations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view donations they just created
-- This is needed for the .select('*') after insert to work
CREATE POLICY "Anonymous can view recent donations"
ON donations FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can view their own donations (if they provided email)
CREATE POLICY "Users can view their own donations"
ON donations FOR SELECT
TO authenticated
USING (
  donor_email = (SELECT email FROM users WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can view all donations
CREATE POLICY "Admins can view all donations"
ON donations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update donations
CREATE POLICY "Admins can update donations"
ON donations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_user_id ON nclex_sponsorships(user_id);
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_status ON nclex_sponsorships(status);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_sponsorship_id ON donations(sponsorship_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_nclex_sponsorships_updated_at ON nclex_sponsorships;
CREATE TRIGGER update_nclex_sponsorships_updated_at
  BEFORE UPDATE ON nclex_sponsorships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

