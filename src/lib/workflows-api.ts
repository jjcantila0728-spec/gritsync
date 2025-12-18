/**
 * Workflows API
 * Handles automated workflow management and execution
 * NOTE: This feature is currently stubbed pending full migration
 */

export type WorkflowTriggerType = 
  | 'application_status_change'
  | 'application_created'
  | 'payment_received'
  | 'document_uploaded'
  | 'document_status_change'
  | 'quotation_created'
  | 'quotation_status_change'
  | 'user_registered'
  | 'timeline_step_completed'
  | 'custom_event'

export type WorkflowActionType =
  | 'send_email'
  | 'update_record'
  | 'create_task'
  | 'notify_admin'
  | 'assign_to_user'
  | 'update_status'
  | 'send_sms'
  | 'call_webhook'
  | 'delay'
  | 'conditional'

export interface WorkflowAction {
  id: string
  type: WorkflowActionType
  config: Record<string, any>
  order: number
  enabled: boolean
}

export interface Workflow {
  id?: string
  name: string
  description?: string
  is_active: boolean
  trigger_type: WorkflowTriggerType
  trigger_conditions?: Record<string, any>
  actions: WorkflowAction[]
  execution_order?: 'sequential' | 'parallel'
  stop_on_error?: boolean
  auto_assign_enabled?: boolean
  assignment_rules?: Record<string, any>
  created_by_user_id?: string
  created_at?: string
  updated_at?: string
  last_executed_at?: string
  execution_count?: number
  success_count?: number
  failure_count?: number
}

export interface WorkflowRun {
  id?: string
  workflow_id: string
  trigger_type: string
  trigger_event_id?: string
  trigger_data?: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at?: string
  completed_at?: string
  error_message?: string
  actions_executed?: number
  actions_succeeded?: number
  actions_failed?: number
  execution_log?: any[]
  created_at?: string
}

export interface WorkflowTrigger {
  id?: string
  workflow_id: string
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  schedule_config: Record<string, any>
  timezone?: string
  is_active: boolean
  last_triggered_at?: string
  next_trigger_at?: string
  created_at?: string
  updated_at?: string
}

// Stubbed API - feature pending migration
export const workflowsAPI = {
  getAll: async (): Promise<Workflow[]> => [],
  getActive: async (): Promise<Workflow[]> => [],
  getActiveForTrigger: async (_triggerType: WorkflowTriggerType): Promise<Workflow[]> => [],
  getById: async (_id: string): Promise<Workflow | null> => null,
  getByTriggerType: async (_triggerType: WorkflowTriggerType): Promise<Workflow[]> => [],
  create: async (_data: Partial<Workflow>): Promise<Workflow | null> => null,
  update: async (_id: string, _data: Partial<Workflow>): Promise<Workflow | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  activate: async (_id: string): Promise<boolean> => false,
  deactivate: async (_id: string): Promise<boolean> => false,
  execute: async (_id: string, _eventData?: Record<string, any>): Promise<WorkflowRun | null> => null,
  getRuns: async (_workflowId?: string): Promise<WorkflowRun[]> => [],
  getRunById: async (_runId: string): Promise<WorkflowRun | null> => null,
}
