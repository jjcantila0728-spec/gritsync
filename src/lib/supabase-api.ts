import { supabase } from './supabase'
import type { Database } from './database.types'
import { 
  handleSupabaseError, 
  normalizeError, 
  retryWithBackoff,
  isRetryableError,
  AppError,
  ErrorType,
  ErrorSeverity
} from './error-handler'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Removed unused QueryResult type

/**
 * Enhanced Supabase query wrapper with error handling and retry logic
 */
async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  context?: Record<string, any>,
  retry: boolean = true
): Promise<T> {
  const execute = async () => {
    const { data, error } = await queryFn()
    
    if (error) {
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
        return await retryWithBackoff(execute, 3, 1000, error)
      }
      throw error
    }
  }

  return await execute()
}

// Helper to get current user ID
async function getCurrentUserId(): Promise<string> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      throw normalizeError(error, { operation: 'getCurrentUserId' })
    }
    if (!user) {
      throw normalizeError(new Error('Not authenticated'), { operation: 'getCurrentUserId' })
    }
    return user.id
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error
    }
    throw normalizeError(error, { operation: 'getCurrentUserId' })
  }
}

// Helper to check if user is admin
// Uses auth metadata to avoid RLS issues
async function isAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    
    // Check role from user_metadata (maps to raw_user_meta_data in auth.users)
    // This matches what our RLS policies check
    const role = user.user_metadata?.role
    return role === 'admin'
  } catch (error) {
    return false
  }
}

function resolveServiceType(app: { service_type?: string; application_type?: string }) {
  if (app.service_type) {
    return app.service_type
  }
  return app.application_type === 'EAD' ? 'EAD (I-765)' : 'NCLEX Processing'
}

function resolveServiceState(app: { service_state?: string; application_type?: string }) {
  if (app.service_state) {
    return app.service_state
  }
  return app.application_type === 'EAD' ? 'USCIS' : 'New York'
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
    
    // Enhance each application with timeline-based current_progress and next_step
    const applicationsWithTimeline = await Promise.all(
      applications.map(async (app: any) => {
        try {
          // Get timeline steps for this application
          const { data: steps, error: stepsError } = await supabase
            .from('application_timeline_steps')
            .select('*')
            .eq('application_id', app.id)
            .order('created_at', { ascending: true })
          
          if (stepsError) {
            return app
          }
          
          const allSteps = steps || []
          
          // Get payments for this application
          const { data: payments } = await supabase
            .from('application_payments')
            .select('*')
            .eq('application_id', app.id)
          
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
              // If no GritSync account exists, generate the email address
              const firstName = app.first_name || ''
              const middleName = app.middle_name || null
              const lastName = app.last_name || ''
              if (firstName && lastName) {
                displayEmail = generateGmailAddress(firstName, middleName, lastName)
              }
            }
          } catch (error) {
            // If error, fall back to generating email from name
            const firstName = app.first_name || ''
            const middleName = app.middle_name || null
            const lastName = app.last_name || ''
            if (firstName && lastName) {
              displayEmail = generateGmailAddress(firstName, middleName, lastName)
            }
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
              const firstName = app.first_name || ''
              const middleName = app.middle_name || null
              const lastName = app.last_name || ''
              if (firstName && lastName) {
                displayEmail = generateGmailAddress(firstName, middleName, lastName)
              }
            }
          } catch (emailError) {
            // If error, try to generate from name
            const firstName = app.first_name || ''
            const middleName = app.middle_name || null
            const lastName = app.last_name || ''
            if (firstName && lastName) {
              displayEmail = generateGmailAddress(firstName, middleName, lastName)
            }
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
    const userId = await getCurrentUserId()
    const admin = await isAdmin()

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
    
    console.log('Getting application by ID:', id, 'isGritAppId:', isGritAppId)
    
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
    
    console.log('First query result:', { dataLength: Array.isArray(data) ? data.length : 'not array', error: error?.message })
    
    // If authenticated query fails, try without filters to see what's available
    if (error || (Array.isArray(data) && data.length === 0)) {
      console.log('Trying alternative query for application:', id)
      
      // Try case-insensitive search for grit_app_id
      if (isGritAppId) {
        const { data: allApps, error: allError } = await supabase
          .from('applications')
          .select('*')
        
        console.log('All applications count:', allApps?.length, 'error:', allError?.message)
        
        if (allApps && allApps.length > 0) {
          // Find by case-insensitive grit_app_id
          const found = allApps.find((app: any) => 
            app.grit_app_id?.toUpperCase() === id.toUpperCase()
          )
          
          if (found) {
            console.log('Found application with case-insensitive match')
            return found
          }
          
          console.log('Available grit_app_ids:', allApps.map((a: any) => a.grit_app_id).filter(Boolean))
        }
      }
      
      // Last resort: try with UUID if we haven't already
      if (isGritAppId) {
        console.log('Trying to find UUID by grit_app_id')
        const { data: uuidData, error: uuidError } = await supabase
          .from('applications')
          .select('*')
          .ilike('grit_app_id', id)
        
        if (uuidData && uuidData.length > 0) {
          console.log('Found via ilike query')
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
    
    // Determine application type (default to NCLEX for backward compatibility)
    const applicationType = applicationData.application_type || 'NCLEX'
    const isEAD = applicationType === 'EAD'
    
    let picturePath = applicationData.picture_path || null
    let diplomaPath = applicationData.diploma_path || null
    let passportPath = applicationData.passport_path || null
    
    // Upload files to Supabase Storage if provided (required for NCLEX, optional for EAD)
    if (files) {
      if (files.picture) {
        picturePath = await uploadFile(userId, files.picture, 'picture')
      }
      if (files.diploma) {
        diplomaPath = await uploadFile(userId, files.diploma, 'diploma')
      }
      if (files.passport) {
        passportPath = await uploadFile(userId, files.passport, 'passport')
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
    
    // For NCLEX applications, include document paths (required)
    // For EAD applications, document paths are optional
    if (!isEAD) {
      insertData.picture_path = picturePath
      insertData.diploma_path = diplomaPath
      insertData.passport_path = passportPath
    } else {
      // EAD applications don't require these documents, but include if provided
      if (picturePath) insertData.picture_path = picturePath
      if (diplomaPath) insertData.diploma_path = diplomaPath
      if (passportPath) insertData.passport_path = passportPath
    }
    
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
        const timelineStepsAPI = await import('./supabase-api').then(m => m.timelineStepsAPI)
        if (isEAD) {
          // EAD timeline: Application Submission
          await timelineStepsAPI.create(data.id, 'app_submission', 'Application Submission')
        } else {
          // NCLEX timeline: Application Submission
          await timelineStepsAPI.create(data.id, 'app_submission', 'Application Submission')
        }
      } catch (timelineError) {
        // Log but don't fail the application creation if timeline step creation fails
        console.error('Error creating initial timeline step:', timelineError)
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
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
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
export const quotationsAPI = {
  getAll: async () => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    if (admin) {
      // For admins, show all quotations
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(error.message)
      return ((data || []) as unknown) as Tables<'quotations'>[]
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
      
      return uniqueQuotes
    }
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
      console.error('Error creating public quotation:', error)
      throw new Error(`Failed to save quotation: ${error.message}`)
    }
    
    if (!data) {
      throw new Error('Failed to save quotation: No data returned')
    }
    
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
        return dataArray[0]
      }
      throw new Error(error.message)
    }
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
        return dataArray[0]
      }
      throw new Error(error.message)
    }
    return data
  },

  delete: async (id: string) => {
    console.log('[quotationsAPI.delete] Attempting to delete quotation:', id)
    
    // First, verify the quotation exists and we can access it
    const { data: existing, error: fetchError } = await supabase
      .from('quotations')
      .select('id, user_id')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      console.error('[quotationsAPI.delete] Error fetching quotation:', fetchError)
      if (fetchError.code !== 'PGRST116') { // PGRST116 = not found
        throw new Error(`Failed to verify quotation: ${fetchError.message} (Code: ${fetchError.code})`)
      }
      throw new Error('Quotation not found')
    }
    
    if (!existing) {
      throw new Error('Quotation not found or you do not have permission to delete it')
    }
    
    console.log('[quotationsAPI.delete] Quotation found:', existing)
    
    // Check if user is admin
    const adminCheck = await isAdmin()
    console.log('[quotationsAPI.delete] Is admin:', adminCheck)
    
    // Perform the deletion
    const { data, error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id)
      .select() // Return deleted data to verify
    
    if (error) {
      console.error('[quotationsAPI.delete] Delete error:', error)
      throw new Error(`Failed to delete quotation: ${error.message} (Code: ${error.code}, Details: ${error.details || 'N/A'})`)
    }
    
    console.log('[quotationsAPI.delete] Delete response:', data)
    
    // Verify deletion was successful
    if (!data || data.length === 0) {
      console.warn('[quotationsAPI.delete] No data returned from delete, verifying...')
      // Double-check by trying to fetch it again
      const { data: verifyData, error: verifyError } = await supabase
        .from('quotations')
        .select('id')
        .eq('id', id)
        .single()
      
      if (!verifyError && verifyData) {
        console.error('[quotationsAPI.delete] Quotation still exists after deletion!')
        throw new Error('Deletion appeared to succeed but quotation still exists. This may be a permissions issue. Please check RLS policies.')
      } else {
        console.log('[quotationsAPI.delete] Verification passed - quotation is deleted')
      }
    } else {
      console.log('[quotationsAPI.delete] Deletion successful, deleted:', data.length, 'row(s)')
    }
    
    return data
  },

  createPaymentIntent: async (quotationId: string, amount: number) => {
    // Call Supabase Edge Function to create Stripe payment intent
    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: { 
        quotation_id: quotationId,
        amount: amount * 100, // Convert to cents
      },
    })
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_documents'>
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

  getByServiceAndState: async (serviceName: string, state: string) => {
    // Use Supabase directly (serverless)
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
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  },

  getByServiceTypes: async (serviceTypes: string[]) => {
    const query = supabase
      .from('service_required_documents')
      .select('*')
      .order('service_type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

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
    
    // Check if email notifications are enabled for this type
    // Import dynamically to avoid circular dependencies
    const { shouldSendEmailNotification } = await import('./settings')
    const shouldSendEmail = await shouldSendEmailNotification(type)
    
    // Always create the in-app notification
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
    
    // If email notifications are enabled for this type, send email
    if (shouldSendEmail && data) {
      // Send email asynchronously in the background (don't wait for it to complete)
      // This prevents blocking the notification creation
      Promise.resolve().then(async () => {
        try {
          // Optimize: Get user email and profile in parallel
          const [userDataResult, userProfileResult] = await Promise.all([
            supabase.auth.getUser(),
            supabase
              .from('users')
              .select('first_name, last_name, email')
              .eq('id', userId)
              .single()
          ])
          
          // Prefer email from users table, fallback to auth
          const userEmail = userProfileResult.data?.email || userDataResult.data?.user?.email
          
          if (userEmail) {
            const profile = userProfileResult.data as { first_name?: string; last_name?: string } | null
            const userName = (profile?.first_name && profile?.last_name 
                              ? `${profile.first_name} ${profile.last_name}` 
                              : profile?.first_name || 'User')
            
            // Import email service dynamically
            const { sendNotificationEmail } = await import('./email-service')
            
            // Send email with error handling
            await sendNotificationEmail(userEmail, type, {
              userName,
              title,
              message,
              applicationId,
            })
          }
        } catch (emailError) {
          console.error('Error sending notification email:', emailError)
          // Don't throw - email failure shouldn't break notification creation
        }
      })
    }
    
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

  // Trigger notification generation functions
  generateDocumentReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('generate_document_reminders')
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error generating document reminders:', error)
      throw error
    }
  },

  generateProfileCompletionReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('generate_profile_completion_reminders')
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error generating profile completion reminders:', error)
      throw error
    }
  },

  generatePaymentReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('generate_payment_reminders')
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error generating payment reminders:', error)
      throw error
    }
  },

  generateCredentialingReminders: async () => {
    try {
      const { data, error } = await supabase.rpc('notify_credentialing_reminder')
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error generating credentialing reminders:', error)
      throw error
    }
  },

  checkMissingDocuments: async (userId?: string) => {
    try {
      const targetUserId = userId || await getCurrentUserId()
      const { data, error } = await supabase.rpc('check_missing_documents', {
        p_user_id: targetUserId
      })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error checking missing documents:', error)
      return []
    }
  },

  checkIncompleteProfile: async (userId?: string) => {
    try {
      const targetUserId = userId || await getCurrentUserId()
      const { data, error } = await supabase.rpc('check_incomplete_profile', {
        p_user_id: targetUserId
      })
      if (error) throw error
      return data || false
    } catch (error) {
      console.error('Error checking incomplete profile:', error)
      return false
    }
  },
}

