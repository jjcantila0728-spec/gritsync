-- Fix donations RLS policy to allow anonymous inserts
-- This patch fixes the issue where anonymous users cannot create donations

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Everyone can create donations" ON donations;

-- Recreate the policy with proper syntax for anonymous users
-- For INSERT operations, we only need WITH CHECK
CREATE POLICY "Everyone can create donations"
ON donations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Verify the policy is working
-- You can test with: 
-- INSERT INTO donations (amount, currency, status, is_anonymous) 
-- VALUES (10.00, 'USD', 'pending', true);



