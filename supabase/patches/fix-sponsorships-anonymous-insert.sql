-- Fix sponsorships RLS policy to allow anonymous applications
-- This allows nurses to apply for sponsorship without logging in

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create their own sponsorships" ON nclex_sponsorships;

-- Allow everyone (including anonymous) to create sponsorships
CREATE POLICY "Everyone can create sponsorships"
ON nclex_sponsorships FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view sponsorships they just created
-- This is needed for the .select('*') after insert to work
CREATE POLICY "Anonymous can view recent sponsorships"
ON nclex_sponsorships FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Keep existing policy for authenticated users to view their own
-- (This should already exist, but keeping it for clarity)
-- Users can view their own sponsorships
DROP POLICY IF EXISTS "Users can view their own sponsorships" ON nclex_sponsorships;
CREATE POLICY "Users can view their own sponsorships"
ON nclex_sponsorships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);



