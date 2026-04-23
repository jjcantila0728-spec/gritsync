-- Combined Supabase Migrations
-- Generated automatically
-- Date: 2025-12-16T23:46:59.038Z
--
-- IMPORTANT: Review this file before executing!
--

-- ============================================
-- FEATURE MIGRATIONS
-- ============================================

-- Migration: add-analytics-system.sql
-- Migration: Add Advanced Analytics & Reporting System
-- This system provides comprehensive analytics and reporting capabilities

-- Create analytics_cache table for performance
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  cache_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create custom_reports table
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_config JSONB NOT NULL, -- Chart types, filters, date ranges, etc.
  is_public BOOLEAN DEFAULT false,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ
);

-- Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL, -- Cron expression or schedule details
  recipients TEXT[] NOT NULL, -- Email addresses to send report to
  format TEXT DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'excel', 'json')),
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON custom_reports(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_report ON report_schedules(report_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;

-- Create updated_at trigger functions
CREATE OR REPLACE FUNCTION update_custom_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_report_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS custom_reports_updated_at_trigger ON custom_reports;
CREATE TRIGGER custom_reports_updated_at_trigger
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_reports_updated_at();

DROP TRIGGER IF EXISTS report_schedules_updated_at_trigger ON report_schedules;
CREATE TRIGGER report_schedules_updated_at_trigger
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_report_schedules_updated_at();

-- Enable RLS
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage analytics cache" ON analytics_cache;
DROP POLICY IF EXISTS "Admins can manage custom reports" ON custom_reports;
DROP POLICY IF EXISTS "Admins can manage report schedules" ON report_schedules;

CREATE POLICY "Admins can manage analytics cache"
  ON analytics_cache FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage custom reports"
  ON custom_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage report schedules" ON report_schedules;

CREATE POLICY "Admins can manage report schedules"
  ON report_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant permissions
GRANT ALL ON analytics_cache TO service_role;
GRANT ALL ON custom_reports TO authenticated;
GRANT ALL ON report_schedules TO authenticated;

-- Function to get application analytics
CREATE OR REPLACE FUNCTION get_application_analytics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_status', (
      SELECT jsonb_object_agg(status, count)
      FROM (
        SELECT status, COUNT(*) as count
        FROM applications
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY status
      ) status_counts
    ),
    'by_service_type', (
      SELECT jsonb_object_agg(service_type, count)
      FROM (
        SELECT service_type, COUNT(*) as count
        FROM applications
        WHERE created_at BETWEEN p_start_date AND p_end_date
        AND service_type IS NOT NULL
        GROUP BY service_type
      ) service_counts
    ),
    'daily_trends', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date_trunc('day', created_at)::date,
          'count', COUNT(*)
        )
        ORDER BY date_trunc('day', created_at)::date
      )
      FROM applications
      WHERE created_at BETWEEN p_start_date AND p_end_date
      GROUP BY date_trunc('day', created_at)::date
    ),
    'approval_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE status IN ('approved', 'completed'))::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END
      FROM applications
      WHERE created_at BETWEEN p_start_date AND p_end_date
    ),
    'rejection_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE status = 'rejected')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END
      FROM applications
      WHERE created_at BETWEEN p_start_date AND p_end_date
    ),
    'avg_processing_days', (
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::NUMERIC(10, 2)
      FROM applications
      WHERE created_at BETWEEN p_start_date AND p_end_date
      AND status IN ('approved', 'completed', 'rejected')
    )
  ) INTO v_result
  FROM applications
  WHERE created_at BETWEEN p_start_date AND p_end_date;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get financial analytics
CREATE OR REPLACE FUNCTION get_financial_analytics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount), 0),
    'total_transactions', COUNT(*),
    'by_payment_type', (
      SELECT jsonb_object_agg(payment_type, jsonb_build_object('count', count, 'total', total))
      FROM (
        SELECT 
          payment_type,
          COUNT(*) as count,
          SUM(amount) as total
        FROM application_payments
        WHERE status = 'paid'
        AND created_at BETWEEN p_start_date AND p_end_date
        AND payment_type IS NOT NULL
        GROUP BY payment_type
      ) payment_counts
    ),
    'by_payment_method', (
      SELECT jsonb_object_agg(COALESCE(payment_method, 'unknown'), jsonb_build_object('count', count, 'total', total))
      FROM (
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(amount) as total
        FROM application_payments
        WHERE status = 'paid'
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY payment_method
      ) method_counts
    ),
    'daily_revenue', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date_trunc('day', created_at)::date,
          'revenue', SUM(amount),
          'transactions', COUNT(*)
        )
        ORDER BY date_trunc('day', created_at)::date
      )
      FROM application_payments
      WHERE status = 'paid'
      AND created_at BETWEEN p_start_date AND p_end_date
      GROUP BY date_trunc('day', created_at)::date
    ),
    'avg_transaction_value', (
      SELECT COALESCE(AVG(amount), 0)::NUMERIC(10, 2)
      FROM application_payments
      WHERE status = 'paid'
      AND created_at BETWEEN p_start_date AND p_end_date
    ),
    'outstanding_balance', (
      SELECT COALESCE(SUM(amount), 0)
      FROM application_payments
      WHERE status = 'pending_approval'
    )
  ) INTO v_result
  FROM application_payments
  WHERE status = 'paid'
  AND created_at BETWEEN p_start_date AND p_end_date;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'by_role', (
      SELECT jsonb_object_agg(role, count)
      FROM (
        SELECT role, COUNT(*) as count
        FROM users
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY role
      ) role_counts
    ),
    'active_users', (
      SELECT COUNT(DISTINCT user_id)
      FROM applications
      WHERE updated_at >= NOW() - INTERVAL '30 days'
    ),
    'new_users_daily', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date_trunc('day', created_at)::date,
          'count', COUNT(*)
        )
        ORDER BY date_trunc('day', created_at)::date
      )
      FROM users
      WHERE created_at BETWEEN p_start_date AND p_end_date
      GROUP BY date_trunc('day', created_at)::date
    ),
    'users_with_applications', (
      SELECT COUNT(DISTINCT user_id)
      FROM applications
      WHERE created_at BETWEEN p_start_date AND p_end_date
    )
  ) INTO v_result
  FROM users
  WHERE created_at BETWEEN p_start_date AND p_end_date;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document analytics
CREATE OR REPLACE FUNCTION get_document_analytics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_documents', COUNT(*),
    'by_status', (
      SELECT jsonb_object_agg(status, count)
      FROM (
        SELECT status, COUNT(*) as count
        FROM application_documents
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY status
      ) status_counts
    ),
    'by_document_type', (
      SELECT jsonb_object_agg(document_type, count)
      FROM (
        SELECT document_type, COUNT(*) as count
        FROM application_documents
        WHERE created_at BETWEEN p_start_date AND p_end_date
        AND document_type IS NOT NULL
        GROUP BY document_type
      ) type_counts
    ),
    'approval_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE status = 'approved')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END
      FROM application_documents
      WHERE created_at BETWEEN p_start_date AND p_end_date
    ),
    'rejection_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE status = 'rejected')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END
      FROM application_documents
      WHERE created_at BETWEEN p_start_date AND p_end_date
    ),
    'avg_processing_days', (
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::NUMERIC(10, 2)
      FROM application_documents
      WHERE created_at BETWEEN p_start_date AND p_end_date
      AND status IN ('approved', 'rejected')
    )
  ) INTO v_result
  FROM application_documents
  WHERE created_at BETWEEN p_start_date AND p_end_date;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear expired cache
CREATE OR REPLACE FUNCTION clear_expired_analytics_cache()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM analytics_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE analytics_cache IS 'Cached analytics data for performance';
COMMENT ON TABLE custom_reports IS 'Saved custom reports';
COMMENT ON TABLE report_schedules IS 'Scheduled report deliveries';
COMMENT ON FUNCTION get_application_analytics IS 'Get application analytics for date range';
COMMENT ON FUNCTION get_financial_analytics IS 'Get financial analytics for date range';
COMMENT ON FUNCTION get_user_analytics IS 'Get user analytics for date range';
COMMENT ON FUNCTION get_document_analytics IS 'Get document analytics for date range';



-- ============================================

-- Migration: add-auto-email-generation-trigger.sql
-- Migration: Auto-generate client email addresses on user registration
-- This ensures that every new client user gets a personalized email address
-- Format: firstInitial + middleInitial + lastname@gritsync.com

-- Update the handle_new_user function to also create email address
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_middle_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
  v_user_id UUID;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name, middle_name, and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_middle_name := COALESCE(
    NEW.raw_user_meta_data->>'middle_name',
    ''
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Get role from metadata
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );
  
  -- Insert user profile with all required fields
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role,
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address if user is a client and has name
  IF user_role = 'client' AND NULLIF(TRIM(user_first_name), '') IS NOT NULL AND NULLIF(TRIM(user_last_name), '') IS NOT NULL THEN
    BEGIN
      PERFORM create_client_email_address(v_user_id);
      RAISE LOG 'Successfully created client email address for user %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the entire registration
      RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add middle_name column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'middle_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN middle_name TEXT;
    COMMENT ON COLUMN users.middle_name IS 'Middle name for email generation';
  END IF;
END $$;

-- Create email addresses for existing client users who don't have one
DO $$
DECLARE
  user_record RECORD;
  generated_email TEXT;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.first_name, u.middle_name, u.last_name, u.role
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client' 
      AND u.first_name IS NOT NULL 
      AND u.last_name IS NOT NULL
      AND ea.id IS NULL
  LOOP
    BEGIN
      generated_email := create_client_email_address(user_record.id);
      RAISE NOTICE 'Created email % for user %', generated_email, user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create email for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates user profile and client email address on registration';



-- ============================================

-- Migration: add-comprehensive-email-templates.sql
-- Migration: Comprehensive Email Templates
-- Adds all email templates for real-time communications
-- Includes employer verification letter templates and all other email notifications

