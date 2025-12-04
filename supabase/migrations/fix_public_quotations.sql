-- Migration: Fix public quotations to allow saving without authentication
-- This allows quotes generated at /quote to be saved to Supabase
-- Quotes persist until expiration (validity_date) or admin management

-- ============================================================================
-- STEP 1: Make user_id nullable for public quotations
-- ============================================================================
ALTER TABLE quotations 
ALTER COLUMN user_id DROP NOT NULL;

-- Update foreign key to allow NULL (PostgreSQL FK constraints allow NULL by default)
-- No action needed, but we'll verify the constraint is correct

-- ============================================================================
-- STEP 2: Add RLS policies for anonymous/public quotation operations
-- ============================================================================

-- Allow anonymous users to insert quotations with NULL user_id
DROP POLICY IF EXISTS "Allow anonymous quotation inserts" ON quotations;
CREATE POLICY "Allow anonymous quotation inserts"
ON quotations FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Allow anonymous users to read quotations by client_email (for quote viewing)
DROP POLICY IF EXISTS "Allow anonymous quotation reads by email" ON quotations;
CREATE POLICY "Allow anonymous quotation reads by email"
ON quotations FOR SELECT
TO anon
USING (true); -- Allow reading all quotes for anonymous users (they can view any quote by ID)

-- Allow anonymous users to update quotations (for quote status updates if needed)
-- Note: This might not be needed, but adding for completeness
DROP POLICY IF EXISTS "Allow anonymous quotation updates" ON quotations;
CREATE POLICY "Allow anonymous quotation updates"
ON quotations FOR UPDATE
TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

-- ============================================================================
-- STEP 3: Update existing policies to handle NULL user_id
-- ============================================================================

-- Update the "Users can view their own quotations" policy to also show NULL user_id quotes
DROP POLICY IF EXISTS "Users can view their own quotations" ON quotations;
CREATE POLICY "Users can view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Update the "Users can create their own quotations" policy
-- (Keep existing policy, but anonymous inserts are handled by the new policy above)

-- ============================================================================
-- STEP 4: Ensure validity_date is properly indexed for expiration queries
-- ============================================================================

-- Create index on validity_date for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_quotations_validity_date 
ON quotations(validity_date) 
WHERE validity_date IS NOT NULL;

-- Create index on created_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_quotations_created_at 
ON quotations(created_at DESC);

-- ============================================================================
-- STEP 5: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN quotations.user_id IS 'User ID for authenticated users. NULL for public/guest quotations.';
COMMENT ON COLUMN quotations.validity_date IS 'Quote expiration date. Quotes persist until this date or until managed by admin.';

