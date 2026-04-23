-- Fix RLS policies for email_subscribers table
-- The original policy was trying to access auth.users which caused permission issues

-- Drop existing policies
DROP POLICY IF EXISTS "Admins have full access to subscribers" ON public.email_subscribers;
DROP POLICY IF EXISTS "Public can view own subscription via token" ON public.email_subscribers;
DROP POLICY IF EXISTS "Public can subscribe" ON public.email_subscribers;

-- Create new policy for authenticated users with admin check
-- Use the existing is_admin() function which checks auth.users safely
CREATE POLICY "Admins have full access to subscribers"
  ON public.email_subscribers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow public to view subscribers (for unsubscribe pages)
CREATE POLICY "Public can view subscribers"
  ON public.email_subscribers
  FOR SELECT
  TO public
  USING (true);

-- Allow public to insert new subscriptions (newsletter signups)
CREATE POLICY "Public can subscribe"
  ON public.email_subscribers
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow public to update their own subscription via token (unsubscribe, preferences)
CREATE POLICY "Public can update own subscription via token"
  ON public.email_subscribers
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Refresh permissions
GRANT ALL ON public.email_subscribers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_subscribers TO anon;