// User Details API
export const userDetailsAPI = {
  get: async () => {
    const userId = await getCurrentUserId()
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
    const admin = await isAdmin()
    const currentUserId = await getCurrentUserId()
    
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
      .order('uploaded_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  // Get documents for a specific user (for admins viewing client applications)
  getByUserId: async (userId: string) => {
    const admin = await isAdmin()
    const currentUserId = await getCurrentUserId()
    
    // Only allow admins or the user themselves to fetch documents
    if (!admin && userId !== currentUserId) {
      throw new Error('Unauthorized')
    }
    
    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  upload: async (type: string, file: File) => {
    const userId = await getCurrentUserId()
    const filePath = await uploadFile(userId, file, type)
    
    // Check if document already exists
    const { data: existing, error: checkError } = await supabase
      .from('user_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('document_type', type)
      .maybeSingle()
    
    if (checkError) throw new Error(checkError.message)
    
    let data, error
    if (existing && !('error' in existing) && 'id' in existing) {
      // Update existing document
      const { data: updated, error: updateError } = await supabase
        .from('user_documents')
        .update({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id)
        .select()
        .single()
      data = updated
      error = updateError
    } else {
      // Insert new document
      const { data: inserted, error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: userId,
          document_type: type,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        })
        .select()
        .single()
      data = inserted
      error = insertError
    }
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_documents'>
  },

  // Upload document for a specific user (for admins)
  uploadForUser: async (userId: string, type: string, file: File) => {
    const admin = await isAdmin()
    const currentUserId = await getCurrentUserId()
    
    // Only allow admins or the user themselves to upload documents
    if (!admin && userId !== currentUserId) {
      throw new Error('Unauthorized')
    }
    
    const filePath = await uploadFile(userId, file, type)
    
    // Check if document already exists
    const { data: existing, error: checkError } = await supabase
      .from('user_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('document_type', type)
      .maybeSingle()
    
    if (checkError) throw new Error(checkError.message)
    
    let data, error
    if (existing && !('error' in existing) && 'id' in existing) {
      // Update existing document
      const { data: updated, error: updateError } = await supabase
        .from('user_documents')
        .update({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id)
        .select()
        .single()
      data = updated
      error = updateError
    } else {
      // Insert new document
      const { data: inserted, error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: userId,
          document_type: type,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        })
        .select()
        .single()
      data = inserted
      error = insertError
    }
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_documents'>
  },

  // Delete a document
  delete: async (documentId: string) => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    // First check if user owns the document or is admin
    const { data: doc, error: fetchError } = await supabase
      .from('user_documents')
      .select('user_id')
      .eq('id', documentId)
      .single()
    
    if (fetchError) throw new Error(fetchError.message)
    if (!admin && doc && !('error' in doc) && 'user_id' in doc && (doc as any).user_id !== userId) {
      throw new Error('Unauthorized')
    }
    
    // Delete from storage and database
    const { error } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', documentId)
    
    if (error) throw new Error(error.message)
  },
}

// File upload helper
async function uploadFile(userId: string, file: File, type: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${type}_${Date.now()}.${fileExt}`
  const filePath = `${userId}/${fileName}`
  
  const { error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
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

// Get signed URL for private files (expires in 1 hour)
export async function getSignedFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  if (!filePath || filePath.trim() === '') {
    console.error('getSignedFileUrl: File path is required', filePath)
    throw new Error('File path is required')
  }
  
  // Normalize path (handle Windows backslashes)
  const normalizedPath = filePath.replace(/\\/g, '/')
  
  console.log('getSignedFileUrl: Attempting to get signed URL for path:', normalizedPath)
  console.log('getSignedFileUrl: Using bucket: documents')
  
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(normalizedPath, expiresIn)
  
  if (error) {
    console.error('getSignedFileUrl: Error getting signed URL:', error)
    console.error('getSignedFileUrl: Error details:', {
      message: error.message,
      path: normalizedPath
    })
    
    // Provide more helpful error messages
    if (error.message?.includes('not found') || 
        error.message?.includes('Object not found')) {
      throw new Error(`File not found in storage: ${normalizedPath}`)
    }
    throw new Error(error.message || 'Failed to get signed URL')
  }
  
  if (!data?.signedUrl) {
    console.error('getSignedFileUrl: No signed URL returned in data:', data)
    throw new Error('No signed URL returned')
  }
  
  console.log('getSignedFileUrl: Successfully got signed URL for:', normalizedPath)
  return data.signedUrl
}

// Application Timeline Steps API
export const timelineStepsAPI = {
  getByApplication: async (applicationId: string) => {
    const { data, error } = await supabase
      .from('application_timeline_steps')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  update: async (applicationId: string, stepKey: string, status: 'pending' | 'completed', data?: any) => {
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

// Helper function to generate GritSync email address from name
// Format: first letter of firstname + first letter of middlename (if available) + lastname@gritsync.com
// Example: John Michael Smith -> jmsmith@gritsync.com
function generateGmailAddress(firstName: string, middleName: string | null, lastName: string): string {
  // Get first letter of first name (lowercase)
  const firstInitial = (firstName || '').trim().charAt(0).toLowerCase()
  
  // Get middle initial if available
  const middleInitial = (middleName || '').trim().charAt(0).toLowerCase()
  
  // Get full last name (remove spaces and special characters)
  const lastNameClean = (lastName || '').trim().toLowerCase().replace(/[^a-z]/g, '')
  
  if (!firstInitial || !lastNameClean) {
    // Fallback if missing required parts
    return `user@gritsync.com`
  }
  
  // Generate email: firstInitial + middleInitial + lastName@gritsync.com
  const email = middleInitial 
    ? `${firstInitial}${middleInitial}${lastNameClean}@gritsync.com`
    : `${firstInitial}${lastNameClean}@gritsync.com`
  
  return email
}

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
    
    // Generate GritSync email address from application name
    const firstName = typedApplication.first_name || ''
    const middleName = typedApplication.middle_name || null
    const lastName = typedApplication.last_name || ''
    const gritsyncEmail = generateGmailAddress(firstName, middleName, lastName)
    
    // Create GritSync account if it doesn't exist
    if (!existingGritsync) {
      try {
        if (password && firstName && lastName) {
          const { error: gritsyncError } = await supabase
            .from('processing_accounts')
            .insert({
              application_id: actualApplicationId,
              account_type: 'gritsync',
              email: gritsyncEmail,
              password: password,
              status: 'inactive', // Inactive by default, must be activated by admin
              created_by: typedApplication.user_id,
            })
            .select()
            .single()
          
          // Silently handle duplicate errors (account already exists)
          if (gritsyncError && gritsyncError.code !== '23505' && !gritsyncError.message?.includes('duplicate') && !gritsyncError.message?.includes('unique')) {
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
    
    // Use Supabase directly (serverless)
      if (admin) {
        // Admin stats - comprehensive system-wide statistics
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
        console.error('Error fetching completed apps:', completedApps.error)
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
      // Client stats
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
      console.error('Error fetching USD to PHP rate:', error)
      throw new Error(error.message || 'Failed to fetch real-time exchange rate')
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
      console.error('Error getting USD to PHP rate:', error)
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
          console.warn('notification_types table does not exist. Run migration: create_notification_types_table.sql')
          return []
        }
        throw new Error(error.message)
      }
      return data || []
    } catch (error: any) {
      // Handle case where table doesn't exist
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('notification_types table does not exist. Run migration: create_notification_types_table.sql')
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
    const userId = await getCurrentUserId()
    
    // Resolve application ID (could be grit_app_id or UUID)
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(applicationId)
    
    let actualApplicationId = applicationId
    
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
      
      // Check if user owns the application
      const appData = application as { user_id?: string }
      if (appData.user_id !== userId) {
        const admin = await isAdmin()
        if (!admin) {
          throw new Error('Unauthorized')
        }
      }
      
      const typedApp = application as { id?: string }
      actualApplicationId = typedApp.id || ''
    }
    
    // Calculate service fee amount for this payment type
    const serviceFeeAmount = calculateServiceFee(paymentType)
    
    const { data, error } = await supabase
      .from('application_payments')
      .insert({
        application_id: actualApplicationId,
        user_id: userId,
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
    const context = { operation: 'applicationPaymentsAPI.createPaymentIntent', paymentId }
    
    try {
      // Get session if available (application payments can be made by anyone with the link)
      let authHeader: string | undefined = undefined
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // Only use session if it exists and is valid
        if (!sessionError && session?.access_token) {
          // Verify the token is still valid
          const { error: userError } = await supabase.auth.getUser()
          if (!userError) {
            authHeader = `Bearer ${session.access_token}`
            console.log('Using authenticated session for payment intent')
          } else {
            console.log('Session token invalid, proceeding as public user')
          }
        } else {
          console.log('No session found, proceeding as public user')
        }
      } catch (sessionCheckError) {
        // If session check fails, proceed as public user (no auth header)
        console.log('Session check failed, proceeding as public user:', sessionCheckError)
      }
      
      // Call Supabase Edge Function for Stripe payment intent creation with retry logic
      const executeInvoke = async () => {
        const invokeOptions: any = {
          body: { payment_id: paymentId },
        }
        
        // Only add auth header if we have a valid session
        if (authHeader) {
          invokeOptions.headers = {
            Authorization: authHeader,
          }
        }
        
        const { data, error } = await supabase.functions.invoke('create-application-payment-intent', invokeOptions)
        
        if (error) {
          // Try to extract error message from response body
          let errorMessage = 'Failed to connect to payment service'
          
          // If context is a Response object, try to read the body
          if (error.context && error.context instanceof Response) {
            try {
              const responseText = await error.context.text()
              
              try {
                const errorBody = JSON.parse(responseText)
                if (errorBody?.error) {
                  errorMessage = typeof errorBody.error === 'string' 
                    ? errorBody.error 
                    : errorBody.error.message || errorMessage
                } else if (errorBody?.message) {
                  errorMessage = errorBody.message
                }
              } catch (parseError) {
                // If it's not JSON, use the text as error message if it's meaningful
                if (responseText && responseText.length < 200) {
                  errorMessage = responseText
                }
              }
            } catch (readError) {
              // Fall through to use default error message
            }
          }
          
          // Try to get error message from other sources
          if (errorMessage === 'Failed to connect to payment service') {
            if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
              errorMessage = error.message
            } else if (error.error?.message) {
              errorMessage = error.error.message
            }
          }
          
          throw normalizeError(new Error(errorMessage), { ...context, step: 'invokeFunction', originalError: error })
        }
        
        // Handle edge function error response (function executed but returned error)
        if (data && typeof data === 'object') {
          if (data.error) {
            const errorMsg = typeof data.error === 'string' 
              ? data.error 
              : data.error.message || data.error.error || 'Payment intent creation failed'
            throw normalizeError(new Error(errorMsg), { ...context, step: 'processResponse' })
          }
          
          // Edge function returns snake_case, convert to camelCase for consistency
          const clientSecret = data.client_secret || data.clientSecret
          const paymentIntentId = data.payment_intent_id || data.paymentIntentId
          
          if (!clientSecret) {
            throw normalizeError(
              new Error('Payment intent created but no client secret returned. Please contact support.'),
              { ...context, step: 'validateResponse' }
            )
          }
          
          return {
            clientSecret,
            paymentIntentId,
          }
        }
        
        // No data returned
        throw normalizeError(
          new Error('No response from payment service. Please try again or contact support.'),
          { ...context, step: 'validateResponse' }
        )
      }
      
      // Execute with retry logic for network errors
      return await retryWithBackoff(executeInvoke, 3, 2000)
    } catch (err: any) {
      // Re-throw AppError as-is, normalize others
      if (err instanceof AppError) {
        throw err
      }
      throw normalizeError(err, context)
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
    const userId = await getCurrentUserId()
    
    // Upload proof of payment file if provided (for mobile banking)
    let proofOfPaymentFilePath: string | undefined
    if (proofOfPaymentFile) {
      try {
        proofOfPaymentFilePath = await uploadFile(userId, proofOfPaymentFile, 'proof_of_payment')
      } catch (error: any) {
        throw new Error(`Failed to upload proof of payment: ${error.message}`)
      }
    }

    const updateData: any = {
      payment_method: paymentMethod,
    }
    
    // Only set transaction_id if provided
    if (transactionId) {
      updateData.transaction_id = transactionId
    }

    // Store USD to PHP conversion rate for PHP-convertible payment methods (mobile_banking and gcash)
    // Only set if the column exists (migration may not have been run yet)
    if (paymentMethod === 'mobile_banking' || paymentMethod === 'gcash') {
      try {
        const conversionRate = await adminAPI.getUsdToPhpRate()
        // Try to set the rate, but don't fail if column doesn't exist
        updateData.usd_to_php_rate = conversionRate
      } catch (error) {
        // If rate fetch fails, use default rate
        updateData.usd_to_php_rate = 56.00
      }
    }

    // Set status based on payment method
    if (paymentMethod === 'mobile_banking') {
      // Mobile banking requires admin approval
      updateData.status = 'pending_approval'
      if (proofOfPaymentFilePath) {
        updateData.proof_of_payment_file_path = proofOfPaymentFilePath
      }
    } else if (paymentMethod === 'gcash') {
      // GCash also requires manual verification (keep as pending_approval or paid based on webhook)
      // For manual GCash payments, status will be 'pending_approval' until admin verifies
      updateData.status = 'pending_approval'
      if (gcashDetails) {
        updateData.transaction_id = `GCASH-${gcashDetails.reference}`
      }
    } else {
      // Stripe card payments are automatically paid
      // Set status to 'paid' immediately for better UX
      // Webhook will also update but will check for duplicates
      updateData.status = 'paid'
      if (stripePaymentIntentId) {
        updateData.stripe_payment_intent_id = stripePaymentIntentId
        updateData.transaction_id = stripePaymentIntentId
      }
    }


    // First, try to update with all fields
    let { data, error } = await supabase
      .from('application_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single()
    
    if (error) {
      // Handle missing column errors
      if (error.message?.includes('usd_to_php_rate') || error.code === 'PGRST204') {
        
        const { usd_to_php_rate, ...updateWithoutRate } = updateData
        const retryResult = await supabase
          .from('application_payments')
          .update(updateWithoutRate)
          .eq('id', paymentId)
          .select()
          .single()
        
        if (retryResult.error) {
          // Check if it's a status constraint error
          if (retryResult.error.message?.includes('status') || retryResult.error.message?.includes('pending_approval')) {
            throw new Error('The status "pending_approval" is not allowed. Please run the migration: supabase/add-mobile-banking-proof-of-payment.sql')
          }
          
          throw new Error(retryResult.error.message || 'Failed to update payment')
        }
        
        return retryResult.data
      }
      
      // Check if it's a status constraint error
      if (error.message?.includes('status') || error.message?.includes('pending_approval') || error.message?.includes('constraint')) {
        throw new Error('The payment status constraint failed. Please ensure these migrations are run: supabase/add-mobile-banking-proof-of-payment.sql and supabase/add-usd-to-php-rate-to-payments.sql')
      }
      
      throw new Error(error.message || 'Failed to update payment')
    }
    
    // Auto-update timeline steps when payment is completed (status = 'paid')
    // Note: For Stripe payments, webhook also updates timeline (idempotent upsert)
    // This ensures timeline is updated even if webhook is delayed
    const typedData = data as unknown as { status?: string } | null
    if (typedData && typedData.status === 'paid') {
      try {
        // Get the payment with application_id
        const { data: paymentWithApp } = await supabase
          .from('application_payments')
          .select('application_id, payment_type, amount')
          .eq('id', paymentId)
          .single()
        
        if (paymentWithApp) {
          const paymentData = paymentWithApp as { application_id?: string; payment_type?: string; amount?: number | string }
          const applicationId = paymentData.application_id
          const paymentType = paymentData.payment_type
          
          // Get all paid payments for this application to calculate total
          const { data: allPayments } = await supabase
            .from('application_payments')
            .select('amount, payment_type')
            .eq('application_id', applicationId)
            .eq('status', 'paid')
          
          // Calculate total amount paid
          const typedPayments = allPayments as Array<{ amount?: number | string }> | null
          const totalAmountPaid = typedPayments?.reduce((sum, p) => sum + (parseFloat(String(p.amount || 0)) || 0), 0) || 0
          
          // Update timeline step based on payment type
          if (applicationId) {
            if (paymentType === 'step1') {
              await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
                amount: paymentData.amount,
                total_amount_paid: totalAmountPaid,
                payment_method: paymentMethod,
                completed_at: new Date().toISOString()
              })
            } else if (paymentType === 'step2') {
              await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
                amount: paymentData.amount,
                total_amount_paid: totalAmountPaid,
                payment_method: paymentMethod,
                completed_at: new Date().toISOString()
              })
            } else if (paymentType === 'full') {
              // For full payment, update both step1 and step2 as completed
              await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
                amount: paymentData.amount,
                total_amount_paid: totalAmountPaid,
                payment_method: paymentMethod,
                completed_at: new Date().toISOString()
              })
              await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
                amount: paymentData.amount,
                total_amount_paid: totalAmountPaid,
                payment_method: paymentMethod,
                completed_at: new Date().toISOString()
              })
            }
          }
        }
      } catch {
        // Silently handle timeline update errors
      }
    }
    
    return data
  },

  getByApplication: async (applicationId: string) => {
    // Try to get user ID, but don't fail if not authenticated (public checkout access)
    let userId: string | null = null
    let admin = false
    
    try {
      userId = await getCurrentUserId()
      admin = await isAdmin()
    } catch (e) {
      // User not authenticated - allow public access for checkout
      console.log('Public access to application payments')
    }
    
    // Resolve application ID (could be grit_app_id or UUID)
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(applicationId)
    
    let actualApplicationId = applicationId
    
    if (isGritAppId) {
      // Look up the application by grit_app_id to get the UUID
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id, user_id')
        .eq('grit_app_id', applicationId.toUpperCase())
        .maybeSingle()
      
      if (appError || !application) {
        throw new Error(appError?.message || 'Application not found')
      }
      
      // Check if user owns the application or is admin (skip if public access)
      const appCheckData = application as { user_id?: string; id?: string }
      if (userId && !admin && appCheckData.user_id !== userId) {
        throw new Error('Unauthorized')
      }
      
      actualApplicationId = appCheckData.id || ''
    } else {
      // If it's a UUID, verify the user has access to this application (skip if public access)
      if (userId) {
        const { data: application, error: appError } = await supabase
          .from('applications')
          .select('user_id')
          .eq('id', applicationId)
          .maybeSingle()
        
        if (appError || !application) {
          throw new Error(appError?.message || 'Application not found')
        }
        
        // Check if user owns the application or is admin
        const appCheckData = application as { user_id?: string }
        if (!admin && appCheckData.user_id !== userId) {
          throw new Error('Unauthorized')
        }
      }
    }
    
    const { data, error } = await supabase
      .from('application_payments')
      .select('*')
      .eq('application_id', actualApplicationId)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getReceipt: async (paymentId: string) => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('payment_id', paymentId)
      .single()
    
    if (error) throw new Error(error.message)
    return data as Tables<'user_documents'>
  },

  // Admin methods for approving/rejecting payments
  getPendingApproval: async () => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Admin access required')
    }

    const { data, error } = await supabase
      .from('application_payments')
      .select(`
        *,
        applications!inner(
          id,
          grit_app_id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  approvePayment: async (paymentId: string) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Admin access required')
    }

    // Get payment details before updating to check previous status
    const { data: paymentBefore } = await supabase
      .from('application_payments')
      .select('user_id, application_id, payment_type, amount, status')
      .eq('id', paymentId)
      .single()

    const { data, error } = await supabase
      .from('application_payments')
      .update({ status: 'paid' })
      .eq('id', paymentId)
      .select('application_id, payment_type, amount, payment_method, user_id')
      .single()
    
    if (error) throw new Error(error.message)
    
    // Create notification if payment status changed to paid
    const paymentData = data as { user_id?: string; payment_type?: string; amount?: number | string; application_id?: string; payment_method?: string } | null
    const beforeData = paymentBefore as { status?: string } | null
    if (paymentData && beforeData && beforeData.status !== 'paid' && paymentData.user_id) {
      const paymentTypeNames: Record<string, string> = {
        'step1': 'Step 1',
        'step2': 'Step 2',
        'full': 'Full Payment'
      }
      
      await notificationsAPI.create(
        'Payment Approved',
        `Your ${paymentTypeNames[paymentData.payment_type || ''] || 'payment'} of $${parseFloat(String(paymentData.amount || 0)).toFixed(2)} has been approved and processed successfully.`,
        'payment',
        paymentData.application_id
      )
    }
    
    // Auto-update timeline steps when payment is approved
    if (paymentData) {
      try {
        const applicationId = paymentData.application_id
        const paymentType = paymentData.payment_type
        
        // Get all paid payments for this application to calculate total
        const { data: allPayments } = await supabase
          .from('application_payments')
          .select('amount, payment_type')
          .eq('application_id', applicationId)
          .eq('status', 'paid')
        
        // Calculate total amount paid
        const typedAllPayments = allPayments as Array<{ amount?: number | string }> | null
        const totalAmountPaid = typedAllPayments?.reduce((sum, p) => sum + (parseFloat(String(p.amount || 0)) || 0), 0) || 0
        
        // Update timeline step based on payment type
        if (applicationId) {
          if (paymentType === 'step1') {
            await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
              amount: paymentData.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentData.payment_method || 'mobile_banking',
              completed_at: new Date().toISOString()
            })
          } else if (paymentType === 'step2') {
            await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
              amount: paymentData.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentData.payment_method || 'mobile_banking',
              completed_at: new Date().toISOString()
            })
          } else if (paymentType === 'full') {
            // For full payment, update both step1 and step2 as completed
            await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
              amount: paymentData.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentData.payment_method || 'stripe',
              completed_at: new Date().toISOString()
            })
            await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
              amount: paymentData.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentData.payment_method || 'stripe',
              completed_at: new Date().toISOString()
            })
          }
        }
      } catch (timelineError: any) {
        // Log error but don't fail the payment approval
      }
    }
    
    return data
  },

  rejectPayment: async (paymentId: string, reason?: string) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Admin access required')
    }

    // Get payment details before updating to check previous status
    const { data: paymentBefore } = await supabase
      .from('application_payments')
      .select('user_id, application_id, payment_type, amount, status')
      .eq('id', paymentId)
      .single()

    const { data, error } = await supabase
      .from('application_payments')
      .update({ 
        status: 'failed',
        transaction_id: 'REJECTED',
        admin_note: reason || undefined
      })
      .eq('id', paymentId)
      .select('user_id, application_id, payment_type, amount')
      .single()
    
    if (error) throw new Error(error.message)
    
    // Create notification if payment was rejected
    const rejectPaymentData = data as { user_id?: string; payment_type?: string; amount?: number | string; application_id?: string } | null
    const rejectBeforeData = paymentBefore as { status?: string } | null
    if (rejectPaymentData && rejectBeforeData && rejectBeforeData.status !== 'failed' && rejectPaymentData.user_id) {
      const paymentTypeNames: Record<string, string> = {
        'step1': 'Step 1',
        'step2': 'Step 2',
        'full': 'Full Payment'
      }
      
      const rejectionMessage = reason 
        ? `Your ${paymentTypeNames[rejectPaymentData.payment_type || ''] || 'payment'} of $${parseFloat(String(rejectPaymentData.amount || 0)).toFixed(2)} has been rejected. Reason: ${reason}`
        : `Your ${paymentTypeNames[rejectPaymentData.payment_type || ''] || 'payment'} of $${parseFloat(String(rejectPaymentData.amount || 0)).toFixed(2)} has been rejected. Please contact support for more information.`
      
      await notificationsAPI.create(
        'Payment Rejected',
        rejectionMessage,
        'payment',
        rejectPaymentData.application_id
      )
    }
    
    return data
  },
}

