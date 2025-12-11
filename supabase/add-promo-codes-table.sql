-- Create promo_codes table for discount management
-- IMPORTANT: Promo codes should only apply discounts to GritSync service fees (typically $150 or portion thereof)
-- NOT to government fees or third-party fees
-- See PROMO_CODE_DISCOUNT_LOGIC.md for full implementation details

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  max_uses INTEGER DEFAULT NULL, -- NULL means unlimited
  current_uses INTEGER DEFAULT 0 NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_codes_created_by ON promo_codes(created_by);

-- Create promo_code_usage table to track redemptions
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  application_id UUID REFERENCES applications(id),
  payment_id UUID REFERENCES application_payments(id),
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_promo_code_id ON promo_code_usage(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_user_id ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_payment_id ON promo_code_usage(payment_id);

-- Add updated_at trigger for promo_codes
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_codes_updated_at();

-- RLS Policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Anyone can validate active promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Admins can view all promo code usage" ON promo_code_usage;
DROP POLICY IF EXISTS "Users can view their own promo code usage" ON promo_code_usage;
DROP POLICY IF EXISTS "Anyone can record promo code usage" ON promo_code_usage;

-- Allow admins full access to promo_codes
CREATE POLICY "Admins can manage promo codes"
ON promo_codes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow public read for validation (but only active codes)
CREATE POLICY "Anyone can validate active promo codes"
ON promo_codes
FOR SELECT
USING (is_active = TRUE);

-- Allow admins to view all usage
CREATE POLICY "Admins can view all promo code usage"
ON promo_code_usage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow users to view their own usage
CREATE POLICY "Users can view their own promo code usage"
ON promo_code_usage
FOR SELECT
USING (user_id = auth.uid());

-- Allow anyone to insert usage (when applying promo code)
CREATE POLICY "Anyone can record promo code usage"
ON promo_code_usage
FOR INSERT
WITH CHECK (TRUE);

-- Enable RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Add service_fee_amount column to application_payments table
-- This tracks the GritSync service fee portion separately from government fees
ALTER TABLE application_payments
ADD COLUMN IF NOT EXISTS service_fee_amount DECIMAL(10, 2) DEFAULT 150.00;

COMMENT ON COLUMN application_payments.service_fee_amount IS 'GritSync service fee portion of the payment (promo codes apply to this only)';

-- Update existing payments with estimated service fee based on payment type
-- Full payment: $150 service fee
-- Step 1/Step 2: $75 service fee each (half of $150)
-- Retake: $0 service fee (government fee only)
-- Only update rows where service_fee_amount is NULL or equals the default 150.00
UPDATE application_payments
SET service_fee_amount = CASE
  WHEN payment_type = 'full' THEN 150.00
  WHEN payment_type IN ('step1', 'step2') THEN 75.00
  ELSE 0.00
END
WHERE service_fee_amount IS NULL OR service_fee_amount = 150.00;

-- Drop old version of the function if it exists (2-parameter version)
DROP FUNCTION IF EXISTS validate_promo_code(VARCHAR, DECIMAL);

-- Create improved promo code validation function that only discounts service fees
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR(50),
  p_amount DECIMAL(10, 2),
  p_service_fee_amount DECIMAL(10, 2) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_promo RECORD;
  v_discount DECIMAL(10, 2);
  v_applicable_amount DECIMAL(10, 2);
  v_result JSON;
BEGIN
  -- Find active promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = UPPER(p_code)
    AND is_active = TRUE
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', FALSE,
      'error', 'Invalid or expired promo code'
    );
  END IF;
  
  -- Use service fee amount if provided, otherwise estimate as 22.8% of total (150/658)
  -- This ensures promo codes only discount the GritSync service fee
  IF p_service_fee_amount IS NOT NULL THEN
    v_applicable_amount := p_service_fee_amount;
  ELSE
    -- Fallback estimation: service fee is typically 150/658 = ~22.8% of full payment
    v_applicable_amount := ROUND(p_amount * 0.228, 2);
  END IF;
  
  -- Calculate discount on service fee only
  IF v_promo.discount_type = 'percentage' THEN
    v_discount := ROUND((v_applicable_amount * v_promo.discount_value / 100), 2);
  ELSE
    v_discount := v_promo.discount_value;
  END IF;
  
  -- Ensure discount doesn't exceed the service fee
  IF v_discount > v_applicable_amount THEN
    v_discount := v_applicable_amount;
  END IF;
  
  -- Return validation result
  RETURN json_build_object(
    'valid', TRUE,
    'promo_code_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'discount_amount', v_discount,
    'description', v_promo.description,
    'service_fee_amount', v_applicable_amount,
    'applied_to_service_fee_only', TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission for updated function
GRANT EXECUTE ON FUNCTION validate_promo_code(VARCHAR, DECIMAL, DECIMAL) TO authenticated, anon;

-- Insert sample promo codes (optional - remove in production)
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_uses)
VALUES 
  ('WELCOME10', '10% off for new clients', 'percentage', 10.00, NULL),
  ('SAVE50', '$50 off your application', 'fixed', 50.00, 100)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE promo_codes IS 'Promotional discount codes for GritSync services';
COMMENT ON TABLE promo_code_usage IS 'Tracks redemption of promo codes';
COMMENT ON FUNCTION validate_promo_code(VARCHAR, DECIMAL, DECIMAL) IS 'Validates promo code and calculates discount amount on service fees only';

