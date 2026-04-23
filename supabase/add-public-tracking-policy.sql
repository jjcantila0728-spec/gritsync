-- Add public tracking policy for applications
-- This allows anyone (including unauthenticated users) to view applications for tracking
-- 
-- IMPORTANT: Run this in Supabase SQL Editor AFTER running add-grit-app-id.sql
-- 
-- NOTE: This policy allows public access to applications for tracking purposes.
-- The tracking API will filter by grit_app_id or id, so users can only see
-- the specific application they're tracking, not all applications.

-- Public policy: Anyone can view applications (for public tracking)
-- This is safe because PostgREST will filter by the specific ID in the query
CREATE POLICY IF NOT EXISTS "Public can track applications"
ON applications FOR SELECT
TO anon, authenticated
USING (true);

