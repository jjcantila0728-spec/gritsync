-- A/B Testing System for Email Campaigns
-- Allows testing different email variants to optimize performance

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.email_ab_test_results CASCADE;
DROP TABLE IF EXISTS public.email_ab_test_recipients CASCADE;
DROP TABLE IF EXISTS public.email_ab_tests CASCADE;

-- Create A/B tests table
CREATE TABLE public.email_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('subject', 'content', 'sender', 'send_time')),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of variant configurations
  sample_size INTEGER DEFAULT 100, -- Number of recipients per variant
  sample_percentage DECIMAL(5,2) DEFAULT 10.00, -- % of total recipients for test
  winner_criteria VARCHAR(50) DEFAULT 'open_rate' CHECK (winner_criteria IN ('open_rate', 'click_rate', 'conversion_rate', 'engagement_score')),
  winner_variant VARCHAR(50),
  test_duration_hours INTEGER DEFAULT 24, -- How long to run test before declaring winner
  auto_send_winner BOOLEAN DEFAULT true, -- Automatically send winner to remaining recipients
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'analyzing', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  winner_selected_at TIMESTAMPTZ,
  confidence_level DECIMAL(5,2), -- Statistical confidence (e.g., 95.00)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create A/B test results table (per variant)
CREATE TABLE public.email_ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID REFERENCES public.email_ab_tests(id) ON DELETE CASCADE,
  variant_name VARCHAR(50) NOT NULL,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  engagement_score DECIMAL(5,2) DEFAULT 0, -- Composite score
  avg_time_to_open INTEGER, -- Seconds
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ab_test_id, variant_name)
);

-- Create A/B test recipients table (tracks which variant each recipient received)
CREATE TABLE public.email_ab_test_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID REFERENCES public.email_ab_tests(id) ON DELETE CASCADE,
  variant_name VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_user_id UUID,
  email_log_id UUID, -- References email_logs if using that system
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_ab_tests_campaign ON public.email_ab_tests(campaign_id);
CREATE INDEX idx_ab_tests_status ON public.email_ab_tests(status);
CREATE INDEX idx_ab_tests_started ON public.email_ab_tests(started_at DESC);
CREATE INDEX idx_ab_test_results_test ON public.email_ab_test_results(ab_test_id);
CREATE INDEX idx_ab_test_recipients_test ON public.email_ab_test_recipients(ab_test_id);
CREATE INDEX idx_ab_test_recipients_email ON public.email_ab_test_recipients(recipient_email);
CREATE INDEX idx_ab_test_recipients_variant ON public.email_ab_test_recipients(ab_test_id, variant_name);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.update_ab_tests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ab_tests_updated_at
  BEFORE UPDATE ON public.email_ab_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ab_tests_updated_at();

CREATE TRIGGER ab_test_results_updated_at
  BEFORE UPDATE ON public.email_ab_test_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ab_tests_updated_at();

-- Function to calculate variant metrics
CREATE OR REPLACE FUNCTION public.calculate_ab_test_metrics(test_id UUID)
RETURNS void AS $$
DECLARE
  variant_record RECORD;