// Tracking API
export const trackingAPI = {
  track: async (id: string) => {
    // Use Supabase directly for tracking - no server dependency
    // This works for both authenticated and public users
    // RLS policies should allow public access to tracking data
    const normalizedId = id.trim().toUpperCase()
    
    console.log('Tracking API: Starting track for ID:', normalizedId)
    
    // Check if ID is a GRIT APP ID (AP + 12 alphanumeric) or UUID
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(normalizedId)
    console.log('Tracking API: Is GRIT APP ID?', isGritAppId)
    
    let application: any = null
    let appError: any = null
    
    // Query by grit_app_id if it's a GRIT APP ID, otherwise by UUID id
    // Note: Only select columns that actually exist in the applications table
    if (isGritAppId) {
      console.log('Tracking API: Querying by grit_app_id:', normalizedId)
      const { data, error } = await supabase
      .from('applications')
      .select('id, first_name, last_name, email, status, created_at, updated_at, picture_path, user_id, grit_app_id, application_type')
        .eq('grit_app_id', normalizedId)
        .single()
      
      application = data
      appError = error
      
      if (error) {
        console.error('Tracking API: Error querying by grit_app_id:', error)
      } else {
        console.log('Tracking API: Found application by grit_app_id:', application?.id)
      }
    } else {
      // Query by UUID id
      console.log('Tracking API: Querying by UUID id:', normalizedId)
      const { data, error } = await supabase
      .from('applications')
      .select('id, first_name, last_name, email, status, created_at, updated_at, picture_path, user_id, grit_app_id, application_type')
        .eq('id', normalizedId)
        .single()
      
      application = data
      appError = error
      
      if (error) {
        console.error('Tracking API: Error querying by UUID:', error)
      } else {
        console.log('Tracking API: Found application by UUID:', application?.id)
      }
    }
    
    if (appError) {
      console.error('Tracking API: Application query failed:', {
        error: appError,
        message: appError.message,
        code: appError.code,
        details: appError.details,
        hint: appError.hint
      })
      
      // Provide more helpful error messages
      if (appError.code === 'PGRST116' || appError.message?.includes('No rows')) {
        throw new Error('Application not found. Please check your tracking ID and try again.')
      } else if (appError.code === '42501' || appError.message?.includes('permission denied') || appError.message?.includes('row-level security')) {
        throw new Error('Access denied. Please ensure the public tracking policies are applied in Supabase.')
      } else {
        throw new Error(appError.message || 'Failed to fetch application. Please try again later.')
      }
    }
    
    if (!application) {
      console.error('Tracking API: No application returned')
      throw new Error('Application not found. Please check your tracking ID and try again.')
    }
    
    // Use the actual UUID id for related queries
    const applicationId = application.id
    console.log('Tracking API: Application ID:', applicationId)
    
    // Get timeline steps
    console.log('Tracking API: Fetching timeline steps...')
    const { data: steps, error: stepsError } = await supabase
      .from('application_timeline_steps')
      .select('step_key, step_name, status, data, completed_at, updated_at, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
    
    if (stepsError) {
      console.warn('Tracking API: Error fetching timeline steps:', stepsError)
    }
    const allSteps = steps || []
    console.log('Tracking API: Found', allSteps.length, 'timeline steps')
    
    // Get payments
    console.log('Tracking API: Fetching payments...')
    const { data: payments, error: paymentsError } = await supabase
      .from('application_payments')
      .select('*')
      .eq('application_id', applicationId)
    
    if (paymentsError) {
      console.warn('Tracking API: Error fetching payments:', paymentsError)
    }
    const allPayments = payments || []
    console.log('Tracking API: Found', allPayments.length, 'payments')
    
    // Get processing accounts
    console.log('Tracking API: Fetching processing accounts...')
    const { data: processingAccounts, error: processingError } = await supabase
      .from('processing_accounts')
      .select('account_type, email')
      .eq('application_id', applicationId)
    
    if (processingError) {
      console.warn('Tracking API: Error fetching processing accounts:', processingError)
    }
    const allProcessingAccounts = processingAccounts || []
    console.log('Tracking API: Found', allProcessingAccounts.length, 'processing accounts')
    
    // Get GritSync email from processing account
    const typedProcessingAccounts = allProcessingAccounts as Array<{ account_type?: string; email?: string }>
    const gritsyncAccounts = typedProcessingAccounts.filter(acc => acc.account_type === 'gritsync')
    const displayEmail = (gritsyncAccounts && gritsyncAccounts.length > 0) ? gritsyncAccounts[0].email : application.email
    
    // Create step status map
    const stepStatusMap: { [key: string]: any } = {}
    allSteps.forEach((step: any) => {
      if (step.data && typeof step.data === 'string') {
        try {
          step.data = JSON.parse(step.data)
        } catch (e) {
          // Keep as is if parsing fails
        }
      }
      stepStatusMap[step.step_key] = step
    })
    
    // Helper to get step status
    const getStepStatus = (key: string) => {
      const step = stepStatusMap[key]
      return step?.status || 'pending'
    }
    
    // Helper to check if step is completed (simplified version matching server logic)
    const isStepCompleted = (stepKey: string): boolean => {
      const stepData = stepStatusMap[stepKey]
      
      switch (stepKey) {
        case 'app_submission': {
          const appCreated = getStepStatus('app_created') === 'completed' || !!application.created_at
          const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path)
          const appPaid = getStepStatus('app_paid') === 'completed' || (allPayments && allPayments.some((p: any) => p.status === 'paid' && (p.payment_type === 'step1' || p.payment_type === 'full')))
          return (appCreated && docsSubmitted && appPaid) || (stepData && stepData.status === 'completed')
        }
        case 'credentialing': {
          const letterGenerated = getStepStatus('letter_generated') === 'completed'
          const letterSubmitted = getStepStatus('letter_submitted') === 'completed'
          const officialDocs = getStepStatus('official_docs_submitted') === 'completed'
          return (letterGenerated && letterSubmitted && officialDocs) || (stepData && stepData.status === 'completed')
        }
        case 'bon_application': {
          const mandatoryCourses = getStepStatus('mandatory_courses') === 'completed'
          const form1Submitted = getStepStatus('form1_submitted') === 'completed'
          const typedAllPayments = allPayments as Array<{ status?: string; payment_type?: string }> | null
        const appStep2Paid = getStepStatus('app_step2_paid') === 'completed' || (typedAllPayments && typedAllPayments.some((p: any) => p.status === 'paid' && p.payment_type === 'step2'))
          return (mandatoryCourses && form1Submitted && appStep2Paid) || (stepData && stepData.status === 'completed')
        }
        case 'nclex_eligibility': {
          return getStepStatus('nclex_eligibility_approved') === 'completed' || (stepData && stepData.status === 'completed')
        }
        case 'pearson_vue': {
          const pearsonAccountCreated = getStepStatus('pearson_account_created') === 'completed' || (allProcessingAccounts && allProcessingAccounts.some((acc: any) => acc.account_type === 'pearson_vue' && acc.status === 'active'))
          const attRequested = getStepStatus('att_requested') === 'completed'
          return (pearsonAccountCreated && attRequested) || (stepData && stepData.status === 'completed')
        }
        case 'att': {
          const attReceived = stepStatusMap['att_received']
          if (!attReceived || !attReceived.data) {
            return (stepData && stepData.status === 'completed')
          }
          const attData = typeof attReceived.data === 'string' ? JSON.parse(attReceived.data) : attReceived.data
          return !!(attData?.code || attData?.att_code) && !!(attData?.expiry_date || attData?.att_expiry_date) || (stepData && stepData.status === 'completed')
        }
        case 'nclex_exam': {
          const examBooked = stepStatusMap['exam_date_booked']
          if (!examBooked || !examBooked.data) {
            return (stepData && stepData.status === 'completed')
          }
          const examData = typeof examBooked.data === 'string' ? JSON.parse(examBooked.data) : examBooked.data
          return !!(examData?.date || examData?.exam_date) && !!(examData?.time || examData?.exam_time) && !!(examData?.location || examData?.exam_location) || (stepData && stepData.status === 'completed')
        }
        default:
          return stepData && stepData.status === 'completed'
      }
    }
    
    // Step order
    const stepOrder = [
      { key: 'app_submission', name: 'Application Submission' },
      { key: 'credentialing', name: 'Credentialing' },
      { key: 'bon_application', name: 'BON Application' },
      { key: 'nclex_eligibility', name: 'NCLEX Eligibility' },
      { key: 'pearson_vue', name: 'Pearson VUE Application' },
      { key: 'att', name: 'ATT' },
      { key: 'nclex_exam', name: 'NCLEX Exam' }
    ]
    
    // Type assertion for application
    const typedApp = application as { updated_at?: string; created_at?: string; grit_app_id?: string | null }
    
    // Find latest update
    let latestUpdate = typedApp.updated_at || typedApp.created_at
    allSteps.forEach((step: any) => {
      const timestamps = []
      if (step.updated_at) timestamps.push(new Date(step.updated_at).getTime())
      if (step.completed_at) timestamps.push(new Date(step.completed_at).getTime())
      if (step.created_at) timestamps.push(new Date(step.created_at).getTime())
      if (timestamps.length > 0) {
        const maxTime = Math.max(...timestamps)
        const latestTime = latestUpdate ? new Date(latestUpdate).getTime() : 0
        if (maxTime > latestTime) {
          latestUpdate = step.completed_at || step.updated_at || step.created_at
        }
      }
    })
    
    // Find current progress
    let currentProgress = null
    let currentProgressStep = null
    for (let i = stepOrder.length - 1; i >= 0; i--) {
      const step = stepOrder[i]
      if (isStepCompleted(step.key)) {
        currentProgress = step.name
        currentProgressStep = step
        break
      }
    }
    
    if (!currentProgress && application.created_at) {
      currentProgress = 'Application Submission'
      currentProgressStep = { key: 'app_submission', name: 'Application Submission' }
    }
    
    // Find next step
    let nextStep = null
    const currentIndex = currentProgressStep ? stepOrder.findIndex(s => s.key === currentProgressStep.key) : -1
    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
      for (let i = currentIndex + 1; i < stepOrder.length; i++) {
        if (!isStepCompleted(stepOrder[i].key)) {
          nextStep = stepOrder[i].name
          break
        }
      }
    } else if (currentIndex === -1 && stepOrder.length > 0) {
      if (!isStepCompleted(stepOrder[0].key)) {
        nextStep = stepOrder[0].name
      }
    }
    
    // Check for exam result
    const quickResultsStep = allSteps.find((step: any) => step.step_key === 'quick_results') as any
    const quickResultsData = quickResultsStep && 'data' in quickResultsStep ? quickResultsStep.data : undefined
    const hasResult = !!(quickResultsData?.result)
    
    let currentProgressMessage = currentProgress || 'Not started'
    let nextStepMessage = nextStep
    
    if (hasResult) {
      const resultValue = quickResultsData.result
      if (resultValue === 'pass' || resultValue === 'Passed') {
        currentProgressMessage = 'Congratulations!, You Passed the NCLEX-RN Exam!'
        nextStepMessage = 'Wait for 1-2 weeks for your license to reflect in "Nursys"'
      } else if (resultValue === 'failed' || resultValue === 'Failed') {
        currentProgressMessage = 'You have failed the exam, Don\'t worry, you can take it again anytime.'
        nextStepMessage = 'Retake again!'
      } else {
        currentProgressMessage = `Exam Result: ${resultValue}`
      }
    } else if (stepOrder.every(step => isStepCompleted(step.key)) || application.status === 'completed') {
      nextStepMessage = null
    }
    
    // Get picture URL
    let picture_url = null
    if (application.picture_path) {
      try {
        picture_url = getFileUrl(application.picture_path)
      } catch (error) {
        picture_url = null
      }
    }
    
    const serviceType = resolveServiceType(application)
    const serviceState = resolveServiceState(application)

    const result = {
      ...application,
      email: displayEmail,
      current_progress: currentProgressMessage,
      next_step: nextStepMessage,
      latest_update: latestUpdate,
      picture_url: picture_url,
      service_type: serviceType,
      service_state: serviceState,
      grit_app_id: typedApp.grit_app_id || null
    }
    
    console.log('Tracking API: Successfully completed tracking for:', normalizedId)
    console.log('Tracking API: Result summary:', {
      name: `${result.first_name} ${result.last_name}`,
      current_progress: result.current_progress,
      next_step: result.next_step,
      email: result.email
    })
    
    return result
  },
}

