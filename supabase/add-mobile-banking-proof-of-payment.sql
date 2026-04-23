-- Add proof of payment file path and update status enum for mobile banking payments
-- This migration adds support for mobile banking payments with proof of payment upload

-- Step 1: Add proof_of_payment_file_path column
ALTER TABLE application_payments 
ADD COLUMN IF NOT EXISTS proof_of_payment_file_path TEXT;

-- Step 2: Update status check constraint to include 'pending_approval'
-- First, drop the existing constraint
ALTER TABLE application_payments 
DROP CONSTRAINT IF EXISTS application_payments_status_check;

-- Add new constraint with pending_approval status
ALTER TABLE application_payments 
ADD CONSTRAINT application_payments_status_check 
CHECK (status IN ('pending', 'pending_approval', 'paid', 'failed', 'cancelled'));

-- Step 3: Add index for faster queries on pending_approval payments
CREATE INDEX IF NOT EXISTS idx_application_payments_status_pending_approval 
ON application_payments(status) 
WHERE status = 'pending_approval';

-- Step 4: Add comment for documentation
COMMENT ON COLUMN application_payments.proof_of_payment_file_path IS 'Path to uploaded proof of payment file (screenshot/receipt) for mobile banking payments';
COMMENT ON COLUMN application_payments.status IS 'Payment status: pending (created), pending_approval (proof uploaded, awaiting admin), paid (approved), failed, cancelled';

