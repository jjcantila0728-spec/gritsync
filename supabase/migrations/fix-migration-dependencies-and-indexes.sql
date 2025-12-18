-- Migration: Fix Dependencies and Add Missing Indexes
-- This migration ensures all dependencies are met and adds performance indexes

-- ============================================================================
-- 1. VERIFY REQUIRED TABLES EXIST
-- ============================================================================
DO $$
DECLARE
  missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check for required tables
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    missing_tables := array_append(missing_tables, 'users');
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    missing_tables := array_append(missing_tables, 'partner_agencies');
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    missing_tables := array_append(missing_tables, 'career_applications');
  END IF;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required tables: %. Please run migrations in correct order.', array_to_string(missing_tables, ', ');
  END IF;
END $$;

-- ============================================================================
-- 2. ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for careers table
CREATE INDEX IF NOT EXISTS idx_careers_employment_type ON careers(employment_type) WHERE employment_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_careers_department ON careers(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_careers_application_deadline ON careers(application_deadline) WHERE application_deadline IS NOT NULL;

-- Indexes for career_applications table
CREATE INDEX IF NOT EXISTS idx_career_applications_email ON career_applications(email);
CREATE INDEX IF NOT EXISTS idx_career_applications_career_id_status ON career_applications(career_id, status) WHERE career_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_career_applications_created_at_status ON career_applications(created_at DESC, status);

-- Indexes for nclex_sponsorships table
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_email ON nclex_sponsorships(email);
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_created_at ON nclex_sponsorships(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_status_created_at ON nclex_sponsorships(status, created_at DESC);

-- Indexes for donations table
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email) WHERE donor_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_stripe_payment_intent_id ON donations(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_transaction_id ON donations(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_status_created_at ON donations(status, created_at DESC);

-- Composite index for donations by sponsorship
CREATE INDEX IF NOT EXISTS idx_donations_sponsorship_status ON donations(sponsorship_id, status) WHERE sponsorship_id IS NOT NULL;

-- ============================================================================
-- 3. ADD MISSING CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure email format validation (basic check)
-- Note: This is a simple check. For production, consider using a more robust validation
DO $$
BEGIN
  -- Add check constraint for email format in career_applications if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'career_applications_email_format_check'
  ) THEN
    ALTER TABLE career_applications
    ADD CONSTRAINT career_applications_email_format_check
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
  
  -- Add check constraint for email format in nclex_sponsorships if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'nclex_sponsorships_email_format_check'
  ) THEN
    ALTER TABLE nclex_sponsorships
    ADD CONSTRAINT nclex_sponsorships_email_format_check
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
  
  -- Add check constraint for positive donation amounts
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'donations_amount_positive_check'
  ) THEN
    ALTER TABLE donations
    ADD CONSTRAINT donations_amount_positive_check
    CHECK (amount > 0);
  END IF;
END $$;

-- ============================================================================
-- 4. ADD MISSING RLS POLICIES (if not already present)
-- ============================================================================

-- Ensure donations can be updated by admins (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'donations' 
    AND policyname = 'Admins can update donations'
  ) THEN
    CREATE POLICY "Admins can update donations"
    ON donations FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    );
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFY TRIGGERS ARE IN PLACE
-- ============================================================================

-- Ensure update_updated_at_column function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at_column'
  ) THEN
    RAISE EXCEPTION 'update_updated_at_column function is missing. Please run schema.sql first.';
  END IF;
END $$;

-- ============================================================================
-- 6. ADD HELPER FUNCTIONS FOR MVP FEATURES
-- ============================================================================

-- Function to get career statistics (for dashboard)
CREATE OR REPLACE FUNCTION get_career_statistics()
RETURNS TABLE (
  total_careers BIGINT,
  active_careers BIGINT,
  featured_careers BIGINT,
  total_applications BIGINT,
  pending_applications BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM careers)::BIGINT as total_careers,
    (SELECT COUNT(*) FROM careers WHERE is_active = TRUE)::BIGINT as active_careers,
    (SELECT COUNT(*) FROM careers WHERE is_featured = TRUE AND is_active = TRUE)::BIGINT as featured_careers,
    (SELECT COUNT(*) FROM career_applications)::BIGINT as total_applications,
    (SELECT COUNT(*) FROM career_applications WHERE status = 'pending')::BIGINT as pending_applications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get donation statistics (for dashboard)
CREATE OR REPLACE FUNCTION get_donation_statistics()
RETURNS TABLE (
  total_donations BIGINT,
  total_amount DECIMAL,
  completed_donations BIGINT,
  completed_amount DECIMAL,
  pending_donations BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM donations)::BIGINT as total_donations,
    (SELECT COALESCE(SUM(amount), 0) FROM donations)::DECIMAL as total_amount,
    (SELECT COUNT(*) FROM donations WHERE status = 'completed')::BIGINT as completed_donations,
    (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE status = 'completed')::DECIMAL as completed_amount,
    (SELECT COUNT(*) FROM donations WHERE status = 'pending')::BIGINT as pending_donations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sponsorship statistics (for dashboard)
CREATE OR REPLACE FUNCTION get_sponsorship_statistics()
RETURNS TABLE (
  total_sponsorships BIGINT,
  pending_sponsorships BIGINT,
  approved_sponsorships BIGINT,
  awarded_sponsorships BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM nclex_sponsorships)::BIGINT as total_sponsorships,
    (SELECT COUNT(*) FROM nclex_sponsorships WHERE status = 'pending')::BIGINT as pending_sponsorships,
    (SELECT COUNT(*) FROM nclex_sponsorships WHERE status = 'approved')::BIGINT as approved_sponsorships,
    (SELECT COUNT(*) FROM nclex_sponsorships WHERE status = 'awarded')::BIGINT as awarded_sponsorships;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. GRANT PERMISSIONS FOR FUNCTIONS
-- ============================================================================

-- Grant execute permissions to authenticated users for statistics functions
GRANT EXECUTE ON FUNCTION get_career_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_donation_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sponsorship_statistics() TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration:
-- 1. Verifies all required tables exist
-- 2. Adds performance indexes
-- 3. Adds data integrity constraints
-- 4. Ensures RLS policies are in place
-- 5. Verifies triggers exist
-- 6. Adds helper functions for MVP features
-- 7. Grants necessary permissions



