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



