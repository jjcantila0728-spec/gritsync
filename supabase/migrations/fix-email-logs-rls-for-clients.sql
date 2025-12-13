-- Migration: Fix email_logs RLS policies to allow clients to send emails
-- Issue: Clients receive 403 error when trying to create email logs
-- Solution: Add policies for clients to insert and view their own sent emails

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

-- Add comment for documentation
COMMENT ON POLICY "Authenticated users can create their own email logs" ON email_logs IS 
  'Allows authenticated users (including clients) to create email logs when they send emails from their email addresses';

COMMENT ON POLICY "Users can view their own email logs" ON email_logs IS 
  'Allows users to view emails they sent or received, and admins to view all emails';

COMMENT ON POLICY "Users can view emails from their email addresses" ON email_logs IS 
  'Allows users to view emails sent from their registered email addresses';

