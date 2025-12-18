-- Migration: Email Templates System
-- Manages reusable email templates with variables and versioning

-- Email Templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Template Details
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
  
  -- Template Content
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  
  -- Template Metadata
  category TEXT NOT NULL CHECK (category IN (
    'welcome',
    'notification',
    'marketing',
    'transactional',
    'reminder',
    'announcement',
    'custom'
  )),
  
  -- Template Type
  template_type TEXT NOT NULL DEFAULT 'standard' CHECK (template_type IN (
    'standard',      -- Regular template
    'system',        -- System template (cannot be deleted)
    'user_created'   -- User-created template
  )),
  
  -- Variables/Placeholders
  variables JSONB DEFAULT '[]', -- Array of available variables
  -- Example: [{"name": "userName", "description": "User's name", "required": true}]
  
  -- Design
  thumbnail_url TEXT,
  preview_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE, -- Default template for category
  
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  
  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Ownership
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Metadata
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_parent ON email_templates(parent_template_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_tags ON email_templates USING GIN (tags);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view active templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can view all templates" ON email_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON email_templates;
DROP POLICY IF EXISTS "Users can view their own templates" ON email_templates;

-- Anyone (authenticated) can view active templates
CREATE POLICY "Anyone can view active templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admins can view all templates
CREATE POLICY "Admins can view all templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can manage all templates
CREATE POLICY "Admins can manage templates"
  ON email_templates
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

-- Users can view their own created templates
CREATE POLICY "Users can view their own templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_templates_updated_at_trigger ON email_templates;
CREATE TRIGGER email_templates_updated_at_trigger
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- Function to render template with variables
CREATE OR REPLACE FUNCTION render_email_template(
  p_template_id UUID,
  p_variables JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_template RECORD;
  v_rendered_subject TEXT;
  v_rendered_html TEXT;
  v_rendered_text TEXT;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- Get template
  SELECT subject, html_content, text_content, variables
  INTO v_template
  FROM email_templates
  WHERE id = p_template_id AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or inactive';
  END IF;
  
  -- Initialize rendered content
  v_rendered_subject := v_template.subject;
  v_rendered_html := v_template.html_content;
  v_rendered_text := v_template.text_content;
  
  -- Replace variables in content
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_rendered_subject := REPLACE(v_rendered_subject, '{{' || v_key || '}}', v_value);
    v_rendered_html := REPLACE(v_rendered_html, '{{' || v_key || '}}', v_value);
    
    IF v_rendered_text IS NOT NULL THEN
      v_rendered_text := REPLACE(v_rendered_text, '{{' || v_key || '}}', v_value);
    END IF;
  END LOOP;
  
  -- Return rendered content
  RETURN jsonb_build_object(
    'subject', v_rendered_subject,
    'html', v_rendered_html,
    'text', v_rendered_text
  );
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE email_templates
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql;

-- Insert pre-designed templates
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  tags
) VALUES 
  -- Welcome Email Template
  (
    'Welcome New User',
    'Welcome email for new user registrations',
    'welcome-new-user',
    'Welcome to GritSync, {{userName}}!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to GritSync!</h1>
    </div>
    <div class="content">
      <h2>Hi {{userName}},</h2>
      <p>We''re thrilled to have you join the GritSync community! Your journey to achieving your USRN dreams starts here.</p>
      <p>Here''s what you can do next:</p>
      <ul>
        <li>Complete your profile</li>
        <li>Upload required documents</li>
        <li>Start your application</li>
      </ul>
      <div style="text-align: center;">
        <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
      </div>
      <p>If you have any questions, our support team is here to help!</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
      <p>{{supportEmail}} | {{websiteUrl}}</p>
    </div>
  </div>
</body>
</html>',
    'Welcome to GritSync, {{userName}}!

We''re thrilled to have you join our community. Visit your dashboard to get started: {{dashboardUrl}}

If you need help, contact us at {{supportEmail}}',
    'welcome',
    'system',
    '[
      {"name": "userName", "description": "User''s full name", "required": true},
      {"name": "dashboardUrl", "description": "URL to dashboard", "required": true},
      {"name": "supportEmail", "description": "Support email address", "required": false},
      {"name": "websiteUrl", "description": "Website URL", "required": false}
    ]'::jsonb,
    TRUE,
    ARRAY['welcome', 'onboarding', 'new-user']
  ),
  
  -- Application Status Update
  (
    'Application Status Update',
    'Notify users when application status changes',
    'application-status-update',
    'Your Application Status: {{newStatus}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .status-badge { display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 20px; font-weight: 600; }
    .button { display: inline-block; padding: 12px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Application Update</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>There''s an update on your application <strong>#{{applicationId}}</strong>:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span class="status-badge">{{newStatus}}</span>
      </div>
      <p>{{message}}</p>
      <div style="text-align: center;">
        <a href="{{applicationUrl}}" class="button">View Application</a>
      </div>
    </div>
    <div class="footer">
      <p>GritSync Team</p>
    </div>
  </div>
</body>
</html>',
    'Application Update: {{newStatus}}

Hi {{userName}}, your application #{{applicationId}} status has been updated to: {{newStatus}}

{{message}}

View details: {{applicationUrl}}',
    'notification',
    'system',
    '[
      {"name": "userName", "description": "User''s name", "required": true},
      {"name": "applicationId", "description": "Application ID", "required": true},
      {"name": "newStatus", "description": "New status", "required": true},
      {"name": "message", "description": "Status message", "required": true},
      {"name": "applicationUrl", "description": "URL to application", "required": true}
    ]'::jsonb,
    TRUE,
    ARRAY['notification', 'status', 'application']
  ),
  
  -- Payment Receipt
  (
    'Payment Receipt',
    'Payment confirmation and receipt',
    'payment-receipt',
    'Payment Received - Receipt #{{receiptNumber}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .receipt-box { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .amount { font-size: 32px; color: #10b981; font-weight: bold; text-align: center; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Received</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Thank you for your payment!</p>
      <div class="amount">${{amount}}</div>
      <div class="receipt-box">
        <p><strong>Receipt Number:</strong> {{receiptNumber}}</p>
        <p><strong>Payment Date:</strong> {{paymentDate}}</p>
        <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
        <p><strong>Description:</strong> {{description}}</p>
      </div>
      <p>This payment has been applied to your account.</p>
    </div>
    <div class="footer">
      <p>Keep this receipt for your records</p>
    </div>
  </div>
</body>
</html>',
    'Payment Receipt #{{receiptNumber}}

Amount: ${{amount}}
Date: {{paymentDate}}
Method: {{paymentMethod}}

Thank you for your payment!',
    'transactional',
    'system',
    '[
      {"name": "userName", "description": "User''s name", "required": true},
      {"name": "amount", "description": "Payment amount", "required": true},
      {"name": "receiptNumber", "description": "Receipt number", "required": true},
      {"name": "paymentDate", "description": "Payment date", "required": true},
      {"name": "paymentMethod", "description": "Payment method", "required": true},
      {"name": "description", "description": "Payment description", "required": true}
    ]'::jsonb,
    TRUE,
    ARRAY['payment', 'receipt', 'transaction']
  ),
  
  -- Reminder Email
  (
    'General Reminder',
    'Generic reminder template',
    'general-reminder',
    'Reminder: {{reminderTitle}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .reminder-box { background: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 28px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Reminder</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <div class="reminder-box">
        <h2 style="margin-top: 0;">{{reminderTitle}}</h2>
        <p>{{reminderMessage}}</p>
      </div>
      <div style="text-align: center;">
        <a href="{{actionUrl}}" class="button">Take Action</a>
      </div>
    </div>
    <div class="footer">
      <p>GritSync Reminders</p>
    </div>
  </div>
</body>
</html>',
    'Reminder: {{reminderTitle}}

{{reminderMessage}}

Action required: {{actionUrl}}',
    'reminder',
    'system',
    '[
      {"name": "userName", "description": "User''s name", "required": true},
      {"name": "reminderTitle", "description": "Reminder title", "required": true},
      {"name": "reminderMessage", "description": "Reminder message", "required": true},
      {"name": "actionUrl", "description": "Action URL", "required": false}
    ]'::jsonb,
    TRUE,
    ARRAY['reminder', 'notification']
  ),
  
  -- Marketing Newsletter
  (
    'Newsletter',
    'Monthly newsletter template',
    'newsletter',
    '{{newsletterTitle}} - GritSync Newsletter',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 40px 30px; }
    .content { padding: 30px; }
    .section { margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .button { display: inline-block; padding: 12px 28px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; }
    .footer { background: #1f2937; color: white; padding: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{newsletterTitle}}</h1>
      <p>{{newsletterDate}}</p>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      {{contentBody}}
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ctaUrl}}" class="button">{{ctaText}}</a>
      </div>
    </div>
    <div class="footer">
      <p>GritSync Newsletter</p>
      <p><a href="{{unsubscribeUrl}}" style="color: #9ca3af;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>',
    '{{newsletterTitle}}
{{newsletterDate}}

