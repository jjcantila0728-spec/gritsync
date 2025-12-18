-- Combined Migration: Email Logs + Email Queue + Test Data
-- Deploy this to get both Analytics and Scheduled tabs working

-- ============================================
-- PART 1: EMAIL QUEUE TABLE (for Scheduled tab)
-- ============================================

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  sender_email TEXT,
  sender_name TEXT,
  from_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  
  -- Email metadata
  email_type TEXT DEFAULT 'manual' CHECK (email_type IN ('transactional', 'notification', 'marketing', 'manual', 'automated')),
  email_category TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1 = highest, 10 = lowest
  
  -- Related entities
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
  sponsorship_id UUID REFERENCES nclex_sponsorships(id) ON DELETE SET NULL,
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  error_message TEXT,
  provider_message_id TEXT,
  provider_response JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  
  -- Audit
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_for ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient ON email_queue(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_user ON email_queue(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_by ON email_queue(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry ON email_queue(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_application ON email_queue(application_id) WHERE application_id IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS email_queue_updated_at_trigger ON email_queue;
CREATE TRIGGER email_queue_updated_at_trigger
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can view all email queue" ON email_queue;
DROP POLICY IF EXISTS "Users can view their own email queue" ON email_queue;
DROP POLICY IF EXISTS "Admins can insert email queue" ON email_queue;
DROP POLICY IF EXISTS "Admins can update email queue" ON email_queue;
DROP POLICY IF EXISTS "Admins can delete email queue" ON email_queue;

-- Admins can see all queued emails
CREATE POLICY "Admins can view all email queue"
  ON email_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can see their own queued emails
CREATE POLICY "Users can view their own email queue"
  ON email_queue FOR SELECT
  USING (
    recipient_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
  );

-- Admins can insert emails into queue
CREATE POLICY "Admins can insert email queue"
  ON email_queue FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can update email queue
CREATE POLICY "Admins can update email queue"
  ON email_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can delete email queue
CREATE POLICY "Admins can delete email queue"
  ON email_queue FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON email_queue TO authenticated;
GRANT ALL ON email_queue TO service_role;

-- ============================================
-- PART 2: ADD SAMPLE DATA FOR TESTING
-- ============================================

-- Insert sample email logs for Analytics tab (past 7 days)
INSERT INTO email_logs (
  recipient_email,
  recipient_name,
  subject,
  body_html,
  sender_email,
  sender_name,
  email_type,
  email_category,
  status,
  created_at,
  sent_at,
  delivered_at
)
SELECT
  'test' || i || '@example.com',
  'Test User ' || i,
  'Test Email ' || i,
  '<p>This is a test email for analytics</p>',
  'noreply@gritsync.com',
  'GritSync',
  CASE (i % 3)
    WHEN 0 THEN 'transactional'
    WHEN 1 THEN 'notification'
    ELSE 'manual'
  END,
  CASE (i % 4)
    WHEN 0 THEN 'welcome'
    WHEN 1 THEN 'payment_receipt'
    WHEN 2 THEN 'timeline_update'
    ELSE 'general'
  END,
  CASE (i % 10)
    WHEN 0 THEN 'failed'
    WHEN 1 THEN 'bounced'
    ELSE 'delivered'
  END,
  NOW() - (i || ' days')::INTERVAL,
  NOW() - (i || ' days')::INTERVAL + INTERVAL '1 minute',
  NOW() - (i || ' days')::INTERVAL + INTERVAL '2 minutes'
FROM generate_series(0, 30) AS i;

-- Insert sample scheduled emails for Scheduled tab
INSERT INTO email_queue (
  recipient_email,
  recipient_name,
  subject,
  body_html,
  body_text,
  sender_email,
  sender_name,
  scheduled_for,
  status,
  email_type,
  email_category,
  priority
)
VALUES
  (
    'future@example.com',
    'Future Recipient',
    'Welcome to GritSync - Scheduled',
    '<h1>Welcome!</h1><p>This email is scheduled to be sent tomorrow.</p>',
    'Welcome! This email is scheduled to be sent tomorrow.',
    'noreply@gritsync.com',
    'GritSync',
    NOW() + INTERVAL '1 day',
    'pending',
    'transactional',
    'welcome',
    5
  ),
  (
    'reminder@example.com',
    'Reminder User',
    'Document Reminder - Scheduled',
    '<p>Don''t forget to submit your documents!</p>',
    'Don''t forget to submit your documents!',
    'noreply@gritsync.com',
    'GritSync',
    NOW() + INTERVAL '2 days',
    'pending',
    'notification',
    'document_reminder',
    3
  ),
  (
    'newsletter@example.com',
    'Newsletter Subscriber',
    'Monthly Newsletter - Scheduled',
    '<h2>GritSync Monthly Update</h2><p>Here''s what''s new this month...</p>',
    'GritSync Monthly Update - Here''s what''s new this month...',
    'newsletter@gritsync.com',
    'GritSync Newsletter',
    NOW() + INTERVAL '7 days',
    'pending',
    'marketing',
    'general',
    7
  );

-- Refresh the materialized view to include sample data
-- Note: First refresh cannot be CONCURRENTLY, do it normally first time
REFRESH MATERIALIZED VIEW email_analytics;

-- ============================================
-- VERIFICATION QUERIES (run these to confirm)
-- ============================================

-- Check email_logs count
SELECT COUNT(*) as email_logs_count FROM email_logs;

-- Check email_queue count
SELECT COUNT(*) as email_queue_count FROM email_queue;

-- Check analytics view
SELECT * FROM email_analytics ORDER BY date DESC LIMIT 10;

-- Show sample queued emails
SELECT 
  subject,
  recipient_email,
  scheduled_for,
  status,
  email_type
FROM email_queue
ORDER BY scheduled_for
LIMIT 5;

COMMENT ON TABLE email_queue IS 'Queue for scheduled and deferred email sending';
COMMENT ON COLUMN email_queue.scheduled_for IS 'When the email should be sent';
COMMENT ON COLUMN email_queue.priority IS 'Priority level: 1 (highest) to 10 (lowest)';