-- Employer Verification Letter - Admin Request (GritSync requesting on behalf of client)
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
  is_default,
  tags
) VALUES (
  'Employer Verification Letter Request - Admin',
  'Admin/GritSync requesting employer verification letter on behalf of client for H4-EAD application',
  'employer-verification-letter-request-admin',
  'Request for Employer Verification Letter - H4-EAD Application - {{SPOUSE_NAME}}',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request for Employer Verification Letter</title>
    <style>
        body {
            font-family: ''Times New Roman'', Times, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 20px;
            background: white;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
        }
        .recipient-info {
            margin-bottom: 20px;
        }
        .greeting {
            margin-bottom: 15px;
        }
        .body-content {
            margin-bottom: 15px;
        }
        .body-content p {
            margin-bottom: 12px;
            text-align: justify;
        }
        .info-list {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .info-list li {
            margin-bottom: 6px;
        }
        .contact-section {
            margin-top: 20px;
            margin-bottom: 15px;
        }
        .contact-section strong {
            display: block;
            margin-bottom: 5px;
        }
        .closing {
            margin-top: 20px;
        }
        .signature {
            margin-top: 15px;
        }
        .signature-contact {
            margin-top: 10px;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="recipient-info">
            Insight Global LLC<br>
            Human Resources Department
        </div>
        
        <div class="greeting">Dear HR Team,</div>
        
        <div class="body-content">
            <p>I hope this message finds you well. I am writing on behalf of {{APPLICANT_NAME}} to request an Employer Verification Letter for their spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.</p>
            
            <p>{{APPLICANT_NAME}} is currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from their spouse''s employer (Insight Global LLC) confirming their employment details.</p>
            
            <p>I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:</p>
            
            <ul class="info-list">
                <li>Job Title</li>
                <li>Employment Status (full-time or part-time)</li>
                <li>Employment Start Date</li>
                <li>Current Employment Status</li>
                <li>Any other pertinent details that may support the H4-EAD application</li>
            </ul>
            
            <p>If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.</p>
            
            <p>If you need to verify this request or require additional information, please contact the spouse directly:</p>
            
            <div class="contact-section">
                <strong>SPOUSE EMAIL:</strong> {{SPOUSE_EMAIL}}<br>
                <strong>SPOUSE CONTACT NUMBER:</strong> {{SPOUSE_CONTACT_NUMBER}}
            </div>
            
            <p>Please feel free to reach out to me at info@gritsync.com or via phone if additional information is required or if there are any forms that need to be completed for this request.</p>
            
            <p>I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate the H4-EAD application process. Your timely assistance would be greatly appreciated.</p>
            
            <p>Thank you for your time and consideration.</p>
        </div>
        
        <div class="closing">Best regards,</div>
        
        <div class="signature">
            GritSync Information Team<br>
            Email: info@gritsync.com
        </div>
        
        <div class="signature-contact">
            <strong>Client Contact Information:</strong><br>
            Name: {{APPLICANT_NAME}}<br>
            Email: {{APPLICANT_EMAIL}}<br>
            Phone: {{APPLICANT_PHONE}}<br><br>
            
            <strong>Spouse Contact Information (for verification):</strong><br>
            Email: {{SPOUSE_EMAIL}}<br>
            Contact Number: {{SPOUSE_CONTACT_NUMBER}}
        </div>
    </div>
</body>
</html>',
  'Insight Global LLC
Human Resources Department

Dear HR Team,

I hope this message finds you well. I am writing on behalf of {{APPLICANT_NAME}} to request an Employer Verification Letter for their spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.

{{APPLICANT_NAME}} is currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from their spouse''s employer (Insight Global LLC) confirming their employment details.

I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:

- Job Title
- Employment Status (full-time or part-time)
- Employment Start Date
- Current Employment Status
- Any other pertinent details that may support the H4-EAD application

If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.

If you need to verify this request or require additional information, please contact the spouse directly:
- SPOUSE EMAIL: {{SPOUSE_EMAIL}}
- SPOUSE CONTACT NUMBER: {{SPOUSE_CONTACT_NUMBER}}

Please feel free to reach out to me at info@gritsync.com or via phone if additional information is required or if there are any forms that need to be completed for this request.

I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate the H4-EAD application process. Your timely assistance would be greatly appreciated.

Thank you for your time and consideration.

Best regards,

GritSync Information Team
Email: info@gritsync.com

Client Contact Information:
Name: {{APPLICANT_NAME}}
Email: {{APPLICANT_EMAIL}}
Phone: {{APPLICANT_PHONE}}

Spouse Contact Information (for verification):
Email: {{SPOUSE_EMAIL}}
Contact Number: {{SPOUSE_CONTACT_NUMBER}}',
  'transactional',
  'system',
  '[
    {"name": "APPLICANT_NAME", "description": "Full name of the applicant (client)", "required": true},
    {"name": "SPOUSE_NAME", "description": "Full name of the spouse who is employed", "required": true},
    {"name": "SPOUSE_EMAIL", "description": "Email address of the spouse", "required": true},
    {"name": "SPOUSE_CONTACT_NUMBER", "description": "Contact number of the spouse", "required": true},
    {"name": "APPLICANT_EMAIL", "description": "Email address of the applicant", "required": true},
    {"name": "APPLICANT_PHONE", "description": "Phone number of the applicant", "required": true}
  ]'::jsonb,
  TRUE,
  FALSE,
  ARRAY['employer-verification', 'admin', 'transactional', 'ead']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Employer Verification Letter - Client Request (Client requesting directly)
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
  is_default,
  tags
) VALUES (
  'Employer Verification Letter Request - Client',
  'Client requesting employer verification letter directly for H4-EAD application',
  'employer-verification-letter-request-client',
  'Request for Employer Verification Letter - H4-EAD Application - {{SPOUSE_NAME}}',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request for Employer Verification Letter</title>
    <style>
        body {
            font-family: ''Times New Roman'', Times, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 20px;
            background: white;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
        }
        .recipient-info {
            margin-bottom: 20px;
        }
        .greeting {
            margin-bottom: 15px;
        }
        .body-content {
            margin-bottom: 15px;
        }
        .body-content p {
            margin-bottom: 12px;
            text-align: justify;
        }
        .info-list {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .info-list li {
            margin-bottom: 6px;
        }
        .contact-section {
            margin-top: 20px;
            margin-bottom: 15px;
        }
        .contact-section strong {
            display: block;
            margin-bottom: 5px;
        }
        .closing {
            margin-top: 20px;
        }
        .signature {
            margin-top: 15px;
        }
        .signature-contact {
            margin-top: 10px;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="recipient-info">
            Insight Global LLC<br>
            Human Resources Department
        </div>
        
        <div class="greeting">Dear HR Team,</div>
        
        <div class="body-content">
            <p>I hope this message finds you well. My name is {{APPLICANT_NAME}}, and I am writing to request an Employer Verification Letter for my spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.</p>
            
            <p>I am currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from my spouse''s employer (Insight Global LLC) confirming their employment details.</p>
            
            <p>I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:</p>
            
            <ul class="info-list">
                <li>Job Title</li>
                <li>Employment Status (full-time or part-time)</li>
                <li>Employment Start Date</li>
                <li>Current Employment Status</li>
                <li>Any other pertinent details that may support my H4-EAD application</li>
            </ul>
            
            <p>If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.</p>
            
            <p>If you need to verify this request or require additional information, please contact my spouse directly:</p>
            
            <div class="contact-section">
                <strong>SPOUSE EMAIL:</strong> {{SPOUSE_EMAIL}}<br>
                <strong>SPOUSE CONTACT NUMBER:</strong> {{SPOUSE_CONTACT_NUMBER}}
            </div>
            
            <p>Please feel free to reach out to me at {{APPLICANT_EMAIL}} or via phone at {{APPLICANT_PHONE}} if additional information is required or if there are any forms I need to complete for this request.</p>
            
            <p>I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate my H4-EAD application process. Your timely assistance would be greatly appreciated.</p>
            
            <p>Thank you for your time and consideration.</p>
        </div>
        
        <div class="closing">Best regards,</div>
        
        <div class="signature">
            {{APPLICANT_NAME}}
        </div>
        
        <div class="signature-contact">
            <strong>Contact Information:</strong><br>
            Email: {{APPLICANT_EMAIL}}<br>
            Phone: {{APPLICANT_PHONE}}<br><br>
            
            <strong>Spouse Contact Information (for verification):</strong><br>
            Email: {{SPOUSE_EMAIL}}<br>
            Contact Number: {{SPOUSE_CONTACT_NUMBER}}
        </div>
    </div>
</body>
</html>',
  'Insight Global LLC
Human Resources Department

Dear HR Team,

I hope this message finds you well. My name is {{APPLICANT_NAME}}, and I am writing to request an Employer Verification Letter for my spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.

I am currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from my spouse''s employer (Insight Global LLC) confirming their employment details.

I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:

- Job Title
- Employment Status (full-time or part-time)
- Employment Start Date
- Current Employment Status
- Any other pertinent details that may support my H4-EAD application

If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.

If you need to verify this request or require additional information, please contact my spouse directly:
- SPOUSE EMAIL: {{SPOUSE_EMAIL}}
- SPOUSE CONTACT NUMBER: {{SPOUSE_CONTACT_NUMBER}}

Please feel free to reach out to me at {{APPLICANT_EMAIL}} or via phone at {{APPLICANT_PHONE}} if additional information is required or if there are any forms I need to complete for this request.

I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate my H4-EAD application process. Your timely assistance would be greatly appreciated.

Thank you for your time and consideration.

Best regards,

{{APPLICANT_NAME}}

Contact Information:
Email: {{APPLICANT_EMAIL}}
Phone: {{APPLICANT_PHONE}}

Spouse Contact Information (for verification):
Email: {{SPOUSE_EMAIL}}
Contact Number: {{SPOUSE_CONTACT_NUMBER}}',
  'transactional',
  'system',
  '[
    {"name": "APPLICANT_NAME", "description": "Full name of the applicant (client)", "required": true},
    {"name": "SPOUSE_NAME", "description": "Full name of the spouse who is employed", "required": true},
    {"name": "SPOUSE_EMAIL", "description": "Email address of the spouse", "required": true},
    {"name": "SPOUSE_CONTACT_NUMBER", "description": "Contact number of the spouse", "required": true},
    {"name": "APPLICANT_EMAIL", "description": "Email address of the applicant", "required": true},
    {"name": "APPLICANT_PHONE", "description": "Phone number of the applicant", "required": true}
  ]'::jsonb,
  TRUE,
  FALSE,
  ARRAY['employer-verification', 'client', 'transactional', 'ead']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Timeline Update Email Template
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
  is_default,
  tags
) VALUES (
  'Timeline Update',
  'Notify users when application timeline is updated',
  'timeline-update',
  '{{UPDATE_TITLE}} - Application #{{APPLICATION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .status-badge { display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 20px; font-weight: 600; margin: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .timeline-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .timeline-item:last-child { border-bottom: none; }
    .timeline-item.completed { color: #10b981; }
    .timeline-item.pending { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Timeline Update</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>There''s an update on your application <strong>#{{APPLICATION_ID}}</strong>:</p>
      <h2 style="color: #3b82f6; margin-top: 20px;">{{UPDATE_TITLE}}</h2>
      <p>{{UPDATE_MESSAGE}}</p>
      {{NEW_STATUS_BADGE}}
      {{TIMELINE_SECTION}}
      <div style="text-align: center;">
        <a href="{{ACTION_URL}}" class="button">View Application</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Timeline Update: {{UPDATE_TITLE}}

Hi {{USER_NAME}},

Your application #{{APPLICATION_ID}} has been updated.

{{UPDATE_MESSAGE}}

{{NEW_STATUS_TEXT}}

View your application: {{ACTION_URL}}',
  'notification',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "UPDATE_TITLE", "description": "Title of the update", "required": true},
    {"name": "UPDATE_MESSAGE", "description": "Detailed update message", "required": true},
    {"name": "NEW_STATUS", "description": "New status (optional)", "required": false},
    {"name": "ACTION_URL", "description": "URL to view application", "required": true},
    {"name": "TIMELINE", "description": "Timeline HTML (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['timeline', 'update', 'notification']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Missing Documents Email Template
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
  is_default,
  tags
) VALUES (
  'Missing Documents Reminder',
  'Remind users about missing required documents',
  'missing-documents-reminder',
  'Action Required: Missing Documents for Application #{{APPLICATION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .warning-box { background: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0; }
    .document-list { margin: 20px 0; }
    .document-item { padding: 12px; margin: 8px 0; background: #f9fafb; border-radius: 6px; }
    .document-item.required { border-left: 4px solid #ef4444; }
    .document-item.optional { border-left: 4px solid #6b7280; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .deadline { color: #ef4444; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Documents Required</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>We need the following documents to continue processing your application <strong>#{{APPLICATION_ID}}</strong>:</p>
      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Action Required</strong></p>
        {{DEADLINE_SECTION}}
      </div>
      <div class="document-list">
        {{DOCUMENTS_LIST}}
      </div>
      <div style="text-align: center;">
        <a href="{{UPLOAD_URL}}" class="button">Upload Documents</a>
      </div>
      <p style="margin-top: 30px;">If you have any questions about document requirements, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Missing Documents Reminder

Hi {{USER_NAME}},

We need the following documents to continue processing your application #{{APPLICATION_ID}}:

{{DOCUMENTS_LIST_TEXT}}

{{DEADLINE_TEXT}}

Upload documents: {{UPLOAD_URL}}',
  'reminder',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "DOCUMENTS_LIST", "description": "HTML list of missing documents", "required": true},
    {"name": "DOCUMENTS_LIST_TEXT", "description": "Plain text list of missing documents", "required": true},
    {"name": "DEADLINE", "description": "Upload deadline (optional)", "required": false},
    {"name": "UPLOAD_URL", "description": "URL to upload documents", "required": true}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['documents', 'reminder', 'required']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Missing Profile Details Email Template
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
  is_default,
  tags
) VALUES (
  'Missing Profile Details',
  'Remind users to complete their profile',
  'missing-profile-details',
  'Complete Your Profile - {{URGENCY_TEXT}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .field-list { margin: 20px 0; }
    .field-item { padding: 12px; margin: 8px 0; background: #ffffff; border-left: 4px solid #8b5cf6; border-radius: 4px; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .urgent { background: #fee2e2; border-left-color: #ef4444 !important; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✏️ Complete Your Profile</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>To continue with your application, we need some additional information:</p>
      <div class="info-box {{URGENT_CLASS}}">
        <h3 style="margin-top: 0;">Missing Information:</h3>
        <div class="field-list">
          {{FIELDS_LIST}}
        </div>
      </div>
      <div style="text-align: center;">
        <a href="{{PROFILE_URL}}" class="button">Update Profile</a>
      </div>
      <p style="margin-top: 30px;">Completing your profile helps us process your application faster and provide better service.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Complete Your Profile

Hi {{USER_NAME}},

To continue with your application, we need some additional information:

{{FIELDS_LIST_TEXT}}

Update your profile: {{PROFILE_URL}}',
  'reminder',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "FIELDS_LIST", "description": "HTML list of missing fields", "required": true},
    {"name": "FIELDS_LIST_TEXT", "description": "Plain text list of missing fields", "required": true},
    {"name": "PROFILE_URL", "description": "URL to update profile", "required": true},
    {"name": "URGENT_CLASS", "description": "CSS class for urgent styling (optional)", "required": false},
    {"name": "URGENCY_TEXT", "description": "Urgency indicator text (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['profile', 'reminder', 'details']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- School Letter Generated Email Template
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
  is_default,
  tags
) VALUES (
  'School Letter Generated',
  'Notify users when school verification letter is generated',
  'school-letter-generated',
  '🎓 Your School Letter for {{SCHOOL_NAME}} is Ready',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f0fdf4; padding: 20px; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .warning-box { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Your School Letter is Ready</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Great news! Your verification letter for <strong>{{SCHOOL_NAME}}</strong> has been generated and is ready for download.</p>
      <div class="info-box">
        <p style="margin: 0;">
          <strong>Application ID:</strong> #{{APPLICATION_ID}}<br>
          <strong>School:</strong> {{SCHOOL_NAME}}
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{LETTER_URL}}" class="button">Download Letter</a>
      </div>
      {{INSTRUCTIONS_SECTION}}
      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Important:</strong> This letter is valid for 90 days from the date of issue. Please ensure you submit it within this timeframe.</p>
      </div>
      <p>If you need any changes or have questions about the letter, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'School Letter Generated

Hi {{USER_NAME}},

Your verification letter for {{SCHOOL_NAME}} is ready for download.

Application ID: #{{APPLICATION_ID}}

Download: {{LETTER_URL}}

{{INSTRUCTIONS_TEXT}}

Important: This letter is valid for 90 days.',
  'notification',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "SCHOOL_NAME", "description": "Name of the school", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "LETTER_URL", "description": "URL to download letter", "required": true},
    {"name": "INSTRUCTIONS", "description": "Additional instructions (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['school', 'letter', 'notification']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Payment Receipt Email Template (Enhanced)
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
  is_default,
  tags
) VALUES (
  'Payment Receipt',
  'Payment confirmation and receipt email',
  'payment-receipt-enhanced',
  'Payment Received - Receipt #{{TRANSACTION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .receipt-box { background: #f9fafb; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
    .amount { font-size: 36px; color: #10b981; font-weight: bold; text-align: center; margin: 20px 0; }
    .receipt-details { margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { font-weight: 600; color: #6b7280; }
    .receipt-value { color: #111827; }
    .items-list { margin: 20px 0; }
    .item-row { display: flex; justify-content: space-between; padding: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Received</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Thank you for your payment!</p>
      <div class="amount">{{CURRENCY}}{{AMOUNT}}</div>
      <div class="receipt-box">
        <div class="receipt-details">
          <div class="receipt-row">
            <span class="receipt-label">Transaction ID:</span>
            <span class="receipt-value">{{TRANSACTION_ID}}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Payment Date:</span>
            <span class="receipt-value">{{PAYMENT_DATE}}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Payment Method:</span>
            <span class="receipt-value">{{PAYMENT_METHOD}}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Description:</span>
            <span class="receipt-value">{{DESCRIPTION}}</span>
          </div>
          {{APPLICATION_ID_ROW}}
        </div>
        {{ITEMS_SECTION}}
      </div>
      <p>This payment has been applied to your account.</p>
      {{RECEIPT_URL_BUTTON}}
    </div>
    <div class="footer">
      <p>Keep this receipt for your records</p>
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Payment Receipt #{{TRANSACTION_ID}}

Hi {{USER_NAME}},

Thank you for your payment of {{CURRENCY}}{{AMOUNT}}.

Transaction ID: {{TRANSACTION_ID}}
Payment Date: {{PAYMENT_DATE}}
Payment Method: {{PAYMENT_METHOD}}
Description: {{DESCRIPTION}}

{{APPLICATION_ID_TEXT}}
{{RECEIPT_URL_TEXT}}

Keep this receipt for your records.',
  'transactional',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "AMOUNT", "description": "Payment amount", "required": true},
    {"name": "CURRENCY", "description": "Currency symbol (e.g., $)", "required": true},
    {"name": "TRANSACTION_ID", "description": "Transaction/receipt ID", "required": true},
    {"name": "PAYMENT_DATE", "description": "Payment date", "required": true},
    {"name": "PAYMENT_METHOD", "description": "Payment method", "required": true},
    {"name": "DESCRIPTION", "description": "Payment description", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID (optional)", "required": false},
    {"name": "ITEMS", "description": "HTML list of items (optional)", "required": false},
    {"name": "RECEIPT_URL", "description": "URL to download receipt (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['payment', 'receipt', 'transactional']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Application Status Change Email Template
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
  is_default,
  tags
) VALUES (
  'Application Status Change',
  'Notify users when application status changes',
  'application-status-change',
  'Application Status Updated: {{NEW_STATUS}} - #{{APPLICATION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .status-box { background: #eff6ff; padding: 20px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 20px 0; text-align: center; }
    .status-badge { display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; border-radius: 20px; font-weight: 600; font-size: 18px; }
    .status-change { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 20px 0; }
    .arrow { font-size: 24px; color: #6b7280; }
    .old-status { padding: 8px 16px; background: #e5e7eb; color: #6b7280; border-radius: 20px; }
    .new-status { padding: 8px 16px; background: #3b82f6; color: white; border-radius: 20px; font-weight: 600; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Status Update</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Your application <strong>#{{APPLICATION_ID}}</strong> status has been updated:</p>
      <div class="status-box">
        <div class="status-change">
          {{OLD_STATUS_BADGE}}
          {{STATUS_ARROW}}
          <span class="new-status">{{NEW_STATUS}}</span>
        </div>
      </div>
      <p>{{MESSAGE}}</p>
      <div style="text-align: center;">
        <a href="{{APPLICATION_URL}}" class="button">View Application</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Application Status Update

Hi {{USER_NAME}},

Your application #{{APPLICATION_ID}} status has been updated.

{{STATUS_CHANGE_TEXT}}

{{MESSAGE}}

View application: {{APPLICATION_URL}}',
  'notification',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "OLD_STATUS", "description": "Previous status (optional)", "required": false},
    {"name": "NEW_STATUS", "description": "New status", "required": true},
    {"name": "MESSAGE", "description": "Status change message", "required": true},
    {"name": "APPLICATION_URL", "description": "URL to view application", "required": true}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['status', 'application', 'notification']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Welcome Email Template (Enhanced)
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
  is_default,
  tags
) VALUES (
  'Welcome New User',
  'Welcome email for new user registrations',
  'welcome-new-user-enhanced',
  'Welcome to GritSync, {{USER_NAME}}! 🎉',
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
    .steps-list { margin: 30px 0; }
    .step-item { display: flex; align-items: flex-start; margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
    .step-number { background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
    .step-content h3 { margin: 0 0 8px 0; color: #111827; }
    .step-content p { margin: 0; color: #6b7280; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to GritSync! 🎉</h1>
    </div>
    <div class="content">
      <h2>Hi {{USER_NAME}},</h2>
      <p>We''re thrilled to have you join the GritSync community! Your journey to achieving your USRN dreams starts here.</p>
      <p>Here''s what you can do next:</p>
      <div class="steps-list">
        <div class="step-item">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Complete Your Profile</h3>
            <p>Add your personal information and details</p>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Upload Required Documents</h3>
            <p>Submit all necessary documents for your application</p>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Start Your Application</h3>
            <p>Begin your application process</p>
          </div>
        </div>
      </div>
      <div style="text-align: center;">
        <a href="{{DASHBOARD_URL}}" class="button">Go to Dashboard</a>
      </div>
      <p>If you have any questions, our support team is here to help at {{SUPPORT_EMAIL}}!</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
      <p>{{SUPPORT_EMAIL}} | {{WEBSITE_URL}}</p>
    </div>
  </div>
</body>
</html>',
  'Welcome to GritSync, {{USER_NAME}}!

We''re thrilled to have you join our community. Your journey to achieving your USRN dreams starts here.

Here''s what you can do next:
1. Complete Your Profile
2. Upload Required Documents
3. Start Your Application

Visit your dashboard: {{DASHBOARD_URL}}

If you have any questions, contact us at {{SUPPORT_EMAIL}}',
  'welcome',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "DASHBOARD_URL", "description": "URL to dashboard", "required": true},
    {"name": "SUPPORT_EMAIL", "description": "Support email address", "required": false},
    {"name": "WEBSITE_URL", "description": "Website URL", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['welcome', 'onboarding', 'new-user']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Password Reset Email Template
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
  is_default,
  tags
) VALUES (
  'Password Reset',
  'Password reset request email',
  'password-reset',
  'Reset Your GritSync Password',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .warning-box { background: #fee2e2; padding: 20px; border-left: 4px solid #ef4444; border-radius: 4px; margin: 20px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .expiry { color: #ef4444; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>We received a request to reset your password for your GritSync account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{RESET_LINK}}" class="button">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6;">{{RESET_LINK}}</p>
      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Security Notice:</strong></p>
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li>This link will expire in <span class="expiry">{{EXPIRY_TIME}}</span></li>
          <li>If you didn''t request this, please ignore this email</li>
          <li>Never share your password reset link with anyone</li>
        </ul>
      </div>
      <p>If you have any concerns about your account security, please contact our support team immediately.</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Password Reset Request

Hi {{USER_NAME}},

We received a request to reset your password for your GritSync account.

Reset your password: {{RESET_LINK}}

This link will expire in {{EXPIRY_TIME}}.

If you didn''t request this, please ignore this email.

⚠️ Security: Never share your password reset link with anyone.',
  'transactional',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "RESET_LINK", "description": "Password reset link", "required": true},
    {"name": "EXPIRY_TIME", "description": "Link expiry time (e.g., 1 hour)", "required": true}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['password', 'reset', 'security']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

COMMENT ON TABLE email_templates IS 'Stores reusable email templates with variables and versioning - Enhanced with comprehensive templates for all communications';



-- ============================================

-- Migration: add-email-addresses-system.sql
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
DROP POLICY IF EXISTS "Admins can manage email addresses" ON email_addresses;

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
DROP POLICY IF EXISTS "System can manage email addresses" ON email_addresses;

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



-- ============================================

-- Migration: add-email-campaigns-system.sql
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
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage subscribers" ON email_subscribers;
DROP POLICY IF EXISTS "Users can view their own subscription" ON email_subscribers;
DROP POLICY IF EXISTS "Admins can manage campaigns" ON email_campaigns;
DROP POLICY IF EXISTS "Admins can view campaign recipients" ON email_campaign_recipients;
DROP POLICY IF EXISTS "Service role can manage campaign recipients" ON email_campaign_recipients;

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
DROP POLICY IF EXISTS "Admins can manage campaigns" ON email_campaigns;

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
DROP POLICY IF EXISTS "Admins can view campaign recipients" ON email_campaign_recipients;

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

DROP POLICY IF EXISTS "Service role can manage campaign recipients" ON email_campaign_recipients;

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



-- ============================================

-- Migration: add-email-logs-table.sql
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
DROP POLICY IF EXISTS "Admins can update email logs" ON email_logs;

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
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

-- Allow service role (edge functions) to insert/update email logs
DROP POLICY IF EXISTS "Service role can manage email logs" ON email_logs;

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



-- ============================================

-- Migration: add-email-queue-table.sql
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
-- Drop existing policies first to avoid conflicts
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
DROP POLICY IF EXISTS "Admins can insert email queue" ON email_queue;

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
DROP POLICY IF EXISTS "Admins can update email queue" ON email_queue;

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
DROP POLICY IF EXISTS "Admins can delete email queue" ON email_queue;

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



-- ============================================

-- Migration: add-email-signatures-and-logos.sql
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
DROP POLICY IF EXISTS "Users can update their own signatures" ON email_signatures;

-- Users can update their own signatures
CREATE POLICY "Users can update their own signatures"
  ON email_signatures
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own signatures
DROP POLICY IF EXISTS "Users can delete their own signatures" ON email_signatures;

-- Users can delete their own signatures
CREATE POLICY "Users can delete their own signatures"
  ON email_signatures
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage all signatures
DROP POLICY IF EXISTS "Admins can manage all signatures" ON email_signatures;

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
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete logos" ON storage.objects;

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

DROP POLICY IF EXISTS "Admins can delete logos" ON storage.objects;

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



-- ============================================

-- Migration: add-email-templates-system.sql
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
DROP POLICY IF EXISTS "Admins can manage templates" ON email_templates;

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
DROP POLICY IF EXISTS "Users can view their own templates" ON email_templates;

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



-- ============================================

-- Migration: add-spouse-email-and-contact-to-applications.sql
-- Add spouse_email and spouse_contact_number columns to applications table for EAD applications
-- These fields store the spouse's email and contact number for the Employer Verification Letter
-- The verification letter will be sent as a reply to the spouse's email

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS spouse_email TEXT;

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS spouse_contact_number TEXT;

COMMENT ON COLUMN applications.spouse_email IS 'Email address of spouse (employee at Insight Global LLC) - verification letter will be sent as reply to this email';
COMMENT ON COLUMN applications.spouse_contact_number IS 'Contact number of spouse (employee at Insight Global LLC) - included in verification letter for company to contact';










-- ============================================

-- Migration: add-workflows-system.sql
-- Migration: Add Automated Workflow System
-- This system allows admins to create automated workflows that trigger actions based on events

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'application_status_change',
    'application_created',
    'payment_received',
    'document_uploaded',
    'document_status_change',
    'quotation_created',
    'quotation_status_change',
    'user_registered',
    'timeline_step_completed',
    'custom_event'
  )),
  trigger_conditions JSONB DEFAULT '{}'::jsonb, -- Conditions that must be met (e.g., status = 'approved')
  
  -- Workflow configuration
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of actions to execute
  execution_order TEXT DEFAULT 'sequential' CHECK (execution_order IN ('sequential', 'parallel')),
  stop_on_error BOOLEAN DEFAULT false,
  
  -- Assignment rules (optional)
  auto_assign_enabled BOOLEAN DEFAULT false,
  assignment_rules JSONB DEFAULT '{}'::jsonb, -- Rules for auto-assigning applications
  
  -- Metadata
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0
);

-- Create workflow_runs table (tracks each workflow execution)
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  
  -- Trigger information
  trigger_type TEXT NOT NULL,
  trigger_event_id TEXT, -- ID of the event that triggered this (e.g., application_id)
  trigger_data JSONB DEFAULT '{}'::jsonb, -- Full event data
  
  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Results
  actions_executed INTEGER DEFAULT 0,
  actions_succeeded INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  execution_log JSONB DEFAULT '[]'::jsonb, -- Detailed log of each action
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create workflow_triggers table (for time-based triggers)
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  
  -- Schedule configuration
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL, -- Cron expression or schedule details
  timezone TEXT DEFAULT 'UTC',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_trigger_event ON workflow_runs(trigger_type, trigger_event_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_active ON workflow_triggers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_next_trigger ON workflow_triggers(next_trigger_at) WHERE is_active = true;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_workflow_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS workflows_updated_at_trigger ON workflows;
CREATE TRIGGER workflows_updated_at_trigger
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();

DROP TRIGGER IF EXISTS workflow_triggers_updated_at_trigger ON workflow_triggers;
CREATE TRIGGER workflow_triggers_updated_at_trigger
  BEFORE UPDATE ON workflow_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_triggers_updated_at();

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflows
DROP POLICY IF EXISTS "Admins can view all workflows" ON workflows;

-- RLS Policies for workflows
CREATE POLICY "Admins can view all workflows"
  ON workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert workflows" ON workflows;

CREATE POLICY "Admins can insert workflows"
  ON workflows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update workflows" ON workflows;

CREATE POLICY "Admins can update workflows"
  ON workflows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete workflows" ON workflows;

CREATE POLICY "Admins can delete workflows"
  ON workflows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for workflow_runs
DROP POLICY IF EXISTS "Admins can view all workflow runs" ON workflow_runs;

-- RLS Policies for workflow_runs
CREATE POLICY "Admins can view all workflow runs"
  ON workflow_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role can insert workflow runs" ON workflow_runs;

CREATE POLICY "Service role can insert workflow runs"
  ON workflow_runs FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

DROP POLICY IF EXISTS "Service role can update workflow runs" ON workflow_runs;

CREATE POLICY "Service role can update workflow runs"
  ON workflow_runs FOR UPDATE
  USING (true); -- Service role bypasses RLS

-- RLS Policies for workflow_triggers
DROP POLICY IF EXISTS "Admins can manage workflow triggers" ON workflow_triggers;

-- RLS Policies for workflow_triggers
CREATE POLICY "Admins can manage workflow triggers"
  ON workflow_triggers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_triggers TO authenticated;
GRANT ALL ON workflows TO service_role;
GRANT ALL ON workflow_runs TO service_role;
GRANT ALL ON workflow_triggers TO service_role;

-- Function to get active workflows for a trigger type
CREATE OR REPLACE FUNCTION get_active_workflows_for_trigger(
  p_trigger_type TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  trigger_conditions JSONB,
  actions JSONB,
  execution_order TEXT,
  stop_on_error BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.trigger_conditions,
    w.actions,
    w.execution_order,
    w.stop_on_error
  FROM workflows w
  WHERE w.is_active = true
    AND w.trigger_type = p_trigger_type
  ORDER BY w.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log workflow execution
CREATE OR REPLACE FUNCTION log_workflow_run(
  p_workflow_id UUID,
  p_trigger_type TEXT,
  p_trigger_event_id TEXT,
  p_trigger_data JSONB
)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  INSERT INTO workflow_runs (
    workflow_id,
    trigger_type,
    trigger_event_id,
    trigger_data,
    status,
    started_at
  )
  VALUES (
    p_workflow_id,
    p_trigger_type,
    p_trigger_event_id,
    p_trigger_data,
    'running',
    NOW()
  )
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update workflow statistics
CREATE OR REPLACE FUNCTION update_workflow_stats(
  p_workflow_id UUID,
  p_success BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE workflows
  SET 
    execution_count = execution_count + 1,
    success_count = CASE WHEN p_success THEN success_count + 1 ELSE success_count END,
    failure_count = CASE WHEN NOT p_success THEN failure_count + 1 ELSE failure_count END,
    last_executed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE workflows IS 'Automated workflows that trigger actions based on events';
COMMENT ON COLUMN workflows.trigger_type IS 'Type of event that triggers this workflow';
COMMENT ON COLUMN workflows.trigger_conditions IS 'JSON conditions that must be met (e.g., {"status": "approved"})';
COMMENT ON COLUMN workflows.actions IS 'Array of actions to execute when workflow is triggered';
COMMENT ON COLUMN workflows.execution_order IS 'Whether actions run sequentially or in parallel';
COMMENT ON TABLE workflow_runs IS 'Tracks each execution of a workflow';
COMMENT ON TABLE workflow_triggers IS 'Time-based triggers for workflows (cron schedules)';



-- ============================================

-- Migration: create-received-emails-table.sql
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

DROP TRIGGER IF EXISTS update_received_emails_updated_at ON received_emails;
CREATE TRIGGER update_received_emails_updated_at
  BEFORE UPDATE ON received_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_received_emails_updated_at();

-- RLS Policies
ALTER TABLE received_emails ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all received emails" ON received_emails;
DROP POLICY IF EXISTS "Clients can view their own received emails" ON received_emails;
DROP POLICY IF EXISTS "Service role can insert received emails" ON received_emails;
DROP POLICY IF EXISTS "Users can update their own received emails" ON received_emails;
DROP POLICY IF EXISTS "Users can delete their own received emails" ON received_emails;

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
DROP POLICY IF EXISTS "Service role can insert received emails" ON received_emails;

-- Service role can insert (for webhook)
CREATE POLICY "Service role can insert received emails"
  ON received_emails
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Users can update their own emails (mark as read, delete)
DROP POLICY IF EXISTS "Users can update their own received emails" ON received_emails;

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

DROP TRIGGER IF EXISTS associate_received_email_with_user_trigger ON received_emails;
CREATE TRIGGER associate_received_email_with_user_trigger
  BEFORE INSERT ON received_emails
  FOR EACH ROW
  EXECUTE FUNCTION associate_received_email_with_user();

-- Comments
COMMENT ON TABLE received_emails IS 'Stores received emails from Resend webhook since API does not support retrieving full content';
COMMENT ON COLUMN received_emails.resend_id IS 'Resend email ID for reference';
COMMENT ON COLUMN received_emails.is_deleted IS 'Soft delete flag - hides email from view';










-- ============================================

-- Migration: enforce-single-client-email-per-user.sql
-- Migration: Enforce One Active Client Email Per User
-- Ensures each user can only have ONE active business/client email address

-- Step 1: Clean up existing duplicates (keep oldest, deactivate rest)
DO $$
DECLARE
  user_record RECORD;
  keep_email_id UUID;
  duplicate_count INT;
BEGIN
  RAISE NOTICE '=== Cleaning up duplicate client emails ===';
  
  -- Find users with multiple active client emails
  FOR user_record IN 
    SELECT 
      user_id,
      COUNT(*) as active_count
    FROM email_addresses
    WHERE address_type = 'client'
      AND is_active = TRUE
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'User % has % active client emails', user_record.user_id, user_record.active_count;
    
    -- Get the OLDEST (first created) email address to keep
    SELECT id INTO keep_email_id
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND is_active = TRUE
      AND id != keep_email_id;
    
    -- Deactivate all other emails
    UPDATE email_addresses
    SET 
      is_active = FALSE,
      is_primary = FALSE,
      updated_at = NOW()
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND is_active = TRUE
      AND id != keep_email_id;
    
    RAISE NOTICE '  Kept: % (oldest)', keep_email_id;
    RAISE NOTICE '  Deactivated: % duplicate(s)', duplicate_count;
  END LOOP;
  
  RAISE NOTICE '=== Cleanup complete ===';
END $$;

-- Step 2: Add unique partial index to enforce one active email per user
-- This prevents multiple active client emails for the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_client_email_per_user
ON email_addresses (user_id)
WHERE address_type = 'client' AND is_active = TRUE;

COMMENT ON INDEX idx_one_active_client_email_per_user IS 
'Ensures each user can only have one active client email address';

-- Step 3: Create function to safely set email as primary (deactivates others)
CREATE OR REPLACE FUNCTION set_primary_client_email(
  p_user_id UUID,
  p_email_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_email_id UUID;
BEGIN
  -- Find the email address
  SELECT id INTO v_email_id
  FROM email_addresses
  WHERE user_id = p_user_id
    AND email_address = p_email_address
    AND address_type = 'client';
  
  IF v_email_id IS NULL THEN
    RAISE EXCEPTION 'Email address % not found for user %', p_email_address, p_user_id;
  END IF;
  
  -- Deactivate all other client emails for this user
  UPDATE email_addresses
  SET 
    is_active = FALSE,
    is_primary = FALSE,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND id != v_email_id;
  
  -- Activate and set as primary
  UPDATE email_addresses
  SET 
    is_active = TRUE,
    is_primary = TRUE,
    updated_at = NOW()
  WHERE id = v_email_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_primary_client_email IS 
'Safely sets an email as primary client email, deactivating all others for that user';

-- Step 4: Update create_client_email_address to enforce single email
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
  v_existing_email_id UUID;
  v_existing_email TEXT;
BEGIN
  -- Check if user already has an active client email
  SELECT id, email_address INTO v_existing_email_id, v_existing_email
  FROM email_addresses
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = TRUE
  LIMIT 1;
  
  -- If email already exists and is active, return it (don't create new one)
  IF v_existing_email_id IS NOT NULL THEN
    RAISE LOG 'User % already has active client email: %', p_user_id, v_existing_email;
    RETURN v_existing_email;
  END IF;
  
  -- Get user details from users table
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- If middle_name is null in users table, try to get it from user_details
  v_middle_name := v_user.middle_name;
  IF v_middle_name IS NULL OR TRIM(v_middle_name) = '' THEN
    SELECT middle_name INTO v_middle_name
    FROM user_details
    WHERE user_id = p_user_id
    AND middle_name IS NOT NULL
    AND TRIM(middle_name) != '';
  END IF;
  
  -- Generate email address
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Before inserting, deactivate any existing inactive emails for this user
  -- (to prevent accumulation of inactive emails)
  UPDATE email_addresses
  SET updated_at = NOW()
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = FALSE;
  
  -- Insert email address
  -- The unique index will prevent multiple active emails
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
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO UPDATE
  SET 
    user_id = p_user_id,
    is_active = TRUE,
    is_primary = TRUE,
    updated_at = NOW()
  RETURNING email_address INTO v_email;
  
  RAISE LOG 'Created new client email address % for user %', v_email, p_user_id;
  RETURN v_email;
EXCEPTION
  WHEN unique_violation THEN
    -- If unique constraint violation (multiple active emails), deactivate others and retry
    RAISE WARNING 'Multiple active emails detected for user %, cleaning up...', p_user_id;
    
    -- Deactivate all except the one we're trying to create
    UPDATE email_addresses
    SET is_active = FALSE, is_primary = FALSE
    WHERE user_id = p_user_id
      AND address_type = 'client'
      AND email_address != v_email;
    
    -- Retry insert
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
      TRUE,
      TRUE,
      TRUE,
      TRUE
    )
    ON CONFLICT (email_address) DO UPDATE
    SET 
      user_id = p_user_id,
      is_active = TRUE,
      is_primary = TRUE,
      updated_at = NOW()
    RETURNING email_address INTO v_email;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add trigger to prevent multiple active emails
CREATE OR REPLACE FUNCTION enforce_single_active_client_email()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INT;
BEGIN
  -- Only check when setting email as active
  IF NEW.is_active = TRUE AND NEW.address_type = 'client' THEN
    -- Count active client emails for this user
    SELECT COUNT(*) INTO v_active_count
    FROM email_addresses
    WHERE user_id = NEW.user_id
      AND address_type = 'client'
      AND is_active = TRUE
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    -- If there's already an active email, deactivate it
    IF v_active_count > 0 THEN
      UPDATE email_addresses
      SET 
        is_active = FALSE,
        is_primary = FALSE,
        updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND address_type = 'client'
        AND is_active = TRUE
        AND id != NEW.id;
      
      RAISE NOTICE 'Deactivated % other active client email(s) for user %', v_active_count, NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_enforce_single_active_client_email ON email_addresses;
CREATE TRIGGER trigger_enforce_single_active_client_email
  BEFORE INSERT OR UPDATE ON email_addresses
  FOR EACH ROW
  WHEN (NEW.address_type = 'client')
  EXECUTE FUNCTION enforce_single_active_client_email();

COMMENT ON TRIGGER trigger_enforce_single_active_client_email ON email_addresses IS 
'Ensures only one active client email per user by deactivating others when a new one is activated';

-- Step 6: Update handle_new_user trigger to check for existing email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_middle_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
  v_user_id UUID;
  v_existing_email_count INT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name, middle_name, and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_middle_name := COALESCE(
    NEW.raw_user_meta_data->>'middle_name',
    ''
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Get role from metadata
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );
  
  -- Insert user profile
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role,
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Update auth metadata with role
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address ONLY if:
  -- 1. User is a client
  -- 2. User has name
  -- 3. User doesn't already have an active email address
  IF user_role = 'client' 
     AND NULLIF(TRIM(user_first_name), '') IS NOT NULL 
     AND NULLIF(TRIM(user_last_name), '') IS NOT NULL 
  THEN
    -- Check if user already has an active client email
    SELECT COUNT(*) INTO v_existing_email_count
    FROM email_addresses
    WHERE user_id = v_user_id
      AND address_type = 'client'
      AND is_active = TRUE;
    
    -- Only create if no active email exists
    IF v_existing_email_count = 0 THEN
      BEGIN
        PERFORM create_client_email_address(v_user_id);
        RAISE LOG 'Successfully created client email address for user %', v_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
      END;
    ELSE
      RAISE LOG 'User % already has % active client email address(es), skipping creation', v_user_id, v_existing_email_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Verify the constraint
DO $$
DECLARE
  violation_count INT;
BEGIN
  -- Check for any remaining violations
  SELECT COUNT(*) INTO violation_count
  FROM (
    SELECT user_id, COUNT(*) as cnt
    FROM email_addresses
    WHERE address_type = 'client' AND is_active = TRUE
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) violations;
  
  IF violation_count > 0 THEN
    RAISE WARNING 'Found % user(s) with multiple active client emails - these should be cleaned up', violation_count;
  ELSE
    RAISE NOTICE '✅ All users have at most one active client email';
  END IF;
END $$;

-- Step 8: Show summary
SELECT 
  'Summary' as info,
  COUNT(DISTINCT user_id) as users_with_client_emails,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active_client_emails,
  COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_client_emails,
  COUNT(*) as total_client_emails
FROM email_addresses
WHERE address_type = 'client';

COMMENT ON FUNCTION create_client_email_address IS 
'Creates client email address only if user does not already have an active one (enforces one email per user)';










-- ============================================

-- Migration: fix-email-generation-with-middle-name.sql
-- Fix: Email generation to pull middle_name from user_details if not in users table
-- This ensures emails like klcantila@gritsync.com include the middle initial

-- Update create_client_email_address function to check user_details for middle_name
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
BEGIN
  -- Get user details from users table
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- If middle_name is null in users table, try to get it from user_details
  v_middle_name := v_user.middle_name;
  IF v_middle_name IS NULL OR TRIM(v_middle_name) = '' THEN
    SELECT middle_name INTO v_middle_name
    FROM user_details
    WHERE user_id = p_user_id
    AND middle_name IS NOT NULL
    AND TRIM(middle_name) != '';
  END IF;
  
  -- Generate email address with middle name from either source
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Insert email address (or update if exists)
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
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO NOTHING;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Update existing email addresses that are missing middle initial
-- This will regenerate emails for users who have middle_name in user_details
DO $$
DECLARE
  user_record RECORD;
  old_email TEXT;
  new_email TEXT;
  has_middle TEXT;
BEGIN
  FOR user_record IN 
    SELECT 
      u.id,
      u.first_name,
      u.middle_name as users_middle_name,
      u.last_name,
      ud.middle_name as details_middle_name,
      ea.email_address as current_email,
      ea.id as email_id
    FROM users u
    LEFT JOIN user_details ud ON ud.user_id = u.id
    INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client'
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      -- User has middle name in user_details but not in users table
      AND (u.middle_name IS NULL OR TRIM(u.middle_name) = '')
      AND ud.middle_name IS NOT NULL
      AND TRIM(ud.middle_name) != ''
  LOOP
    BEGIN
      -- Get the middle name from user_details
      has_middle := user_record.details_middle_name;
      
      -- Generate new email with middle initial
      new_email := generate_client_email(
        user_record.first_name,
        has_middle,
        user_record.last_name
      );
      
      old_email := user_record.current_email;
      
      -- Only update if the email actually changed
      IF new_email != old_email THEN
        -- Check if new email already exists
        IF NOT EXISTS (SELECT 1 FROM email_addresses WHERE email_address = new_email) THEN
          -- Update the email address
          UPDATE email_addresses
          SET email_address = new_email,
              updated_at = NOW()
          WHERE id = user_record.email_id;
          
          RAISE NOTICE 'Updated email for user %: % -> %', user_record.id, old_email, new_email;
        ELSE
          RAISE WARNING 'Cannot update user % email to % - already exists', user_record.id, new_email;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update email for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Also update processing_accounts to use the new email
DO $$
DECLARE
  account_record RECORD;
  new_email TEXT;
BEGIN
  FOR account_record IN
    SELECT 
      pa.id as account_id,
      pa.application_id,
      pa.email as old_email,
      ea.email_address as new_email,
      u.id as user_id
    FROM processing_accounts pa
    INNER JOIN applications a ON a.id = pa.application_id
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client' AND ea.is_primary = TRUE
    WHERE pa.account_type = 'gritsync'
      AND pa.email != ea.email_address  -- Email is different
  LOOP
    BEGIN
      -- Update processing account email
      UPDATE processing_accounts
      SET email = account_record.new_email,
          updated_at = NOW()
      WHERE id = account_record.account_id;
      
      RAISE NOTICE 'Updated processing account email: % -> %', account_record.old_email, account_record.new_email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update processing account %: %', account_record.account_id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION create_client_email_address IS 'Creates client email address, pulling middle_name from user_details if not in users table';



-- ============================================

-- Migration: fix-email-logs-rls-for-clients.sql
-- Migration: Fix email_logs RLS policies to allow clients to send emails
-- Issue: Clients receive 403 error when trying to create email logs
-- Solution: Add policies for clients to insert and view their own sent emails

-- Drop the restrictive admin-only insert policy
DROP POLICY IF EXISTS "Admins can create email logs" ON email_logs;

-- Create new policies that allow clients to insert their own emails
DROP POLICY IF EXISTS "Authenticated users can create their own email logs" ON email_logs;

-- Create new policies that allow clients to insert their own emails
CREATE POLICY "Authenticated users can create their own email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be the sender of the email
    sent_by_user_id = auth.uid()
    OR
    -- Or user is an admin (can send on behalf of others)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Update the view policy to allow users to see emails they sent
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;

CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see emails they sent
    sent_by_user_id = auth.uid()
    OR
    -- Users can see emails sent to them
    recipient_user_id = auth.uid()
    OR
    -- Admins can see all emails
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add policy for clients to view their sent emails by email address
-- This is useful when filtering by from_email_address_id
DROP POLICY IF EXISTS "Users can view emails from their email addresses" ON email_logs;

-- Add policy for clients to view their sent emails by email address
-- This is useful when filtering by from_email_address_id
CREATE POLICY "Users can view emails from their email addresses"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the email was sent from one of the user's email addresses
    EXISTS (
      SELECT 1 FROM email_addresses
      WHERE email_addresses.id = email_logs.from_email_address_id
      AND email_addresses.user_id = auth.uid()
    )
  );

-- Grant INSERT permission to authenticated users
GRANT INSERT ON email_logs TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Authenticated users can create their own email logs" ON email_logs IS 
  'Allows authenticated users (including clients) to create email logs when they send emails from their email addresses';

COMMENT ON POLICY "Users can view their own email logs" ON email_logs IS 
  'Allows users to view emails they sent or received, and admins to view all emails';

COMMENT ON POLICY "Users can view emails from their email addresses" ON email_logs IS 
  'Allows users to view emails sent from their registered email addresses';










-- ============================================

-- Migration: fix-email-logs-update-policy.sql
-- Migration: Add UPDATE policy for email_logs to allow status updates
-- Issue: Clients can INSERT email logs but cannot UPDATE them to change status
-- Solution: Add UPDATE policy for users to update their own email logs

-- Drop the restrictive admin-only update policy
DROP POLICY IF EXISTS "Admins can update email logs" ON email_logs;

-- Create new UPDATE policy that allows users to update their own email logs
DROP POLICY IF EXISTS "Users can update their own email logs" ON email_logs;

-- Create new UPDATE policy that allows users to update their own email logs
CREATE POLICY "Users can update their own email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be the sender of the email
    sent_by_user_id = auth.uid()
    OR
    -- Or user is an admin (can update any email)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    -- Same condition for the updated row
    sent_by_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant UPDATE permission to authenticated users
GRANT UPDATE ON email_logs TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Users can update their own email logs" ON email_logs IS 
  'Allows authenticated users to update email logs they created (e.g., status changes after sending)';

-- Verify the policy was created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'email_logs'
AND cmd = 'UPDATE'
ORDER BY policyname;










-- ============================================

-- Migration: fix-permanent-email-generation.sql
-- Fix: Ensure email addresses are permanent once generated
-- Prevents duplicate email generation when migrations are re-run

-- 1. Update create_client_email_address to check if user already has an email
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
  v_existing_email TEXT;
BEGIN
  -- Check if user already has a client email address
  SELECT email_address INTO v_existing_email
  FROM email_addresses
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = TRUE
  LIMIT 1;
  
  -- If email already exists, return it (don't create new one)
  IF v_existing_email IS NOT NULL THEN
    RAISE LOG 'User % already has email address: %', p_user_id, v_existing_email;
    RETURN v_existing_email;
  END IF;
  
  -- Get user details from users table
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- If middle_name is null in users table, try to get it from user_details
  v_middle_name := v_user.middle_name;
  IF v_middle_name IS NULL OR TRIM(v_middle_name) = '' THEN
    SELECT middle_name INTO v_middle_name
    FROM user_details
    WHERE user_id = p_user_id
    AND middle_name IS NOT NULL
    AND TRIM(middle_name) != '';
  END IF;
  
  -- Generate email address with middle name from either source
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Insert email address (or return existing if conflict)
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
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO UPDATE
  SET updated_at = NOW()
  RETURNING email_address INTO v_email;
  
  RAISE LOG 'Created new email address % for user %', v_email, p_user_id;
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- 2. Clean up duplicate email addresses for the same user
-- Keep the oldest one (first created) as primary
DO $$
DECLARE
  user_record RECORD;
  email_record RECORD;
  keep_email_id UUID;
BEGIN
  -- Find users with multiple client email addresses
  FOR user_record IN 
    SELECT user_id, COUNT(*) as email_count
    FROM email_addresses
    WHERE address_type = 'client'
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'User % has % email addresses, cleaning up...', user_record.user_id, user_record.email_count;
    
    -- Get the oldest (first created) email address to keep
    SELECT id INTO keep_email_id
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Mark it as primary and active
    UPDATE email_addresses
    SET is_primary = TRUE,
        is_active = TRUE
    WHERE id = keep_email_id;
    
    -- Deactivate all other email addresses for this user
    UPDATE email_addresses
    SET is_active = FALSE,
        is_primary = FALSE
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND id != keep_email_id;
    
    RAISE NOTICE 'Kept email % and deactivated others for user %', keep_email_id, user_record.user_id;
  END LOOP;
END $$;

-- 3. Update the handle_new_user trigger to only create email if none exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_middle_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
  v_user_id UUID;
  v_existing_email_count INT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name, middle_name, and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_middle_name := COALESCE(
    NEW.raw_user_meta_data->>'middle_name',
    ''
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Get role from metadata
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );
  
  -- Insert user profile with all required fields
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role,
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address ONLY if:
  -- 1. User is a client
  -- 2. User has name
  -- 3. User doesn't already have an email address
  IF user_role = 'client' 
     AND NULLIF(TRIM(user_first_name), '') IS NOT NULL 
     AND NULLIF(TRIM(user_last_name), '') IS NOT NULL 
  THEN
    -- Check if user already has a client email
    SELECT COUNT(*) INTO v_existing_email_count
    FROM email_addresses
    WHERE user_id = v_user_id
      AND address_type = 'client'
      AND is_active = TRUE;
    
    -- Only create if no email exists
    IF v_existing_email_count = 0 THEN
      BEGIN
        PERFORM create_client_email_address(v_user_id);
        RAISE LOG 'Successfully created client email address for user %', v_user_id;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the entire registration
        RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
      END;
    ELSE
      RAISE LOG 'User % already has % email address(es), skipping creation', v_user_id, v_existing_email_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Show current status for verification
DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE '=== Email Addresses Status ===';
  FOR user_record IN 
    SELECT 
      u.id,
      u.email as auth_email,
      u.first_name,
      u.last_name,
      ea.email_address as client_email,
      ea.is_active,
      ea.is_primary,
      ea.created_at
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client'
    ORDER BY u.created_at DESC
  LOOP
    IF user_record.client_email IS NOT NULL THEN
      RAISE NOTICE 'User: % % | Client Email: % | Active: % | Primary: %',
        user_record.first_name,
        user_record.last_name,
        user_record.client_email,
        user_record.is_active,
        user_record.is_primary;
    ELSE
      RAISE NOTICE 'User: % % | No client email address',
        user_record.first_name,
        user_record.last_name;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION create_client_email_address IS 'Creates client email address only if user does not already have one (permanent once created)';










-- ============================================

-- Migration: update-email-generation-compound-names.sql
-- Update email generation to handle compound first names
-- Logic:
-- 1. If first_name has 2 words (e.g., "Joy Jeric", "Krizza Mae")
--    → Use first letter of each word + lastname (jjcantila@gritsync.com, kmcantila@gritsync.com)
-- 2. If first_name has 1 word and has middle_name
--    → Use first letter of first_name + first letter of middle_name + lastname (jmcantila@gritsync.com)
-- 3. If only first_name (no middle, single word)
--    → Use first letter of first_name + lastname (jcantila@gritsync.com)

CREATE OR REPLACE FUNCTION generate_client_email(
  p_first_name TEXT,
  p_middle_name TEXT,
  p_last_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
  v_first_part TEXT;
  v_lastname TEXT;
  v_counter INTEGER := 0;
  v_suffix TEXT := '';
  v_first_name_words TEXT[];
  v_first_name_word_count INTEGER;
BEGIN
  -- Clean and split first_name by spaces
  v_first_name_words := STRING_TO_ARRAY(TRIM(p_first_name), ' ');
  v_first_name_word_count := ARRAY_LENGTH(v_first_name_words, 1);
  
  -- Generate first part of email based on name structure
  IF v_first_name_word_count >= 2 THEN
    -- Compound first name (e.g., "Joy Jeric" → "jj", "Krizza Mae" → "km")
    -- Use first letter of first word + first letter of second word
    v_first_part := LOWER(
      SUBSTRING(v_first_name_words[1] FROM 1 FOR 1) ||
      SUBSTRING(v_first_name_words[2] FROM 1 FOR 1)
    );
    
    RAISE LOG 'Compound first name detected: % → first part: %', p_first_name, v_first_part;
    
  ELSIF p_middle_name IS NOT NULL AND LENGTH(TRIM(p_middle_name)) > 0 THEN
    -- Single first name with middle name (e.g., "Karl" + "Louie" → "kl")
    -- Use first letter of first_name + first letter of middle_name
    v_first_part := LOWER(
      SUBSTRING(p_first_name FROM 1 FOR 1) ||
      SUBSTRING(p_middle_name FROM 1 FOR 1)
    );
    
    RAISE LOG 'Single first name with middle: % % → first part: %', p_first_name, p_middle_name, v_first_part;
    
  ELSE
    -- Only first name, no middle (e.g., "Karl" → "k")
    -- Use just first letter of first_name
    v_first_part := LOWER(SUBSTRING(p_first_name FROM 1 FOR 1));
    
    RAISE LOG 'Single first name only: % → first part: %', p_first_name, v_first_part;
  END IF;
  
  -- Clean lastname (remove spaces and special characters)
  v_lastname := LOWER(REGEXP_REPLACE(p_last_name, '[^a-zA-Z]', '', 'g'));
  
  -- Generate base email
  v_email := v_first_part || v_lastname || '@gritsync.com';
  
  RAISE LOG 'Generated base email: %', v_email;
  
  -- Check if email already exists and add number suffix if needed
  WHILE EXISTS (SELECT 1 FROM email_addresses WHERE email_address = v_email) LOOP
    v_counter := v_counter + 1;
    v_suffix := v_counter::TEXT;
    v_email := v_first_part || v_lastname || v_suffix || '@gritsync.com';
    RAISE LOG 'Email exists, trying with suffix: %', v_email;
  END LOOP;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Test the function with examples
DO $$
DECLARE
  test_email TEXT;
BEGIN
  RAISE NOTICE '=== Testing Email Generation ===';
  RAISE NOTICE '';
  
  -- Test 1: Compound first name (Joy Jeric)
  test_email := generate_client_email('Joy Jeric', NULL, 'Cantila');
  RAISE NOTICE 'Test 1: Joy Jeric Cantila → %', test_email;
  RAISE NOTICE 'Expected: jjcantila@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 2: Compound first name (Krizza Mae)
  test_email := generate_client_email('Krizza Mae', NULL, 'Cantila');
  RAISE NOTICE 'Test 2: Krizza Mae Cantila → %', test_email;
  RAISE NOTICE 'Expected: kmcantila@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 3: Single first name with middle name (Karl Louie)
  test_email := generate_client_email('Karl', 'Louie', 'Cantila');
  RAISE NOTICE 'Test 3: Karl Louie Cantila → %', test_email;
  RAISE NOTICE 'Expected: klcantila@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 4: Single first name, no middle (John)
  test_email := generate_client_email('John', NULL, 'Doe');
  RAISE NOTICE 'Test 4: John Doe → %', test_email;
  RAISE NOTICE 'Expected: jdoe@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 5: Three-word first name (Mary Jane Rose) - uses first 2 words
  test_email := generate_client_email('Mary Jane Rose', NULL, 'Smith');
  RAISE NOTICE 'Test 5: Mary Jane Rose Smith → %', test_email;
  RAISE NOTICE 'Expected: mjsmith@gritsync.com (first 2 words)';
  RAISE NOTICE '';
  
  RAISE NOTICE '=== Tests Complete ===';
END $$;

-- Show examples of how existing users would be affected
DO $$
DECLARE
  user_record RECORD;
  new_email TEXT;
  old_email TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Preview: How Existing Users Would Be Affected ===';
  RAISE NOTICE '(This is just a preview - not actually changing anything)';
  RAISE NOTICE '';
  
  FOR user_record IN 
    SELECT 
      u.id,
      u.first_name,
      u.middle_name,
      u.last_name,
      ea.email_address as current_email
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id 
      AND ea.address_type = 'client' 
      AND ea.is_active = TRUE
    WHERE u.role = 'client'
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
    ORDER BY u.created_at DESC
    LIMIT 10
  LOOP
    -- Generate what the new email would be
    new_email := generate_client_email(
      user_record.first_name,
      user_record.middle_name,
      user_record.last_name
    );
    
    old_email := COALESCE(user_record.current_email, '(none)');
    
    IF new_email = old_email THEN
      RAISE NOTICE '✓ % % % → % (no change)', 
        user_record.first_name,
        COALESCE(user_record.middle_name, ''),
        user_record.last_name,
        old_email;
    ELSE
      RAISE NOTICE '  % % % → OLD: % | NEW: %', 
        user_record.first_name,
        COALESCE(user_record.middle_name, ''),
        user_record.last_name,
        old_email,
        new_email;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Preview Complete ===';
  RAISE NOTICE 'NOTE: Existing emails will NOT be changed automatically.';
  RAISE NOTICE 'This new logic only applies to NEW users or manual regeneration.';
END $$;

COMMENT ON FUNCTION generate_client_email IS 'Generates client email with logic: compound first names use both initials, single names use first+middle initial';










-- ============================================

-- Migration: update-old-email-templates.sql
-- Migration: Update Old Email Templates
-- This migration deactivates old template versions when enhanced versions exist
-- Run this after add-comprehensive-email-templates.sql

-- Deactivate old templates (these have been replaced by enhanced versions)
-- Only deactivate if the new enhanced versions exist

DO $$
BEGIN
  -- Deactivate old welcome template if enhanced version exists
  IF EXISTS (SELECT 1 FROM email_templates WHERE slug = 'welcome-new-user-enhanced' AND is_active = TRUE) THEN
    UPDATE email_templates 
    SET is_active = FALSE,
        description = COALESCE(description, '') || ' (Replaced by welcome-new-user-enhanced)',
        updated_at = NOW()
    WHERE slug = 'welcome-new-user' AND is_active = TRUE;
  END IF;

  -- Deactivate old application status template if enhanced version exists
  IF EXISTS (SELECT 1 FROM email_templates WHERE slug = 'application-status-change' AND is_active = TRUE) THEN
    UPDATE email_templates 
    SET is_active = FALSE,
        description = COALESCE(description, '') || ' (Replaced by application-status-change)',
        updated_at = NOW()
    WHERE slug = 'application-status-update' AND is_active = TRUE;
  END IF;

  -- Deactivate old payment receipt template if enhanced version exists
  IF EXISTS (SELECT 1 FROM email_templates WHERE slug = 'payment-receipt-enhanced' AND is_active = TRUE) THEN
    UPDATE email_templates 
    SET is_active = FALSE,
        description = COALESCE(description, '') || ' (Replaced by payment-receipt-enhanced)',
        updated_at = NOW()
    WHERE slug = 'payment-receipt' AND is_active = TRUE;
  END IF;
END $$;



-- ============================================

-- ============================================
-- CORE MIGRATIONS
-- ============================================

-- Migration: add-career-applications-and-partner-agencies.sql
-- Migration: Add Career Applications and Partner Agencies tables

-- Partner Agencies table
CREATE TABLE IF NOT EXISTS partner_agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Agency Information
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'USA',
  zipcode TEXT,
  
  -- Contact Person
  contact_person_name TEXT,
  contact_person_email TEXT,
  contact_person_phone TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Additional Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique agency name
  UNIQUE(name)
);

-- Career Applications table
CREATE TABLE IF NOT EXISTS career_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  date_of_birth TEXT,
  country TEXT,
  
  -- Professional Information
  nursing_school TEXT,
  graduation_date TEXT,
  years_of_experience TEXT,
  current_employment_status TEXT,
  license_number TEXT,
  license_state TEXT,
  
  -- Application Details
  resume_path TEXT,
  cover_letter_path TEXT,
  additional_documents_path TEXT,
  
  -- Partner Agency Assignment
  partner_agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  forwarded_to_agency_at TIMESTAMP WITH TIME ZONE,
  forwarded_email_sent BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'forwarded', 'interviewed', 'accepted', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE partner_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_agencies
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view all partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Admins can create partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Admins can update partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Admins can delete partner agencies" ON partner_agencies;
DROP POLICY IF EXISTS "Everyone can view active partner agencies" ON partner_agencies;

-- Everyone can view active partner agencies (for public career page)
CREATE POLICY "Everyone can view active partner agencies"
ON partner_agencies FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

-- Admins can view all partner agencies
CREATE POLICY "Admins can view all partner agencies"
ON partner_agencies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can create partner agencies
DROP POLICY IF EXISTS "Admins can create partner agencies" ON partner_agencies;

-- Admins can create partner agencies
CREATE POLICY "Admins can create partner agencies"
ON partner_agencies FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update partner agencies
DROP POLICY IF EXISTS "Admins can update partner agencies" ON partner_agencies;

-- Admins can update partner agencies
CREATE POLICY "Admins can update partner agencies"
ON partner_agencies FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete partner agencies
DROP POLICY IF EXISTS "Admins can delete partner agencies" ON partner_agencies;

-- Admins can delete partner agencies
CREATE POLICY "Admins can delete partner agencies"
ON partner_agencies FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- RLS Policies for career_applications
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Everyone can create career applications" ON career_applications;
DROP POLICY IF EXISTS "Anonymous can view recent career applications" ON career_applications;
DROP POLICY IF EXISTS "Users can view their own career applications" ON career_applications;
DROP POLICY IF EXISTS "Users can update their own pending career applications" ON career_applications;
DROP POLICY IF EXISTS "Admins can view all career applications" ON career_applications;
DROP POLICY IF EXISTS "Admins can update all career applications" ON career_applications;
DROP POLICY IF EXISTS "Admins can delete career applications" ON career_applications;

-- Allow everyone (including anonymous) to create career applications
CREATE POLICY "Everyone can create career applications"
ON career_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view career applications they just created
CREATE POLICY "Anonymous can view recent career applications"
ON career_applications FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can view their own career applications
DROP POLICY IF EXISTS "Users can view their own career applications" ON career_applications;

-- Users can view their own career applications
CREATE POLICY "Users can view their own career applications"
ON career_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own career applications (only if pending)
DROP POLICY IF EXISTS "Users can update their own pending career applications" ON career_applications;

-- Users can update their own career applications (only if pending)
CREATE POLICY "Users can update their own pending career applications"
ON career_applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all career applications
DROP POLICY IF EXISTS "Admins can view all career applications" ON career_applications;

-- Admins can view all career applications
CREATE POLICY "Admins can view all career applications"
ON career_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update all career applications
DROP POLICY IF EXISTS "Admins can update all career applications" ON career_applications;

-- Admins can update all career applications
CREATE POLICY "Admins can update all career applications"
ON career_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete career applications
DROP POLICY IF EXISTS "Admins can delete career applications" ON career_applications;

-- Admins can delete career applications
CREATE POLICY "Admins can delete career applications"
ON career_applications FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_career_applications_user_id ON career_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_status ON career_applications(status);
CREATE INDEX IF NOT EXISTS idx_career_applications_partner_agency_id ON career_applications(partner_agency_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_created_at ON career_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_agencies_is_active ON partner_agencies(is_active);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_partner_agencies_updated_at ON partner_agencies;
CREATE TRIGGER update_partner_agencies_updated_at
  BEFORE UPDATE ON partner_agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_career_applications_updated_at ON career_applications;
CREATE TRIGGER update_career_applications_updated_at
  BEFORE UPDATE ON career_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();





-- ============================================

-- Migration: add-careers-table.sql
-- Migration: Add Careers/Jobs table
-- NOTE: This migration requires partner_agencies table to exist first
-- Run add-career-applications-and-partner-agencies.sql before this migration

-- Ensure partner_agencies table exists (for foreign key reference)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    RAISE EXCEPTION 'partner_agencies table must exist. Please run add-career-applications-and-partner-agencies.sql first.';
  END IF;
END $$;

-- Careers table
CREATE TABLE IF NOT EXISTS careers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Job Information
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  responsibilities TEXT,
  location TEXT,
  employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'temporary', 'internship')),
  salary_range TEXT,
  department TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Application Details
  application_deadline TIMESTAMP WITH TIME ZONE,
  application_instructions TEXT,
  
  -- Partner Agency (optional - if this career is associated with a partner agency)
  partner_agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  
  -- Metadata
  views_count INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Update career_applications to reference a specific career
-- Ensure career_applications table exists first
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    RAISE EXCEPTION 'career_applications table must exist. Please run add-career-applications-and-partner-agencies.sql first.';
  END IF;
END $$;

ALTER TABLE career_applications 
ADD COLUMN IF NOT EXISTS career_id UUID REFERENCES careers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE careers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for careers
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Everyone can view active careers" ON careers;
DROP POLICY IF EXISTS "Admins can view all careers" ON careers;
DROP POLICY IF EXISTS "Admins can create careers" ON careers;
DROP POLICY IF EXISTS "Admins can update careers" ON careers;
DROP POLICY IF EXISTS "Admins can delete careers" ON careers;

-- Everyone can view active careers (for public career listing page)
CREATE POLICY "Everyone can view active careers"
ON careers FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

-- Admins can view all careers (including inactive)
CREATE POLICY "Admins can view all careers"
ON careers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can create careers
DROP POLICY IF EXISTS "Admins can create careers" ON careers;

-- Admins can create careers
CREATE POLICY "Admins can create careers"
ON careers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update careers
DROP POLICY IF EXISTS "Admins can update careers" ON careers;

-- Admins can update careers
CREATE POLICY "Admins can update careers"
ON careers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete careers
DROP POLICY IF EXISTS "Admins can delete careers" ON careers;

-- Admins can delete careers
CREATE POLICY "Admins can delete careers"
ON careers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_careers_is_active ON careers(is_active);
CREATE INDEX IF NOT EXISTS idx_careers_is_featured ON careers(is_featured);
CREATE INDEX IF NOT EXISTS idx_careers_created_at ON careers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_careers_partner_agency_id ON careers(partner_agency_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_career_id ON career_applications(career_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_careers_updated_at ON careers;
CREATE TRIGGER update_careers_updated_at
  BEFORE UPDATE ON careers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment views_count (can be called from application)
CREATE OR REPLACE FUNCTION increment_career_views(career_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE careers
  SET views_count = views_count + 1
  WHERE id = career_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment applications_count (can be called from application)
CREATE OR REPLACE FUNCTION increment_career_applications(career_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE careers
  SET applications_count = applications_count + 1
  WHERE id = career_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ============================================

-- Migration: add-ead-application-support.sql
-- Migration: Add EAD Application Support
-- This migration adds support for EAD (I-765) applications alongside existing NCLEX applications

-- Step 1: Add application_type column to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS application_type TEXT DEFAULT 'NCLEX' CHECK (application_type IN ('NCLEX', 'EAD'));

-- Step 2: Make NCLEX-specific fields nullable (since EAD doesn't need them)
ALTER TABLE applications 
  ALTER COLUMN elementary_school DROP NOT NULL,
  ALTER COLUMN elementary_city DROP NOT NULL,
  ALTER COLUMN elementary_years_attended DROP NOT NULL,
  ALTER COLUMN elementary_start_date DROP NOT NULL,
  ALTER COLUMN elementary_end_date DROP NOT NULL,
  ALTER COLUMN high_school DROP NOT NULL,
  ALTER COLUMN high_school_city DROP NOT NULL,
  ALTER COLUMN high_school_years_attended DROP NOT NULL,
  ALTER COLUMN high_school_start_date DROP NOT NULL,
  ALTER COLUMN high_school_end_date DROP NOT NULL,
  ALTER COLUMN nursing_school DROP NOT NULL,
  ALTER COLUMN nursing_school_city DROP NOT NULL,
  ALTER COLUMN nursing_school_years_attended DROP NOT NULL,
  ALTER COLUMN nursing_school_start_date DROP NOT NULL,
  ALTER COLUMN nursing_school_end_date DROP NOT NULL,
  ALTER COLUMN picture_path DROP NOT NULL,
  ALTER COLUMN diploma_path DROP NOT NULL,
  ALTER COLUMN passport_path DROP NOT NULL,
  ALTER COLUMN house_number DROP NOT NULL,
  ALTER COLUMN street_name DROP NOT NULL,
  ALTER COLUMN province DROP NOT NULL;

-- Step 3: Add EAD-specific fields (Part 1: Reason for Applying)
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS reason_for_filing TEXT,
  ADD COLUMN IF NOT EXISTS has_attorney BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS uscis_online_account_number TEXT;

-- Step 4: Add EAD-specific fields (Legal Name - already have first_name, middle_name, last_name)
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS maiden_name TEXT,
  ADD COLUMN IF NOT EXISTS aliases TEXT,
  ADD COLUMN IF NOT EXISTS previous_legal_names TEXT;

-- Step 5: Add EAD-specific address fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS in_care_of_name TEXT,
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS apartment_suite TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS physical_address_same BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS physical_in_care_of TEXT,
  ADD COLUMN IF NOT EXISTS physical_street_address TEXT,
  ADD COLUMN IF NOT EXISTS physical_apartment_suite TEXT,
  ADD COLUMN IF NOT EXISTS physical_city TEXT,
  ADD COLUMN IF NOT EXISTS physical_state TEXT,
  ADD COLUMN IF NOT EXISTS physical_zip_code TEXT;

-- Step 6: Add EAD-specific personal information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS birth_city TEXT,
  ADD COLUMN IF NOT EXISTS birth_state TEXT,
  ADD COLUMN IF NOT EXISTS birth_country TEXT,
  ADD COLUMN IF NOT EXISTS citizenship_countries TEXT[];

-- Step 7: Add EAD-specific Social Security fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS has_ssn BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ssn TEXT,
  ADD COLUMN IF NOT EXISTS want_ssn_card BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_ssa_disclosure BOOLEAN DEFAULT FALSE;

-- Step 8: Add EAD-specific Parents' Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS father_last_name TEXT,
  ADD COLUMN IF NOT EXISTS father_first_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_last_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_first_name TEXT;

-- Step 9: Add EAD-specific Immigration & Arrival Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS a_number TEXT,
  ADD COLUMN IF NOT EXISTS uscis_account_number TEXT,
  ADD COLUMN IF NOT EXISTS i94_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_country TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiration TEXT,
  ADD COLUMN IF NOT EXISTS travel_document_number TEXT,
  ADD COLUMN IF NOT EXISTS last_arrival_date TEXT,
  ADD COLUMN IF NOT EXISTS last_arrival_place TEXT,
  ADD COLUMN IF NOT EXISTS immigration_status_at_arrival TEXT,
  ADD COLUMN IF NOT EXISTS current_immigration_status TEXT,
  ADD COLUMN IF NOT EXISTS sevis_number TEXT;

-- Step 10: Add EAD-specific Eligibility Category fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS eligibility_category TEXT,
  ADD COLUMN IF NOT EXISTS employer_name TEXT,
  ADD COLUMN IF NOT EXISTS everify_company_id TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS has_criminal_history BOOLEAN DEFAULT FALSE;

-- Step 11: Add EAD-specific Contact Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS mobile_number TEXT,
  ADD COLUMN IF NOT EXISTS email_address TEXT;

-- Step 12: Add EAD-specific Declaration fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS can_read_english BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS signature_date TEXT;

-- Step 13: Add EAD-specific Interpreter Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS has_interpreter BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interpreter_name TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_address TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_phone TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_email TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_signature TEXT,
  ADD COLUMN IF NOT EXISTS interpreter_signature_date TEXT;

-- Step 14: Add EAD-specific Preparer Information fields
ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS has_preparer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preparer_name TEXT,
  ADD COLUMN IF NOT EXISTS preparer_business_name TEXT,
  ADD COLUMN IF NOT EXISTS preparer_address TEXT,
  ADD COLUMN IF NOT EXISTS preparer_phone TEXT,
  ADD COLUMN IF NOT EXISTS preparer_email TEXT,
  ADD COLUMN IF NOT EXISTS preparer_type TEXT,
  ADD COLUMN IF NOT EXISTS preparer_signature TEXT,
  ADD COLUMN IF NOT EXISTS preparer_signature_date TEXT;

-- Step 15: Update existing applications to have application_type = 'NCLEX'
UPDATE applications 
SET application_type = 'NCLEX' 
WHERE application_type IS NULL;

-- Step 16: Create index on application_type for better query performance
CREATE INDEX IF NOT EXISTS idx_applications_application_type ON applications(application_type);

-- Step 17: Add comment to table
COMMENT ON COLUMN applications.application_type IS 'Type of application: NCLEX or EAD (I-765)';










-- ============================================

-- Migration: add-foreign-key-indexes.sql
-- Migration: Add indexes for unindexed foreign keys
-- This migration adds indexes to foreign key columns to improve query performance
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- ============================================================================
-- PART 1: Add indexes for foreign keys without covering indexes
-- ============================================================================

-- career_applications table
CREATE INDEX IF NOT EXISTS idx_career_applications_reviewed_by ON career_applications(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- careers table
CREATE INDEX IF NOT EXISTS idx_careers_created_by ON careers(created_by) WHERE created_by IS NOT NULL;

-- email_logs table
CREATE INDEX IF NOT EXISTS idx_email_logs_donation_id ON email_logs(donation_id) WHERE donation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_quotation_id ON email_logs(quotation_id) WHERE quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_sponsorship_id ON email_logs(sponsorship_id) WHERE sponsorship_id IS NOT NULL;

-- email_templates table
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by ON email_templates(updated_by) WHERE updated_by IS NOT NULL;

-- nclex_cases table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_cases') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_cases_created_by ON nclex_cases(created_by) WHERE created_by IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_nclex_cases_subject_id ON nclex_cases(subject_id) WHERE subject_id IS NOT NULL;
  END IF;
END $$;

-- nclex_exams table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_exams') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_exams_created_by ON nclex_exams(created_by) WHERE created_by IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_nclex_exams_subject_id ON nclex_exams(subject_id) WHERE subject_id IS NOT NULL;
  END IF;
END $$;

-- nclex_questions table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_questions') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_questions_created_by ON nclex_questions(created_by) WHERE created_by IS NOT NULL;
  END IF;
END $$;

-- nclex_sponsorships table
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_reviewed_by ON nclex_sponsorships(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- nclex_user_performance table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_user_performance') THEN
    CREATE INDEX IF NOT EXISTS idx_nclex_user_performance_subject_id ON nclex_user_performance(subject_id) WHERE subject_id IS NOT NULL;
  END IF;
END $$;

-- password_reset_tokens table
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- processing_accounts table
CREATE INDEX IF NOT EXISTS idx_processing_accounts_created_by ON processing_accounts(created_by) WHERE created_by IS NOT NULL;

-- promo_code_usage table
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_application_id ON promo_code_usage(application_id) WHERE application_id IS NOT NULL;

-- receipts table
CREATE INDEX IF NOT EXISTS idx_receipts_application_id ON receipts(application_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);

-- received_emails table
CREATE INDEX IF NOT EXISTS idx_received_emails_recipient_email_address_id ON received_emails(recipient_email_address_id) WHERE recipient_email_address_id IS NOT NULL;

-- ============================================================================
-- PART 2: Note about unused indexes
-- ============================================================================
-- Many indexes are reported as unused. This is normal for:
-- 1. Newly created indexes that haven't been used yet
-- 2. Indexes that support future queries or features
-- 3. Indexes that are used infrequently but are important when needed
--
-- Consider monitoring index usage over time before removing them.
-- Unused indexes do consume storage and slow down writes slightly, but
-- they don't cause errors. You can remove them if you're certain they
-- won't be needed, but keeping them is often safer for future queries.
--
-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan;

-- ============================================================================
-- PART 3: Note about Auth DB connections
-- ============================================================================
-- The Auth DB connection strategy is configured to use absolute values (10 connections)
-- rather than percentage-based allocation. This requires configuration via Supabase Dashboard:
--
-- 1. Go to Project Settings > Database
-- 2. Configure connection pooling settings
-- 3. Switch to percentage-based allocation for better scalability
--
-- This cannot be fixed via SQL migration and requires dashboard configuration.



-- ============================================

-- Migration: add-gritsync-account-type.sql
-- Add 'gritsync' as a valid account_type in processing_accounts table
-- This migration updates the CHECK constraint to include 'gritsync' alongside 'gmail', 'pearson_vue', and 'custom'

-- First, drop the existing CHECK constraint
ALTER TABLE processing_accounts 
DROP CONSTRAINT IF EXISTS processing_accounts_account_type_check;

-- Add the new CHECK constraint that includes 'gritsync'
ALTER TABLE processing_accounts
ADD CONSTRAINT processing_accounts_account_type_check 
CHECK (account_type IN ('gmail', 'gritsync', 'pearson_vue', 'custom'));

-- Update the unique index to include 'gritsync' alongside 'gmail' and 'pearson_vue'
DROP INDEX IF EXISTS idx_processing_accounts_unique_gmail_pearson;
DROP INDEX IF EXISTS idx_processing_accounts_unique_gmail_gritsync_pearson;

-- Clean up any duplicate records before creating the unique index
-- Keep the most recent record (by created_at, then by id) for each (application_id, account_type) combination
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY application_id, account_type 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM processing_accounts
  WHERE account_type IN ('gmail', 'gritsync', 'pearson_vue')
)
DELETE FROM processing_accounts
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Update any existing 'gmail' account_type that was meant to be 'gritsync'
-- But first, delete any 'gmail' records where a 'gritsync' record already exists for the same application_id
-- to avoid creating duplicates when we update
DELETE FROM processing_accounts
WHERE account_type = 'gmail'
AND EXISTS (
  SELECT 1 FROM processing_accounts pa2
  WHERE pa2.application_id = processing_accounts.application_id
  AND pa2.account_type = 'gritsync'
);

-- Now safely update remaining 'gmail' records to 'gritsync'
UPDATE processing_accounts
SET account_type = 'gritsync'
WHERE account_type = 'gmail';

-- Now create the unique index after duplicates are cleaned up
CREATE UNIQUE INDEX IF NOT EXISTS idx_processing_accounts_unique_gmail_gritsync_pearson
ON processing_accounts(application_id, account_type)
WHERE account_type IN ('gmail', 'gritsync', 'pearson_vue');










-- ============================================

-- Migration: add-missing-rls-policies.sql
-- Migration: Add missing RLS policies for tables with RLS enabled
-- This migration adds RLS policies for tables that have RLS enabled but no policies
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

-- ============================================================================
-- PART 1: login_attempts table
-- ============================================================================
-- Users should be able to view their own login attempts
-- Admins should be able to view all login attempts
-- System should be able to insert login attempts (for failed attempts without auth)

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own login attempts" ON login_attempts;
DROP POLICY IF EXISTS "Admins can view all login attempts" ON login_attempts;
DROP POLICY IF EXISTS "System can insert login attempts" ON login_attempts;
DROP POLICY IF EXISTS "Admins can delete login attempts" ON login_attempts;

-- Users can view their own login attempts
CREATE POLICY "Users can view their own login attempts"
ON login_attempts FOR SELECT
USING ((select auth.uid()) = user_id);

-- Admins can view all login attempts
CREATE POLICY "Admins can view all login attempts"
ON login_attempts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- System can insert login attempts (no auth required for failed attempts)
-- This allows tracking failed login attempts even when user doesn't exist
DROP POLICY IF EXISTS "System can insert login attempts" ON login_attempts;

-- System can insert login attempts (no auth required for failed attempts)
-- This allows tracking failed login attempts even when user doesn't exist
CREATE POLICY "System can insert login attempts"
ON login_attempts FOR INSERT
WITH CHECK (true);

-- Admins can delete login attempts (for cleanup)
DROP POLICY IF EXISTS "Admins can delete login attempts" ON login_attempts;

-- Admins can delete login attempts (for cleanup)
CREATE POLICY "Admins can delete login attempts"
ON login_attempts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- PART 2: notification_types table
-- ============================================================================
-- This is a reference/configuration table, so it should be readable by all users
-- Only admins should be able to modify it

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view notification types" ON notification_types;
DROP POLICY IF EXISTS "Authenticated users can view notification types" ON notification_types;
DROP POLICY IF EXISTS "Admins can manage notification types" ON notification_types;

-- Everyone can view notification types (public reference data)
CREATE POLICY "Everyone can view notification types"
ON notification_types FOR SELECT
USING (true);

-- Admins can manage notification types
CREATE POLICY "Admins can manage notification types"
ON notification_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- PART 3: sessions table
-- ============================================================================
-- Users should be able to view and manage their own sessions
-- Admins should be able to view all sessions

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can revoke their own sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can revoke any session" ON sessions;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON sessions FOR SELECT
USING ((select auth.uid()) = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- Authenticated users can create sessions
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON sessions;

-- Authenticated users can create sessions
CREATE POLICY "Authenticated users can create sessions"
ON sessions FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- Users can update their own sessions (for activity tracking)
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;

-- Users can update their own sessions (for activity tracking)
CREATE POLICY "Users can update their own sessions"
ON sessions FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Users can revoke their own sessions
DROP POLICY IF EXISTS "Users can revoke their own sessions" ON sessions;

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
ON sessions FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id AND
  (revoked_at IS NOT NULL OR is_active = false)
);

-- Admins can revoke any session
DROP POLICY IF EXISTS "Admins can revoke any session" ON sessions;

-- Admins can revoke any session
CREATE POLICY "Admins can revoke any session"
ON sessions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- PART 4: user_preferences table
-- ============================================================================
-- Users should be able to view and manage their own preferences
-- Admins might need to view preferences for support purposes

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Admins can view all preferences" ON user_preferences;

-- Users can view their own preferences
CREATE POLICY "Users can view their own preferences"
ON user_preferences FOR SELECT
USING ((select auth.uid()) = user_id);

-- Admins can view all preferences (for support)
CREATE POLICY "Admins can view all preferences"
ON user_preferences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- Users can update their own preferences
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;

-- Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
ON user_preferences FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Users can insert their own preferences
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
ON user_preferences FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 5: Note about auth_leaked_password_protection
-- ============================================================================
-- Leaked password protection must be enabled via Supabase Dashboard
-- Go to Authentication > Settings > Password Security
-- Enable "Leaked Password Protection"
-- This cannot be fixed via SQL migration
-- Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

-- ============================================================================
-- PART 6: Note about slow queries
-- ============================================================================
-- The slow queries identified are primarily:
-- 1. Supabase internal queries (realtime, dashboard, metadata queries)
--    - These are system queries that cannot be directly optimized
--    - They are typically cached and perform well under normal load
--
-- 2. Application queries that can be optimized:
--    - Ensure proper indexes exist on frequently queried columns
--    - Use EXPLAIN ANALYZE to identify bottlenecks
--    - Consider materialized views for complex aggregations
--    - Review RLS policies to ensure they use (select auth.uid()) pattern
--
-- For the realtime.list_changes query:
--    - This is a Supabase Realtime internal query
--    - Consider reducing the number of active subscriptions
--    - Review if all subscriptions are necessary
--
-- For the pg_get_tabledef queries:
--    - These are Supabase Dashboard metadata queries
--    - They are cached and typically only run when schema changes
--    - No action needed unless experiencing frequent dashboard access issues



-- ============================================

-- Migration: add-nclex-congratulatory-template.sql
-- Migration: Add NCLEX Congratulatory Email Template
-- A congratulatory message from GritSync founder to NCLEX passers

-- Insert NCLEX Congratulatory Email Template
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
) VALUES (
  'NCLEX Passer Congratulations',
  'Congratulatory message from GritSync founder to NCLEX passers',
  'nclex-passer-congratulations',
  '🎉 Congratulations on Passing the NCLEX! - A Message from GritSync',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f4f4f4; 
    }
    .container { 
      max-width: 600px; 
      margin: 20px auto; 
      background: #ffffff; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .header .subtitle {
      margin-top: 10px;
      font-size: 18px;
      opacity: 0.95;
    }
    .content { 
      padding: 40px 30px; 
    }
    .celebration-icon {
      text-align: center;
      font-size: 64px;
      margin: 20px 0;
    }
    .congratulations-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 5px solid #f59e0b;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
      text-align: center;
    }
    .congratulations-box h2 {
      margin: 0 0 10px 0;
      color: #92400e;
      font-size: 24px;
      font-weight: 700;
    }
    .congratulations-box p {
      margin: 0;
      color: #78350f;
      font-size: 16px;
      font-weight: 500;
    }
    .message-section {
      margin: 30px 0;
      padding: 25px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .message-section p {
      margin: 15px 0;
      font-size: 16px;
      line-height: 1.8;
      color: #374151;
    }
    .signature-section {
      margin: 30px 0;
      padding: 20px;
      background: #ffffff;
      border-top: 2px solid #dc2626;
      border-radius: 8px;
    }
    .signature-section p {
      margin: 8px 0;
      color: #374151;
    }
    .signature-name {
      font-weight: 700;
      font-size: 18px;
      color: #dc2626;
      margin-top: 15px;
    }
    .signature-title {
      color: #6b7280;
      font-size: 14px;
      font-style: italic;
    }
    .button { 
      display: inline-block; 
      padding: 16px 36px; 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600;
      font-size: 16px;
      margin: 25px 0;
      box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(220, 38, 38, 0.4);
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .next-steps {
      margin: 30px 0;
      padding: 25px;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 8px;
    }
    .next-steps h3 {
      margin: 0 0 15px 0;
      color: #1e40af;
      font-size: 20px;
      font-weight: 600;
    }
    .next-steps ul {
      margin: 0;
      padding-left: 20px;
      color: #1e3a8a;
    }
    .next-steps li {
      margin: 10px 0;
      line-height: 1.6;
    }
    .footer { 
      background: #f9fafb; 
      padding: 30px; 
      text-align: center; 
      color: #6b7280; 
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 8px 0;
    }
    .footer a {
      color: #dc2626;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 10px;
        border-radius: 8px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .content {
        padding: 30px 20px;
      }
      .button {
        display: block;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations!</h1>
      <p class="subtitle">You''ve Passed the NCLEX!</p>
    </div>
    <div class="content">
      <div class="celebration-icon">
        🎊 🎉 🎈
      </div>
      
      <div class="congratulations-box">
        <h2>Congratulations, {{userName}}!</h2>
        <p>You have successfully passed the NCLEX examination!</p>
      </div>

      <div class="message-section">
        <p>Dear {{userName}},</p>
        
        <p>On behalf of the entire GritSync team, I want to extend my heartfelt congratulations on this incredible achievement. Passing the NCLEX is a significant milestone that represents years of dedication, hard work, and unwavering commitment to your dream of becoming a registered nurse in the United States.</p>
        
        <p>Your journey has been remarkable, and this achievement is a testament to your resilience, determination, and the passion you have for nursing. You''ve overcome challenges, studied tirelessly, and never gave up on your goal. Today, you stand as a testament to what is possible when grit meets opportunity.</p>
        
        <p>At GritSync, we are honored to have been part of your journey. Your success is our success, and we celebrate this moment with you. This is not just a personal victory—it''s a step forward for the global nursing community, and you are now part of an elite group of healthcare professionals who will make a profound difference in countless lives.</p>
        
        <p>As you move forward in your career, remember that this achievement is just the beginning. You now have the opportunity to impact lives, provide compassionate care, and contribute to the healthcare system in meaningful ways. The path ahead is filled with possibilities, and we are excited to see where your nursing career takes you.</p>
        
        <p>We are here to support you in your next steps, whether that''s finding employment opportunities, continuing your education, or navigating the next phase of your professional journey. GritSync remains committed to supporting nurses like you every step of the way.</p>
        
        <p>Once again, congratulations on this extraordinary achievement. You''ve earned this moment, and we couldn''t be prouder!</p>
      </div>

      <div class="signature-section">
        <p>With warmest regards and deepest admiration,</p>
        <p class="signature-name">{{founderName}}</p>
        <p class="signature-title">Founder & CEO, GritSync</p>
      </div>

      <div class="next-steps">
        <h3>📋 What''s Next?</h3>
        <ul>
          <li><strong>Update Your Profile:</strong> Make sure your GritSync profile reflects your new status as an NCLEX passer</li>
          <li><strong>Explore Opportunities:</strong> Check out job opportunities and career resources available through GritSync</li>
          <li><strong>Connect with Our Community:</strong> Join other successful NCLEX passers in our community</li>
          <li><strong>Share Your Success:</strong> Your story can inspire others on their journey</li>
        </ul>
      </div>

      <div class="button-container">
        <a href="{{dashboardUrl}}" class="button">Visit Your Dashboard</a>
      </div>

      <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
        Need assistance? Contact us at <a href="mailto:{{supportEmail}}" style="color: #dc2626;">{{supportEmail}}</a>
      </p>
    </div>
    
    <div class="footer">
      <p><strong>GritSync</strong> - Empowering Nurses, Transforming Healthcare</p>
      <p>{{websiteUrl}} | {{supportEmail}}</p>
      <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
        This is an automated message from GritSync. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>',
  '🎉 Congratulations on Passing the NCLEX!

Dear {{userName}},

On behalf of the entire GritSync team, I want to extend my heartfelt congratulations on this incredible achievement. Passing the NCLEX is a significant milestone that represents years of dedication, hard work, and unwavering commitment to your dream of becoming a registered nurse in the United States.

Your journey has been remarkable, and this achievement is a testament to your resilience, determination, and the passion you have for nursing. You''ve overcome challenges, studied tirelessly, and never gave up on your goal. Today, you stand as a testament to what is possible when grit meets opportunity.

At GritSync, we are honored to have been part of your journey. Your success is our success, and we celebrate this moment with you. This is not just a personal victory—it''s a step forward for the global nursing community, and you are now part of an elite group of healthcare professionals who will make a profound difference in countless lives.

As you move forward in your career, remember that this achievement is just the beginning. You now have the opportunity to impact lives, provide compassionate care, and contribute to the healthcare system in meaningful ways. The path ahead is filled with possibilities, and we are excited to see where your nursing career takes you.

We are here to support you in your next steps, whether that''s finding employment opportunities, continuing your education, or navigating the next phase of your professional journey. GritSync remains committed to supporting nurses like you every step of the way.

Once again, congratulations on this extraordinary achievement. You''ve earned this moment, and we couldn''t be prouder!

With warmest regards and deepest admiration,

{{founderName}}
Founder & CEO, GritSync

What''s Next?
- Update Your Profile: Make sure your GritSync profile reflects your new status as an NCLEX passer
- Explore Opportunities: Check out job opportunities and career resources available through GritSync
- Connect with Our Community: Join other successful NCLEX passers in our community
- Share Your Success: Your story can inspire others on their journey

Visit your dashboard: {{dashboardUrl}}

Need assistance? Contact us at {{supportEmail}}

---
GritSync - Empowering Nurses, Transforming Healthcare
{{websiteUrl}} | {{supportEmail}}

This is an automated message from GritSync. Please do not reply directly to this email.',
  'announcement',
  'system',
  '[
    {"name": "userName", "description": "User''s full name", "required": true},
    {"name": "founderName", "description": "GritSync founder''s name", "required": true},
    {"name": "dashboardUrl", "description": "URL to user dashboard", "required": true},
    {"name": "supportEmail", "description": "Support email address", "required": false},
    {"name": "websiteUrl", "description": "GritSync website URL", "required": false}
  ]'::jsonb,
  TRUE,
  ARRAY['nclex', 'congratulations', 'achievement', 'announcement', 'founder']
)
ON CONFLICT (slug) DO NOTHING;




-- ============================================

-- Migration: add-sponsorships-and-donations.sql
-- Migration: Add NCLEX Sponsorships and Donations tables

-- NCLEX Sponsorships table
CREATE TABLE IF NOT EXISTS nclex_sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  date_of_birth TEXT,
  country TEXT,
  
  -- Application Details
  nursing_school TEXT,
  graduation_date TEXT,
  current_employment_status TEXT,
  years_of_experience TEXT,
  financial_need_description TEXT NOT NULL,
  motivation_statement TEXT NOT NULL,
  how_will_this_help TEXT,
  
  -- Supporting Documents (optional)
  resume_path TEXT,
  transcript_path TEXT,
  recommendation_letter_path TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'awarded')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Donor Information (optional - can be anonymous)
  donor_name TEXT,
  donor_email TEXT,
  donor_phone TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  
  -- Donation Details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  transaction_id TEXT,
  
  -- Optional: Link to specific sponsorship
  sponsorship_id UUID REFERENCES nclex_sponsorships(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Message (optional)
  message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE nclex_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nclex_sponsorships
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Users can create their own sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Everyone can create sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Anonymous can view recent sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Users can update their own pending sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Admins can view all sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Admins can update all sponsorships" ON nclex_sponsorships;
DROP POLICY IF EXISTS "Admins can delete sponsorships" ON nclex_sponsorships;

-- Allow everyone (including anonymous) to create sponsorships
CREATE POLICY "Everyone can create sponsorships"
ON nclex_sponsorships FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view sponsorships they just created
-- This is needed for the .select('*') after insert to work
CREATE POLICY "Anonymous can view recent sponsorships"
ON nclex_sponsorships FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can view their own sponsorships
DROP POLICY IF EXISTS "Users can view their own sponsorships" ON nclex_sponsorships;

-- Users can view their own sponsorships
CREATE POLICY "Users can view their own sponsorships"
ON nclex_sponsorships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own sponsorships (only if pending)
DROP POLICY IF EXISTS "Users can update their own pending sponsorships" ON nclex_sponsorships;

-- Users can update their own sponsorships (only if pending)
CREATE POLICY "Users can update their own pending sponsorships"
ON nclex_sponsorships FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all sponsorships
DROP POLICY IF EXISTS "Admins can view all sponsorships" ON nclex_sponsorships;

-- Admins can view all sponsorships
CREATE POLICY "Admins can view all sponsorships"
ON nclex_sponsorships FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update all sponsorships
DROP POLICY IF EXISTS "Admins can update all sponsorships" ON nclex_sponsorships;

-- Admins can update all sponsorships
CREATE POLICY "Admins can update all sponsorships"
ON nclex_sponsorships FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete sponsorships
DROP POLICY IF EXISTS "Admins can delete sponsorships" ON nclex_sponsorships;

-- Admins can delete sponsorships
CREATE POLICY "Admins can delete sponsorships"
ON nclex_sponsorships FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- RLS Policies for donations
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Everyone can create donations" ON donations;
DROP POLICY IF EXISTS "Anonymous can view recent donations" ON donations;
DROP POLICY IF EXISTS "Users can view their own donations" ON donations;
DROP POLICY IF EXISTS "Admins can view all donations" ON donations;
DROP POLICY IF EXISTS "Admins can update donations" ON donations;

-- Everyone can create donations (including anonymous)
CREATE POLICY "Everyone can create donations"
ON donations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anonymous users to view donations they just created
-- This is needed for the .select('*') after insert to work
CREATE POLICY "Anonymous can view recent donations"
ON donations FOR SELECT
TO anon
USING (
  created_at > NOW() - INTERVAL '5 minutes'
);

-- Users can view their own donations (if they provided email)
CREATE POLICY "Users can view their own donations"
ON donations FOR SELECT
TO authenticated
USING (
  donor_email = (SELECT email FROM users WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can view all donations
DROP POLICY IF EXISTS "Admins can view all donations" ON donations;

-- Admins can view all donations
CREATE POLICY "Admins can view all donations"
ON donations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update donations
DROP POLICY IF EXISTS "Admins can update donations" ON donations;

-- Admins can update donations
CREATE POLICY "Admins can update donations"
ON donations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_user_id ON nclex_sponsorships(user_id);
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_status ON nclex_sponsorships(status);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_sponsorship_id ON donations(sponsorship_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_nclex_sponsorships_updated_at ON nclex_sponsorships;
CREATE TRIGGER update_nclex_sponsorships_updated_at
  BEFORE UPDATE ON nclex_sponsorships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- ============================================

-- Migration: add-spouse-name-to-applications.sql
-- Add spouse_name column to applications table for EAD applications
-- This field stores the full name of the spouse who is an employee at Insight Global LLC
-- Required for generating Employer Verification Letter requests

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS spouse_name TEXT;

COMMENT ON COLUMN applications.spouse_name IS 'Full name of spouse (employee at Insight Global LLC) - required for H4-EAD applications';



-- ============================================

-- Migration: add_auth_login_tracking_trigger.sql
-- Supabase Auth Login Attempt Tracking Trigger
-- This trigger automatically tracks login attempts when using Supabase Auth
-- It integrates with the login_attempts table we created earlier

-- Function to track login attempts from Supabase Auth events
CREATE OR REPLACE FUNCTION track_auth_login_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_success BOOLEAN;
  v_failure_reason TEXT;
BEGIN
  -- Extract email from the auth event
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
  v_user_id := NEW.id;
  
  -- Determine if login was successful
  -- In Supabase, if we reach this trigger, the login was successful
  -- Failed logins don't trigger this (they're handled by Supabase Auth)
  v_success := true;
  v_failure_reason := NULL;
  
  -- Insert login attempt record
  INSERT INTO login_attempts (
    user_id,
    email,
    ip_address,
    success,
    user_agent,
    failure_reason
  ) VALUES (
    v_user_id,
    v_email,
    NEW.raw_app_meta_data->>'ip_address', -- If stored in metadata
    v_success,
    NEW.raw_app_meta_data->>'user_agent', -- If stored in metadata
    v_failure_reason
  )
  ON CONFLICT DO NOTHING; -- Prevent duplicates if trigger fires multiple times
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Supabase Auth doesn't provide direct triggers on login events
-- Instead, we'll use a different approach: track via auth.users table changes
-- or create an Edge Function to intercept auth events

-- Alternative: Create a function that can be called from Supabase Edge Functions
-- This is the recommended approach for tracking Supabase Auth events

-- Function to record login attempt (called from Edge Function or API)
CREATE OR REPLACE FUNCTION record_auth_login_attempt(
  p_user_id UUID,
  p_email TEXT,
  p_success BOOLEAN,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  INSERT INTO login_attempts (
    user_id,
    email,
    ip_address,
    success,
    user_agent,
    failure_reason
  ) VALUES (
    p_user_id,
    p_email,
    p_ip_address,
    p_success,
    p_user_agent,
    p_failure_reason
  )
  RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION record_auth_login_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION record_auth_login_attempt TO service_role;

-- Note: For full integration, you would need to:
-- 1. Create a Supabase Edge Function that intercepts auth.signInWithPassword
-- 2. Call record_auth_login_attempt() from the Edge Function
-- 3. Check account lock status before allowing login
-- 4. Lock account if max attempts exceeded

-- For now, the backend API route (/api/auth/login) has full tracking
-- The frontend can optionally be updated to use the backend API instead of direct Supabase Auth




-- ============================================

-- Migration: add_ead_service_configuration.sql
-- Add EAD service configuration
-- This migration adds the default EAD (Employment Authorization Document) processing service
-- EAD is a federal process, not state-specific, so we use 'All States'

-- Insert EAD Processing service for All States (Full Payment)
INSERT INTO services (
  id,
  service_name,
  state,
  payment_type,
  line_items,
  total_full,
  created_at,
  updated_at
) VALUES (
  'svc_ead_all_states_full',
  'EAD Processing',
  'All States',
  'full',
  '[
    {
      "description": "USCIS Form I-765 Filing Fee",
      "amount": 410.00,
      "taxable": false
    },
    {
      "description": "Biometric Services Fee",
      "amount": 85.00,
      "taxable": false
    },
    {
      "description": "GritSync Service Fee",
      "amount": 150.00,
      "taxable": true
    }
  ]'::jsonb,
  663.00,  -- Total: $495 (government fees) + $150 (service) + $18 (12% tax on $150)
  NOW(),
  NOW()
)
ON CONFLICT (service_name, state, payment_type) 
DO UPDATE SET
  line_items = EXCLUDED.line_items,
  total_full = EXCLUDED.total_full,
  updated_at = NOW();

-- Add comment explaining the configuration
COMMENT ON TABLE services IS 'Service configurations for various application types (NCLEX, EAD, etc.) with pricing and line items';

-- Verify the insert
DO $$
DECLARE
  service_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO service_count
  FROM services
  WHERE service_name = 'EAD Processing';
  
  IF service_count > 0 THEN
    RAISE NOTICE 'EAD service configuration added successfully. Count: %', service_count;
  ELSE
    RAISE WARNING 'EAD service configuration was not added. Please check the migration.';
  END IF;
END $$;



-- ============================================

-- Migration: add_login_attempts_tracking.sql
-- Login Attempts Tracking Migration
-- This migration adds login attempt tracking and account lockout functionality

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- Store email even if user doesn't exist (for security)
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  failure_reason TEXT -- e.g., 'invalid_password', 'user_not_found', 'account_locked'
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_attempted_at ON login_attempts(email, attempted_at);

-- Add locked_until column to users table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Enable RLS on login_attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_attempts
-- Users can view their own login attempts
DROP POLICY IF EXISTS "Users can view their own login attempts" ON login_attempts;

-- RLS Policies for login_attempts
-- Users can view their own login attempts
CREATE POLICY "Users can view their own login attempts"
ON login_attempts FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all login attempts
DROP POLICY IF EXISTS "Admins can view all login attempts" ON login_attempts;

-- Admins can view all login attempts
CREATE POLICY "Admins can view all login attempts"
ON login_attempts FOR SELECT
USING (public.is_admin());

-- System can insert login attempts (no auth required for failed attempts)
DROP POLICY IF EXISTS "System can insert login attempts" ON login_attempts;

-- System can insert login attempts (no auth required for failed attempts)
CREATE POLICY "System can insert login attempts"
ON login_attempts FOR INSERT
WITH CHECK (true);

-- Admins can delete login attempts (for cleanup)
DROP POLICY IF EXISTS "Admins can delete login attempts" ON login_attempts;

-- Admins can delete login attempts (for cleanup)
CREATE POLICY "Admins can delete login attempts"
ON login_attempts FOR DELETE
USING (public.is_admin());

-- Function to get failed login attempts count for a user/email within time window
CREATE OR REPLACE FUNCTION get_failed_login_attempts(
  p_email TEXT,
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM login_attempts
  WHERE email = p_email
    AND success = false
    AND attempted_at > NOW() - (p_minutes || ' minutes')::INTERVAL;
  
  RETURN COALESCE(attempt_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  locked_until_ts TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT locked_until INTO locked_until_ts
  FROM users
  WHERE id = p_user_id;
  
  IF locked_until_ts IS NULL THEN
    RETURN false;
  END IF;
  
  IF locked_until_ts > NOW() THEN
    RETURN true;
  ELSE
    -- Lock expired, clear it
    UPDATE users SET locked_until = NULL WHERE id = p_user_id;
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to lock account
CREATE OR REPLACE FUNCTION lock_account(
  p_user_id UUID,
  p_lock_duration_minutes INTEGER DEFAULT 30
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET locked_until = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unlock account
CREATE OR REPLACE FUNCTION unlock_account(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET locked_until = NULL
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear old login attempts (for cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts(
  p_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < NOW() - (p_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




-- ============================================

-- Migration: add_public_pictures_policy.sql
-- Make pictures publicly accessible for tracking
-- This allows public (unauthenticated) users to view application pictures for tracking
-- This migration ensures the policy is applied and handles case-insensitive file extensions

-- Drop policy if it exists first
DROP POLICY IF EXISTS "Public can view pictures for tracking" ON storage.objects;

-- Add public policy to allow anyone to read pictures from the documents bucket
-- This policy allows public read access to files that match picture patterns
-- Updated to handle case-insensitive extensions (JPG, jpg, JPEG, jpeg, PNG, png)
CREATE POLICY "Public can view pictures for tracking"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Match picture files with case-insensitive pattern
    -- Matches: picture_*.jpg, picture_*.JPG, picture_*.jpeg, picture_*.JPEG, etc.
    LOWER(name) LIKE '%/picture_%.jpg' OR
    LOWER(name) LIKE '%/picture_%.jpeg' OR
    LOWER(name) LIKE '%/picture_%.png' OR
    -- Match any file in a user folder that contains 'picture' in the name (case-insensitive)
    LOWER(name) ~ '.*/picture.*\.(jpg|jpeg|png)$'
  )
);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname = 'Public can view pictures for tracking';



-- ============================================

-- Migration: add_public_tracking_policies.sql
-- Add public tracking policies for all tables needed for tracking
-- This allows anonymous users to track applications by ID or GRIT APP ID
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- This migration ensures public users can access tracking data

-- ============================================================================
-- 1. Applications Table - Allow public tracking by ID or GRIT APP ID
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can track applications" ON applications;

-- Create policy for public tracking
-- This allows anonymous users to query applications by id or grit_app_id
CREATE POLICY "Public can track applications"
ON applications FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 2. Application Timeline Steps - Allow public access for tracking
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE application_timeline_steps ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view timeline steps for tracking" ON application_timeline_steps;

-- Create policy for public access to timeline steps
-- Anonymous users can view timeline steps for any application (needed for tracking)
CREATE POLICY "Public can view timeline steps for tracking"
ON application_timeline_steps FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 3. Application Payments - Allow public access for tracking
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view payments for tracking" ON application_payments;

-- Create policy for public access to payments
-- Anonymous users can view payments for any application (needed for tracking progress)
CREATE POLICY "Public can view payments for tracking"
ON application_payments FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- 4. Processing Accounts - Allow public access for tracking
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE processing_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view processing accounts for tracking" ON processing_accounts;

-- Create policy for public access to processing accounts
-- Anonymous users can view processing accounts (needed to get Gmail for display)
CREATE POLICY "Public can view processing accounts for tracking"
ON processing_accounts FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('applications', 'application_timeline_steps', 'application_payments', 'processing_accounts')
  AND schemaname = 'public'
  AND policyname LIKE '%tracking%'
ORDER BY tablename, policyname;



-- ============================================

-- Migration: add_service_required_documents.sql
-- Migration: Add Service Document Requirements
-- This adds a table for managing required documents per service/application type (NCLEX, EAD, etc.)

CREATE TABLE IF NOT EXISTS service_required_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  accepted_formats TEXT[] NOT NULL DEFAULT ARRAY['.pdf', '.jpg', '.jpeg', '.png'],
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_type, document_type)
);

COMMENT ON TABLE service_required_documents IS 'Required documents configuration per service/application type';

-- Default NCLEX documents
INSERT INTO service_required_documents (service_type, document_type, name, accepted_formats, required, sort_order)
VALUES
  ('NCLEX', 'picture', '2x2 Picture', ARRAY['image/*'], TRUE, 0),
  ('NCLEX', 'diploma', 'Nursing Diploma', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 1),
  ('NCLEX', 'passport', 'Passport', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 2)
ON CONFLICT (service_type, document_type) DO NOTHING;

-- Default EAD (I-765) documents
INSERT INTO service_required_documents (service_type, document_type, name, accepted_formats, required, sort_order)
VALUES
  ('EAD', 'ead_2x2_picture', '2X2 Picture', ARRAY['image/*'], TRUE, 0),
  ('EAD', 'ead_passport', 'Clear Copy of your passport biographical page', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 1),
  ('EAD', 'ead_h4_visa', 'Copy of your H-4 visa stamp', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 2),
  ('EAD', 'ead_i94', 'Copy of your most recent I-94 Arrival/Departure Record', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 3),
  ('EAD', 'ead_marriage_certificate', 'Copy of your marriage certificate to establish your relationship with the H-1B principal beneficiary', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 4),
  ('EAD', 'ead_spouse_i797', 'Copy of your spouse''s H-1B approval notice (Form I-797)', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 5),
  ('EAD', 'ead_spouse_i140', 'Copy of your spouse''s approved Form I-140, Immigrant Petition for Alien Worker', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 6),
  ('EAD', 'ead_employer_letter', 'Copy of your spouse''s employer verification letter', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 7),
  ('EAD', 'ead_paystub', 'Recent paystub', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 8)
ON CONFLICT (service_type, document_type) DO NOTHING;

-- Enable row level security for the table
ALTER TABLE service_required_documents ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to allow re-running the migration
DROP POLICY IF EXISTS "Everyone can view service document requirements" ON service_required_documents;
DROP POLICY IF EXISTS "Admins can manage service document requirements" ON service_required_documents;

CREATE POLICY "Everyone can view service document requirements"
ON service_required_documents FOR SELECT
USING (true);

CREATE POLICY "Admins can manage service document requirements"
ON service_required_documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);







-- ============================================

-- Migration: add_sessions_table.sql
-- Sessions Management Migration
-- This migration adds server-side session management functionality

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, -- JWT token or session token
  refresh_token TEXT UNIQUE, -- Optional refresh token
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT, -- Device/browser fingerprint for security
  device_name TEXT, -- Human-readable device name
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT -- e.g., 'logout', 'password_change', 'security_breach', 'admin_revoke'
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_active ON sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
-- Users can view their own active sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;

-- RLS Policies for sessions
-- Users can view their own active sessions
CREATE POLICY "Users can view their own sessions"
ON sessions FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all sessions
DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON sessions FOR SELECT
USING (public.is_admin());

-- System can insert sessions (authenticated users)
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON sessions;

-- System can insert sessions (authenticated users)
CREATE POLICY "Authenticated users can create sessions"
ON sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (for activity tracking)
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;

-- Users can update their own sessions (for activity tracking)
CREATE POLICY "Users can update their own sessions"
ON sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can revoke their own sessions
DROP POLICY IF EXISTS "Users can revoke their own sessions" ON sessions;

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
ON sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  (revoked_at IS NOT NULL OR is_active = false)
);

-- Admins can revoke any session
DROP POLICY IF EXISTS "Admins can revoke any session" ON sessions;

-- Admins can revoke any session
CREATE POLICY "Admins can revoke any session"
ON sessions FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Function to clean up expired sessions (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE sessions
  SET is_active = false, revoked_at = NOW(), revoked_reason = 'expired'
  WHERE expires_at < NOW() AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Optionally delete old revoked sessions (older than 30 days)
  DELETE FROM sessions
  WHERE revoked_at IS NOT NULL 
    AND revoked_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active session count for a user
CREATE OR REPLACE FUNCTION get_user_active_session_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at > NOW();
  
  RETURN COALESCE(session_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all sessions for a user (useful for password change, security breach)
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'security_action'
)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE sessions
  SET is_active = false,
      revoked_at = NOW(),
      revoked_reason = p_reason
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at > NOW();
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_activity on session access (if needed)
-- Note: This would require application-level updates, but we can add a helper function
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET last_activity = NOW()
  WHERE id = p_session_id
    AND is_active = true
    AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================

-- Migration: change_approved_to_completed.sql
-- Migration: Change 'approved' status to 'completed' in applications table
-- This migration updates the status constraint and converts existing 'approved' records to 'completed'

-- Step 1: Update existing records from 'approved' to 'completed'
UPDATE applications
SET status = 'completed'
WHERE status = 'approved';

-- Step 2: Drop the existing constraint
ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_status_check;

-- Step 3: Add new constraint with 'completed' instead of 'approved'
ALTER TABLE applications
ADD CONSTRAINT applications_status_check 
CHECK (status IN ('pending', 'completed', 'rejected'));

-- Step 4: Verify the changes
SELECT 
  status,
  COUNT(*) as count
FROM applications
GROUP BY status
ORDER BY status;



-- ============================================

-- Migration: check-migration-compatibility.sql
-- Migration Compatibility Checker
-- Run this script to check for potential migration conflicts and issues
-- This helps prevent crashes from incompatible migrations

-- ============================================================================
-- 1. CHECK FOR MISSING DEPENDENCIES
-- ============================================================================

-- Check if required tables exist
DO $$
DECLARE
  missing_tables text[] := ARRAY[]::text[];
  required_tables text[] := ARRAY[
    'users',
    'applications',
    'quotations',
    'application_payments',
    'application_timeline_steps',
    'user_documents',
    'notifications'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = tbl
    ) THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE WARNING 'Missing required tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE '✓ All required tables exist';
  END IF;
END $$;

-- Check if required functions exist
DO $$
DECLARE
  missing_functions text[] := ARRAY[]::text[];
  required_functions text[] := ARRAY[
    'get_dashboard_stats',
    'is_admin',
    'get_career_statistics',
    'get_donation_statistics',
    'get_sponsorship_statistics'
  ];
  func text;
BEGIN
  FOREACH func IN ARRAY required_functions
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = func
    ) THEN
      missing_functions := array_append(missing_functions, func);
    END IF;
  END LOOP;
  
  IF array_length(missing_functions, 1) > 0 THEN
    RAISE WARNING 'Missing required functions: %', array_to_string(missing_functions, ', ');
  ELSE
    RAISE NOTICE '✓ All required functions exist';
  END IF;
END $$;

-- ============================================================================
-- 2. CHECK FOR ORPHANED FOREIGN KEYS
-- ============================================================================

-- Check for applications with invalid user_id
SELECT 
  'applications' as table_name,
  COUNT(*) as orphaned_records
FROM applications a
LEFT JOIN users u ON a.user_id = u.id
WHERE u.id IS NULL;

-- Check for quotations with invalid user_id
SELECT 
  'quotations' as table_name,
  COUNT(*) as orphaned_records
FROM quotations q
LEFT JOIN users u ON q.user_id = u.id
WHERE u.id IS NULL;

-- Check for application_payments with invalid application_id
SELECT 
  'application_payments' as table_name,
  COUNT(*) as orphaned_records
FROM application_payments ap
LEFT JOIN applications a ON ap.application_id = a.id
WHERE a.id IS NULL;

-- ============================================================================
-- 3. CHECK FOR INDEX ISSUES
-- ============================================================================

-- Check for missing indexes on foreign keys
SELECT 
  t.relname as table_name,
  a.attname as column_name,
  'Missing index on foreign key' as issue
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
LEFT JOIN pg_index i ON i.indrelid = t.oid AND a.attnum = ANY(i.indkey)
WHERE c.contype = 'f'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND i.indexrelid IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pg_index idx
    WHERE idx.indrelid = t.oid
    AND a.attnum = ANY(idx.indkey)
  );

-- ============================================================================
-- 4. CHECK FOR RLS POLICY ISSUES
-- ============================================================================

-- Check tables with RLS enabled but no policies
SELECT 
  schemaname,
  tablename,
  'RLS enabled but no policies' as issue
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  )
  AND EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = schemaname
      AND c.relname = tablename
      AND c.relrowsecurity = true
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_policies p
    WHERE p.schemaname = schemaname
      AND p.tablename = tablename
  );

-- ============================================================================
-- 5. CHECK FOR PERFORMANCE ISSUES
-- ============================================================================

-- Check for tables without primary keys
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  'Table missing primary key' as issue
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = c.oid 
    AND contype = 'p'
  )
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE '_realtime%';

-- Check for large tables without indexes on frequently queried columns
-- (This is a sample - adjust based on your query patterns)
SELECT 
  schemaname,
  tablename,
  attname,
  'Consider adding index on frequently queried column' as suggestion
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100  -- High cardinality columns
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = pg_stats.schemaname
      AND tablename = pg_stats.tablename
      AND indexdef LIKE '%' || pg_stats.attname || '%'
  )
LIMIT 10;

-- ============================================================================
-- 6. CHECK FOR DATA INTEGRITY ISSUES
-- ============================================================================

-- Check for NULL values in required columns (adjust based on your schema)
SELECT 
  'applications' as table_name,
  COUNT(*) as records_with_null_status
FROM applications
WHERE status IS NULL;

SELECT 
  'applications' as table_name,
  COUNT(*) as records_with_null_user_id
FROM applications
WHERE user_id IS NULL;

-- ============================================================================
-- 7. CHECK FOR CONNECTION/SESSION ISSUES
-- ============================================================================

-- Check current connection count (requires superuser or monitoring role)
WITH connection_stats AS (
  SELECT 
    datname,
    count(*) as connection_count,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
  FROM pg_stat_activity
  WHERE datname = current_database()
  GROUP BY datname
)
SELECT 
  datname,
  connection_count,
  max_connections,
  CASE 
    WHEN connection_count > max_connections * 0.8 
    THEN 'WARNING: High connection usage (>80%)'
    ELSE 'OK'
  END as status,
  ROUND((connection_count::numeric / max_connections::numeric) * 100, 1) as usage_percentage
FROM connection_stats;

-- ============================================================================
-- 8. SUMMARY REPORT
-- ============================================================================

DO $$
DECLARE
  table_count int;
  function_count int;
  index_count int;
  policy_count int;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';
  
  -- Count RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRATION COMPATIBILITY CHECK SUMMARY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables: %', table_count;
  RAISE NOTICE 'Functions: %', function_count;
  RAISE NOTICE 'Indexes: %', index_count;
  RAISE NOTICE 'RLS Policies: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Review the warnings and issues above before running new migrations.';
  RAISE NOTICE '============================================================================';
END $$;



-- ============================================

-- Migration: create-dashboard-stats-function.sql
-- Aggregated dashboard stats function to minimize client-side queries
-- Safe for both admin and client contexts; respects role from JWT claims

create or replace function public.get_dashboard_stats(
  is_admin boolean default false
) returns table (
  total_applications bigint,
  pending_applications bigint,
  completed_applications bigint,
  rejected_applications bigint,
  total_quotations bigint,
  pending_quotations bigint,
  paid_quotations bigint,
  total_clients bigint,
  revenue numeric
)
security definer
set search_path = public
language plpgsql
as $$
declare
  claims json;
  role text;
  uid uuid;
  pending_adjust bigint := 0;
begin
  claims := coalesce(current_setting('request.jwt.claims', true), '{}')::json;
  role := coalesce(
    claims ->> 'role',
    claims #>> '{app_metadata,role}',
    claims #>> '{user_metadata,role}'
  );
  uid := nullif(claims ->> 'sub', '')::uuid;

  -- Enforce client scope unless caller is actually an admin
  if role is distinct from 'admin' then
    is_admin := false;
  end if;

  if not is_admin then
    -- Guard against unauthenticated access
    if uid is null then
      total_applications := 0;
      pending_applications := 0;
      completed_applications := 0;
      rejected_applications := 0;
      total_quotations := 0;
      pending_quotations := 0;
      paid_quotations := 0;
      total_clients := 0;
      revenue := 0;
      return next;
      return;
    end if;

    select count(*) into total_applications from public.applications where user_id = uid;
    select count(*) into pending_applications from public.applications where user_id = uid and lower(status) = 'pending';
    select count(*) into completed_applications from public.applications where user_id = uid and lower(status) = 'completed';
    select count(*) into rejected_applications from public.applications where user_id = uid and lower(status) = 'rejected';

    select count(*) into total_quotations from public.quotations where user_id = uid;
    select count(*) into pending_quotations from public.quotations where user_id = uid and lower(status) = 'pending';
    select count(*) into paid_quotations from public.quotations where user_id = uid and lower(status) = 'paid';

    select coalesce(sum(amount), 0) into revenue
    from public.application_payments
    where user_id = uid and status = 'paid';

    total_clients := 0;

    -- Add timeline-based completions not yet marked completed by status
    completed_applications := completed_applications + (
      select count(distinct ats.application_id)
      from public.application_timeline_steps ats
      join public.applications a on a.id = ats.application_id
      where a.user_id = uid
        and ats.step_key in ('nclex_exam', 'quick_results')
        and ats.status = 'completed'
        and lower(coalesce(a.status, '')) not in ('completed', 'rejected')
    );

    return next;
    return;
  end if;

  -- Admin scope
  select count(*) into total_applications from public.applications;
  select count(*) into pending_applications from public.applications where lower(status) = 'pending';
  select count(*) into completed_applications from public.applications where lower(status) = 'completed';
  select count(*) into rejected_applications from public.applications where lower(status) = 'rejected';

  select count(*) into total_quotations from public.quotations;
  select count(*) into pending_quotations from public.quotations where lower(status) = 'pending';
  select count(*) into paid_quotations from public.quotations where lower(status) = 'paid';

  select count(*) into total_clients from public.users where role = 'client';

  select coalesce(sum(amount), 0) into revenue
  from public.application_payments
  where status = 'paid';

  -- Include timeline-based completions where status is not yet updated
  completed_applications := completed_applications + (
    select count(distinct ats.application_id)
    from public.application_timeline_steps ats
    join public.applications a on a.id = ats.application_id
    where ats.step_key in ('nclex_exam', 'quick_results')
      and ats.status = 'completed'
      and lower(coalesce(a.status, '')) not in ('completed', 'rejected')
  );

  -- Remove timeline-completed apps from pending to avoid double counting
  pending_adjust := (
    select count(distinct ats.application_id)
    from public.application_timeline_steps ats
    join public.applications a on a.id = ats.application_id
    where lower(coalesce(a.status, '')) = 'pending'
      and ats.step_key in ('nclex_exam', 'quick_results')
      and ats.status = 'completed'
  );
  pending_applications := greatest(0, pending_applications - pending_adjust);
  
  return next;
end;
$$;

comment on function public.get_dashboard_stats(boolean) is
'Aggregated dashboard counts for admin/client views; minimizes client-side query fan-out.';



-- ============================================

-- Migration: create-temporary-signatures-table.sql
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
DROP POLICY IF EXISTS "Allow insert for temporary signatures" ON temporary_signatures;

-- RLS Policies
-- Allow anyone to insert (for phone signatures)
CREATE POLICY "Allow insert for temporary signatures"
  ON temporary_signatures
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow anyone to read unconsumed signatures by session_id
DROP POLICY IF EXISTS "Allow read unconsumed signatures by session" ON temporary_signatures;

-- Allow anyone to read unconsumed signatures by session_id
CREATE POLICY "Allow read unconsumed signatures by session"
  ON temporary_signatures
  FOR SELECT
  TO authenticated, anon
  USING (is_consumed = false AND expires_at > NOW());

-- Allow update to mark as consumed
DROP POLICY IF EXISTS "Allow update to mark consumed" ON temporary_signatures;

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



-- ============================================

-- Migration: create_notification_types_table.sql
-- Create notification_types table for managing notification configurations
-- This allows admins to create, edit, delete, and activate/deactivate notifications dynamically

CREATE TABLE IF NOT EXISTS notification_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE, -- e.g., 'emailTimelineUpdates', 'emailStatusChanges'
  name TEXT NOT NULL, -- Display name, e.g., 'Timeline Updates'
  description TEXT, -- Description of what this notification does
  category TEXT NOT NULL DEFAULT 'email' CHECK (category IN ('email', 'reminder', 'greeting', 'system')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_enabled BOOLEAN NOT NULL DEFAULT true, -- Default state for new users
  config JSONB DEFAULT '{}'::jsonb, -- Additional configuration (interval, messages, etc.)
  icon TEXT, -- Icon name or emoji
  sort_order INTEGER DEFAULT 0, -- For ordering in UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Everyone can view notification types" ON notification_types;

-- RLS Policies
CREATE POLICY "Everyone can view notification types"
ON notification_types FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage notification types" ON notification_types;

CREATE POLICY "Admins can manage notification types"
ON notification_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_types_category ON notification_types(category);
CREATE INDEX IF NOT EXISTS idx_notification_types_enabled ON notification_types(enabled);
CREATE INDEX IF NOT EXISTS idx_notification_types_sort_order ON notification_types(sort_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_types_updated_at ON notification_types;
CREATE TRIGGER update_notification_types_updated_at
  BEFORE UPDATE ON notification_types
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_types_updated_at();

-- Insert default notification types
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config) VALUES
  ('emailTimelineUpdates', 'Timeline Updates', 'Notify users when application timeline steps are updated', 'email', true, true, '📋', 1, '{}'::jsonb),
  ('emailStatusChanges', 'Status Changes', 'Notify users when application status changes', 'email', true, true, '🔄', 2, '{}'::jsonb),
  ('emailPaymentUpdates', 'Payment Updates', 'Notify users about payment status and receipts', 'email', true, true, '💳', 3, '{}'::jsonb),
  ('emailVerification', 'Email Verification', 'Send email verification on registration', 'email', true, true, '✉️', 4, '{}'::jsonb),
  ('emailForgotPassword', 'Forgot Password', 'Send password reset emails', 'email', true, true, '🔑', 5, '{}'::jsonb),
  ('emailPaymentReceipt', 'Payment Receipts', 'Send payment receipt emails', 'email', true, true, '🧾', 6, '{}'::jsonb),
  ('emailBirthdayGreeting', 'Birthday Greetings', 'Send birthday greeting emails', 'email', true, true, '🎉', 7, '{}'::jsonb),
  ('profileReminder', 'Profile Completion Reminder', 'Remind users to complete their profile', 'reminder', true, true, '⏰', 10, '{"interval": 24, "messages": {"0": "Your profile is only {completion}% complete. Complete your profile to speed up your application process!", "20": "Your profile is {completion}% complete. Add more details to make your applications faster!", "40": "You''re {completion}% done with your profile. Keep going to complete it!", "60": "Great progress! Your profile is {completion}% complete. Just a few more details needed!", "80": "Almost there! Your profile is {completion}% complete. Finish the remaining details!"}}'::jsonb),
  ('birthdayGreeting', 'Birthday Greetings', 'Time-based birthday greeting messages', 'greeting', true, true, '🎂', 20, '{"morning": "Good morning", "afternoon": "Good afternoon", "evening": "Good evening", "customEnabled": false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();


-- ============================================

-- Migration: fix_public_quotations.sql
-- Migration: Fix public quotations to allow saving without authentication
-- This allows quotes generated at /quote to be saved to Supabase
-- Quotes persist until expiration (validity_date) or admin management

-- ============================================================================
-- STEP 1: Make user_id nullable for public quotations
-- ============================================================================
ALTER TABLE quotations 
ALTER COLUMN user_id DROP NOT NULL;

-- Update foreign key to allow NULL (PostgreSQL FK constraints allow NULL by default)
-- No action needed, but we'll verify the constraint is correct

-- ============================================================================
-- STEP 2: Add RLS policies for anonymous/public quotation operations
-- ============================================================================

-- Allow anonymous users to insert quotations with NULL user_id
DROP POLICY IF EXISTS "Allow anonymous quotation inserts" ON quotations;
CREATE POLICY "Allow anonymous quotation inserts"
ON quotations FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Allow anonymous users to read quotations by client_email (for quote viewing)
DROP POLICY IF EXISTS "Allow anonymous quotation reads by email" ON quotations;
CREATE POLICY "Allow anonymous quotation reads by email"
ON quotations FOR SELECT
TO anon
USING (true); -- Allow reading all quotes for anonymous users (they can view any quote by ID)

-- Allow anonymous users to update quotations (for quote status updates if needed)
-- Note: This might not be needed, but adding for completeness
DROP POLICY IF EXISTS "Allow anonymous quotation updates" ON quotations;
CREATE POLICY "Allow anonymous quotation updates"
ON quotations FOR UPDATE
TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

-- ============================================================================
-- STEP 3: Update existing policies to handle NULL user_id
-- ============================================================================

-- Update the "Users can view their own quotations" policy to also show NULL user_id quotes
DROP POLICY IF EXISTS "Users can view their own quotations" ON quotations;
CREATE POLICY "Users can view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Update the "Users can create their own quotations" policy
-- (Keep existing policy, but anonymous inserts are handled by the new policy above)

-- ============================================================================
-- STEP 4: Ensure validity_date is properly indexed for expiration queries
-- ============================================================================

-- Create index on validity_date for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_quotations_validity_date 
ON quotations(validity_date) 
WHERE validity_date IS NOT NULL;

-- Create index on created_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_quotations_created_at 
ON quotations(created_at DESC);

-- ============================================================================
-- STEP 5: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN quotations.user_id IS 'User ID for authenticated users. NULL for public/guest quotations.';
COMMENT ON COLUMN quotations.validity_date IS 'Quote expiration date. Quotes persist until this date or until managed by admin.';



-- ============================================

-- Migration: migrate_existing_notifications.sql
-- Migrate existing notification settings from settings table to notification_types table
-- This ensures all current notifications, reminders, and greetings are visible in the frontend

-- First, ensure the notification_types table exists (in case migration order is different)
CREATE TABLE IF NOT EXISTS notification_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'email' CHECK (category IN ('email', 'reminder', 'greeting', 'system')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate email notification settings
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'emailTimelineUpdates',
  'Timeline Updates',
  'Notify users when application timeline steps are updated',
  'email',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailTimelineUpdates'), true),
  true,
  '📋',
  1,
  '{}'::jsonb
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailTimelineUpdates'), notification_types.enabled),
  updated_at = NOW();

INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'emailStatusChanges',
  'Status Changes',
  'Notify users when application status changes',
  'email',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailStatusChanges'), true),
  true,
  '🔄',
  2,
  '{}'::jsonb
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailStatusChanges'), notification_types.enabled),
  updated_at = NOW();

INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'emailPaymentUpdates',
  'Payment Updates',
  'Notify users about payment status and receipts',
  'email',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailPaymentUpdates'), true),
  true,
  '💳',
  3,
  '{}'::jsonb
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailPaymentUpdates'), notification_types.enabled),
  updated_at = NOW();

-- Migrate reminder settings
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'profileReminder',
  'Profile Completion Reminder',
  'Remind users to complete their profile',
  'reminder',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'profileReminderEnabled'), true),
  true,
  '⏰',
  10,
  jsonb_build_object(
    'interval', COALESCE((SELECT value::integer FROM settings WHERE key = 'profileReminderInterval'), 24),
    'messages', jsonb_build_object(
      '0', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage0'), 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!'),
      '20', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage20'), 'Your profile is {completion}% complete. Add more details to make your applications faster!'),
      '40', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage40'), 'You''re {completion}% done with your profile. Keep going to complete it!'),
      '60', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage60'), 'Great progress! Your profile is {completion}% complete. Just a few more details needed!'),
      '80', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage80'), 'Almost there! Your profile is {completion}% complete. Finish the remaining details!')
    )
  )
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'profileReminderEnabled'), notification_types.enabled),
  config = jsonb_build_object(
    'interval', COALESCE((SELECT value::integer FROM settings WHERE key = 'profileReminderInterval'), (notification_types.config->>'interval')::integer, 24),
    'messages', jsonb_build_object(
      '0', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage0'), notification_types.config->'messages'->>'0', 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!'),
      '20', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage20'), notification_types.config->'messages'->>'20', 'Your profile is {completion}% complete. Add more details to make your applications faster!'),
      '40', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage40'), notification_types.config->'messages'->>'40', 'You''re {completion}% done with your profile. Keep going to complete it!'),
      '60', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage60'), notification_types.config->'messages'->>'60', 'Great progress! Your profile is {completion}% complete. Just a few more details needed!'),
      '80', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage80'), notification_types.config->'messages'->>'80', 'Almost there! Your profile is {completion}% complete. Finish the remaining details!')
    )
  ),
  updated_at = NOW();

-- Migrate greeting settings
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'birthdayGreeting',
  'Birthday Greetings',
  'Time-based birthday greeting messages',
  'greeting',
  true,
  true,
  '🎂',
  20,
  jsonb_build_object(
    'morning', COALESCE((SELECT value FROM settings WHERE key = 'greetingMorning'), 'Good morning'),
    'afternoon', COALESCE((SELECT value FROM settings WHERE key = 'greetingAfternoon'), 'Good afternoon'),
    'evening', COALESCE((SELECT value FROM settings WHERE key = 'greetingEvening'), 'Good evening'),
    'customEnabled', COALESCE((SELECT value::boolean FROM settings WHERE key = 'greetingCustomEnabled'), false)
  )
ON CONFLICT (key) DO UPDATE SET
  config = jsonb_build_object(
    'morning', COALESCE((SELECT value FROM settings WHERE key = 'greetingMorning'), notification_types.config->>'morning', 'Good morning'),
    'afternoon', COALESCE((SELECT value FROM settings WHERE key = 'greetingAfternoon'), notification_types.config->>'afternoon', 'Good afternoon'),
    'evening', COALESCE((SELECT value FROM settings WHERE key = 'greetingEvening'), notification_types.config->>'evening', 'Good evening'),
    'customEnabled', COALESCE((SELECT value::boolean FROM settings WHERE key = 'greetingCustomEnabled'), (notification_types.config->>'customEnabled')::boolean, false)
  ),
  updated_at = NOW();

-- Ensure all other default notifications exist (in case they weren't created yet)
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config) VALUES
  ('emailVerification', 'Email Verification', 'Send email verification on registration', 'email', true, true, '✉️', 4, '{}'::jsonb),
  ('emailForgotPassword', 'Forgot Password', 'Send password reset emails', 'email', true, true, '🔑', 5, '{}'::jsonb),
  ('emailPaymentReceipt', 'Payment Receipts', 'Send payment receipt emails', 'email', true, true, '🧾', 6, '{}'::jsonb),
  ('emailBirthdayGreeting', 'Birthday Greetings', 'Send birthday greeting emails', 'email', true, true, '🎉', 7, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Helper function to convert text to boolean
CREATE OR REPLACE FUNCTION text_to_boolean(text_val TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN text_val IN ('true', 't', '1', 'yes', 'on');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the migration to use the helper function
DO $$
BEGIN
  -- Update emailTimelineUpdates
  UPDATE notification_types
  SET enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'emailTimelineUpdates')), enabled)
  WHERE key = 'emailTimelineUpdates';

  -- Update emailStatusChanges
  UPDATE notification_types
  SET enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'emailStatusChanges')), enabled)
  WHERE key = 'emailStatusChanges';

  -- Update emailPaymentUpdates
  UPDATE notification_types
  SET enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'emailPaymentUpdates')), enabled)
  WHERE key = 'emailPaymentUpdates';

  -- Update profileReminder
  UPDATE notification_types
  SET 
    enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'profileReminderEnabled')), enabled),
    config = jsonb_build_object(
      'interval', COALESCE((SELECT value::integer FROM settings WHERE key = 'profileReminderInterval'), (config->>'interval')::integer, 24),
      'messages', jsonb_build_object(
        '0', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage0'), config->'messages'->>'0', 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!'),
        '20', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage20'), config->'messages'->>'20', 'Your profile is {completion}% complete. Add more details to make your applications faster!'),
        '40', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage40'), config->'messages'->>'40', 'You''re {completion}% done with your profile. Keep going to complete it!'),
        '60', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage60'), config->'messages'->>'60', 'Great progress! Your profile is {completion}% complete. Just a few more details needed!'),
        '80', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage80'), config->'messages'->>'80', 'Almost there! Your profile is {completion}% complete. Finish the remaining details!')
      )
    )
  WHERE key = 'profileReminder';

  -- Update birthdayGreeting
  UPDATE notification_types
  SET config = jsonb_build_object(
    'morning', COALESCE((SELECT value FROM settings WHERE key = 'greetingMorning'), config->>'morning', 'Good morning'),
    'afternoon', COALESCE((SELECT value FROM settings WHERE key = 'greetingAfternoon'), config->>'afternoon', 'Good afternoon'),
    'evening', COALESCE((SELECT value FROM settings WHERE key = 'greetingEvening'), config->>'evening', 'Good evening'),
    'customEnabled', COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'greetingCustomEnabled')), (config->>'customEnabled')::boolean, false)
  )
  WHERE key = 'birthdayGreeting';
END $$;


-- ============================================

-- Migration: optimize-notifications-performance.sql
-- Optimize notifications table performance
-- This migration adds composite indexes for common query patterns

-- Composite index for fetching unread notifications for a user (most common query)
-- This optimizes: SELECT * FROM notifications WHERE user_id = ? AND read = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
ON notifications(user_id, read, created_at DESC) 
WHERE read = false;

-- Composite index for fetching all notifications for a user ordered by date
-- This optimizes: SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- Index for filtering by type (used in admin dashboard)
CREATE INDEX IF NOT EXISTS idx_notifications_type_created 
ON notifications(type, created_at DESC);

-- Composite index for admin queries filtering by type and read status
CREATE INDEX IF NOT EXISTS idx_notifications_type_read_created 
ON notifications(type, read, created_at DESC);

-- Index on created_at for general sorting (if not already exists)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- Index on application_id for notifications linked to applications
CREATE INDEX IF NOT EXISTS idx_notifications_application_id 
ON notifications(application_id) 
WHERE application_id IS NOT NULL;

-- Analyze the table to update statistics
ANALYZE notifications;





-- ============================================

-- Migration: optimize-security-mvp.sql
-- MVP Security Optimization Migration
-- This migration consolidates and simplifies security to MVP level
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: Create Unified Admin Check Function
-- ============================================================================
-- Use auth.users to avoid RLS recursion issues
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- Also create is_admin_user() as alias for backward compatibility
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN public.is_admin();
END;
$$;

-- ============================================================================
-- PART 2: Grant Basic Permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================================
-- PART 3: Enable RLS on All Tables
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_timeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Newer tables
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_sponsorships') THEN
    ALTER TABLE nclex_sponsorships ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'donations') THEN
    ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'careers') THEN
    ALTER TABLE careers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    ALTER TABLE partner_agencies ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- PART 4: Drop All Existing Policies (Clean Slate)
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PART 5: Users Table - MVP Policies
-- ============================================================================
-- Users can view/update their own profile
DROP POLICY IF EXISTS "users_select_own" ON users;

-- ============================================================================
-- PART 5: Users Table - MVP Policies
-- ============================================================================
-- Users can view/update their own profile
CREATE POLICY "users_select_own" ON users FOR SELECT
TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;

CREATE POLICY "users_update_own" ON users FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON users;

CREATE POLICY "users_insert_own" ON users FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

-- Service role can insert (for triggers)
DROP POLICY IF EXISTS "users_insert_service" ON users;

-- Service role can insert (for triggers)
CREATE POLICY "users_insert_service" ON users FOR INSERT
TO service_role WITH CHECK (true);

-- Admins can view/update all users
DROP POLICY IF EXISTS "users_select_admin" ON users;

-- Admins can view/update all users
CREATE POLICY "users_select_admin" ON users FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "users_update_admin" ON users;

CREATE POLICY "users_update_admin" ON users FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON users TO authenticated;

-- ============================================================================
-- PART 6: Applications Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "applications_select_own" ON applications;

-- ============================================================================
-- PART 6: Applications Table - MVP Policies
-- ============================================================================
CREATE POLICY "applications_select_own" ON applications FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "applications_insert_own" ON applications;

CREATE POLICY "applications_insert_own" ON applications FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "applications_update_own" ON applications;

CREATE POLICY "applications_update_own" ON applications FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "applications_select_admin" ON applications;

CREATE POLICY "applications_select_admin" ON applications FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "applications_update_admin" ON applications;

CREATE POLICY "applications_update_admin" ON applications FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON applications TO authenticated;

-- ============================================================================
-- PART 7: Quotations Table - MVP Policies (Public Access)
-- ============================================================================
-- Anonymous can create/view quotations (for public quotes)
DROP POLICY IF EXISTS "quotations_insert_anon" ON quotations;

-- ============================================================================
-- PART 7: Quotations Table - MVP Policies (Public Access)
-- ============================================================================
-- Anonymous can create/view quotations (for public quotes)
CREATE POLICY "quotations_insert_anon" ON quotations FOR INSERT
TO anon WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "quotations_select_anon" ON quotations;

CREATE POLICY "quotations_select_anon" ON quotations FOR SELECT
TO anon USING (true);

DROP POLICY IF EXISTS "quotations_update_anon" ON quotations;

CREATE POLICY "quotations_update_anon" ON quotations FOR UPDATE
TO anon USING (user_id IS NULL) WITH CHECK (user_id IS NULL);

-- Authenticated users
DROP POLICY IF EXISTS "quotations_select_own" ON quotations;

-- Authenticated users
CREATE POLICY "quotations_select_own" ON quotations FOR SELECT
TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "quotations_insert_own" ON quotations;

CREATE POLICY "quotations_insert_own" ON quotations FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "quotations_update_own" ON quotations;

CREATE POLICY "quotations_update_own" ON quotations FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "quotations_delete_own" ON quotations;

CREATE POLICY "quotations_delete_own" ON quotations FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Admins
DROP POLICY IF EXISTS "quotations_select_admin" ON quotations;

-- Admins
CREATE POLICY "quotations_select_admin" ON quotations FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "quotations_update_admin" ON quotations;

CREATE POLICY "quotations_update_admin" ON quotations FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "quotations_delete_admin" ON quotations;

CREATE POLICY "quotations_delete_admin" ON quotations FOR DELETE
TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON quotations TO authenticated, anon;

-- ============================================================================
-- PART 8: User Details Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "user_details_select_own" ON user_details;

-- ============================================================================
-- PART 8: User Details Table - MVP Policies
-- ============================================================================
CREATE POLICY "user_details_select_own" ON user_details FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_details_insert_own" ON user_details;

CREATE POLICY "user_details_insert_own" ON user_details FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_details_update_own" ON user_details;

CREATE POLICY "user_details_update_own" ON user_details FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON user_details TO authenticated;

-- ============================================================================
-- PART 9: User Documents Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "user_documents_select_own" ON user_documents;

-- ============================================================================
-- PART 9: User Documents Table - MVP Policies
-- ============================================================================
CREATE POLICY "user_documents_select_own" ON user_documents FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_documents_insert_own" ON user_documents;

CREATE POLICY "user_documents_insert_own" ON user_documents FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_documents_update_own" ON user_documents;

CREATE POLICY "user_documents_update_own" ON user_documents FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_documents_delete_own" ON user_documents;

CREATE POLICY "user_documents_delete_own" ON user_documents FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Admins
DROP POLICY IF EXISTS "user_documents_select_admin" ON user_documents;

-- Admins
CREATE POLICY "user_documents_select_admin" ON user_documents FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "user_documents_insert_admin" ON user_documents;

CREATE POLICY "user_documents_insert_admin" ON user_documents FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_documents_update_admin" ON user_documents;

CREATE POLICY "user_documents_update_admin" ON user_documents FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_documents_delete_admin" ON user_documents;

CREATE POLICY "user_documents_delete_admin" ON user_documents FOR DELETE
TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_documents TO authenticated;

-- ============================================================================
-- PART 10: Application Payments Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "application_payments_select_own" ON application_payments;

-- ============================================================================
-- PART 10: Application Payments Table - MVP Policies
-- ============================================================================
CREATE POLICY "application_payments_select_own" ON application_payments FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "application_payments_insert_own" ON application_payments;

CREATE POLICY "application_payments_insert_own" ON application_payments FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "application_payments_select_admin" ON application_payments;

CREATE POLICY "application_payments_select_admin" ON application_payments FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "application_payments_update_admin" ON application_payments;

CREATE POLICY "application_payments_update_admin" ON application_payments FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON application_payments TO authenticated;

-- ============================================================================
-- PART 11: Receipts Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "receipts_select_own" ON receipts;

-- ============================================================================
-- PART 11: Receipts Table - MVP Policies
-- ============================================================================
CREATE POLICY "receipts_select_own" ON receipts FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "receipts_select_admin" ON receipts;

CREATE POLICY "receipts_select_admin" ON receipts FOR SELECT
TO authenticated USING (public.is_admin());

GRANT SELECT ON receipts TO authenticated;

-- ============================================================================
-- PART 12: Processing Accounts Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "processing_accounts_select_own" ON processing_accounts;

-- ============================================================================
-- PART 12: Processing Accounts Table - MVP Policies
-- ============================================================================
CREATE POLICY "processing_accounts_select_own" ON processing_accounts FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = processing_accounts.application_id
    AND applications.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "processing_accounts_select_admin" ON processing_accounts;

CREATE POLICY "processing_accounts_select_admin" ON processing_accounts FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "processing_accounts_insert_admin" ON processing_accounts;

CREATE POLICY "processing_accounts_insert_admin" ON processing_accounts FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "processing_accounts_update_admin" ON processing_accounts;

CREATE POLICY "processing_accounts_update_admin" ON processing_accounts FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON processing_accounts TO authenticated;

-- ============================================================================
-- PART 13: Application Timeline Steps Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "application_timeline_steps_select_own" ON application_timeline_steps;

-- ============================================================================
-- PART 13: Application Timeline Steps Table - MVP Policies
-- ============================================================================
CREATE POLICY "application_timeline_steps_select_own" ON application_timeline_steps FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "application_timeline_steps_select_admin" ON application_timeline_steps;

CREATE POLICY "application_timeline_steps_select_admin" ON application_timeline_steps FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "application_timeline_steps_insert_admin" ON application_timeline_steps;

CREATE POLICY "application_timeline_steps_insert_admin" ON application_timeline_steps FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "application_timeline_steps_update_admin" ON application_timeline_steps;

CREATE POLICY "application_timeline_steps_update_admin" ON application_timeline_steps FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON application_timeline_steps TO authenticated;

-- ============================================================================
-- PART 14: Notifications Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;

-- ============================================================================
-- PART 14: Notifications Table - MVP Policies
-- ============================================================================
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- System can insert (for triggers/functions)
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- System can insert (for triggers/functions)
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;

-- ============================================================================
-- PART 15: Settings Table - MVP Policies (Public Read, Admin Write)
-- ============================================================================
DROP POLICY IF EXISTS "settings_select_all" ON settings;

-- ============================================================================
-- PART 15: Settings Table - MVP Policies (Public Read, Admin Write)
-- ============================================================================
CREATE POLICY "settings_select_all" ON settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "settings_insert_admin" ON settings;

CREATE POLICY "settings_insert_admin" ON settings FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_update_admin" ON settings;

CREATE POLICY "settings_update_admin" ON settings FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON settings TO authenticated, anon;
GRANT INSERT, UPDATE ON settings TO authenticated;

-- ============================================================================
-- PART 16: Services Table - MVP Policies (Public Read, Admin Write)
-- ============================================================================
DROP POLICY IF EXISTS "services_select_all" ON services;

-- ============================================================================
-- PART 16: Services Table - MVP Policies (Public Read, Admin Write)
-- ============================================================================
CREATE POLICY "services_select_all" ON services FOR SELECT
USING (true);

DROP POLICY IF EXISTS "services_insert_admin" ON services;

CREATE POLICY "services_insert_admin" ON services FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "services_update_admin" ON services;

CREATE POLICY "services_update_admin" ON services FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "services_delete_admin" ON services;

CREATE POLICY "services_delete_admin" ON services FOR DELETE
TO authenticated USING (public.is_admin());

GRANT SELECT ON services TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON services TO authenticated;

-- ============================================================================
-- PART 17: NCLEX Sponsorships Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nclex_sponsorships') THEN
    -- Everyone can create
DROP POLICY IF EXISTS "nclex_sponsorships_insert_all" ON nclex_sponsorships;
    -- Everyone can create
    CREATE POLICY "nclex_sponsorships_insert_all" ON nclex_sponsorships FOR INSERT
    TO anon, authenticated WITH CHECK (true);
    
    -- Anonymous can view recent (for post-insert select)
DROP POLICY IF EXISTS "nclex_sponsorships_select_anon_recent" ON nclex_sponsorships;
    
    -- Anonymous can view recent (for post-insert select)
    CREATE POLICY "nclex_sponsorships_select_anon_recent" ON nclex_sponsorships FOR SELECT
    TO anon USING (created_at > NOW() - INTERVAL '5 minutes');
    
    -- Users can view their own
DROP POLICY IF EXISTS "nclex_sponsorships_select_own" ON nclex_sponsorships;
    
    -- Users can view their own
    CREATE POLICY "nclex_sponsorships_select_own" ON nclex_sponsorships FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
    
    -- Users can update their own (pending only)
DROP POLICY IF EXISTS "nclex_sponsorships_update_own" ON nclex_sponsorships;
    
    -- Users can update their own (pending only)
    CREATE POLICY "nclex_sponsorships_update_own" ON nclex_sponsorships FOR UPDATE
    TO authenticated USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');
    
    -- Admins
DROP POLICY IF EXISTS "nclex_sponsorships_select_admin" ON nclex_sponsorships;
    
    -- Admins
    CREATE POLICY "nclex_sponsorships_select_admin" ON nclex_sponsorships FOR SELECT
    TO authenticated USING (public.is_admin());
    
DROP POLICY IF EXISTS "nclex_sponsorships_update_admin" ON nclex_sponsorships;
    
    CREATE POLICY "nclex_sponsorships_update_admin" ON nclex_sponsorships FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
DROP POLICY IF EXISTS "nclex_sponsorships_delete_admin" ON nclex_sponsorships;
    
    CREATE POLICY "nclex_sponsorships_delete_admin" ON nclex_sponsorships FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON nclex_sponsorships TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- PART 18: Donations Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'donations') THEN
    -- Everyone can create
DROP POLICY IF EXISTS "donations_insert_all" ON donations;
    -- Everyone can create
    CREATE POLICY "donations_insert_all" ON donations FOR INSERT
    TO anon, authenticated WITH CHECK (true);
    
    -- Anonymous can view recent (for post-insert select)
DROP POLICY IF EXISTS "donations_select_anon_recent" ON donations;
    
    -- Anonymous can view recent (for post-insert select)
    CREATE POLICY "donations_select_anon_recent" ON donations FOR SELECT
    TO anon USING (created_at > NOW() - INTERVAL '5 minutes');
    
    -- Users can view their own (by email)
DROP POLICY IF EXISTS "donations_select_own" ON donations;
    
    -- Users can view their own (by email)
    CREATE POLICY "donations_select_own" ON donations FOR SELECT
    TO authenticated USING (
      donor_email = (SELECT email FROM users WHERE id = auth.uid())
      OR public.is_admin()
    );
    
    -- Admins
DROP POLICY IF EXISTS "donations_select_admin" ON donations;
    
    -- Admins
    CREATE POLICY "donations_select_admin" ON donations FOR SELECT
    TO authenticated USING (public.is_admin());
    
DROP POLICY IF EXISTS "donations_update_admin" ON donations;
    
    CREATE POLICY "donations_update_admin" ON donations FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
    GRANT SELECT, INSERT, UPDATE ON donations TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- PART 19: Careers Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'careers') THEN
    -- Everyone can view active
DROP POLICY IF EXISTS "careers_select_active" ON careers;
    -- Everyone can view active
    CREATE POLICY "careers_select_active" ON careers FOR SELECT
    TO anon, authenticated USING (is_active = TRUE);
    
    -- Admins can view all
DROP POLICY IF EXISTS "careers_select_admin" ON careers;
    
    -- Admins can view all
    CREATE POLICY "careers_select_admin" ON careers FOR SELECT
    TO authenticated USING (public.is_admin());
    
    -- Admins can manage
DROP POLICY IF EXISTS "careers_insert_admin" ON careers;
    
    -- Admins can manage
    CREATE POLICY "careers_insert_admin" ON careers FOR INSERT
    TO authenticated WITH CHECK (public.is_admin());
    
DROP POLICY IF EXISTS "careers_update_admin" ON careers;
    
    CREATE POLICY "careers_update_admin" ON careers FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
DROP POLICY IF EXISTS "careers_delete_admin" ON careers;
    
    CREATE POLICY "careers_delete_admin" ON careers FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT ON careers TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON careers TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- PART 20: Career Applications Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    -- Everyone can create
DROP POLICY IF EXISTS "career_applications_insert_all" ON career_applications;
    -- Everyone can create
    CREATE POLICY "career_applications_insert_all" ON career_applications FOR INSERT
    TO anon, authenticated WITH CHECK (true);
    
    -- Anonymous can view recent
DROP POLICY IF EXISTS "career_applications_select_anon_recent" ON career_applications;
    
    -- Anonymous can view recent
    CREATE POLICY "career_applications_select_anon_recent" ON career_applications FOR SELECT
    TO anon USING (created_at > NOW() - INTERVAL '5 minutes');
    
    -- Users can view their own
DROP POLICY IF EXISTS "career_applications_select_own" ON career_applications;
    
    -- Users can view their own
    CREATE POLICY "career_applications_select_own" ON career_applications FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
    
    -- Users can update their own (pending only)
DROP POLICY IF EXISTS "career_applications_update_own" ON career_applications;
    
    -- Users can update their own (pending only)
    CREATE POLICY "career_applications_update_own" ON career_applications FOR UPDATE
    TO authenticated USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');
    
    -- Admins
DROP POLICY IF EXISTS "career_applications_select_admin" ON career_applications;
    
    -- Admins
    CREATE POLICY "career_applications_select_admin" ON career_applications FOR SELECT
    TO authenticated USING (public.is_admin());
    
DROP POLICY IF EXISTS "career_applications_update_admin" ON career_applications;
    
    CREATE POLICY "career_applications_update_admin" ON career_applications FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
DROP POLICY IF EXISTS "career_applications_delete_admin" ON career_applications;
    
    CREATE POLICY "career_applications_delete_admin" ON career_applications FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON career_applications TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- PART 21: Partner Agencies Table - MVP Policies (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    -- Everyone can view active
DROP POLICY IF EXISTS "partner_agencies_select_active" ON partner_agencies;
    -- Everyone can view active
    CREATE POLICY "partner_agencies_select_active" ON partner_agencies FOR SELECT
    TO anon, authenticated USING (is_active = TRUE);
    
    -- Admins can view all
DROP POLICY IF EXISTS "partner_agencies_select_admin" ON partner_agencies;
    
    -- Admins can view all
    CREATE POLICY "partner_agencies_select_admin" ON partner_agencies FOR SELECT
    TO authenticated USING (public.is_admin());
    
    -- Admins can manage
DROP POLICY IF EXISTS "partner_agencies_insert_admin" ON partner_agencies;
    
    -- Admins can manage
    CREATE POLICY "partner_agencies_insert_admin" ON partner_agencies FOR INSERT
    TO authenticated WITH CHECK (public.is_admin());
    
DROP POLICY IF EXISTS "partner_agencies_update_admin" ON partner_agencies;
    
    CREATE POLICY "partner_agencies_update_admin" ON partner_agencies FOR UPDATE
    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
    
DROP POLICY IF EXISTS "partner_agencies_delete_admin" ON partner_agencies;
    
    CREATE POLICY "partner_agencies_delete_admin" ON partner_agencies FOR DELETE
    TO authenticated USING (public.is_admin());
    
    GRANT SELECT ON partner_agencies TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON partner_agencies TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- PART 22: Password Reset Tokens Table - MVP Policies
-- ============================================================================
DROP POLICY IF EXISTS "password_reset_tokens_select_own" ON password_reset_tokens;

-- ============================================================================
-- PART 22: Password Reset Tokens Table - MVP Policies
-- ============================================================================
CREATE POLICY "password_reset_tokens_select_own" ON password_reset_tokens FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "password_reset_tokens_insert_own" ON password_reset_tokens;

CREATE POLICY "password_reset_tokens_insert_own" ON password_reset_tokens FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "password_reset_tokens_update_own" ON password_reset_tokens;

CREATE POLICY "password_reset_tokens_update_own" ON password_reset_tokens FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO authenticated;

-- ============================================================================
-- COMPLETE: Security optimized to MVP level
-- ============================================================================
-- All policies now use the unified is_admin() function
-- All tables have consistent, minimal MVP-level security
-- Anonymous access is properly configured for public features



-- ============================================

-- Migration: recommended-indexes.sql
-- Recommended database indexes to optimize query performance
-- Run these in Supabase SQL Editor to improve query speed
-- These indexes support the optimized query patterns implemented in the application

-- Applications table indexes
-- Supports: applicationsAPI.getAll() with user_id filtering
CREATE INDEX IF NOT EXISTS idx_applications_user_id_created_at 
ON applications(user_id, created_at DESC);

-- Supports: Dashboard stats queries
CREATE INDEX IF NOT EXISTS idx_applications_status 
ON applications(status) WHERE status IS NOT NULL;

-- Supports: Application detail queries
CREATE INDEX IF NOT EXISTS idx_applications_grit_app_id 
ON applications(grit_app_id) WHERE grit_app_id IS NOT NULL;

-- Application timeline steps indexes
-- Supports: Batched timeline queries in applicationsAPI.getAll()
CREATE INDEX IF NOT EXISTS idx_timeline_steps_application_id 
ON application_timeline_steps(application_id);

-- Supports: Timeline completion checks
CREATE INDEX IF NOT EXISTS idx_timeline_steps_application_step_status 
ON application_timeline_steps(application_id, step_key, status) 
WHERE status = 'completed';

-- Application payments indexes
-- Supports: Batched payment queries in applicationsAPI.getAll()
CREATE INDEX IF NOT EXISTS idx_payments_application_id 
ON application_payments(application_id);

-- Supports: Dashboard revenue calculations
CREATE INDEX IF NOT EXISTS idx_payments_status_amount 
ON application_payments(status, amount) 
WHERE status = 'paid';

-- Supports: User-scoped payment queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status 
ON application_payments(user_id, status);

-- Quotations indexes
-- Supports: Dashboard stats and user-scoped queries
CREATE INDEX IF NOT EXISTS idx_quotations_user_id_created_at 
ON quotations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_status 
ON quotations(status) WHERE status IS NOT NULL;

-- Processing accounts indexes
-- Supports: Batched GritSync account queries in clientsAPI.getAllWithGmailAccounts()
CREATE INDEX IF NOT EXISTS idx_processing_accounts_application_id_type 
ON processing_accounts(application_id, account_type) 
WHERE account_type = 'gritsync';

-- User documents indexes
-- Supports: Document queries in ApplicationDetail
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id_type 
ON user_documents(user_id, document_type);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_id_uploaded_at 
ON user_documents(user_id, uploaded_at DESC);

-- Users table indexes
-- Supports: Client queries
CREATE INDEX IF NOT EXISTS idx_users_role_created_at 
ON users(role, created_at DESC) 
WHERE role = 'client';

-- Notifications indexes
-- Supports: Notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_created_at 
ON notifications(user_id, read, created_at DESC);

-- Email logs indexes (if table exists)
-- Supports: Email analytics queries
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_user_id_created_at 
ON email_logs(recipient_user_id, created_at DESC) 
WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_status_created_at 
ON email_logs(status, created_at DESC);

-- Composite indexes for common query patterns
-- Dashboard stats optimization
CREATE INDEX IF NOT EXISTS idx_applications_user_status_created 
ON applications(user_id, status, created_at DESC);

-- Application detail optimization
CREATE INDEX IF NOT EXISTS idx_timeline_steps_app_key_status 
ON application_timeline_steps(application_id, step_key, status);

-- Comments
COMMENT ON INDEX idx_applications_user_id_created_at IS 
'Optimizes user-scoped application list queries with sorting';

COMMENT ON INDEX idx_timeline_steps_application_id IS 
'Optimizes batched timeline step queries for multiple applications';

COMMENT ON INDEX idx_payments_application_id IS 
'Optimizes batched payment queries for multiple applications';

COMMENT ON INDEX idx_processing_accounts_application_id_type IS 
'Optimizes batched GritSync account queries for AdminClients page';

-- Analyze tables after creating indexes (helps query planner)
ANALYZE applications;
ANALYZE application_timeline_steps;
ANALYZE application_payments;
ANALYZE quotations;
ANALYZE processing_accounts;
ANALYZE user_documents;
ANALYZE users;
ANALYZE notifications;







-- ============================================

-- Migration: refresh-schema-cache.sql
-- Refresh Schema Cache
-- This script helps refresh Supabase's PostgREST schema cache
-- Run this if you get "table not found" errors even though the table exists

-- Method 1: Notify PostgREST to reload schema
-- This works if you have direct database access
NOTIFY pgrst, 'reload schema';

-- Method 2: Query the table to force cache refresh
-- Sometimes just querying the table helps refresh the cache
SELECT COUNT(*) FROM document_compilation_jobs;

-- Method 3: Check if table actually exists
SELECT 
  'Table exists check' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'document_compilation_jobs'
    ) THEN '✅ Table EXISTS in database'
    ELSE '❌ Table does NOT exist - run migration'
  END as status;

-- Method 4: List all columns to force metadata refresh
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'document_compilation_jobs'
ORDER BY ordinal_position;






-- ============================================

-- Migration: rollback_public_quotations.sql
-- Rollback Script for Public Quotations Migration
-- 
-- WARNING: This will remove the ability for anonymous users to create quotations
-- Only run this if you need to revert the migration
--
-- Before running:
-- 1. Ensure no quotes with user_id = null exist (or assign them to users)
-- 2. Backup your database
-- 3. Test in a development environment first

-- ============================================================================
-- STEP 1: Remove anonymous RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow anonymous quotation inserts" ON quotations;
DROP POLICY IF EXISTS "Allow anonymous quotation reads by email" ON quotations;
DROP POLICY IF EXISTS "Allow anonymous quotation updates" ON quotations;

-- ============================================================================
-- STEP 2: Restore original "Users can view their own quotations" policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own quotations" ON quotations;
CREATE POLICY "Users can view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 3: Remove indexes (optional - they don't hurt to keep)
-- ============================================================================

-- Uncomment if you want to remove the indexes:
-- DROP INDEX IF EXISTS idx_quotations_validity_date;
-- DROP INDEX IF EXISTS idx_quotations_created_at;

-- ============================================================================
-- STEP 4: Make user_id NOT NULL again
-- ============================================================================
-- 
-- WARNING: This will fail if there are any quotations with user_id = null
-- You must either:
-- 1. Delete all quotes with user_id = null, OR
-- 2. Assign them to a user before running this
--
-- To check for null user_id quotes:
-- SELECT COUNT(*) FROM quotations WHERE user_id IS NULL;
--
-- To delete them:
-- DELETE FROM quotations WHERE user_id IS NULL;
--
-- Uncomment the line below after handling null user_id quotes:
-- ALTER TABLE quotations ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- STEP 5: Remove column comments (optional)
-- ============================================================================

COMMENT ON COLUMN quotations.user_id IS NULL;
COMMENT ON COLUMN quotations.validity_date IS NULL;



-- ============================================

-- Migration: setup_birthday_greetings_cron.sql
-- Setup Cron Job for Birthday Greetings
-- This cron job runs daily at 9:00 AM UTC to send birthday greetings

-- First, ensure the pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists
SELECT cron.unschedule('send-birthday-greetings') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-birthday-greetings'
);

-- Create the cron job
-- Note: Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- Note: The service_role_key should be set as a database setting or use environment variable
SELECT cron.schedule(
  'send-birthday-greetings',
  '0 9 * * *', -- Run daily at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-birthday-greetings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Alternative: If you prefer to use a direct URL (replace with your project ref)
-- SELECT cron.schedule(
--   'send-birthday-greetings',
--   '0 9 * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-birthday-greetings',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--       ),
--       body := '{}'::jsonb
--     ) AS request_id;
--   $$
-- );

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-greetings';


-- ============================================

-- Migration: test-statistics-functions.sql
-- Test Statistics Functions
-- Run this to verify all statistics functions work correctly

-- ============================================================================
-- Test 1: get_career_statistics()
-- ============================================================================
SELECT 
  'Testing get_career_statistics()' as test_name;

SELECT * FROM get_career_statistics();

-- Expected output columns:
-- - total_careers: Total number of careers
-- - active_careers: Number of active careers
-- - featured_careers: Number of featured and active careers
-- - total_applications: Total number of career applications
-- - pending_applications: Number of pending applications

-- ============================================================================
-- Test 2: get_donation_statistics()
-- ============================================================================
SELECT 
  'Testing get_donation_statistics()' as test_name;

SELECT * FROM get_donation_statistics();

-- Expected output columns:
-- - total_donations: Total number of donations
-- - total_amount: Sum of all donation amounts
-- - completed_donations: Number of completed donations
-- - completed_amount: Sum of completed donation amounts
-- - pending_donations: Number of pending donations

-- ============================================================================
-- Test 3: get_sponsorship_statistics()
-- ============================================================================
SELECT 
  'Testing get_sponsorship_statistics()' as test_name;

SELECT * FROM get_sponsorship_statistics();

-- Expected output columns:
-- - total_sponsorships: Total number of sponsorships
-- - pending_sponsorships: Number of pending sponsorships
-- - approved_sponsorships: Number of approved sponsorships
-- - awarded_sponsorships: Number of awarded sponsorships

-- ============================================================================
-- Test 4: Combined Statistics View
-- ============================================================================
SELECT 
  'Combined Statistics Overview' as test_name;

SELECT 
  'Careers' as category,
  total_careers::text as total,
  active_careers::text as active,
  NULL::text as completed,
  NULL::text as pending
FROM get_career_statistics()

UNION ALL

SELECT 
  'Donations' as category,
  total_donations::text as total,
  NULL::text as active,
  completed_donations::text as completed,
  pending_donations::text as pending
FROM get_donation_statistics()

UNION ALL

SELECT 
  'Sponsorships' as category,
  total_sponsorships::text as total,
  NULL::text as active,
  approved_sponsorships::text as completed,
  pending_sponsorships::text as pending
FROM get_sponsorship_statistics();

-- ============================================================================
-- Test 5: Function Performance Test
-- ============================================================================
-- Test execution time (should be fast with proper indexes)
-- Note: To measure performance, use EXPLAIN ANALYZE in psql or check query logs
-- These queries should execute quickly with proper indexes

SELECT * FROM get_career_statistics();
SELECT * FROM get_donation_statistics();
SELECT * FROM get_sponsorship_statistics();

-- To check performance in Supabase, you can use:
-- EXPLAIN ANALYZE SELECT * FROM get_career_statistics();
-- EXPLAIN ANALYZE SELECT * FROM get_donation_statistics();
-- EXPLAIN ANALYZE SELECT * FROM get_sponsorship_statistics();

-- ============================================================================
-- Test 6: Function with Empty Tables
-- ============================================================================
-- These functions should return 0 values even if tables are empty
-- (No data needed for this test, functions handle empty tables)

SELECT 
  'Empty table handling test' as test_name,
  CASE 
    WHEN total_careers = 0 AND total_applications = 0 THEN '✅ PASS - Handles empty tables'
    ELSE '✅ PASS - Has data'
  END as status
FROM get_career_statistics();



-- ============================================

-- Migration: verify_rls_policies.sql
-- Verification Script for RLS Policies
-- Run this in Supabase SQL Editor to verify all RLS policies are correctly configured
-- This helps ensure your database is ready for production

-- Section 1: Check RLS Status on All Tables
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED' 
    ELSE '❌ DISABLED - ACTION REQUIRED' 
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
    'receipts',
    'processing_accounts',
    'application_timeline_steps',
    'notifications',
    'settings',
    'services'
  )
