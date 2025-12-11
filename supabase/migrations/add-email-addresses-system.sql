-- Migration: Email Addresses System
-- Manages multiple email addresses for users and system addresses
-- Supports admin addresses and auto-generated client addresses

-- Email Addresses table
CREATE TABLE IF NOT EXISTS email_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Email Details
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  
  -- Ownership
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_system_address BOOLEAN DEFAULT FALSE,
  
  -- Type and Purpose
  address_type TEXT NOT NULL CHECK (address_type IN (
    'admin',           -- Admin addresses (office@, info@, etc.)
    'client',          -- Client addresses (auto-generated)
    'support',         -- Support addresses
    'noreply',         -- No-reply addresses
    'department'       -- Department addresses
  )),
  
  department TEXT,  -- For department addresses (e.g., 'office', 'info', 'admin')
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,  -- Primary address for user
  
  -- Capabilities
  can_send BOOLEAN DEFAULT TRUE,
  can_receive BOOLEAN DEFAULT TRUE,
  
  -- Forwarding
  forward_to_email TEXT,  -- Forward incoming emails
  auto_reply_enabled BOOLEAN DEFAULT FALSE,
  auto_reply_message TEXT,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_email_format CHECK (email_address ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_addresses_email ON email_addresses(email_address);
CREATE INDEX IF NOT EXISTS idx_email_addresses_user_id ON email_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_email_addresses_type ON email_addresses(address_type);
CREATE INDEX IF NOT EXISTS idx_email_addresses_is_active ON email_addresses(is_active);
CREATE INDEX IF NOT EXISTS idx_email_addresses_department ON email_addresses(department);

-- Create partial unique index to ensure only one primary email per user (excluding NULL user_ids)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_addresses_primary_per_user 
  ON email_addresses(user_id) 
  WHERE is_primary = TRUE AND user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE email_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own email addresses" ON email_addresses;
DROP POLICY IF EXISTS "Admins can view all email addresses" ON email_addresses;
DROP POLICY IF EXISTS "Admins can manage email addresses" ON email_addresses;
DROP POLICY IF EXISTS "System can manage email addresses" ON email_addresses;

-- Users can view their own email addresses
CREATE POLICY "Users can view their own email addresses"
  ON email_addresses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all email addresses
CREATE POLICY "Admins can view all email addresses"
  ON email_addresses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can manage all email addresses
CREATE POLICY "Admins can manage email addresses"
  ON email_addresses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Service role can manage all
CREATE POLICY "System can manage email addresses"
  ON email_addresses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_email_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_addresses_updated_at_trigger ON email_addresses;
CREATE TRIGGER email_addresses_updated_at_trigger
  BEFORE UPDATE ON email_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_email_addresses_updated_at();

-- Function to generate client email address
CREATE OR REPLACE FUNCTION generate_client_email(
  p_first_name TEXT,
  p_middle_name TEXT,
  p_last_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
  v_first_initial TEXT;
  v_middle_initial TEXT;
  v_lastname TEXT;
  v_counter INTEGER := 0;
  v_suffix TEXT := '';
BEGIN
  -- Get first initial (first letter of first name)
  v_first_initial := LOWER(SUBSTRING(p_first_name FROM 1 FOR 1));
  
  -- Get middle initial (first letter of middle name, if provided)
  v_middle_initial := CASE 
    WHEN p_middle_name IS NOT NULL AND LENGTH(p_middle_name) > 0 
    THEN LOWER(SUBSTRING(p_middle_name FROM 1 FOR 1))
    ELSE ''
  END;
  
  -- Get lastname (remove spaces and special characters)
  v_lastname := LOWER(REGEXP_REPLACE(p_last_name, '[^a-zA-Z]', '', 'g'));
  
  -- Generate base email
  v_email := v_first_initial || v_middle_initial || v_lastname || '@gritsync.com';
  
  -- Check if email already exists and add number suffix if needed
  WHILE EXISTS (SELECT 1 FROM email_addresses WHERE email_address = v_email) LOOP
    v_counter := v_counter + 1;
    v_suffix := v_counter::TEXT;
    v_email := v_first_initial || v_middle_initial || v_lastname || v_suffix || '@gritsync.com';
  END LOOP;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Function to create client email address for user
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_email TEXT;
BEGIN
  -- Get user details
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Generate email address
  v_email := generate_client_email(
    v_user.first_name,
    v_user.middle_name,
    v_user.last_name
  );
  
  -- Insert email address
  INSERT INTO email_addresses (
    email_address,
    display_name,
    user_id,
    is_system_address,
    address_type,
    is_active,
    is_verified,
    is_primary,
    can_send,
    can_receive
  ) VALUES (
    v_email,
    v_user.first_name || ' ' || v_user.last_name,
    p_user_id,
    FALSE,
    'client',
    TRUE,
    TRUE,  -- Auto-verified for now
    TRUE,  -- Primary email
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO NOTHING;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin email addresses
INSERT INTO email_addresses (
  email_address,
  display_name,
  is_system_address,
  address_type,
  department,
  is_active,
  is_verified,
  can_send,
  can_receive
) VALUES 
  (
    'office@gritsync.com',
    'GritSync Office',
    TRUE,
    'admin',
    'office',
    TRUE,
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'info@gritsync.com',
    'GritSync Information',
    TRUE,
    'admin',
    'info',
    TRUE,
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'admin@gritsync.com',
    'GritSync Administration',
    TRUE,
    'admin',
    'admin',
    TRUE,
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'jjcantila@gritsync.com',
    'JJ Cantila',
    TRUE,
    'admin',
    'executive',
    TRUE,
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'noreply@gritsync.com',
    'GritSync No Reply',
    TRUE,
    'noreply',
    'system',
    TRUE,
    TRUE,
    TRUE,
    FALSE
  ),
  (
    'support@gritsync.com',
    'GritSync Support',
    TRUE,
    'support',
    'support',
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
ON CONFLICT (email_address) DO NOTHING;

-- Update email_logs table to reference email_addresses
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS from_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS to_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL;

-- Create index on new columns
CREATE INDEX IF NOT EXISTS idx_email_logs_from_address_id ON email_logs(from_email_address_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_address_id ON email_logs(to_email_address_id);

-- Function to get user's primary email address
CREATE OR REPLACE FUNCTION get_user_primary_email(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email_address INTO v_email
  FROM email_addresses
  WHERE user_id = p_user_id
    AND is_primary = TRUE
    AND is_active = TRUE
  LIMIT 1;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Function to get admin email addresses
CREATE OR REPLACE FUNCTION get_admin_email_addresses()
RETURNS TABLE(
  id UUID,
  email_address TEXT,
  display_name TEXT,
  department TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id,
    ea.email_address,
    ea.display_name,
    ea.department
  FROM email_addresses ea
  WHERE ea.address_type = 'admin'
    AND ea.is_active = TRUE
  ORDER BY ea.department;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON email_addresses TO authenticated;
GRANT ALL ON email_addresses TO service_role;

-- Add comments for documentation
COMMENT ON TABLE email_addresses IS 'Manages multiple email addresses for users and system';
COMMENT ON COLUMN email_addresses.address_type IS 'Type: admin, client, support, noreply, department';
COMMENT ON COLUMN email_addresses.department IS 'Department for admin addresses (office, info, admin, etc.)';
COMMENT ON FUNCTION generate_client_email IS 'Generates client email: firstInitial + middleInitial + lastname@gritsync.com';
COMMENT ON FUNCTION create_client_email_address IS 'Creates email address for a user automatically';

-- Create view for active email addresses
CREATE OR REPLACE VIEW active_email_addresses AS
SELECT 
  ea.id,
  ea.email_address,
  ea.display_name,
  ea.user_id,
  ea.address_type,
  ea.department,
  ea.is_primary,
  ea.can_send,
  ea.can_receive,
  u.first_name,
  u.last_name,
  u.role as user_role
FROM email_addresses ea
LEFT JOIN users u ON ea.user_id = u.id
WHERE ea.is_active = TRUE;

GRANT SELECT ON active_email_addresses TO authenticated;

