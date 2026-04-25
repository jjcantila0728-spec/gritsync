import { supabase } from './api-client'
import type { Database } from './database.types'
import { imageUrlCache } from './image-cache'
import { 
  handleSupabaseError, 
  normalizeError, 
  retryWithBackoff,
  isRetryableError,
  AppError,
  ErrorType,
  ErrorSeverity,
  logError
} from './error-handler'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Removed unused QueryResult type

// Lightweight auth cache to reduce repeated auth.getUser calls
let cachedUserId: string | null = null
let cachedUserFetchedAt = 0
let cachedIsAdmin: boolean | null = null
let cachedAdminFetchedAt = 0
const USER_CACHE_TTL_MS = 60 * 1000 // 1 minute cache

/**
 * Enhanced Supabase query wrapper with error handling, retry logic, and session validation
 * Automatically refreshes sessions on auth errors and retries the query
 */
async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  context?: Record<string, any>,
  retry: boolean = true,
  requireAuth: boolean = true
): Promise<T> {
  // Ensure valid session before executing query (if auth is required)
  if (requireAuth) {
    try {
      const { ensureValidSession } = await import('./session-utils')
      await ensureValidSession()
    } catch (sessionError) {
      // If session validation fails, log but don't fail yet - let the query fail naturally
      console.warn('Session validation warning:', sessionError)
    }
  }

  const execute = async (attempt: number = 1): Promise<T> => {
    const startTime = performance.now()
    const { data, error } = await queryFn()
    const duration = performance.now() - startTime

    // Track query performance (async import to avoid circular dependencies)
    try {
      const { trackQueryPerformance } = await import('./query-performance')
      const { trackSuccessfulQuery, trackFailedQuery } = await import('./connection-monitor')
      
      if (error) {
        trackQueryPerformance(
          context?.operation || 'unknown',
          duration,
          false,
          error.message,
          context
        )
        trackFailedQuery()
      } else {
        trackQueryPerformance(
          context?.operation || 'unknown',
          duration,
          true,
          undefined,
          context
        )
        trackSuccessfulQuery()
      }
    } catch (importError) {
      // Silently fail if performance tracking is unavailable
      console.warn('Failed to track query performance:', importError)
    }

    if (error) {
      // Check if this is an auth error that we can recover from
      const isAuthError = error?.code === 'PGRST301' || 
                         error?.message?.includes('JWT') ||
                         error?.message?.includes('token') ||
                         error?.message?.includes('session') ||
                         error?.status === 401

      // If auth error on first attempt and we require auth, try refreshing session and retry once
      if (isAuthError && requireAuth && attempt === 1) {
        try {
          const { forceRefreshSession } = await import('./session-utils')
          const refreshedSession = await forceRefreshSession()
          
          if (refreshedSession) {
            console.log('Session refreshed, retrying query...')
            // Retry the query once after refreshing session
            return await execute(attempt + 1)
          }
        } catch (refreshError) {
          console.error('Failed to refresh session:', refreshError)
        }
      }

      const normalizedError = normalizeError(error, context)
      throw normalizedError
    }
    
    if (data === null) {
      throw normalizeError(new Error('No data returned'), context)
    }
    
    return data
  }

  if (retry) {
    try {
      return await execute()
    } catch (error: any) {
      if (isRetryableError(error)) {
        return await retryWithBackoff(() => execute(), 3, 1000, error)
      }
      throw error
    }
  }

  return await execute()
}

// Helper to get current user ID
// Combined function to get both userId and admin status in one call
async function getCurrentUserInfo(): Promise<{ userId: string; isAdmin: boolean }> {
  try {
    const now = Date.now()
    // Return cached values if available and fresh
    if (cachedUserId && cachedIsAdmin !== null && now - cachedUserFetchedAt < USER_CACHE_TTL_MS) {
      return { userId: cachedUserId, isAdmin: cachedIsAdmin }
    }

    // Fetch user once
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      throw normalizeError(error, { operation: 'getCurrentUserInfo' })
    }
    if (!user) {
      throw normalizeError(new Error('Not authenticated'), { operation: 'getCurrentUserInfo' })
    }
    
    // Cache both values
    cachedUserId = user.id
    const role = user.user_metadata?.role
    cachedIsAdmin = role === 'admin'
    cachedUserFetchedAt = now
    cachedAdminFetchedAt = now
    
    return { userId: user.id, isAdmin: cachedIsAdmin }
  } catch (error: any) {
    cachedUserId = null
    cachedIsAdmin = null
    if (error instanceof AppError) {
      throw error
    }
    throw normalizeError(error, { operation: 'getCurrentUserInfo' })
  }
}

export async function getCurrentUserId(): Promise<string> {
  const { userId } = await getCurrentUserInfo()
  return userId
}

// Helper to check if user is admin
// Uses cached value to avoid repeated auth.getUser calls
async function isAdmin(): Promise<boolean> {
  try {
    const now = Date.now()
    // Return cached value if available and fresh
    if (cachedIsAdmin !== null && now - cachedAdminFetchedAt < USER_CACHE_TTL_MS) {
      return cachedIsAdmin
    }

    // Use combined function to get both (will cache both)
    const { isAdmin: adminStatus } = await getCurrentUserInfo()
    return adminStatus
  } catch (error) {
    cachedIsAdmin = false
    return false
  }
}

// Function to clear auth cache (useful on logout or role changes)
export function clearAuthCache(): void {
  cachedUserId = null
  cachedIsAdmin = null
  cachedUserFetchedAt = 0
  cachedAdminFetchedAt = 0
}

function resolveServiceType(app: { service_type?: string; application_type?: string }) {
  if (app.service_type) {
    return app.service_type
  }
  return 'NCLEX Processing'
}

function resolveServiceState(app: { service_state?: string; application_type?: string }) {
  if (app.service_state) {
    return app.service_state
  }
  return 'New York'
}

