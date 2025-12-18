-- Quick setup script for EAD service configuration
-- Run this in your Supabase SQL Editor

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

-- Verify the service was created
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

