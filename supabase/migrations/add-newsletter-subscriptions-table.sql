-- Newsletter Subscriptions Table
-- This table stores email subscriptions for visa bulletin updates
-- Note: Public users can subscribe without authentication

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  subscription_type VARCHAR(50) NOT NULL DEFAULT 'visa_bulletin' CHECK (subscription_type IN ('visa_bulletin', 'general', 'all')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_email ON newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_active ON newsletter_subscriptions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_type ON newsletter_subscriptions(subscription_type);

-- Enable RLS
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anonymous users can subscribe (insert only, with restricted columns)
-- Forces is_active = true and prevents manipulation of other fields
CREATE POLICY "newsletter_insert_anon"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (
    is_active = true AND 
    unsubscribed_at IS NULL
  );

-- Service role has full access (for bulk email sending and management)
CREATE POLICY "newsletter_service_role_all"
  ON newsletter_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view and manage all subscriptions
CREATE POLICY "newsletter_select_admin"
  ON newsletter_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "newsletter_update_admin"
  ON newsletter_subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "newsletter_delete_admin"
  ON newsletter_subscriptions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Grant permissions
GRANT INSERT ON newsletter_subscriptions TO anon;
GRANT SELECT, UPDATE, DELETE ON newsletter_subscriptions TO authenticated;
GRANT ALL ON newsletter_subscriptions TO service_role;

-- Visa Bulletin Cache Table
-- Stores cached visa bulletin data to detect changes

CREATE TABLE IF NOT EXISTS visa_bulletin_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_month VARCHAR(20) NOT NULL,
  bulletin_year INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'EB3',
  country VARCHAR(100) NOT NULL DEFAULT 'Philippines',
  final_action_date DATE,
  dates_for_filing DATE,
  source VARCHAR(255),
  raw_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bulletin_month, bulletin_year, category, country)
);

-- Enable RLS
ALTER TABLE visa_bulletin_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read visa bulletin data (public information)
CREATE POLICY "visa_bulletin_select_public"
  ON visa_bulletin_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role can insert/update bulletin data (from backend jobs)
CREATE POLICY "visa_bulletin_manage_service"
  ON visa_bulletin_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can also manage bulletin cache
CREATE POLICY "visa_bulletin_manage_admin"
  ON visa_bulletin_cache
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Grant permissions
GRANT SELECT ON visa_bulletin_cache TO anon, authenticated;
GRANT ALL ON visa_bulletin_cache TO service_role;

-- Function to update timestamp on modification
CREATE OR REPLACE FUNCTION update_newsletter_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS newsletter_subscriptions_updated_at ON newsletter_subscriptions;
CREATE TRIGGER newsletter_subscriptions_updated_at
  BEFORE UPDATE ON newsletter_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_subscriptions_updated_at();

-- Email Send Log for Visa Bulletin (tracks which emails were sent)
CREATE TABLE IF NOT EXISTS visa_bulletin_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_month VARCHAR(20) NOT NULL,
  bulletin_year INTEGER NOT NULL,
  subscriber_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  UNIQUE(bulletin_month, bulletin_year, subscriber_email)
);

-- Enable RLS
ALTER TABLE visa_bulletin_email_log ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access email logs
CREATE POLICY "email_log_select_admin"
  ON visa_bulletin_email_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "email_log_manage_service"
  ON visa_bulletin_email_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON visa_bulletin_email_log TO authenticated;
GRANT ALL ON visa_bulletin_email_log TO service_role;

COMMENT ON TABLE newsletter_subscriptions IS 'Stores email subscriptions for visa bulletin and other newsletters';
COMMENT ON TABLE visa_bulletin_cache IS 'Caches visa bulletin data to detect changes and trigger notifications';
COMMENT ON TABLE visa_bulletin_email_log IS 'Tracks visa bulletin notification emails sent to subscribers';

-- Seed initial visa bulletin data for Philippines EB3
INSERT INTO visa_bulletin_cache (bulletin_month, bulletin_year, category, country, final_action_date, dates_for_filing, source, fetched_at)
VALUES 
  ('December', 2025, 'EB3', 'Philippines', '2018-01-01', '2019-01-01', 'U.S. Department of State', NOW()),
  ('November', 2025, 'EB3', 'Philippines', '2017-12-01', '2019-01-01', 'U.S. Department of State', NOW()),
  ('October', 2025, 'EB3', 'Philippines', '2017-11-01', '2018-12-01', 'U.S. Department of State', NOW()),
  ('September', 2025, 'EB3', 'Philippines', '2017-10-01', '2018-11-01', 'U.S. Department of State', NOW()),
  ('August', 2025, 'EB3', 'Philippines', '2017-09-01', '2018-10-01', 'U.S. Department of State', NOW()),
  ('July', 2025, 'EB3', 'Philippines', '2017-08-01', '2018-09-01', 'U.S. Department of State', NOW())
ON CONFLICT (bulletin_month, bulletin_year, category, country) DO NOTHING;
