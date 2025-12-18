/**
 * Document Compilation Worker Edge Function
 * 
 * This worker processes document compilation jobs:
 * 1. Normalize images (fetch and validate)
 * 2. Convert images to PDFs
 * 3. Merge all PDFs in order
 * 4. Store final PDF
 * 5. Update job status with download URL
 * 
 * Can be called:
 * - Via HTTP with a job ID (on-demand processing)
 * - Via cron/scheduled to process pending jobs
 * - Automatically from compile-documents orchestrator
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { 
  processDocumentCompilation, 
  DocumentInfo 
} from './worker.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-service-role-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessJobRequest {
  jobId?: string // If provided, process specific job
  processNext?: boolean // If true, process next pending job
}

// Helper to fetch file from storage with retry
async function fetchFileWithRetry(
  supabase: any,
  filePath: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Blob | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600)

      if (urlError) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
          continue
        }
        return null
      }

      const response = await fetch(signedUrlData.signedUrl)
      if (!response.ok) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
          continue
        }
        return null
      }

      return await response.blob()
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        continue
      }
    }
  }
  return null
}

// Helper to determine file type
function getFileType(fileName: string): { type: 'pdf' | 'image' | 'unknown', extension: string } {
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  const pdfExtensions = ['pdf']

  if (pdfExtensions.includes(extension)) {
    return { type: 'pdf', extension }
  } else if (imageExtensions.includes(extension)) {
    return { type: 'image', extension }
  } else {
    return { type: 'unknown', extension }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }
  
  const startTime = Date.now()
  const MAX_EXECUTION_TIME = 240000 // 4 minutes (240 seconds) for worker

  const checkTimeout = () => {
    const elapsed = Date.now() - startTime
    if (elapsed > MAX_EXECUTION_TIME) {
      throw new Error('Worker execution timeout')
    }
  }

  // Declare variables at function scope for error handling
  let jobIdForCleanup: string | null = null
  let job: any = null

  try {
    console.log('[WORKER] === Document Compilation Worker Started ===')
    
    // This worker is called internally by compile-documents orchestrator
    // We accept any request (Supabase platform may validate, but we don't block)
    // Use service role key from custom header or environment for database operations
    const serviceRoleKeyHeader = req.headers.get('x-service-role-key')
    const serviceRoleKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Use service role key from header if provided, otherwise from env
    // This allows internal calls to use service role for database operations
    const effectiveServiceRoleKey = serviceRoleKeyHeader || serviceRoleKeyEnv
    
    console.log('[WORKER] Request received')
    console.log('[WORKER] Service role key from header:', !!serviceRoleKeyHeader)
    console.log('[WORKER] Service role key from env:', !!serviceRoleKeyEnv)
    console.log('[WORKER] Effective service role key available:', !!effectiveServiceRoleKey)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // Use service role key from header (if provided by orchestrator) or from env
    const supabaseServiceKey = effectiveServiceRoleKey || (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let requestBody: ProcessJobRequest = {}
    try {
      requestBody = await req.json()
    } catch {
      // If no body, process next pending job
      requestBody = { processNext: true }
    }

    // Get job to process
    if (requestBody.jobId) {
      // Process specific job
      console.log(`[WORKER] Processing job: ${requestBody.jobId}`)
      const { data, error } = await supabase
        .from('document_compilation_jobs')
        .select('*')
        .eq('id', requestBody.jobId)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, error: `Job not found: ${requestBody.jobId}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (data.status !== 'pending' && data.status !== 'processing') {
        return new Response(
          JSON.stringify({ success: false, error: `Job already ${data.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      job = data
      jobIdForCleanup = job.id
      
      // Update status to processing
      await supabase.rpc('update_compilation_job_status', {
        p_job_id: job.id,
        p_status: 'processing',
      })
    } else if (requestBody.processNext) {
      // Get next pending job from queue
      console.log('[WORKER] Getting next pending job from queue')
      const { data, error } = await supabase.rpc('get_next_pending_compilation_job')

      if (error || !data || data.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No pending jobs' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      job = data[0]
      jobIdForCleanup = job.id
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Must provide jobId or processNext: true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[WORKER] Processing job ${job.id} for application ${job.application_id}`)

    const { applicationId, userId, coverLetterBlob } = {
      applicationId: job.application_id,
      userId: job.user_id,
      coverLetterBlob: job.cover_letter_blob,
    }

    // ============================================================================
    // STEP 1: GET COVER LETTER DOCUMENT
    // ============================================================================
    console.log('[WORKER] [STEP 1] Getting cover letter document')
    checkTimeout()

    const getCoverLetterDocument = async (): Promise<any | null> => {
      // 1. If provided in job, use it
      if (coverLetterBlob && coverLetterBlob.trim() !== '') {
        console.log('[WORKER] Cover letter provided in job')
        return {
          file_path: 'cover_letter_provided',
          file_name: 'cover_letter.pdf',
          document_type: 'cover_letter',
          isBase64: true,
          base64Data: coverLetterBlob,
        }
      }

      // 2. Check if cover letter exists in user_documents
      console.log('[WORKER] Checking for cover letter in user_documents...')
      const { data: coverLetterDocs } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', userId)
        .in('document_type', ['cover_letter', 'additional_cover_letter'])
        .order('uploaded_at', { ascending: false })
        .limit(1)

      if (coverLetterDocs && coverLetterDocs.length > 0) {
        console.log(`[WORKER] Found cover letter: ${coverLetterDocs[0].file_path}`)
        return coverLetterDocs[0]
      }

      // 3. Generate cover letter if not found
      console.log('[WORKER] Cover letter not found, attempting to generate...')
      const { data: applicationData } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .single()

      if (applicationData) {
        const generateUrl = `${supabaseUrl}/functions/v1/generate-cover-letter`
        const generateResponse = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
          body: JSON.stringify({ applicationData }),
        })

        if (generateResponse.ok) {
          const generateData = await generateResponse.json()
          if (generateData.success && generateData.pdf) {
            console.log('[WORKER] Cover letter generated successfully')
            return {
              file_path: 'cover_letter_generated',
              file_name: 'cover_letter.pdf',
              document_type: 'cover_letter',
              isBase64: true,
              base64Data: generateData.pdf,
            }
          }
        }
      }

      return null
    }

    const coverLetterDoc = await getCoverLetterDocument()
    if (!coverLetterDoc) {
      await supabase.rpc('update_compilation_job_status', {
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: 'Cover Letter is required but could not be found or generated',
      })
      return new Response(
        JSON.stringify({ success: false, error: 'Cover Letter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================================
    // STEP 2: FETCH ALL USER DOCUMENTS
    // ============================================================================
    console.log('[WORKER] [STEP 2] Fetching all user documents')
    checkTimeout()

    const { data: userDocs, error: docsError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })

    if (docsError) {
      throw new Error(`Failed to fetch documents: ${docsError.message}`)
    }

    // ============================================================================
    // STEP 3: BUILD DOCUMENT MAP
    // ============================================================================
    console.log('[WORKER] [STEP 3] Building document map')
    checkTimeout()

    const requiredDocTypes = [
      { type: 'cover_letter', name: 'Cover Letter', key: 'cover_letter' },
      { type: 'additional_g1145', name: 'Form G-1145', key: 'g1145' },
      { type: 'additional_i765', name: 'Form I-765', key: 'i765' },
      { type: 'ead_2x2_picture', name: '2x2 Picture', key: 'ead_2x2_picture' },
      { type: 'ead_passport', name: 'Passport', key: 'passport' },
      { type: 'ead_h4_visa', name: 'H-4 Visa', key: 'ead_h4_visa' },
      { type: 'ead_i94', name: 'I-94 Arrival/Departure Record', key: 'ead_i94' },
      { type: 'ead_marriage_certificate', name: 'Marriage Certificate', key: 'ead_marriage_certificate' },
      { type: 'ead_spouse_i797', name: "Spouse's I-797", key: 'ead_spouse_i797' },
      { type: 'ead_spouse_i140', name: "Spouse's I-140", key: 'ead_spouse_i140' },
      { type: 'ead_employer_letter', name: 'Employer Verification Letter', key: 'ead_employer_letter' },
      { type: 'ead_paystub', name: 'Paystub', key: 'ead_paystub' },
    ]

    const foundDocuments: Map<string, DocumentInfo> = new Map()
    const missingDocuments: string[] = []

    // Add cover letter
    const coverLetterType = getFileType(coverLetterDoc.file_name || 'cover_letter.pdf')
    foundDocuments.set('cover_letter', {
      document: coverLetterDoc,
      fileType: coverLetterType.type === 'pdf' ? 'pdf' : 'unknown',
      fileExtension: coverLetterType.extension,
      name: 'Cover Letter',
      key: 'cover_letter',
    })

    // Find other documents
    for (const reqDoc of requiredDocTypes.slice(1)) {
      const found = (userDocs || []).find((doc: any) => {
        if (!doc?.file_path) return false
        return doc.document_type === reqDoc.type
      })

      if (found) {
        const fileType = getFileType(found.file_name || '')
        foundDocuments.set(reqDoc.key, {
          document: found,
          fileType: fileType.type === 'pdf' ? 'pdf' : fileType.type === 'image' ? 'image' : 'unknown',
          fileExtension: fileType.extension,
          name: reqDoc.name,
          key: reqDoc.key,
        })
      } else {
        missingDocuments.push(reqDoc.name)
      }
    }

    if (missingDocuments.length > 0) {
      const errorMessage = `Missing required documents: ${missingDocuments.join(', ')}`
      await supabase.rpc('update_compilation_job_status', {
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: errorMessage,
      })
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[WORKER] Found ${foundDocuments.size} documents to process`)

    // ============================================================================
    // STEP 4: PROCESS DOCUMENTS (Normalize → Convert → Merge)
    // ============================================================================
    console.log('[WORKER] [STEP 4] Processing documents (normalize images → convert to PDFs → merge)')
    checkTimeout()

    const workerResult = await processDocumentCompilation(
      foundDocuments,
      fetchFileWithRetry,
      supabase,
      checkTimeout
    )

    if (!workerResult.success || !workerResult.pdfBytes) {
      await supabase.rpc('update_compilation_job_status', {
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: workerResult.error || 'Processing failed',
      })
      return new Response(
        JSON.stringify({ success: false, error: workerResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================================
    // STEP 5: STORE FINAL PDF
    // ============================================================================
    console.log('[WORKER] [STEP 5] Storing final PDF')
    checkTimeout()

    const timestamp = Date.now()
    const fileName = `compiled_documents_${applicationId}_${timestamp}.pdf`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, workerResult.pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      await supabase.rpc('update_compilation_job_status', {
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: `Upload failed: ${uploadError.message}`,
      })
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================================
    // STEP 6: CREATE DOWNLOAD URL
    // ============================================================================
    console.log('[WORKER] [STEP 6] Creating download URL')
    checkTimeout()

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (urlError || !signedUrlData) {
      await supabase.rpc('update_compilation_job_status', {
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: `Failed to create signed URL: ${urlError?.message || 'Unknown error'}`,
      })
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================================
    // STEP 7: UPDATE JOB STATUS
    // ============================================================================
    console.log('[WORKER] [STEP 7] Updating job status to completed')
    
    await supabase.rpc('update_compilation_job_status', {
      p_job_id: job.id,
      p_status: 'completed',
      p_result_file_path: filePath,
      p_result_file_name: fileName,
      p_result_file_size: workerResult.pdfBytes.length,
      p_result_signed_url: signedUrlData.signedUrl,
    })

    console.log(`[WORKER] ✓ Job ${job.id} completed successfully`)
    console.log(`[WORKER] Download URL: ${signedUrlData.signedUrl.substring(0, 80)}...`)

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'completed',
        pdfUrl: signedUrlData.signedUrl,
        filePath,
        fileName,
        fileSize: workerResult.pdfBytes.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[WORKER] ❌ Error:', error)
    console.error('[WORKER] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    // Try to update job status if we have a job
    let jobUpdated = false
    try {
      // Try to get job ID from request body (may have been consumed)
      let jobId: string | null = jobIdForCleanup || null
      
      // If we don't have jobId, try to read from request body
      if (!jobId) {
        try {
          const requestBody: ProcessJobRequest = await req.json().catch(() => ({}))
          jobId = requestBody.jobId || null
        } catch {
          // Request body may have been consumed, try to get from job variable
          if (job?.id) {
            jobId = job.id
          }
        }
      }
      
      if (jobId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        // Create a more user-friendly error message
        const errorMessage = error instanceof Error ? error.message : String(error)
        let friendlyMessage = errorMessage
        
        // Provide more specific error messages
        if (errorMessage.includes('timeout') || errorMessage.includes('Worker execution timeout')) {
          friendlyMessage = 'Compilation timed out. The job may have exceeded the maximum execution time. Please try again or contact support.'
        } else if (errorMessage.includes('Missing required documents')) {
          friendlyMessage = 'Some required documents are missing. Please ensure all required documents are uploaded before compiling.'
        } else if (errorMessage.includes('Cover Letter')) {
          friendlyMessage = 'Cover Letter is required but could not be found or generated. Please ensure a cover letter is available.'
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
          friendlyMessage = 'Network error occurred during compilation. Please try again.'
        } else if (errorMessage.includes('Upload failed')) {
          friendlyMessage = 'Compilation completed but failed to upload the result. Please try again.'
        }
        
        await supabase.rpc('update_compilation_job_status', {
          p_job_id: jobId,
          p_status: 'failed',
          p_error_message: friendlyMessage,
        })
        jobUpdated = true
        console.log(`[WORKER] Job ${jobId} status updated to failed with message: ${friendlyMessage}`)
      }
    } catch (updateError) {
      console.error('[WORKER] Failed to update job status:', updateError)
      // Continue even if update fails
    }

    // Return error response with user-friendly message
    const errorMessage = error instanceof Error ? error.message : String(error)
    const friendlyMessage = jobUpdated 
      ? 'Compilation failed. Check job status for details.'
      : (errorMessage.includes('timeout') 
          ? 'Compilation timed out. Please try again.'
          : errorMessage.includes('Missing required documents')
          ? 'Some required documents are missing. Please ensure all required documents are uploaded.'
          : errorMessage)

    return new Response(
      JSON.stringify({
        success: false,
        error: friendlyMessage,
        errorDetails: process.env.NODE_ENV === 'development' ? errorMessage : undefined, // Only include details in dev
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
