-- =====================================================
-- GritSync - Complete Database Schema
-- Run this in your Supabase SQL Editor to set up all
-- required tables for the application
-- =====================================================

-- =====================================================
-- PART 1: CORE FUNCTIONS
-- =====================================================

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin',
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 2: SETTINGS & CONFIGURATION
-- =====================================================

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 3: EMAIL SYSTEM TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS email_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  address_type VARCHAR(50) DEFAULT 'business',
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  can_send BOOLEAN DEFAULT true,
  can_receive BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_type VARCHAR(50) DEFAULT 'notification',
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  sender_email VARCHAR(255),
  sender_name VARCHAR(255),
  sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type VARCHAR(50) DEFAULT 'transactional',
  email_category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  email_provider VARCHAR(50),
  application_id UUID,
  quotation_id UUID,
  donation_id UUID,
  sponsorship_id UUID,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  from_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  to_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  error_code VARCHAR(50),
  provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 4: NEWSLETTER & VISA BULLETIN
-- =====================================================

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  subscription_type VARCHAR(50) DEFAULT 'newsletter',
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visa_bulletin_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_month VARCHAR(20) NOT NULL,
  bulletin_year INTEGER NOT NULL,
  eb3_philippines_final_action VARCHAR(50),
  eb3_philippines_dates_for_filing VARCHAR(50),
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bulletin_month, bulletin_year)
);

CREATE TABLE IF NOT EXISTS visa_bulletin_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  bulletin_month VARCHAR(20) NOT NULL,
  bulletin_year INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, bulletin_month, bulletin_year)
);

-- =====================================================
-- PART 5: PARTNER AGENCIES & CAREERS
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS careers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  location VARCHAR(255),
  employment_type VARCHAR(50),
  salary_range VARCHAR(100),
  partner_agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 6: TESTIMONIALS
-- =====================================================

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  title VARCHAR(255),
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  photo_url TEXT,
  location VARCHAR(255),
  service_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'featured')),
  is_featured BOOLEAN DEFAULT false,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 7: APPLICATIONS & PAYMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  base_price_usd DECIMAL(10, 2),
  base_price_php DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  to_currency VARCHAR(10) NOT NULL DEFAULT 'PHP',
  rate DECIMAL(10, 4) NOT NULL,
  source VARCHAR(100) DEFAULT 'manual',
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES application_payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50),
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES application_payments(id) ON DELETE CASCADE,
  channel VARCHAR(50),
  status VARCHAR(30),
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 8: DONATIONS & SPONSORSHIPS
-- =====================================================

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name VARCHAR(255),
  donor_email VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'USD',
  message TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_intent_id VARCHAR(255),
  stripe_session_id VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'stripe',
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name VARCHAR(255) NOT NULL,
  sponsor_email VARCHAR(255) NOT NULL,
  sponsor_phone VARCHAR(50),
  company_name VARCHAR(255),
  sponsorship_type VARCHAR(50) CHECK (sponsorship_type IN ('full', 'partial', 'exam_only', 'processing_only')),
  amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  beneficiary_name VARCHAR(255),
  beneficiary_email VARCHAR(255),
  message TEXT,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled')),
  stripe_subscription_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 9: INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_application_payments_application_id ON application_payments(application_id);