// Applications API
export const applicationsAPI = {
  getAll: async () => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    const query = supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!admin) {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    if (error) {
      throw normalizeError(error, { operation: 'applicationsAPI.getAll' })
    }
    const applications = data || []

    const applicationIds = applications
      .map((app: any) => app.id)
      .filter((id: any) => typeof id === 'string' || typeof id === 'number')

    // Batch-load timelines and payments to avoid per-application queries
    const [
      { data: timelineSteps, error: timelineError },
      { data: paymentsData, error: paymentsError }
    ] = applicationIds.length > 0
      ? await Promise.all([
          supabase
            .from('application_timeline_steps')
            .select('*')
            .in('application_id', applicationIds)
            .order('created_at', { ascending: true }),
          supabase
            .from('application_payments')
            .select('*')
            .in('application_id', applicationIds)
        ])
      : [{ data: [], error: null }, { data: [], error: null }]

    // Log errors gracefully without breaking the flow
    if (timelineError) {
      logError(normalizeError(timelineError, { operation: 'applicationsAPI.getAll', context: 'timeline' }), { operation: 'applicationsAPI.getAll', context: 'timeline' })
    }
    if (paymentsError) {
      logError(normalizeError(paymentsError, { operation: 'applicationsAPI.getAll', context: 'payments' }), { operation: 'applicationsAPI.getAll', context: 'payments' })
    }

    const stepsByApp = new Map<string, any[]>()
    const paymentsByApp = new Map<string, any[]>()

    ;(timelineSteps || []).forEach((step: any) => {
      if (!step?.application_id) return
      const list = stepsByApp.get(step.application_id) || []
      list.push(step)
      stepsByApp.set(step.application_id, list)
    })

    ;(paymentsData || []).forEach((payment: any) => {
      if (!payment?.application_id) return
      const list = paymentsByApp.get(payment.application_id) || []
      list.push(payment)
      paymentsByApp.set(payment.application_id, list)
    })

    // Enhance each application with timeline-based current_progress and next_step
    const applicationsWithTimeline = await Promise.all(
      applications.map(async (app: any) => {
        try {
          const allSteps = stepsByApp.get(app.id) || []
          const payments = paymentsByApp.get(app.id) || []
          
          // Define step order and names (based on timeline structure)
          const stepOrder = [
            { key: 'app_submission', name: 'Application Submission' },
            { key: 'credentialing', name: 'Credentialing' },
            { key: 'bon_application', name: 'BON Application' },
            { key: 'nclex_eligibility', name: 'NCLEX Eligibility' },
            { key: 'pearson_vue', name: 'Pearson VUE Application' },
            { key: 'att', name: 'ATT' },
            { key: 'nclex_exam', name: 'NCLEX Exam' }
          ]
          
          // Define next step instructions
          const nextStepInstructions: { [key: string]: string } = {
            'credentialing': 'Generate your letter for school',
            'bon_application': 'Complete mandatory courses and submit Form 1',
            'nclex_eligibility': 'Wait for NCLEX eligibility approval',
            'pearson_vue': 'Create Pearson VUE account and request ATT',
            'att': 'Wait for ATT to be received',
            'nclex_exam': 'Schedule and take your NCLEX exam'
          }
          
          // Create a map of step statuses
          const stepStatusMap: { [key: string]: any } = {}
          allSteps.forEach((step: any) => {
            stepStatusMap[step.step_key] = step
          })
          
          // Helper function to check if a step is actually completed based on sub-steps
          const isStepCompleted = (stepKey: string): boolean => {
            const stepData = stepStatusMap[stepKey]
            
            // Check sub-steps first (regardless of parent step status)
            switch (stepKey) {
              case 'app_submission': {
                const appCreated = stepStatusMap['app_created']
                const docsSubmitted = stepStatusMap['documents_submitted']
                const appPaid = stepStatusMap['app_paid'] || (payments && payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step1'))
                const allSubStepsDone = (appCreated && appCreated.status === 'completed') &&
                                       (docsSubmitted && docsSubmitted.status === 'completed') &&
                                       (appPaid && (appPaid.status === 'completed' || (typeof appPaid === 'object' && appPaid.status === 'paid')))
                // Return true if all sub-steps are done OR if parent is explicitly marked completed
                return allSubStepsDone || (stepData && stepData.status === 'completed')
              }
              case 'credentialing': {
                const letterGenerated = stepStatusMap['letter_generated']
                const letterSubmitted = stepStatusMap['letter_submitted']
                const officialDocs = stepStatusMap['official_docs_submitted']
                const allSubStepsDone = (letterGenerated && letterGenerated.status === 'completed') &&
                                       (letterSubmitted && letterSubmitted.status === 'completed') &&
                                       (officialDocs && officialDocs.status === 'completed')
                return allSubStepsDone || (stepData && stepData.status === 'completed')
              }
              case 'bon_application': {
                const mandatoryCourses = stepStatusMap['mandatory_courses']
                const form1Submitted = stepStatusMap['form1_submitted']
                const appStep2Paid = stepStatusMap['app_step2_paid'] || (payments && payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step2'))
                const allSubStepsDone = (mandatoryCourses && mandatoryCourses.status === 'completed') &&
                                       (form1Submitted && form1Submitted.status === 'completed') &&
                                       (appStep2Paid && (appStep2Paid.status === 'completed' || (typeof appStep2Paid === 'object' && appStep2Paid.status === 'paid')))
                return allSubStepsDone || (stepData && stepData.status === 'completed')
              }
              case 'nclex_eligibility': {
                const eligibilityApproved = stepStatusMap['nclex_eligibility_approved']
                const subStepDone = (eligibilityApproved && eligibilityApproved.status === 'completed')
                return subStepDone || (stepData && stepData.status === 'completed')
              }
              case 'pearson_vue': {
                const accountCreated = stepStatusMap['pearson_account_created']
                const attRequested = stepStatusMap['att_requested']
                const allSubStepsDone = (accountCreated && accountCreated.status === 'completed') &&
                                       (attRequested && attRequested.status === 'completed')
                return allSubStepsDone || (stepData && stepData.status === 'completed')
              }
              case 'att': {
                const attReceived = stepStatusMap['att_received']
                if (!attReceived || !attReceived.data) {
                  return (stepData && stepData.status === 'completed')
                }
                const data = typeof attReceived.data === 'string' ? JSON.parse(attReceived.data) : attReceived.data
                const hasCodeAndExpiry = !!(data.code || data.att_code) && !!(data.expiry_date || data.att_expiry_date)
                return hasCodeAndExpiry || (stepData && stepData.status === 'completed')
              }
              case 'nclex_exam': {
                const examBooked = stepStatusMap['exam_date_booked']
                if (!examBooked || !examBooked.data) {
                  return (stepData && stepData.status === 'completed')
                }
                const data = typeof examBooked.data === 'string' ? JSON.parse(examBooked.data) : examBooked.data
                const hasAllDetails = !!(data.date || examBooked.date) && !!(data.exam_time || data.time) && !!(data.exam_location || data.location)
                return hasAllDetails || (stepData && stepData.status === 'completed')
              }
              case 'quick_results': {
                const quickResultsData = stepStatusMap['quick_results']
                if (!quickResultsData || !quickResultsData.data) {
                  return (stepData && stepData.status === 'completed')
                }
                const data = typeof quickResultsData.data === 'string' ? JSON.parse(quickResultsData.data) : quickResultsData.data
                const hasResult = !!(data.result)
                return hasResult || (stepData && stepData.status === 'completed')
              }
              default:
                return stepData && stepData.status === 'completed'
            }
          }
          
          // Find the current progress (last completed step in order)
          let currentProgress: string | null = null
          let currentProgressStep: { key: string; name: string } | null = null
          
          // Find the last completed step in step order (using new completion logic)
          // Start from the end and work backwards to find the most recent completed step
          for (let i = stepOrder.length - 1; i >= 0; i--) {
            const step = stepOrder[i]
            if (isStepCompleted(step.key)) {
              currentProgress = step.name
              currentProgressStep = step
              break
            }
          }
          
          // If no step is completed yet but application exists, default to Application Submission
          if (!currentProgress && app.created_at) {
            currentProgress = 'Application Submission'
            currentProgressStep = { key: 'app_submission', name: 'Application Submission' }
          }
          
          // Find the next step (first pending step after the last completed step)
          let nextStep: string | null = null
          let nextStepInstruction: string | null = null
          
          // Find the index of current progress in stepOrder
          let currentProgressIndex = -1
          if (currentProgressStep) {
            for (let i = 0; i < stepOrder.length; i++) {
              if (stepOrder[i].key === currentProgressStep.key) {
                currentProgressIndex = i
                break
              }
            }
          }
          
          // Next step is the first pending step after current progress
          if (currentProgressIndex >= 0 && currentProgressIndex < stepOrder.length - 1) {
            // Look for the next step that is pending or not yet started
            for (let i = currentProgressIndex + 1; i < stepOrder.length; i++) {
              const nextStepInfo = stepOrder[i]
              const nextStepData = stepStatusMap[nextStepInfo.key]
              
              // If step doesn't exist or is not completed (using new completion logic), this is the next step
              if (!nextStepData || !isStepCompleted(nextStepInfo.key)) {
                nextStep = nextStepInfo.name
                nextStepInstruction = nextStepInstructions[nextStepInfo.key] || null
                break
              }
            }
          } else if (currentProgressIndex === -1) {
            // No progress yet, next step is the first step
            if (stepOrder.length > 0) {
              const firstStep = stepOrder[0]
              if (!isStepCompleted(firstStep.key)) {
                nextStep = firstStep.name
                nextStepInstruction = nextStepInstructions[firstStep.key] || null
              }
            }
          }
          
          // Check if timeline is completed (all steps in stepOrder are done)
          const isTimelineCompleted = stepOrder.every(step => isStepCompleted(step.key))
          
          // Build current progress message
          let currentProgressMessage = currentProgress || 'Not started'
          let nextStepMessage: string | null = null
          
          // Check for exam result if timeline is completed or at last step
          const quickResultsStep = allSteps.find((step: any) => step.step_key === 'quick_results') as any
          const hasExamResult = quickResultsStep && 'data' in quickResultsStep && quickResultsStep.data
          
          if (hasExamResult) {
            const resultData = typeof quickResultsStep.data === 'string' ? JSON.parse(quickResultsStep.data) : quickResultsStep.data
            if (resultData.result) {
              if (resultData.result === 'pass' || resultData.result === 'Passed') {
                currentProgressMessage = 'Congratulations!, You Passed the NCLEX-RN Exam!'
                nextStepMessage = 'Wait for 1-2 weeks for your license to reflect in "Nursys"'
              } else if (resultData.result === 'failed' || resultData.result === 'Failed') {
                currentProgressMessage = 'You have failed the exam, Don\'t worry, you can take it again anytime.'
                nextStepMessage = 'Retake again!'
              } else {
                const resultText = resultData.result
                currentProgressMessage = `Exam Result: ${resultText}`
              }
            }
          } else if (isTimelineCompleted || app.status === 'completed') {
            // Timeline completed but no exam result yet
            // Keep current progress as is, but don't show next step
            nextStepMessage = null
          } else {
            // Build next step message for non-completed applications
            if (nextStep) {
              nextStepMessage = nextStep
              if (nextStepInstruction) {
                nextStepMessage += `, ${nextStepInstruction}`
              }
            }
          }
          
          // Calculate progress percentage based on main steps and sub-steps
          const allStepsWithSubSteps = [
            {
              mainKey: 'app_submission',
              mainName: 'Application Submission',
              subSteps: [
                { key: 'app_created', checkFn: () => !!app.created_at },
                { key: 'documents_submitted', checkFn: () => {
                  return !!(app.picture_path && app.diploma_path && app.passport_path)
                }},
                { key: 'app_paid', checkFn: () => {
                  return payments && payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step1')
                }}
              ]
            },
            {
              mainKey: 'credentialing',
              mainName: 'Credentialing',
              subSteps: [
                { key: 'letter_generated', checkFn: () => {
                  const step = stepStatusMap['letter_generated']
                  return step && step.status === 'completed'
                }},
                { key: 'letter_submitted', checkFn: () => {
                  const step = stepStatusMap['letter_submitted']
                  return step && step.status === 'completed'
                }},
                { key: 'official_docs_submitted', checkFn: () => {
                  const step = stepStatusMap['official_docs_submitted']
                  return step && step.status === 'completed'
                }}
              ]
            },
            {
              mainKey: 'bon_application',
              mainName: 'BON Application',
              subSteps: [
                { key: 'mandatory_courses', checkFn: () => {
                  const step = stepStatusMap['mandatory_courses']
                  return step && step.status === 'completed'
                }},
                { key: 'form1_submitted', checkFn: () => {
                  const step = stepStatusMap['form1_submitted']
                  return step && step.status === 'completed'
                }}
              ]
            },
            {
              mainKey: 'nclex_eligibility',
              mainName: 'NCLEX Eligibility',
              subSteps: [
                { key: 'nclex_eligibility_approved', checkFn: () => {
                  const step = stepStatusMap['nclex_eligibility_approved']
                  return step && step.status === 'completed'
                }}
              ]
            },
            {
              mainKey: 'pearson_vue',
              mainName: 'Pearson VUE Application',
              subSteps: [
                { key: 'pearson_account_created', checkFn: () => {
                  const step = stepStatusMap['pearson_account_created']
                  return step && step.status === 'completed'
                }},
                { key: 'att_requested', checkFn: () => {
                  const step = stepStatusMap['att_requested']
                  return step && step.status === 'completed'
                }}
              ]
            },
            {
              mainKey: 'att',
              mainName: 'ATT',
              subSteps: [
                { key: 'att_received', checkFn: () => {
                  const step = stepStatusMap['att_received']
                  return step && step.status === 'completed'
                }}
              ]
            },
            {
              mainKey: 'nclex_exam',
              mainName: 'NCLEX Exam',
              subSteps: [
                { key: 'exam_date_booked', checkFn: () => {
                  const step = stepStatusMap['exam_date_booked']
                  return step && step.status === 'completed'
                }}
              ]
            },
            {
              mainKey: 'quick_results',
              mainName: 'Quick Results',
              subSteps: []
            }
          ]
          
          // Count completed items (main steps + sub-steps)
          let totalItems = 0
          let completedItems = 0
          
          for (const mainStep of allStepsWithSubSteps) {
            // Check main step
            totalItems++
            if (isStepCompleted(mainStep.mainKey)) {
              completedItems++
            }
            
            // Check sub-steps
            for (const subStep of mainStep.subSteps) {
              totalItems++
              if (subStep.checkFn()) {
                completedItems++
              }
            }
          }
          
          // Calculate progress percentage based on main steps and sub-steps
          let progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
          
          // Override to 100% if timeline is completed (all main steps in stepOrder are done)
          // This ensures that when all required steps are completed, progress shows 100%
          // even if quick_results step is not yet completed
          if (isTimelineCompleted) {
            progressPercentage = 100
          } else if (app.status === 'completed') {
            // If status is completed, also set to 100%
            progressPercentage = 100
          } else if (hasExamResult) {
            // If there's an exam result, timeline is effectively complete
            progressPercentage = 100
          }
          
          // Ensure progress doesn't exceed 100%
          progressPercentage = Math.min(100, Math.max(0, progressPercentage))
          
          // Get GritSync account email from processing accounts
          let displayEmail = app.email
          try {
            const { data: gritsyncAccounts, error: gritsyncError } = await supabase
              .from('processing_accounts')
              .select('email')
              .eq('application_id', app.id)
              .eq('account_type', 'gritsync')
              .limit(1)
            
            if (!gritsyncError && gritsyncAccounts && gritsyncAccounts.length > 0) {
              const gritsyncAccount = gritsyncAccounts[0] as { email?: string } | null
              if (gritsyncAccount?.email) {
                displayEmail = gritsyncAccount.email
              }
            } else {
              // If no GritSync account exists, use application email
              displayEmail = app.email || ''
            }
          } catch (error) {
            // If error, fall back to application email
            displayEmail = app.email || ''
          }
          
          const serviceType = resolveServiceType(app)
          const serviceState = resolveServiceState(app)
          return {
            ...app,
            email: displayEmail, // Use generated Gmail instead of user email
            current_progress: currentProgressMessage,
            next_step: nextStepMessage,
            progress_percentage: progressPercentage,
            completed_steps: completedItems,
            total_steps: totalItems,
            service_type: serviceType,
            service_state: serviceState,
          }
        } catch (error) {
          // Try to get or generate Gmail email even in error case
          let displayEmail = app.email
          try {
            const { data: gmailAccounts } = await supabase
              .from('processing_accounts')
              .select('email')
              .eq('application_id', app.id)
              .eq('account_type', 'gritsync')
              .limit(1)
            
            if (gmailAccounts && gmailAccounts.length > 0) {
              const gmailAccount = gmailAccounts[0] as { email?: string } | null
              if (gmailAccount?.email) {
                displayEmail = gmailAccount.email
              }
            } else {
              // If no GritSync account exists, use application email
              displayEmail = app.email || ''
            }
          } catch (emailError) {
            // If error, fall back to application email
            displayEmail = app.email || ''
          }
          
          const serviceType = resolveServiceType(app)
          const serviceState = resolveServiceState(app)
          return {
            ...app,
            email: displayEmail,
            current_progress: 'Not started',
            next_step: null,
            progress_percentage: 0,
            completed_steps: 0,
            total_steps: 0,
            service_type: serviceType,
            service_state: serviceState,
          }
        }
      })
    )
    
    return applicationsWithTimeline
  },

  getServiceTypes: async () => {
    const { userId, isAdmin: admin } = await getCurrentUserInfo()

    const query = supabase
      .from('applications')
      .select('application_type')
      .order('created_at', { ascending: false })

    if (!admin) {
      query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const types = Array.from(
      new Set(
        (data || []).map((app: any) => (app.application_type || 'NCLEX'))
      )
    )

    return types
  },

  getById: async (id: string) => {
    // Try to find by grit_app_id first (if it looks like AP + 12 alphanumeric)
    // Otherwise, fall back to UUID id
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(id)
    
    // Try authenticated query first
    let query = supabase
      .from('applications')
      .select('*')
    
    if (isGritAppId) {
      query = query.eq('grit_app_id', id)
    } else {
      query = query.eq('id', id)
    }
    
    let { data, error } = await query
    
    // If authenticated query fails, try without filters to see what's available
    if (error || (Array.isArray(data) && data.length === 0)) {
      // Try case-insensitive search for grit_app_id
      if (isGritAppId) {
        const { data: allApps, error: allError } = await supabase
          .from('applications')
          .select('*')
        
        if (allError) {
          logError(normalizeError(allError, { operation: 'applicationsAPI.getById', context: 'alternative_query' }), { operation: 'applicationsAPI.getById', context: 'alternative_query' })
        }
        
        if (allApps && allApps.length > 0) {
          // Find by case-insensitive grit_app_id
          const found = allApps.find((app: any) => 
            app.grit_app_id?.toUpperCase() === id.toUpperCase()
          )
          
          if (found) {
            return found
          }
        }
      }
      
      // Last resort: try with UUID if we haven't already
      if (isGritAppId) {
        const { data: uuidData, error: uuidError } = await supabase
          .from('applications')
          .select('*')
          .ilike('grit_app_id', id)
        
        if (uuidError) {
          logError(normalizeError(uuidError, { operation: 'applicationsAPI.getById', context: 'ilike_query' }), { operation: 'applicationsAPI.getById', context: 'ilike_query' })
        }
        
        if (uuidData && uuidData.length > 0) {
          return uuidData[0]
        }
      }
    }
    
    if (error) throw new Error(error.message)
    
    // If using grit_app_id, return the first matching result
    // If using UUID id, return the single result
    if (Array.isArray(data)) {
      if (data.length === 0) {
        throw new Error(`Application not found with ID: ${id}. Please check that the application exists.`)
      }
      return data[0]
    }
    
    if (!data) {
      throw new Error(`Application not found with ID: ${id}. Please check that the application exists.`)
    }
    
    return data
  },

  create: async (applicationData: any, files?: { picture?: File; diploma?: File; passport?: File }) => {
    const userId = await getCurrentUserId()
    
    // Determine application type (default to NCLEX)
    const applicationType = applicationData.application_type || 'NCLEX'
    
    let picturePath = applicationData.picture_path || null
    let diplomaPath = applicationData.diploma_path || null
    let passportPath = applicationData.passport_path || null
    
    // Upload files to Supabase Storage if provided
    if (files) {
      // Import compression utility
      const { compressDocument } = await import('./document-compression')
      
      if (files.picture) {
        const compressedPicture = await compressDocument(files.picture, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          maxFileSizeMB: 5,
        })
        picturePath = await uploadFile(userId, compressedPicture, 'picture')
      }
      if (files.diploma) {
        const compressedDiploma = await compressDocument(files.diploma, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          maxFileSizeMB: 5,
        })
        diplomaPath = await uploadFile(userId, compressedDiploma, 'diploma')
      }
      if (files.passport) {
        const compressedPassport = await compressDocument(files.passport, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          maxFileSizeMB: 5,
        })
        passportPath = await uploadFile(userId, compressedPassport, 'passport')
      }
    }
    
    // Generate GRIT APP ID (AP + 12 alphanumeric)
    const generateGritAppId = () => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      let randomPart = ''
      for (let i = 0; i < 12; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return `AP${randomPart}`
    }
    
    // Generate GRIT APP ID and check for uniqueness (retry if needed)
    let gritAppId = generateGritAppId()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('applications')
        .select('grit_app_id')
        .eq('grit_app_id', gritAppId)
        .single()
      
      if (!existing) break // ID is unique
      gritAppId = generateGritAppId()
      attempts++
    }
    
    // Prepare insert data - include all fields from applicationData
    const insertData: any = {
      ...applicationData,
      grit_app_id: gritAppId,
      user_id: userId,
      application_type: applicationType,
    }
    
    // Include document paths
    insertData.picture_path = picturePath
    insertData.diploma_path = diplomaPath
    insertData.passport_path = passportPath
    
    // Create application
    const { data, error } = await supabase
      .from('applications')
      .insert(insertData)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    
    // Create initial timeline step for the application
    if (data) {
      try {
        const timelineStepsAPI = await import('./api-service').then(m => m.timelineStepsAPI)
        // NCLEX timeline: Application Submission
        await timelineStepsAPI.create(data.id, 'app_submission', 'Application Submission')
      } catch (timelineError) {
        // Log but don't fail the application creation if timeline step creation fails
        logError(normalizeError(timelineError, { operation: 'applicationsAPI.create', context: 'timeline_step_creation' }), { operation: 'applicationsAPI.create', context: 'timeline_step_creation' })
      }
    }
    
    return data as Tables<'processing_accounts'>
  },

  updateStatus: async (id: string, status: 'initiated' | 'in-progress' | 'rejected' | 'completed' | 'pending' | 'approved') => {
    // First, try to update without selecting (more reliable with RLS)
    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: status as any })
      .eq('id', id)
    
    if (updateError) {
      throw new Error(updateError.message)
    }
    
    // Then, try to fetch the updated record
    const { data, error: selectError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single()
    
    // If select fails but update succeeded, that's okay - return a minimal object
    if (selectError) {
      // Update likely succeeded, but we can't read it back due to RLS
      // Return a minimal object with the updated status
      return { id, status } as Tables<'applications'>
    }
    
    if (!data) {
      return { id, status } as Tables<'applications'>
    }
    
    // Execute workflows if status changed (get old status from currentApp if available)
    // Note: We can't easily get old status here, so workflows will check conditions
    try {
      const { executeWorkflowsForTrigger } = await import('./workflow-executor')
      await executeWorkflowsForTrigger('application_status_change', {
        id: data.id,
        application_id: data.id,
        status: status,
        new_status: status,
        ...data,
      })
    } catch (error) {
      console.error('Error executing workflows for application status change:', error)
      // Don't throw - workflow failures shouldn't break status update
    }
    
    return data as unknown as Tables<'applications'>
  },

  update: async (id: string, updates: Partial<Tables<'applications'>>) => {
    // Ensure status is properly typed if present
    const typedUpdates = updates.status 
      ? { ...updates, status: updates.status as any }
      : updates
    
    const { data, error } = await supabase
      .from('applications')
      .update(typedUpdates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) {
      // Handle the specific "Cannot coerce" error
      if (error.message.includes('Cannot coerce') || error.code === 'PGRST116') {
        // If single() fails, try without it (might return array)
        const { data: dataArray, error: arrayError } = await supabase
          .from('applications')
          .update(typedUpdates)
          .eq('id', id)
          .select('*')
        
        if (arrayError) throw new Error(arrayError.message)
        if (!dataArray || dataArray.length === 0) {
          throw new Error('Application not found')
        }
        return dataArray[0] as unknown as Tables<'applications'>
      }
      throw new Error(error.message)
    }
    
    if (!data) {
      throw new Error('Application not found')
    }
    
    return data as unknown as Tables<'applications'>
  },

  delete: async (id: string) => {
    const { userId, isAdmin: admin } = await getCurrentUserInfo()
    
    // Check if user owns the application or is admin
    const { data: existing, error: fetchError } = await supabase
      .from('applications')
      .select('user_id')
      .eq('id', id)
      .single()
    
    if (fetchError) throw new Error(fetchError.message)
    if (!existing) throw new Error('Application not found')
    
    // Non-admins can only delete their own applications
    if (!admin && existing.user_id !== userId) {
      throw new Error('Unauthorized: You can only delete your own applications')
    }
    
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Quotations API
// Cache for quotations to reduce repeated queries
const quotationsCache = new Map<string, { data: any[]; expiresAt: number }>()
const QUOTATIONS_CACHE_TTL = 30 * 1000 // 30 seconds cache for quotations

export const quotationsAPI = {
  getAll: async (useCache: boolean = true) => {
    const { userId, isAdmin: admin } = await getCurrentUserInfo()
    
    // Check cache first
    if (useCache) {
      const cacheKey = admin ? 'admin_all' : `user_${userId}`
      const cached = quotationsCache.get(cacheKey)
      const now = Date.now()
      if (cached && cached.expiresAt > now) {
        return cached.data
      }
    }
    
    let result: Tables<'quotations'>[]
    
    if (admin) {
      // For admins, show all quotations
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(error.message)
      result = ((data || []) as unknown) as Tables<'quotations'>[]
    } else {
      // For non-admin users, fetch their own quotations and public quotations separately, then combine
      const [userQuotes, publicQuotes] = await Promise.all([
        supabase
          .from('quotations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('quotations')
          .select('*')
          .is('user_id', null)
          .order('created_at', { ascending: false })
      ])
      
      if (userQuotes.error) throw new Error(userQuotes.error.message)
      if (publicQuotes.error) throw new Error(publicQuotes.error.message)
      
      // Combine and deduplicate by ID, then sort by created_at
      const userData = userQuotes.data && !('error' in userQuotes.data) ? userQuotes.data : []
      const publicData = publicQuotes.data && !('error' in publicQuotes.data) ? publicQuotes.data : []
      const allQuotes = [...userData, ...publicData] as unknown as Tables<'quotations'>[]
      const uniqueQuotes = Array.from(
        new Map(allQuotes.map(q => [q.id, q])).values()
      )
      
      // Sort by created_at descending
      uniqueQuotes.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      result = uniqueQuotes
    }
    
    // Cache the result
    if (useCache) {
      const cacheKey = admin ? 'admin_all' : `user_${userId}`
      quotationsCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + QUOTATIONS_CACHE_TTL
      })
    }
    
    return result
  },
  
  // Invalidate quotations cache (call after create/update/delete)
  invalidateCache: () => {
    quotationsCache.clear()
  },

  // Fetch all quotations without any user filtering (for display purposes)
  getAllUnfiltered: async () => {
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  // Helper function to convert UUID to GQ format (deterministic)
  generateGQId: (id: string): string => {
    if (!id) return 'N/A'
    // If it's already in GQ format, use it as is
    if (id.startsWith('GQ') && id.length === 14) return id
    
    // Convert UUID to GQ format deterministically (GQ + 12 alphanumeric)
    const alphanumeric = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    let chars = ''
    const charsNeeded = 12
    
    // Use characters from the ID in a deterministic way
    for (let i = 0; i < charsNeeded; i++) {
      const sourceIndex = i % alphanumeric.length
      chars += alphanumeric[sourceIndex]
    }
    
    // If we still don't have enough, repeat the pattern
    if (chars.length < charsNeeded) {
      const repeat = Math.ceil(charsNeeded / chars.length)
      chars = (chars.repeat(repeat)).substring(0, charsNeeded)
    }
    
    return `GQ${chars.substring(0, 12)}`
  },

  getById: async (id: string) => {
    // Try to fetch by ID (could be UUID or GQ format)
    let data, error
    
    // If it's GQ format, we need to search all quotes and match
    if (id.startsWith('GQ') && id.length === 14) {
      // Fetch all quotes and find the one that matches this GQ format
      const { data: allQuotes, error: fetchError } = await supabase
        .from('quotations')
        .select('*')
      
      if (fetchError) {
        error = fetchError
      } else {
        // Find quote where the GQ format matches
        const matchingQuote = allQuotes?.find((quote: any) => {
          if (!quote || typeof quote !== 'object' || !('id' in quote)) return false
          const quoteGQId = quotationsAPI.generateGQId(quote.id)
          return quoteGQId === id
        })
        
        if (matchingQuote) {
          data = matchingQuote
        } else {
          error = { message: 'Quotation not found' } as any
        }
      }
    } else {
      // Regular lookup by UUID
      const result = await supabase
        .from('quotations')
        .select('*')
        .eq('id', id)
        .single()
      data = result.data
      error = result.error
    }
    
    if (error) throw new Error(error.message)
    return data as Tables<'quotations'> | null
  },

  getByIdPublic: async (id: string) => {
    // Same logic as getById but for public access
    let data, error
    
    // If it's GQ format, we need to search all quotes and match
    if (id.startsWith('GQ') && id.length === 14) {
      // Fetch all quotes and find the one that matches this GQ format
      const { data: allQuotes, error: fetchError } = await supabase
        .from('quotations')
        .select('*')
      
      if (fetchError) {
        error = fetchError
      } else {
        // Find quote where the GQ format matches
        const matchingQuote = allQuotes?.find((quote: any) => {
          if (!quote || typeof quote !== 'object' || !('id' in quote)) return false
          const quoteGQId = quotationsAPI.generateGQId(quote.id)
          return quoteGQId === id
        })
        
        if (matchingQuote) {
          data = matchingQuote
        } else {
          error = { message: 'Quotation not found' } as any
        }
      }
    } else {
      // Regular lookup by UUID
      const result = await supabase
        .from('quotations')
        .select('*')
        .eq('id', id)
        .single()
      data = result.data
      error = result.error
    }
    
    if (error) throw new Error(error.message)
    return data as Tables<'quotations'> | null
  },

  create: async (data: Inserts<'quotations'>) => {
    const userId = await getCurrentUserId()
    const { data: quotation, error } = await supabase
      .from('quotations')
      .insert({ ...data, user_id: userId })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return quotation
  },

  createPublic: async (
    amount: number,
    description: string,
    email: string,
    _name?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    service?: string,
    state?: string,
    payment_type?: 'full' | 'staggered',
    line_items?: any[],
    client_first_name?: string,
    client_last_name?: string,
    client_email?: string,
    client_mobile?: string,
    taker_type?: 'first-time' | 'retaker'
  ) => {
    // For public quotations, create with NULL user_id
    // Quotes are saved to Supabase and persist until expiration (validity_date) or admin management
    
    // Store taker_type in line_items metadata if provided
    const lineItemsWithMetadata = line_items ? {
      items: line_items,
      metadata: {
        taker_type: taker_type
      }
    } : null
    
    // Calculate validity date (30 days from now)
    // Quotes persist in database until this date or until managed by admin
    const validityDate = new Date()
    validityDate.setDate(validityDate.getDate() + 30)
    
    // Prepare quote data
    const quoteData = {
      user_id: null, // NULL for public/guest quotations
      amount,
      description,
      status: 'pending' as const,
      service: service || null,
      state: state || null,
      payment_type: payment_type || null,
      line_items: lineItemsWithMetadata as any,
      client_first_name: client_first_name || null,
      client_last_name: client_last_name || null,
      client_email: client_email || email, // Always set client_email
      client_mobile: client_mobile || null,
      validity_date: validityDate.toISOString(), // Quote expiration date
    }
    
    // Insert quote into Supabase
    const { data, error } = await supabase
      .from('quotations')
      .insert(quoteData)
      .select()
      .single()
    
    if (error) {
      throw normalizeError(error, { operation: 'quotationsAPI.createPublic', context: 'create_quotation' })
    }
    
    if (!data) {
      throw new Error('Failed to save quotation: No data returned')
    }
    
    // Invalidate cache after creating
    quotationsAPI.invalidateCache()
    
    return data
  },

  update: async (id: string, updates: Updates<'quotations'>) => {
    const { data, error } = await supabase
      .from('quotations')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) {
      // Handle the specific "Cannot coerce" error
      if (error.message.includes('Cannot coerce') || error.code === 'PGRST116') {
        // If single() fails, try without it (might return array)
        const { data: dataArray, error: arrayError } = await supabase
          .from('quotations')
          .update(updates)
          .eq('id', id)
          .select('*')
        
        if (arrayError) throw new Error(arrayError.message)
        if (!dataArray || dataArray.length === 0) {
          throw new Error('Quotation not found')
        }
        const result = dataArray[0]
        // Invalidate cache after updating
        quotationsAPI.invalidateCache()
        return result
      }
      throw new Error(error.message)
    }
    
    // Invalidate cache after updating
    quotationsAPI.invalidateCache()
    
    return data
  },

  updateStatus: async (id: string, status: 'pending' | 'paid' | 'cancelled') => {
    const { data, error } = await supabase
      .from('quotations')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) {
      // Handle the specific "Cannot coerce" error
      if (error.message.includes('Cannot coerce') || error.code === 'PGRST116') {
        // If single() fails, try without it (might return array)
        const { data: dataArray, error: arrayError } = await supabase
          .from('quotations')
          .update({ status })
          .eq('id', id)
          .select('*')
        
        if (arrayError) throw new Error(arrayError.message)
        if (!dataArray || dataArray.length === 0) {
          throw new Error('Quotation not found')
        }
        const result = dataArray[0]
        // Invalidate cache after updating status
        quotationsAPI.invalidateCache()
        return result
      }
      throw new Error(error.message)
    }
    
    // Invalidate cache after updating status
    quotationsAPI.invalidateCache()
    
    return data
  },

  delete: async (id: string) => {
    // First, verify the quotation exists and we can access it
    const { data: existing, error: fetchError } = await supabase
      .from('quotations')
      .select('id, user_id')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code !== 'PGRST116') { // PGRST116 = not found
        throw normalizeError(fetchError, { operation: 'quotationsAPI.delete', context: 'fetch_verification', quotationId: id })
      }
      throw normalizeError(new Error('Quotation not found'), { operation: 'quotationsAPI.delete', quotationId: id })
    }
    
    if (!existing) {
      throw normalizeError(new Error('Quotation not found or you do not have permission to delete it'), { operation: 'quotationsAPI.delete', quotationId: id })
    }
    
    // Get user info (includes admin check)
    const { isAdmin: adminCheck } = await getCurrentUserInfo()
    
    // Perform the deletion
    const { data, error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id)
      .select() // Return deleted data to verify
    
    if (error) {
      throw normalizeError(error, { operation: 'quotationsAPI.delete', context: 'delete_operation', quotationId: id })
    }
    
    // Verify deletion was successful
    if (!data || data.length === 0) {
      // Double-check by trying to fetch it again
      const { data: verifyData, error: verifyError } = await supabase
        .from('quotations')
        .select('id')
        .eq('id', id)
        .single()
      
      if (!verifyError && verifyData) {
        throw normalizeError(new Error('Deletion appeared to succeed but quotation still exists. This may be a permissions issue. Please check RLS policies.'), { operation: 'quotationsAPI.delete', context: 'verification_failed', quotationId: id })
      }
    }
    
    // Invalidate cache after deleting
    quotationsAPI.invalidateCache()
    
    return data
  },

  createPaymentIntent: async (quotationId: string, amount: number) => {
    const token = localStorage.getItem('gritsync_token')
    const res = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ quotation_id: quotationId, amount: amount * 100 }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create payment intent')
    return data
  },
}

