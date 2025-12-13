-- Add spouse_name column to applications table for EAD applications
-- This field stores the full name of the spouse who is an employee at Insight Global LLC
-- Required for generating Employer Verification Letter requests

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS spouse_name TEXT;

COMMENT ON COLUMN applications.spouse_name IS 'Full name of spouse (employee at Insight Global LLC) - required for H4-EAD applications';

