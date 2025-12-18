-- Add EAD service configuration
-- This migration adds the default EAD (Employment Authorization Document) processing service
-- EAD is a federal process, not state-specific, so we use 'All States'

-- Insert EAD Processing service for All States (Full Payment)
INSERT INTO services (
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full,
  created_at,
  updated_at
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
  663.00,  -- Total: $495 (government fees) + $150 (service) + $18 (12% tax on $150)
  NOW(),
  NOW()
)
ON CONFLICT (service_name, state, payment_type) 
DO UPDATE SET
  line_items = EXCLUDED.line_items,
  total_full = EXCLUDED.total_full,
  updated_at = NOW();

-- Add comment explaining the configuration
COMMENT ON TABLE services IS 'Service configurations for various application types (NCLEX, EAD, etc.) with pricing and line items';

-- Verify the insert
DO $$
DECLARE
  service_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO service_count
  FROM services
  WHERE service_name = 'EAD Processing';
  
  IF service_count > 0 THEN
    RAISE NOTICE 'EAD service configuration added successfully. Count: %', service_count;
  ELSE
    RAISE WARNING 'EAD service configuration was not added. Please check the migration.';
  END IF;
END $$;

