-- Migration: Add Email Campaigns & Newsletters System
-- This system enables bulk email sending, newsletters, and subscriber management

-- Create email_subscribers table
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  
  -- Subscription status
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  
  -- Preferences
  email_preferences JSONB DEFAULT '{}'::jsonb, -- Which types of emails they want
  tags TEXT[] DEFAULT '{}', -- Tags for segmentation
  
  -- Metadata
  source TEXT, -- How they subscribed (website, import, manual, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_email_sent_at TIMESTAMPTZ,
  email_count INTEGER DEFAULT 0
);

-- Create email_campaigns table
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Campaign type
  campaign_type TEXT NOT NULL DEFAULT 'newsletter' CHECK (campaign_type IN ('newsletter', 'broadcast', 'announcement', 'promotional', 'transactional')),
  
  -- Recipients
  recipient_type TEXT NOT NULL DEFAULT 'subscribers' CHECK (recipient_type IN ('subscribers', 'users', 'custom', 'segment')),
  recipient_segment JSONB DEFAULT '{}'::jsonb, -- Segment criteria (tags, status, etc.)
  recipient_list TEXT[], -- Custom email list
  recipient_count INTEGER DEFAULT 0,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed')),
  
  -- Sending configuration
  send_rate INTEGER DEFAULT 100, -- Emails per hour
  from_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  reply_to TEXT,
  
  -- Tracking
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Analytics
  open_rate NUMERIC(5, 2) DEFAULT 0,
  click_rate NUMERIC(5, 2) DEFAULT 0,
  bounce_rate NUMERIC(5, 2) DEFAULT 0,
  
  -- Metadata
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create email_campaign_recipients table (tracks individual sends)
CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES email_subscribers(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Send status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  
  -- Tracking
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  click_links JSONB DEFAULT '{}'::jsonb, -- Track which links were clicked
  
  -- Error tracking
  error_message TEXT,
  provider_message_id TEXT,
  provider_response JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_tags ON email_subscribers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON email_campaigns(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON email_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_subscriber ON email_campaign_recipients(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON email_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email ON email_campaign_recipients(recipient_email);

-- Create updated_at trigger functions
CREATE OR REPLACE FUNCTION update_email_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_email_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS email_subscribers_updated_at_trigger ON email_subscribers;
CREATE TRIGGER email_subscribers_updated_at_trigger
  BEFORE UPDATE ON email_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_email_subscribers_updated_at();

DROP TRIGGER IF EXISTS email_campaigns_updated_at_trigger ON email_campaigns;
CREATE TRIGGER email_campaigns_updated_at_trigger
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_email_campaigns_updated_at();

-- Enable RLS
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_subscribers
CREATE POLICY "Admins can manage subscribers"
  ON email_subscribers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own subscription"
  ON email_subscribers FOR SELECT
  USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- RLS Policies for email_campaigns
CREATE POLICY "Admins can manage campaigns"
  ON email_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for email_campaign_recipients
CREATE POLICY "Admins can view campaign recipients"
  ON email_campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage campaign recipients"
  ON email_campaign_recipients FOR ALL
  USING (true); -- Service role bypasses RLS

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON email_subscribers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON email_subscribers TO anon; -- For public subscription
GRANT SELECT, INSERT, UPDATE, DELETE ON email_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_campaign_recipients TO authenticated;
GRANT ALL ON email_subscribers TO service_role;
GRANT ALL ON email_campaigns TO service_role;
GRANT ALL ON email_campaign_recipients TO service_role;

-- Function to get subscriber count by segment
CREATE OR REPLACE FUNCTION get_subscriber_count_by_segment(
  p_tags TEXT[] DEFAULT NULL,
  p_status TEXT DEFAULT 'subscribed'
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM email_subscribers
  WHERE status = p_status
    AND (p_tags IS NULL OR tags && p_tags);
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update campaign statistics
CREATE OR REPLACE FUNCTION update_campaign_stats(p_campaign_id UUID)
RETURNS void AS $$
DECLARE
  v_sent INTEGER;
  v_delivered INTEGER;
  v_opened INTEGER;
  v_clicked INTEGER;
  v_bounced INTEGER;
  v_unsubscribed INTEGER;
  v_failed INTEGER;
  v_open_rate NUMERIC;
  v_click_rate NUMERIC;
  v_bounce_rate NUMERIC;
BEGIN
  -- Get counts
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked')),
    COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked')),
    COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')),
    COUNT(*) FILTER (WHERE status = 'clicked'),
    COUNT(*) FILTER (WHERE status = 'bounced'),
    COUNT(*) FILTER (WHERE status = 'unsubscribed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_sent, v_delivered, v_opened, v_clicked, v_bounced, v_unsubscribed, v_failed
  FROM email_campaign_recipients
  WHERE campaign_id = p_campaign_id;
  
  -- Calculate rates
  v_open_rate := CASE WHEN v_delivered > 0 THEN (v_opened::NUMERIC / v_delivered::NUMERIC * 100) ELSE 0 END;
  v_click_rate := CASE WHEN v_delivered > 0 THEN (v_clicked::NUMERIC / v_delivered::NUMERIC * 100) ELSE 0 END;
  v_bounce_rate := CASE WHEN v_sent > 0 THEN (v_bounced::NUMERIC / v_sent::NUMERIC * 100) ELSE 0 END;
  
  -- Update campaign
  UPDATE email_campaigns
  SET 
    sent_count = v_sent,
    delivered_count = v_delivered,
    opened_count = v_opened,
    clicked_count = v_clicked,
    bounced_count = v_bounced,
    unsubscribed_count = v_unsubscribed,
    failed_count = v_failed,
    open_rate = v_open_rate,
    click_rate = v_click_rate,
    bounce_rate = v_bounce_rate,
    updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscribers for a segment
CREATE OR REPLACE FUNCTION get_subscribers_for_segment(
  p_tags TEXT[] DEFAULT NULL,
  p_status TEXT DEFAULT 'subscribed',
  p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.email,
    s.first_name,
    s.last_name,
    s.phone_number,
    s.tags
  FROM email_subscribers s
  WHERE s.status = p_status
    AND (p_tags IS NULL OR s.tags && p_tags)
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE email_subscribers IS 'Email newsletter subscribers and mailing list';
COMMENT ON TABLE email_campaigns IS 'Email campaigns and newsletters';
COMMENT ON TABLE email_campaign_recipients IS 'Individual email sends for campaigns (for tracking)';
COMMENT ON COLUMN email_subscribers.status IS 'Subscription status: subscribed, unsubscribed, bounced, complained';
COMMENT ON COLUMN email_campaigns.recipient_type IS 'Type of recipients: subscribers, users, custom list, or segment';
COMMENT ON COLUMN email_campaigns.send_rate IS 'Maximum emails to send per hour (rate limiting)';



