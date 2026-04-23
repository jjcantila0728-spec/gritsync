-- MVP Security Optimization Migration
-- This migration consolidates and simplifies security to MVP level
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: Create Unified Admin Check Function
-- ============================================================================
-- Use auth.users to avoid RLS recursion issues
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- Also create is_admin_user() as alias for backward compatibility
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN public.is_admin();
END;
$$;

-- ============================================================================
-- PART 2: Grant Basic Permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================================
-- PART 3: Enable RLS on All Tables
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_timeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Newer tables
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_sponsorships') THEN
    ALTER TABLE nclex_sponsorships ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'donations') THEN
    ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'careers') THEN
    ALTER TABLE careers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    ALTER TABLE partner_agencies ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- PART 4: Drop All Existing Policies (Clean Slate)
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PART 5: Users Table - MVP Policies
-- ============================================================================
-- Users can view/update their own profile
CREATE POLICY "users_select_own" ON users FOR SELECT
TO authenticated USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

-- Service role can insert (for triggers)
CREATE POLICY "users_insert_service" ON users FOR INSERT
TO service_role WITH CHECK (true);

-- Admins can view/update all users
CREATE POLICY "users_select_admin" ON users FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "users_update_admin" ON users FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON users TO authenticated;

-- ============================================================================
-- PART 6: Applications Table - MVP Policies
-- ============================================================================
CREATE POLICY "applications_select_own" ON applications FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "applications_insert_own" ON applications FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "applications_update_own" ON applications FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "applications_select_admin" ON applications FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "applications_update_admin" ON applications FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON applications TO authenticated;

-- ============================================================================
-- PART 7: Quotations Table - MVP Policies (Public Access)
-- ============================================================================
-- Anonymous can create/view quotations (for public quotes)
CREATE POLICY "quotations_insert_anon" ON quotations FOR INSERT
TO anon WITH CHECK (user_id IS NULL);

CREATE POLICY "quotations_select_anon" ON quotations FOR SELECT
TO anon USING (true);

CREATE POLICY "quotations_update_anon" ON quotations FOR UPDATE
TO anon USING (user_id IS NULL) WITH CHECK (user_id IS NULL);

-- Authenticated users
CREATE POLICY "quotations_select_own" ON quotations FOR SELECT
TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "quotations_insert_own" ON quotations FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quotations_update_own" ON quotations FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quotations_delete_own" ON quotations FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Admins
CREATE POLICY "quotations_select_admin" ON quotations FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "quotations_update_admin" ON quotations FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "quotations_delete_admin" ON quotations FOR DELETE
TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON quotations TO authenticated, anon;

-- ============================================================================
-- PART 8: User Details Table - MVP Policies
-- ============================================================================
CREATE POLICY "user_details_select_own" ON user_details FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_details_insert_own" ON user_details FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_details_update_own" ON user_details FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON user_details TO authenticated;

-- ============================================================================
-- PART 9: User Documents Table - MVP Policies
-- ============================================================================
CREATE POLICY "user_documents_select_own" ON user_documents FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_documents_insert_own" ON user_documents FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_documents_update_own" ON user_documents FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_documents_delete_own" ON user_documents FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Admins
CREATE POLICY "user_documents_select_admin" ON user_documents FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "user_documents_insert_admin" ON user_documents FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "user_documents_update_admin" ON user_documents FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "user_documents_delete_admin" ON user_documents FOR DELETE
TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_documents TO authenticated;

-- ============================================================================
-- PART 10: Application Payments Table - MVP Policies
-- ============================================================================
CREATE POLICY "application_payments_select_own" ON application_payments FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "application_payments_insert_own" ON application_payments FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "application_payments_select_admin" ON application_payments FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "application_payments_update_admin" ON application_payments FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON application_payments TO authenticated;

-- ============================================================================
-- PART 11: Receipts Table - MVP Policies
-- ============================================================================
CREATE POLICY "receipts_select_own" ON receipts FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "receipts_select_admin" ON receipts FOR SELECT
TO authenticated USING (public.is_admin());

GRANT SELECT ON receipts TO authenticated;

-- ============================================================================
-- PART 12: Processing Accounts Table - MVP Policies
-- ============================================================================
CREATE POLICY "processing_accounts_select_own" ON processing_accounts FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = processing_accounts.application_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "processing_accounts_select_admin" ON processing_accounts FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "processing_accounts_insert_admin" ON processing_accounts FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "processing_accounts_update_admin" ON processing_accounts FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON processing_accounts TO authenticated;

-- ============================================================================
-- PART 13: Application Timeline Steps Table - MVP Policies
-- ============================================================================
CREATE POLICY "application_timeline_steps_select_own" ON application_timeline_steps FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "application_timeline_steps_select_admin" ON application_timeline_steps FOR SELECT
TO authenticated USING (public.is_admin());

CREATE POLICY "application_timeline_steps_insert_admin" ON application_timeline_steps FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "application_timeline_steps_update_admin" ON application_timeline_steps FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON application_timeline_steps TO authenticated;

-- ============================================================================
-- PART 14: Notifications Table - MVP Policies
-- ============================================================================
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- System can insert (for triggers/functions)
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;

-- ============================================================================
-- PART 15: Settings Table - MVP Policies (Public Read, Admin Write)
-- ============================================================================
CREATE POLICY "settings_select_all" ON settings FOR SELECT
USING (true);

CREATE POLICY "settings_insert_admin" ON settings FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "settings_update_admin" ON settings FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON settings TO authenticated, anon;
GRANT INSERT, UPDATE ON settings TO authenticated;

