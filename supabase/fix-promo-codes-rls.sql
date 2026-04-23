-- Fix RLS policies for promo_codes tables
-- This fixes the "permission denied for table users" error by using public.users instead of auth.users

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Anyone can validate active promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Admins can view all promo code usage" ON promo_code_usage;
DROP POLICY IF EXISTS "Users can view their own promo code usage" ON promo_code_usage;
DROP POLICY IF EXISTS "Anyone can record promo code usage" ON promo_code_usage;

-- Allow admins full access to promo_codes (using public.users.role)
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

-- Allow admins to view all usage (using public.users.role)
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

