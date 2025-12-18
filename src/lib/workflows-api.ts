/**
 * Workflows API
 * Handles automated workflow management and execution
 */

import { supabase } from './supabase'

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

export const workflowsAPI = {
  /**
   * Get all workflows
   */
  async getAll(): Promise<Workflow[]> {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []) as Workflow[]
  },

  /**
   * Get a single workflow by ID
   */
  async getById(id: string): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as Workflow
  },

  /**
   * Create a new workflow
   */
  async create(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow> {
    const { data: { user } } = await supabase.auth.getUser()
    
    const workflowData: Partial<Workflow> = {
      ...workflow,
      created_by_user_id: user?.id || null,
      execution_count: 0,
      success_count: 0,
      failure_count: 0,
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as Workflow
  },

  /**
   * Update a workflow
   */
  async update(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const { data, error } = await supabase
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as Workflow
  },

  /**
   * Delete a workflow
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Toggle workflow active status
   */
  async toggleActive(id: string): Promise<Workflow> {
    const workflow = await this.getById(id)
    if (!workflow) throw new Error('Workflow not found')

    return await this.update(id, { is_active: !workflow.is_active })
  },

  /**
   * Get workflow runs
   */
  async getRuns(workflowId?: string, limit: number = 50): Promise<WorkflowRun[]> {
    let query = supabase
      .from('workflow_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as WorkflowRun[]
  },

  /**
   * Get workflow run by ID
   */
  async getRunById(id: string): Promise<WorkflowRun | null> {
    const { data, error } = await supabase
      .from('workflow_runs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as WorkflowRun
  },

  /**
   * Get active workflows for a trigger type
   */
  async getActiveForTrigger(triggerType: WorkflowTriggerType): Promise<Workflow[]> {
    const { data, error } = await supabase.rpc('get_active_workflows_for_trigger', {
      p_trigger_type: triggerType
    })

    if (error) throw new Error(error.message)
    return (data || []) as Workflow[]
  },

  /**
   * Get workflow statistics
   */
  async getStats(): Promise<{
    total: number
    active: number
    inactive: number
    total_executions: number
    total_success: number
    total_failures: number
    success_rate: number
  }> {
    const [all, active, inactive] = await Promise.all([
      supabase.from('workflows').select('id', { count: 'exact', head: true }),
      supabase.from('workflows').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('workflows').select('id', { count: 'exact', head: true }).eq('is_active', false),
    ])

    // Get execution stats
    const { data: workflows } = await supabase
      .from('workflows')
      .select('execution_count, success_count, failure_count')

    const totalExecutions = workflows?.reduce((sum, w) => sum + (w.execution_count || 0), 0) || 0
    const totalSuccess = workflows?.reduce((sum, w) => sum + (w.success_count || 0), 0) || 0
    const totalFailures = workflows?.reduce((sum, w) => sum + (w.failure_count || 0), 0) || 0
    const successRate = totalExecutions > 0 ? (totalSuccess / totalExecutions) * 100 : 0

    return {
      total: all.count || 0,
      active: active.count || 0,
      inactive: inactive.count || 0,
      total_executions: totalExecutions,
      total_success: totalSuccess,
      total_failures: totalFailures,
      success_rate: Math.round(successRate * 100) / 100,
    }
  },
}



