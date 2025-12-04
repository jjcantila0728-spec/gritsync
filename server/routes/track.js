import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Get Supabase client for tracking (uses service role key for public access)
const getSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured')
  }
  
  // Use service role key if available (for public tracking), otherwise use anon key
  const supabaseKey = supabaseServiceKey || supabaseAnonKey
  if (!supabaseKey) {
    throw new Error('Supabase key not configured')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

// Public endpoint for tracking applications by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const supabase = getSupabaseClient()
    
    // Check if ID is a GRIT APP ID (AP + 12 alphanumeric) or UUID
    const isGritAppId = /^AP[0-9A-Z]{12}$/.test(id.trim().toUpperCase())
    
    let application = null
    
    if (isGritAppId) {
      // Query by grit_app_id
      const normalizedId = id.trim().toUpperCase()
      const { data, error } = await supabase
        .from('applications')
        .select('id, first_name, last_name, email, status, created_at, updated_at, picture_path, user_id, grit_app_id')
        .eq('grit_app_id', normalizedId)
        .single()
      
      if (error || !data) {
        return res.status(404).json({ error: 'Application not found' })
      }
      
      application = data
    } else {
      // Query by UUID id
      const { data, error } = await supabase
        .from('applications')
        .select('id, first_name, last_name, email, status, created_at, updated_at, picture_path, user_id, grit_app_id')
        .eq('id', id)
        .single()
      
      if (error || !data) {
        return res.status(404).json({ error: 'Application not found' })
      }
      
      application = data
    }
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Get Gmail from processing account (default Gmail)
    const { data: gmailAccounts } = await supabase
      .from('processing_accounts')
      .select('email')
      .eq('application_id', application.id)
      .eq('account_type', 'gmail')
      .order('created_at', { ascending: true })
      .limit(1)
    
    // Use Gmail from processing account if available, otherwise use application email
    const displayEmail = (gmailAccounts && gmailAccounts.length > 0) ? gmailAccounts[0].email : application.email

    // Get all payments for this application
    const { data: payments } = await supabase
      .from('application_payments')
      .select('*')
      .eq('application_id', application.id)
    
    // Get processing accounts for Pearson VUE check
    const { data: processingAccounts } = await supabase
      .from('processing_accounts')
      .select('account_type')
      .eq('application_id', application.id)
    
    // Get all timeline steps for this application
    const { data: allSteps } = await supabase
      .from('application_timeline_steps')
      .select('step_key, step_name, status, data, completed_at, updated_at, created_at')
      .eq('application_id', application.id)
      .order('created_at', { ascending: true })
    
    // Create a map of step statuses
    // Parse data field if it's a JSON string (Supabase may store it as string)
    const stepStatusMap = {}
    const stepsArray = (allSteps || []).map(step => {
      // Parse data if it's a string
      if (step.data && typeof step.data === 'string') {
        try {
          step.data = JSON.parse(step.data)
        } catch (e) {
          // If parsing fails, keep as is
        }
      }
      return step
    })
    
    stepsArray.forEach(step => {
      stepStatusMap[step.step_key] = step
    })
    
    // Helper to get step status (matches timeline page logic)
    // This must be defined before isStepCompleted so it can be used both inside and outside
    const getStepStatus = (key) => {
      const step = stepStatusMap[key]
      return step?.status || 'pending'
    }
    
    // Helper function to check if a step is actually completed based on sub-steps
    // This matches the logic used in the timeline page (ApplicationDetail.tsx)
    const isStepCompleted = (stepKey) => {
      const stepData = stepStatusMap[stepKey]
      
      // Check sub-steps first (regardless of parent step status)
      switch (stepKey) {
        case 'app_submission': {
          // Match timeline page logic: getStepStatus('app_created') === 'completed' || !!application.created_at
          const appCreated = getStepStatus('app_created') === 'completed' || !!application.created_at
          
          // Match timeline page logic: getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path && application.diploma_path && application.passport_path)
          const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path && application.diploma_path && application.passport_path)
          
          // Match timeline page logic: getStepStatus('app_paid') === 'completed' || payments.some(p => p.status === 'paid' && p.payment_type === 'step1')
          const appPaid = getStepStatus('app_paid') === 'completed' || (payments && payments.some(p => p.status === 'paid' && (p.payment_type === 'step1' || p.payment_type === 'full')))
          
          const allSubStepsDone = appCreated && docsSubmitted && appPaid
          // Return true if all sub-steps are done OR if parent is explicitly marked completed
          return allSubStepsDone || (stepData && stepData.status === 'completed')
        }
        case 'credentialing': {
          // Match timeline page logic: getStepStatus('credentialing') === 'completed' || (all 3 sub-steps completed)
          const letterGenerated = getStepStatus('letter_generated') === 'completed'
          const letterSubmitted = getStepStatus('letter_submitted') === 'completed'
          const officialDocs = getStepStatus('official_docs_submitted') === 'completed'
          const allSubStepsDone = letterGenerated && letterSubmitted && officialDocs
          return (stepData && stepData.status === 'completed') || allSubStepsDone
        }
        case 'bon_application': {
          const mandatoryCourses = stepStatusMap['mandatory_courses']
          const form1Submitted = stepStatusMap['form1_submitted']
          // Match timeline page logic: check payment OR step status
          const appStep2Paid = getStepStatus('app_step2_paid') === 'completed' || (payments && payments.some(p => p.status === 'paid' && p.payment_type === 'step2'))
          const allSubStepsDone = (mandatoryCourses && mandatoryCourses.status === 'completed') &&
                                 (form1Submitted && form1Submitted.status === 'completed') &&
                                 appStep2Paid
          return allSubStepsDone || (stepData && stepData.status === 'completed')
        }
        case 'nclex_eligibility': {
          // Match timeline page logic: getStepStatus('nclex_eligibility_approved') === 'completed'
          const eligibilityApproved = getStepStatus('nclex_eligibility_approved') === 'completed'
          return eligibilityApproved || (stepData && stepData.status === 'completed')
        }
        case 'pearson_vue': {
          // Match timeline page logic: (getStepStatus('pearson_account_created') === 'completed' || processingAccounts.some(acc => acc.account_type === 'pearson_vue')) && getStepStatus('att_requested') === 'completed'
          const pearsonAccountCreated = getStepStatus('pearson_account_created') === 'completed' || 
                                       (processingAccounts && processingAccounts.some(acc => acc.account_type === 'pearson_vue'))
          const attRequested = getStepStatus('att_requested') === 'completed'
          const allSubStepsDone = pearsonAccountCreated && attRequested
          return allSubStepsDone || (stepData && stepData.status === 'completed')
        }
        case 'att': {
          // Match timeline page logic: check if att_received data has both code and expiry_date
          const attReceived = stepStatusMap['att_received']
          if (!attReceived || !attReceived.data) {
            return (stepData && stepData.status === 'completed')
          }
          const attData = typeof attReceived.data === 'string' ? JSON.parse(attReceived.data) : attReceived.data
          const hasAttCode = !!(attData?.code || attData?.att_code)
          const hasExpiryDate = !!(attData?.expiry_date || attData?.att_expiry_date)
          const hasCodeAndExpiry = hasAttCode && hasExpiryDate
          return hasCodeAndExpiry || (stepData && stepData.status === 'completed')
        }
        case 'nclex_exam': {
          // Match timeline page logic: check if exam_date_booked data has date, time, and location
          const examBooked = stepStatusMap['exam_date_booked']
          if (!examBooked || !examBooked.data) {
            return (stepData && stepData.status === 'completed')
          }
          const examData = typeof examBooked.data === 'string' ? JSON.parse(examBooked.data) : examBooked.data
          const hasExamDate = !!(examData?.date || examData?.exam_date)
          const hasExamTime = !!(examData?.time || examData?.exam_time)
          const hasLocation = !!(examData?.location || examData?.exam_location)
          const hasAllDetails = hasExamDate && hasExamTime && hasLocation
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
    const nextStepInstructions = {
      'credentialing': 'Generate your letter for school',
      'bon_application': 'Complete mandatory courses and submit Form 1',
      'nclex_eligibility': 'Wait for NCLEX eligibility approval',
      'pearson_vue': 'Create Pearson VUE account and request ATT',
      'att': 'Wait for ATT to be received',
      'nclex_exam': 'Schedule and take your NCLEX exam'
    }
    
    // ===== ALGORITHM: Calculate Latest Update, Current Progress, and Next Step from Timeline =====
    
    // 1. Find the latest update timestamp from all timeline steps
    let latestUpdate = null
    let latestUpdateTimestamp = null
    
    // Check all steps for the most recent updated_at or completed_at
    stepsArray.forEach(step => {
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
      latestUpdate = application.updated_at || application.created_at
    }
    
    // 2. Find the current progress (last completed step in order)
    // This matches the timeline page logic for determining current progress
    let currentProgress = null
    let currentProgressStep = null
    
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
    
    // If no step is completed yet but application exists, check if Application Submission is at least started
    // Match timeline page: appCreated || docsSubmitted || appPaid means it's at least initiated
    if (!currentProgress && application.created_at) {
      const appCreated = getStepStatus('app_created') === 'completed' || !!application.created_at
      const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path && application.diploma_path && application.passport_path)
      const appPaid = getStepStatus('app_paid') === 'completed' || (payments && payments.some(p => p.status === 'paid' && (p.payment_type === 'step1' || p.payment_type === 'full')))
      
      if (appCreated || docsSubmitted || appPaid) {
        currentProgress = 'Application Submission'
        currentProgressStep = { key: 'app_submission', name: 'Application Submission' }
      }
    }
    
    // 3. Find the next step (first pending step after the last completed step)
    let nextStep = null
    let nextStepInstruction = null
    let nextStepKey = null
    
    // Find the index of current progress in stepOrder
    let currentProgressIndex = -1
    for (let i = 0; i < stepOrder.length; i++) {
      if (stepOrder[i].key === currentProgressStep?.key) {
        currentProgressIndex = i
        break
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
          nextStepKey = nextStepInfo.key
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
          nextStepKey = firstStep.key
          nextStepInstruction = nextStepInstructions[firstStep.key] || null
        }
      }
    }
    
    // Get payment amount if application exists
    const { data: paidPayments } = await supabase
      .from('application_payments')
      .select('amount')
      .eq('application_id', application.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
    
    let paidAmount = null
    if (paidPayments && paidPayments.length > 0) {
      paidAmount = paidPayments[0].amount
    }
    
    // Check if timeline is completed (all steps are done)
    const isTimelineCompleted = stepOrder.every(step => isStepCompleted(step.key))
    
    // Build current progress message
    let currentProgressMessage = currentProgress || 'Not started'
    let nextStepMessage = null
    
    // Check for exam result FIRST (match timeline page logic)
    // Timeline page checks: quickResultsData?.result first, then quickResultsStep === 'completed'
    const quickResultsStep = stepsArray.find(step => step.step_key === 'quick_results')
    const quickResultsData = quickResultsStep?.data
    const hasResult = !!(quickResultsData?.result)
    
    // If exam result exists, show result (matches timeline page priority)
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
    } else if (isTimelineCompleted || application.status === 'completed') {
      // Timeline completed but no exam result yet
      // Keep current progress as is, but don't show next step
      nextStepMessage = null
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

    // Get picture URL if available
    let picture_url = null
    if (application.picture_path && application.user_id) {
      // picture_path format is typically "userId/filename" or just "filename"
      // Normalize backslashes to forward slashes for URL encoding
      const normalizedPath = application.picture_path.replace(/\\/g, '/')
      // For the tracking URL, we need to include the full path if it exists
      // Encode the entire path to handle special characters
      picture_url = `/api/track/${application.id}/picture/${encodeURIComponent(normalizedPath)}`
    }

    // Get service information
    const serviceType = 'NCLEX Processing'
    const serviceState = 'New York' // Based on display_name pattern

    res.json({
      ...application,
      email: displayEmail, // Override with Gmail from processing account
      current_progress: currentProgressMessage,
      next_step: nextStepMessage,
      latest_update: latestUpdate, // Latest update from timeline steps
      picture_url: picture_url,
      service_type: serviceType,
      service_state: serviceState,
      grit_app_id: application.grit_app_id || null
    })
  } catch (error) {
    logger.error('Error fetching application', error)
    res.status(500).json({ error: 'Failed to fetch application' })
  }
})

