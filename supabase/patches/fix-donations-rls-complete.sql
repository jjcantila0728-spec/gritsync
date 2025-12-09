-- Complete fix for donations RLS policies to allow anonymous donations
-- Run this in your Supabase SQL Editor

-- Drop all existing policies on donations
DROP POLICY IF EXISTS "Everyone can create donations" ON donations;
DROP POLICY IF EXISTS "Users can view their own donations" ON donations;
DROP POLICY IF EXISTS "Admins can view all donations" ON donations;
DROP POLICY IF EXISTS "Admins can update donations" ON donations;

-- Allow everyone (including anonymous) to create donations
CREATE POLICY "Everyone can create donations"
ON donations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view donations they just created
-- This is needed for the .select('*') after insert to work
-- We allow anonymous users to view donations created in the last 5 minutes
-- This gives enough time for the insert + select to complete
CREATE POLICY "Anonymous can view recent donations"
ON donations FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Authenticated users can view their own donations (by email match)
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

