-- Migration: Add Email Queue Table for Scheduled Emails
-- This table stores emails that need to be sent at a future date/time

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

-- Function to get pending emails ready to send
CREATE OR REPLACE FUNCTION get_pending_emails_to_send(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_user_id UUID,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  sender_email TEXT,
  sender_name TEXT,
  from_email_address_id UUID,
  email_type TEXT,
  email_category TEXT,
  priority INTEGER,
  application_id UUID,
  quotation_id UUID,
  donation_id UUID,
  sponsorship_id UUID,
  metadata JSONB,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.recipient_email,
    eq.recipient_name,
    eq.recipient_user_id,
    eq.subject,
    eq.body_html,
    eq.body_text,
    eq.sender_email,
    eq.sender_name,
    eq.from_email_address_id,
    eq.email_type,
    eq.email_category,
    eq.priority,
    eq.application_id,
    eq.quotation_id,
    eq.donation_id,
    eq.sponsorship_id,
    eq.metadata,
    eq.tags
  FROM email_queue eq
  WHERE eq.status = 'pending'
    AND eq.scheduled_for <= NOW()
    AND (eq.cancelled_at IS NULL)
  ORDER BY eq.priority ASC, eq.scheduled_for ASC
  LIMIT limit_count
  FOR UPDATE SKIP LOCKED; -- Prevent multiple workers from processing same email
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as processing
CREATE OR REPLACE FUNCTION mark_email_processing(queue_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_queue
  SET 
    status = 'processing',
    updated_at = NOW()
  WHERE id = queue_id
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as sent
CREATE OR REPLACE FUNCTION mark_email_sent(
  queue_id UUID,
  provider_message_id TEXT DEFAULT NULL,
  provider_response JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE email_queue
  SET 
    status = 'sent',
    sent_at = NOW(),
    provider_message_id = mark_email_sent.provider_message_id,
    provider_response = mark_email_sent.provider_response,
    updated_at = NOW()
  WHERE id = queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as failed with retry logic
CREATE OR REPLACE FUNCTION mark_email_failed(
  queue_id UUID,
  error_message TEXT,
  provider_response JSONB DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_retry_count INTEGER;
  max_retries_count INTEGER;
  next_retry_time TIMESTAMPTZ;
BEGIN
  -- Get current retry count and max retries
  SELECT retry_count, max_retries INTO current_retry_count, max_retries_count
  FROM email_queue
  WHERE id = queue_id;
  
  -- Increment retry count
  current_retry_count := current_retry_count + 1;
  
  -- Calculate next retry time (exponential backoff: 1min, 5min, 15min)
  IF current_retry_count = 1 THEN
    next_retry_time := NOW() + INTERVAL '1 minute';
  ELSIF current_retry_count = 2 THEN
    next_retry_time := NOW() + INTERVAL '5 minutes';
  ELSIF current_retry_count = 3 THEN
    next_retry_time := NOW() + INTERVAL '15 minutes';
  ELSE
    next_retry_time := NOW() + INTERVAL '1 hour';
  END IF;
  
  -- Update email queue
  IF current_retry_count >= max_retries_count THEN
    -- Max retries reached, mark as permanently failed
    UPDATE email_queue
    SET 
      status = 'failed',
      failed_at = NOW(),
      error_message = mark_email_failed.error_message,
      provider_response = mark_email_failed.provider_response,
      retry_count = current_retry_count,
      last_retry_at = NOW(),
      updated_at = NOW()
    WHERE id = queue_id;
  ELSE
    -- Schedule retry
    UPDATE email_queue
    SET 
      status = 'pending', -- Reset to pending for retry
      error_message = mark_email_failed.error_message,
      provider_response = mark_email_failed.provider_response,
      retry_count = current_retry_count,
      last_retry_at = NOW(),
      next_retry_at = next_retry_time,
      scheduled_for = next_retry_time, -- Update scheduled_for for retry
      updated_at = NOW()
    WHERE id = queue_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE email_queue IS 'Queue for scheduled and deferred email sending';
COMMENT ON COLUMN email_queue.scheduled_for IS 'When the email should be sent';
COMMENT ON COLUMN email_queue.priority IS 'Priority level: 1 (highest) to 10 (lowest)';
COMMENT ON COLUMN email_queue.status IS 'Current status: pending, processing, sent, failed, cancelled';
COMMENT ON COLUMN email_queue.next_retry_at IS 'When to retry if failed (exponential backoff)';



