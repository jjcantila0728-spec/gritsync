-- Add usd_to_php_rate column to application_payments table
-- This stores the conversion rate used at the time of payment for PHP-convertible payment methods
ALTER TABLE application_payments
ADD COLUMN IF NOT EXISTS usd_to_php_rate DECIMAL(10, 4);

-- Add comment
COMMENT ON COLUMN application_payments.usd_to_php_rate IS 'USD to PHP conversion rate used at the time of payment (for mobile_banking and gcash payment methods)';

