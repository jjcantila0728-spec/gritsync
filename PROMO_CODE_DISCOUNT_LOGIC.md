# Promo Code Discount Logic

## Overview
Promo codes apply discounts **ONLY to the GritSync Service Fee** portion of payments, not to government fees or third-party fees.

## Fee Structure Breakdown

### Typical NCLEX Application Payment Structure:
- **Government/NCSBN Fees**: (varies by state/step)
  - NCLEX PV Application Fee: $200
  - NCLEX PV NCSBN Exam Fee: $150
  - NCLEX NY Quick Results: $8
  
- **GritSync Service Fee**: $150 ← **PROMO CODE APPLIES HERE ONLY**

### Example Payment Scenarios:

#### Scenario 1: Full Payment
- Total Payment: $658
- GritSync Service Fee: $150
- Government/Other Fees: $508
- **Promo Code "WELCOME10" (10% off):**
  - Discount applied to: $150 (service fee only)
  - Discount amount: $15
  - New service fee: $135
  - **Final Total: $643** (not $592.20)

#### Scenario 2: Staggered Payment (Step 1)
- Step 1 Payment: $291.75
- GritSync Service Fee portion: $75 (half of $150)
- Other fees: $216.75
- **Promo Code "SAVE50" ($50 off):**
  - Discount applied to: $75 (service fee portion)
  - Discount amount: $50 (but limited to $75 max)
  - New service fee portion: $25
  - **Final Total: $241.75**

## Implementation Notes

### Current Implementation
The promo code validation function (`validate_promo_code`) in the database currently applies the discount to the **entire payment amount**. This needs to be updated to:

1. Identify the GritSync service fee portion of the payment
2. Apply the discount only to that portion
3. Recalculate the total

### Required Changes

#### 1. Database Schema Update
Add a field to track the service fee amount in each payment:

```sql
ALTER TABLE application_payments
ADD COLUMN service_fee_amount DECIMAL(10, 2) DEFAULT 150.00;
```

#### 2. Update Payment Creation
When creating payments, explicitly set the `service_fee_amount`:

```typescript
// In applicationPaymentsAPI.create()
await supabase
  .from('application_payments')
  .insert({
    application_id: applicationId,
    payment_type: type,
    amount: totalAmount,
    service_fee_amount: getServiceFeeForPaymentType(type), // New function
    // ... other fields
  })
```

#### 3. Service Fee Calculation Function

```typescript
function getServiceFeeForPaymentType(paymentType: string): number {
  const FULL_SERVICE_FEE = 150.00
  
  switch(paymentType) {
    case 'full':
      return FULL_SERVICE_FEE
    case 'step1':
    case 'step2':
      return FULL_SERVICE_FEE / 2 // $75 per step
    case 'retake':
      return 0 // No service fee for retakes (government fee only)
    default:
      return FULL_SERVICE_FEE
  }
}
```

#### 4. Update Promo Code Validation Function

```sql
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code VARCHAR(50),
  p_amount DECIMAL(10, 2),
  p_service_fee_amount DECIMAL(10, 2) DEFAULT NULL -- New parameter
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
  
  -- Determine applicable amount (service fee only, or full amount if not specified)
  v_applicable_amount := COALESCE(p_service_fee_amount, p_amount);
  
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
    'applied_to_service_fee_only', TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 5. Update Frontend to Pass Service Fee Amount

In `StripePaymentForm.tsx`, when validating promo code:

```typescript
const validatePromoCode = async () => {
  // ... existing code ...
  
  // Get service fee amount from payment data if available
  const serviceFeeAmount = payment?.service_fee_amount || amount * 0.228 // Fallback estimate
  
  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_code: promoCode.toUpperCase(),
    p_amount: amount,
    p_service_fee_amount: serviceFeeAmount // Pass service fee
  })
  
  // ... rest of code ...
}
```

## Migration Path

### Phase 1: Database Update (Immediate)
1. Add `service_fee_amount` column to `application_payments` table
2. Backfill existing payments with estimated service fee amounts

### Phase 2: Payment Creation Update
1. Update payment creation logic to include service fee amount
2. Add service fee calculation function

### Phase 3: Validation Update
1. Update `validate_promo_code` function with new parameter
2. Update frontend to pass service fee amount

### Phase 4: Testing
1. Test promo codes with full payment
2. Test promo codes with staggered payments
3. Test promo codes exceeding service fee amount
4. Verify government fees are never discounted

## Important Business Rules

1. **Discount Cap**: Promo code discounts can never exceed the service fee amount
   - If promo code is $100 off but service fee is $75, discount is capped at $75
   
2. **Government Fee Protection**: Government/NCSBN fees must NEVER be discounted
   - These fees are pass-through charges to regulatory bodies
   
3. **Staggered Payment Handling**: 
   - Service fee is split evenly across staggered payments
   - Promo code on Step 1 only discounts Step 1's service fee portion
   - Client must use separate promo code for Step 2 if desired

4. **Retake Fees**: 
   - Retake fees are typically government fees only (no service fee)
   - Promo codes should not apply to retake payments

## User-Facing Display

When a promo code is applied, the UI should clearly show:

```
Original Amount:           $291.75
  Government Fees:         $216.75
  Service Fee:             $75.00
  
Promo Discount (WELCOME10): -$7.50
  (10% off service fee)

Final Amount:              $284.25
  Government Fees:         $216.75 (unchanged)
  Service Fee:             $67.50
```

This transparency ensures clients understand that:
- Government fees are fixed and cannot be discounted
- The promo code only applies to GritSync's service fee
- The total savings and final amount are clear

## Status

**Current Status**: Promo code system is implemented but applies discount to total amount.

**Next Steps**: Implement service fee tracking and update validation function to apply discounts only to service fee portion.

**Priority**: Medium - Feature works but should be updated for accuracy and transparency.

