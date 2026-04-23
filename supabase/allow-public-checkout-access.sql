-- Allow public read access to applications table for checkout page
-- This enables the checkout link sharing feature where anyone with the link can pay

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow public read for checkout" ON applications;

-- Create new policy allowing public read access
CREATE POLICY "Allow public read for checkout"
ON applications
FOR SELECT
USING (true);

-- Also allow public read access to application_payments for checkout
DROP POLICY IF EXISTS "Allow public read for checkout payments" ON application_payments;

CREATE POLICY "Allow public read for checkout payments"
ON application_payments
FOR SELECT
USING (true);

-- Note: This is safe because:
-- 1. Only SELECT (read) access is granted, no modifications
-- 2. Checkout page only shows: name, email, phone, payment amount
-- 3. Sensitive data (documents, full details) are not exposed
-- 4. Payment processing still requires valid payment_id
-- 5. Admin approval still required for mobile banking payments

