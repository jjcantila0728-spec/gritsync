-- ============================================================================
-- IMPORTANT: Run this SQL script in Supabase SQL Editor
-- ============================================================================
-- This will create the EAD service configuration that the application needs
-- to display payment information and process payments.
--
-- Steps:
-- 1. Open Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Select your project
-- 3. Go to SQL Editor (left sidebar)
-- 4. Click "New Query"
-- 5. Copy and paste this ENTIRE file
-- 6. Click "Run" or press Cmd/Ctrl + Enter
-- ============================================================================

-- Insert EAD Processing service for All States (Full Payment)
-- EAD is a federal process, not state-specific
INSERT INTO services (
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full
) VALUES (
  'svc_ead_all_states_full',
  'EAD Processing',
  'All States',
  'full',
  '[
    {
      "description": "USCIS Form I-765 Filing Fee",
      "amount": 410.00,
      "taxable": false
    },
    {
      "description": "Biometric Services Fee",
      "amount": 85.00,
      "taxable": false
    },
    {
      "description": "GritSync Service Fee",
      "amount": 150.00,
      "taxable": true
    }
  ]'::jsonb,
  663.00
)
ON CONFLICT (service_name, state, payment_type) 
DO UPDATE SET
  line_items = EXCLUDED.line_items,
  total_full = EXCLUDED.total_full,
  updated_at = NOW();

-- Verify the service was created successfully
SELECT 
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full,
  created_at
FROM services
WHERE service_name = 'EAD Processing';

-- You should see 1 row returned with:
-- id: svc_ead_ny_full
-- service_name: EAD Processing
-- state: New York
-- payment_type: full
-- total_full: 663.00
-- 
-- If you see this row, the setup is complete! ✅
-- Now refresh http://localhost:5000/applications/AP9B83G6Y8HQNH/payments