-- ============================================================================
-- PART 16: Services Table - MVP Policies (Public Read, Admin Write)
-- ============================================================================
CREATE POLICY "services_select_all" ON services FOR SELECT
USING (true);

CREATE POLICY "services_insert_admin" ON services FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "services_update_admin" ON services FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "services_delete_admin" ON services FOR DELETE
TO authenticated USING (public.is_admin());

GRANT SELECT ON services TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON services TO authenticated;

-- ============================================================================
-- PART 17: NCLEX Sponsorships Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_sponsorships') THEN
    -- Everyone can create
    CREATE POLICY "nclex_sponsorships_insert_all" ON nclex_sponsorships FOR INSERT
    TO anon, authenticated WITH CHECK (true);
    
    -- Anonymous can view recent (for post-insert select)
    CREATE POLICY "nclex_sponsorships_select_anon_recent" ON nclex_sponsorships FOR SELECT
    TO anon USING (created_at > NOW() - INTERVAL '5 minutes');
    
    -- Users can view their own
    CREATE POLICY "nclex_sponsorships_select_own" ON nclex_sponsorships FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
    
    -- Users can update their own (pending only)
    CREATE POLICY "nclex_sponsorships_update_own" ON nclex_sponsorships FOR UPDATE
    TO authenticated USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');
    
    -- Admins
    CREATE POLICY "nclex_sponsorships_select_admin" ON nclex_sponsorships FOR SELECT
    TO authenticated USING (public.is_admin());
    
    CREATE POLICY "nclex_sponsorships_update_admin" ON nclex_sponsorships FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
    CREATE POLICY "nclex_sponsorships_delete_admin" ON nclex_sponsorships FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON nclex_sponsorships TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- PART 18: Donations Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'donations') THEN
    -- Everyone can create
    CREATE POLICY "donations_insert_all" ON donations FOR INSERT
    TO anon, authenticated WITH CHECK (true);
    
    -- Anonymous can view recent (for post-insert select)
    CREATE POLICY "donations_select_anon_recent" ON donations FOR SELECT
    TO anon USING (created_at > NOW() - INTERVAL '5 minutes');
    
    -- Users can view their own (by email)
    CREATE POLICY "donations_select_own" ON donations FOR SELECT
    TO authenticated USING (
      donor_email = (SELECT email FROM users WHERE id = auth.uid())
      OR public.is_admin()
    );
    
    -- Admins
    CREATE POLICY "donations_select_admin" ON donations FOR SELECT
    TO authenticated USING (public.is_admin());
    
    CREATE POLICY "donations_update_admin" ON donations FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
    GRANT SELECT, INSERT, UPDATE ON donations TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- PART 19: Careers Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'careers') THEN
    -- Everyone can view active
    CREATE POLICY "careers_select_active" ON careers FOR SELECT
    TO anon, authenticated USING (is_active = TRUE);
    
    -- Admins can view all
    CREATE POLICY "careers_select_admin" ON careers FOR SELECT
    TO authenticated USING (public.is_admin());
    
    -- Admins can manage
    CREATE POLICY "careers_insert_admin" ON careers FOR INSERT
    TO authenticated WITH CHECK (public.is_admin());
    
    CREATE POLICY "careers_update_admin" ON careers FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
    CREATE POLICY "careers_delete_admin" ON careers FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT ON careers TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON careers TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- PART 20: Career Applications Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    -- Everyone can create
    CREATE POLICY "career_applications_insert_all" ON career_applications FOR INSERT
    TO anon, authenticated WITH CHECK (true);
    
    -- Anonymous can view recent
    CREATE POLICY "career_applications_select_anon_recent" ON career_applications FOR SELECT
    TO anon USING (created_at > NOW() - INTERVAL '5 minutes');
    
    -- Users can view their own
    CREATE POLICY "career_applications_select_own" ON career_applications FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
    
    -- Users can update their own (pending only)
    CREATE POLICY "career_applications_update_own" ON career_applications FOR UPDATE
    TO authenticated USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');
    
    -- Admins
    CREATE POLICY "career_applications_select_admin" ON career_applications FOR SELECT
    TO authenticated USING (public.is_admin());
    
    CREATE POLICY "career_applications_update_admin" ON career_applications FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
    CREATE POLICY "career_applications_delete_admin" ON career_applications FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON career_applications TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- PART 21: Partner Agencies Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    -- Everyone can view active
    CREATE POLICY "partner_agencies_select_active" ON partner_agencies FOR SELECT
    TO anon, authenticated USING (is_active = TRUE);
    
    -- Admins can view all
    CREATE POLICY "partner_agencies_select_admin" ON partner_agencies FOR SELECT
    TO authenticated USING (public.is_admin());
    
    -- Admins can manage
    CREATE POLICY "partner_agencies_insert_admin" ON partner_agencies FOR INSERT
    TO authenticated WITH CHECK (public.is_admin());
    
    CREATE POLICY "partner_agencies_update_admin" ON partner_agencies FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
    CREATE POLICY "partner_agencies_delete_admin" ON partner_agencies FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT ON partner_agencies TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON partner_agencies TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- PART 22: Password Reset Tokens Table - MVP Policies
-- ============================================================================
CREATE POLICY "password_reset_tokens_select_own" ON password_reset_tokens FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "password_reset_tokens_insert_own" ON password_reset_tokens FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "password_reset_tokens_update_own" ON password_reset_tokens FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO authenticated;

-- ============================================================================
-- COMPLETE: Security optimized to MVP level
-- ============================================================================
-- All policies now use the unified is_admin() function
-- All tables have consistent, minimal MVP-level security
-- Anonymous access is properly configured for public features

