import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Max-Age': '86400',
}

interface ResendWebhookPayload {
  type: string
  created_at: string
  data: {
    id: string
    from: string
    to: string[]
    cc?: string[]
    bcc?: string[]
    reply_to?: string[]
    subject?: string
    html?: string
    text?: string
    headers?: Record<string, string>
    attachments?: Array<{
      id: string
      filename: string
      content_type: string
      size: number
    }>
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Parse webhook payload
    const payload: ResendWebhookPayload = await req.json()

    console.log('Received Resend webhook:', {
      type: payload.type,
      emailId: payload.data.id,
      from: payload.data.from,
      to: payload.data.to,
      subject: payload.data.subject,
    })

    // We're interested in email.received events
    if (payload.type === 'email.received') {
      const emailData = payload.data

      // Extract from name and email
      const fromMatch = emailData.from.match(/^(.*?)<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].trim() : null
      const fromEmail = fromMatch ? fromMatch[2] : emailData.from

      // Get primary recipient (first in to array)
      const toEmail = emailData.to[0]

      // Prepare attachments array
      const attachments = emailData.attachments?.map(att => ({
        id: att.id,
        filename: att.filename,
        content_type: att.content_type,
        size: att.size,
      })) || []

      // Insert into database
      const { data: insertedEmail, error: insertError } = await supabaseClient
        .from('received_emails')
        .insert({
          resend_id: emailData.id,
          from_email: fromEmail,
          from_name: fromName,
          to_email: toEmail,
          cc: emailData.cc || [],
          bcc: emailData.bcc || [],
          reply_to: emailData.reply_to || [],
          subject: emailData.subject || '(no subject)',
          html_body: emailData.html,
          text_body: emailData.text,
          headers: emailData.headers || {},
          attachments: attachments,
          received_at: payload.created_at,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting received email:', insertError)
        
        // If it's a duplicate, that's okay (webhook retry)
        if (insertError.code === '23505') {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Email already processed',
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          )
        }

        return new Response(
          JSON.stringify({
            error: 'Failed to store email',
            details: insertError.message,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        )
      }

      console.log('Successfully stored received email:', {
        id: insertedEmail.id,
        resendId: insertedEmail.resend_id,
        to: insertedEmail.to_email,
        recipientUserId: insertedEmail.recipient_user_id,
      })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email received and stored',
          emailId: insertedEmail.id,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // For other webhook types, just acknowledge
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook received',
        type: payload.type,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
})