// Services API
// Use server endpoint with caching for better performance
export const servicesAPI = {
  getAll: async () => {
    // Use Supabase directly (serverless)
    const { data, error: supabaseError } = await supabase
      .from('services')
      .select('*')
      .order('service_name', { ascending: true })
    
    if (supabaseError) throw new Error(supabaseError.message)
    return data || []
  },

  getByServiceAndState: async (serviceName: string, state: string, useCache: boolean = true) => {
    // Use cache for service lookups
    if (useCache) {
      const { cachedQuery, cacheKeys } = await import('./query-cache')
      return cachedQuery(
        cacheKeys.service(serviceName, state),
        async () => {
          const { data, error: supabaseError } = await supabase
            .from('services')
            .select('*')
            .eq('service_name', serviceName)
            .eq('state', state)
            .maybeSingle()
          
          if (supabaseError) throw new Error(supabaseError.message)
          return data
        },
        5 * 60 * 1000 // Cache for 5 minutes
      )
    }

    // Direct query without cache
    const { data, error: supabaseError } = await supabase
      .from('services')
      .select('*')
      .eq('service_name', serviceName)
      .eq('state', state)
      .maybeSingle()
    
    if (supabaseError) throw new Error(supabaseError.message)
    return data
  },

  getByServiceStateAndPaymentType: async (serviceName: string, state: string, paymentType: 'full' | 'staggered') => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('service_name', serviceName)
      .eq('state', state)
      .eq('payment_type', paymentType)
      .maybeSingle()
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_documents'>
  },

  getAllByServiceAndState: async (serviceName: string, state: string) => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('service_name', serviceName)
      .eq('state', state)
      .order('payment_type', { ascending: true })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  createOrUpdate: async (serviceData: {
    id?: string
    service_name: string
    state: string
    payment_type: 'full' | 'staggered'
    line_items: Array<{ description: string; amount: number; step?: 1 | 2; taxable?: boolean }>
    total_full: number
    total_step1?: number
    total_step2?: number
  }) => {
    if (serviceData.id) {
      // Update existing
      const { data, error } = await supabase
        .from('services')
        .update({
          service_name: serviceData.service_name,
          state: serviceData.state,
          payment_type: serviceData.payment_type,
          line_items: serviceData.line_items as any,
          total_full: serviceData.total_full,
          total_step1: serviceData.total_step1,
          total_step2: serviceData.total_step2,
        })
        .eq('id', serviceData.id)
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      return data
    } else {
      // Create new
      const id = `svc_${Date.now()}`
      const { data, error } = await supabase
        .from('services')
        .insert({
          id,
          service_name: serviceData.service_name,
          state: serviceData.state,
          payment_type: serviceData.payment_type,
          line_items: serviceData.line_items as any,
          total_full: serviceData.total_full,
          total_step1: serviceData.total_step1,
          total_step2: serviceData.total_step2,
        })
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      return data
    }
  },

  update: async (id: string, updates: Partial<Tables<'services'>>) => {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data as Tables<'processing_accounts'>
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

export const serviceRequiredDocumentsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('service_required_documents')
      .select('*')
      .order('service_type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('document_name', { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  },

  getByServiceTypes: async (serviceTypes: string[]) => {
    const query = supabase
      .from('service_required_documents')
      .select('*')
      .order('service_type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('document_name', { ascending: true })

    if (serviceTypes && serviceTypes.length > 0) {
      query.in('service_type', serviceTypes)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  create: async (doc: {
    service_type: string
    document_type: string
    name: string
    accepted_formats?: string[]
    required?: boolean
    sort_order?: number
  }) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Admin access required')
    }

    const payload = {
      service_type: doc.service_type,
      document_type: doc.document_type,
      name: doc.name,
      accepted_formats: doc.accepted_formats && doc.accepted_formats.length > 0
        ? doc.accepted_formats
        : ['.pdf', '.jpg', '.jpeg', '.png'],
      required: doc.required ?? true,
      sort_order: doc.sort_order ?? 0,
    }

    const { data, error } = await supabase
      .from('service_required_documents')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    service_type: string
    document_type: string
    name: string
    accepted_formats: string[]
    required: boolean
    sort_order: number
  }>) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Admin access required')
    }

    const updatePayload: Record<string, any> = {}
    if (updates.service_type !== undefined) updatePayload.service_type = updates.service_type
    if (updates.document_type !== undefined) updatePayload.document_type = updates.document_type
    if (updates.name !== undefined) updatePayload.name = updates.name
    if (updates.accepted_formats !== undefined) updatePayload.accepted_formats = updates.accepted_formats
    if (updates.required !== undefined) updatePayload.required = updates.required
    if (updates.sort_order !== undefined) updatePayload.sort_order = updates.sort_order

    const { data, error } = await supabase
      .from('service_required_documents')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  delete: async (id: string) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Admin access required')
    }

    const { error } = await supabase
      .from('service_required_documents')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  },
}

// In-memory cache for notification counts (per user)
// This reduces database queries for frequently accessed counts
const notificationCountCache = new Map<string, { count: number; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds cache TTL

// Notifications API
export const notificationsAPI = {
  getAll: async (unreadOnly?: boolean, limit?: number) => {
    const userId = await getCurrentUserId()
    
    const query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (unreadOnly) {
      query.eq('read', false)
    }
    
    // Limit results for better performance (default: 50 for dashboard, unlimited if not specified)
    if (limit !== undefined) {
      query.limit(limit)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  getUnreadCount: async (forceRefresh = false) => {
    const userId = await getCurrentUserId()
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = notificationCountCache.get(userId)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.count
      }
    }
    
    // Use optimized count query with head: true for better performance
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    
    if (error) throw new Error(error.message)
    const countValue = count || 0
    
    // Update cache
    notificationCountCache.set(userId, {
      count: countValue,
      timestamp: Date.now()
    })
    
    return countValue
  },

  // Invalidate cache for a user (call when notifications change)
  invalidateCountCache: (userId?: string) => {
    if (userId) {
      notificationCountCache.delete(userId)
    } else {
      notificationCountCache.clear()
    }
  },

  create: async (
    title: string,
    message: string,
    type: 'timeline_update' | 'status_change' | 'payment' | 'general',
    applicationId?: string
  ) => {
    const userId = await getCurrentUserId()
    
    // Create the in-app notification only (no email sending for system events)
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        application_id: applicationId || null,
        type,
        title,
        message,
        read: false,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    // Invalidate cache since a new notification was created
    notificationsAPI.invalidateCountCache(userId)
    
    return data
  },

  markAsRead: async (id: string) => {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    
    // Invalidate cache since count changed
    notificationsAPI.invalidateCountCache(userId)
    
    return data as Tables<'processing_accounts'>
  },

  markAllAsRead: async () => {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    
    if (error) throw new Error(error.message)
    
    // Invalidate cache and set count to 0
    notificationsAPI.invalidateCountCache(userId)
    notificationCountCache.set(userId, { count: 0, timestamp: Date.now() })
  },

  deleteOne: async (id: string) => {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    
    if (error) throw new Error(error.message)
    
    notificationsAPI.invalidateCountCache(userId)
  },

  deleteAll: async () => {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    
    if (error) throw new Error(error.message)
    
    notificationsAPI.invalidateCountCache(userId)
    notificationCountCache.set(userId, { count: 0, timestamp: Date.now() })
  },

  deleteReadOlderThan24h: async () => {
    const userId = await getCurrentUserId()
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('read', true)
      .lt('created_at', cutoff)
    
    if (error) throw new Error(error.message)
    
    notificationsAPI.invalidateCountCache(userId)
  },

  // Trigger notification generation functions
  generateDocumentReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('generate_document_reminders')
      if (error) throw normalizeError(error, { operation: 'notificationsAPI.generateDocumentReminders' })
      return data
    } catch (error) {
      throw normalizeError(error, { operation: 'notificationsAPI.generateDocumentReminders' })
    }
  },

  generateProfileCompletionReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('generate_profile_completion_reminders')
      if (error) throw normalizeError(error, { operation: 'notificationsAPI.generateProfileCompletionReminders' })
      return data
    } catch (error) {
      throw normalizeError(error, { operation: 'notificationsAPI.generateProfileCompletionReminders' })
    }
  },

  generatePaymentReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('generate_payment_reminders')
      if (error) throw normalizeError(error, { operation: 'notificationsAPI.generatePaymentReminders' })
      return data
    } catch (error) {
      throw normalizeError(error, { operation: 'notificationsAPI.generatePaymentReminders' })
    }
  },

  generateCredentialingReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('notify_credentialing_reminder')
      if (error) throw normalizeError(error, { operation: 'notificationsAPI.generateCredentialingReminders' })
      return data
    } catch (error) {
      throw normalizeError(error, { operation: 'notificationsAPI.generateCredentialingReminders' })
    }
  },

  checkMissingDocuments: async (userId?: string) => {
    try {
      const targetUserId = userId || await getCurrentUserId()
      const { data, error } = await supabase.rpc('check_missing_documents', {
        p_user_id: targetUserId
      })
      if (error) throw normalizeError(error, { operation: 'notificationsAPI.checkMissingDocuments', userId: targetUserId })
      return data || []
    } catch (error) {
      logError(normalizeError(error, { operation: 'notificationsAPI.checkMissingDocuments', userId: userId || 'current' }), { operation: 'notificationsAPI.checkMissingDocuments' })
      return []
    }
  },

  checkIncompleteProfile: async (userId?: string) => {
    try {
      const targetUserId = userId || await getCurrentUserId()
      const { data, error } = await supabase.rpc('check_incomplete_profile', {
        p_user_id: targetUserId
      })
      if (error) throw normalizeError(error, { operation: 'notificationsAPI.checkIncompleteProfile', userId: targetUserId })
      return data || false
    } catch (error) {
      logError(normalizeError(error, { operation: 'notificationsAPI.checkIncompleteProfile', userId: userId || 'current' }), { operation: 'notificationsAPI.checkIncompleteProfile' })
      return false
    }
  },
}

// User Details API
export const userDetailsAPI = {
  get: async (useCache: boolean = true) => {
    const userId = await getCurrentUserId()
    
    // Use cache for user details (they don't change frequently)
    if (useCache) {
      const { cachedQuery, cacheKeys } = await import('./query-cache')
      return cachedQuery(
        cacheKeys.userDetails(userId),
        async () => {
          const { data, error } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()
          
          if (error) throw new Error(error.message)
          return data as Tables<'user_details'> | null
        },
        60 * 1000 // Cache for 60 seconds
      )
    }

    // Direct query without cache
    const { data, error } = await supabase
      .from('user_details')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_details'> | null
  },

  // Get user details for a specific user (for admins viewing client details)
  getByUserId: async (userId: string) => {
    const { userId: currentUserId, isAdmin: admin } = await getCurrentUserInfo()
    
    // Only allow admins or the user themselves to fetch details
    if (!admin && userId !== currentUserId) {
      throw new Error('Unauthorized')
    }
    
    const { data, error } = await supabase
      .from('user_details')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) {
      throw new Error(error.message)
    }
    
    return data as Tables<'user_details'> | null
  },

  save: async (details: any) => {
    const userId = await getCurrentUserId()
    
    // Invalidate cache when user details are saved
    try {
      const { invalidateUserCache } = await import('./query-cache')
      invalidateUserCache(userId)
    } catch {
      // Cache module might not be available, continue anyway
    }
    
    // Clean up the details object - remove undefined values and convert empty strings to null
    const cleanedDetails: any = { user_id: userId }
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined) {
        // Convert empty strings to null, keep other values as is
        cleanedDetails[key] = (typeof value === 'string' && value.trim() === '') ? null : value
      }
    }
    
    const { data, error } = await supabase
      .from('user_details')
      .upsert(cleanedDetails, { onConflict: 'user_id' })
      .select()
      .single()
    
    if (error) {
      throw new Error(error.message)
    }
    return data
  },
}