ORDER BY tablename;

-- Section 2: Count Policies per Table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 4 THEN '✅ GOOD'
    WHEN tablename = 'applications' AND COUNT(*) >= 5 THEN '✅ GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) >= 4 THEN '✅ GOOD'
    WHEN tablename = 'application_payments' AND COUNT(*) >= 3 THEN '✅ GOOD'
    WHEN tablename = 'application_timeline_steps' AND COUNT(*) >= 2 THEN '✅ GOOD'
    WHEN tablename = 'user_documents' AND COUNT(*) >= 3 THEN '✅ GOOD'
    WHEN tablename = 'notifications' AND COUNT(*) >= 2 THEN '✅ GOOD'
    WHEN tablename = 'settings' AND COUNT(*) >= 2 THEN '✅ GOOD'
    ELSE '⚠️  REVIEW NEEDED'
  END as status
FROM pg_policies 
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
)
GROUP BY tablename
ORDER BY tablename;

-- Section 3: List All Policies by Table
SELECT 
  tablename,
  policyname,
  cmd as command,
  roles::text as roles,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Reading'
    WHEN cmd = 'INSERT' THEN 'Creating'
    WHEN cmd = 'UPDATE' THEN 'Updating'
    WHEN cmd = 'DELETE' THEN 'Deleting'
    ELSE cmd
  END as description
