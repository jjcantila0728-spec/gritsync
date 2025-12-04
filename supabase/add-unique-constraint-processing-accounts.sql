-- Add unique constraint to prevent duplicate Gmail and Pearson Vue accounts
-- This ensures only one Gmail and one Pearson Vue account per application

-- First, remove any existing duplicates (keep the oldest one)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY application_id, account_type 
           ORDER BY created_at ASC
         ) as rn
  FROM processing_accounts
  WHERE account_type IN ('gmail', 'pearson_vue')
)
DELETE FROM processing_accounts
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on (application_id, account_type) for gmail and pearson_vue
-- Note: This constraint only applies to gmail and pearson_vue account types
-- Custom accounts can have multiple entries per application

-- Create a unique index that only applies to gmail and pearson_vue
CREATE UNIQUE INDEX IF NOT EXISTS idx_processing_accounts_unique_gmail_pearson
ON processing_accounts(application_id, account_type)
WHERE account_type IN ('gmail', 'pearson_vue');


