-- Combined migration to fix all payment-related issues
-- Run this script to ensure all required columns and constraints are in place

-- Step 1: Add proof_of_payment_file_path column (if not exists)
ALTER TABLE application_payments 
ADD COLUMN IF NOT EXISTS proof_of_payment_file_path TEXT;

-- Step 2: Add usd_to_php_rate column (if not exists)
ALTER TABLE application_payments
ADD COLUMN IF NOT EXISTS usd_to_php_rate DECIMAL(10, 4);

-- Step 3: Add admin_note column (if not exists)
ALTER TABLE application_payments
ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Step 4: Update status check constraint to include 'pending_approval'
-- First, drop the existing constraint if it exists
ALTER TABLE application_payments
DROP CONSTRAINT IF EXISTS application_payments_status_check;

-- Add new constraint with pending_approval status
ALTER TABLE application_payments
ADD CONSTRAINT application_payments_status_check 
CHECK (status IN ('pending', 'pending_approval', 'paid', 'failed', 'cancelled'));

-- Step 5: Add index for faster queries on pending_approval payments
CREATE INDEX IF NOT EXISTS idx_application_payments_status_pending_approval 
ON application_payments(status) 
WHERE status = 'pending_approval';

-- Step 6: Add comments for documentation
COMMENT ON COLUMN application_payments.proof_of_payment_file_path IS 'Path to uploaded proof of payment file (screenshot/receipt) for mobile banking payments';
COMMENT ON COLUMN application_payments.usd_to_php_rate IS 'USD to PHP conversion rate used at the time of payment (for mobile_banking and gcash payment methods)';
COMMENT ON COLUMN application_payments.admin_note IS 'Admin note added during payment validation (approval or rejection)';
COMMENT ON COLUMN application_payments.status IS 'Payment status: pending (created), pending_approval (proof uploaded, awaiting admin), paid (approved), failed, cancelled';

-- Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'application_payments'
AND column_name IN ('proof_of_payment_file_path', 'usd_to_php_rate', 'admin_note')
ORDER BY column_name;

-- Verify the constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'application_payments'::regclass
AND conname = 'application_payments_status_check';


