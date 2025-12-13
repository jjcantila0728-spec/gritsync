-- ============================================================================
-- Check and Fix Your EAD Service Configuration
-- ============================================================================
-- Run this in Supabase SQL Editor to check your current service
-- and update it to work with the application code
-- ============================================================================

-- STEP 1: Check what you currently have
-- This will show you the service you created manually
SELECT 
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full,
  total_step1,
  total_step2,
  created_at
FROM services
WHERE id = 'svc_1765578840968';

-- ============================================================================
-- STEP 2: Check what the application is looking for
-- ============================================================================
-- The code expects:
-- - service_name: 'EAD Processing'
-- - state: 'All States' (EAD is federal, not state-specific)
-- - payment_type: 'full'

-- ============================================================================
-- STEP 3: Fix your service to match what the code expects
-- ============================================================================
-- UPDATE the service you created to have the correct values
-- EAD is a federal process, so we use 'All States' instead of a specific state

UPDATE services
SET 
  service_name = 'EAD Processing',
  state = 'All States',
  payment_type = 'full'
WHERE id = 'svc_1765578840968';

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================
-- This should now match what the application code is looking for

SELECT 
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full
FROM services
WHERE service_name = 'EAD Processing' 
  AND state = 'All States'
  AND payment_type = 'full';

-- ============================================================================
-- Expected Result:
-- You should see 1 row with:
-- - id: svc_1765578840968
-- - service_name: EAD Processing
-- - state: All States
-- - payment_type: full
-- - total_full: (whatever amount you set)
--
-- If you see this, refresh the page and it should work! ✅
-- ============================================================================