// User Preferences API
export const userPreferencesAPI = {
  get: async () => {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) throw new Error(error.message)
    
    // Return defaults if no preferences exist
    if (!data) {
      return {
        email_notifications_enabled: true,
        email_timeline_updates: true,
        email_status_changes: true,
        email_payment_updates: true,
        email_general_notifications: true,
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
        two_factor_verified_at: null,
      }
    }
    
    return data
  },

  save: async (preferences: Partial<Tables<'user_preferences'>>) => {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ ...preferences, user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_documents'>
  },

  generate2FASecret: async () => {
    // Generate a random secret (in production, use a proper TOTP library)
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return secret
  },

  generateBackupCodes: () => {
    // Generate 10 backup codes
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
        .slice(0, 8)
      codes.push(code)
    }
    return codes
  },

  verify2FACode: async (_secret: string, _code: string): Promise<boolean> => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // In production, use a proper TOTP library like 'otplib'
    // For now, return false as placeholder
    // This should verify the TOTP code against the secret
    return false
  },
}

// User Documents API
export const userDocumentsAPI = {
  getAll: async () => {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  // Get documents for a specific user (for admins viewing client applications)
  getByUserId: async (userId: string) => {
    const { userId: currentUserId, isAdmin: admin } = await getCurrentUserInfo()
    
    // Only allow admins or the user themselves to fetch documents
    if (!admin && userId !== currentUserId) {
      throw new Error('Unauthorized')
    }
    
    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  upload: async (type: string, file: File) => {
    const userId = await getCurrentUserId()
    
    // Compress file before upload to reduce storage size
    const { compressDocument } = await import('./document-compression')
    const compressedFile = await compressDocument(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.85,
      maxFileSizeMB: 5,
    })
    
    // Check if document already exists and delete old file from storage
    const { data: existing, error: checkError } = await supabase
      .from('user_documents')
      .select('id, file_path')
      .eq('user_id', userId)
      .eq('document_type', type)
      .maybeSingle()
    
    if (checkError) throw new Error(checkError.message)
    
    // Delete old file from storage if it exists and clear its URL cache
    if (existing && !('error' in existing) && 'id' in existing && existing.file_path) {
      // Clear URL cache for the old file BEFORE deleting so nothing loads the stale URL
      clearSignedUrlCacheForPath(existing.file_path)
      try {
        const pathParts = existing.file_path.split('/')
        const fileName = pathParts[pathParts.length - 1]
        const storagePath = `${userId}/${fileName}`
        await supabase.storage
          .from('documents')
          .remove([storagePath])
      } catch (storageError) {
        logError(normalizeError(storageError, { operation: 'userDocumentsAPI.upload', context: 'delete_old_file' }), { operation: 'userDocumentsAPI.upload', context: 'delete_old_file', severity: 'low' })
        // Continue even if storage deletion fails
      }
    }
    
    // Upload the compressed file
    const filePath = await uploadFile(userId, compressedFile, type)
    
    let data, error
    if (existing && !('error' in existing) && 'id' in existing) {
      // Update existing document (use compressed file size)
      const { data: updated, error: updateError } = await supabase
        .from('user_documents')
        .update({
          file_path: filePath,
          file_name: file.name, // Keep original filename for display
          file_size: compressedFile.size, // Store compressed file size
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id)
        .select()
        .single()
      data = updated
      error = updateError
    } else {
      // Insert new document (use compressed file size)
      const { data: inserted, error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: userId,
          document_type: type,
          filename: file.name, // NOT NULL column — required
          file_path: filePath,
          file_name: file.name, // Keep original filename for display
          file_size: compressedFile.size, // Store compressed file size
        })
        .select()
        .single()
      data = inserted
      error = insertError
    }
    
    if (error) throw new Error(error.message)

    // Clear URL cache for the newly uploaded file so next load gets a fresh URL
    clearSignedUrlCacheForPath(filePath)

    // When picture is uploaded, sync it as the user's avatar
    if (type === 'picture' && filePath) {
      try {
        await supabase
          .from('users')
          .update({ avatar_path: filePath })
          .eq('id', userId)
        // Clear all avatar-related caches so Header picks up the new image immediately
        localStorage.removeItem(`avatar_${userId}`)
        localStorage.removeItem(`avatar_path_${userId}`)
        clearSignedUrlCacheForPath(filePath)
        // Notify Header component to re-fetch avatar
        window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: { userId, filePath } }))
      } catch {
        // Non-critical — don't fail the upload if avatar sync fails
      }
    }

    // Create a notification for the uploaded document
    try {
      const docLabel = type === 'picture' ? '2x2 Picture'
        : type === 'diploma' ? 'Nursing Diploma'
        : type === 'passport' ? 'Passport'
        : type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      await notificationsAPI.create(
        'Document uploaded',
        `Your ${docLabel} has been uploaded successfully.`,
        'general'
      )
    } catch {
      // Non-critical — don't fail upload if notification creation fails
    }

    return data as Tables<'user_documents'>
  },

  // Upload document for a specific user (for admins)
  uploadForUser: async (userId: string, type: string, file: File) => {
    const { userId: currentUserId, isAdmin: admin } = await getCurrentUserInfo()
    
    // Only allow admins or the user themselves to upload documents
    if (!admin && userId !== currentUserId) {
      throw new Error('Unauthorized')
    }
    
    // Compress file before upload to reduce storage size
    const { compressDocument } = await import('./document-compression')
    const compressedFile = await compressDocument(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.85,
      maxFileSizeMB: 5,
    })
    
    // For G-1145, I-765, and cover letter, delete all existing documents of the same type to prevent duplicates
    // This ensures that upload and generate operations overwrite each other
    if (type === 'additional_g1145' || type === 'additional_i765' || type === 'additional_cover_letter') {
      const { data: existingDocs, error: checkError } = await supabase
        .from('user_documents')
        .select('id, file_path')
        .eq('user_id', userId)
        .eq('document_type', type)
      
      if (checkError) throw new Error(checkError.message)
      
      // Delete all existing documents of this type
      if (existingDocs && existingDocs.length > 0) {
        // Delete old files from storage
        for (const doc of existingDocs) {
          if (doc.file_path) {
            try {
              const pathParts = doc.file_path.split('/')
              const fileName = pathParts[pathParts.length - 1]
              const storagePath = `${userId}/${fileName}`
              await supabase.storage
                .from('documents')
                .remove([storagePath])
            } catch (storageError) {
              logError(normalizeError(storageError, { operation: 'userDocumentsAPI.deleteAllByType', context: 'delete_old_file' }), { operation: 'userDocumentsAPI.deleteAllByType', context: 'delete_old_file', severity: 'low' })
              // Continue even if storage deletion fails
            }
          }
        }
        
        // Delete all database records
        const { error: deleteError } = await supabase
          .from('user_documents')
          .delete()
          .eq('user_id', userId)
          .eq('document_type', type)
        
        if (deleteError) throw new Error(deleteError.message)
      }
    } else {
      // For other document types, check if document already exists and update it
      const { data: existing, error: checkError } = await supabase
        .from('user_documents')
        .select('id, file_path')
        .eq('user_id', userId)
        .eq('document_type', type)
        .maybeSingle()
      
      if (checkError) throw new Error(checkError.message)
      
      if (existing && !('error' in existing) && 'id' in existing && existing.file_path) {
        // Delete old file from storage before updating
        try {
          const pathParts = existing.file_path.split('/')
          const fileName = pathParts[pathParts.length - 1]
          const storagePath = `${userId}/${fileName}`
          await supabase.storage
            .from('documents')
            .remove([storagePath])
        } catch (storageError) {
          logError(normalizeError(storageError, { operation: 'userDocumentsAPI.upload', context: 'delete_old_file' }), { operation: 'userDocumentsAPI.upload', context: 'delete_old_file', severity: 'low' })
          // Continue even if storage deletion fails
        }
      }
    }
    
    // Upload the compressed file
    const filePath = await uploadFile(userId, compressedFile, type)
    
    // For G-1145, I-765, and cover letter, always insert new (we've already deleted all existing ones)
    // For other types, update if exists, otherwise insert
    if (type === 'additional_g1145' || type === 'additional_i765' || type === 'additional_cover_letter') {
      // Insert new document (use compressed file size)
      const { data: inserted, error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: userId,
          document_type: type,
          filename: file.name, // NOT NULL column — required
          file_path: filePath,
          file_name: file.name, // Keep original filename for display
          file_size: compressedFile.size, // Store compressed file size
        })
        .select()
        .single()
      
      if (insertError) throw new Error(insertError.message)
      return inserted as Tables<'user_documents'>
    } else {
      // For other document types, update if exists, otherwise insert
      const { data: existing, error: checkError } = await supabase
        .from('user_documents')
        .select('id')
        .eq('user_id', userId)
        .eq('document_type', type)
        .maybeSingle()
      
      if (checkError) throw new Error(checkError.message)
      
      let data, error
      if (existing && !('error' in existing) && 'id' in existing) {
        // Update existing document (use compressed file size)
        const { data: updated, error: updateError } = await supabase
          .from('user_documents')
          .update({
            file_path: filePath,
            file_name: file.name, // Keep original filename for display
            file_size: compressedFile.size, // Store compressed file size
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', (existing as { id: string }).id)
          .select()
          .single()
        data = updated
        error = updateError
      } else {
        // Insert new document (use compressed file size)
        const { data: inserted, error: insertError } = await supabase
          .from('user_documents')
          .insert({
            user_id: userId,
            document_type: type,
            filename: file.name, // NOT NULL column — required
            file_path: filePath,
            file_name: file.name, // Keep original filename for display
            file_size: compressedFile.size, // Store compressed file size
          })
          .select()
          .single()
        data = inserted
        error = insertError
      }
      
      if (error) throw new Error(error.message)
      return data as Tables<'user_documents'>
    }
  },

  // Delete a document (removes file from storage AND database record)
  delete: async (documentId: string) => {
    const { userId, isAdmin: admin } = await getCurrentUserInfo()
    
    // Fetch the document so we have the file_path and can verify ownership
    const { data: doc, error: fetchError } = await supabase
      .from('user_documents')
      .select('user_id, file_path')
      .eq('id', documentId)
      .single()
    
    if (fetchError) throw new Error(fetchError.message)
    if (!admin && doc && !('error' in doc) && 'user_id' in doc && (doc as any).user_id !== userId) {
      throw new Error('Unauthorized')
    }

    // Delete the actual file from storage first and clear its URL cache
    const filePath = (doc as any)?.file_path
    if (filePath) {
      // Clear URL cache immediately so nothing can load the stale URL
      clearSignedUrlCacheForPath(filePath)
      try {
        await supabase.storage
          .from('documents')
          .remove([filePath])
      } catch (storageError) {
        logError(normalizeError(storageError, { operation: 'userDocumentsAPI.delete', context: 'delete_storage_file' }), { operation: 'userDocumentsAPI.delete', context: 'delete_storage_file', severity: 'low' })
        // Continue even if storage deletion fails — DB record should still be removed
      }
    }
    
    // Delete the database record
    const { error } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', documentId)
    
    if (error) throw new Error(error.message)

    // Create a notification for the deleted document
    try {
      await notificationsAPI.create(
        'Document removed',
        'A document has been removed from your profile. Upload a new one if needed.',
        'general'
      )
    } catch {
      // Non-critical
    }
  },
}

// File upload helper
// Note: File compression should be done before calling this function
async function uploadFile(userId: string, file: File, type: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  // Use consistent filename based on document type to allow overwriting
  // This ensures smooth replacement without accumulating duplicate files
  const fileNamePrefix = type
  const fileName = `${fileNamePrefix}.${fileExt}`
  const filePath = `${userId}/${fileName}`
  
  const { error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true, // Allow overwriting existing files for smooth replacement
    })
  
  if (error) throw new Error(error.message)
  return filePath
}

// Get file URL (for Supabase Storage)
export function getFileUrl(filePath: string): string {
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)
  
  return data.publicUrl
}

// Get signed URL for private files (expires in 1 hour by default, cache for longer)
// Optimized in-memory cache to minimize storage API calls
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const signedUrlInflight = new Map<string, Promise<string>>()
// Negative cache for files that don't exist (cache for 15 minutes to avoid repeated failed lookups)
const negativeCache = new Map<string, { expiresAt: number }>()
// Rate limiter for file listing to prevent server crashes
const fileListingCache = new Map<string, { files: any[] | null; expiresAt: number }>()
const FILE_LISTING_CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache for file listings
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000 // Clean up every 5 minutes
const CACHE_BUFFER_MS = 60000 // 1 minute buffer before expiration
const NEGATIVE_CACHE_TTL = 15 * 60 * 1000 // 15 minutes for negative cache

// Cleanup expired cache entries periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of signedUrlCache.entries()) {
      if (value.expiresAt <= now) {
        signedUrlCache.delete(key)
      }
    }
    for (const [key, value] of negativeCache.entries()) {
      if (value.expiresAt <= now) {
        negativeCache.delete(key)
      }
    }
    for (const [key, value] of fileListingCache.entries()) {
      if (value.expiresAt <= now) {
        fileListingCache.delete(key)
      }
    }
  }, CACHE_CLEANUP_INTERVAL)
}

/**
 * Clears all cached signed URLs for a given file path.
 * Must be called after uploading a new version or deleting a file so
 * components re-fetch a fresh URL instead of using the stale cached one.
 */
export function clearSignedUrlCacheForPath(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, '/')
  for (const key of signedUrlCache.keys()) {
    if (key.startsWith(normalizedPath + ':') || key === normalizedPath) {
      signedUrlCache.delete(key)
    }
  }
  negativeCache.delete(normalizedPath)
  for (const key of signedUrlInflight.keys()) {
    if (key.startsWith(normalizedPath + ':') || key === normalizedPath) {
      signedUrlInflight.delete(key)
    }
  }
  // Also remove from the image-cache singleton so DocumentImagePreview re-fetches
  imageUrlCache.delete(normalizedPath)
}