// NCLEX Sponsorships API
export const sponsorshipsAPI = {
  getAll: async () => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    const query = supabase
      .from('nclex_sponsorships')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!admin) {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    const query = supabase
      .from('nclex_sponsorships')
      .select('*')
      .eq('id', id)
      .single()
    
    if (!admin) {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },

  create: async (sponsorshipData: any) => {
    // Allow anonymous users to create sponsorships
    // Try to get user ID if authenticated, otherwise null
    let userId: string | null = null
    try {
      userId = await getCurrentUserId()
    } catch {
      // User is not authenticated, allow anonymous sponsorship
      userId = null
    }
    
    const { data, error } = await supabase
      .from('nclex_sponsorships')
      .insert({
        ...sponsorshipData,
        user_id: userId,
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<Tables<'nclex_sponsorships'>>) => {
    const admin = await isAdmin()
    if (!admin) {
      // Non-admins can only update pending sponsorships
      const { data: existing } = await supabase
        .from('nclex_sponsorships')
        .select('status, user_id')
        .eq('id', id)
        .single()
      
      if (!existing) throw new Error('Sponsorship not found')
      
      const userId = await getCurrentUserId()
      if (existing.user_id !== userId) {
        throw new Error('Unauthorized')
      }
      
      if (existing.status !== 'pending') {
        throw new Error('Can only update pending sponsorships')
      }
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

  updateStatus: async (id: string, status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded', adminNotes?: string) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const userId = await getCurrentUserId()
    const updates: any = {
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }
    
    if (adminNotes !== undefined) {
      updates.admin_notes = adminNotes
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
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { error } = await supabase
      .from('nclex_sponsorships')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Donations API
export const donationsAPI = {
  getAll: async () => {
    const admin = await isAdmin()
    if (!admin) {
      // Non-admins can only see their own donations
      const userId = await getCurrentUserId()
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      
      if (!user) throw new Error('User not found')
      
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('donor_email', user.email)
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(error.message)
      return data || []
    }
    
    // Admins can see all donations
    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const admin = await isAdmin()
    
    const query = supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .single()
    
    if (!admin) {
      const userId = await getCurrentUserId()
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      
      if (user) {
        query.eq('donor_email', user.email)
      }
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },

  create: async (donationData: any) => {
    // Anyone can create donations (including anonymous)
    const { data, error } = await supabase
      .from('donations')
      .insert(donationData)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<Tables<'donations'>>) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { data, error } = await supabase
      .from('donations')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  updateStatus: async (id: string, status: 'pending' | 'completed' | 'failed' | 'refunded') => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { data, error } = await supabase
      .from('donations')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  getStats: async () => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { data, error } = await supabase
      .from('donations')
      .select('amount, status, currency')
    
    if (error) throw new Error(error.message)
    
    const donations = data || []
    const total = donations
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0)
    
    const count = donations.filter(d => d.status === 'completed').length
    
    return {
      total,
      count,
      pending: donations.filter(d => d.status === 'pending').length,
      failed: donations.filter(d => d.status === 'failed').length,
    }
  },

  getPublicStats: async () => {
    // Public stats - only shows completed donations (works for anonymous users)
    // Uses database function for better performance
    try {
      const { data, error } = await supabase.rpc('get_donation_statistics')
      
      if (error) {
        // Fallback to direct query if function doesn't exist
        const { data: donations, error: queryError } = await supabase
          .from('donations')
          .select('amount, status')
          .eq('status', 'completed')
        
        if (queryError) {
          console.error('Error fetching public donation stats:', queryError)
          return { total: 0, count: 0 }
        }
        
        const total = (donations || [])
          .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0)
        const count = donations?.length || 0
        
        return { total, count }
      }
      
      return {
        total: parseFloat(data?.completed_amount?.toString() || '0'),
        count: parseInt(data?.completed_donations?.toString() || '0'),
      }
    } catch (err) {
      console.error('Error getting public stats:', err)
      return { total: 0, count: 0 }
    }
  },

  createCheckoutSession: async (donationId: string, amount: number, retryCount = 0) => {
    const context = { operation: 'donationsAPI.createCheckoutSession', donationId, amount, retryCount }
    const maxRetries = 2
    const retryDelay = 1000 // 1 second
    
    try {
      // Get session if available (donations can be anonymous)
      let authHeader: string | undefined = undefined
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!sessionError && session?.access_token) {
          const { error: userError } = await supabase.auth.getUser()
          if (!userError) {
            authHeader = `Bearer ${session.access_token}`
          }
        }
      } catch (sessionCheckError) {
        // Treat as anonymous
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new AppError(
          'Payment system configuration error. Please contact support.',
          ErrorType.SERVER,
          ErrorSeverity.HIGH,
          false,
          undefined,
          context
        )
      }
      
      // Validate amount
      if (!amount || amount <= 0) {
        throw new AppError(
          'Invalid donation amount. Please enter a valid amount.',
          ErrorType.VALIDATION,
          ErrorSeverity.LOW,
          false,
          undefined,
          context
        )
      }
      
      // Ensure minimum amount ($0.50)
      if (amount < 0.5) {
        throw new AppError(
          'Minimum donation amount is $0.50. Please increase your donation amount.',
          ErrorType.VALIDATION,
          ErrorSeverity.LOW,
          false,
          undefined,
          context
        )
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/create-payment-intent`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      }
      
      if (authHeader) {
        headers['Authorization'] = authHeader
      } else {
        headers['Authorization'] = `Bearer ${supabaseAnonKey}`
      }
      
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      let response: Response
      try {
        response = await fetch(functionUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            donation_id: donationId,
            amount: amount * 100,
            use_checkout: true,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        // Handle timeout
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)))
            return donationsAPI.createCheckoutSession(donationId, amount, retryCount + 1)
          }
          throw new AppError(
            'Request timed out. Please check your connection and try again.',
            ErrorType.TIMEOUT,
            ErrorSeverity.MEDIUM,
            true,
            fetchError,
            context
          )
        }
        
        // Handle network errors
        if (fetchError.message?.includes('fetch') || fetchError.message?.includes('network')) {
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)))
            return donationsAPI.createCheckoutSession(donationId, amount, retryCount + 1)
          }
          throw new AppError(
            'Network error. Please check your internet connection and try again.',
            ErrorType.NETWORK,
            ErrorSeverity.MEDIUM,
            true,
            fetchError,
            context
          )
        }
        
        throw fetchError
      }
      
      if (!response.ok) {
        let errorBody: any = null
        let errorText = ''
        try {
          errorText = await response.text()
          try {
            errorBody = JSON.parse(errorText)
          } catch (parseError) {
            // Not JSON
          }
        } catch (readError) {
          // Failed to read
        }
        
        // Determine error type and message based on status code
        let errorType = ErrorType.VALIDATION
        let errorMessage = 'Failed to create checkout session'
        let isRetryable = false
        
        if (response.status === 400) {
          errorType = ErrorType.VALIDATION
          errorMessage = 'Invalid donation request. Please check your donation details.'
        } else if (response.status === 401 || response.status === 403) {
          errorType = ErrorType.AUTHORIZATION
          errorMessage = 'Authentication error. Please refresh the page and try again.'
        } else if (response.status === 404) {
          errorType = ErrorType.NOT_FOUND
          errorMessage = 'Donation not found. Please start over.'
        } else if (response.status === 429) {
          errorType = ErrorType.RATE_LIMIT
          errorMessage = 'Too many requests. Please wait a moment and try again.'
          isRetryable = true
        } else if (response.status >= 500) {
          errorType = ErrorType.SERVER
          errorMessage = 'Server error. Please try again in a moment.'
          isRetryable = true
        }
        
        // Extract user-friendly error message from response
        if (errorBody?.error) {
          const extractedError = typeof errorBody.error === 'string' 
            ? errorBody.error 
            : errorBody.error.message
          
          // Use extracted error if it's user-friendly
          if (extractedError && extractedError.length < 150 && !extractedError.includes('at ')) {
            errorMessage = extractedError
          }
        } else if (errorText && errorText.length < 150 && !errorText.includes('at ')) {
          errorMessage = errorText
        }
        
        // Retry on server errors
        if (isRetryable && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)))
          return donationsAPI.createCheckoutSession(donationId, amount, retryCount + 1)
        }
        
        throw new AppError(
          errorMessage,
          errorType,
          ErrorSeverity.MEDIUM,
          isRetryable,
          { status: response.status },
          { ...context, errorBody, errorText }
        )
      }
      
      let data: any
      try {
        data = await response.json()
      } catch (parseError) {
        throw new AppError(
          'Invalid response from server. Please try again.',
          ErrorType.SERVER,
          ErrorSeverity.HIGH,
          true,
          parseError,
          context
        )
      }
      
      if (data.error) {
        const errorMsg = typeof data.error === 'string' ? data.error : data.error.message || 'Checkout session creation failed'
        throw new AppError(
          errorMsg,
          ErrorType.VALIDATION,
          ErrorSeverity.MEDIUM,
          false,
          data,
          context
        )
      }
      
      if (!data.checkout_url) {
        throw new AppError(
          'Checkout session created but no URL returned. Please try again.',
          ErrorType.SERVER,
          ErrorSeverity.HIGH,
          true,
          data,
          context
        )
      }
      
      return {
        checkout_url: data.checkout_url,
        session_id: data.session_id,
      }
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err
      }
      throw normalizeError(err, context)
    }
  },

  createPaymentIntent: async (donationId: string, amount: number) => {
    const context = { operation: 'donationsAPI.createPaymentIntent', donationId, amount }
    
    try {
      // Get session if available (donations can be anonymous)
      // Check for valid session - if expired, treat as anonymous
      let authHeader: string | undefined = undefined
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // Only use session if it exists and is valid
        if (!sessionError && session?.access_token) {
          // Verify the token is still valid by checking if we can get the user
          // This prevents sending expired tokens
          const { error: userError } = await supabase.auth.getUser()
          if (!userError) {
            authHeader = `Bearer ${session.access_token}`
          }
        }
      } catch (sessionCheckError) {
        // If session check fails, treat as anonymous (no auth header)
        // This is fine for donations which can be anonymous
      }
      
      // Call Supabase Edge Function to create Stripe payment intent
      // For anonymous donations, don't send auth header
      // Use a direct fetch call to avoid Supabase client automatically attaching expired tokens
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing')
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/create-donation-payment-intent`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      }
      
      // Supabase Edge Functions require Authorization header
      // For anonymous requests, use the anon key as bearer token
      // For authenticated requests, use the user's access token
      if (authHeader) {
        headers['Authorization'] = authHeader
      } else {
        // For anonymous requests, send anon key as bearer token
        // This allows the Edge Function to be called without user authentication
        headers['Authorization'] = `Bearer ${supabaseAnonKey}`
      }
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          donation_id: donationId,
          amount: amount * 100, // Convert to cents
        }),
      })
      
      let data: any = null
      let error: any = null
      
      if (!response.ok) {
        // Try to parse error response - read body once
        let errorBody: any = null
        let errorText = ''
        try {
          errorText = await response.text()
          try {
            errorBody = JSON.parse(errorText)
          } catch (parseError) {
            // Not JSON, use text as is
          }
        } catch (readError) {
          // Failed to read body
        }
        
        // Extract error message from response
        let errorMessage = 'Failed to create payment intent'
        if (errorBody) {
          if (errorBody.error) {
            errorMessage = typeof errorBody.error === 'string' 
              ? errorBody.error 
              : errorBody.error.message || errorMessage
          } else if (errorBody.message) {
            errorMessage = errorBody.message
          }
        } else if (errorText && errorText.length < 500) {
          errorMessage = errorText
        }
        
        error = {
          message: errorMessage,
          status: response.status,
          context: { errorBody, errorText },
        }
      } else {
        // Parse success response
        data = await response.json()
      }
      
      if (error) {
        // Use the already extracted error message
        let errorMessage = error.message || 'Failed to create payment intent'
        let extractedError = error.context?.errorBody || null
        
        // For donations, preserve the actual error message from Edge Function
        // Don't misclassify validation errors (400) as authentication errors
        // Check the actual HTTP status code from the response
        const httpStatus = error.status || 400
        
        // Check if error message indicates it's from old Edge Function code
        // Old code requires auth and throws "Unauthorized: Invalid or expired token"
        const isOldFunctionError = errorMessage.includes('Unauthorized: Invalid or expired token') ||
                                   errorMessage.includes('Missing authorization header')
        
        // Only classify as auth error if it's actually a 401 status code
        // OR if it's clearly an auth error from the old function
        const isAuthError = httpStatus === 401 || (isOldFunctionError && httpStatus === 400)
        
        if (isAuthError && isOldFunctionError) {
          // This means the Edge Function hasn't been updated yet
          throw new AppError(
            'The payment service needs to be updated. Please contact support or try again later. (Edge Function update required)',
            ErrorType.SERVER,
            ErrorSeverity.HIGH,
            false,
            error,
            { ...context, step: 'invokeFunction', extractedError, httpStatus, isOldFunctionError: true }
          )
        } else if (isAuthError) {
          throw normalizeError(new Error(errorMessage), { ...context, step: 'invokeFunction', originalError: error })
        } else {
          // For non-auth errors (like validation errors), throw with the actual message
          // but still use AppError for consistency
          const errorType = httpStatus === 400 ? ErrorType.VALIDATION : 
                           httpStatus === 404 ? ErrorType.NOT_FOUND :
                           httpStatus && httpStatus >= 500 ? ErrorType.SERVER :
                           ErrorType.UNKNOWN
          
          const appError = new AppError(
            errorMessage,
            errorType,
            ErrorSeverity.MEDIUM,
            false,
            error,
            { ...context, step: 'invokeFunction', extractedError, httpStatus }
          )
          throw appError
        }
      }
      
      // Handle edge function error response (function executed but returned error)
      if (data && typeof data === 'object') {
        if (data.error) {
          const errorMsg = typeof data.error === 'string' 
            ? data.error 
            : data.error.message || data.error.error || 'Payment intent creation failed'
          throw normalizeError(new Error(errorMsg), { ...context, step: 'processResponse' })
        }
        
        // Edge function returns snake_case, convert to camelCase for consistency
        const clientSecret = data.client_secret || data.clientSecret
        const paymentIntentId = data.payment_intent_id || data.paymentIntentId
        
        if (!clientSecret) {
          throw normalizeError(
            new Error('Payment intent created but no client secret returned. Please contact support.'),
            { ...context, step: 'validateResponse' }
          )
        }
        
        return {
          client_secret: clientSecret,
          payment_intent_id: paymentIntentId,
        }
      }
      
      // No data returned
      throw normalizeError(
        new Error('No response from payment service. Please try again or contact support.'),
        { ...context, step: 'validateResponse' }
      )
    } catch (err: any) {
      if (err instanceof Error && err.message.includes('normalizeError')) {
        throw err
      }
      throw normalizeError(err, context)
    }
  },
}

