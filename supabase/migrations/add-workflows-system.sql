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
CREATE POLICY "Admins can view all workflows"
  ON workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert workflows"
  ON workflows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update workflows"
  ON workflows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

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
CREATE POLICY "Admins can view all workflow runs"
  ON workflow_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Service role can insert workflow runs"
  ON workflow_runs FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY "Service role can update workflow runs"
  ON workflow_runs FOR UPDATE
  USING (true); -- Service role bypasses RLS

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



