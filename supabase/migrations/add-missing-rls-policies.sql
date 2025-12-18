-- Migration: Add missing RLS policies for tables with RLS enabled
-- This migration adds RLS policies for tables that have RLS enabled but no policies
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

-- ============================================================================
-- PART 1: login_attempts table
-- ============================================================================
-- Users should be able to view their own login attempts
-- Admins should be able to view all login attempts
-- System should be able to insert login attempts (for failed attempts without auth)

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own login attempts" ON login_attempts;
DROP POLICY IF EXISTS "Admins can view all login attempts" ON login_attempts;
DROP POLICY IF EXISTS "System can insert login attempts" ON login_attempts;
DROP POLICY IF EXISTS "Admins can delete login attempts" ON login_attempts;

-- Users can view their own login attempts
CREATE POLICY "Users can view their own login attempts"
ON login_attempts FOR SELECT
USING ((select auth.uid()) = user_id);

-- Admins can view all login attempts
CREATE POLICY "Admins can view all login attempts"
ON login_attempts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- System can insert login attempts (no auth required for failed attempts)
-- This allows tracking failed login attempts even when user doesn't exist
CREATE POLICY "System can insert login attempts"
ON login_attempts FOR INSERT
WITH CHECK (true);

-- Admins can delete login attempts (for cleanup)
CREATE POLICY "Admins can delete login attempts"
ON login_attempts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- PART 2: notification_types table
-- ============================================================================
-- This is a reference/configuration table, so it should be readable by all users
-- Only admins should be able to modify it

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view notification types" ON notification_types;
DROP POLICY IF EXISTS "Authenticated users can view notification types" ON notification_types;
DROP POLICY IF EXISTS "Admins can manage notification types" ON notification_types;

-- Everyone can view notification types (public reference data)
CREATE POLICY "Everyone can view notification types"
ON notification_types FOR SELECT
USING (true);

-- Admins can manage notification types
CREATE POLICY "Admins can manage notification types"
ON notification_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- PART 3: sessions table
-- ============================================================================
-- Users should be able to view and manage their own sessions
-- Admins should be able to view all sessions

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can revoke their own sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can revoke any session" ON sessions;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON sessions FOR SELECT
USING ((select auth.uid()) = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- Authenticated users can create sessions
CREATE POLICY "Authenticated users can create sessions"
ON sessions FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- Users can update their own sessions (for activity tracking)
CREATE POLICY "Users can update their own sessions"
ON sessions FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
ON sessions FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id AND
  (revoked_at IS NOT NULL OR is_active = false)
);

-- Admins can revoke any session
CREATE POLICY "Admins can revoke any session"
ON sessions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- PART 4: user_preferences table
-- ============================================================================
-- Users should be able to view and manage their own preferences
-- Admins might need to view preferences for support purposes

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Admins can view all preferences" ON user_preferences;

-- Users can view their own preferences
CREATE POLICY "Users can view their own preferences"
ON user_preferences FOR SELECT
USING ((select auth.uid()) = user_id);

-- Admins can view all preferences (for support)
CREATE POLICY "Admins can view all preferences"
ON user_preferences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
ON user_preferences FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
ON user_preferences FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 5: Note about auth_leaked_password_protection
-- ============================================================================
-- Leaked password protection must be enabled via Supabase Dashboard
-- Go to Authentication > Settings > Password Security
-- Enable "Leaked Password Protection"
-- This cannot be fixed via SQL migration
-- Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

-- ============================================================================
-- PART 6: Note about slow queries
-- ============================================================================
-- The slow queries identified are primarily:
-- 1. Supabase internal queries (realtime, dashboard, metadata queries)
--    - These are system queries that cannot be directly optimized
--    - They are typically cached and perform well under normal load
--
-- 2. Application queries that can be optimized:
--    - Ensure proper indexes exist on frequently queried columns
--    - Use EXPLAIN ANALYZE to identify bottlenecks
--    - Consider materialized views for complex aggregations
--    - Review RLS policies to ensure they use (select auth.uid()) pattern
--
-- For the realtime.list_changes query:
--    - This is a Supabase Realtime internal query
--    - Consider reducing the number of active subscriptions
--    - Review if all subscriptions are necessary
--
-- For the pg_get_tabledef queries:
--    - These are Supabase Dashboard metadata queries
--    - They are cached and typically only run when schema changes
--    - No action needed unless experiencing frequent dashboard access issues

