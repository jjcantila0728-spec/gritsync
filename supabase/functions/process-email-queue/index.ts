import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get pending emails ready to send
    const { data: pendingEmails, error: fetchError } = await supabaseAdmin.rpc('get_pending_emails_to_send', {
      limit_count: 50
    })

    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending emails', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0, 
          message: 'No pending emails to process' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingEmails.length} pending emails`)

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each email
    for (const email of pendingEmails) {
      try {
        // Mark as processing
        await supabaseAdmin.rpc('mark_email_processing', {
          queue_id: email.id
        })

        // Get email config
        const { data: configData } = await supabaseAdmin
          .from('admin_settings')
          .select('value')
          .eq('key', 'email_service_provider')
          .single()

        const serviceProvider = configData?.value || 'resend'

        // Prepare email payload
        const emailPayload: any = {
          to: email.recipient_email,
          subject: email.subject,
          html: email.body_html,
        }

        if (email.body_text) {
          emailPayload.text = email.body_text
        }

        if (email.sender_email) {
          emailPayload.from = email.sender_name 
            ? `${email.sender_name} <${email.sender_email}>`
            : email.sender_email
        }

        // Send email via send-email function
        const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke('send-email', {
          body: {
            to: emailPayload.to,
            subject: emailPayload.subject,
            html: emailPayload.html,
            text: emailPayload.text,
            from: emailPayload.from,
            emailType: email.email_type || 'automated',
            emailCategory: email.email_category || 'scheduled',
            recipientUserId: email.recipient_user_id,
            recipientName: email.recipient_name,
            applicationId: email.application_id,
            quotationId: email.quotation_id,
            donationId: email.donation_id,
            sponsorshipId: email.sponsorship_id,
            metadata: email.metadata || {},
            tags: email.tags || [],
          }
        })

        if (sendError || !sendResult?.success) {
          const errorMsg = sendError?.message || sendResult?.error || 'Unknown error sending email'
          console.error(`Failed to send email ${email.id}:`, errorMsg)
          
          await supabaseAdmin.rpc('mark_email_failed', {
            queue_id: email.id,
            error_message: errorMsg,
            provider_response: sendResult || null
          })

          results.failed++
          results.errors.push(`Email ${email.id}: ${errorMsg}`)
        } else {
          // Mark as sent
          await supabaseAdmin.rpc('mark_email_sent', {
            queue_id: email.id,
            provider_message_id: sendResult.messageId || null,
            provider_response: sendResult || null
          })

          results.sent++
          console.log(`Successfully sent email ${email.id}`)
        }

        results.processed++
      } catch (error: any) {
        console.error(`Error processing email ${email.id}:`, error)
        
        try {
          await supabaseAdmin.rpc('mark_email_failed', {
            queue_id: email.id,
            error_message: error.message || 'Unknown error',
            provider_response: null
          })
        } catch (markError) {
          console.error('Failed to mark email as failed:', markError)
        }

        results.failed++
        results.errors.push(`Email ${email.id}: ${error.message || 'Unknown error'}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: `Processed ${results.processed} emails: ${results.sent} sent, ${results.failed} failed`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('Error in process-email-queue:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})



