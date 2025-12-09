-- Fix RLS policies for donations to allow anonymous donations

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can create donations" ON donations;
DROP POLICY IF EXISTS "Users can view their own donations" ON donations;
DROP POLICY IF EXISTS "Admins can view all donations" ON donations;
DROP POLICY IF EXISTS "Admins can update donations" ON donations;

-- Allow everyone (including anonymous) to create donations
CREATE POLICY "Everyone can create donations"
ON donations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view their own donations (by transaction_id or stripe_payment_intent_id)
-- This is a bit tricky - we'll allow anonymous users to view donations created in the same session
-- For authenticated users, they can view donations with their email
CREATE POLICY "Users can view their own donations"
ON donations FOR SELECT
TO authenticated
USING (
  donor_email = (SELECT email FROM users WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Allow anonymous users to view donations (limited - they can see their own via transaction_id in app)
-- For security, we'll be more restrictive - anonymous can only insert, not select
-- They'll need to be authenticated or use transaction_id lookup in the application

-- Admins can view all donations
CREATE POLICY "Admins can view all donations"
ON donations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update donations
CREATE POLICY "Admins can update donations"
ON donations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

