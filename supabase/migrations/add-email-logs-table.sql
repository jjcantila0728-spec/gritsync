-- Migration: Add Email Logs table for enterprise-grade email tracking
-- This table stores all outgoing emails for auditing, analytics, and management

-- Email Logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Email Details
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  
  -- Sender Information
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Email Type & Category
  email_type TEXT NOT NULL CHECK (email_type IN (
    'transactional',      -- System-triggered emails
    'notification',       -- Notification emails
    'marketing',          -- Marketing/promotional
    'manual',            -- Manually sent by admin
    'automated'          -- Automated campaigns
  )),
  email_category TEXT CHECK (email_category IN (
    'welcome',
    'password_reset',
    'payment_receipt',
    'timeline_update',
    'status_change',
    'document_reminder',
    'profile_reminder',
    'school_letter',
    'general',
    'custom'
  )),
  
  -- Delivery Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'failed',
    'bounced',
    'complained'
  )),
  
  -- Provider Information
  email_provider TEXT,
  provider_message_id TEXT,
  provider_response JSONB,
  
  -- Error Tracking
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Associated Records (for tracking context)
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
  sponsorship_id UUID REFERENCES nclex_sponsorships(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT valid_email_format CHECK (recipient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_user_id ON email_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by_user_id ON email_logs(sent_by_user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_category ON email_logs(email_category);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON email_logs(provider_message_id);

-- Create a GIN index for JSONB metadata searching
CREATE INDEX IF NOT EXISTS idx_email_logs_metadata ON email_logs USING GIN (metadata);

-- Create a GIN index for array tags
CREATE INDEX IF NOT EXISTS idx_email_logs_tags ON email_logs USING GIN (tags);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view all email logs" ON email_logs;
DROP POLICY IF EXISTS "Admins can create email logs" ON email_logs;
DROP POLICY IF EXISTS "Admins can update email logs" ON email_logs;
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;
DROP POLICY IF EXISTS "Service role can manage email logs" ON email_logs;

-- Admins can view all email logs
CREATE POLICY "Admins can view all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can create email logs (system can also create)
CREATE POLICY "Admins can create email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can update email logs (for status updates)
CREATE POLICY "Admins can update email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

-- Allow service role (edge functions) to insert/update email logs
CREATE POLICY "Service role can manage email logs"
  ON email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS email_logs_updated_at_trigger ON email_logs;
CREATE TRIGGER email_logs_updated_at_trigger
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();

-- Create a materialized view for email analytics (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS email_analytics AS
SELECT 
  DATE(created_at) as date,
  email_type,
  email_category,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'bounced') as bounced_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - created_at)))) as avg_send_time_seconds
FROM email_logs
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), email_type, email_category, status;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_email_analytics_date ON email_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_email_analytics_type ON email_analytics(email_type);

-- Function to refresh email analytics (should be called periodically)
CREATE OR REPLACE FUNCTION refresh_email_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY email_analytics;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON email_logs TO authenticated;
GRANT SELECT ON email_analytics TO authenticated;
GRANT ALL ON email_logs TO service_role;

-- Add comment for documentation
COMMENT ON TABLE email_logs IS 'Stores all outgoing emails for auditing, tracking, and analytics purposes';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email: transactional, notification, marketing, manual, automated';
COMMENT ON COLUMN email_logs.email_category IS 'Category/purpose of the email';
COMMENT ON COLUMN email_logs.status IS 'Current delivery status of the email';
COMMENT ON COLUMN email_logs.metadata IS 'Additional metadata as JSON for flexibility';
COMMENT ON COLUMN email_logs.tags IS 'Array of tags for categorization and filtering';

