-- Add public tracking policies for all tables needed for tracking
-- This allows anonymous users to track applications by ID or GRIT APP ID
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- This migration ensures public users can access tracking data

-- ============================================================================
-- 1. Applications Table - Allow public tracking by ID or GRIT APP ID
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can track applications" ON applications;

-- Create policy for public tracking
-- This allows anonymous users to query applications by id or grit_app_id
CREATE POLICY "Public can track applications"
ON applications FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 2. Application Timeline Steps - Allow public access for tracking
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE application_timeline_steps ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view timeline steps for tracking" ON application_timeline_steps;

-- Create policy for public access to timeline steps
-- Anonymous users can view timeline steps for any application (needed for tracking)
CREATE POLICY "Public can view timeline steps for tracking"
ON application_timeline_steps FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 3. Application Payments - Allow public access for tracking
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view payments for tracking" ON application_payments;

-- Create policy for public access to payments
-- Anonymous users can view payments for any application (needed for tracking progress)
CREATE POLICY "Public can view payments for tracking"
ON application_payments FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 4. Processing Accounts - Allow public access for tracking
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE processing_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view processing accounts for tracking" ON processing_accounts;

-- Create policy for public access to processing accounts
-- Anonymous users can view processing accounts (needed to get Gmail for display)
CREATE POLICY "Public can view processing accounts for tracking"
ON processing_accounts FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('applications', 'application_timeline_steps', 'application_payments', 'processing_accounts')
  AND schemaname = 'public'
  AND policyname LIKE '%tracking%'
ORDER BY tablename, policyname;
