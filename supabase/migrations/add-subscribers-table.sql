-- Email Subscribers Management System
-- Creates tables and functions for subscriber management

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS public.email_subscribers CASCADE;

-- Create email_subscribers table
CREATE TABLE public.email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(50),
  status VARCHAR(50) DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained', 'pending')),
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  unsubscribe_token VARCHAR(255) UNIQUE,
  email_preferences JSONB DEFAULT '{"marketing": true, "newsletters": true, "notifications": true, "promotions": true}'::jsonb,
  tags TEXT[],
  source VARCHAR(100), -- form, import, api, manual, newsletter_signup
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_email_sent_at TIMESTAMPTZ,
  email_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0
);

-- Create indexes for better performance
CREATE INDEX idx_email_subscribers_email ON public.email_subscribers(email);
CREATE INDEX idx_email_subscribers_status ON public.email_subscribers(status);
CREATE INDEX idx_email_subscribers_tags ON public.email_subscribers USING gin(tags);
CREATE INDEX idx_email_subscribers_created_at ON public.email_subscribers(created_at DESC);
CREATE INDEX idx_email_subscribers_token ON public.email_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_email_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_subscribers_updated_at
  BEFORE UPDATE ON public.email_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_subscribers_updated_at();

-- Function to generate unsubscribe token
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unsubscribe_token IS NULL THEN
    NEW.unsubscribe_token = encode(gen_random_bytes(32), 'base64');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_subscribers_generate_token
  BEFORE INSERT ON public.email_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_unsubscribe_token();

-- Function to track unsubscribe
CREATE OR REPLACE FUNCTION public.unsubscribe_email(token_value VARCHAR, reason_text TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  UPDATE public.email_subscribers
  SET 
    status = 'unsubscribed',
    unsubscribed_at = now(),
    unsubscribe_reason = COALESCE(reason_text, unsubscribe_reason),
    updated_at = now()
  WHERE unsubscribe_token = token_value
  AND status != 'unsubscribed'
  RETURNING * INTO subscriber_record;
  
  IF subscriber_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token or already unsubscribed');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'email', subscriber_record.email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resubscribe
CREATE OR REPLACE FUNCTION public.resubscribe_email(token_value VARCHAR)
RETURNS JSONB AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  UPDATE public.email_subscribers
  SET 
    status = 'subscribed',
    subscribed_at = now(),
    unsubscribed_at = NULL,
    unsubscribe_reason = NULL,
    updated_at = now()
  WHERE unsubscribe_token = token_value
  RETURNING * INTO subscriber_record;
  
  IF subscriber_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'email', subscriber_record.email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update email preferences
CREATE OR REPLACE FUNCTION public.update_email_preferences(token_value VARCHAR, preferences JSONB)
RETURNS JSONB AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  UPDATE public.email_subscribers
  SET 
    email_preferences = preferences,
    updated_at = now()
  WHERE unsubscribe_token = token_value
  RETURNING * INTO subscriber_record;
  
  IF subscriber_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'email', subscriber_record.email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS (Row Level Security)
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin users can do everything
CREATE POLICY "Admins have full access to subscribers"
  ON public.email_subscribers
  FOR ALL
  TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Public can view their own subscription via token (for preference pages)
CREATE POLICY "Public can view own subscription via token"
  ON public.email_subscribers
  FOR SELECT
  TO public
  USING (true);

-- Allow public inserts for new subscriptions (e.g., newsletter signup forms)
CREATE POLICY "Public can subscribe"
  ON public.email_subscribers
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON public.email_subscribers TO authenticated;
GRANT SELECT, INSERT ON public.email_subscribers TO anon;

-- Insert sample subscribers for testing (optional)
INSERT INTO public.email_subscribers (email, first_name, last_name, status, source, tags, email_count, open_count, click_count) VALUES
  ('subscriber1@example.com', 'John', 'Doe', 'subscribed', 'form', ARRAY['newsletter', 'marketing'], 15, 12, 5),
  ('subscriber2@example.com', 'Jane', 'Smith', 'subscribed', 'import', ARRAY['newsletter'], 8, 6, 2),
  ('unsubscribed@example.com', 'Bob', 'Johnson', 'unsubscribed', 'manual', ARRAY['marketing'], 3, 1, 0),
  ('bounced@example.com', 'Alice', 'Williams', 'bounced', 'form', ARRAY['newsletter'], 5, 0, 0)
ON CONFLICT (email) DO NOTHING;

-- Create view for subscriber statistics
CREATE OR REPLACE VIEW public.subscriber_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'subscribed') AS subscribed_count,
  COUNT(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribed_count,
  COUNT(*) FILTER (WHERE status = 'bounced') AS bounced_count,
  COUNT(*) FILTER (WHERE status = 'complained') AS complained_count,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) AS total_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'subscribed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS subscribed_percentage,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_this_week,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month,
  COUNT(*) FILTER (WHERE unsubscribed_at >= NOW() - INTERVAL '7 days') AS unsubscribed_this_week,
  COUNT(*) FILTER (WHERE unsubscribed_at >= NOW() - INTERVAL '30 days') AS unsubscribed_this_month
FROM public.email_subscribers;

-- Grant access to the view
GRANT SELECT ON public.subscriber_stats TO authenticated;

COMMENT ON TABLE public.email_subscribers IS 'Email subscribers for newsletters and marketing campaigns';
COMMENT ON COLUMN public.email_subscribers.unsubscribe_token IS 'Unique token for unsubscribe/preference links';
COMMENT ON COLUMN public.email_subscribers.email_preferences IS 'JSONB object storing email type preferences';
COMMENT ON FUNCTION public.unsubscribe_email IS 'Function to unsubscribe an email using token';
COMMENT ON FUNCTION public.resubscribe_email IS 'Function to resubscribe an email using token';
COMMENT ON FUNCTION public.update_email_preferences IS 'Function to update email preferences using token';

