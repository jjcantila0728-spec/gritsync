-- Fix RLS policies for processing_accounts to allow users to insert accounts for their own applications
-- This enables auto-generation of Gmail and Pearson Vue accounts

-- Drop the existing insert policy that only allows admins
DROP POLICY IF EXISTS "Admins can insert accounts" ON processing_accounts;

-- Create a new policy that allows:
-- 1. Admins to insert any account
-- 2. Users to insert accounts for their own applications
CREATE POLICY "Users can insert accounts for their applications"
ON processing_accounts FOR INSERT
WITH CHECK (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  -- Allow if the application belongs to the user
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = processing_accounts.application_id
    AND applications.user_id = auth.uid()
  )
);

-- Also update the update policy to allow users to update accounts for their own applications
DROP POLICY IF EXISTS "Admins can update accounts" ON processing_accounts;

CREATE POLICY "Users can update accounts for their applications"
ON processing_accounts FOR UPDATE
USING (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  -- Allow if the application belongs to the user
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = processing_accounts.application_id
    AND applications.user_id = auth.uid()
  )
);


