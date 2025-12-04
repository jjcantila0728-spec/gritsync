import express from 'express'
import path from 'path'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken, upload } from '../middleware/index.js'
import { generateId, generateApplicationId, generateGmailAddress, generatePaymentId } from '../utils/index.js'
import { logger } from '../utils/logger.js'
import { createNotification } from '../utils/notifications.js'

const router = express.Router()

router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    
    let query = supabase
      .from('applications')
      .select('id, first_name, last_name, status, created_at, email, updated_at')

    if (req.user.role !== 'admin') {
      query = query.eq('user_id', req.user.id)
    }

    query = query.order('created_at', { ascending: false })

    const { data: applications, error } = await query
    
    if (error) {
      throw error
    }
    
    // Define step order and names
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
    const nextStepInstructions = {
      'credentialing': 'Generate your letter for school',
      'bon_application': 'Complete mandatory courses and submit Form 1',
      'nclex_eligibility': 'Wait for NCLEX eligibility approval',
      'pearson_vue': 'Create Pearson VUE account and request ATT',
      'att': 'Wait for ATT to be received',
      'nclex_exam': 'Schedule and take your NCLEX exam'
    }
    
    // For each application, calculate current progress and next step
    // First, get all related data in parallel
    const applicationIds = applications.map(app => app.id)
    
    // Get all processing accounts
    const { data: allAccounts } = await supabase
      .from('processing_accounts')
      .select('application_id, email, account_type')
      .in('application_id', applicationIds)
    
    // Get all timeline steps
    const { data: allSteps } = await supabase
      .from('application_timeline_steps')
      .select('application_id, step_key, step_name, status, data, completed_at, updated_at, created_at')
      .in('application_id', applicationIds)
    
    // Get all payments
    const { data: allPayments } = await supabase
      .from('application_payments')
      .select('*')
      .in('application_id', applicationIds)
    
    // Create lookup maps
    const accountsByAppId = {}
    allAccounts?.forEach(acc => {
      if (!accountsByAppId[acc.application_id]) {
        accountsByAppId[acc.application_id] = []
      }
      accountsByAppId[acc.application_id].push(acc)
    })
    
    const stepsByAppId = {}
    allSteps?.forEach(step => {
      if (!stepsByAppId[step.application_id]) {
        stepsByAppId[step.application_id] = []
      }
      stepsByAppId[step.application_id].push(step)
    })
    
    const paymentsByAppId = {}
    allPayments?.forEach(payment => {
      if (!paymentsByAppId[payment.application_id]) {
        paymentsByAppId[payment.application_id] = []
      }
      paymentsByAppId[payment.application_id].push(payment)
    })
    
    const applicationsWithSteps = applications.map(app => {
      // Get Gmail account email from processing accounts
      const appAccounts = accountsByAppId[app.id] || []
      const gmailAccount = appAccounts.find(acc => acc.account_type === 'gmail')
      
      // Use Gmail email if available, otherwise use application email
      const displayEmail = gmailAccount ? gmailAccount.email : app.email
      
      // Get all timeline steps for this application
      const allSteps = stepsByAppId[app.id] || []
      
      // Get all payments for this application
      const payments = paymentsByAppId[app.id] || []
      
      // Create a map of step statuses
      const stepStatusMap = {}
      allSteps.forEach(step => {
        stepStatusMap[step.step_key] = step
      })
      
      // Helper function to check if a step is actually completed based on sub-steps
      const isStepCompleted = (stepKey) => {
        const stepData = stepStatusMap[stepKey]
        
        // Check sub-steps first (regardless of parent step status)
        switch (stepKey) {
          case 'app_submission': {
            const appCreated = stepStatusMap['app_created']
            const docsSubmitted = stepStatusMap['documents_submitted']
            const appPaid = stepStatusMap['app_paid'] || payments.some(p => p.status === 'paid' && p.payment_type === 'step1')
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
            const appStep2Paid = stepStatusMap['app_step2_paid'] || payments.some(p => p.status === 'paid' && p.payment_type === 'step2')
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
      
      // ===== ALGORITHM: Calculate Latest Update, Current Progress, and Next Step from Timeline =====
      
      // 1. Find the latest update timestamp from all timeline steps
      let latestUpdate = null
      let latestUpdateTimestamp = null
      
      // Check all steps for the most recent updated_at or completed_at
      allSteps.forEach(step => {
        const timestamps = []
        if (step.updated_at) timestamps.push({ time: new Date(step.updated_at).getTime(), value: step.updated_at })
        if (step.completed_at) timestamps.push({ time: new Date(step.completed_at).getTime(), value: step.completed_at })
        if (step.created_at) timestamps.push({ time: new Date(step.created_at).getTime(), value: step.created_at })
        
        if (timestamps.length > 0) {
          const maxTimestamp = Math.max(...timestamps.map(t => t.time))
          if (!latestUpdateTimestamp || maxTimestamp > latestUpdateTimestamp) {
            latestUpdateTimestamp = maxTimestamp
            // Use the field that has the max timestamp
            const maxTimestampObj = timestamps.find(t => t.time === maxTimestamp)
            latestUpdate = maxTimestampObj ? maxTimestampObj.value : (step.completed_at || step.updated_at || step.created_at)
          }
        }
      })
      
      // If no timeline steps, use application updated_at or created_at
      if (!latestUpdate) {
        latestUpdate = app.updated_at || app.created_at
      }
      
      // 2. Find the current progress (last completed step in order)
      let currentProgress = null
      let currentProgressStep = null
      let paidAmount = null
      
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
      
      // Get payment amount if application exists (already fetched in batch above)
      const appPayments = payments.filter(p => p.status === 'paid')
      if (appPayments.length > 0) {
        // Get the most recent paid payment
        const sortedPayments = appPayments.sort((a, b) => 
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
        )
        paidAmount = sortedPayments[0].amount
      }
      
      // 3. Find the next step (first pending step after the last completed step)
      let nextStep = null
      let nextStepInstruction = null
      
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
      
      // Check if timeline is completed (all steps are done)
      const isTimelineCompleted = stepOrder.every(step => isStepCompleted(step.key))
      
      // Build current progress message
      let currentProgressMessage = currentProgress || 'Not started'
      let nextStepMessage = null
      
      // If timeline is completed, check exam result
      if (isTimelineCompleted || app.status === 'completed') {
        const quickResultsStep = allSteps.find(step => step.step_key === 'quick_results')
        if (quickResultsStep && quickResultsStep.data) {
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
        }
      } else {
        // Handle payment amount for non-completed applications
        if (paidAmount && (currentProgress === 'Application Submission' || !currentProgress)) {
          currentProgressMessage += `, Application paidAmount: $${parseFloat(paidAmount).toFixed(2)}`
        }
        
        // Build next step message for non-completed applications
        if (nextStep) {
          nextStepMessage = nextStep
          if (nextStepInstruction) {
            nextStepMessage += `, ${nextStepInstruction}`
          }
        }
      }
      
      // Calculate progress percentage based on all main steps and sub-steps
      // Define all steps with their sub-steps (matching the timeline structure)
      const allStepsWithSubSteps = [
        {
          mainKey: 'app_submission',
          mainName: 'Application Submission',
          subSteps: [
            { key: 'app_created', checkFn: () => !!app.created_at },
            { key: 'documents_submitted', checkFn: () => {
              // Check if application has all required documents
              // Note: We need to fetch full application data for this check
              // For now, we'll check if documents exist based on timeline step or assume they're submitted if app exists
              // This could be enhanced to fetch application details in batch if needed
              return true // Simplified - documents are required for application creation
            }},
            { key: 'app_paid', checkFn: () => {
              // Check if payment exists (already fetched in batch above)
              return payments.some(p => p.status === 'paid')
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
              // Check if Pearson Vue account exists (already fetched in batch above)
              const appAccounts = accountsByAppId[app.id] || []
              return appAccounts.some(acc => acc.account_type === 'pearson_vue')
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
        const mainStepData = stepStatusMap[mainStep.mainKey]
        if (mainStepData && mainStepData.status === 'completed') {
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
      
      const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
      
      // Get service information (default to NCLEX Processing for now)
      const serviceType = 'NCLEX Processing'
      const serviceState = 'New York'
      
      // Get GRIT APP ID if it exists (will be fetched in batch above if needed)
      // Note: grit_app_id field may not exist in Supabase schema
      const appData = null // Will be handled in batch query if needed
      
      return {
        ...app,
        display_name: 'NCLEX APPLICATION, NEWYORK STATE BOARD OF NURSING',
        email: displayEmail,
        current_progress: currentProgressMessage,
        next_step: nextStepMessage,
        latest_update: latestUpdate,
        progress_percentage: progressPercentage,
        completed_steps: completedItems,
        total_steps: totalItems,
        service_type: serviceType,
        service_state: serviceState,
        grit_app_id: appData?.grit_app_id || null
      }
    })
    
    res.json(applicationsWithSteps)
  } catch (error) {
    logger.error('Error fetching applications', error)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
})

// Check if user is a retaker (has previous applications)
// IMPORTANT: This route must come BEFORE /:id to avoid route conflicts
router.get('/check-retaker', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { count, error } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
    
    if (error) {
      throw error
    }
    
    const isRetaker = (count || 0) > 0
    res.json({ isRetaker })
  } catch (error) {
    logger.error('Error checking retaker status', error)
    res.status(500).json({ error: 'Failed to check retaker status' })
  }
})

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data: application, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (error || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Check permissions
    if (req.user.role !== 'admin' && application.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(application)
  } catch (error) {
    logger.error('Error fetching application', error)
    res.status(500).json({ error: 'Failed to fetch application' })
  }
})

router.post('/', authenticateToken, upload.fields([
  { name: 'picture', maxCount: 1 },
  { name: 'diploma', maxCount: 1 },
  { name: 'passport', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files
    if (!files.picture || !files.diploma || !files.passport) {
      return res.status(400).json({ error: 'All documents are required' })
    }

    const {
      first_name, middle_name, last_name, mobile_number, email, gender, marital_status, single_full_name,
      date_of_birth, birth_place,
      house_number, street_name, city, province, country, zipcode,
      elementary_school, elementary_city, elementary_province, elementary_country,
      elementary_years_attended, elementary_start_date, elementary_end_date,
      high_school, high_school_city, high_school_province, high_school_country,
      high_school_years_attended, high_school_start_date, high_school_end_date,
      high_school_graduated, high_school_diploma_type, high_school_diploma_date,
      nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
      nursing_school_years_attended, nursing_school_start_date, nursing_school_end_date,
      nursing_school_major, nursing_school_diploma_date,
      signature, payment_type
    } = req.body

    const supabase = getSupabaseAdmin()
    const id = await generateApplicationId()
    const picturePath = path.join(req.user.id, files.picture[0].filename)
    const diplomaPath = path.join(req.user.id, files.diploma[0].filename)
    const passportPath = path.join(req.user.id, files.passport[0].filename)

    // Build application data object - Supabase schema is known, so we can directly insert
    const applicationData = {
      id,
      user_id: req.user.id,
      first_name: first_name || null,
      middle_name: middle_name || null,
      last_name: last_name || null,
      mobile_number: mobile_number || null,
      email: email || null,
      gender: gender || null,
      marital_status: marital_status || null,
      single_full_name: marital_status === 'single' ? (single_full_name || null) : null,
      date_of_birth: date_of_birth || null,
      birth_place: birth_place || null,
      house_number: house_number || null,
      street_name: street_name || null,
      city: city || null,
      province: province || null,
      country: country || null,
      zipcode: zipcode || null,
      elementary_school: elementary_school || null,
      elementary_city: elementary_city || null,
      elementary_province: elementary_province || null,
      elementary_country: elementary_country || null,
      elementary_years_attended: elementary_years_attended || null,
      elementary_start_date: elementary_start_date || null,
      elementary_end_date: elementary_end_date || null,
      high_school: high_school || null,
      high_school_city: high_school_city || null,
      high_school_province: high_school_province || null,
      high_school_country: high_school_country || null,
      high_school_years_attended: high_school_years_attended || null,
      high_school_start_date: high_school_start_date || null,
      high_school_end_date: high_school_end_date || null,
      high_school_graduated: high_school_graduated || null,
      high_school_diploma_type: high_school_diploma_type || null,
      high_school_diploma_date: high_school_diploma_date || null,
      nursing_school: nursing_school || null,
      nursing_school_city: nursing_school_city || null,
      nursing_school_province: nursing_school_province || null,
      nursing_school_country: nursing_school_country || null,
      nursing_school_years_attended: nursing_school_years_attended || null,
      nursing_school_start_date: nursing_school_start_date || null,
      nursing_school_end_date: nursing_school_end_date || null,
      nursing_school_major: nursing_school_major || null,
      nursing_school_diploma_date: nursing_school_diploma_date || null,
      picture_path: picturePath,
      diploma_path: diplomaPath,
      passport_path: passportPath,
      signature: signature || null,
      payment_type: payment_type || null,
      status: 'pending'
    }

    const { error: insertError } = await supabase
      .from('applications')
      .insert(applicationData)

    if (insertError) {
      throw insertError
    }

    // Sync all application data to user_details
    try {
      const userDetailsData = {
        user_id: req.user.id,
        first_name: first_name || null,
        middle_name: middle_name || null,
        last_name: last_name || null,
        mobile_number: mobile_number || null,
        email: email || null,
        gender: gender || null,
        marital_status: marital_status || null,
        single_full_name: marital_status === 'single' ? (single_full_name || null) : null,
        date_of_birth: date_of_birth || null,
        birth_place: birth_place || null,
        house_number: house_number || null,
        street_name: street_name || null,
        city: city || null,
        province: province || null,
        country: country || null,
        zipcode: zipcode || null,
        elementary_school: elementary_school || null,
        elementary_city: elementary_city || null,
        elementary_province: elementary_province || null,
        elementary_country: elementary_country || null,
        elementary_years_attended: elementary_years_attended || null,
        elementary_start_date: elementary_start_date || null,
        elementary_end_date: elementary_end_date || null,
        high_school: high_school || null,
        high_school_city: high_school_city || null,
        high_school_province: high_school_province || null,
        high_school_country: high_school_country || null,
        high_school_years_attended: high_school_years_attended || null,
        high_school_start_date: high_school_start_date || null,
        high_school_end_date: high_school_end_date || null,
        high_school_graduated: high_school_graduated || null,
        high_school_diploma_type: high_school_diploma_type || null,
        high_school_diploma_date: high_school_diploma_date || null,
        nursing_school: nursing_school || null,
        nursing_school_city: nursing_school_city || null,
        nursing_school_province: nursing_school_province || null,
        nursing_school_country: nursing_school_country || null,
        nursing_school_years_attended: nursing_school_years_attended || null,
        nursing_school_start_date: nursing_school_start_date || null,
        nursing_school_end_date: nursing_school_end_date || null,
        nursing_school_major: nursing_school_major || null,
        nursing_school_diploma_date: nursing_school_diploma_date || null,
        signature: signature || null,
        payment_type: payment_type || null
      }

      // Upsert user_details (insert or update)
      const { error: userDetailsError } = await supabase
        .from('user_details')
        .upsert(userDetailsData, { onConflict: 'user_id' })

      if (userDetailsError) {
        logger.error('Error syncing application data to user_details', userDetailsError)
        // Don't fail the application creation if sync fails
      }
      
      // Update full_name in users table
      if (first_name || last_name) {
        const fullName = [first_name, middle_name, last_name].filter(Boolean).join(' ').trim()
        if (fullName) {
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({ full_name: fullName })
            .eq('id', req.user.id)
          
          if (userUpdateError) {
            logger.error('Error updating user full_name', userUpdateError)
          }
        }
      }
    } catch (syncError) {
      logger.error('Error syncing application data to user_details', syncError)
      // Don't fail the application creation if sync fails
    }

    // Auto-create Gmail and Pearson Vue accounts
    try {
      // Get user's grit_id to use as password
      const { data: user } = await supabase
        .from('users')
        .select('grit_id')
        .eq('id', req.user.id)
        .single()
      
      if (user && user.grit_id) {
        const password = user.grit_id // Use GRIT ID as password (e.g., GRIT825846)
        
        // Generate Gmail address from name
        const gmailAddress = generateGmailAddress(first_name, middle_name, last_name)
        
        // Check if accounts already exist for this application
        const { data: existingAccounts } = await supabase
          .from('processing_accounts')
          .select('id, account_type')
          .eq('application_id', id)
          .in('account_type', ['gmail', 'pearson_vue'])
        
        const existingGmail = existingAccounts?.find(acc => acc.account_type === 'gmail')
        const existingPearson = existingAccounts?.find(acc => acc.account_type === 'pearson_vue')
        
        // Create Gmail account if it doesn't exist
        if (!existingGmail) {
          const gmailAccountId = generateId()
          const { error: gmailError } = await supabase
            .from('processing_accounts')
            .insert({
              id: gmailAccountId,
              application_id: id,
              account_type: 'gmail',
              email: gmailAddress,
              password,
              created_by: req.user.id
            })
          
          if (gmailError) {
            logger.error('Error creating Gmail account during application creation', gmailError)
            // Don't fail the application creation if account creation fails
          }
        }
        
        // Create Pearson Vue account if it doesn't exist (same email and password as Gmail)
        if (!existingPearson) {
          const pearsonAccountId = generateId()
          const { error: pearsonError } = await supabase
            .from('processing_accounts')
            .insert({
              id: pearsonAccountId,
              application_id: id,
              account_type: 'pearson_vue',
              email: gmailAddress,
              password,
              created_by: req.user.id
            })
          
          if (pearsonError) {
            logger.error('Error creating Pearson Vue account during application creation', pearsonError)
            // Don't fail the application creation if account creation fails
          }
        }
      }
    } catch (accountError) {
      logger.error('Error auto-creating processing accounts', accountError)
      // Don't fail the application creation if account creation fails
    }

    res.json({ id, message: 'Application submitted successfully' })
  } catch (error) {
    logger.error('Error creating application', error)
    res.status(500).json({ 
      error: 'Failed to create application',
      details: error.message || 'Unknown error'
    })
  }
})

router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { status } = req.body
    const supabase = getSupabaseAdmin()
    
    // Get current application to check if status changed
    const { data: currentApp, error: fetchError } = await supabase
      .from('applications')
      .select('status, user_id, first_name, last_name')
      .eq('id', req.params.id)
      .single()
    
    if (fetchError || !currentApp) {
      return res.status(404).json({ error: 'Application not found' })
    }
    
    const previousStatus = currentApp.status
    
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', req.params.id)
    
    if (error) {
      throw error
    }
    
    // Create notification if status changed
    if (previousStatus !== status && currentApp.user_id) {
      const statusMessages = {
        'approved': 'Your application has been approved! 🎉',
        'rejected': 'Your application has been rejected',
        'pending': 'Your application is now pending review',
        'in_progress': 'Your application is now in progress',
        'completed': 'Your application has been completed',
        'initiated': 'Your application has been initiated'
      }
      
      const appName = currentApp.first_name && currentApp.last_name
        ? `${currentApp.first_name} ${currentApp.last_name}`
        : 'Your application'
      
      const message = statusMessages[status] || `Your application status has been changed to ${status}`
      
      await createNotification(
        currentApp.user_id,
        req.params.id,
        'status_change',
        'Application Status Updated',
        message
      )
    }
    
    res.json({ message: 'Application updated successfully' })
  } catch (error) {
    logger.error('Error updating application', error)
    res.status(500).json({ error: 'Failed to update application' })
  }
})

router.post('/:id/payments', authenticateToken, async (req, res) => {
  try {
    const { payment_type, amount } = req.body
    const applicationId = req.params.id
    const supabase = getSupabaseAdmin()

    // Verify application exists and belongs to user
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    if (req.user.role !== 'admin' && application.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Validate payment type
    if (!['step1', 'step2', 'full'].includes(payment_type)) {
      return res.status(400).json({ error: 'Invalid payment type' })
    }

    // Check if payment already exists for this type
    const { data: existing } = await supabase
      .from('application_payments')
      .select('*')
      .eq('application_id', applicationId)
      .eq('payment_type', payment_type)
      .eq('status', 'paid')
      .single()

    if (existing) {
      return res.status(400).json({ error: 'Payment already completed for this type' })
    }

    const paymentId = await generatePaymentId()

    const { data: payment, error: insertError } = await supabase
      .from('application_payments')
      .insert({
        id: paymentId,
        application_id: applicationId,
        user_id: req.user.id,
        payment_type,
        amount: parseFloat(amount),
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    res.json({ 
      id: paymentId,
      application_id: applicationId,
      payment_type,
      amount,
      status: 'pending'
    })
  } catch (error) {
    logger.error('Error creating payment', error)
    res.status(500).json({ error: 'Failed to create payment' })
  }
})

router.get('/:id/payments', authenticateToken, async (req, res) => {
  try {
    const applicationId = req.params.id
    const supabase = getSupabaseAdmin()

    // Verify application exists and belongs to user
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    if (req.user.role !== 'admin' && application.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { data: payments, error } = await supabase
      .from('application_payments')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    res.json(payments || [])
  } catch (error) {
    logger.error('Error fetching payments', error)
    res.status(500).json({ error: 'Failed to fetch payments' })
  }
})

router.get('/:id/processing-accounts', authenticateToken, async (req, res) => {
  try {
    const applicationId = req.params.id
    const supabase = getSupabaseAdmin()

    // Verify application exists and belongs to user
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    if (req.user.role !== 'admin' && application.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get existing accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('processing_accounts')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })

    if (accountsError) {
      throw accountsError
    }

    let accountsList = accounts || []

    // Ensure Gmail and Pearson Vue accounts exist (create if they don't)
    const existingGmail = accountsList.find(acc => acc.account_type === 'gmail')
    const existingPearson = accountsList.find(acc => acc.account_type === 'pearson_vue')

    // Get user's grit_id for password
    const { data: user } = await supabase
      .from('users')
      .select('grit_id')
      .eq('id', application.user_id)
      .single()
    
    const password = user?.grit_id || ''

    // Generate Gmail address from application name
    const firstName = application.first_name || ''
    const middleName = application.middle_name || ''
    const lastName = application.last_name || ''
    const gmailAddress = generateGmailAddress(firstName, middleName, lastName)

    // Create Gmail account if it doesn't exist
    if (!existingGmail) {
      try {
        if (password && firstName && lastName) {
          const gmailAccountId = generateId()
          const { data: newGmailAccount, error: gmailError } = await supabase
            .from('processing_accounts')
            .insert({
              id: gmailAccountId,
              application_id: applicationId,
              account_type: 'gmail',
              email: gmailAddress,
              password,
              status: 'active',
              created_by: application.user_id
            })
            .select()
            .single()
          
          if (!gmailError && newGmailAccount) {
            accountsList.push(newGmailAccount)
          }
        }
      } catch (error) {
        logger.error('Error creating Gmail account', error)
      }
    }

    // Create Pearson Vue account if it doesn't exist (same email and password as Gmail)
    if (!existingPearson) {
      try {
        if (password && firstName && lastName) {
          const pearsonAccountId = generateId()
          const { data: newPearsonAccount, error: pearsonError } = await supabase
            .from('processing_accounts')
            .insert({
              id: pearsonAccountId,
              application_id: applicationId,
              account_type: 'pearson_vue',
              email: gmailAddress,
              password,
              status: 'active',
              created_by: application.user_id
            })
            .select()
            .single()
          
          if (!pearsonError && newPearsonAccount) {
            accountsList.push(newPearsonAccount)
          }
        }
      } catch (error) {
        logger.error('Error creating Pearson Vue account', error)
      }
    }

    // Sort accounts: Gmail and Pearson Vue first, then custom accounts
    accountsList.sort((a, b) => {
      const order = { 'gmail': 1, 'pearson_vue': 2, 'custom': 3 }
      const aOrder = order[a.account_type] || 99
      const bOrder = order[b.account_type] || 99
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })

    logger.debug('Returning processing accounts', { count: accountsList.length })
    res.json(accountsList)
  } catch (error) {
    logger.error('Error fetching processing accounts', error)
    res.status(500).json({ error: 'Failed to fetch processing accounts' })
  }
})

router.post('/:id/processing-accounts', authenticateToken, async (req, res) => {
  try {
    const applicationId = req.params.id
    const { account_type, name, link, email, password, security_question_1, security_question_2, security_question_3 } = req.body
    const supabase = getSupabaseAdmin()

    logger.debug('Creating processing account', {
      applicationId,
      userId: req.user.id,
      userRole: req.user.role,
      accountType: account_type,
      hasName: !!name,
      hasEmail: !!email,
      hasPassword: !!password
    })

    // Verify application exists
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    logger.debug('Application found', {
      applicationId: application.id,
      applicationUserId: application.user_id,
      applicationUserIdType: typeof application.user_id,
      requestUserId: req.user.id,
      requestUserIdType: typeof req.user.id,
      userOwnsApplication: String(application.user_id) === String(req.user.id)
    })

    // Check permissions: admins can add any account type, users can only add custom accounts
    if (req.user.role !== 'admin') {
      // Users can only add accounts to their own applications
      // Compare as strings to avoid type mismatch issues
      if (String(application.user_id) !== String(req.user.id)) {
        logger.warn('Permission denied: User does not own application', {
          userId: req.user.id,
          applicationUserId: application.user_id
        })
        return res.status(403).json({ error: 'Access denied: You can only add accounts to your own applications' })
      }
      // Users can only add custom account type
      // If account_type is provided and it's not 'custom', reject it
      // If account_type is not provided or is 'custom', allow it (will default to 'custom')
      if (account_type && account_type !== 'custom') {
        logger.warn('Permission denied: User tried to add non-custom account type', { account_type })
        return res.status(403).json({ error: 'Users can only add custom accounts' })
      }
    }

    // Determine account type: if not provided or user is adding, default to 'custom'
    // For non-admin users, always use 'custom' regardless of what was sent
    const finalAccountType = (req.user.role === 'admin' && account_type) ? account_type : 'custom'

    // Validate input based on account type
    if (finalAccountType === 'custom') {
      // Custom accounts require name, email/username, and password
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email/username, and password are required for custom accounts' })
      }
    } else {
      // Admin accounts (gmail, pearson_vue) require account_type, email, and password
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }
      if (!['gmail', 'pearson_vue'].includes(finalAccountType)) {
        return res.status(400).json({ error: 'Invalid account type. Must be gmail, pearson_vue, or custom' })
      }
    }

    const accountId = generateId()
    const createdBy = req.user.id

    const { data: account, error: insertError } = await supabase
      .from('processing_accounts')
      .insert({
        id: accountId,
        application_id: applicationId,
        account_type: finalAccountType,
        name: name || null,
        link: link || null,
        email,
        password,
        security_question_1: security_question_1 || null,
        security_question_2: security_question_2 || null,
        security_question_3: security_question_3 || null,
        status: 'active',
        created_by: createdBy
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    res.status(201).json(account)
  } catch (error) {
    logger.error('Error creating processing account', error)
    res.status(500).json({ error: 'Failed to create processing account' })
  }
})

router.put('/:id/processing-accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const { id: applicationId, accountId } = req.params
    const { account_type, name, link, email, password, security_question_1, security_question_2, security_question_3, status } = req.body
    const supabase = getSupabaseAdmin()

    // Verify account exists and belongs to application
    const { data: account, error: accountError } = await supabase
      .from('processing_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('application_id', applicationId)
      .single()
    
    if (accountError || !account) {
      return res.status(404).json({ error: 'Processing account not found' })
    }

    // Check permissions: admins can update any account
    // Users can update accounts for their own applications (including auto-created Gmail/Pearson Vue)
    if (req.user.role !== 'admin') {
      // Verify the application belongs to the user
      const { data: application } = await supabase
        .from('applications')
        .select('user_id')
        .eq('id', applicationId)
        .single()
      
      if (!application || String(application.user_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You can only update accounts for your own applications' })
      }
      
      // Users can update any account type for their own applications
      // (This allows them to edit Gmail/Pearson Vue accounts that were auto-created)
    }

    // Determine account type
    const finalAccountType = account_type || account.account_type

    // Validate input based on account type
    if (finalAccountType === 'custom') {
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email/username, and password are required for custom accounts' })
      }
    } else {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }
      if (!['gmail', 'pearson_vue'].includes(finalAccountType)) {
        return res.status(400).json({ error: 'Invalid account type. Must be gmail, pearson_vue, or custom' })
      }
    }

    const { error: updateError } = await supabase
      .from('processing_accounts')
      .update({
        account_type: finalAccountType,
        name: name || null,
        link: link || null,
        email,
        password,
        security_question_1: security_question_1 || null,
        security_question_2: security_question_2 || null,
        security_question_3: security_question_3 || null,
        status: status || account.status || 'active'
      })
      .eq('id', accountId)
      .eq('application_id', applicationId)

    if (updateError) {
      throw updateError
    }

    const { data: updatedAccount, error: fetchError } = await supabase
      .from('processing_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (fetchError) {
      throw fetchError
    }

    res.json(updatedAccount)
  } catch (error) {
    logger.error('Error updating processing account', error)
    res.status(500).json({ error: 'Failed to update processing account' })
  }
})

router.delete('/:id/processing-accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const { id: applicationId, accountId } = req.params
    const supabase = getSupabaseAdmin()

    // Verify account exists and belongs to application
    const { data: account, error: accountError } = await supabase
      .from('processing_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('application_id', applicationId)
      .single()
    
    if (accountError || !account) {
      return res.status(404).json({ error: 'Processing account not found' })
    }

    // Check permissions: admins can delete any account, users can only delete their own custom accounts
    if (req.user.role !== 'admin') {
      // Users can only delete accounts they created
      if (String(account.created_by) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You can only delete accounts you created' })
      }
      // Users can only delete custom accounts
      if (account.account_type !== 'custom') {
        return res.status(403).json({ error: 'You can only delete custom accounts' })
      }
    }

    const { error: deleteError } = await supabase
      .from('processing_accounts')
      .delete()
      .eq('id', accountId)
      .eq('application_id', applicationId)

    if (deleteError) {
      throw deleteError
    }

    res.json({ message: 'Processing account deleted successfully' })
  } catch (error) {
    logger.error('Error deleting processing account', error)
    res.status(500).json({ error: 'Failed to delete processing account' })
  }
})

router.get('/:id/timeline-steps', authenticateToken, async (req, res) => {
  try {
    const applicationId = req.params.id
    const supabase = getSupabaseAdmin()

    // Verify application exists and belongs to user
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    if (req.user.role !== 'admin' && application.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { data: steps, error } = await supabase
      .from('application_timeline_steps')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    // Supabase JSONB columns are automatically parsed, but we'll handle it safely
    res.json((steps || []).map(step => ({
      ...step,
      data: typeof step.data === 'string' ? JSON.parse(step.data) : step.data
    })))
  } catch (error) {
    logger.error('Error fetching timeline steps', error)
    res.status(500).json({ error: 'Failed to fetch timeline steps' })
  }
})

router.put('/:id/timeline-steps/:stepKey', authenticateToken, async (req, res) => {
  try {
    const { id: applicationId, stepKey } = req.params
    const { status, data } = req.body
    const supabase = getSupabaseAdmin()

    // Only admins can update timeline steps
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update timeline steps' })
    }

    // Get application to find the user_id
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Verify step exists or create it
    const { data: existingStep } = await supabase
      .from('application_timeline_steps')
      .select('*')
      .eq('application_id', applicationId)
      .eq('step_key', stepKey)
      .single()
    
    const previousStatus = existingStep ? existingStep.status : null
    const stepName = stepKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    
    let step
    
    if (!existingStep) {
      // Create new step
      const stepId = generateId()
      const completedAt = status === 'completed' ? new Date().toISOString() : null
      const { data: newStep, error: insertError } = await supabase
        .from('application_timeline_steps')
        .insert({
          id: stepId,
          application_id: applicationId,
          step_key: stepKey,
          step_name: stepName,
          status: status || 'pending',
          data: data || null, // Supabase handles JSONB directly
          completed_at: completedAt
        })
        .select()
        .single()
      
      if (insertError) {
        throw insertError
      }
      step = newStep
    } else {
      // Update existing step
      const completedAt = status === 'completed' 
        ? (existingStep.completed_at || new Date().toISOString()) 
        : (status === 'pending' ? null : existingStep.completed_at)
      
      const updateData = {
        completed_at: completedAt
      }
      
      if (status !== undefined) {
        updateData.status = status
      }
      if (data !== undefined) {
        updateData.data = data // Supabase handles JSONB directly
      }
      
      const { data: updatedStep, error: updateError } = await supabase
        .from('application_timeline_steps')
        .update(updateData)
        .eq('application_id', applicationId)
        .eq('step_key', stepKey)
        .select()
        .single()
      
      if (updateError) {
        throw updateError
      }
      step = updatedStep
    }

    // Create notification if status changed
    if (previousStatus !== step.status && application.user_id) {
      if (step.status === 'completed') {
        await createNotification(
          application.user_id,
          applicationId,
          'timeline_update',
          'Timeline Step Completed',
          `The step "${stepName}" has been completed for your application.`
        )
      } else if (step.status === 'pending' && previousStatus === 'completed') {
        await createNotification(
          application.user_id,
          applicationId,
          'timeline_update',
          'Timeline Step Updated',
          `The step "${stepName}" has been marked as pending.`
        )
      }
    }

    res.json({
      ...step,
      data: typeof step.data === 'string' ? JSON.parse(step.data) : step.data
    })
  } catch (error) {
    logger.error('Error updating timeline step', error)
    res.status(500).json({ error: 'Failed to update timeline step' })
  }
})

export default router
