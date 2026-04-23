-- Add GCash payment method columns to application_payments table
-- These columns store GCash payment details for manual verification

-- Step 1: Add gcash_number column
ALTER TABLE application_payments 
ADD COLUMN IF NOT EXISTS gcash_number TEXT;

-- Step 2: Add gcash_reference column
ALTER TABLE application_payments 
ADD COLUMN IF NOT EXISTS gcash_reference TEXT;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN application_payments.gcash_number IS 'GCash mobile number used for payment';
COMMENT ON COLUMN application_payments.gcash_reference IS 'GCash transaction reference number';

-- Verify the columns were added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'application_payments'
AND column_name IN ('gcash_number', 'gcash_reference')
ORDER BY column_name;

