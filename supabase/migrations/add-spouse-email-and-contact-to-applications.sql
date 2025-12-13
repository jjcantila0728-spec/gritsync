-- Add spouse_email and spouse_contact_number columns to applications table for EAD applications
-- These fields store the spouse's email and contact number for the Employer Verification Letter
-- The verification letter will be sent as a reply to the spouse's email

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS spouse_email TEXT;

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS spouse_contact_number TEXT;

COMMENT ON COLUMN applications.spouse_email IS 'Email address of spouse (employee at Insight Global LLC) - verification letter will be sent as reply to this email';
COMMENT ON COLUMN applications.spouse_contact_number IS 'Contact number of spouse (employee at Insight Global LLC) - included in verification letter for company to contact';

