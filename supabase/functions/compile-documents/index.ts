/**
 * Document Compilation Edge Function - ORCHESTRATOR
 * 
 * This orchestrator:
 * 1. Validates the request
 * 2. Checks for required documents
 * 3. Enqueues a job in Supabase
 * 4. Returns job ID immediately (client polls for status)
 * 
 * All heavy processing is done by the LOCAL WORKER (scripts/local-worker.ts).
 * To process jobs, run: npm run worker:local -- --processNext
 * Or process a specific job: npm run worker:local -- --jobId <job-id>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CompileDocumentsRequest {
  applicationId: string
  userId: string
  coverLetterBlob?: string // Base64 encoded cover letter PDF (optional)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Get original request's Authorization header to pass to worker (if available)
  const originalAuthHeader = req.headers.get('Authorization')

  try {
    console.log('[ORCHESTRATOR] === Compile Documents Request Started ===')

    // ============================================================================
    // STEP 1: VALIDATE REQUEST
    // ============================================================================
    let requestBody: CompileDocumentsRequest
    try {
      requestBody = await req.json()
      console.log('[ORCHESTRATOR] Request parsed - Application ID:', requestBody.applicationId, 'User ID:', requestBody.userId)
    } catch (parseError) {
      console.error('[ORCHESTRATOR] Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request body. Expected JSON with applicationId and userId.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { applicationId, userId, coverLetterBlob } = requestBody

    if (!applicationId || !userId) {
      return new Response(
        JSON.stringify({ error: 'applicationId and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================================================
    // STEP 2: VALIDATE REQUIRED DOCUMENTS EXIST
    // ============================================================================
    console.log('[ORCHESTRATOR] [STEP 1] Validating required documents')

    // Define required documents
    const requiredDocTypes = [
      { type: 'cover_letter', name: 'Cover Letter' },
      { type: 'additional_g1145', name: 'Form G-1145' },
      { type: 'additional_i765', name: 'Form I-765' },
      { type: 'ead_2x2_picture', name: '2x2 Picture' },
      { type: 'ead_passport', name: 'Passport' },
      { type: 'ead_h4_visa', name: 'H-4 Visa' },
      { type: 'ead_i94', name: 'I-94 Arrival/Departure Record' },
      { type: 'ead_marriage_certificate', name: 'Marriage Certificate' },
      { type: 'ead_spouse_i797', name: "Spouse's I-797" },
      { type: 'ead_spouse_i140', name: "Spouse's I-140" },
      { type: 'ead_employer_letter', name: 'Employer Verification Letter' },
      { type: 'ead_paystub', name: 'Paystub' },
    ]

    // Check for cover letter (can be provided, in user_documents, or generated)
    let coverLetterExists = false
    if (coverLetterBlob && coverLetterBlob.trim() !== '') {
      coverLetterExists = true
      console.log('[ORCHESTRATOR] Cover letter provided in request')
    } else {
      // Check if cover letter exists in user_documents
      const { data: coverLetterDocs } = await supabase
        .from('user_documents')
        .select('id')
        .eq('user_id', userId)
        .in('document_type', ['cover_letter', 'additional_cover_letter'])
        .limit(1)

      if (coverLetterDocs && coverLetterDocs.length > 0) {
        coverLetterExists = true
        console.log('[ORCHESTRATOR] Cover letter found in user_documents')
      } else {
        // Check if we can generate it (application exists)
        const { data: applicationData } = await supabase
          .from('applications')
          .select('id')
          .eq('id', applicationId)
          .single()

        if (applicationData) {
          coverLetterExists = true
          console.log('[ORCHESTRATOR] Cover letter can be generated from application')
        }
      }
    }

    if (!coverLetterExists) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Compilation failed: Cover Letter is required but could not be found or generated',
          missingDocuments: ['Cover Letter'],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check other required documents
    const { data: userDocs, error: docsError } = await supabase
      .from('user_documents')
      .select('document_type')
      .eq('user_id', userId)

    if (docsError) {
      console.error('[ORCHESTRATOR] Error fetching documents:', docsError)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch documents: ${docsError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const foundDocumentTypes = new Set((userDocs || []).map((doc: any) => doc.document_type))
    const missingDocuments: string[] = []

    // Check other required documents (skip cover_letter, already checked)
    for (const reqDoc of requiredDocTypes.slice(1)) {
      if (!foundDocumentTypes.has(reqDoc.type)) {
        missingDocuments.push(reqDoc.name)
      }
    }

    if (missingDocuments.length > 0) {
      const errorMessage = `Compilation failed: Missing required documents: ${missingDocuments.join(', ')}. Please ensure all required documents are uploaded before compiling.`
      console.error('[ORCHESTRATOR] Compilation failed:', errorMessage)
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          missingDocuments: missingDocuments,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[ORCHESTRATOR] All required documents found`)

    // ============================================================================
    // STEP 3: ENQUEUE JOB
    // ============================================================================
    console.log('[ORCHESTRATOR] [STEP 2] Enqueuing compilation job')

    // Check for existing pending/processing job for this application
    const { data: existingJob, error: checkError } = await supabase
      .from('document_compilation_jobs')
      .select('*')
      .eq('application_id', applicationId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let job: any = null

    if (existingJob && !checkError) {
      // Existing job found - return it instead of creating a duplicate
      console.log(`[ORCHESTRATOR] Found existing ${existingJob.status} job: ${existingJob.id}`)
      job = existingJob
    } else {
      // No existing job - create a new one
      const { data: newJob, error: jobError } = await supabase
        .from('document_compilation_jobs')
        .insert({
          application_id: applicationId,
          user_id: userId,
          status: 'pending',
          cover_letter_blob: coverLetterBlob || null,
          metadata: { 
            foundDocumentsCount: foundDocumentTypes.size + 1, // +1 for cover letter
            requiredDocumentsCount: requiredDocTypes.length,
          },
        })
        .select()
        .single()

      if (jobError || !newJob) {
        console.error('[ORCHESTRATOR] Failed to create job:', jobError)
        
        // Check if it's a duplicate key error (race condition)
        const isDuplicateKey = jobError?.code === '23505' || 
                              jobError?.message?.includes('duplicate key') ||
                              jobError?.message?.includes('already exists')
        
        if (isDuplicateKey) {
          // Race condition - another request created the job. Fetch it.
          console.log('[ORCHESTRATOR] Duplicate key detected, fetching existing job...')
          const { data: raceJob } = await supabase
            .from('document_compilation_jobs')
            .select('*')
            .eq('application_id', applicationId)
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (raceJob) {
            console.log(`[ORCHESTRATOR] Found race condition job: ${raceJob.id}`)
            job = raceJob
          } else {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Failed to create or find compilation job. Please try again.',
                errorCode: jobError?.code,
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
        } else {
          // Check if it's a table not found error
          const isTableNotFound = jobError?.code === 'PGRST205' || 
                                  jobError?.message?.includes('Could not find the table') ||
                                  jobError?.message?.includes('document_compilation_jobs')
          
          const errorMessage = isTableNotFound
            ? 'Database migration required: The document_compilation_jobs table does not exist. Please run the migration: supabase/migrations/add-document-compilation-jobs.sql in your Supabase SQL Editor.'
            : `Failed to create compilation job: ${jobError?.message || 'Unknown error'}`
          
          return new Response(
            JSON.stringify({
              success: false,
              error: errorMessage,
              errorCode: jobError?.code,
              hint: isTableNotFound 
                ? 'Run the migration file: supabase/migrations/add-document-compilation-jobs.sql in Supabase SQL Editor'
                : jobError?.hint,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      } else {
        job = newJob
      }
    }

    if (!job) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create or find compilation job',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (job.status === 'pending') {
      console.log(`[ORCHESTRATOR] Job ${job.id} is pending, ready for local worker processing`)
      console.log(`[ORCHESTRATOR] To process this job, run the local worker:`)
      console.log(`[ORCHESTRATOR]   npm run worker:local -- --jobId ${job.id}`)
      console.log(`[ORCHESTRATOR] Or process next pending job:`)
      console.log(`[ORCHESTRATOR]   npm run worker:local -- --processNext`)
      console.log(`[ORCHESTRATOR] Job is queued and will be processed by the local worker`)
    } else {
      console.log(`[ORCHESTRATOR] Job ${job.id} is already ${job.status}, worker should be processing`)
    }

    // Return job ID immediately (client will poll for status)
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'pending',
        message: 'Compilation job enqueued. Use get-compilation-status to check progress.',
        statusUrl: `${supabaseUrl}/functions/v1/get-compilation-status?id=${job.id}`,
      }),
      {
        status: 202, // Accepted (processing started)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[ORCHESTRATOR] ❌ Error:', error)
    console.error('[ORCHESTRATOR] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enqueue compilation job',
        details: error instanceof Error ? error.stack : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
