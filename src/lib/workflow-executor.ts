/**
 * Workflow Executor
 * Executes workflows when triggered by events
 */

import { workflowsAPI, Workflow, WorkflowAction } from './workflows-api'
import { db } from './api-client'
import { sendEmail } from './email-service'
import { sendApplicationStatusEmail } from './email-notifications'

export interface WorkflowEvent {
  triggerType: string
  eventId: string
  data: Record<string, any>
}

/**
 * Execute workflows for a given trigger type
 */
export async function executeWorkflowsForTrigger(
  triggerType: string,
  eventData: Record<string, any>
): Promise<void> {
  try {
    // Get active workflows for this trigger type
    const workflows = await workflowsAPI.getActiveForTrigger(triggerType as any)

    if (workflows.length === 0) {
      return // No workflows to execute
    }

    // Execute each workflow
    for (const workflow of workflows) {
      // Check if trigger conditions are met
      if (!checkTriggerConditions(workflow.trigger_conditions || {}, eventData)) {
        continue // Skip this workflow if conditions not met
      }

      // Execute workflow
      await executeWorkflow(workflow, {
        triggerType,
        eventId: eventData.id || eventData.application_id || eventData.quotation_id || 'unknown',
        data: eventData,
      })
    }
  } catch (error) {
    console.error('Error executing workflows:', error)
    // Don't throw - workflow failures shouldn't break the main flow
  }
}

/**
 * Check if trigger conditions are met
 */
function checkTriggerConditions(
  conditions: Record<string, any>,
  eventData: Record<string, any>
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true // No conditions = always trigger
  }

  // Check each condition
  for (const [key, value] of Object.entries(conditions)) {
    const eventValue = eventData[key]
    
    // Support different comparison operators
    if (typeof value === 'object' && value !== null) {
      // Object with operator (e.g., { operator: 'equals', value: 'approved' })
      const operator = value.operator || 'equals'
      const conditionValue = value.value

      switch (operator) {
        case 'equals':
          if (eventValue !== conditionValue) return false
          break
        case 'not_equals':
          if (eventValue === conditionValue) return false
          break
        case 'in':
          if (!Array.isArray(conditionValue) || !conditionValue.includes(eventValue)) return false
          break
        case 'not_in':
          if (Array.isArray(conditionValue) && conditionValue.includes(eventValue)) return false
          break
        case 'greater_than':
          if (Number(eventValue) <= Number(conditionValue)) return false
          break
        case 'less_than':
          if (Number(eventValue) >= Number(conditionValue)) return false
          break
        default:
          if (eventValue !== conditionValue) return false
      }
    } else {
      // Simple equality check
      if (eventValue !== value) return false
    }
  }

  return true
}

/**
 * Execute a single workflow
 */
async function executeWorkflow(
  workflow: Workflow,
  event: WorkflowEvent
): Promise<void> {
  // Log workflow run
  const runId = await logWorkflowRun(workflow.id!, event)

  try {
    const actions = workflow.actions || []
    const executionOrder = workflow.execution_order || 'sequential'
    const stopOnError = workflow.stop_on_error || false

    let actionsExecuted = 0
    let actionsSucceeded = 0
    let actionsFailed = 0
    const executionLog: any[] = []

    if (executionOrder === 'parallel') {
      // Execute all actions in parallel
      const results = await Promise.allSettled(
        actions.map(action => executeAction(action, event.data))
      )

      results.forEach((result, index) => {
        actionsExecuted++
        if (result.status === 'fulfilled') {
          actionsSucceeded++
          executionLog.push({
            action: actions[index],
            status: 'success',
            result: result.value,
          })
        } else {
          actionsFailed++
          executionLog.push({
            action: actions[index],
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
          })
        }
      })
    } else {
      // Execute actions sequentially
      for (const action of actions) {
        if (!action.enabled) continue

        try {
          const result = await executeAction(action, event.data)
          actionsExecuted++
          actionsSucceeded++
          executionLog.push({
            action,
            status: 'success',
            result,
          })

          // Stop on error if configured
          if (stopOnError && result === false) {
            break
          }
        } catch (error: any) {
          actionsExecuted++
          actionsFailed++
          executionLog.push({
            action,
            status: 'failed',
            error: error.message || 'Unknown error',
          })

          // Stop on error if configured
          if (stopOnError) {
            break
          }
        }
      }
    }

    // Update workflow run
    await updateWorkflowRun(runId, {
      status: actionsFailed === 0 ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      actions_executed: actionsExecuted,
      actions_succeeded: actionsSucceeded,
      actions_failed: actionsFailed,
      execution_log: executionLog,
    })

    // Update workflow statistics
    await updateWorkflowStats(workflow.id!, actionsFailed === 0)
  } catch (error: any) {
    // Update workflow run with error
    await updateWorkflowRun(runId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error.message || 'Unknown error',
    })

    await updateWorkflowStats(workflow.id!, false)
  }
}