// Partner Agencies API
export const partnerAgenciesAPI = {
  getAll: async (activeOnly: boolean = false) => {
    const admin = await isAdmin()
    
    const query = supabase
      .from('partner_agencies')
      .select('*')
      .order('name', { ascending: true })
    
    if (!admin || activeOnly) {
      query.eq('is_active', true)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { data, error } = await supabase
      .from('partner_agencies')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  create: async (agencyData: any) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { data, error } = await supabase
      .from('partner_agencies')
      .insert(agencyData)
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<any>) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
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
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
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
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    const query = supabase
      .from('career_applications')
      .select(`
        *,
        partner_agencies (
          id,
          name,
          email,
          contact_person_name,
          contact_person_email
        )
      `)
      .order('created_at', { ascending: false })
    
    if (!admin) {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
    const query = supabase
      .from('career_applications')
      .select(`
        *,
        partner_agencies (
          id,
          name,
          email,
          contact_person_name,
          contact_person_email,
          phone,
          website
        )
      `)
      .eq('id', id)
      .single()
    
    if (!admin) {
      query.eq('user_id', userId)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },

  create: async (applicationData: any) => {
    // Allow anonymous users to create career applications
    let userId: string | null = null
    try {
      userId = await getCurrentUserId()
    } catch {
      // User is not authenticated, allow anonymous application
      userId = null
    }
    
    const { data, error } = await supabase
      .from('career_applications')
      .insert({
        ...applicationData,
        user_id: userId,
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    
    // Increment applications count for the career if career_id is provided
    if (applicationData.career_id) {
      try {
        await supabase.rpc('increment_career_applications', { career_uuid: applicationData.career_id })
      } catch (err) {
        // Ignore errors in increment
        console.error('Error incrementing applications count:', err)
      }
    }
    
    return data
  },

  update: async (id: string, updates: Partial<any>) => {
    const admin = await isAdmin()
    if (!admin) {
      // Non-admins can only update pending applications
      const { data: existing } = await supabase
        .from('career_applications')
        .select('status, user_id')
        .eq('id', id)
        .single()
      
      if (!existing) throw new Error('Career application not found')
      
      const userId = await getCurrentUserId()
      if (existing.user_id !== userId) {
        throw new Error('Unauthorized')
      }
      
      if (existing.status !== 'pending') {
        throw new Error('Can only update pending applications')
      }
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

  updateStatus: async (
    id: string,
    status: 'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected',
    adminNotes?: string,
    partnerAgencyId?: string
  ) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const userId = await getCurrentUserId()
    const updates: any = {
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }
    
    if (adminNotes !== undefined) {
      updates.admin_notes = adminNotes
    }
    
    if (partnerAgencyId !== undefined) {
      updates.partner_agency_id = partnerAgencyId
      if (status === 'forwarded') {
        updates.forwarded_to_agency_at = new Date().toISOString()
      }
    }
    
    const { data, error } = await supabase
      .from('career_applications')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        partner_agencies (
          id,
          name,
          email,
          contact_person_name,
          contact_person_email,
          phone,
          website
        )
      `)
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  forwardToAgency: async (id: string, partnerAgencyId: string) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    // Get application and agency details
    const { data: application } = await supabase
      .from('career_applications')
      .select('*')
      .eq('id', id)
      .single()
    
    if (!application) throw new Error('Application not found')
    
    const { data: agency } = await supabase
      .from('partner_agencies')
      .select('*')
      .eq('id', partnerAgencyId)
      .single()
    
    if (!agency) throw new Error('Partner agency not found')
    
    // Update application status
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('career_applications')
      .update({
        status: 'forwarded',
        partner_agency_id: partnerAgencyId,
        forwarded_to_agency_at: new Date().toISOString(),
        forwarded_email_sent: false,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        partner_agencies (
          id,
          name,
          email,
          contact_person_name,
          contact_person_email,
          phone,
          website
        )
      `)
      .single()
    
    if (error) throw new Error(error.message)
    
    // Send email to partner agency (async, don't wait)
    try {
      const { sendEmail } = await import('./email-service')
      const emailSubject = `New Career Application from GritSync - ${application.first_name} ${application.last_name}`
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">New Career Application</h2>
          <p>Dear ${agency.contact_person_name || agency.name},</p>
          <p>We have received a new career application that has been forwarded to your agency.</p>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #111827; margin-bottom: 15px;">Applicant Information</h3>
            <p><strong>Name:</strong> ${application.first_name} ${application.last_name}</p>
            <p><strong>Email:</strong> ${application.email}</p>
            <p><strong>Phone:</strong> ${application.mobile_number}</p>
            ${application.date_of_birth ? `<p><strong>Date of Birth:</strong> ${application.date_of_birth}</p>` : ''}
            ${application.country ? `<p><strong>Country:</strong> ${application.country}</p>` : ''}
            ${application.nursing_school ? `<p><strong>Nursing School:</strong> ${application.nursing_school}</p>` : ''}
            ${application.graduation_date ? `<p><strong>Graduation Date:</strong> ${application.graduation_date}</p>` : ''}
            ${application.years_of_experience ? `<p><strong>Years of Experience:</strong> ${application.years_of_experience}</p>` : ''}
            ${application.license_number ? `<p><strong>License Number:</strong> ${application.license_number}</p>` : ''}
            ${application.license_state ? `<p><strong>License State:</strong> ${application.license_state}</p>` : ''}
          </div>
          
          <p>Please review this application and contact the applicant directly if interested.</p>
          <p>Best regards,<br>GritSync Team</p>
        </div>
      `
      
      const recipientEmail = agency.contact_person_email || agency.email
      sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: `New Career Application from GritSync\n\nApplicant: ${application.first_name} ${application.last_name}\nEmail: ${application.email}\nPhone: ${application.mobile_number}`,
      }).catch((emailError) => {
        console.error('Failed to send forwarding email:', emailError)
      })
      
      // Mark email as sent
      await supabase
        .from('career_applications')
        .update({ forwarded_email_sent: true })
        .eq('id', id)
    } catch (emailError) {
      console.error('Error sending forwarding email:', emailError)
      // Don't throw - email failure shouldn't break the forwarding
    }
    
    return data
  },

  delete: async (id: string) => {
    const admin = await isAdmin()
    if (!admin) throw new Error('Admin access required')
    
    const { error } = await supabase
      .from('career_applications')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Careers API
export const careersAPI = {
  getAll: async (includeInactive: boolean = false) => {
    const admin = await isAdmin()
    
    const query = supabase
      .from('careers')
      .select(`
        *,
        partner_agencies (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false })
    
    // Only show active careers to non-admins
    if (!admin && !includeInactive) {
      query.eq('is_active', true)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('careers')
      .select(`
        *,
        partner_agencies (
          id,
          name,
          email,
          phone,
          website
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) throw new Error(error.message)
    
    // Increment views count
    try {
      await supabase.rpc('increment_career_views', { career_uuid: id })
    } catch (err) {
      // Ignore errors in view increment
      console.error('Error incrementing views:', err)
    }
    
    return data
  },

  create: async (careerData: any) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Unauthorized: Only admins can create careers')
    }
    
    const userId = await getCurrentUserId()
    
    const { data, error } = await supabase
      .from('careers')
      .insert({
        ...careerData,
        created_by: userId,
      })
      .select('*')
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<any>) => {
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Unauthorized: Only admins can update careers')
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
    const admin = await isAdmin()
    if (!admin) {
      throw new Error('Unauthorized: Only admins can delete careers')
    }
    
    const { error } = await supabase
      .from('careers')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

