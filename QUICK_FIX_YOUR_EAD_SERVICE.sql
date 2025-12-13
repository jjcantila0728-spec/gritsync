-- ============================================================================
-- QUICK FIX: Update Your Existing EAD Service
-- ============================================================================
-- Run this in Supabase SQL Editor to fix your service (ID: svc_1765578840968)
-- This will make it work with the application code
-- ============================================================================

-- Update your existing service to use 'All States'
-- EAD is a federal process, not state-specific
UPDATE services
SET 
  service_name = 'EAD Processing',
  state = 'All States',
  payment_type = 'full'
WHERE id = 'svc_1765578840968';

-- Verify the update worked
SELECT 
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full,
  created_at
FROM services
WHERE id = 'svc_1765578840968';

-- You should see:
-- - service_name: EAD Processing
-- - state: All States
-- - payment_type: full
--
-- Now refresh http://localhost:5000/applications/AP9B83G6Y8HQNH/payments
-- The error should be gone! ✅

