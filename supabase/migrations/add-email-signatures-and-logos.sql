-- Migration: Email Signatures and Business Logos System
-- Enterprise-grade email signature management with logo/avatar support

-- Email Signatures Table
CREATE TABLE IF NOT EXISTS email_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Signature Details
  name TEXT NOT NULL, -- e.g., "Professional Signature", "Marketing Signature"
  signature_html TEXT NOT NULL, -- HTML signature content
  signature_text TEXT, -- Plain text version
  
  -- Signature Type
  signature_type TEXT NOT NULL DEFAULT 'personal' CHECK (signature_type IN (
    'personal',      -- User's personal signature
    'company',       -- Company-wide signature
    'department'     -- Department signature
  )),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE, -- Default signature for user
  
  -- Design Settings
  font_family TEXT DEFAULT 'Arial, sans-serif',
  font_size INTEGER DEFAULT 14,
  text_color TEXT DEFAULT '#333333',
  link_color TEXT DEFAULT '#dc2626', -- Primary red
  
  -- Contact Information
  full_name TEXT,
  job_title TEXT,
  department TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  address TEXT,
  
  -- Social Media Links
  social_links JSONB DEFAULT '{}', -- {linkedin: "url", twitter: "url", etc.}
  
  -- Logo/Avatar
  logo_url TEXT, -- URL to uploaded logo/avatar
  logo_width INTEGER DEFAULT 120,
  logo_height INTEGER DEFAULT 40,
  show_logo BOOLEAN DEFAULT TRUE,
  
  -- Additional Elements
  show_disclaimer BOOLEAN DEFAULT FALSE,
  disclaimer_text TEXT,
  show_company_tagline BOOLEAN DEFAULT FALSE,
  company_tagline TEXT,
  
  -- Custom CSS
  custom_css TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_font_size CHECK (font_size >= 8 AND font_size <= 24),
  CONSTRAINT valid_logo_dimensions CHECK (
    (logo_width IS NULL AND logo_height IS NULL) OR 
    (logo_width > 0 AND logo_width <= 400 AND logo_height > 0 AND logo_height <= 200)
  )
);

-- Business Logos Table
CREATE TABLE IF NOT EXISTS business_logos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File Details
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- in bytes
  file_type TEXT NOT NULL, -- image/png, image/jpeg, image/svg+xml
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  public_url TEXT, -- Public accessible URL
  
  -- Image Dimensions
  width INTEGER,
  height INTEGER,
  
  -- Logo Purpose
  logo_type TEXT NOT NULL CHECK (logo_type IN (
    'company_logo',      -- Main company logo
    'email_header',      -- Logo for email headers
    'email_signature',   -- Logo for email signatures
    'favicon',           -- Small favicon
    'avatar'             -- User avatar
  )),
  
  -- Ownership
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE, -- Default logo for its type
  
  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  alt_text TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 5242880), -- Max 5MB
  CONSTRAINT valid_dimensions CHECK (
    (width IS NULL AND height IS NULL) OR 
    (width > 0 AND width <= 2000 AND height > 0 AND height <= 2000)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_signatures_user_id ON email_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_email_signatures_signature_type ON email_signatures(signature_type);
CREATE INDEX IF NOT EXISTS idx_email_signatures_is_active ON email_signatures(is_active);
CREATE INDEX IF NOT EXISTS idx_email_signatures_is_default ON email_signatures(is_default);
CREATE INDEX IF NOT EXISTS idx_business_logos_logo_type ON business_logos(logo_type);
CREATE INDEX IF NOT EXISTS idx_business_logos_uploaded_by ON business_logos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_business_logos_is_active ON business_logos(is_active);

-- Enable RLS
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_logos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_signatures
DROP POLICY IF EXISTS "Users can view their own signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can view company signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can create their own signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can update their own signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can delete their own signatures" ON email_signatures;
DROP POLICY IF EXISTS "Admins can manage all signatures" ON email_signatures;

-- Users can view their own signatures
CREATE POLICY "Users can view their own signatures"
  ON email_signatures
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can view company-wide signatures
CREATE POLICY "Users can view company signatures"
  ON email_signatures
  FOR SELECT
  TO authenticated
  USING (signature_type = 'company' AND is_active = TRUE);

-- Users can create their own signatures
CREATE POLICY "Users can create their own signatures"
  ON email_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND signature_type = 'personal');

-- Users can update their own signatures
CREATE POLICY "Users can update their own signatures"
  ON email_signatures
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own signatures
CREATE POLICY "Users can delete their own signatures"
  ON email_signatures
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage all signatures
CREATE POLICY "Admins can manage all signatures"
  ON email_signatures
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

-- RLS Policies for business_logos
DROP POLICY IF EXISTS "Anyone can view active logos" ON business_logos;
DROP POLICY IF EXISTS "Admins can manage logos" ON business_logos;

-- Anyone (authenticated) can view active logos
CREATE POLICY "Anyone can view active logos"
  ON business_logos
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admins can manage all logos
CREATE POLICY "Admins can manage logos"
  ON business_logos
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

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_email_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_business_logos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_signatures_updated_at_trigger ON email_signatures;
CREATE TRIGGER email_signatures_updated_at_trigger
  BEFORE UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_email_signatures_updated_at();

