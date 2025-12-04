-- Fix 401 Unauthorized error for public quotations
-- This allows anonymous users to create quotations without authentication
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: Make user_id nullable for public quotations
-- ============================================================================

-- First, make user_id nullable to allow public quotations without a user
ALTER TABLE quotations 
ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL
-- (PostgreSQL foreign keys allow NULL by default, but let's verify)
-- If there's a constraint issue, we may need to drop and recreate it
DO $$
BEGIN
  -- Check if we need to modify the foreign key
  -- PostgreSQL FK constraints already allow NULL, so this should be fine
  NULL;
END $$;

-- ============================================================================
-- PART 2: Add policy for anonymous/public quotation inserts
-- ============================================================================

-- Allow anonymous users to insert quotations with NULL user_id
-- This is for public quotation forms where users aren't logged in
CREATE POLICY "Allow anonymous quotation inserts"
ON quotations FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Also allow authenticated users to insert (existing policy should handle this)
-- But let's make sure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quotations' 
    AND policyname = 'Users can create their own quotations'
  ) THEN
    CREATE POLICY "Users can create their own quotations"
    ON quotations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- PART 3: Allow anonymous users to read quotations they created
-- ============================================================================

-- Allow anonymous users to read quotations (for viewing quotes by ID)
-- We'll use a token or ID-based approach, but for now allow reading any quotation
-- NOTE: This might need adjustment based on your security requirements
-- You might want to restrict this to only quotations created in the same session
-- or use a different approach like a public view with a secret token

-- For now, we'll allow anonymous users to read quotations
-- You may want to restrict this further based on your needs
CREATE POLICY "Allow anonymous quotation reads"
ON quotations FOR SELECT
TO anon
USING (true);  -- Allow reading any quotation (adjust if you need more security)

-- ============================================================================
-- PART 4: Grant necessary permissions
-- ============================================================================

-- Grant INSERT permission to anonymous role
GRANT INSERT ON public.quotations TO anon;

-- Grant SELECT permission to anonymous role (for reading quotations)
GRANT SELECT ON public.quotations TO anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policies exist
SELECT 
  'Policies' as check_type,
  tablename,
  policyname,
  roles,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'quotations'
ORDER BY policyname;

-- Check permissions
SELECT 
  'Permissions' as check_type,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'quotations'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 
  '✅ PUBLIC QUOTATIONS FIX COMPLETE!' as message,
  'Anonymous users can now create quotations without authentication.' as note,
  'The 401 error should be resolved. Test by creating a quotation without logging in.' as next_step;