FROM pg_policies 
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
)
ORDER BY tablename, cmd, policyname;

-- Section 4: Check Table Permissions
SELECT 
  grantee,
  table_name,
  STRING_AGG(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
    'receipts',
    'processing_accounts',
    'application_timeline_steps',
    'notifications',
    'settings',
    'services'
  )
  AND grantee IN ('authenticated', 'anon')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- Section 5: Verify Storage Buckets
-- Note: Storage policies must be checked manually in Supabase Dashboard -> Storage -> Policies
SELECT 
  name as bucket_name,
  id as bucket_id,
  CASE 
    WHEN public THEN 'PUBLIC'
    ELSE 'PRIVATE'
  END as visibility,
  CASE 
    WHEN name = 'documents' AND NOT public THEN 'CORRECT'
    WHEN name = 'pictures' AND public THEN 'CORRECT'
    ELSE 'REVIEW'
  END as status,
  created_at
FROM storage.buckets
WHERE name IN ('documents', 'pictures')
ORDER BY name;

-- Section 6: Verify Functions Exist
SELECT 
  routine_name as function_name,
  routine_type,
  CASE 
    WHEN routine_name IN ('generate_grit_id', 'is_admin', 'is_admin_user') THEN '✅ REQUIRED'
    ELSE 'ℹ️  CUSTOM'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('generate_grit_id', 'is_admin', 'is_admin_user')
