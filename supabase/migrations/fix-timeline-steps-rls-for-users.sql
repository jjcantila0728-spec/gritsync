-- Fix RLS policies for application_timeline_steps to allow users to insert/update their own application steps
-- This allows clients to update their own timeline steps (e.g., when reviewing/signing documents)
-- Note: upsert() requires both INSERT and UPDATE permissions

-- Drop existing policies (including any that might have been created previously)
DROP POLICY IF EXISTS "Admins can insert steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "Admins can update steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "application_timeline_steps_insert_admin" ON application_timeline_steps;
DROP POLICY IF EXISTS "application_timeline_steps_update_admin" ON application_timeline_steps;
DROP POLICY IF EXISTS "Users can insert their own application steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "Users can update their own application steps" ON application_timeline_steps;

-- Create new INSERT policy that allows both admins and users to insert their own application steps
CREATE POLICY "Users can insert their own application steps"
ON application_timeline_steps FOR INSERT
WITH CHECK (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  -- Allow if user owns the application
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

-- Create new UPDATE policy that allows both admins and users to update their own application steps
CREATE POLICY "Users can update their own application steps"
ON application_timeline_steps FOR UPDATE
USING (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  -- Allow if user owns the application
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same check for WITH CHECK clause
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