/**
 * Execute a single action
 */
async function executeAction(
  action: WorkflowAction,
  eventData: Record<string, any>
): Promise<any> {
  switch (action.type) {
    case 'send_email':
      return await executeSendEmailAction(action.config, eventData)

    case 'update_record':
      return await executeUpdateRecordAction(action.config, eventData)

    case 'create_task':
      return await executeCreateTaskAction(action.config, eventData)

    case 'notify_admin':
      return await executeNotifyAdminAction(action.config, eventData)

    case 'assign_to_user':
      return await executeAssignToUserAction(action.config, eventData)

    case 'update_status':
      return await executeUpdateStatusAction(action.config, eventData)

    case 'delay':
      return await executeDelayAction(action.config)

    case 'conditional':
      return await executeConditionalAction(action.config, eventData)

    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

/**
 * Execute send_email action
 */
async function executeSendEmailAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  const { template, to, subject, body, variables } = config

  // Resolve variables from event data
  let resolvedTo = resolveVariables(to, eventData)
  let resolvedSubject = resolveVariables(subject, eventData)
  let resolvedBody = resolveVariables(body, eventData)

  // If template is specified, use it
  if (template) {
    // Use email template system
    const { emailTemplatesAPI } = await import('./email-templates-api')
    const templateData = await emailTemplatesAPI.getById(template)
    
    if (templateData) {
      // Resolve template variables
      const templateVars: Record<string, any> = {}
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          templateVars[key] = resolveVariables(value as string, eventData)
        }
      }

      const rendered = emailTemplatesAPI.render(templateData, templateVars)
      resolvedSubject = rendered.subject || resolvedSubject
      resolvedBody = rendered.html || resolvedBody
    }
  }

  return await sendEmail({
    to: resolvedTo,
    subject: resolvedSubject,
    html: resolvedBody,
    emailType: 'automated',
    emailCategory: 'workflow',
    metadata: { workflow_action: 'send_email', event_data: eventData },
  })
}

/**
 * Execute update_record action
 */
async function executeUpdateRecordAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  const { table, record_id, updates, record_id_field } = config

  const resolvedRecordId = resolveVariables(record_id || record_id_field, eventData)
  const resolvedUpdates: Record<string, any> = {}

  for (const [key, value] of Object.entries(updates || {})) {
    resolvedUpdates[key] = resolveVariables(value as any, eventData)
  }

  const { error } = await db
    .from(table)
    .update(resolvedUpdates)
    .eq('id', resolvedRecordId)

  if (error) throw new Error(error.message)
  return true
}

/**
 * Execute create_task action
 */
async function executeCreateTaskAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  // This would create a task in a tasks table
  // For now, we'll create a notification instead
  const { title, description, assigned_to, priority } = config

  const { notificationsAPI } = await import('./api-service')
  
  await notificationsAPI.create(
    resolveVariables(assigned_to, eventData),
    resolveVariables(title, eventData),
    resolveVariables(description, eventData),
    'general'
  )

  return true
}

/**
 * Execute notify_admin action
 */
async function executeNotifyAdminAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  const { message, title } = config

  // Get all admins
  const { data: admins } = await db
    .from('users')
    .select('id')
    .eq('role', 'admin')

  if (!admins) return true

  const { notificationsAPI } = await import('./api-service')
  const resolvedTitle = resolveVariables(title || 'Workflow Notification', eventData)
  const resolvedMessage = resolveVariables(message, eventData)

  // Notify all admins
  for (const admin of admins) {
    await notificationsAPI.create(
      admin.id,
      resolvedTitle,
      resolvedMessage,
      'general'
    )
  }

  return true
}

