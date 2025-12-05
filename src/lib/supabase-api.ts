import { supabase, handleSupabaseError } from './supabase'
import type { Database } from './database.types'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Helper to get current user ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
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
    if (error) throw new Error(error.message)
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
          
          // Check if we're at the last step (NCLEX Exam) and it's completed
          const lastStepKey = stepOrder[stepOrder.length - 1]?.key
          const isAtLastStep = currentProgressStep?.key === lastStepKey && isStepCompleted(lastStepKey)
          
          // Build current progress message
          let currentProgressMessage = currentProgress || 'Not started'
          let nextStepMessage: string | null = null
          
          // Check for exam result if timeline is completed or at last step
          const quickResultsStep = allSteps.find((step: any) => step.step_key === 'quick_results')
          const hasExamResult = quickResultsStep && quickResultsStep.data
          
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
          
          // Get Gmail account email from processing accounts
          let displayEmail = app.email
          try {
            const { data: gmailAccounts, error: gmailError } = await supabase
              .from('processing_accounts')
              .select('email')
              .eq('application_id', app.id)
              .eq('account_type', 'gmail')
              .limit(1)
            
            if (!gmailError && gmailAccounts && gmailAccounts.length > 0 && gmailAccounts[0]?.email) {
              displayEmail = gmailAccounts[0].email
            } else {
              // If no Gmail account exists, generate the email address
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
          
          return {
            ...app,
            email: displayEmail, // Use generated Gmail instead of user email
            current_progress: currentProgressMessage,
            next_step: nextStepMessage,
            progress_percentage: progressPercentage,
            completed_steps: completedItems,
            total_steps: totalItems,
            service_type: app.service_type || 'NCLEX Processing',
            service_state: app.service_state || 'New York',
          }
        } catch (error) {
          // Try to get or generate Gmail email even in error case
          let displayEmail = app.email
          try {
            const { data: gmailAccounts } = await supabase
              .from('processing_accounts')
              .select('email')
              .eq('application_id', app.id)
              .eq('account_type', 'gmail')
              .limit(1)
            
            if (gmailAccounts && gmailAccounts.length > 0 && gmailAccounts[0]?.email) {
              displayEmail = gmailAccounts[0].email
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
          
          return {
            ...app,
            email: displayEmail,
            current_progress: 'Not started',
            next_step: null,
            progress_percentage: 0,
            completed_steps: 0,
            total_steps: 0,
            service_type: app.service_type || 'NCLEX Processing',
            service_state: app.service_state || 'New York',
          }
        }
      })
    )
    
    return applicationsWithTimeline
  },

  getById: async (id: string) => {
    // Try to find by grit_app_id first (if it looks like AP + 12 alphanumeric)
    // Otherwise, fall back to UUID id
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(id)
    
    let query = supabase
      .from('applications')
      .select('*')
    
    if (isGritAppId) {
      query = query.eq('grit_app_id', id)
    } else {
      query = query.eq('id', id)
    }
    
    const { data, error } = await query.single()
    
    if (error) throw new Error(error.message)
    return data
  },

  create: async (applicationData: any, files?: { picture?: File; diploma?: File; passport?: File }) => {
    const userId = await getCurrentUserId()
    
    let picturePath = applicationData.picture_path
    let diplomaPath = applicationData.diploma_path
    let passportPath = applicationData.passport_path
    
    // Upload files to Supabase Storage if provided
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
    
    // Create application (grit_app_id will be generated by database default if not provided)
    const { data, error } = await supabase
      .from('applications')
      .insert({
        ...applicationData,
        grit_app_id: gritAppId, // Set GRIT APP ID
        user_id: userId,
        picture_path: picturePath,
        diploma_path: diplomaPath,
        passport_path: passportPath,
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  updateStatus: async (id: string, status: 'initiated' | 'in-progress' | 'rejected' | 'completed' | 'pending' | 'approved') => {
    // First, try to update without selecting (more reliable with RLS)
    const { error: updateError } = await supabase
      .from('applications')
      .update({ status })
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
      return { id, status } as any
    }
    
    return data
  },

  update: async (id: string, updates: Partial<Tables<'applications'>>) => {
    const { data, error } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) {
      // Handle the specific "Cannot coerce" error
      if (error.message.includes('Cannot coerce') || error.code === 'PGRST116') {
        // If single() fails, try without it (might return array)
        const { data: dataArray, error: arrayError } = await supabase
          .from('applications')
          .update(updates)
          .eq('id', id)
          .select('*')
        
        if (arrayError) throw new Error(arrayError.message)
        if (!dataArray || dataArray.length === 0) {
          throw new Error('Application not found')
        }
        return dataArray[0]
      }
      throw new Error(error.message)
    }
    return data
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
      return data || []
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
      const allQuotes = [...(userQuotes.data || []), ...(publicQuotes.data || [])]
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
        const matchingQuote = allQuotes?.find(quote => {
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
    return data
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
        const matchingQuote = allQuotes?.find(quote => {
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
    return data
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
    name?: string,
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
    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
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
    return data
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
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  },
}

// Notifications API
export const notificationsAPI = {
  getAll: async (unreadOnly?: boolean) => {
    const userId = await getCurrentUserId()
    
    const query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (unreadOnly) {
      query.eq('read', false)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  },

  getUnreadCount: async () => {
    const userId = await getCurrentUserId()
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    
    if (error) throw new Error(error.message)
    return count || 0
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
    
    // If email notifications are enabled for this type, send email
    if (shouldSendEmail && data) {
      try {
        // Get user information for email
        const { data: userData } = await supabase.auth.getUser()
        const userEmail = userData?.user?.email
        
        if (userEmail) {
          // Get user's full name if available
          const { data: userProfile } = await supabase
            .from('users')
            .select('full_name, first_name, last_name')
            .eq('id', userId)
            .single()
          
          const userName = userProfile?.full_name || 
                          (userProfile?.first_name && userProfile?.last_name 
                            ? `${userProfile.first_name} ${userProfile.last_name}` 
                            : userProfile?.first_name || 'User')
          
          // Import email service dynamically
          const { sendNotificationEmail } = await import('./email-service')
          
          // Send email asynchronously (don't wait for it to complete)
          sendNotificationEmail(userEmail, type, {
            userName,
            title,
            message,
            applicationId,
          }).catch((emailError) => {
            console.error('Failed to send notification email:', emailError)
            // Don't throw - email failure shouldn't break notification creation
          })
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError)
        // Don't throw - email failure shouldn't break notification creation
      }
    }
    
    return data
  },

  markAsRead: async (id: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  markAllAsRead: async () => {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    
    if (error) throw new Error(error.message)
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
    return data
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
    
    return data
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

  upload: async (type: 'picture' | 'diploma' | 'passport', file: File) => {
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
    if (existing) {
      // Update existing document
      const { data: updated, error: updateError } = await supabase
        .from('user_documents')
        .update({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
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
    return data
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
    if (existing) {
      // Update existing document
      const { data: updated, error: updateError } = await supabase
        .from('user_documents')
        .update({
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
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
    return data
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
    if (!admin && doc.user_id !== userId) {
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
      statusCode: error.statusCode,
      status: error.status,
      path: normalizedPath
    })
    
    // Provide more helpful error messages
    if (error.message?.includes('not found') || 
        error.message?.includes('Object not found') ||
        error.statusCode === 400 ||
        error.status === 400) {
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
    if (existingStep?.data && typeof existingStep.data === 'object') {
      mergedData = {
        ...existingStep.data,
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
    const stepName = existingStep?.step_name || stepNameMap[stepKey] || stepKey
    
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
    
    const { data: step, error } = await supabase
      .from('application_timeline_steps')
      .upsert(upsertData, {
        onConflict: 'application_id,step_key',
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return step
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
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },
}

// Helper function to generate Gmail address from name
// Format: first letter of firstname + first letter of first part of lastname + last part of lastname + "usrn"@gmail.com
// Example: joy jeric alburo cantila -> jacantilausrn@gmail.com
function generateGmailAddress(firstName: string, middleName: string | null, lastName: string): string {
  // Get first letter of first name (lowercase)
  const firstInitial = (firstName || '').trim().charAt(0).toLowerCase()
  
  // Get last name parts
  const lastNameParts = (lastName || '').trim().split(/\s+/).filter(part => part.trim())
  
  if (lastNameParts.length === 0) {
    // Fallback if no last name
    return `${firstInitial}usrn@gmail.com`
  }
  
  // Based on example "joy jeric alburo cantila" -> "jacantilausrn@gmail.com"
  // It seems to use: j (joy) + a (first letter of "alburo", first part of last name) + cantila (last part)
  let email: string
  if (lastNameParts.length > 1) {
    // Multiple parts in last name: use first letter of first part + last part
    const firstPartInitial = lastNameParts[0].charAt(0).toLowerCase()
    const lastPart = lastNameParts[lastNameParts.length - 1].toLowerCase()
    email = `${firstInitial}${firstPartInitial}${lastPart}usrn@gmail.com`
  } else {
    // Single part last name: use first letter of middle name if available, otherwise first letter of last name
    const middleInitial = (middleName || '').trim().charAt(0).toLowerCase()
    const lastPart = lastNameParts[0].toLowerCase()
    const fallbackInitial = lastPart.charAt(0).toLowerCase()
    email = `${firstInitial}${middleInitial || fallbackInitial}${lastPart}usrn@gmail.com`
  }
  
  return email
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
      .select('id, user_id, first_name, middle_name, last_name')
    
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
    
    // Use the actual UUID id for subsequent queries (not the GRIT APP ID)
    const actualApplicationId = application.id
    
    // Check if user owns the application or is admin
    if (!admin && application.user_id !== userId) {
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
    const existingGmail = existingAccounts.find(acc => acc.account_type === 'gmail')
    const existingPearson = existingAccounts.find(acc => acc.account_type === 'pearson_vue')
    
    // Get user's grit_id for password
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('grit_id')
      .eq('id', application.user_id)
      .single()
    
    // Generate password: "@GRiT" + numeric part of grit_id
    // Example: GRIT414821 -> @GRiT414821
    let password = ''
    if (user?.grit_id) {
      const gritId = user.grit_id
      // Extract numeric part (everything after "GRIT")
      const numericPart = gritId.replace(/^GRIT/i, '')
      password = `@GRiT${numericPart}`
    }
    
    // Generate Gmail address from application name
    const firstName = application.first_name || ''
    const middleName = application.middle_name || null
    const lastName = application.last_name || ''
    const gmailAddress = generateGmailAddress(firstName, middleName, lastName)
    
    // Create Gmail account if it doesn't exist
    if (!existingGmail) {
      try {
        if (password && firstName && lastName) {
          const { data: newGmailAccount, error: gmailError } = await supabase
            .from('processing_accounts')
            .insert({
              application_id: actualApplicationId,
              account_type: 'gmail',
              email: gmailAddress,
              password: password,
              status: 'inactive', // Inactive by default, must be activated by admin
              created_by: application.user_id,
            })
            .select()
            .single()
          
          // Silently handle duplicate errors (account already exists)
          if (gmailError && gmailError.code !== '23505' && !gmailError.message?.includes('duplicate') && !gmailError.message?.includes('unique')) {
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
    
    // Create Pearson Vue account if it doesn't exist (same email and password as Gmail)
    if (!existingPearson) {
      try {
        if (password && firstName && lastName) {
          const { data: newPearsonAccount, error: pearsonError } = await supabase
            .from('processing_accounts')
            .insert({
              application_id: actualApplicationId,
              account_type: 'pearson_vue',
              email: gmailAddress,
              password: password,
              status: 'inactive', // Inactive by default, must be activated by admin
              created_by: application.user_id,
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
    const uniqueAccounts = Array.from(
      new Map(existingAccounts.map(acc => [acc.id, acc])).values()
    )
    
    // Sort accounts: Gmail and Pearson Vue first, then custom accounts
    uniqueAccounts.sort((a, b) => {
      const order: { [key: string]: number } = { 'gmail': 1, 'pearson_vue': 2, 'custom': 3 }
      const aOrder = order[a.account_type] || 99
      const bOrder = order[b.account_type] || 99
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
    
    return uniqueAccounts
  },

  create: async (applicationId: string, accountData: {
    account_type: 'gmail' | 'pearson_vue' | 'custom'
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
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: string, updates: Partial<{
    account_type: 'gmail' | 'pearson_vue' | 'custom'
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
    const isSystemAccount = account.account_type === 'gmail' || account.account_type === 'pearson_vue'
    const isGmailAccount = account.account_type === 'gmail'
    
    // For Gmail accounts:
    // - Clients can update status and password for their own applications
    // - Admins can update all fields
    // For Pearson Vue accounts:
    // - Only admins can update them
    if (isSystemAccount) {
      if (!admin) {
        // Check if user owns the application
        const { data: application } = await supabase
          .from('applications')
          .select('user_id')
          .eq('id', account.application_id)
          .single()
        
        if (!application || application.user_id !== userId) {
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
        const { data: application } = await supabase
          .from('applications')
          .select('user_id')
          .eq('id', account.application_id)
          .single()
        
        if (!application || application.user_id !== userId) {
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
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
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
        approvedApps,
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
      if (approvedApps.error) {
        console.error('Error fetching approved apps:', approvedApps.error)
      }
      
      // Fallback: If count queries fail, fetch all and count manually
      let approvedCount = approvedApps.count ?? 0
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
      
      if (approvedCount === 0) {
        const { data: allApps, error: allAppsError } = await supabase
          .from('applications')
          .select('id, status')
        
        if (!allAppsError && allApps) {
          const manualApprovedCount = allApps.filter((app: any) => 
            app.status === 'completed' || app.status === 'Completed' || app.status === 'approved' || app.status === 'Approved'
          ).length
          if (manualApprovedCount > 0) {
            approvedCount = manualApprovedCount
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
        // Find applications that are not already marked as completed or approved
        const appIdsToCheck = allApps
          .filter((app: any) => {
            const status = app.status?.toLowerCase()
            return status !== 'completed' && status !== 'approved' && status !== 'rejected'
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
      
      // Combine approved and completed applications
      const totalApprovedCompleted = approvedCount + completedCount
      
      return {
        totalApplications: applications.count || 0,
        pendingApplications: pendingCount,
        approvedApplications: totalApprovedCompleted,
        rejectedApplications: rejectedApps.count || 0,
        totalQuotations: quotations.count || 0,
        pendingQuotations: pendingQuotes.count || 0,
        paidQuotations: paidQuotes.count || 0,
        totalClients: users.count || 0,
        revenue: revenue,
        applications: applications.count || 0,
        pending: pendingCount,
        approved: totalApprovedCompleted,
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
      
      // Get approved and completed counts for client
      // We need to check both status and timeline steps to determine completion
      const [completedApps, allUserApps] = await Promise.all([
        supabase.from('applications').select('id', { count: 'exact' }).eq('user_id', userId).in('status', ['completed', 'approved']),
        supabase.from('applications').select('id, status').eq('user_id', userId),
      ])
      
      // Count applications with status 'completed' or 'approved'
      // Use a Set to avoid double counting if an app has both statuses (shouldn't happen, but safe)
      const statusCompletedAppIds = new Set<string>()
      if (allUserApps.data) {
        allUserApps.data.forEach((app: any) => {
          if (app.status === 'completed' || app.status === 'Completed' || 
              app.status === 'approved' || app.status === 'Approved') {
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
      
      const totalApprovedCompleted = completedCount
      
      return {
        totalApplications: applications.count || 0,
        totalQuotations: quotations.count || 0,
        applications: applications.count || 0,
        quotations: quotations.count || 0,
        approved: totalApprovedCompleted,
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
    data?.forEach(setting => {
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
      data?.forEach(setting => {
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
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
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
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
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
      if (application.user_id !== userId) {
        const admin = await isAdmin()
        if (!admin) {
          throw new Error('Unauthorized')
        }
      }
      
      actualApplicationId = application.id
    }
    
    const { data, error } = await supabase
      .from('application_payments')
      .insert({
        application_id: actualApplicationId,
        user_id: userId,
        payment_type: paymentType,
        amount,
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },


  createPaymentIntent: async (paymentId: string) => {
    try {
      // Get the current session to ensure we have auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Not authenticated. Please log in and try again.')
      }
      
      // Call Supabase Edge Function for Stripe payment intent creation
      // The Supabase client should automatically include the Authorization header
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { payment_id: paymentId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      
      // Handle Supabase client error (network, auth, etc.)
      if (error) {
        // Try to extract error message from response body
        let errorMessage = 'Failed to connect to payment service'
        
        // If context is a Response object, try to read the body
        if (error.context && error.context instanceof Response) {
          try {
            // Try to read the response body
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
            console.error('Error reading response body:', readError)
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
        
        throw new Error(errorMessage)
      }
      
      // Handle edge function error response (function executed but returned error)
      if (data && typeof data === 'object') {
        if (data.error) {
          const errorMsg = typeof data.error === 'string' 
            ? data.error 
            : data.error.message || data.error.error || 'Payment intent creation failed'
          throw new Error(errorMsg)
        }
        
        // Edge function returns snake_case, convert to camelCase for consistency
        const clientSecret = data.client_secret || data.clientSecret
        const paymentIntentId = data.payment_intent_id || data.paymentIntentId
        
        if (!clientSecret) {
          throw new Error('Payment intent created but no client secret returned. Please contact support.')
        }
        
        return {
          clientSecret,
          paymentIntentId,
        }
      }
      
      // No data returned
      throw new Error('No response from payment service. Please try again or contact support.')
    } catch (err: any) {
      
      // If it's already an Error object, re-throw it
      if (err instanceof Error) {
        throw err
      }
      
      // Handle different error formats
      const errorMessage = err?.message || err?.error?.message || err?.error || 'Failed to create payment intent. Please try again or contact support.'
      throw new Error(errorMessage)
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
      updateData.status = 'paid'
      if (stripePaymentIntentId) {
        updateData.stripe_payment_intent_id = stripePaymentIntentId
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
    if (data && data.status === 'paid') {
      try {
        // Get the payment with application_id
        const { data: paymentWithApp } = await supabase
          .from('application_payments')
          .select('application_id, payment_type, amount')
          .eq('id', paymentId)
          .single()
        
        if (paymentWithApp) {
          const applicationId = paymentWithApp.application_id
          const paymentType = paymentWithApp.payment_type
          
          // Get all paid payments for this application to calculate total
          const { data: allPayments } = await supabase
            .from('application_payments')
            .select('amount, payment_type')
            .eq('application_id', applicationId)
            .eq('status', 'paid')
          
          // Calculate total amount paid
          const totalAmountPaid = allPayments?.reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0) || 0
          
          // Update timeline step based on payment type
          if (paymentType === 'step1') {
            await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
              amount: paymentWithApp.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentMethod,
              completed_at: new Date().toISOString()
            })
          } else if (paymentType === 'step2') {
            await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
              amount: paymentWithApp.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentMethod,
              completed_at: new Date().toISOString()
            })
          } else if (paymentType === 'full') {
            // For full payment, update both step1 and step2 as completed
            await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
              amount: paymentWithApp.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentMethod,
              completed_at: new Date().toISOString()
            })
            await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
              amount: paymentWithApp.amount,
              total_amount_paid: totalAmountPaid,
              payment_method: paymentMethod,
              completed_at: new Date().toISOString()
            })
          }
        }
      } catch {
        // Silently handle timeline update errors
      }
    }
    
    return data
  },

  getByApplication: async (applicationId: string) => {
    const userId = await getCurrentUserId()
    const admin = await isAdmin()
    
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
      
      // Check if user owns the application or is admin
      if (!admin && application.user_id !== userId) {
        throw new Error('Unauthorized')
      }
      
      actualApplicationId = application.id
    } else {
      // If it's a UUID, verify the user has access to this application
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('user_id')
        .eq('id', applicationId)
        .single()
      
      if (appError || !application) {
        throw new Error(appError?.message || 'Application not found')
      }
      
      // Check if user owns the application or is admin
      if (!admin && application.user_id !== userId) {
        throw new Error('Unauthorized')
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
    return data
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
    if (data && paymentBefore && paymentBefore.status !== 'paid' && data.user_id) {
      const paymentTypeNames = {
        'step1': 'Step 1',
        'step2': 'Step 2',
        'full': 'Full Payment'
      }
      
      await notificationsAPI.create(
        'Payment Approved',
        `Your ${paymentTypeNames[data.payment_type] || 'payment'} of $${parseFloat(data.amount.toString()).toFixed(2)} has been approved and processed successfully.`,
        'payment',
        data.application_id
      )
    }
    
    // Auto-update timeline steps when payment is approved
    if (data) {
      try {
        const applicationId = data.application_id
        const paymentType = data.payment_type
        
        // Get all paid payments for this application to calculate total
        const { data: allPayments } = await supabase
          .from('application_payments')
          .select('amount, payment_type')
          .eq('application_id', applicationId)
          .eq('status', 'paid')
        
        // Calculate total amount paid
        const totalAmountPaid = allPayments?.reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0) || 0
        
        // Update timeline step based on payment type
        if (paymentType === 'step1') {
          await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
            amount: data.amount,
            total_amount_paid: totalAmountPaid,
            payment_method: data.payment_method || 'mobile_banking',
            completed_at: new Date().toISOString()
          })
        } else if (paymentType === 'step2') {
          await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
            amount: data.amount,
            total_amount_paid: totalAmountPaid,
            payment_method: data.payment_method || 'mobile_banking',
            completed_at: new Date().toISOString()
          })
        } else if (paymentType === 'full') {
          // For full payment, update both step1 and step2 as completed
          await timelineStepsAPI.update(applicationId, 'app_paid', 'completed', {
            amount: data.amount,
            total_amount_paid: totalAmountPaid,
            payment_method: data.payment_method || 'stripe',
            completed_at: new Date().toISOString()
          })
          await timelineStepsAPI.update(applicationId, 'app_step2_paid', 'completed', {
            amount: data.amount,
            total_amount_paid: totalAmountPaid,
            payment_method: data.payment_method || 'stripe',
            completed_at: new Date().toISOString()
          })
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
    if (data && paymentBefore && paymentBefore.status !== 'failed' && data.user_id) {
      const paymentTypeNames = {
        'step1': 'Step 1',
        'step2': 'Step 2',
        'full': 'Full Payment'
      }
      
      const rejectionMessage = reason 
        ? `Your ${paymentTypeNames[data.payment_type] || 'payment'} of $${parseFloat(data.amount.toString()).toFixed(2)} has been rejected. Reason: ${reason}`
        : `Your ${paymentTypeNames[data.payment_type] || 'payment'} of $${parseFloat(data.amount.toString()).toFixed(2)} has been rejected. Please contact support for more information.`
      
      await notificationsAPI.create(
        'Payment Rejected',
        rejectionMessage,
        'payment',
        data.application_id
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
        .select('id, first_name, last_name, email, status, created_at, updated_at, picture_path, user_id, grit_app_id')
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
        .select('id, first_name, last_name, email, status, created_at, updated_at, picture_path, user_id, grit_app_id')
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
    
    // Get Gmail from processing account
    const gmailAccounts = allProcessingAccounts.filter(acc => acc.account_type === 'gmail')
    const displayEmail = (gmailAccounts && gmailAccounts.length > 0) ? gmailAccounts[0].email : application.email
    
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
          const appStep2Paid = getStepStatus('app_step2_paid') === 'completed' || (allPayments && allPayments.some((p: any) => p.status === 'paid' && p.payment_type === 'step2'))
          return (mandatoryCourses && form1Submitted && appStep2Paid) || (stepData && stepData.status === 'completed')
        }
        case 'nclex_eligibility': {
          return getStepStatus('nclex_eligibility_approved') === 'completed' || (stepData && stepData.status === 'completed')
        }
        case 'pearson_vue': {
          const pearsonAccountCreated = getStepStatus('pearson_account_created') === 'completed' || (allProcessingAccounts && allProcessingAccounts.some((acc: any) => acc.account_type === 'pearson_vue'))
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
    
    // Find latest update
    let latestUpdate = application.updated_at || application.created_at
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
    const quickResultsStep = allSteps.find((step: any) => step.step_key === 'quick_results')
    const quickResultsData = quickResultsStep?.data
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
    
    const result = {
      ...application,
      email: displayEmail,
      current_progress: currentProgressMessage,
      next_step: nextStepMessage,
      latest_update: latestUpdate,
      picture_url: picture_url,
      service_type: 'NCLEX Processing', // Default value (not stored in DB)
      service_state: 'New York', // Default value (not stored in DB)
      grit_app_id: application.grit_app_id || null
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

