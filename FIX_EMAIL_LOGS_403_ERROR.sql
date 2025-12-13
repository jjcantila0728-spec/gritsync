-- ====================================================================
-- MANUAL FIX FOR EMAIL_LOGS 403 ERROR
-- ====================================================================
-- Run this SQL script in your Supabase SQL Editor to fix the 403 error
-- when clients try to send emails.
--
-- STEPS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Create a new query
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- ====================================================================

-- Drop the restrictive admin-only insert policy
DROP POLICY IF EXISTS "Admins can create email logs" ON email_logs;

-- Create new policies that allow clients to insert their own emails
CREATE POLICY "Authenticated users can create their own email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be the sender of the email
    sent_by_user_id = auth.uid()
    OR
    -- Or user is an admin (can send on behalf of others)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Update the view policy to allow users to see emails they sent
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;

CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see emails they sent
    sent_by_user_id = auth.uid()
    OR
    -- Users can see emails sent to them
    recipient_user_id = auth.uid()
    OR
    -- Admins can see all emails
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add policy for clients to view their sent emails by email address
-- This is useful when filtering by from_email_address_id
CREATE POLICY "Users can view emails from their email addresses"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the email was sent from one of the user's email addresses
    EXISTS (
      SELECT 1 FROM email_addresses
      WHERE email_addresses.id = email_logs.from_email_address_id
      AND email_addresses.user_id = auth.uid()
    )
  );

-- Grant INSERT permission to authenticated users
GRANT INSERT ON email_logs TO authenticated;

-- Verify the policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'email_logs'
ORDER BY policyname;

-- ====================================================================
-- VERIFICATION COMPLETE
-- ====================================================================
-- If you see the new policies listed above, the fix was successful!
-- Now clients should be able to send emails without 403 errors.
-- ====================================================================

