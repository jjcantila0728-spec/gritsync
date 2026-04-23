-- Migration: Temporary Signatures Table for Cross-Device Signature Detection
-- This table stores signatures temporarily to enable cross-device communication

CREATE TABLE IF NOT EXISTS temporary_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Session Information
  session_id TEXT NOT NULL,
  application_id TEXT,
  document_name TEXT,
  
  -- Signature Data
  signature_data_url TEXT NOT NULL, -- Base64 encoded signature image
  
  -- Status
  is_consumed BOOLEAN DEFAULT FALSE, -- Whether the signature has been retrieved
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consumed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'), -- Auto-expire after 1 hour
  
  -- Indexes for performance
  CONSTRAINT unique_session UNIQUE(session_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_temporary_signatures_session_id ON temporary_signatures(session_id);
CREATE INDEX IF NOT EXISTS idx_temporary_signatures_application_id ON temporary_signatures(application_id);
CREATE INDEX IF NOT EXISTS idx_temporary_signatures_is_consumed ON temporary_signatures(is_consumed);
CREATE INDEX IF NOT EXISTS idx_temporary_signatures_expires_at ON temporary_signatures(expires_at);

-- Enable RLS
ALTER TABLE temporary_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow anyone to insert (for phone signatures)
CREATE POLICY "Allow insert for temporary signatures"
  ON temporary_signatures
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow anyone to read unconsumed signatures by session_id
CREATE POLICY "Allow read unconsumed signatures by session"
  ON temporary_signatures
  FOR SELECT
  TO authenticated, anon
  USING (is_consumed = false AND expires_at > NOW());

-- Allow update to mark as consumed
CREATE POLICY "Allow update to mark consumed"
  ON temporary_signatures
  FOR UPDATE
  TO authenticated, anon
  USING (is_consumed = false)
  WITH CHECK (is_consumed = true);

-- Function to clean up expired signatures (runs automatically)
CREATE OR REPLACE FUNCTION cleanup_expired_signatures()
RETURNS void AS $$
BEGIN
  DELETE FROM temporary_signatures
  WHERE expires_at < NOW() OR (is_consumed = true AND consumed_at < NOW() - INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql;

-- Create a trigger or scheduled job to clean up (you may want to set up a cron job for this)
-- For now, we'll rely on the expires_at check in queries