DROP TRIGGER IF EXISTS business_logos_updated_at_trigger ON business_logos;
CREATE TRIGGER business_logos_updated_at_trigger
  BEFORE UPDATE ON business_logos
  FOR EACH ROW
  EXECUTE FUNCTION update_business_logos_updated_at();

-- Function to ensure only one default signature per user
CREATE OR REPLACE FUNCTION ensure_one_default_signature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    -- Unset other default signatures for this user
    UPDATE email_signatures
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_one_default_signature_trigger ON email_signatures;
CREATE TRIGGER ensure_one_default_signature_trigger
  BEFORE INSERT OR UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION ensure_one_default_signature();

-- Function to ensure only one default logo per type
CREATE OR REPLACE FUNCTION ensure_one_default_logo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    -- Unset other default logos for this type
    UPDATE business_logos
    SET is_default = FALSE
    WHERE logo_type = NEW.logo_type
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_one_default_logo_trigger ON business_logos;
CREATE TRIGGER ensure_one_default_logo_trigger
  BEFORE INSERT OR UPDATE ON business_logos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_one_default_logo();

-- Function to generate signature HTML from components
CREATE OR REPLACE FUNCTION generate_signature_html(
  p_full_name TEXT,
  p_job_title TEXT,
  p_company_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_website TEXT,
  p_logo_url TEXT DEFAULT NULL,
  p_text_color TEXT DEFAULT '#333333',
  p_link_color TEXT DEFAULT '#dc2626'
)
RETURNS TEXT AS $$
DECLARE
  v_html TEXT;
BEGIN
  v_html := '<table style="font-family: Arial, sans-serif; font-size: 14px; color: ' || p_text_color || '; line-height: 1.6; border-collapse: collapse;">';
  
  -- Logo row
  IF p_logo_url IS NOT NULL THEN
    v_html := v_html || '<tr><td style="padding-bottom: 12px;"><img src="' || p_logo_url || '" alt="Logo" style="max-width: 120px; height: auto;" /></td></tr>';
  END IF;
  
  -- Name and title
  v_html := v_html || '<tr><td><strong style="font-size: 16px;">' || COALESCE(p_full_name, '') || '</strong></td></tr>';
  
  IF p_job_title IS NOT NULL THEN
    v_html := v_html || '<tr><td style="color: ' || p_link_color || '; font-weight: 500;">' || p_job_title || '</td></tr>';
  END IF;
  
  IF p_company_name IS NOT NULL THEN
    v_html := v_html || '<tr><td>' || p_company_name || '</td></tr>';
  END IF;
  
  -- Contact info
  v_html := v_html || '<tr><td style="padding-top: 8px; border-top: 2px solid ' || p_link_color || '; margin-top: 8px;">&nbsp;</td></tr>';
  
  IF p_email IS NOT NULL THEN
    v_html := v_html || '<tr><td>📧 <a href="mailto:' || p_email || '" style="color: ' || p_link_color || '; text-decoration: none;">' || p_email || '</a></td></tr>';
  END IF;
  
  IF p_phone IS NOT NULL THEN
    v_html := v_html || '<tr><td>📞 ' || p_phone || '</td></tr>';
  END IF;
  
  IF p_website IS NOT NULL THEN
    v_html := v_html || '<tr><td>🌐 <a href="' || p_website || '" style="color: ' || p_link_color || '; text-decoration: none;">' || p_website || '</a></td></tr>';
  END IF;
  
  v_html := v_html || '</table>';
  
  RETURN v_html;
END;
$$ LANGUAGE plpgsql;

-- Function to increment logo usage
CREATE OR REPLACE FUNCTION increment_logo_usage(p_logo_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE business_logos
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_logo_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default company signature template
INSERT INTO email_signatures (
  user_id,
  name,
  signature_html,
  signature_text,
  signature_type,
  is_active,
  is_default,
  full_name,
  company_name,
  email,
  website
) VALUES (
  NULL, -- System signature
  'GritSync Default Signature',
  generate_signature_html(
    'GritSync Team',
    'Healthcare Recruitment',
    'GritSync',
    'support@gritsync.com',
    NULL,
    'https://gritsync.com',
    NULL,
    '#333333',
    '#dc2626'
  ),
  E'GritSync Team\nHealthcare Recruitment\nGritSync\n\nEmail: support@gritsync.com\nWebsite: https://gritsync.com',
  'company',
  TRUE,
  TRUE,
  'GritSync Team',
  'GritSync',
  'support@gritsync.com',
  'https://gritsync.com'
) ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON email_signatures TO authenticated;
GRANT ALL ON email_signatures TO service_role;
GRANT SELECT ON business_logos TO authenticated;
GRANT ALL ON business_logos TO service_role;

-- Add comments
COMMENT ON TABLE email_signatures IS 'Stores email signatures with customization options';
COMMENT ON TABLE business_logos IS 'Stores business logos and avatars for email use';
COMMENT ON FUNCTION generate_signature_html IS 'Generates HTML signature from components';
COMMENT ON FUNCTION increment_logo_usage IS 'Increments usage counter for a logo';

-- Create storage bucket for logos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-logos', 'email-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for email-logos bucket
CREATE POLICY "Authenticated users can view logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'email-logos');

CREATE POLICY "Admins can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-logos' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'email-logos' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-logos' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

