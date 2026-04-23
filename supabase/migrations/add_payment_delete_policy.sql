-- Add DELETE and INSERT policies for admins on application_payments table
-- This allows admins to delete and create payments for any user

-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "application_payments_insert_admin" ON application_payments;
DROP POLICY IF EXISTS "application_payments_delete_admin" ON application_payments;

-- Policy: Admins can insert payments for any user (for creating payments on behalf of clients)
CREATE POLICY "application_payments_insert_admin" 
ON application_payments FOR INSERT
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy: Admins can delete all payments
CREATE POLICY "application_payments_delete_admin" 
ON application_payments FOR DELETE
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Grant DELETE permission on application_payments table
GRANT DELETE ON application_payments TO authenticated;

