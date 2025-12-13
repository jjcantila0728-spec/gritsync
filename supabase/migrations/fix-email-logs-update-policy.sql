-- Migration: Add UPDATE policy for email_logs to allow status updates
-- Issue: Clients can INSERT email logs but cannot UPDATE them to change status
-- Solution: Add UPDATE policy for users to update their own email logs

-- Drop the restrictive admin-only update policy
DROP POLICY IF EXISTS "Admins can update email logs" ON email_logs;

-- Create new UPDATE policy that allows users to update their own email logs
CREATE POLICY "Users can update their own email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be the sender of the email
    sent_by_user_id = auth.uid()
    OR
    -- Or user is an admin (can update any email)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    -- Same condition for the updated row
    sent_by_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant UPDATE permission to authenticated users
GRANT UPDATE ON email_logs TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Users can update their own email logs" ON email_logs IS 
  'Allows authenticated users to update email logs they created (e.g., status changes after sending)';

-- Verify the policy was created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'email_logs'
AND cmd = 'UPDATE'
ORDER BY policyname;

