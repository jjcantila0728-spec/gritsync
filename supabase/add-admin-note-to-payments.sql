-- Add admin_note column to application_payments table
-- This stores admin notes during payment validation (approval/rejection)
ALTER TABLE application_payments
ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Add comment
COMMENT ON COLUMN application_payments.admin_note IS 'Admin note added during payment validation (approval or rejection)';

