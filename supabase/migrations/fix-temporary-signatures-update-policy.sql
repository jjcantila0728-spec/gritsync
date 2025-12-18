-- Fix temporary_signatures UPDATE policy to allow updates by ID
-- The current policy is too restrictive and causes 403 errors
-- This allows updates to mark signatures as consumed

-- Drop existing update policy
DROP POLICY IF EXISTS "Allow update to mark consumed" ON temporary_signatures;
DROP POLICY IF EXISTS "Allow update temporary signatures" ON temporary_signatures;

-- Create a permissive update policy for temporary signatures
-- This allows updates to mark signatures as consumed or update metadata
CREATE POLICY "Allow update temporary signatures"
  ON temporary_signatures
  FOR UPDATE
  TO authenticated, anon
  USING (
    -- Allow update if not expired
    expires_at > NOW()
  )
  WITH CHECK (
    -- Allow any update as long as not expired
    expires_at > NOW()
  );