CREATE INDEX IF NOT EXISTS idx_application_payments_status ON application_payments(status);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_sponsorships_status ON sponsorships(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_careers_is_active ON careers(is_active);
CREATE INDEX IF NOT EXISTS idx_partner_agencies_is_active ON partner_agencies(is_active);

-- =====================================================
-- PART 10: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_bulletin_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_bulletin_email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;

-- Settings: Public read, admin write
CREATE POLICY "Anyone can read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON settings FOR ALL USING (public.is_admin());

-- Email Addresses: Admin only
CREATE POLICY "Admin can manage email addresses" ON email_addresses FOR ALL USING (public.is_admin());

-- Email Templates: Admin only
CREATE POLICY "Admin can manage email templates" ON email_templates FOR ALL USING (public.is_admin());

-- Email Logs: Admin can view all, users can view their own
CREATE POLICY "Admin can view all email logs" ON email_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can view their own emails" ON email_logs FOR SELECT USING (auth.uid() = recipient_user_id OR auth.uid() = sent_by_user_id);

-- Newsletter: Anonymous can subscribe, admin manages
CREATE POLICY "Anyone can subscribe to newsletter" ON newsletter_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage subscriptions" ON newsletter_subscriptions FOR ALL USING (public.is_admin());

-- Visa Bulletin: Public read, admin write
CREATE POLICY "Anyone can read visa bulletin" ON visa_bulletin_cache FOR SELECT USING (true);
CREATE POLICY "Admin can manage visa bulletin" ON visa_bulletin_cache FOR ALL USING (public.is_admin());
CREATE POLICY "Admin can manage visa bulletin email log" ON visa_bulletin_email_log FOR ALL USING (public.is_admin());

-- Partner Agencies: Public read active, admin manages
CREATE POLICY "Anyone can view active agencies" ON partner_agencies FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage agencies" ON partner_agencies FOR ALL USING (public.is_admin());

-- Careers: Public read active, admin manages
CREATE POLICY "Anyone can view active careers" ON careers FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage careers" ON careers FOR ALL USING (public.is_admin());

-- Testimonials: Public read approved, users can submit, admin manages
CREATE POLICY "Anyone can view approved testimonials" ON testimonials FOR SELECT USING (status IN ('approved', 'featured'));
CREATE POLICY "Anyone can submit testimonials" ON testimonials FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "Admin can manage testimonials" ON testimonials FOR ALL USING (public.is_admin());

-- Services: Public read active, admin manages
CREATE POLICY "Anyone can view active services" ON services FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage services" ON services FOR ALL USING (public.is_admin());

-- Exchange Rates: Public read, admin manages
CREATE POLICY "Anyone can read exchange rates" ON exchange_rates FOR SELECT USING (true);
CREATE POLICY "Admin can manage exchange rates" ON exchange_rates FOR ALL USING (public.is_admin());

-- Applications: Users see own, admin sees all
CREATE POLICY "Users can view own applications" ON applications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can create applications" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can manage applications" ON applications FOR ALL USING (public.is_admin());

-- Application Payments: Users see own, admin sees all
CREATE POLICY "Users can view own payments" ON application_payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM applications WHERE applications.id = application_payments.application_id AND applications.user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admin can manage payments" ON application_payments FOR ALL USING (public.is_admin());

-- Payment Receipts: Users see own, admin sees all
CREATE POLICY "Users can view own receipts" ON payment_receipts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM application_payments ap JOIN applications a ON ap.application_id = a.id WHERE ap.id = payment_receipts.payment_id AND a.user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admin can manage receipts" ON payment_receipts FOR ALL USING (public.is_admin());

-- Payment Attempts: Admin only
CREATE POLICY "Admin can view payment attempts" ON payment_attempts FOR SELECT USING (public.is_admin());

-- Donations: Anonymous can create pending, admin manages
CREATE POLICY "Anyone can create pending donation" ON donations FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "Admin can manage donations" ON donations FOR ALL USING (public.is_admin());
CREATE POLICY "Donors can view completed donations" ON donations FOR SELECT USING (status = 'completed');

-- Sponsorships: Users create, admin manages
CREATE POLICY "Users can create sponsorships" ON sponsorships FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage sponsorships" ON sponsorships FOR ALL USING (public.is_admin());

-- =====================================================
-- PART 11: DEFAULT DATA
-- =====================================================

-- Insert default exchange rate
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, is_active)
VALUES ('USD', 'PHP', 56.00, CURRENT_DATE, true)
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'GritSync database schema created successfully!' as message;