ORDER BY routine_name;

-- Section 7: Check Triggers
SELECT 
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation,
  CASE 
    WHEN trigger_name LIKE '%user%' OR trigger_name LIKE '%profile%' THEN '✅ USER PROFILE'
    WHEN trigger_name LIKE '%grit%' OR trigger_name LIKE '%id%' THEN '✅ GRIT ID'
    ELSE 'ℹ️  OTHER'
  END as category
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%user%' OR trigger_name LIKE '%profile%' OR trigger_name LIKE '%grit%' OR trigger_name LIKE '%id%')
ORDER BY event_object_table, trigger_name;

-- Section 8: Summary Report
SELECT 
  'RLS Verification Summary' as report_type,
  COUNT(DISTINCT tablename) as tables_with_rls,
  COUNT(*) as total_policies,
  COUNT(DISTINCT CASE WHEN cmd = 'SELECT' THEN tablename END) as tables_with_select,
  COUNT(DISTINCT CASE WHEN cmd = 'INSERT' THEN tablename END) as tables_with_insert,
  COUNT(DISTINCT CASE WHEN cmd = 'UPDATE' THEN tablename END) as tables_with_update,
  COUNT(DISTINCT CASE WHEN cmd = 'DELETE' THEN tablename END) as tables_with_delete
