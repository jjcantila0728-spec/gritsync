-- Add application_type column to promo_codes table
-- This allows promo codes to be restricted to NCLEX, EAD, or ALL applications

ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS application_type VARCHAR(20) DEFAULT 'ALL' CHECK (application_type IN ('NCLEX', 'EAD', 'ALL'));

COMMENT ON COLUMN promo_codes.application_type IS 'Application types this promo code applies to: NCLEX, EAD, or ALL';

-- Update existing promo codes to default to ALL if NULL
UPDATE promo_codes
SET application_type = 'ALL'
WHERE application_type IS NULL;

-- Update validate_promo_code function to check application type
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR(50),
  p_amount DECIMAL(10, 2),
  p_service_fee_amount DECIMAL(10, 2) DEFAULT NULL,
  p_application_type VARCHAR(20) DEFAULT NULL
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
  
  -- Check application type compatibility
  IF p_application_type IS NOT NULL AND v_promo.application_type != 'ALL' THEN
    IF v_promo.application_type != UPPER(p_application_type) THEN
      RETURN json_build_object(
        'valid', FALSE,
        'error', 'This promo code is not valid for ' || p_application_type || ' applications'
      );
    END IF;
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
    'application_type', v_promo.application_type,
    'applied_to_service_fee_only', TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission for updated function
GRANT EXECUTE ON FUNCTION validate_promo_code(VARCHAR, DECIMAL, DECIMAL, VARCHAR) TO authenticated, anon;