// Public endpoint for tracking images (no auth required)
// Use regex route to handle filename with path segments (e.g., userId/filename.png)
router.get(/^\/track\/([^\/]+)\/picture\/(.+)$/, async (req, res) => {
  try {
    // Extract id and filename from regex capture groups
    const id = req.params[0]
    const filenamePath = req.params[1] || ''
    
    if (!filenamePath) {
      return res.status(400).json({ error: 'Filename is required' })
    }
    
    // Decode the filename path in case it was URL encoded
    const decodedFilenamePath = decodeURIComponent(filenamePath)
    
    // Verify application exists using Supabase
    const supabase = getSupabaseClient()
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('user_id, picture_path')
      .eq('id', id)
      .single()
    
    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Verify the filename matches the application's picture
    if (!application.picture_path) {
      return res.status(404).json({ error: 'Picture not found' })
    }

    // picture_path format is "userId/filename" or just "filename"
    // The URL might have the full path or just the filename
    // We need to match the picture_path from the database
    // Normalize both paths to handle backslashes (Windows compatibility)
    const normalizedDecodedPath = decodedFilenamePath.replace(/\\/g, '/')
    const normalizedPicturePath = application.picture_path.replace(/\\/g, '/')
    
    // Check if the decoded path matches the picture_path (exact match or ends with it)
    const pathMatches = normalizedDecodedPath === normalizedPicturePath || 
                       normalizedPicturePath.endsWith(normalizedDecodedPath) ||
                       normalizedDecodedPath.endsWith(normalizedPicturePath.split('/').pop()) ||
                       normalizedDecodedPath.endsWith(normalizedPicturePath.split('\\').pop())
    
    if (!pathMatches) {
      return res.status(404).json({ error: 'Picture not found' })
    }

    // Build file path - picture_path is stored as "userId/filename" or just "filename"
    // Handle both forward slashes and backslashes (Windows compatibility)
    const normalizedPath = application.picture_path.replace(/\\/g, '/')
    const pathParts = normalizedPath.split('/')
    
    // Check if picture_path already includes userId (first part matches user_id)
    let filePath
    if (pathParts.length > 1 && pathParts[0] === application.user_id) {
      // picture_path already includes userId, use it directly
      filePath = path.join(__dirname, '..', 'uploads', normalizedPath)
    } else {
      // picture_path is just filename, add userId
      const filename = pathParts[pathParts.length - 1]
      filePath = path.join(__dirname, '..', 'uploads', application.user_id, filename)
    }
    
    if (!fs.existsSync(filePath)) {
      // Try alternative: if picture_path has userId, try with just filename
      if (pathParts.length > 1 && pathParts[0] === application.user_id) {
        const filename = pathParts[pathParts.length - 1]
        const altPath = path.join(__dirname, '..', 'uploads', application.user_id, filename)
        if (fs.existsSync(altPath)) {
          res.sendFile(altPath)
          return
        }
      }
      // Try with backslashes if the path was stored with backslashes
      if (application.picture_path.includes('\\')) {
        const altPath = path.join(__dirname, '..', 'uploads', application.picture_path)
        if (fs.existsSync(altPath)) {
          res.sendFile(altPath)
          return
        }
      }
      return res.status(404).json({ error: 'File not found' })
    }

    // Set cache headers for images (1 day cache)
    const stats = fs.statSync(filePath)
    res.set('Cache-Control', 'public, max-age=86400')
    res.set('Last-Modified', stats.mtime.toUTCString())
    res.set('ETag', `"${stats.mtime.getTime()}-${stats.size}"`)
    
    res.sendFile(filePath)
  } catch (error) {
    logger.error('Error serving tracking image', error)
    res.status(500).json({ error: 'Failed to serve image' })
  }
})

export default router