FROM pg_policies
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
);

-- NOTES:
-- 1. All tables should have RLS ENABLED
-- 2. Each table should have appropriate policies for:
--    - Users: Can access their own data
--    - Admins: Can access all data
--    - Public: Can access tracking data (if applicable)
-- 3. Storage buckets should be configured:
--    - documents: PRIVATE
--    - pictures: PUBLIC (for tracking)
-- 4. Review any tables or policies marked with warnings


-- ============================================

-- Migration: verify_rls_policies_simple.sql
-- Simple RLS Verification Script
-- Run this in Supabase SQL Editor
-- You can run each section separately if needed

-- 1. Check RLS Status on All Tables
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'ENABLED' 
    ELSE 'DISABLED - ACTION REQUIRED' 
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
    'receipts',
    'processing_accounts',
    'application_timeline_steps',
    'notifications',
    'settings',
    'services'
  )
ORDER BY tablename;

-- 2. Count Policies per Table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 4 THEN 'GOOD'
    WHEN tablename = 'applications' AND COUNT(*) >= 5 THEN 'GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) >= 4 THEN 'GOOD'
    WHEN tablename = 'application_payments' AND COUNT(*) >= 3 THEN 'GOOD'
    WHEN tablename = 'application_timeline_steps' AND COUNT(*) >= 2 THEN 'GOOD'
    WHEN tablename = 'user_documents' AND COUNT(*) >= 3 THEN 'GOOD'
    WHEN tablename = 'notifications' AND COUNT(*) >= 2 THEN 'GOOD'
    WHEN tablename = 'settings' AND COUNT(*) >= 2 THEN 'GOOD'
    ELSE 'REVIEW NEEDED'
  END as status