export async function getSignedFileUrl(filePath: string, expiresIn: number = 3600, silent: boolean = false): Promise<string> {
  if (!filePath || filePath.trim() === '') {
    if (!silent) {
      logError(normalizeError(new Error('File path is required'), { operation: 'getSignedFileUrl', filePath }), { operation: 'getSignedFileUrl' })
    }
    throw normalizeError(new Error('File path is required'), { operation: 'getSignedFileUrl', filePath })
  }
  
  // Normalize path (handle Windows backslashes)
  const normalizedPath = filePath.replace(/\\/g, '/')
  const cacheKey = `${normalizedPath}:${expiresIn}`
  const now = Date.now()
  
  // Check positive cache first
  const cached = signedUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > now + CACHE_BUFFER_MS) {
    return cached.url
  }
  
  // Determine silent mode before cache checks
  const isAvatar = normalizedPath.includes('avatar') || normalizedPath.includes('picture')
  const shouldBeSilent = silent || isAvatar

  // Check negative cache (files that don't exist) - avoid repeated API calls
  const negativeCached = negativeCache.get(normalizedPath)
  if (negativeCached && negativeCached.expiresAt > now) {
    if (shouldBeSilent) {
      return null as any
    }
    throw new Error(`File not found in storage: ${normalizedPath}`)
  }
  
  // Check if there's already an inflight request for this file
  const inflight = signedUrlInflight.get(cacheKey)
  if (inflight) return inflight

  const promise = (async (): Promise<string> => {
    // For silent mode (avatars), check negative cache first to avoid unnecessary API calls
    if (shouldBeSilent) {
      const negativeCached = negativeCache.get(normalizedPath)
      if (negativeCached && negativeCached.expiresAt > now) {
        // File was previously not found, return null silently
        return null as any
      }
    }
    
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(normalizedPath, expiresIn)
    
    if (error) {
      // For silent mode, immediately cache as negative and return null without trying alternatives
      if (shouldBeSilent && (error.message?.includes('not found') || error.message?.includes('Object not found') || error.statusCode === 400)) {
        negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
        return null as any
      }
      // If file not found, try alternative paths (with/without timestamps)
      if (error.message?.includes('not found') || error.message?.includes('Object not found')) {
        const pathParts = normalizedPath.split('/')
        const fileName = pathParts[pathParts.length - 1]
        const directory = pathParts.slice(0, -1).join('/')
        
        // Try alternative paths
        let alternativePath: string | null = null
        
        // Case 1: If path contains timestamp, try without timestamp and also try 2x2picture variations
        if (normalizedPath.match(/_\d{13}\./)) {
          const match = fileName.match(/^(.+?)_\d+\.(.+)$/)
          if (match) {
            const [, docType, ext] = match
            
            // First try without timestamp
            const pathWithoutTimestamp = directory ? `${directory}/${docType}.${ext}` : `${docType}.${ext}`
            
            // If it's a picture type, also try 2x2picture variations
            if (docType.toLowerCase() === 'picture') {
              const extLower = ext.toLowerCase()
              const extUpper = ext.toUpperCase()
              const extVariations = [ext, extLower, extUpper]
              
              // Try 2x2picture with various extension cases first (more likely to be correct)
              for (const extVar of extVariations) {
                const altPath = directory ? `${directory}/2x2picture.${extVar}` : `2x2picture.${extVar}`
                const altNegativeCached = negativeCache.get(altPath)
                if (!altNegativeCached || altNegativeCached.expiresAt <= now) {
                  try {
                    const { data: altData, error: altError } = await supabase.storage
                      .from('documents')
                      .createSignedUrl(altPath, expiresIn)
                    if (!altError && altData?.signedUrl) {
                      signedUrlCache.set(cacheKey, { url: altData.signedUrl, expiresAt: now + expiresIn * 1000 })
                      return altData.signedUrl
                    }
                  } catch {
                    // Continue to next variation
                  }
                }
              }
            }
            
            // Also try the path without timestamp
            alternativePath = pathWithoutTimestamp
          }
        } 
        // Case 2: If path doesn't contain timestamp, try to find files with timestamps or alternative names
        else {
          // First, try direct name variations (picture <-> 2x2picture)
          const baseNameMatch = fileName.match(/^(.+?)\.(.+)$/)
          if (baseNameMatch) {
            const [, baseName, ext] = baseNameMatch
            
            // Try 2x2picture if looking for picture, or picture if looking for 2x2picture
            // Also try case variations of the extension (jpg/JPG/jpg)
            const extLower = ext.toLowerCase()
            const extUpper = ext.toUpperCase()
            const extVariations = [ext, extLower, extUpper]
            
            if (baseName.toLowerCase() === 'picture') {
              // Try 2x2picture with various extension cases
              for (const extVar of extVariations) {
                const altPath = directory ? `${directory}/2x2picture.${extVar}` : `2x2picture.${extVar}`
                // Check negative cache first
                const altNegativeCached = negativeCache.get(altPath)
                if (!altNegativeCached || altNegativeCached.expiresAt <= now) {
                  try {
                    const { data: altData, error: altError } = await supabase.storage
                      .from('documents')
                      .createSignedUrl(altPath, expiresIn)
                    if (!altError && altData?.signedUrl) {
                      signedUrlCache.set(cacheKey, { url: altData.signedUrl, expiresAt: now + expiresIn * 1000 })
                      return altData.signedUrl
                    }
                  } catch {
                    // Continue to next variation or file listing fallback
                  }
                }
              }
            } else if (baseName.toLowerCase() === '2x2picture') {
              // Try picture with various extension cases
              for (const extVar of extVariations) {
                const altPath = directory ? `${directory}/picture.${extVar}` : `picture.${extVar}`
                // Check negative cache first
                const altNegativeCached = negativeCache.get(altPath)
                if (!altNegativeCached || altNegativeCached.expiresAt <= now) {
                  try {
                    const { data: altData, error: altError } = await supabase.storage
                      .from('documents')
                      .createSignedUrl(altPath, expiresIn)
                    if (!altError && altData?.signedUrl) {
                      signedUrlCache.set(cacheKey, { url: altData.signedUrl, expiresAt: now + expiresIn * 1000 })
                      return altData.signedUrl
                    }
                  } catch {
                    // Continue to next variation or file listing fallback
                  }
                }
              }
            }
          }
          
          // List files in the directory to find matching files with timestamps or alternative names
          // Only do this for picture files to avoid excessive API calls
          // Use cached file listings to prevent repeated API calls
          try {
            // Check if we have a cached file listing for this directory
            const cachedListing = fileListingCache.get(directory || '')
            let files: any[] | null = null
            
            if (cachedListing && cachedListing.expiresAt > now) {
              // Use cached listing
              files = cachedListing.files
            } else {
              // Fetch fresh listing with rate limiting
              const { data: listData, error: listError } = await supabase.storage
                .from('documents')
                .list(directory || '', {
                  limit: 100
                })
              
              if (!listError && listData) {
                files = listData
                // Cache the listing
                fileListingCache.set(directory || '', { 
                  files: listData, 
                  expiresAt: now + FILE_LISTING_CACHE_TTL 
                })
              }
            }
            
            if (files && files.length > 0) {
              // Extract base name and extension from fileName (e.g., "picture.JPG" -> "picture", "JPG")
              if (baseNameMatch) {
                const [, baseName, ext] = baseNameMatch
                
                // Look for files matching pattern: baseName_timestamp.ext
                const timestampPattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d+\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
                let matchingFile = files.find(f => timestampPattern.test(f.name))
                
                // If not found and looking for picture, try 2x2picture variations
                if (!matchingFile && baseName.toLowerCase() === 'picture') {
                  const pattern2x2 = new RegExp(`^2x2picture(_\\d+)?\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
                  matchingFile = files.find(f => pattern2x2.test(f.name))
                }
                
                // If not found and looking for 2x2picture, try picture variations
                if (!matchingFile && baseName.toLowerCase() === '2x2picture') {
                  const patternPic = new RegExp(`^picture(_\\d+)?\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
                  matchingFile = files.find(f => patternPic.test(f.name))
                }
                
                if (matchingFile) {
                  alternativePath = directory ? `${directory}/${matchingFile.name}` : matchingFile.name
                }
              }
            }
          } catch (listErr) {
            // If listing fails, continue with other fallback logic - don't crash
          }
        }
        
        // Try alternative path if found
        if (alternativePath) {
          // Check negative cache for alternative path
          const alternativeNegativeCached = negativeCache.get(alternativePath)
          if (alternativeNegativeCached && alternativeNegativeCached.expiresAt > now) {
            // Both paths failed before, try file listing as last resort
            alternativePath = null // Reset to trigger file listing
          } else {
            const { data: fallbackData, error: fallbackError } = await supabase.storage
              .from('documents')
              .createSignedUrl(alternativePath, expiresIn)
            
            if (!fallbackError && fallbackData?.signedUrl) {
              // Cache successful result with original cache key
              signedUrlCache.set(cacheKey, { url: fallbackData.signedUrl, expiresAt: now + expiresIn * 1000 })
              return fallbackData.signedUrl
            }
            
            // Alternative path failed, try file listing as last resort
            alternativePath = null
          }
        }
        
        // If alternative path failed or wasn't found, try listing files (especially for picture/2x2picture)
        // Only do this for picture files to avoid excessive API calls that crash the server
        // Use cached file listings to prevent repeated API calls
        if (!alternativePath && fileName.toLowerCase().includes('picture')) {
          try {
            // Check if we have a cached file listing for this directory
            const cachedListing = fileListingCache.get(directory || '')
            let files: any[] | null = null
            
            if (cachedListing && cachedListing.expiresAt > now) {
              // Use cached listing
              files = cachedListing.files
            } else {
              // Fetch fresh listing with rate limiting
              const { data: listData, error: listError } = await supabase.storage
                .from('documents')
                .list(directory || '', {
                  limit: 100
                })
              
              if (!listError && listData) {
                files = listData
                // Cache the listing
                fileListingCache.set(directory || '', { 
                  files: listData, 
                  expiresAt: now + FILE_LISTING_CACHE_TTL 
                })
              }
            }
            
            if (files && files.length > 0) {
              // Extract base name from original fileName or normalizedPath
              const originalFileName = normalizedPath.split('/').pop() || ''
              const baseNameMatch = originalFileName.match(/^(.+?)(?:_\d+)?\.(.+)$/)
              
              if (baseNameMatch) {
                const [, baseName, ext] = baseNameMatch
                
                // For picture files, prioritize 2x2picture
                if (baseName.toLowerCase() === 'picture') {
                  // Look for 2x2picture files (with or without timestamp, any case)
                  const pattern2x2 = new RegExp(`^2x2picture(_\\d+)?\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
                  let matchingFile = files.find(f => pattern2x2.test(f.name))
                  
                  // If not found, try any file starting with 2x2picture
                  if (!matchingFile) {
                    matchingFile = files.find(f => f.name.toLowerCase().startsWith('2x2picture'))
                  }
                  
                  if (matchingFile) {
                    alternativePath = directory ? `${directory}/${matchingFile.name}` : matchingFile.name
                  }
                }
              }
            }
          } catch (listErr) {
            // If listing fails, continue to error - don't crash
          }
        }
        
        // Try the file listing result if found
        if (alternativePath) {
          const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from('documents')
            .createSignedUrl(alternativePath, expiresIn)
          
          if (!fallbackError && fallbackData?.signedUrl) {
            signedUrlCache.set(cacheKey, { url: fallbackData.signedUrl, expiresAt: now + expiresIn * 1000 })
            return fallbackData.signedUrl
          }
        }
        
        // All attempts failed, cache as negative
        negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
        if (alternativePath) {
          negativeCache.set(alternativePath, { expiresAt: now + NEGATIVE_CACHE_TTL })
        }
        
        // Provide more helpful error messages
        throw new Error(`File not found in storage: ${normalizedPath}`)
      }
      
      throw new Error(error.message || 'Failed to get signed URL')
    }
  
    if (!data?.signedUrl) {
      // Cache as negative since no URL was returned
      negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
      throw new Error('No signed URL returned')
    }
    
    // Cache successful result
    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: now + expiresIn * 1000 })
    // Remove from negative cache if it was there (file now exists)
    negativeCache.delete(normalizedPath)
    return data.signedUrl
  })()

  signedUrlInflight.set(cacheKey, promise)
  try {
    return await promise
  } catch (error) {
    // If silent mode is enabled (for avatars), don't throw - return null instead
    // This prevents console errors for missing avatar files
    if (shouldBeSilent) {
      // Cache as negative to prevent repeated attempts
      negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
      return null as any // Return null instead of throwing
    }
    // Re-throw the error for non-silent cases
    throw error
  } finally {
    signedUrlInflight.delete(cacheKey)
  }
}

// Application Timeline Steps API
export const timelineStepsAPI = {
  getByApplication: async (applicationId: string, useCache: boolean = true) => {
    // Use cache for timeline steps (they don't change frequently)
    if (useCache) {
      const { cachedQuery, cacheKeys } = await import('./query-cache')
      return cachedQuery(
        cacheKeys.applicationTimeline(applicationId),
        async () => {
          const { data, error } = await supabase
            .from('application_timeline_steps')
            .select('*')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: true })
          
          if (error) throw new Error(error.message)
          return data || []
        },
        30 * 1000 // Cache for 30 seconds
      )
    }

    // Direct query without cache
    const { data, error } = await supabase
      .from('application_timeline_steps')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  update: async (applicationId: string, stepKey: string, status: 'pending' | 'completed', data?: any) => {
    // Invalidate cache when timeline is updated
    try {
      const { invalidateApplicationCache } = await import('./query-cache')
      invalidateApplicationCache(applicationId)
    } catch {
      // Cache module might not be available, continue anyway
    }
    
    // Map step keys to step names
    const stepNameMap: { [key: string]: string } = {
      // NCLEX Steps
      'app_submission': 'Application Submission',
      'app_created': 'Application created',
      'documents_submitted': 'Required documents submitted',
      'app_paid': 'Application Step 1 payment paid',
      'app_step2_paid': 'Application Step 2 payment paid',
      'credentialing': 'Credentialing',
      'letter_generated': 'Generated letter for school',
      'letter_submitted': 'Letter for school submitted',
      'official_docs_submitted': 'Official Documents Sent by School to NY BON',
      'bon_application': 'BON (Board of Nursing) Application',
      'mandatory_courses': 'Mandatory Courses Done',
      'form1_submitted': 'Form 1 Application form submitted',
      'nclex_eligibility': 'NCLEX Eligibility',
      'nclex_eligibility_approved': 'NCLEX eligibility has been approved',
      'pearson_vue': 'Pearson VUE Application',
      'pearson_account_created': 'Pearson Vue Account Created',
      'att_requested': 'Request ATT submitted',
      'att': 'ATT (Authorization to Test)',
      'att_received': 'ATT has been Received',
      'nclex_exam': 'NCLEX Exam',
      'exam_date_booked': 'Final Exam Date has been booked',
      'quick_results': 'Quick Results',
      'quick_result_paid': 'Quick Result request has been paid',
      'exam_result': 'Exam Result',
      // EAD Steps
      'ead_app_submission': 'Application Submission',
      'ead_form_review': 'Form Review',
      'ead_uscis_submission': 'USCIS Submission',
      'ead_receipt_received': 'Receipt Notice Received',
      'ead_biometrics': 'Biometrics Appointment',
      'ead_biometrics_completed': 'Biometrics Completed',
      'ead_rfe': 'Request for Evidence (RFE)',
      'ead_rfe_response': 'RFE Response Submitted',
      'ead_approval': 'EAD Approval',
      'ead_card_production': 'Card Production',
      'ead_card_mailed': 'Card Mailed',
      'ead_card_received': 'Card Received',
      'ead_denial': 'EAD Denial',
    }
    
    // First, fetch existing step data to merge with new data
    const { data: existingStep } = await supabase
      .from('application_timeline_steps')
      .select('data, status, step_name')
      .eq('application_id', applicationId)
      .eq('step_key', stepKey)
      .maybeSingle()
    
    // Merge existing data with new data
    let mergedData = data || {}
    const existingStepData = existingStep as { data?: any } | null
    if (existingStepData?.data && typeof existingStepData.data === 'object') {
      mergedData = {
        ...existingStepData.data,
        ...data,
      }
    }
    
    // Determine completed_at - use from data if provided, otherwise set based on status
    let completedAt: string | null = null
    if (status === 'completed') {
      // Use date from merged data if available, otherwise use current timestamp
      if (mergedData.date) {
        completedAt = mergedData.date
      } else if (mergedData.completed_at) {
        completedAt = mergedData.completed_at
      } else {
        completedAt = new Date().toISOString()
      }
    } else {
      // If status is pending, clear completed_at unless there's a date in the data
      if (mergedData.date) {
        completedAt = mergedData.date
      } else {
        completedAt = null
      }
    }
    
    // Get step name - use existing if available, otherwise use map
    const existingStepInfo = existingStep as { step_name?: string } | null
    const stepName = existingStepInfo?.step_name || stepNameMap[stepKey] || stepKey
    
    // Prepare upsert data
    const upsertData: any = {
      application_id: applicationId,
      step_key: stepKey,
      step_name: stepName,
      status,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    }
    
    // Only include data if it has keys, otherwise set to null
    if (Object.keys(mergedData).length > 0) {
      upsertData.data = mergedData
    } else {
      upsertData.data = null
    }
    
    const { data: updatedStep, error } = await supabase
      .from('application_timeline_steps')
      .upsert(upsertData, {
        onConflict: 'application_id,step_key',
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return updatedStep
  },

  create: async (applicationId: string, stepKey: string, stepName: string, parentStep?: string) => {
    const { data, error } = await supabase
      .from('application_timeline_steps')
      .insert({
        application_id: applicationId,
        step_key: stepKey,
        step_name: stepName,
        parent_step: parentStep,
        status: 'pending',
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data as Tables<'application_timeline_steps'> | null
  },
}

// GritSync email generation is now handled server-side via database functions
// Removed client-side generation logic

// Helper function to generate security question answers
function generateSecurityAnswers(
  elementarySchool: string | null,
  gender: string | null,
  middleName: string | null,
  maritalStatus: string | null
): { question1: string; question2: string; question3: string } {
  // Question 1: What was the name of the first school you attended?
  // Answer: First name of elementary school (lowercase, one word)
  let question1 = 'unknown'
  if (elementarySchool) {
    const firstWord = elementarySchool.trim().split(/\s+/)[0].toLowerCase()
    question1 = firstWord
  }
  
  // Question 2: Who was your childhood hero?
  // Answer: superman (male) or darna (female), lowercase
  let question2 = 'superman' // default
  if (gender) {
    const genderLower = gender.toLowerCase()
    if (genderLower === 'female') {
      question2 = 'darna'
    } else if (genderLower === 'male') {
      question2 = 'superman'
    }
  }
  
  // Question 3: What is your oldest sibling's middle name?
  // Answer: user's middle name (lowercase, one word)
  // If married and previous not available, use user's middle name
  let question3 = 'none'
  if (middleName) {
    const firstWord = middleName.trim().split(/\s+/)[0].toLowerCase()
    question3 = firstWord
  }
  
  return {
    question1,
    question2,
    question3
  }
}

// Processing Accounts API
export const processingAccountsAPI = {
  getByApplication: async (applicationId: string) => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    // Try to find by grit_app_id first (if it looks like AP + 12 alphanumeric)
    // Otherwise, fall back to UUID id
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(applicationId)
    
    let query = supabase
      .from('applications')
      .select('id, user_id, first_name, middle_name, last_name, elementary_school, gender, marital_status')
    
    if (isGritAppId) {
      query = query.eq('grit_app_id', applicationId.toUpperCase())
    } else {
      query = query.eq('id', applicationId)
    }
    
    const { data: application, error: appError } = await query.single()
    
    if (appError) {
      throw new Error(appError.message)
    }
    if (!application) {
      throw new Error('Application not found')
    }
    
    // Type assertion for application
    if (!application || 'error' in application) {
      throw new Error('Application not found')
    }
    const typedApplication = application as Tables<'applications'>
    
    // Use the actual UUID id for subsequent queries (not the GRIT APP ID)
    const actualApplicationId = typedApplication.id
    
    // Check if user owns the application or is admin
    if (!admin && typedApplication.user_id !== userId) {
      throw new Error('Unauthorized')
    }
    
    // Get existing accounts (use actual UUID id)
    const { data: accounts, error } = await supabase
      .from('processing_accounts')
      .select('*')
      .eq('application_id', actualApplicationId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(error.message)
    }
    const existingAccounts = accounts || []
    
    // Check if Gmail and Pearson Vue accounts exist
    const typedAccounts = existingAccounts as Array<{ account_type?: string }>
    const existingGritsync = typedAccounts.find(acc => acc.account_type === 'gritsync')
    const existingPearson = typedAccounts.find(acc => acc.account_type === 'pearson_vue')
    
    // Get user's grit_id for password
    const { data: user } = await supabase
      .from('users')
      .select('grit_id')
      .eq('id', typedApplication.user_id)
      .single()
    
    // Generate password: "@GRiT" + numeric part of grit_id
    // Example: GRIT414821 -> @GRiT414821
    let password = ''
    const userData = user as { grit_id?: string } | null
    if (userData?.grit_id) {
      const gritId = userData.grit_id
      // Extract numeric part (everything after "GRIT")
      const numericPart = gritId.replace(/^GRIT/i, '')
      password = `@GRiT${numericPart}`
    }
    
    // GritSync accounts are now created via database triggers/functions
    // No need to generate email client-side - rely on server-side generation
    
    // Create Pearson Vue account if it doesn't exist (same email and password as GritSync)
    if (!existingPearson) {
      try {
        if (password && firstName && lastName) {
          // Generate security question answers
          const securityAnswers = generateSecurityAnswers(
            typedApplication.elementary_school || null,
            typedApplication.gender || null,
            typedApplication.middle_name || null,
            typedApplication.marital_status || null
          )
          
          const { error: pearsonError } = await supabase
            .from('processing_accounts')
            .insert({
              application_id: actualApplicationId,
              account_type: 'pearson_vue',
              email: gritsyncEmail,
              password: password,
              security_question_1: securityAnswers.question1,
              security_question_2: securityAnswers.question2,
              security_question_3: securityAnswers.question3,
              status: 'inactive', // Inactive by default, must be activated by admin
              created_by: typedApplication.user_id,
            })
            .select()
            .single()
          
          // Silently handle duplicate errors (account already exists)
          if (pearsonError && pearsonError.code !== '23505' && !pearsonError.message?.includes('duplicate') && !pearsonError.message?.includes('unique')) {
            // Only log non-duplicate errors
          }
        }
      } catch (error: any) {
        // Silently handle duplicate errors
        if (error?.code !== '23505' && !error?.message?.includes('duplicate') && !error?.message?.includes('unique')) {
          // Only log non-duplicate errors
        }
      }
    }
    
    // Re-fetch accounts from database to ensure we have the latest data and avoid duplicates
    const { data: allAccounts, error: refetchError } = await supabase
      .from('processing_accounts')
      .select('*')
      .eq('application_id', actualApplicationId)
      .order('created_at', { ascending: false })
    
    if (!refetchError) {
      // Use the re-fetched accounts
      existingAccounts.length = 0
      existingAccounts.push(...(allAccounts || []))
    }
    
    // Deduplicate accounts by id (in case of any duplicates)
    const validAccounts = existingAccounts.filter((acc: any) => acc && !('error' in acc) && 'id' in acc)
    const typedExistingAccounts = validAccounts as unknown as Array<{ id: string }>
    const uniqueAccounts = Array.from(
      new Map(typedExistingAccounts.map(acc => [acc.id, acc])).values()
    )
    
    // Sort accounts: GritSync and Pearson Vue first, then custom accounts
    const typedUniqueAccounts = uniqueAccounts as Array<{ account_type?: string; created_at?: string }>
    typedUniqueAccounts.sort((a, b) => {
      const order: { [key: string]: number } = { 'gritsync': 1, 'pearson_vue': 2, 'custom': 3 }
      const aOrder = order[a.account_type || ''] || 99
      const bOrder = order[b.account_type || ''] || 99
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
    
    return uniqueAccounts
  },

  create: async (applicationId: string, accountData: {
    account_type: 'gritsync' | 'pearson_vue' | 'custom'
    name?: string
    link?: string
    email: string
    password: string
    security_question_1?: string
    security_question_2?: string
    security_question_3?: string
  }) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }
    
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('processing_accounts')
      .insert({
        ...accountData,
        application_id: applicationId,
        created_by: userId,
        status: 'active',
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data as Tables<'processing_accounts'>
  },

  update: async (id: string, updates: Partial<{
    account_type: 'gmail' | 'gritsync' | 'pearson_vue' | 'custom'
    name: string
    link: string
    email: string
    password: string
    security_question_1: string
    security_question_2: string
    security_question_3: string
    status: 'active' | 'inactive'
  }>) => {
    const admin = await isAdmin()
    const userId = await getCurrentUserId()
    
    // First, get the account to check its type
    const { data: account, error: fetchError } = await supabase
      .from('processing_accounts')
      .select('account_type, application_id, created_by')
      .eq('id', id)
      .single()
    
    if (fetchError) throw new Error(fetchError.message)
    if (!account) throw new Error('Account not found')
    
    // Check if this is a Gmail or Pearson Vue account
    const accountData = account as { account_type?: string; application_id?: string }
    const isSystemAccount = accountData.account_type === 'gritsync' || accountData.account_type === 'pearson_vue'
    const isGritsyncAccount = accountData.account_type === 'gritsync'
    
    // For Gmail accounts:
    // - Clients can update status and password for their own applications
    // - Admins can update all fields
    // For Pearson Vue accounts:
    // - Only admins can update them
    if (isSystemAccount) {
      if (!admin) {
        // Check if user owns the application
        const applicationId = (account as { application_id?: string }).application_id
        if (!applicationId) {
          throw new Error('Application ID not found')
        }
        const { data: application } = await supabase
          .from('applications')
          .select('user_id')
          .eq('id', applicationId)
          .single()
        
        const appData = application as { user_id?: string } | null
        if (!appData || appData.user_id !== userId) {
          throw new Error('Unauthorized - You can only update accounts for your own applications')
        }
        
        // For Gmail accounts, clients can only update status and password
        if (isGmailAccount) {
          const allowedFields = ['status', 'password']
          const updateKeys = Object.keys(updates)
          const disallowedFields = updateKeys.filter(key => !allowedFields.includes(key))
          
          if (disallowedFields.length > 0) {
            throw new Error(`Unauthorized - Clients can only update status and password for Gmail accounts. Cannot update: ${disallowedFields.join(', ')}`)
          }
        } else {
          // Pearson Vue accounts - only admins can update
          throw new Error('Unauthorized - Only admins can update Pearson Vue accounts')
        }
      }
    } else {
      // For custom accounts:
      // - Users can update their own custom accounts (but not status if it's a system account)
      // - Admins can update any account
      if (!admin) {
        // Check if user owns the application
        const customApplicationId = accountData.application_id
        if (!customApplicationId) {
          throw new Error('Application ID not found')
        }
        const { data: application } = await supabase
          .from('applications')
          .select('user_id')
          .eq('id', customApplicationId)
          .single()
        
        const appData = application as { user_id?: string } | null
        if (!appData || appData.user_id !== userId) {
          throw new Error('Unauthorized - You can only update accounts for your own applications')
        }
        
        // Users can update their custom accounts, but status changes should be limited
        // (This is already handled since we're in the else block for custom accounts)
      }
    }
    
    const { data, error } = await supabase
      .from('processing_accounts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data as Tables<'processing_accounts'>
  },

  delete: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }
    
    const { error } = await supabase
      .from('processing_accounts')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Clients API
export const clientsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(error.message || 'Failed to fetch clients')
    }
    
    return data || []
  },

  // Get clients with their GritSync Gmail accounts
  // gritsync_email is stored directly on the users table
  getAllWithGmailAccounts: async () => {
    const clients = await clientsAPI.getAll()
    return clients.map((client: any) => ({
      ...client,
      gmail_account: client.gritsync_email || client.email,
    }))
  },

  // Admin impersonation - login as user
  loginAsUser: async (userId: string) => {
    // This will be handled by a server endpoint that uses Supabase Admin API
    // For now, we'll use a direct approach with Supabase
    try {
      // Get the user's email from the database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      
      if (userError || !userData) {
        throw new Error('User not found')
      }

      // Use Supabase Admin API via a serverless function or direct call
      // Since we can't use admin API directly from client, we'll need a server endpoint
      // For now, return the user email so we can attempt to sign in
      // Note: This requires the user's password, which we don't have
      // We need a server endpoint that uses service role key
      throw new Error('Admin impersonation requires server-side implementation')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to login as user')
    }
  },
}

// Dashboard API
export const dashboardAPI = {
  getStats: async () => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    const mapStats = (row: any) => ({
      totalApplications: row?.total_applications ?? row?.applications ?? 0,
      pendingApplications: row?.pending_applications ?? row?.pending ?? 0,
      completedApplications: row?.completed_applications ?? row?.completed ?? 0,
      rejectedApplications: row?.rejected_applications ?? 0,
      totalQuotations: row?.total_quotations ?? row?.quotations ?? 0,
      pendingQuotations: row?.pending_quotations ?? 0,
      paidQuotations: row?.paid_quotations ?? 0,
      totalClients: row?.total_clients ?? 0,
      revenue: Number(row?.revenue ?? 0),
      applications: row?.total_applications ?? row?.applications ?? 0,
      pending: row?.pending_applications ?? row?.pending ?? 0,
      completed: row?.completed_applications ?? row?.completed ?? 0,
      quotations: row?.total_quotations ?? row?.quotations ?? 0,
    })
    
    // Use Supabase RPC for aggregated stats when available; fallback to legacy queries
    if (admin) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats', { is_admin: true })
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        return mapStats(rpcData[0])
      }
      // RPC unavailable in this environment — silently fall through to direct queries

      // Admin stats - comprehensive system-wide statistics (fallback path)
      const [
        applications,
        pendingApps,
        completedApps,
        rejectedApps,
        quotations,
        pendingQuotes,
        paidQuotes,
        users,
        payments
      ] = await Promise.all([
        supabase.from('applications').select('*', { count: 'exact', head: true }),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('quotations').select('*', { count: 'exact', head: true }),
        supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('application_payments').select('amount', { count: 'exact' }).eq('status', 'paid'),
      ])
      
      // Check for errors in queries
      if (completedApps.error) {
        logError(normalizeError(completedApps.error, { operation: 'dashboardAPI.getStats', context: 'fetch_completed_apps' }), { operation: 'dashboardAPI.getStats', context: 'fetch_completed_apps' })
      }
      
      // Fallback: If count queries fail, fetch all and count manually
      let completedCount = completedApps.count ?? 0
      
      // If counts are 0 but we suspect there might be data, do a manual count as fallback
      if (completedCount === 0) {
        const { data: allApps, error: allAppsError } = await supabase
          .from('applications')
          .select('id, status')
        
        if (!allAppsError && allApps) {
          const manualCompletedCount = allApps.filter((app: any) => 
            app.status === 'completed' || app.status === 'Completed'
          ).length
          if (manualCompletedCount > 0) {
            completedCount = manualCompletedCount
          }
        }
      }
      
      // Also check for applications that are completed based on timeline steps
      // (applications with nclex_exam or quick_results steps completed)
      // This handles cases where status might not be 'completed' but the exam is done
      // Get all applications to check for timeline-based completion
      const { data: allApps, error: allAppsError } = await supabase
        .from('applications')
        .select('id, status')
      
      let timelineCompletedAppIds = new Set<string>()
      
      if (!allAppsError && allApps && allApps.length > 0) {
        // Find applications that are not already marked as completed
        const appIdsToCheck = allApps
          .filter((app: any) => {
            const status = app.status?.toLowerCase()
            return status !== 'completed' && status !== 'rejected'
          })
          .map((app: any) => app.id)
        
        if (appIdsToCheck.length > 0) {
          // Check for completed nclex_exam or quick_results steps
          const { data: completedSteps, error: stepsError } = await supabase
            .from('application_timeline_steps')
            .select('application_id')
            .in('application_id', appIdsToCheck)
            .in('step_key', ['nclex_exam', 'quick_results'])
            .eq('status', 'completed')
          
          if (!stepsError && completedSteps && completedSteps.length > 0) {
            // Get unique application IDs with completed exam steps
            timelineCompletedAppIds = new Set(completedSteps.map((s: any) => s.application_id))
            const timelineCompletedCount = timelineCompletedAppIds.size
            if (timelineCompletedCount > 0) {
              completedCount += timelineCompletedCount
            }
          }
        }
      }
      
      // Adjust pending count: exclude applications that are completed (by status or timeline)
      let pendingCount = pendingApps.count ?? 0
      if (timelineCompletedAppIds.size > 0) {
        // Check how many of the timeline-completed apps are currently counted as pending
        const { data: pendingAppsData } = await supabase
          .from('applications')
          .select('id')
          .eq('status', 'pending')
        
        if (pendingAppsData) {
          const pendingAppIds = new Set(pendingAppsData.map((app: any) => app.id))
          // Count how many timeline-completed apps are in the pending list
          const pendingButCompleted = Array.from(timelineCompletedAppIds).filter(id => pendingAppIds.has(id)).length
          if (pendingButCompleted > 0) {
            pendingCount = Math.max(0, pendingCount - pendingButCompleted)
          }
        }
      }
      
      // Calculate revenue from payments
      let revenue = 0
      if (payments.data) {
        revenue = payments.data.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0)
      }
      
      const totalCompleted = completedCount
      
      return {
        totalApplications: applications.count || 0,
        pendingApplications: pendingCount,
        completedApplications: totalCompleted,
        rejectedApplications: rejectedApps.count || 0,
        totalQuotations: quotations.count || 0,
        pendingQuotations: pendingQuotes.count || 0,
        paidQuotations: paidQuotes.count || 0,
        totalClients: users.count || 0,
        revenue: revenue,
        applications: applications.count || 0,
        pending: pendingCount,
        completed: totalCompleted,
        quotations: quotations.count || 0,
      }
    } else {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats', { is_admin: false })
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        return mapStats(rpcData[0])
      }
      // RPC unavailable in this environment — silently fall through to direct queries

      // Client stats (fallback path)
      const [applications, quotations, payments] = await Promise.all([
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('application_payments').select('amount', { count: 'exact' }).eq('user_id', userId).eq('status', 'paid'),
      ])
      
      // Calculate revenue from user's payments
      let revenue = 0
      if (payments.data) {
        revenue = payments.data.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0)
      }
      
      // Get completed counts for client
      // We need to check both status and timeline steps to determine completion
      const [, allUserApps] = await Promise.all([
        supabase.from('applications').select('id', { count: 'exact' }).eq('user_id', userId).eq('status', 'completed'),
        supabase.from('applications').select('id, status').eq('user_id', userId),
      ])
      
      // Count applications with status 'completed'
      // Use a Set to avoid double counting
      const statusCompletedAppIds = new Set<string>()
      const typedAllUserApps = allUserApps.data as Array<{ id?: string; status?: string }> | null
      if (typedAllUserApps) {
        typedAllUserApps.forEach((app: any) => {
          if (app.status === 'completed' || app.status === 'Completed') {
            statusCompletedAppIds.add(app.id)
          }
        })
      }
      let completedCount = statusCompletedAppIds.size
      
      // Also check for applications that are completed based on timeline steps
      // (applications with nclex_exam or quick_results steps completed)
      // This handles cases where status might not be 'completed' but the exam is done
      // Only count apps that are NOT already counted as completed by status
      if (allUserApps.data && allUserApps.data.length > 0) {
        const appIdsToCheck = allUserApps.data
          .filter((app: any) => !statusCompletedAppIds.has(app.id))
          .map((app: any) => app.id)
        
        if (appIdsToCheck.length > 0) {
          // Check for completed nclex_exam or quick_results steps
          const { data: completedSteps } = await supabase
            .from('application_timeline_steps')
            .select('application_id')
            .in('application_id', appIdsToCheck)
            .in('step_key', ['nclex_exam', 'quick_results'])
            .eq('status', 'completed')
          
          if (completedSteps && completedSteps.length > 0) {
            // Count unique applications with completed exam steps
            // Only count apps that aren't already counted
            const uniqueCompletedAppIds = new Set(completedSteps.map((s: any) => s.application_id))
            uniqueCompletedAppIds.forEach((appId: string) => {
              if (!statusCompletedAppIds.has(appId)) {
                completedCount++
              }
            })
          }
        }
      }
      
      const totalCompleted = completedCount
      
      return {
        totalApplications: applications.count || 0,
        totalQuotations: quotations.count || 0,
        applications: applications.count || 0,
        quotations: quotations.count || 0,
        completed: totalCompleted,
        completedApplications: totalCompleted,
        revenue: revenue,
      }
    }
  },
}

// Admin API
export const adminAPI = {
  getStats: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    return dashboardAPI.getStats()
  },
  
  getSettings: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    const { data, error } = await supabase
      .from('settings')
      .select('*')
    
    if (error) throw new Error(error.message)
    
    // Convert array to object
    const settings: Record<string, string> = {}
    ;(data as unknown as Array<{ key: string; value: string }> | null)?.forEach(setting => {
      settings[setting.key] = setting.value
    })
    
    return settings
  },
  
  saveSettings: async (settings: Record<string, any>) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    const entries = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
    }))
    
    const { error } = await supabase
      .from('settings')
      .upsert(entries, { onConflict: 'key' })
    
    if (error) throw new Error(error.message)
  },

  fetchUsdToPhpRate: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }

    try {
      // Use exchangerate-api.com free tier (no API key required for USD to PHP)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rate')
      }
      
      const data = await response.json()
      const phpRate = data.rates?.PHP
      
      if (!phpRate || typeof phpRate !== 'number') {
        throw new Error('Invalid exchange rate data')
      }

      // Update the setting in database
      await adminAPI.saveSettings({ usdToPhpRate: phpRate.toFixed(2) })
      
      return phpRate
    } catch (error: any) {
      throw normalizeError(error, { operation: 'adminAPI.fetchUsdToPhpRate', context: 'exchange_rate_fetch' })
    }
  },

  getUsdToPhpRate: async () => {
    try {
      // Get settings (this will work for all users, but only admins can modify)
      const { data, error } = await supabase
        .from('settings')
        .select('*')
      
      if (error) throw new Error(error.message)
      
      // Convert array to object
      const settings: Record<string, string> = {}
      ;(data as unknown as Array<{ key: string; value: string }> | null)?.forEach(setting => {
        settings[setting.key] = setting.value
      })

      const mode = settings.usdToPhpMode || 'manual'
      let rate = parseFloat(settings.usdToPhpRate || '56.00')

      // If automatic mode, try to fetch latest rate
      if (mode === 'automatic') {
        try {
          const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
          if (response.ok) {
            const data = await response.json()
            const phpRate = data.rates?.PHP
            if (phpRate && typeof phpRate === 'number') {
              rate = phpRate
              // Update the setting in background (only if admin)
              const isAdminUser = await isAdmin()
              if (isAdminUser) {
                adminAPI.saveSettings({ usdToPhpRate: phpRate.toFixed(2) }).catch(() => {
                  // Silently fail if update fails
                })
              }
            }
          }
        } catch (error) {
          // If fetch fails, use stored rate
        }
      }

      return rate
    } catch (error: any) {
      logError(normalizeError(error, { operation: 'adminAPI.getUsdToPhpRate' }), { operation: 'adminAPI.getUsdToPhpRate' })
      // Return default rate if error
      return 56.00
    }
  },

  // Notification Types Management
  getNotificationTypes: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    try {
      const { data, error } = await supabase
        .from('notification_types')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) {
        // If table doesn't exist, return empty array (migration not run)
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          logError(normalizeError(new Error('notification_types table does not exist. Run migration: create_notification_types_table.sql'), { operation: 'notificationsAPI.getNotificationTypes', context: 'missing_table' }), { operation: 'notificationsAPI.getNotificationTypes', context: 'missing_table', severity: 'low' })
          return []
        }
        throw new Error(error.message)
      }
      return data || []
    } catch (error: any) {
      // Handle case where table doesn't exist
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        logError(normalizeError(new Error('notification_types table does not exist. Run migration: create_notification_types_table.sql'), { operation: 'notificationsAPI.getNotificationTypes', context: 'missing_table' }), { operation: 'notificationsAPI.getNotificationTypes', context: 'missing_table', severity: 'low' })
        return []
      }
      throw error
    }
  },

  createNotificationType: async (notification: {
    key: string
    name: string
    description?: string
    category: 'email' | 'reminder' | 'greeting' | 'system'
    enabled?: boolean
    default_enabled?: boolean
    config?: Record<string, any>
    icon?: string
    sort_order?: number
  }) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    const { data, error } = await supabase
      .from('notification_types')
      .insert({
        ...notification,
        enabled: notification.enabled ?? true,
        default_enabled: notification.default_enabled ?? true,
        config: notification.config || {},
        sort_order: notification.sort_order ?? 0,
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return (data as unknown) as Tables<'notifications'> | null
  },

  updateNotificationType: async (id: string, updates: {
    name?: string
    description?: string
    enabled?: boolean
    default_enabled?: boolean
    config?: Record<string, any>
    icon?: string
    sort_order?: number
  }) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    const { data, error } = await supabase
      .from('notification_types')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return (data as unknown) as Tables<'notification_types'>
  },

  deleteNotificationType: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized')
    }
    
    const { error } = await supabase
      .from('notification_types')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Application Payments API
// Helper function to calculate GritSync service fee based on payment type
// This is the portion that promo codes can discount
const calculateServiceFee = (paymentType: 'step1' | 'step2' | 'full'): number => {
  const FULL_SERVICE_FEE = 150.00
  
  switch(paymentType) {
    case 'full':
      return FULL_SERVICE_FEE
    case 'step1':
    case 'step2':
      return FULL_SERVICE_FEE / 2 // $75 per step
    default:
      return FULL_SERVICE_FEE
  }
}

export const applicationPaymentsAPI = {
  getAll: async () => {
    const { userId, isAdmin: admin } = await getCurrentUserInfo()
    const query = supabase
      .from('application_payments')
      .select('*')
      .order('created_at', { ascending: false })
    if (!admin) {
      // Join through applications to filter by user
      const { data: apps } = await supabase
        .from('applications')
        .select('id')
        .eq('user_id', userId)
      const appIds = (apps || []).map((a: any) => a.id)
      if (appIds.length === 0) return []
      query.in('application_id', appIds)
    }
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  checkRetaker: async () => {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()
    
    if (error) throw new Error(error.message)
    return { isRetaker: !!data }
  },

  create: async (applicationId: string, paymentType: 'step1' | 'step2' | 'full', amount: number) => {
    // Invalidate payment cache when creating new payment
    try {
      const { invalidateApplicationCache } = await import('./query-cache')
      invalidateApplicationCache(applicationId)
    } catch {
      // Cache module might not be available, continue anyway
    }
    
    const currentUserId = await getCurrentUserId()
    
    // Resolve application ID (could be grit_app_id or UUID)
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(applicationId)
    
    let actualApplicationId = applicationId
    let applicationOwnerId: string | undefined = undefined
    
    if (isGritAppId) {
      // Look up the application by grit_app_id to get the UUID
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id, user_id')
        .eq('grit_app_id', applicationId.toUpperCase())
        .single()
      
      if (appError || !application) {
        throw new Error(appError?.message || 'Application not found')
      }
      
      // Get application owner's user_id
      const appData = application as { user_id?: string }
      applicationOwnerId = appData.user_id
      
      // Check if user owns the application or is admin
      if (appData.user_id !== currentUserId) {
        const admin = await isAdmin()
        if (!admin) {
          throw new Error('Unauthorized')
        }
      }
      
      const typedApp = application as { id?: string }
      actualApplicationId = typedApp.id || ''
    } else {
      // For UUID, fetch application to get user_id
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id, user_id')
        .eq('id', applicationId)
        .single()
      
      if (appError || !application) {
        throw new Error(appError?.message || 'Application not found')
      }
      
      const appData = application as { user_id?: string }
      applicationOwnerId = appData.user_id
      
      // Check if user owns the application or is admin
      if (appData.user_id !== currentUserId) {
        const admin = await isAdmin()
        if (!admin) {
          throw new Error('Unauthorized')
        }
      }
    }
    
    // Use application owner's user_id (not admin's user_id) so client can see the payment
    const paymentUserId = applicationOwnerId || currentUserId
    
    // Calculate service fee amount for this payment type
    const serviceFeeAmount = calculateServiceFee(paymentType)
    
    const { data, error } = await supabase
      .from('application_payments')
      .insert({
        application_id: actualApplicationId,
        user_id: paymentUserId, // Use application owner's user_id, not admin's
        payment_type: paymentType,
        amount,
        service_fee_amount: serviceFeeAmount,
        status: 'pending',
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return (data as unknown) as Tables<'application_payments'>
  },


  createPaymentIntent: async (paymentId: string) => {
    const token = localStorage.getItem('gritsync_token')
    const res = await fetch('/api/payments/create-application-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ payment_id: paymentId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create payment intent')
    return {
      clientSecret: data.clientSecret || data.client_secret,
      paymentIntentId: data.paymentIntentId || data.payment_intent_id,
    }
  },

  complete: async (
    paymentId: string, 
    transactionId?: string, 
    stripePaymentIntentId?: string,
    paymentMethod: 'stripe' | 'gcash' | 'mobile_banking' = 'stripe',
    gcashDetails?: { number: string; reference: string },
    proofOfPaymentFile?: File
  ) => {
    // Allow public access for checkout (payment can be completed by anyone with the link)
    // Fetch payment data BEFORE update to avoid RLS issues after update
    // This ensures we have the data needed for receipt creation
    let userId: string | undefined
    let originalPaymentData: any = null
    
    try {
      userId = await getCurrentUserId()
    } catch {
      // User not authenticated, proceed as public user
    }
    
    // Fetch payment data before update (needed for receipt creation and to get user_id)
    try {
      const { data: paymentData, error: fetchError } = await supabase
        .from('application_payments')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle()
      
      if (paymentData) {
        originalPaymentData = paymentData
        const typedPayment = paymentData as { user_id?: string }
        userId = typedPayment.user_id || userId
      } else if (fetchError && !userId) {
        // If we can't fetch and no userId, try minimal fetch for user_id only
        const { data: minimalData } = await supabase
          .from('application_payments')
          .select('user_id')
          .eq('id', paymentId)
          .maybeSingle()
        
        if (minimalData) {
          const typedMinimal = minimalData as { user_id?: string }
          userId = typedMinimal.user_id
        }
      }
    } catch (err) {
      // If fetch fails completely, continue with update anyway
      // We'll create minimal payment data for receipt if needed
    }
    
    // Upload proof of payment file if provided (for mobile banking)
    let proofOfPaymentFilePath: string | undefined
    if (proofOfPaymentFile) {
      try {
        // Validate file before upload
        if (!proofOfPaymentFile.name || proofOfPaymentFile.size === 0) {
          throw new Error('Invalid file: File appears to be empty or corrupted')
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024
        if (proofOfPaymentFile.size > maxSize) {
          throw new Error('File size exceeds 10MB limit')
        }

        // Simple upload - no compression or processing
        const fileExt = (proofOfPaymentFile.name.split('.').pop() || '').toLowerCase()
        const fileName = `proof_of_payment_${paymentId}_${Date.now()}.${fileExt}`
        // Use paymentId as folder if userId is not available (public checkout)
        const filePath = userId ? `${userId}/payments/${fileName}` : `public/payments/${fileName}`

        // Determine correct MIME type from file extension (more reliable than File.type)
        let contentType = proofOfPaymentFile.type
        if (!contentType || contentType === 'application/octet-stream' || contentType === 'application/json') {
          // Fallback: detect MIME type from file extension
          const mimeTypes: { [key: string]: string } = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'pdf': 'application/pdf',
          }
          contentType = mimeTypes[fileExt] || 'application/octet-stream'
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if (!allowedTypes.includes(contentType)) {
          throw new Error(`Unsupported file type: ${contentType}. Please upload JPG, PNG, WebP, or PDF files.`)
        }

        console.log('🔧 PROOF OF PAYMENT UPLOAD v5.0 (BINARY ARRAYBUFFER - NO JSON) 🔧')
        console.log('Uploading proof of payment:', {
          fileName,
          fileSize: proofOfPaymentFile.size,
          originalType: proofOfPaymentFile.type,
          detectedType: contentType,
          fileExtension: fileExt,
          filePath
        })

        // Convert File to Blob with explicit type
        const arrayBuffer = await proofOfPaymentFile.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: contentType })
        
        console.log('Created Blob (Supabase will auto-detect from Blob.type):', {
          blobSize: blob.size,
          blobType: blob.type,
          originalFileSize: proofOfPaymentFile.size,
          note: 'NOT setting contentType explicitly - letting Blob.type be used'
        })

        // Try REST API upload as workaround for SDK contentType issue
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          
          if (!token) {
            throw new Error('No authentication token available')
          }

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          const uploadUrl = `${supabaseUrl}/storage/v1/object/documents/${filePath}`
          
          console.log('Uploading via REST API:', {
            url: uploadUrl,
            blobType: blob.type,
            blobSize: blob.size
          })

          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': blob.type,  // Set as request header
              'x-upsert': 'false',
            },
            body: blob
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('REST API upload error:', response.status, errorText)
            throw new Error(`Upload failed: ${response.status} ${errorText}`)
          }

          console.log('REST API upload successful!', await response.json())
        } catch (restError: any) {
          console.error('REST API upload failed, falling back to SDK:', restError)
          
          // Fallback to SDK method
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, blob, {
              cacheControl: '3600',
              upsert: false,
            })

          if (uploadError) {
            console.error('SDK upload error:', uploadError)
            throw new Error(`Failed to upload proof of payment: ${uploadError.message}`)
          }
        }
        
        console.log('Proof of payment uploaded successfully:', filePath, '| Blob.type was:', blob.type, '| Should auto-detect in Supabase')
        proofOfPaymentFilePath = filePath
      } catch (uploadErr: any) {
        console.error('Proof of payment upload failed:', uploadErr)
        throw new Error(`Upload failed: ${uploadErr.message || 'Unknown error'}`)
      }
    }
    
    // Determine payment status based on payment method
    let paymentStatus: 'paid' | 'pending_approval' = 'paid'
    if (paymentMethod === 'gcash' || paymentMethod === 'mobile_banking') {
      paymentStatus = 'pending_approval' // Manual verification required
    }
    
    // Update payment record
    // Note: Don't manually set updated_at - it's handled by database trigger
    const updatePayload: any = {
      status: paymentStatus,
      payment_method: paymentMethod,
    }
    
    if (transactionId) {
      updatePayload.transaction_id = transactionId
    }
    
    if (stripePaymentIntentId) {
      updatePayload.stripe_payment_intent_id = stripePaymentIntentId
    }
    
    if (proofOfPaymentFilePath) {
      updatePayload.proof_of_payment_file_path = proofOfPaymentFilePath
    }
    
    // Add GCash details ONLY if payment method is explicitly 'gcash'
    // Note: These columns need to exist in the database (run migration: add-gcash-columns-to-payments.sql)
    // For mobile_banking, we don't use GCash fields - only proof_of_payment_file_path
    if (paymentMethod === 'gcash' && gcashDetails && gcashDetails.number && gcashDetails.reference) {
      updatePayload.gcash_number = gcashDetails.number
      updatePayload.gcash_reference = gcashDetails.reference
    }
    
    // Log the update payload for debugging (without sensitive data)
    console.log('Updating payment with payload:', {
      paymentId,
      status: updatePayload.status,
      payment_method: updatePayload.payment_method,
      hasTransactionId: !!updatePayload.transaction_id,
      hasStripeIntentId: !!updatePayload.stripe_payment_intent_id,
      hasProofOfPayment: !!updatePayload.proof_of_payment_file_path,
      hasGcashDetails: !!updatePayload.gcash_number,
    })
    
    // Update payment record
    // Don't select after update to avoid RLS 406 errors - update and fetch separately
    const { error: updateError } = await supabase
      .from('application_payments')
      .update(updatePayload)
      .eq('id', paymentId)
    
    if (updateError) {
      console.error('Payment update error:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        payload: updatePayload,
      })
      throw new Error(`Failed to update payment: ${updateError.message || updateError.details || 'Unknown error'}`)
    }
    
    // Use original payment data merged with update payload (avoids RLS fetch after update)
    // This prevents 406 errors from trying to fetch after update
    let paymentData: any = null
    if (originalPaymentData) {
      // Merge update payload into original data
      paymentData = {
        ...originalPaymentData,
        ...updatePayload,
      }
    } else {
      // Fallback: create minimal payment object if we couldn't fetch original
      paymentData = {
        id: paymentId,
        application_id: undefined,
        amount: undefined,
        payment_type: undefined,
        status: updatePayload.status,
        payment_method: updatePayload.payment_method,
        user_id: userId,
      } as any
    }
    
    // Invalidate payment cache
    try {
      const { invalidateApplicationCache } = await import('./query-cache')
      const typedPayment = paymentData as { application_id?: string }
      if (typedPayment.application_id) {
        invalidateApplicationCache(typedPayment.application_id)
      }
    } catch {
      // Cache module might not be available, continue anyway
    }
    
    // RECEIPT AND EMAIL FLOW:
    // 1. Stripe payments (credit card): Create receipt and send email immediately upon payment success
    // 2. Mobile banking/GCash: Receipt and email will be created/sent only after admin approval
    //    (See approvePayment function for mobile banking/GCash receipt creation)
    if (paymentMethod === 'stripe' && paymentData) {
      try {
        const typedPayment = paymentData as { 
          application_id?: string
          amount?: number
          payment_type?: string
        }
        
        // Generate receipt
        const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        
        // Get user_id from payment if not available
        let receiptUserId = userId
        if (!receiptUserId) {
          const typedPaymentWithUserId = paymentData as { user_id?: string }
          receiptUserId = typedPaymentWithUserId.user_id
        }
        
        // Try to fetch service details for proper line items
        let receiptItems: Array<{ name: string; amount: number }> = [
          {
            name: `NCLEX Application Processing (${typedPayment.payment_type})`,
            amount: typedPayment.amount,
          },
        ]
        
        if (typedPayment.application_id) {
          try {
            // Fetch application to get service details
            const { data: appData } = await supabase
              .from('applications')
              .select('application_type, province, payment_type')
              .eq('id', typedPayment.application_id)
              .single()
            
            if (appData) {
              const serviceName = 'NCLEX Processing'
              const serviceState = appData.province || 'New York'
              const dbPaymentType = appData.payment_type || typedPayment.payment_type
              const servicePaymentType = (dbPaymentType === 'full' ? 'full' : 'staggered') as 'full' | 'staggered'
              
              // Fetch service to get line items
              const { servicesAPI } = await import('./api')
              const service = await servicesAPI.getByServiceStateAndPaymentType(serviceName, serviceState, servicePaymentType)
              
              if (service && service.line_items) {
                // Filter line items based on payment type
                let filteredItems: any[] = []
                if (typedPayment.payment_type === 'step1' && servicePaymentType === 'staggered') {
                  filteredItems = (service.line_items as any[]).filter((item: any) => item.step === 1 || !item.step)
                } else if (typedPayment.payment_type === 'step2' && servicePaymentType === 'staggered') {
                  filteredItems = (service.line_items as any[]).filter((item: any) => item.step === 2)
                } else if (typedPayment.payment_type === 'full') {
                  filteredItems = service.line_items as any[]
                }
                
                if (filteredItems.length > 0) {
                  receiptItems = filteredItems.map((item: any) => ({
                    name: item.description || item.name || 'Service Item',
                    amount: item.amount || 0,
                  }))
                }
              }
            }
          } catch (serviceError) {
            // If service fetch fails, use default items
            console.warn('Failed to fetch service details for receipt items:', serviceError)
          }
        }
        
        const { data: receipt, error: receiptError } = await supabase
          .from('receipts')
          .insert({
            payment_id: paymentId,
            application_id: typedPayment.application_id,
            user_id: receiptUserId,
            receipt_number: receiptNumber,
            amount: typedPayment.amount,
            payment_type: typedPayment.payment_type,
            items: receiptItems,
          })
          .select('*')
          .single()
        
        if (receiptError) {
          console.error('Failed to create receipt:', receiptError)
          // Don't throw error, payment is still complete
        } else if (receipt) {
          // Send email with PDF attachments asynchronously (don't wait for it)
          try {
            // Fetch application and user data for email
            let applicationData: any = null
            let userData: any = null
            
            if (typedPayment.application_id) {
              const { data: appData } = await supabase
                .from('applications')
                .select('id, first_name, last_name, email, mobile_number, province, city, country, zipcode')
                .eq('id', typedPayment.application_id)
                .single()
              applicationData = appData
            }
            
            if (receiptUserId) {
              const { data: uData } = await supabase
                .from('users')
                .select('id, email, full_name, first_name, last_name')
                .eq('id', receiptUserId)
                .single()
              userData = uData
            }
            
            // Send email with attachments (fire and forget)
            const { sendPaymentReceiptEmailWithAttachments } = await import('./payment-email')
            sendPaymentReceiptEmailWithAttachments({
              receipt: receipt as any,
              payment: payment as any,
              application: applicationData,
              user: userData,
            }).catch((emailError) => {
              console.error('Error sending payment receipt email:', emailError)
              // Don't throw - email failure shouldn't fail payment
            })
          } catch (emailErr) {
            console.error('Error preparing payment receipt email:', emailErr)
            // Don't throw - email failure shouldn't fail payment
          }
        }
        
        return { payment: paymentData, receipt }
      } catch (receiptErr) {
        console.error('Receipt generation error:', receiptErr)
        return { payment: paymentData }
      }
    }
    
    return { payment: paymentData }
  },

  getByApplication: async (applicationId: string) => {
    // Resolve application ID (could be grit_app_id or UUID)
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(applicationId)
    
    let query = supabase
      .from('application_payments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (isGritAppId) {
      // First get the application UUID from grit_app_id
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id')
        .eq('grit_app_id', applicationId.toUpperCase())
        .single()
      
      if (appError || !application) {
        throw new Error(appError?.message || 'Application not found')
      }
      
      const typedApp = application as { id?: string }
      query = query.eq('application_id', typedApp.id || '')
    } else {
      query = query.eq('application_id', applicationId)
    }
    
    const { data, error } = await query
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getReceipt: async (paymentId: string) => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('payment_id', paymentId)
      .single()
    
    if (error) {
      // If receipt doesn't exist, return null instead of throwing
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(error.message)
    }
    
    return data
  },

  getPendingApproval: async () => {
    const { data, error } = await supabase
      .from('application_payments')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },

  approvePayment: async (paymentId: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }
    
    // Get current USD to PHP rate for GCash/mobile banking payments
    const { data: payment, error: fetchError } = await supabase
      .from('application_payments')
      .select('payment_method, amount')
      .eq('id', paymentId)
      .single()
    
    if (fetchError) {
      throw new Error(`Failed to fetch payment: ${fetchError.message}`)
    }
    
    const updatePayload: any = {
      status: 'paid',
      updated_at: new Date().toISOString(),
    }
    
    // For GCash and mobile banking payments, fetch USD to PHP rate
    if (payment && (payment.payment_method === 'gcash' || payment.payment_method === 'mobile_banking')) {
      try {
        const { adminAPI } = await import('./api')
        const rate = await adminAPI.getUsdToPhpRate()
        updatePayload.usd_to_php_rate = rate
      } catch (rateError) {
        // If rate fetch fails, continue without it
        console.warn('Failed to fetch USD to PHP rate:', rateError)
      }
    }
    
    const { data: updatedPayment, error: updateError } = await supabase
      .from('application_payments')
      .update(updatePayload)
      .eq('id', paymentId)
      .select('*')
      .single()
    
    if (updateError) {
      throw new Error(`Failed to approve payment: ${updateError.message}`)
    }
    
    // RECEIPT AND EMAIL FLOW FOR MANUAL PAYMENTS:
    // When admin approves a mobile banking or GCash payment, create receipt and send email
    // This is the second instance of receipt sending (first is for Stripe in complete function)
    // Create receipt for approved payment if it doesn't exist
    if (updatedPayment) {
      const typedPayment = updatedPayment as { 
        id?: string
        application_id?: string
        amount?: number
        payment_type?: string
        user_id?: string
      }
      
      // Check if receipt already exists
      const { data: existingReceipt } = await supabase
        .from('receipts')
        .select('id')
        .eq('payment_id', paymentId)
        .maybeSingle()
      
      if (!existingReceipt && typedPayment.id) {
        try {
          const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
          
          // Try to fetch service details for proper line items
          let receiptItems: Array<{ name: string; amount: number }> = [
            {
              name: `NCLEX Application Processing (${typedPayment.payment_type})`,
              amount: typedPayment.amount,
            },
          ]
          
          if (typedPayment.application_id) {
            try {
              // Fetch application to get service details
              const { data: appData } = await supabase
                .from('applications')
                .select('application_type, province, payment_type')
                .eq('id', typedPayment.application_id)
                .single()
              
              if (appData) {
                const serviceName = 'NCLEX Processing'
                const serviceState = appData.province || 'New York'
                const dbPaymentType = appData.payment_type || typedPayment.payment_type
                const servicePaymentType = (dbPaymentType === 'full' ? 'full' : 'staggered') as 'full' | 'staggered'
                
                // Fetch service to get line items
                const { servicesAPI } = await import('./api')
                const service = await servicesAPI.getByServiceStateAndPaymentType(serviceName, serviceState, servicePaymentType)
                
                if (service && service.line_items) {
                  // Filter line items based on payment type
                  let filteredItems: any[] = []
                  if (typedPayment.payment_type === 'step1' && servicePaymentType === 'staggered') {
                    filteredItems = (service.line_items as any[]).filter((item: any) => item.step === 1 || !item.step)
                  } else if (typedPayment.payment_type === 'step2' && servicePaymentType === 'staggered') {
                    filteredItems = (service.line_items as any[]).filter((item: any) => item.step === 2)
                  } else if (typedPayment.payment_type === 'full') {
                    filteredItems = service.line_items as any[]
                  }
                  
                  if (filteredItems.length > 0) {
                    receiptItems = filteredItems.map((item: any) => ({
                      name: item.description || item.name || 'Service Item',
                      amount: item.amount || 0,
                    }))
                    // Calculate tax for taxable items
                    const TAX_RATE = 0.12
                    const subtotal = receiptItems.reduce((sum, item) => sum + item.amount, 0)
                    const tax = filteredItems.reduce((sum: number, item: any) => {
                      return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
                    }, 0)
                    const total = subtotal + tax
                    
                    // If total doesn't match payment amount, adjust the last item
                    if (Math.abs(total - typedPayment.amount) > 0.01) {
                      const difference = typedPayment.amount - total
                      if (receiptItems.length > 0) {
                        receiptItems[receiptItems.length - 1].amount += difference
                      }
                    }
                  }
                }
              }
            } catch (serviceError) {
              // If service fetch fails, use default items
              console.warn('Failed to fetch service details for receipt items:', serviceError)
            }
          }
          
          const { data: receipt, error: receiptError } = await supabase
            .from('receipts')
            .insert({
              payment_id: typedPayment.id,
              application_id: typedPayment.application_id,
              user_id: typedPayment.user_id,
              receipt_number: receiptNumber,
              amount: typedPayment.amount,
              payment_type: typedPayment.payment_type,
              items: receiptItems,
            })
            .select('*')
            .single()
          
          if (receiptError) {
            console.error('Failed to create receipt:', receiptError)
            // Don't throw error, payment is still approved
          } else if (receipt) {
            // Send email with PDF attachments asynchronously (don't wait for it)
            try {
              // Fetch application and user data for email
              let applicationData: any = null
              let userData: any = null
              
              if (typedPayment.application_id) {
                const { data: appData } = await supabase
                  .from('applications')
                  .select('id, first_name, last_name, email, mobile_number, province, city, country, zipcode')
                  .eq('id', typedPayment.application_id)
                  .single()
                applicationData = appData
              }
              
              if (typedPayment.user_id) {
                const { data: uData } = await supabase
                  .from('users')
                  .select('id, email, full_name, first_name, last_name')
                  .eq('id', typedPayment.user_id)
                  .single()
                userData = uData
              }
              
              // Send email with attachments (fire and forget)
              const { sendPaymentReceiptEmailWithAttachments } = await import('./payment-email')
              sendPaymentReceiptEmailWithAttachments({
                receipt: receipt as any,
                payment: updatedPayment as any,
                application: applicationData,
                user: userData,
              }).catch((emailError) => {
                console.error('Error sending payment receipt email:', emailError)
                // Don't throw - email failure shouldn't fail payment approval
              })
            } catch (emailErr) {
              console.error('Error preparing payment receipt email:', emailErr)
              // Don't throw - email failure shouldn't fail payment approval
            }
          }
        } catch (receiptErr) {
          console.error('Receipt generation error:', receiptErr)
        }
      }
    }
    
    // Invalidate payment cache
    try {
      const { invalidateApplicationCache } = await import('./query-cache')
      const typedPayment = updatedPayment as { application_id?: string }
      if (typedPayment.application_id) {
        invalidateApplicationCache(typedPayment.application_id)
      }
    } catch {
      // Cache module might not be available, continue anyway
    }
    
    return updatedPayment
  },

  rejectPayment: async (paymentId: string, reason?: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }
    
    // First, fetch the payment to get its details
    const { data: existingPayment, error: fetchError } = await supabase
      .from('application_payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    
    if (fetchError) throw new Error(fetchError.message)
    if (!existingPayment) throw new Error('Payment not found')
    
    const payment = existingPayment as any
    
    // Update the rejected payment
    const updatePayload: any = {
      status: 'failed',
      updated_at: new Date().toISOString(),
    }
    
    if (reason) {
      updatePayload.admin_note = reason
    }
    
    const { error: updateError } = await supabase
      .from('application_payments')
      .update(updatePayload)
      .eq('id', paymentId)
    
    if (updateError) {
      throw new Error(`Failed to reject payment: ${updateError.message}`)
    }
    
    // Create a new pending payment entry so the user can try again
    // Only create if this was a payment that required approval (gcash or mobile_banking)
    const requiresApproval = payment.payment_method === 'gcash' || payment.payment_method === 'mobile_banking'
    
    if (requiresApproval && payment.payment_type && payment.application_id && payment.amount) {
      // Check if there's already a pending payment for this type
      const { data: existingPending, error: checkError } = await supabase
        .from('application_payments')
        .select('id')
        .eq('application_id', payment.application_id)
        .eq('payment_type', payment.payment_type)
        .eq('status', 'pending')
        .maybeSingle()
      
      // Only create if no pending payment exists for this type
      if (!checkError && !existingPending) {
        // Calculate service fee amount for this payment type
        const serviceFeeAmount = calculateServiceFee(payment.payment_type)
        
        const { error: createError } = await supabase
          .from('application_payments')
          .insert({
            application_id: payment.application_id,
            user_id: payment.user_id,
            payment_type: payment.payment_type,
            amount: payment.amount,
            service_fee_amount: serviceFeeAmount,
            status: 'pending',
          })
        
        if (createError) {
          // Log error but don't fail the rejection
          console.error('Failed to create new pending payment after rejection:', createError)
        }
      }
    }
    
    // Get the updated payment
    const { data: updatedPayment, error: selectError } = await supabase
      .from('application_payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    
    // Invalidate payment cache
    try {
      const { invalidateApplicationCache } = await import('./query-cache')
      const typedPayment = updatedPayment || payment
      const appId = (typedPayment as { application_id?: string }).application_id
      if (appId) {
        invalidateApplicationCache(appId)
      }
    } catch {
      // Cache module might not be available, continue anyway
    }
    
    // Return the updated payment or the payment data we have
    return updatedPayment || { ...payment, ...updatePayload }
  },

  delete: async (paymentId: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }
    
    // Get payment to invalidate cache
    const { data: payment, error: fetchError } = await supabase
      .from('application_payments')
      .select('application_id')
      .eq('id', paymentId)
      .single()
    
    if (fetchError) {
      throw new Error(`Failed to fetch payment: ${fetchError.message}`)
    }
    
    if (!payment) {
      throw new Error('Payment not found')
    }
    
    // Delete the payment
    const { data: deletedData, error: deleteError } = await supabase
      .from('application_payments')
      .delete()
      .eq('id', paymentId)
      .select()
    
    if (deleteError) {
      // Provide more detailed error message
      console.error('Delete payment error:', deleteError)
      if (deleteError.code === '42501') {
        throw new Error('Permission denied: Admin delete policy may not be configured. Please contact system administrator.')
      } else if (deleteError.code === 'PGRST301') {
        throw new Error('No rows deleted: Payment may have already been deleted or does not exist.')
      }
      throw new Error(`Failed to delete payment: ${deleteError.message} (Code: ${deleteError.code || 'unknown'})`)
    }
    
    // Verify deletion
    if (!deletedData || deletedData.length === 0) {
      throw new Error('Payment was not deleted. It may have already been deleted or you may not have permission.')
    }
    
    // Invalidate payment cache
    try {
      const { invalidateApplicationCache } = await import('./query-cache')
      const typedPayment = payment as { application_id?: string }
      if (typedPayment.application_id) {
        invalidateApplicationCache(typedPayment.application_id)
      }
    } catch {
      // Cache module might not be available, continue anyway
    }
  },
}

// Tracking API
export const trackingAPI = {
  getByGritAppId: async (gritAppId: string) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('grit_app_id', gritAppId.toUpperCase())
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },
}

// Careers API
export const careersAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('careers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('careers')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  create: async (career: {
    title: string
    description: string
    requirements?: string
    responsibilities?: string
    location?: string
    employment_type?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship'
    salary_range?: string
    department?: string
    is_active?: boolean
  }) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('careers')
      .insert(career)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    title: string
    description: string
    requirements: string
    responsibilities: string
    location: string
    employment_type: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship'
    salary_range: string
    department: string
    is_active: boolean
  }>) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('careers')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  delete: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { error } = await supabase
      .from('careers')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Donations API
export const donationsAPI = {
  getAll: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  create: async (donation: {
    donor_name?: string
    donor_email?: string
    donor_phone?: string
    is_anonymous: boolean
    amount: number
    currency: string
    payment_method?: string
    stripe_payment_intent_id?: string
    status: 'pending' | 'completed' | 'failed'
    message?: string
  }) => {
    const { data, error } = await supabase
      .from('donations')
      .insert(donation)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    status: 'pending' | 'completed' | 'failed'
    payment_method: string
    stripe_payment_intent_id: string
  }>) => {
    const { data, error } = await supabase
      .from('donations')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  getPublicStats: async () => {
    const { data, error } = await supabase
      .from('donations')
      .select('amount, status')
    
    if (error) throw new Error(error.message)
    const completed = (data || []).filter((d: any) => d.status === 'completed')
    const total = completed.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0)
    return {
      total_raised: total,
      total_donors: completed.length,
      currency: 'USD',
    }
  },
}

// Partner Agencies API
export const partnerAgenciesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('partner_agencies')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getAllAdmin: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('partner_agencies')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('partner_agencies')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  create: async (agency: {
    name: string
    email: string
    phone?: string
    website?: string
    address?: string
    city?: string
    state?: string
    country: string
    description?: string
    services_offered?: string
    logo_url?: string
    is_active?: boolean
  }) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('partner_agencies')
      .insert(agency)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    name: string
    email: string
    phone: string
    website: string
    address: string
    city: string
    state: string
    country: string
    description: string
    services_offered: string
    logo_url: string
    is_active: boolean
  }>) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('partner_agencies')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  delete: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { error } = await supabase
      .from('partner_agencies')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Career Applications API
export const careerApplicationsAPI = {
  getAll: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('career_applications')
      .select('*, careers(*)')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('career_applications')
      .select('*, careers(*)')
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  getByCareer: async (careerId: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('career_applications')
      .select('*')
      .eq('career_id', careerId)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  create: async (application: {
    career_id?: string
    first_name: string
    last_name: string
    email: string
    mobile_number: string
    date_of_birth?: string
    country?: string
    nursing_school?: string
    graduation_date?: string
    years_of_experience?: string
    current_employment_status?: string
    license_number?: string
    resume_path?: string
    cover_letter?: string
    partner_agency_id?: string
  }) => {
    const userId = await getCurrentUserId().catch(() => null)

    const { data, error } = await supabase
      .from('career_applications')
      .insert({
        ...application,
        user_id: userId,
        status: 'pending',
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired'
    admin_notes: string
  }>) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('career_applications')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  delete: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { error } = await supabase
      .from('career_applications')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Sponsorships API (NCLEX Sponsorships)
export const sponsorshipsAPI = {
  getAll: async () => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('nclex_sponsorships')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('nclex_sponsorships')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  create: async (sponsorship: {
    first_name: string
    last_name: string
    email: string
    mobile_number: string
    date_of_birth?: string
    country?: string
    nursing_school?: string
    graduation_date?: string
    current_employment_status?: string
    years_of_experience?: string
    financial_need_description: string
    motivation_statement: string
    resume_path?: string
    transcript_path?: string
    recommendation_letter_path?: string
  }) => {
    const userId = await getCurrentUserId().catch(() => null)

    const { data, error } = await supabase
      .from('nclex_sponsorships')
      .insert({
        ...sponsorship,
        user_id: userId,
        status: 'pending',
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'sponsored'
    admin_notes: string
    sponsor_details: string
  }>) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { data, error } = await supabase
      .from('nclex_sponsorships')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  delete: async (id: string) => {
    if (!(await isAdmin())) {
      throw new Error('Unauthorized - Admin only')
    }

    const { error } = await supabase
      .from('nclex_sponsorships')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}
