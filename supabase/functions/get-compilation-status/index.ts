/**
 * Get Compilation Job Status Edge Function
 * 
 * Returns the current status and results of a document compilation job
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight - MUST return 204 with proper headers
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    })
  }

  try {
    const url = new URL(req.url)
    const jobId = url.searchParams.get('id')

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job ID required (query parameter: ?id=xxx)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: job, error } = await supabase
      .from('document_compilation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If job is completed but signed URL expired, generate new one
    let pdfUrl = job.result_signed_url
    if (job.status === 'completed' && job.result_file_path && !pdfUrl) {
      const { data: signedUrlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(job.result_file_path, 3600)
      
      if (signedUrlData) {
        pdfUrl = signedUrlData.signedUrl
        // Update job with new signed URL
        await supabase
          .from('document_compilation_jobs')
          .update({ result_signed_url: pdfUrl })
          .eq('id', jobId)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          applicationId: job.application_id,
          userId: job.user_id,
          errorMessage: job.error_message,
          pdfUrl: pdfUrl,
          filePath: job.result_file_path,
          fileName: job.result_file_name,
          fileSize: job.result_file_size,
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

