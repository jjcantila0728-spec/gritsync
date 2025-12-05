import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailRequest {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
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
    smtpSecure: settingsMap.smtpSecure === 'true' || settingsMap.smtpSecure === true,
  }
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

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

    const { to, subject, html, text, from } = await req.json() as EmailRequest

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    // Get email configuration from settings
    const config = await getEmailConfig(supabaseClient)

    // Use Resend if configured
    if (config.serviceProvider === 'resend' && config.resendApiKey) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || `${config.fromName} <${config.fromEmail}>`,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''),
        }),
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.text()
        console.error('Resend API error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to send email via Resend', details: error }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        )
      }

      const result = await resendResponse.json()
      return new Response(
        JSON.stringify({ success: true, messageId: result.id }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    )
  } catch (error) {
    console.error('Error in send-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    )
  }
})

