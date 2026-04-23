-- Fix application payment_type for applications that should be staggered
-- This script updates applications with payment_type='full' to 'staggered' or NULL
-- Use this if an application was incorrectly set to 'full' when it should be staggered

-- Example: Update a specific application by grit_app_id
-- UPDATE applications 
-- SET payment_type = 'staggered'
-- WHERE grit_app_id = 'APNA06G6HMGLG4';

-- Or set to NULL to use default (staggered)
-- UPDATE applications 
-- SET payment_type = NULL
-- WHERE grit_app_id = 'APNA06G6HMGLG4';

-- To update all applications that have 'full' but should be staggered (use with caution):
-- UPDATE applications 
-- SET payment_type = 'staggered'
-- WHERE payment_type = 'full'
-- AND id NOT IN (
--   SELECT DISTINCT application_id 
--   FROM application_payments 
--   WHERE payment_type = 'full' AND status = 'paid'
-- );

-- For the specific application mentioned:
UPDATE applications 
SET payment_type = 'staggered'
WHERE grit_app_id = 'APNA06G6HMGLG4';

