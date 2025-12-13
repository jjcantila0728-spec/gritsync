-- ====================================================================
-- QUICK FIX FOR EMAIL UPDATE ERROR (PGRST116)
-- ====================================================================
-- Run this SQL script in your Supabase SQL Editor to fix the error:
-- "Cannot coerce the result to a single JSON object" when updating email logs
--
-- ISSUE: Clients can send emails (INSERT works) but status updates fail
-- CAUSE: Missing UPDATE policy for clients
--
-- STEPS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Create a new query
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- ====================================================================

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

-- Verify the policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'email_logs'
ORDER BY cmd, policyname;

-- ====================================================================
-- VERIFICATION COMPLETE
-- ====================================================================
-- If you see "Users can update their own email logs" with cmd='UPDATE',
-- the fix was successful!
--
-- Now try sending an email from http://localhost:5000/client/emails
-- The error should be gone! ✅
-- ====================================================================