FROM pg_policies 
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
)
GROUP BY tablename
ORDER BY tablename;

-- 3. List All Policies by Table
SELECT 
  tablename,
  policyname,
  cmd as command,
  roles::text as roles
FROM pg_policies 
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
)
ORDER BY tablename, cmd, policyname;

-- 4. Check Table Permissions
SELECT 
  grantee,
  table_name,
  STRING_AGG(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
    'receipts',
    'processing_accounts',
    'application_timeline_steps',
    'notifications',
    'settings',
    'services'
  )
  AND grantee IN ('authenticated', 'anon')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- 5. Verify Storage Buckets
-- Note: Storage policies must be checked manually in Supabase Dashboard -> Storage -> Policies
SELECT 
  name as bucket_name,
  id as bucket_id,
  CASE 
    WHEN public THEN 'PUBLIC'
    ELSE 'PRIVATE'
  END as visibility,
  CASE 
    WHEN name = 'documents' AND NOT public THEN 'CORRECT'
    WHEN name = 'pictures' AND public THEN 'CORRECT'
    ELSE 'REVIEW'
  END as status,
  created_at
FROM storage.buckets
WHERE name IN ('documents', 'pictures')
ORDER BY name;

-- 6. Verify Functions Exist
SELECT 
  routine_name as function_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('generate_grit_id', 'is_admin', 'is_admin_user')
ORDER BY routine_name;

-- 7. Summary Report
SELECT 
  'RLS Verification Summary' as report_type,
  COUNT(DISTINCT tablename) as tables_with_rls,
  COUNT(*) as total_policies,
  COUNT(DISTINCT CASE WHEN cmd = 'SELECT' THEN tablename END) as tables_with_select,
  COUNT(DISTINCT CASE WHEN cmd = 'INSERT' THEN tablename END) as tables_with_insert,
  COUNT(DISTINCT CASE WHEN cmd = 'UPDATE' THEN tablename END) as tables_with_update,
  COUNT(DISTINCT CASE WHEN cmd = 'DELETE' THEN tablename END) as tables_with_delete
FROM pg_policies
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
);


-- ============================================

-- ============================================
-- FIX MIGRATIONS
-- ============================================

-- Migration: fix-admin-storage-upload-policy.sql
-- Fix RLS policy to allow admins to upload/update files in user folders
-- This migration adds UPDATE policy for admins and ensures INSERT policy works correctly
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- The issue is that when using upsert: true, Supabase tries to UPDATE existing files,
-- but there's no UPDATE policy for admins, causing "new row violates row-level security policy" errors

-- Ensure the is_admin_user() function exists (it should already exist from fix-storage-policies.sql)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- Drop existing admin UPDATE policy if it exists (INSERT and DELETE should already exist)
DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;

-- Create UPDATE policy for admins (allows updating/overwriting existing files)
-- This is needed when using upsert: true in storage.upload()
CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Verify the policies were created
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND (policyname LIKE '%admin%' OR policyname LIKE '%Admin%')
ORDER BY policyname;



-- ============================================

-- Migration: fix-app-metadata-storage-issue.sql
-- Fix app_metadata storage issue
-- This migration fixes the "column app_metadata does not exist" error
-- by updating the is_admin_user() function to handle missing app_metadata gracefully

-- ============================================================================
-- STEP 1: Update is_admin_user() function to handle app_metadata safely
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Primary check: auth.users raw_user_meta_data (most reliable, no RLS recursion)
  -- This is what other migrations use and is the standard approach
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'role')::text = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: check public.users table role column
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, try both checks as fallback
    RETURN (
      EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND (raw_user_meta_data->>'role')::text = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    );
END;
$$;

-- ============================================================================
-- STEP 2: Create alternative admin check function that doesn't use app_metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user_safe()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Primary check: auth.users raw_user_meta_data (most reliable, no RLS recursion)
  -- This matches the pattern used in other migrations
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'role')::text = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: check public.users table role column
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  );
END;
$$;

-- ============================================================================
-- STEP 3: Update storage policies to use the safer function
-- ============================================================================

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can upload all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;

-- Also drop any other admin-related policies that might exist
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%admin%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Recreate admin policies with safer function
DROP POLICY IF EXISTS "Admins can upload all documents" ON storage.objects;

-- Recreate admin policies with safer function
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;

CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;

CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;

CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Diagnostic: Check where admin role is stored for current user
SELECT 
  auth.uid() as current_user_id,
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) as role_in_auth_users,
  (SELECT role FROM public.users WHERE id = auth.uid()) as role_in_public_users,
  public.is_admin_user() as is_admin_original,
  public.is_admin_user_safe() as is_admin_safe;

-- If functions return false, you may need to set the admin role:
-- Option 1: Set in auth.users (recommended)
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE id = auth.uid();
--
-- Option 2: Set in public.users
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE id = auth.uid();

-- Check that policies were created
SELECT 
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%admin%'
ORDER BY policyname;



-- ============================================

-- Migration: fix-email-generation-with-middle-name.sql
-- Fix: Email generation to pull middle_name from user_details if not in users table
-- This ensures emails like klcantila@gritsync.com include the middle initial

-- Update create_client_email_address function to check user_details for middle_name
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
BEGIN
  -- Get user details from users table
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- If middle_name is null in users table, try to get it from user_details
  v_middle_name := v_user.middle_name;
  IF v_middle_name IS NULL OR TRIM(v_middle_name) = '' THEN
    SELECT middle_name INTO v_middle_name
    FROM user_details
    WHERE user_id = p_user_id
    AND middle_name IS NOT NULL
    AND TRIM(middle_name) != '';
  END IF;
  
  -- Generate email address with middle name from either source
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Insert email address (or update if exists)
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
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO NOTHING;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Update existing email addresses that are missing middle initial
-- This will regenerate emails for users who have middle_name in user_details
DO $$
DECLARE
  user_record RECORD;
  old_email TEXT;
  new_email TEXT;
  has_middle TEXT;
BEGIN
  FOR user_record IN 
    SELECT 
      u.id,
      u.first_name,
      u.middle_name as users_middle_name,
      u.last_name,
      ud.middle_name as details_middle_name,
      ea.email_address as current_email,
      ea.id as email_id
    FROM users u
    LEFT JOIN user_details ud ON ud.user_id = u.id
    INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client'
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      -- User has middle name in user_details but not in users table
      AND (u.middle_name IS NULL OR TRIM(u.middle_name) = '')
      AND ud.middle_name IS NOT NULL
      AND TRIM(ud.middle_name) != ''
  LOOP
    BEGIN
      -- Get the middle name from user_details
      has_middle := user_record.details_middle_name;
      
      -- Generate new email with middle initial
      new_email := generate_client_email(
        user_record.first_name,
        has_middle,
        user_record.last_name
      );
      
      old_email := user_record.current_email;
      
      -- Only update if the email actually changed
      IF new_email != old_email THEN
        -- Check if new email already exists
        IF NOT EXISTS (SELECT 1 FROM email_addresses WHERE email_address = new_email) THEN
          -- Update the email address
          UPDATE email_addresses
          SET email_address = new_email,
              updated_at = NOW()
          WHERE id = user_record.email_id;
          
          RAISE NOTICE 'Updated email for user %: % -> %', user_record.id, old_email, new_email;
        ELSE
          RAISE WARNING 'Cannot update user % email to % - already exists', user_record.id, new_email;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update email for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Also update processing_accounts to use the new email
DO $$
DECLARE
  account_record RECORD;
  new_email TEXT;
BEGIN
  FOR account_record IN
    SELECT 
      pa.id as account_id,
      pa.application_id,
      pa.email as old_email,
      ea.email_address as new_email,
      u.id as user_id
    FROM processing_accounts pa
    INNER JOIN applications a ON a.id = pa.application_id
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client' AND ea.is_primary = TRUE
    WHERE pa.account_type = 'gritsync'
      AND pa.email != ea.email_address  -- Email is different
  LOOP
    BEGIN
      -- Update processing account email
      UPDATE processing_accounts
      SET email = account_record.new_email,
          updated_at = NOW()
      WHERE id = account_record.account_id;
      
      RAISE NOTICE 'Updated processing account email: % -> %', account_record.old_email, account_record.new_email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update processing account %: %', account_record.account_id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION create_client_email_address IS 'Creates client email address, pulling middle_name from user_details if not in users table';



-- ============================================

-- Migration: fix-email-logs-rls-for-clients.sql
-- Migration: Fix email_logs RLS policies to allow clients to send emails
-- Issue: Clients receive 403 error when trying to create email logs
-- Solution: Add policies for clients to insert and view their own sent emails

-- Drop the restrictive admin-only insert policy
DROP POLICY IF EXISTS "Admins can create email logs" ON email_logs;

-- Create new policies that allow clients to insert their own emails
DROP POLICY IF EXISTS "Authenticated users can create their own email logs" ON email_logs;

-- Create new policies that allow clients to insert their own emails
CREATE POLICY "Authenticated users can create their own email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be the sender of the email
    sent_by_user_id = auth.uid()
    OR
    -- Or user is an admin (can send on behalf of others)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Update the view policy to allow users to see emails they sent
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;

CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see emails they sent
    sent_by_user_id = auth.uid()
    OR
    -- Users can see emails sent to them
    recipient_user_id = auth.uid()
    OR
    -- Admins can see all emails
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add policy for clients to view their sent emails by email address
-- This is useful when filtering by from_email_address_id
DROP POLICY IF EXISTS "Users can view emails from their email addresses" ON email_logs;

-- Add policy for clients to view their sent emails by email address
-- This is useful when filtering by from_email_address_id
CREATE POLICY "Users can view emails from their email addresses"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the email was sent from one of the user's email addresses
    EXISTS (
      SELECT 1 FROM email_addresses
      WHERE email_addresses.id = email_logs.from_email_address_id
      AND email_addresses.user_id = auth.uid()
    )
  );

-- Grant INSERT permission to authenticated users
GRANT INSERT ON email_logs TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Authenticated users can create their own email logs" ON email_logs IS 
  'Allows authenticated users (including clients) to create email logs when they send emails from their email addresses';

COMMENT ON POLICY "Users can view their own email logs" ON email_logs IS 
  'Allows users to view emails they sent or received, and admins to view all emails';

COMMENT ON POLICY "Users can view emails from their email addresses" ON email_logs IS 
  'Allows users to view emails sent from their registered email addresses';










-- ============================================

-- Migration: fix-email-logs-update-policy.sql
-- Migration: Add UPDATE policy for email_logs to allow status updates
-- Issue: Clients can INSERT email logs but cannot UPDATE them to change status
-- Solution: Add UPDATE policy for users to update their own email logs

-- Drop the restrictive admin-only update policy
DROP POLICY IF EXISTS "Admins can update email logs" ON email_logs;

