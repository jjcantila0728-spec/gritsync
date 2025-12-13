-- Create table for storing received emails
-- Since Resend API doesn't support retrieving full email content after initial receipt,
-- we store emails in our database via webhook

CREATE TABLE IF NOT EXISTS received_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id TEXT UNIQUE NOT NULL, -- Resend email ID
  
  -- Email headers
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  cc TEXT[], -- Array of CC recipients
  bcc TEXT[], -- Array of BCC recipients
  reply_to TEXT[],
  
  -- Email content
  subject TEXT,
  html_body TEXT,
  text_body TEXT,
  
  -- Metadata
  message_id TEXT,
  headers JSONB,
  
  -- Attachments (stored as JSONB array)
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Status and timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- For associating with users (if to_email is a gritsync email)
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_received_emails_resend_id ON received_emails(resend_id);
CREATE INDEX IF NOT EXISTS idx_received_emails_to_email ON received_emails(to_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_from_email ON received_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_received_emails_recipient_user_id ON received_emails(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_received_emails_received_at ON received_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_received_emails_is_deleted ON received_emails(is_deleted) WHERE is_deleted = FALSE;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_received_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_received_emails_updated_at
  BEFORE UPDATE ON received_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_received_emails_updated_at();

-- RLS Policies
ALTER TABLE received_emails ENABLE ROW LEVEL SECURITY;

-- Admins can see all received emails
CREATE POLICY "Admins can view all received emails"
  ON received_emails
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Clients can only see their own emails
CREATE POLICY "Clients can view their own received emails"
  ON received_emails
  FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR to_email IN (
      SELECT email_address FROM email_addresses
      WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (for webhook)
CREATE POLICY "Service role can insert received emails"
  ON received_emails
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Users can update their own emails (mark as read, delete)
CREATE POLICY "Users can update their own received emails"
  ON received_emails
  FOR UPDATE
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR to_email IN (
      SELECT email_address FROM email_addresses
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    OR to_email IN (
      SELECT email_address FROM email_addresses
      WHERE user_id = auth.uid()
    )
  );

-- Function to associate received email with user
CREATE OR REPLACE FUNCTION associate_received_email_with_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email_address_record RECORD;
BEGIN
  -- Try to find matching email address in our system
  SELECT id, user_id INTO v_email_address_record
  FROM email_addresses
  WHERE email_address = LOWER(NEW.to_email)
  AND is_active = TRUE
  LIMIT 1;
  
  IF FOUND THEN
    NEW.recipient_email_address_id = v_email_address_record.id;
    NEW.recipient_user_id = v_email_address_record.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER associate_received_email_with_user_trigger
  BEFORE INSERT ON received_emails
  FOR EACH ROW
  EXECUTE FUNCTION associate_received_email_with_user();

-- Comments
COMMENT ON TABLE received_emails IS 'Stores received emails from Resend webhook since API does not support retrieving full content';
COMMENT ON COLUMN received_emails.resend_id IS 'Resend email ID for reference';
COMMENT ON COLUMN received_emails.is_deleted IS 'Soft delete flag - hides email from view';