/**
 * Execute assign_to_user action
 */
async function executeAssignToUserAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  const { table, record_id, user_id, user_id_field } = config

  const resolvedRecordId = resolveVariables(record_id, eventData)
  const resolvedUserId = resolveVariables(user_id || user_id_field, eventData)

  const { error } = await db
    .from(table)
    .update({ assigned_to: resolvedUserId })
    .eq('id', resolvedRecordId)

  if (error) throw new Error(error.message)
  return true
}

/**
 * Execute update_status action
 */
async function executeUpdateStatusAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  const { table, record_id, status } = config

  const resolvedRecordId = resolveVariables(record_id, eventData)
  const resolvedStatus = resolveVariables(status, eventData)

  const { error } = await db
    .from(table)
    .update({ status: resolvedStatus })
    .eq('id', resolvedRecordId)

  if (error) throw new Error(error.message)
  return true
}

/**
 * Execute delay action
 */
async function executeDelayAction(config: Record<string, any>): Promise<boolean> {
  const { duration_ms, duration_seconds } = config
  const delay = duration_ms || (duration_seconds * 1000) || 1000

  await new Promise(resolve => setTimeout(resolve, delay))
  return true
}

/**
 * Execute conditional action
 */
async function executeConditionalAction(
  config: Record<string, any>,
  eventData: Record<string, any>
): Promise<boolean> {
  const { condition, if_true, if_false } = config

  // Evaluate condition
  const conditionMet = evaluateCondition(condition, eventData)

  if (conditionMet && if_true) {
    return await executeAction(if_true, eventData)
  } else if (!conditionMet && if_false) {
    return await executeAction(if_false, eventData)
  }

  return true
}

/**
 * Resolve variables in strings (e.g., "Hello {{userName}}" -> "Hello John")
 */
function resolveVariables(
  value: any,
  eventData: Record<string, any>
): any {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return eventData[key] || match
    })
  }
  if (typeof value === 'object' && value !== null) {
    const resolved: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveVariables(v, eventData)
    }
    return resolved
  }
  return value
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  condition: any,
  eventData: Record<string, any>
): boolean {
  if (typeof condition === 'boolean') return condition
  if (typeof condition === 'object' && condition !== null) {
    const { field, operator, value } = condition
    const fieldValue = eventData[field]

    switch (operator) {
      case 'equals':
        return fieldValue === value
      case 'not_equals':
        return fieldValue !== value
      case 'greater_than':
        return Number(fieldValue) > Number(value)
      case 'less_than':
        return Number(fieldValue) < Number(value)
      case 'contains':
        return String(fieldValue).includes(String(value))
      default:
        return false
    }
  }
  return false
}

/**
 * Log workflow run
 */
async function logWorkflowRun(
  workflowId: string,
  event: WorkflowEvent
): Promise<string> {
  const { data, error } = await db.rpc('log_workflow_run', {
    p_workflow_id: workflowId,
    p_trigger_type: event.triggerType,
    p_trigger_event_id: event.eventId,
    p_trigger_data: event.data,
  })

  if (error) throw new Error(error.message)
  return data as string
}

/**
 * Update workflow run
 */
async function updateWorkflowRun(
  runId: string,
  updates: Partial<{
    status: string
    completed_at: string
    error_message: string
    actions_executed: number
    actions_succeeded: number
    actions_failed: number
    execution_log: any[]
  }>
): Promise<void> {
  const { error } = await db
    .from('workflow_runs')
    .update(updates)
    .eq('id', runId)

  if (error) throw new Error(error.message)
}

/**
 * Update workflow statistics
 */
async function updateWorkflowStats(
  workflowId: string,
  success: boolean
): Promise<void> {
  const { error } = await db.rpc('update_workflow_stats', {
    p_workflow_id: workflowId,
    p_success: success,
  })

  if (error) {
    console.error('Error updating workflow stats:', error)
    // Don't throw - stats update failure shouldn't break workflow
  }
}



