// Declare Deno global for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// @ts-ignore - Deno URL imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno URL imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailAttachment {
  filename: string
  content: string // base64 encoded
  type?: string
}

interface EmailRequest {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  attachments?: EmailAttachment[]
}

/**
 * Get email configuration from settings table
 */
async function getEmailConfig(supabaseClient: any) {
  // Get email settings from database
  const { data: emailSettings } = await supabaseClient
    .from('settings')
    .select('key, value')
    .in('key', [
      'emailFrom',
      'emailFromName',
      'emailServiceProvider',
      'resendApiKey',
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpPassword',
      'smtpSecure'
    ])
  
  const settingsMap: Record<string, string> = {}
  emailSettings?.forEach((setting: any) => {
    settingsMap[setting.key] = setting.value
  })
  
  // Fallback to environment variables if not in settings
  return {
    fromEmail: settingsMap.emailFrom || Deno.env.get('EMAIL_FROM') || 'noreply@gritsync.com',
    fromName: settingsMap.emailFromName || Deno.env.get('EMAIL_FROM_NAME') || 'GritSync',
    serviceProvider: settingsMap.emailServiceProvider || 'resend',
    resendApiKey: settingsMap.resendApiKey || Deno.env.get('RESEND_API_KEY') || '',
    smtpHost: settingsMap.smtpHost || '',
    smtpPort: settingsMap.smtpPort || '587',
    smtpUser: settingsMap.smtpUser || '',
    smtpPassword: settingsMap.smtpPassword || '',
    smtpSecure: settingsMap.smtpSecure === 'true',
  }
}

serve(async (req) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    let requestData: EmailRequest
    try {
      const rawBody = await req.json()
      console.log('Raw request body type:', typeof rawBody)
      console.log('Raw request body keys:', rawBody ? Object.keys(rawBody) : 'null')
      console.log('Raw request body:', JSON.stringify(rawBody).substring(0, 500))
      
      // Handle different body formats
      if (rawBody && typeof rawBody === 'object') {
        // Check if it's wrapped in a 'body' or 'data' property (some Supabase versions do this)
        if ('body' in rawBody && typeof rawBody.body === 'object') {
          requestData = rawBody.body as EmailRequest
          console.log('Extracted from body property')
        } else if ('data' in rawBody && typeof rawBody.data === 'object') {
          requestData = rawBody.data as EmailRequest
          console.log('Extracted from data property')
        } else {
          // Direct format
          requestData = rawBody as EmailRequest
          console.log('Using direct format')
        }
      } else {
        throw new Error('Request body is not an object')
      }
      
      console.log('Parsed request data:', {
        hasTo: !!requestData.to,
        hasSubject: !!requestData.subject,
        hasHtml: !!requestData.html,
        to: requestData.to,
        subject: requestData.subject,
        htmlLength: requestData.html?.length || 0
      })
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown error'
        }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        }
      )
    }

    const { to, subject, html, text, from, attachments } = requestData

    // Check for missing or empty required fields
    if (!to || to.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: to',
          received: { to: to || null, subject: subject || null, html: html ? 'present' : null }
        }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        }
      )
    }

    if (!subject || subject.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: subject',
          received: { to: to || null, subject: subject || null, html: html ? 'present' : null }
        }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        }
      )
    }

    if (!html || html.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: html',
          received: { to: to || null, subject: subject || null, html: html ? 'present' : null }
        }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        }
      )
    }

    // Get email configuration from settings
    const config = await getEmailConfig(supabaseClient)

    // Use Resend if configured
    if (config.serviceProvider === 'resend' && config.resendApiKey) {
      // Build email payload with anti-spam headers
      const emailPayload: any = {
        from: from || `${config.fromName} <${config.fromEmail}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
        // Anti-spam headers to improve deliverability
        headers: {
          'X-Entity-Ref-ID': `gritsync-${Date.now()}`,
          'X-Mailer': 'GritSync Email Service',
          'List-Unsubscribe': `<mailto:unsubscribe@gritsync.com>`,
          'Precedence': 'bulk'
        },
        // Add tags for better tracking
        tags: [
          {
            name: 'environment',
            value: Deno.env.get('ENVIRONMENT') || 'production'
          },
          {
            name: 'source',
            value: 'gritsync-app'
          }
        ]
      }

      // Add attachments if provided
      if (requestData.attachments && Array.isArray(requestData.attachments) && requestData.attachments.length > 0) {
        emailPayload.attachments = requestData.attachments.map((att: EmailAttachment) => ({
          filename: att.filename,
          content: att.content, // base64 encoded content
          type: att.type || 'application/octet-stream'
        }))
        console.log('Adding attachments:', requestData.attachments.length)
      }
      
      console.log('Sending email via Resend:', {
        to: emailPayload.to,
        from: emailPayload.from,
        subject: emailPayload.subject,
        hasApiKey: !!config.resendApiKey,
        apiKeyPrefix: config.resendApiKey ? config.resendApiKey.substring(0, 7) + '...' : 'none',
        headers: emailPayload.headers
      })
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      })

      const responseText = await resendResponse.text()
      console.log('Resend API response:', {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
        body: responseText
      })

      if (!resendResponse.ok) {
        console.error('Resend API error:', responseText)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to send email via Resend', 
            details: responseText,
            status: resendResponse.status,
            statusText: resendResponse.statusText
          }),
          {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            },
          }
        )
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (e) {
        console.error('Failed to parse Resend response:', e)
        result = { id: 'unknown' }
      }
      
      console.log('Email sent successfully via Resend:', result)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: result.id,
          provider: 'resend'
        }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        }
      )
    }

    // Try SMTP if configured
    if (config.serviceProvider === 'smtp' && config.smtpHost && config.smtpUser && config.smtpPassword) {
      // SMTP sending would require a Deno SMTP library
      // For now, log and return success
      console.log('SMTP email would be sent:', {
        to,
        subject,
        from: from || `${config.fromName} <${config.fromEmail}>`,
        smtpHost: config.smtpHost,
      })
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'SMTP email queued (SMTP implementation pending)',
          note: 'SMTP support will be added in a future update'
        }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        }
      )
    }

    // Fallback: Log for manual sending
    console.log('Email would be sent (no service configured):', {
      to,
      subject,
      from: from || `${config.fromName} <${config.fromEmail}>`,
    })

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Email service not configured',
        message: 'Please configure Resend API key or SMTP settings in admin notification settings'
      }),
      {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      }
    )
  } catch (error) {
    console.error('Error in send-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      }
    )
  }
})

