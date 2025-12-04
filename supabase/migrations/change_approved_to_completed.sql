-- Migration: Change 'approved' status to 'completed' in applications table
-- This migration updates the status constraint and converts existing 'approved' records to 'completed'

-- Step 1: Update existing records from 'approved' to 'completed'
UPDATE applications
SET status = 'completed'
WHERE status = 'approved';

-- Step 2: Drop the existing constraint
ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_status_check;

-- Step 3: Add new constraint with 'completed' instead of 'approved'
ALTER TABLE applications
ADD CONSTRAINT applications_status_check 
CHECK (status IN ('pending', 'completed', 'rejected'));

-- Step 4: Verify the changes
SELECT 
  status,
  COUNT(*) as count
FROM applications
GROUP BY status
ORDER BY status;

