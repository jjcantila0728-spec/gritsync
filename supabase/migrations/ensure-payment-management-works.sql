-- ============================================================================
-- Ensure All Payment Management Operations Work in Supabase
-- ============================================================================
-- This migration ensures that all payment management functionality works
-- for both authenticated users and public checkout scenarios
-- ============================================================================

-- Step 1: Ensure RLS is enabled on application_payments
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies to recreate them properly
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'application_payments' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON application_payments', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- SELECT Policies (View Payments)
-- ============================================================================

-- Policy 1: Authenticated users can view their own payments
CREATE POLICY "users_select_own_payments"
ON application_payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Admins can view ALL payments
CREATE POLICY "admins_select_all_payments"
ON application_payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy 3: Public users can view payments by application_id (for checkout)
-- This allows public checkout pages to view payment status
CREATE POLICY "public_select_payments_by_application"
ON application_payments FOR SELECT
TO anon
USING (true); -- Allow public read for checkout pages

-- ============================================================================
-- INSERT Policies (Create Payments)
-- ============================================================================

-- Policy 4: Authenticated users can create their own payments
CREATE POLICY "users_insert_own_payments"
ON application_payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 5: Public users can create payments (for checkout)
-- This allows public checkout to create payment records
CREATE POLICY "public_insert_payments"
ON application_payments FOR INSERT
TO anon
WITH CHECK (true); -- Allow public insert for checkout

-- ============================================================================
-- UPDATE Policies (Update Payments)
-- ============================================================================

-- Policy 6: Authenticated users can update their own payments
CREATE POLICY "users_update_own_payments"
ON application_payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 7: Admins can update ALL payments (for approval/rejection)
CREATE POLICY "admins_update_all_payments"
ON application_payments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy 8: Public users can update payments (for checkout completion)
-- This allows public checkout to update payment status after payment
CREATE POLICY "public_update_payments"
ON application_payments FOR UPDATE
TO anon
USING (true) -- Allow public to update any payment (for checkout)
WITH CHECK (true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.application_payments TO authenticated;

-- Grant table permissions to anonymous users (for public checkout)
GRANT SELECT, INSERT, UPDATE ON public.application_payments TO anon;

-- ============================================================================
-- Ensure receipts table also works properly
-- ============================================================================

-- Enable RLS on receipts if not already enabled
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing receipt policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'receipts' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON receipts', r.policyname);
  END LOOP;
END $$;

-- Policy: Users can view their own receipts
CREATE POLICY "users_select_own_receipts"
ON receipts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admins can view all receipts
CREATE POLICY "admins_select_all_receipts"
ON receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy: Public can view receipts (for checkout/email links)
CREATE POLICY "public_select_receipts"
ON receipts FOR SELECT
TO anon
USING (true);

-- Policy: Service role can insert receipts (for edge functions)
CREATE POLICY "service_insert_receipts"
ON receipts FOR INSERT
TO service_role
WITH CHECK (true);

-- Grant permissions on receipts
GRANT SELECT ON public.receipts TO authenticated;
GRANT SELECT ON public.receipts TO anon;
GRANT INSERT ON public.receipts TO service_role;

-- ============================================================================
-- Verify Policies
-- ============================================================================

-- Check that all policies are created
SELECT 
  'application_payments policies' as table_name,
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename = 'application_payments' 
AND schemaname = 'public'
ORDER BY policyname;

SELECT 
  'receipts policies' as table_name,
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename = 'receipts' 
AND schemaname = 'public'
ORDER BY policyname;

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. Public (anon) users can now:
--    - View payments (for checkout status)
--    - Create payments (for checkout)
--    - Update payments (for completing checkout)
--    - View receipts (for email links)
--
-- 2. Authenticated users can:
--    - View their own payments
--    - Create their own payments
--    - Update their own payments
--
-- 3. Admins can:
--    - View all payments
--    - Update all payments (approve/reject)
--
-- 4. All operations work through Supabase client library
-- ============================================================================