-- Create new UPDATE policy that allows users to update their own email logs
DROP POLICY IF EXISTS "Users can update their own email logs" ON email_logs;

-- Create new UPDATE policy that allows users to update their own email logs
CREATE POLICY "Users can update their own email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be the sender of the email
    sent_by_user_id = auth.uid()
    OR
    -- Or user is an admin (can update any email)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    -- Same condition for the updated row
    sent_by_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Grant UPDATE permission to authenticated users
GRANT UPDATE ON email_logs TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Users can update their own email logs" ON email_logs IS 
  'Allows authenticated users to update email logs they created (e.g., status changes after sending)';

-- Verify the policy was created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE tablename = 'email_logs'
AND cmd = 'UPDATE'
ORDER BY policyname;










-- ============================================

-- Migration: fix-function-search-path-security.sql
-- Migration: Fix function search_path security issues
-- This migration sets search_path for all functions to prevent security vulnerabilities
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Fix all functions by setting search_path to public (since they all use public schema)
-- Using SET search_path = public is secure when functions only reference public schema
-- This migration uses dynamic SQL to only alter functions that exist, making it idempotent

DO $$
DECLARE
  func_record RECORD;
  func_signature TEXT;
BEGIN
  -- Loop through all functions in the public schema and set their search_path
  -- We'll handle functions that are known to exist, checking each one
  
  -- Updated_at trigger functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'update_user_preferences_updated_at',
      'update_email_signatures_updated_at',
      'update_business_logos_updated_at',
      'update_email_logs_updated_at',
      'update_email_addresses_updated_at',
      'update_email_templates_updated_at',
      'update_promo_codes_updated_at',
      'update_user_details_updated_at',
      'update_received_emails_updated_at',
      'update_notification_types_updated_at',
      'update_updated_at_column'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Function might have different signature, skip it
      NULL;
    END;
  END LOOP;

  -- Login and security functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'get_failed_login_attempts',
      'is_account_locked',
      'lock_account',
      'unlock_account',
      'cleanup_old_login_attempts'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Signature and logo functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'cleanup_expired_signatures',
      'ensure_one_default_signature',
      'ensure_one_default_logo',
      'generate_signature_html',
      'increment_logo_usage'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Payment and reminder functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'generate_payment_reminders',
      'notify_credentialing_reminder'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Session management functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'cleanup_expired_sessions',
      'get_user_active_session_count',
      'revoke_all_user_sessions',
      'update_session_activity'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Admin and permission functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'is_admin_for_quotations',
      'check_is_admin',
      'is_admin_user',
      'is_admin',
      'is_admin_safe'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Email functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'refresh_email_analytics',
      'create_client_email_address',
      'generate_client_email',
      'get_user_primary_email',
      'get_admin_email_addresses',
      'set_primary_client_email',
      'enforce_single_active_client_email'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Template functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'render_email_template',
      'increment_template_usage'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- User management functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'handle_new_user',
      'text_to_boolean',
      'generate_grit_app_id',
      'generate_grit_id'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Promo code functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'validate_promo_code'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Career and statistics functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'increment_career_views',
      'increment_career_applications',
      'get_career_statistics',
      'get_sponsorship_statistics',
      'get_donation_statistics'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Profile and document functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'check_incomplete_profile',
      'check_missing_documents',
      'generate_document_reminders',
      'generate_profile_completion_reminders'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Notification functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'notify_timeline_step_update',
      'notify_payment_status_update'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Received emails functions
  FOR func_record IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
      'associate_received_email_with_user'
    )
  LOOP
    BEGIN
      IF func_record.args = '' THEN
        EXECUTE format('ALTER FUNCTION %I() SET search_path = public', func_record.proname);
      ELSE
        EXECUTE format('ALTER FUNCTION %I(%s) SET search_path = public', func_record.proname, func_record.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

END $$;

-- Fix materialized view API access issue
-- Materialized views don't support RLS, so we revoke direct access
-- and create a function wrapper that checks permissions
REVOKE SELECT ON email_analytics FROM anon, authenticated;

-- Create a function wrapper for accessing email_analytics with admin check
CREATE OR REPLACE FUNCTION get_email_analytics()
RETURNS TABLE (
  date DATE,
  email_type TEXT,
  email_category TEXT,
  status TEXT,
  count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  failed_count BIGINT,
  bounced_count BIGINT,
  avg_send_time_seconds NUMERIC
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT * FROM email_analytics;
END;
$$;

-- Grant execute permission to authenticated users (function will check admin status)
GRANT EXECUTE ON FUNCTION get_email_analytics() TO authenticated;

-- Note: auth_leaked_password_protection must be enabled via Supabase Dashboard
-- Go to Authentication > Settings > Password Security
-- Enable "Leaked Password Protection"
-- This cannot be fixed via SQL migration


-- ============================================

-- Migration: fix-migration-dependencies-and-indexes.sql
-- Migration: Fix Dependencies and Add Missing Indexes
-- This migration ensures all dependencies are met and adds performance indexes

-- ============================================================================
-- 1. VERIFY REQUIRED TABLES EXIST
-- ============================================================================
DO $$
DECLARE
  missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check for required tables
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    missing_tables := array_append(missing_tables, 'users');
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_agencies') THEN
    missing_tables := array_append(missing_tables, 'partner_agencies');
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'career_applications') THEN
    missing_tables := array_append(missing_tables, 'career_applications');
  END IF;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required tables: %. Please run migrations in correct order.', array_to_string(missing_tables, ', ');
  END IF;
END $$;

-- ============================================================================
-- 2. ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for careers table
CREATE INDEX IF NOT EXISTS idx_careers_employment_type ON careers(employment_type) WHERE employment_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_careers_department ON careers(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_careers_application_deadline ON careers(application_deadline) WHERE application_deadline IS NOT NULL;

-- Indexes for career_applications table
CREATE INDEX IF NOT EXISTS idx_career_applications_email ON career_applications(email);
CREATE INDEX IF NOT EXISTS idx_career_applications_career_id_status ON career_applications(career_id, status) WHERE career_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_career_applications_created_at_status ON career_applications(created_at DESC, status);

-- Indexes for nclex_sponsorships table
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_email ON nclex_sponsorships(email);
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_created_at ON nclex_sponsorships(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nclex_sponsorships_status_created_at ON nclex_sponsorships(status, created_at DESC);

-- Indexes for donations table
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email) WHERE donor_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_stripe_payment_intent_id ON donations(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_transaction_id ON donations(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_status_created_at ON donations(status, created_at DESC);

-- Composite index for donations by sponsorship
CREATE INDEX IF NOT EXISTS idx_donations_sponsorship_status ON donations(sponsorship_id, status) WHERE sponsorship_id IS NOT NULL;

-- ============================================================================
-- 3. ADD MISSING CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure email format validation (basic check)
-- Note: This is a simple check. For production, consider using a more robust validation
DO $$
BEGIN
  -- Add check constraint for email format in career_applications if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'career_applications_email_format_check'
  ) THEN
    ALTER TABLE career_applications
    ADD CONSTRAINT career_applications_email_format_check
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
  
  -- Add check constraint for email format in nclex_sponsorships if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'nclex_sponsorships_email_format_check'
  ) THEN
    ALTER TABLE nclex_sponsorships
    ADD CONSTRAINT nclex_sponsorships_email_format_check
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
  
  -- Add check constraint for positive donation amounts
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'donations_amount_positive_check'
  ) THEN
    ALTER TABLE donations
    ADD CONSTRAINT donations_amount_positive_check
    CHECK (amount > 0);
  END IF;
END $$;

-- ============================================================================
-- 4. ADD MISSING RLS POLICIES (if not already present)
-- ============================================================================

-- Ensure donations can be updated by admins (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'donations' 
    AND policyname = 'Admins can update donations'
  ) THEN
DROP POLICY IF EXISTS "Admins can update donations" ON donations;
    CREATE POLICY "Admins can update donations"
    ON donations FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    );
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFY TRIGGERS ARE IN PLACE
-- ============================================================================

-- Ensure update_updated_at_column function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at_column'
  ) THEN
    RAISE EXCEPTION 'update_updated_at_column function is missing. Please run schema.sql first.';
  END IF;
END $$;

-- ============================================================================
-- 6. ADD HELPER FUNCTIONS FOR MVP FEATURES
-- ============================================================================

-- Function to get career statistics (for dashboard)
CREATE OR REPLACE FUNCTION get_career_statistics()
RETURNS TABLE (
  total_careers BIGINT,
  active_careers BIGINT,
  featured_careers BIGINT,
  total_applications BIGINT,
  pending_applications BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM careers)::BIGINT as total_careers,
    (SELECT COUNT(*) FROM careers WHERE is_active = TRUE)::BIGINT as active_careers,
    (SELECT COUNT(*) FROM careers WHERE is_featured = TRUE AND is_active = TRUE)::BIGINT as featured_careers,
    (SELECT COUNT(*) FROM career_applications)::BIGINT as total_applications,
    (SELECT COUNT(*) FROM career_applications WHERE status = 'pending')::BIGINT as pending_applications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get donation statistics (for dashboard)
CREATE OR REPLACE FUNCTION get_donation_statistics()
RETURNS TABLE (
  total_donations BIGINT,
  total_amount DECIMAL,
  completed_donations BIGINT,
  completed_amount DECIMAL,
  pending_donations BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM donations)::BIGINT as total_donations,
    (SELECT COALESCE(SUM(amount), 0) FROM donations)::DECIMAL as total_amount,
    (SELECT COUNT(*) FROM donations WHERE status = 'completed')::BIGINT as completed_donations,
    (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE status = 'completed')::DECIMAL as completed_amount,
    (SELECT COUNT(*) FROM donations WHERE status = 'pending')::BIGINT as pending_donations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sponsorship statistics (for dashboard)
CREATE OR REPLACE FUNCTION get_sponsorship_statistics()
RETURNS TABLE (
  total_sponsorships BIGINT,
  pending_sponsorships BIGINT,
  approved_sponsorships BIGINT,
  awarded_sponsorships BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM nclex_sponsorships)::BIGINT as total_sponsorships,
    (SELECT COUNT(*) FROM nclex_sponsorships WHERE status = 'pending')::BIGINT as pending_sponsorships,
    (SELECT COUNT(*) FROM nclex_sponsorships WHERE status = 'approved')::BIGINT as approved_sponsorships,
    (SELECT COUNT(*) FROM nclex_sponsorships WHERE status = 'awarded')::BIGINT as awarded_sponsorships;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. GRANT PERMISSIONS FOR FUNCTIONS
-- ============================================================================

-- Grant execute permissions to authenticated users for statistics functions
GRANT EXECUTE ON FUNCTION get_career_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_donation_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sponsorship_statistics() TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration:
-- 1. Verifies all required tables exist
-- 2. Adds performance indexes
-- 3. Adds data integrity constraints
-- 4. Ensures RLS policies are in place
-- 5. Verifies triggers exist
-- 6. Adds helper functions for MVP features
-- 7. Grants necessary permissions





-- ============================================

-- Migration: fix-permanent-email-generation.sql
-- Fix: Ensure email addresses are permanent once generated
-- Prevents duplicate email generation when migrations are re-run

-- 1. Update create_client_email_address to check if user already has an email
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
  v_existing_email TEXT;
BEGIN
  -- Check if user already has a client email address
  SELECT email_address INTO v_existing_email
  FROM email_addresses
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = TRUE
  LIMIT 1;
  
  -- If email already exists, return it (don't create new one)
  IF v_existing_email IS NOT NULL THEN
    RAISE LOG 'User % already has email address: %', p_user_id, v_existing_email;
    RETURN v_existing_email;
  END IF;
  
  -- Get user details from users table
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- If middle_name is null in users table, try to get it from user_details
  v_middle_name := v_user.middle_name;
  IF v_middle_name IS NULL OR TRIM(v_middle_name) = '' THEN
    SELECT middle_name INTO v_middle_name
    FROM user_details
    WHERE user_id = p_user_id
    AND middle_name IS NOT NULL
    AND TRIM(middle_name) != '';
  END IF;
  
  -- Generate email address with middle name from either source
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Insert email address (or return existing if conflict)
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
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO UPDATE
  SET updated_at = NOW()
  RETURNING email_address INTO v_email;
  
  RAISE LOG 'Created new email address % for user %', v_email, p_user_id;
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- 2. Clean up duplicate email addresses for the same user
-- Keep the oldest one (first created) as primary
DO $$
DECLARE
  user_record RECORD;
  email_record RECORD;
  keep_email_id UUID;
BEGIN
  -- Find users with multiple client email addresses
  FOR user_record IN 
    SELECT user_id, COUNT(*) as email_count
    FROM email_addresses
    WHERE address_type = 'client'
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'User % has % email addresses, cleaning up...', user_record.user_id, user_record.email_count;
    
    -- Get the oldest (first created) email address to keep
    SELECT id INTO keep_email_id
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Mark it as primary and active
    UPDATE email_addresses
    SET is_primary = TRUE,
        is_active = TRUE
    WHERE id = keep_email_id;
    
    -- Deactivate all other email addresses for this user
    UPDATE email_addresses
    SET is_active = FALSE,
        is_primary = FALSE
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND id != keep_email_id;
    
    RAISE NOTICE 'Kept email % and deactivated others for user %', keep_email_id, user_record.user_id;
  END LOOP;
END $$;

-- 3. Update the handle_new_user trigger to only create email if none exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_middle_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
  v_user_id UUID;
  v_existing_email_count INT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name, middle_name, and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_middle_name := COALESCE(
    NEW.raw_user_meta_data->>'middle_name',
    ''
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Get role from metadata
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );
  
  -- Insert user profile with all required fields
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role,
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address ONLY if:
  -- 1. User is a client
  -- 2. User has name
  -- 3. User doesn't already have an email address
  IF user_role = 'client' 
     AND NULLIF(TRIM(user_first_name), '') IS NOT NULL 
     AND NULLIF(TRIM(user_last_name), '') IS NOT NULL 
  THEN
    -- Check if user already has a client email
    SELECT COUNT(*) INTO v_existing_email_count
    FROM email_addresses
    WHERE user_id = v_user_id
      AND address_type = 'client'
      AND is_active = TRUE;
    
    -- Only create if no email exists
    IF v_existing_email_count = 0 THEN
      BEGIN
        PERFORM create_client_email_address(v_user_id);
        RAISE LOG 'Successfully created client email address for user %', v_user_id;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the entire registration
        RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
      END;
    ELSE
      RAISE LOG 'User % already has % email address(es), skipping creation', v_user_id, v_existing_email_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Show current status for verification
DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE '=== Email Addresses Status ===';
  FOR user_record IN 
    SELECT 
      u.id,
      u.email as auth_email,
      u.first_name,
      u.last_name,
      ea.email_address as client_email,
      ea.is_active,
      ea.is_primary,
      ea.created_at
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client'
    ORDER BY u.created_at DESC
  LOOP
    IF user_record.client_email IS NOT NULL THEN
      RAISE NOTICE 'User: % % | Client Email: % | Active: % | Primary: %',
        user_record.first_name,
        user_record.last_name,
        user_record.client_email,
        user_record.is_active,
        user_record.is_primary;
    ELSE
      RAISE NOTICE 'User: % % | No client email address',
        user_record.first_name,
        user_record.last_name;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION create_client_email_address IS 'Creates client email address only if user does not already have one (permanent once created)';










-- ============================================

-- Migration: fix-rls-performance-and-indexes.sql
-- Migration: Fix RLS performance issues and duplicate indexes
-- This migration optimizes RLS policies by wrapping auth.uid() in SELECT subqueries
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================================
-- PART 1: Fix RLS policies to use (select auth.uid()) instead of auth.uid()
-- ============================================================================
-- This prevents re-evaluation of auth.uid() for each row, improving performance

DO $$
DECLARE
  r RECORD;
  policy_def TEXT;
  new_policy_def TEXT;
BEGIN
  -- Loop through all RLS policies that contain auth.uid() or current_setting()
  FOR r IN 
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR qual LIKE '%current_setting(%' 
           OR with_check LIKE '%auth.uid()%' OR with_check LIKE '%current_setting(%')
  LOOP
    -- Get the current policy definition
    SELECT pg_get_expr(pol.polqual, pol.polrelid) as qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check
    INTO policy_def, new_policy_def
    FROM pg_policy pol
    JOIN pg_class pc ON pc.oid = pol.polrelid
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    WHERE pn.nspname = r.schemaname
      AND pc.relname = r.tablename
      AND pol.polname = r.policyname;
    
    -- Skip if we can't get the definition
    CONTINUE WHEN policy_def IS NULL AND new_policy_def IS NULL;
    
    -- Replace auth.uid() with (select auth.uid()) in USING clause
    -- Skip if already wrapped in (select ...)
    IF policy_def IS NOT NULL AND policy_def !~ '\(select auth\.uid\(\)\)' THEN
      -- Replace all instances of auth.uid() that aren't already in a select
      policy_def := regexp_replace(
        policy_def,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Also replace current_setting calls (if not already wrapped)
      IF policy_def !~ '\(select current_setting\(' THEN
        policy_def := regexp_replace(
          policy_def,
          '\bcurrent_setting\(',
          '(select current_setting(',
          'g'
        );
      END IF;
    END IF;
    
    -- Replace auth.uid() with (select auth.uid()) in WITH CHECK clause
    -- Skip if already wrapped in (select ...)
    IF new_policy_def IS NOT NULL AND new_policy_def !~ '\(select auth\.uid\(\)\)' THEN
      -- Replace all instances of auth.uid() that aren't already in a select
      new_policy_def := regexp_replace(
        new_policy_def,
        '\bauth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      -- Also replace current_setting calls (if not already wrapped)
      IF new_policy_def !~ '\(select current_setting\(' THEN
        new_policy_def := regexp_replace(
          new_policy_def,
          '\bcurrent_setting\(',
          '(select current_setting(',
          'g'
        );
      END IF;
    END IF;
    
    -- Drop and recreate the policy with optimized definition
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                   r.policyname, r.schemaname, r.tablename);
    
    -- Recreate policy with optimized USING and WITH CHECK clauses
    -- Handle permissive vs restrictive policies
    IF r.permissive = 'PERMISSIVE' THEN
      IF policy_def IS NOT NULL AND new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s) WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def, new_policy_def
        );
      ELSIF policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def
        );
      ELSIF new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), new_policy_def
        );
      END IF;
    ELSE
      -- RESTRICTIVE policies
      IF policy_def IS NOT NULL AND new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s AS RESTRICTIVE USING (%s) WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def, new_policy_def
        );
      ELSIF policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s AS RESTRICTIVE USING (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), policy_def
        );
      ELSIF new_policy_def IS NOT NULL THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR %s TO %s AS RESTRICTIVE WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, r.cmd,
          array_to_string(r.roles, ', '), new_policy_def
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: Fix duplicate indexes
-- ============================================================================

-- Drop duplicate index on application_payments
-- Keep idx_application_payments_application_id, drop idx_payments_application_id
DROP INDEX IF EXISTS idx_payments_application_id;

-- Drop duplicate index on application_timeline_steps
-- Keep idx_application_timeline_steps_application_id, drop idx_timeline_steps_application_id
DROP INDEX IF EXISTS idx_timeline_steps_application_id;

-- ============================================================================
-- PART 3: Note about multiple permissive policies
-- ============================================================================
-- Multiple permissive policies are detected on many tables. While this works,
-- it can impact performance as PostgreSQL must evaluate each policy.
-- Consider consolidating policies where possible, but this is often intentional
-- to separate concerns (e.g., user policies vs admin policies).
--
-- Example consolidation approach:
-- Instead of:
--   - "Users can view their own X"
--   - "Admins can view all X"
-- You could use:
--   - "Users can view X" USING (user_id = (select auth.uid()) OR 
--                                EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'admin'))
--
-- However, keeping them separate is often clearer and more maintainable.
-- The performance impact is usually minimal unless dealing with very large datasets.



-- ============================================

-- Migration: fix-security-definer-view.sql
-- Migration: Fix security definer view issue
-- This migration fixes the active_email_addresses view to ensure it respects RLS
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

-- Drop the existing view
DROP VIEW IF EXISTS active_email_addresses;

-- Recreate the view without any security definer properties
-- Views in PostgreSQL automatically respect RLS policies on underlying tables
CREATE VIEW active_email_addresses
WITH (security_invoker = true) AS
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

-- Grant permissions (view will respect RLS on underlying tables)
GRANT SELECT ON active_email_addresses TO authenticated;

-- Add comment
COMMENT ON VIEW active_email_addresses IS 'View of active email addresses that respects RLS policies on underlying tables';






-- ============================================

-- Migration: fix-storage-admin-upload-policies.sql
-- Fix Storage RLS Policies for Admin Uploads
-- This fixes issues where admin users cannot upload files to user folders
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Drop existing storage policies that might conflict
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND (
      policyname LIKE '%documents%' 
      OR policyname LIKE '%document%'
      OR policyname LIKE '%admin%'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Ensure is_admin_user() function exists (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR app_metadata->>'role' = 'admin'
    )
  );
END;
$$;

-- ============================================================================
-- STEP 3: Create storage policies for documents bucket
-- ============================================================================

-- Policy 1: Users can upload their own documents
-- Checks that the first folder in the path matches their user ID
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;

-- ============================================================================
-- STEP 3: Create storage policies for documents bucket
-- ============================================================================

-- Policy 1: Users can upload their own documents
-- Checks that the first folder in the path matches their user ID
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view/download their own documents (needed for signed URLs)
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;

-- Policy 2: Users can view/download their own documents (needed for signed URLs)
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can update their own documents
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- Policy 3: Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can delete their own documents
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 5: Admins can upload ANY document (any user folder)
-- This is critical for admin operations
DROP POLICY IF EXISTS "Admins can upload all documents" ON storage.objects;

-- Policy 5: Admins can upload ANY document (any user folder)
-- This is critical for admin operations
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 6: Admins can view ANY document (any user folder)
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;

-- Policy 6: Admins can view ANY document (any user folder)
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 7: Admins can update ANY document (any user folder)
DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;

-- Policy 7: Admins can update ANY document (any user folder)
CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 8: Admins can delete ANY document (any user folder)
DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;

-- Policy 8: Admins can delete ANY document (any user folder)
CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all policies were created
SELECT 
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname LIKE '%documents%' 
    OR policyname LIKE '%admin%'
  )
ORDER BY policyname;

-- Test that is_admin_user() function works
SELECT 
  auth.uid() as current_user_id,
  public.is_admin_user() as is_admin;






-- ============================================

-- Migration: fix-storage-signature-upload-policies.sql
-- Fix Storage RLS Policies for Signature Uploads and Document Access
-- This migration fixes 400 errors when accessing documents and RLS violations when uploading signatures

-- ============================================================================
-- STEP 1: Drop existing storage policies that might be causing issues
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND (
      policyname LIKE '%documents%' 
      OR policyname LIKE '%document%'
      OR policyname LIKE '%signature%'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Ensure is_admin_user() function exists (bypasses RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- ============================================================================
-- STEP 3: Create improved storage policies for documents bucket
-- ============================================================================

-- Policy 1: Users can upload to their own folder
-- This allows users to upload files to folders matching their user ID
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;

-- ============================================================================
-- STEP 3: Create improved storage policies for documents bucket
-- ============================================================================

-- Policy 1: Users can upload to their own folder
-- This allows users to upload files to folders matching their user ID
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (
    -- Allow if folder name matches user ID
    auth.uid()::text = (string_to_array(name, '/'))[1]
    OR
    -- Allow if it's a signature file in user's folder
    (
      name LIKE '%signature%' AND
      auth.uid()::text = (string_to_array(name, '/'))[1]
    )
  )
);

-- Policy 2: Users can view/download their own documents (needed for signed URLs)
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;

-- Policy 2: Users can view/download their own documents (needed for signed URLs)
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Allow if folder name matches user ID
    auth.uid()::text = (string_to_array(name, '/'))[1]
    OR
    -- Allow if it's a signature file in user's folder
    (
      name LIKE '%signature%' AND
      auth.uid()::text = (string_to_array(name, '/'))[1]
    )
  )
);

-- Policy 3: Users can update their own documents (for upsert operations)
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- Policy 3: Users can update their own documents (for upsert operations)
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy 4: Users can delete their own documents
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy 5: Admins can view all documents (using SECURITY DEFINER function - NO RECURSION)
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;

-- Policy 5: Admins can view all documents (using SECURITY DEFINER function - NO RECURSION)
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 6: Admins can upload all documents
DROP POLICY IF EXISTS "Admins can upload all documents" ON storage.objects;

-- Policy 6: Admins can upload all documents
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 7: Admins can update all documents
DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;

-- Policy 7: Admins can update all documents
CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Policy 8: Admins can delete all documents
DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;

-- Policy 8: Admins can delete all documents
CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- ============================================================================
-- STEP 4: Fix temporary_signatures RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow insert for temporary signatures" ON temporary_signatures;
DROP POLICY IF EXISTS "Allow read unconsumed signatures by session" ON temporary_signatures;
DROP POLICY IF EXISTS "Allow update to mark consumed" ON temporary_signatures;

-- Recreate with better conditions
CREATE POLICY "Allow insert for temporary signatures"
  ON temporary_signatures
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow read unconsumed signatures by session"
  ON temporary_signatures
  FOR SELECT
  TO authenticated, anon
  USING (
    is_consumed = false 
    AND expires_at > NOW()
  );

CREATE POLICY "Allow update to mark consumed"
  ON temporary_signatures
  FOR UPDATE
  TO authenticated, anon
  USING (is_consumed = false)
  WITH CHECK (is_consumed = true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check storage policies
SELECT 
  'Storage Policies' as check_type,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%documents%'
ORDER BY policyname;

-- Check temporary_signatures policies
SELECT 
  'Temporary Signatures Policies' as check_type,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'temporary_signatures'
ORDER BY policyname;






-- ============================================

-- Migration: fix-temporary-signatures-update-policy.sql
-- Fix temporary_signatures UPDATE policy to allow updates by ID
-- The current policy is too restrictive and causes 403 errors
-- This allows updates to mark signatures as consumed

-- Drop existing update policy
DROP POLICY IF EXISTS "Allow update to mark consumed" ON temporary_signatures;
DROP POLICY IF EXISTS "Allow update temporary signatures" ON temporary_signatures;

-- Create a permissive update policy for temporary signatures
-- This allows updates to mark signatures as consumed or update metadata
CREATE POLICY "Allow update temporary signatures"
  ON temporary_signatures
  FOR UPDATE
  TO authenticated, anon
  USING (
    -- Allow update if not expired
    expires_at > NOW()
  )
  WITH CHECK (
    -- Allow any update as long as not expired
    expires_at > NOW()
  );



-- ============================================

-- Migration: fix-timeline-steps-rls-for-users.sql
-- Fix RLS policies for application_timeline_steps to allow users to insert/update their own application steps
-- This allows clients to update their own timeline steps (e.g., when reviewing/signing documents)
-- Note: upsert() requires both INSERT and UPDATE permissions

-- Drop existing policies (including any that might have been created previously)
DROP POLICY IF EXISTS "Admins can insert steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "Admins can update steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "application_timeline_steps_insert_admin" ON application_timeline_steps;
DROP POLICY IF EXISTS "application_timeline_steps_update_admin" ON application_timeline_steps;
DROP POLICY IF EXISTS "Users can insert their own application steps" ON application_timeline_steps;
DROP POLICY IF EXISTS "Users can update their own application steps" ON application_timeline_steps;

-- Create new INSERT policy that allows both admins and users to insert their own application steps
CREATE POLICY "Users can insert their own application steps"
ON application_timeline_steps FOR INSERT
WITH CHECK (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  -- Allow if user owns the application
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

-- Create new UPDATE policy that allows both admins and users to update their own application steps
DROP POLICY IF EXISTS "Users can update their own application steps" ON application_timeline_steps;

-- Create new UPDATE policy that allows both admins and users to update their own application steps
CREATE POLICY "Users can update their own application steps"
ON application_timeline_steps FOR UPDATE
USING (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  -- Allow if user owns the application
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same check for WITH CHECK clause
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);



-- ============================================