BEGIN
  -- Calculate metrics for each variant
  FOR variant_record IN 
    SELECT DISTINCT variant_name 
    FROM public.email_ab_test_recipients 
    WHERE ab_test_id = test_id
  LOOP
    INSERT INTO public.email_ab_test_results (
      ab_test_id,
      variant_name,
      sent_count,
      opened_count,
      clicked_count,
      open_rate,
      click_rate,
      engagement_score
    )
    SELECT
      test_id,
      variant_record.variant_name,
      COUNT(*) as sent_count,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened_count,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked_count,
      ROUND((COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as open_rate,
      ROUND((COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as click_rate,
      -- Engagement score: weighted combination of metrics
      ROUND(
        (COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0) * 40) +
        (COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0) * 60),
        2
      ) as engagement_score
    FROM public.email_ab_test_recipients
    WHERE ab_test_id = test_id 
      AND variant_name = variant_record.variant_name
    ON CONFLICT (ab_test_id, variant_name) 
    DO UPDATE SET
      sent_count = EXCLUDED.sent_count,
      opened_count = EXCLUDED.opened_count,
      clicked_count = EXCLUDED.clicked_count,
      open_rate = EXCLUDED.open_rate,
      click_rate = EXCLUDED.click_rate,
      engagement_score = EXCLUDED.engagement_score,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to determine A/B test winner
CREATE OR REPLACE FUNCTION public.determine_ab_test_winner(test_id UUID)
RETURNS JSONB AS $$
DECLARE
  test_record RECORD;
  winner_record RECORD;
  result JSONB;
BEGIN
  -- Get test details
  SELECT * INTO test_record FROM public.email_ab_tests WHERE id = test_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Test not found');
  END IF;
  
  -- Calculate latest metrics
  PERFORM public.calculate_ab_test_metrics(test_id);
  
  -- Determine winner based on criteria
  CASE test_record.winner_criteria
    WHEN 'open_rate' THEN
      SELECT * INTO winner_record 
      FROM public.email_ab_test_results 
      WHERE ab_test_id = test_id 
      ORDER BY open_rate DESC, sent_count DESC 
      LIMIT 1;
      
    WHEN 'click_rate' THEN
      SELECT * INTO winner_record 
      FROM public.email_ab_test_results 
      WHERE ab_test_id = test_id 
      ORDER BY click_rate DESC, sent_count DESC 
      LIMIT 1;
      
    WHEN 'conversion_rate' THEN
      SELECT * INTO winner_record 
      FROM public.email_ab_test_results 
      WHERE ab_test_id = test_id 
      ORDER BY conversion_rate DESC, sent_count DESC 
      LIMIT 1;
      
    WHEN 'engagement_score' THEN
      SELECT * INTO winner_record 
      FROM public.email_ab_test_results 
      WHERE ab_test_id = test_id 
      ORDER BY engagement_score DESC, sent_count DESC 
      LIMIT 1;
      
    ELSE
      SELECT * INTO winner_record 
      FROM public.email_ab_test_results 
      WHERE ab_test_id = test_id 
      ORDER BY engagement_score DESC 
      LIMIT 1;
  END CASE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No results found');
  END IF;
  
  -- Update test with winner
  UPDATE public.email_ab_tests
  SET 
    winner_variant = winner_record.variant_name,
    winner_selected_at = now(),
    status = 'completed',
    updated_at = now()
  WHERE id = test_id;
  
  result := jsonb_build_object(
    'success', true,
    'winner_variant', winner_record.variant_name,
    'open_rate', winner_record.open_rate,
    'click_rate', winner_record.click_rate,
    'engagement_score', winner_record.engagement_score
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.email_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_ab_test_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only)
CREATE POLICY "Admins have full access to A/B tests"
  ON public.email_ab_tests
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
  );

CREATE POLICY "Admins have full access to A/B test results"
  ON public.email_ab_test_results
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
  );

CREATE POLICY "Admins have full access to A/B test recipients"
  ON public.email_ab_test_recipients
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
  );

-- Grant permissions
GRANT ALL ON public.email_ab_tests TO authenticated;
GRANT ALL ON public.email_ab_test_results TO authenticated;
GRANT ALL ON public.email_ab_test_recipients TO authenticated;

-- Insert sample A/B test for testing (optional)
INSERT INTO public.email_ab_tests (
  name,
  description,
  test_type,
  variants,
  sample_size,
  winner_criteria,
  status
) VALUES (
  'Welcome Email Subject Line Test',
  'Testing different subject lines for welcome emails',
  'subject',
  '[
    {"name": "A", "subject": "Welcome to GritSync!"},
    {"name": "B", "subject": "Your NCLEX Journey Starts Here"},
    {"name": "C", "subject": "Ready to Pass NCLEX? Let''s Go!"}
  ]'::jsonb,
  50,
  'open_rate',
  'draft'
) ON CONFLICT DO NOTHING;

-- Create view for A/B test statistics
CREATE OR REPLACE VIEW public.ab_test_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'running') AS running_count,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(*) AS total_count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) FILTER (WHERE completed_at IS NOT NULL) AS avg_test_duration_hours,
  COUNT(*) FILTER (WHERE winner_variant IS NOT NULL) AS tests_with_winners
FROM public.email_ab_tests;

GRANT SELECT ON public.ab_test_stats TO authenticated;

COMMENT ON TABLE public.email_ab_tests IS 'A/B tests for email campaigns';
COMMENT ON TABLE public.email_ab_test_results IS 'Results and metrics for each A/B test variant';
COMMENT ON TABLE public.email_ab_test_recipients IS 'Tracks which recipients received which variant';
COMMENT ON FUNCTION public.calculate_ab_test_metrics IS 'Calculates performance metrics for all variants in a test';
COMMENT ON FUNCTION public.determine_ab_test_winner IS 'Determines winning variant based on configured criteria';

