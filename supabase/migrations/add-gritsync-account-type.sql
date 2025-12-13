-- Add 'gritsync' as a valid account_type in processing_accounts table
-- This migration updates the CHECK constraint to include 'gritsync' alongside 'gmail', 'pearson_vue', and 'custom'

-- First, drop the existing CHECK constraint
ALTER TABLE processing_accounts 
DROP CONSTRAINT IF EXISTS processing_accounts_account_type_check;

-- Add the new CHECK constraint that includes 'gritsync'
ALTER TABLE processing_accounts
ADD CONSTRAINT processing_accounts_account_type_check 
CHECK (account_type IN ('gmail', 'gritsync', 'pearson_vue', 'custom'));

-- Update the unique index to include 'gritsync' alongside 'gmail' and 'pearson_vue'
DROP INDEX IF EXISTS idx_processing_accounts_unique_gmail_pearson;

CREATE UNIQUE INDEX IF NOT EXISTS idx_processing_accounts_unique_gmail_gritsync_pearson
ON processing_accounts(application_id, account_type)
WHERE account_type IN ('gmail', 'gritsync', 'pearson_vue');

-- Update any existing 'gmail' account_type that was meant to be 'gritsync'
-- This is safe because the system uses 'gritsync' internally
UPDATE processing_accounts
SET account_type = 'gritsync'
WHERE account_type = 'gmail';

