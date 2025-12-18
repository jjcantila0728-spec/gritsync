-- =====================================================
-- GritSync Payment System - Complete Database Schema
-- Run this in your Supabase SQL Editor to set up all
-- required tables for the payment system
-- =====================================================

-- 1. APPLICATIONS TABLE
-- Stores NCLEX and other application records
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  application_type VARCHAR(50) NOT NULL DEFAULT 'nclex',
  applicant_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  service_type VARCHAR(100) NOT NULL,
  service_state VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected', 'completed', 'cancelled')),
  total_amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. APPLICATION PAYMENTS TABLE
-- Tracks payments for applications (installments, full payments)
CREATE TABLE IF NOT EXISTS application_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) CHECK (payment_type IN ('full', 'step1', 'step2', 'retake', 'additional')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'pending_approval', 'paid', 'completed', 'failed', 'cancelled', 'refunded')),
  stripe_payment_intent_id VARCHAR(255),
  stripe_payment_method_id VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'stripe',
  transaction_id VARCHAR(255),
  proof_of_payment_file_path TEXT,
  gcash_reference_number VARCHAR(100),
  gcash_account_name VARCHAR(255),
  gcash_receipt_url TEXT,
  usd_to_php_rate DECIMAL(8, 4),
  admin_note TEXT,
  details JSONB DEFAULT '{}',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PAYMENT RECEIPTS TABLE
-- Stores generated payment receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES application_payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50),
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PAYMENT ATTEMPTS TABLE
-- Tracks payment attempt history for analytics/debugging
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES application_payments(id) ON DELETE CASCADE,
  channel VARCHAR(50),
  status VARCHAR(30),
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DONATIONS TABLE
-- Stores donation records
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name VARCHAR(255),
  donor_email VARCHAR(255),
  donor_phone VARCHAR(50),
  is_anonymous BOOLEAN DEFAULT false,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  message TEXT,
  sponsorship_id UUID,
  stripe_payment_intent_id VARCHAR(255),
  stripe_payment_method_id VARCHAR(255),
  payment_method VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SPONSORSHIPS TABLE
-- Stores sponsorship campaigns for donations
CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(10, 2),
  current_amount DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for donations -> sponsorships after table exists
ALTER TABLE donations 
ADD CONSTRAINT fk_donations_sponsorship 
FOREIGN KEY (sponsorship_id) REFERENCES sponsorships(id) ON DELETE SET NULL;

-- 7. SERVICES TABLE (Quote Service Config)
-- Stores service pricing information
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  state VARCHAR(100),
  payment_type VARCHAR(50),
  description TEXT,
  line_items JSONB DEFAULT '[]',
  total_amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. EXCHANGE RATES TABLE
-- Caches currency exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate DECIMAL(12, 6) NOT NULL,
  source VARCHAR(100),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Create admin check function if not exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (SELECT raw_user_meta_data->>'role' = 'admin' 
       FROM auth.users 
       WHERE id = auth.uid()),
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- APPLICATIONS POLICIES
CREATE POLICY "Users can view own applications" ON applications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can create applications" ON applications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own applications" ON applications
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can delete applications" ON applications
  FOR DELETE USING (public.is_admin());

-- APPLICATION PAYMENTS POLICIES
CREATE POLICY "Users can view own payments" ON application_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM applications 
      WHERE applications.id = application_payments.application_id 
      AND (applications.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can create payments" ON application_payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own payments" ON application_payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM applications 
      WHERE applications.id = application_payments.application_id 
      AND (applications.user_id = auth.uid() OR public.is_admin())
    )
  );

-- PAYMENT RECEIPTS POLICIES
CREATE POLICY "Users can view own receipts" ON payment_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM application_payments ap
      JOIN applications a ON a.id = ap.application_id
      WHERE ap.id = payment_receipts.payment_id 
      AND (a.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "System can create receipts" ON payment_receipts
  FOR INSERT WITH CHECK (true);

-- PAYMENT ATTEMPTS POLICIES (Admin only)
CREATE POLICY "Admins can view payment attempts" ON payment_attempts
  FOR SELECT USING (public.is_admin());

CREATE POLICY "System can create payment attempts" ON payment_attempts
  FOR INSERT WITH CHECK (true);

-- DONATIONS POLICIES
CREATE POLICY "Anyone can create donations" ON donations
  FOR INSERT WITH CHECK (status = 'pending');

CREATE POLICY "Donors can view own donations" ON donations
  FOR SELECT USING (donor_email = auth.jwt()->>'email' OR public.is_admin());

CREATE POLICY "System can update donations" ON donations
  FOR UPDATE USING (true);

CREATE POLICY "Admins can manage donations" ON donations
  FOR ALL USING (public.is_admin());

-- SPONSORSHIPS POLICIES
CREATE POLICY "Anyone can view active sponsorships" ON sponsorships
  FOR SELECT USING (status = 'active' OR public.is_admin());

CREATE POLICY "Admins can manage sponsorships" ON sponsorships
  FOR ALL USING (public.is_admin());

-- SERVICES POLICIES
CREATE POLICY "Anyone can view active services" ON services
  FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can manage services" ON services
  FOR ALL USING (public.is_admin());

-- EXCHANGE RATES POLICIES
CREATE POLICY "Anyone can view exchange rates" ON exchange_rates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exchange rates" ON exchange_rates
  FOR ALL USING (public.is_admin());

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_application_payments_application_id ON application_payments(application_id);
CREATE INDEX IF NOT EXISTS idx_application_payments_status ON application_payments(status);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id ON payment_receipts(payment_id);

-- =====================================================
-- EDGE FUNCTION SECRETS REQUIRED (set in Supabase Dashboard)
-- =====================================================
-- 
-- STRIPE_SECRET_KEY          - Your Stripe secret key (sk_live_xxx or sk_test_xxx)
-- STRIPE_PUBLISHABLE_KEY     - Your Stripe publishable key (pk_live_xxx or pk_test_xxx)  
-- STRIPE_WEBHOOK_SECRET      - Webhook signing secret (whsec_xxx)
-- SUPABASE_SERVICE_ROLE_KEY  - Supabase service role key for admin operations
-- SUPABASE_URL               - Your Supabase project URL
--
-- =====================================================