{{contentBody}}

{{ctaText}}: {{ctaUrl}}

Unsubscribe: {{unsubscribeUrl}}',
    'marketing',
    'system',
    '[
      {"name": "userName", "description": "User''s name", "required": true},
      {"name": "newsletterTitle", "description": "Newsletter title", "required": true},
      {"name": "newsletterDate", "description": "Newsletter date", "required": true},
      {"name": "contentBody", "description": "Main content", "required": true},
      {"name": "ctaText", "description": "Call-to-action text", "required": true},
      {"name": "ctaUrl", "description": "Call-to-action URL", "required": true},
      {"name": "unsubscribeUrl", "description": "Unsubscribe URL", "required": true}
    ]'::jsonb,
    TRUE,
    ARRAY['marketing', 'newsletter', 'campaign']
  )
ON CONFLICT (slug) DO NOTHING;

-- Grant permissions
GRANT SELECT ON email_templates TO authenticated;
GRANT ALL ON email_templates TO service_role;

-- Add comments
COMMENT ON TABLE email_templates IS 'Stores reusable email templates with variables and versioning';
COMMENT ON COLUMN email_templates.variables IS 'Array of template variables in JSON format';
COMMENT ON FUNCTION render_email_template IS 'Renders template with provided variables';
COMMENT ON FUNCTION increment_template_usage IS 'Increments usage counter for template';

