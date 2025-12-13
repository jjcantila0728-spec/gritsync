-- Migration: Add EAD Application Support
-- This migration adds support for EAD (I-765) applications alongside existing NCLEX applications

-- Step 1: Add application_type column to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS application_type TEXT DEFAULT 'NCLEX' CHECK (application_type IN ('NCLEX', 'EAD'));

-- Step 2: Make NCLEX-specific fields nullable (since EAD doesn't need them)
ALTER TABLE applications 
  ALTER COLUMN elementary_school DROP NOT NULL,
  ALTER COLUMN elementary_city DROP NOT NULL,
  ALTER COLUMN elementary_years_attended DROP NOT NULL,
  ALTER COLUMN elementary_start_date DROP NOT NULL,
  ALTER COLUMN elementary_end_date DROP NOT NULL,
  ALTER COLUMN high_school DROP NOT NULL,
  ALTER COLUMN high_school_city DROP NOT NULL,
  ALTER COLUMN high_school_years_attended DROP NOT NULL,
  ALTER COLUMN high_school_start_date DROP NOT NULL,
  ALTER COLUMN high_school_end_date DROP NOT NULL,
  ALTER COLUMN nursing_school DROP NOT NULL,
  ALTER COLUMN nursing_school_city DROP NOT NULL,
  ALTER COLUMN nursing_school_years_attended DROP NOT NULL,
  ALTER COLUMN nursing_school_start_date DROP NOT NULL,
  ALTER COLUMN nursing_school_end_date DROP NOT NULL,
  ALTER COLUMN picture_path DROP NOT NULL,
  ALTER COLUMN diploma_path DROP NOT NULL,
  ALTER COLUMN passport_path DROP NOT NULL,
  ALTER COLUMN house_number DROP NOT NULL,
  ALTER COLUMN street_name DROP NOT NULL,
  ALTER COLUMN province DROP NOT NULL;

-- Step 3: Add EAD-specific fields (Part 1: Reason for Applying)
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS reason_for_filing TEXT,
  ADD COLUMN IF NOT EXISTS has_attorney BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS uscis_online_account_number TEXT;

-- Step 4: Add EAD-specific fields (Legal Name - already have first_name, middle_name, last_name)
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS maiden_name TEXT,
  ADD COLUMN IF NOT EXISTS aliases TEXT,
  ADD COLUMN IF NOT EXISTS previous_legal_names TEXT;

-- Step 5: Add EAD-specific address fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS in_care_of_name TEXT,
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS apartment_suite TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS physical_address_same BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS physical_in_care_of TEXT,
  ADD COLUMN IF NOT EXISTS physical_street_address TEXT,
  ADD COLUMN IF NOT EXISTS physical_apartment_suite TEXT,
  ADD COLUMN IF NOT EXISTS physical_city TEXT,
  ADD COLUMN IF NOT EXISTS physical_state TEXT,
  ADD COLUMN IF NOT EXISTS physical_zip_code TEXT;

-- Step 6: Add EAD-specific personal information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS birth_city TEXT,
  ADD COLUMN IF NOT EXISTS birth_state TEXT,
  ADD COLUMN IF NOT EXISTS birth_country TEXT,
  ADD COLUMN IF NOT EXISTS citizenship_countries TEXT[];

-- Step 7: Add EAD-specific Social Security fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS has_ssn BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ssn TEXT,
  ADD COLUMN IF NOT EXISTS want_ssn_card BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_ssa_disclosure BOOLEAN DEFAULT FALSE;

-- Step 8: Add EAD-specific Parents' Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS father_last_name TEXT,
  ADD COLUMN IF NOT EXISTS father_first_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_last_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_first_name TEXT;

-- Step 9: Add EAD-specific Immigration & Arrival Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS a_number TEXT,
  ADD COLUMN IF NOT EXISTS uscis_account_number TEXT,
  ADD COLUMN IF NOT EXISTS i94_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_country TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiration TEXT,
  ADD COLUMN IF NOT EXISTS travel_document_number TEXT,
  ADD COLUMN IF NOT EXISTS last_arrival_date TEXT,
  ADD COLUMN IF NOT EXISTS last_arrival_place TEXT,
  ADD COLUMN IF NOT EXISTS immigration_status_at_arrival TEXT,
  ADD COLUMN IF NOT EXISTS current_immigration_status TEXT,
  ADD COLUMN IF NOT EXISTS sevis_number TEXT;

-- Step 10: Add EAD-specific Eligibility Category fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS eligibility_category TEXT,
  ADD COLUMN IF NOT EXISTS employer_name TEXT,
  ADD COLUMN IF NOT EXISTS everify_company_id TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS has_criminal_history BOOLEAN DEFAULT FALSE;

-- Step 11: Add EAD-specific Contact Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS mobile_number TEXT,
  ADD COLUMN IF NOT EXISTS email_address TEXT;

-- Step 12: Add EAD-specific Declaration fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS can_read_english BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS signature_date TEXT;

-- Step 13: Add EAD-specific Interpreter Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS has_interpreter BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interpreter_name TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_address TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_phone TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_email TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_signature TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_signature_date TEXT;

-- Step 14: Add EAD-specific Preparer Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS has_preparer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preparer_name TEXT,
  ADD COLUMN IF NOT EXISTS preparer_business_name TEXT,
  ADD COLUMN IF NOT EXISTS preparer_address TEXT,
  ADD COLUMN IF NOT EXISTS preparer_phone TEXT,
  ADD COLUMN IF NOT EXISTS preparer_email TEXT,
  ADD COLUMN IF NOT EXISTS preparer_type TEXT,
  ADD COLUMN IF NOT EXISTS preparer_signature TEXT,
  ADD COLUMN IF NOT EXISTS preparer_signature_date TEXT;

-- Step 15: Update existing applications to have application_type = 'NCLEX'
UPDATE applications 
SET application_type = 'NCLEX' 
WHERE application_type IS NULL;

-- Step 16: Create index on application_type for better query performance
CREATE INDEX IF NOT EXISTS idx_applications_application_type ON applications(application_type);

-- Step 17: Add comment to table
COMMENT ON COLUMN applications.application_type IS 'Type of application: NCLEX or EAD (I-765)';

