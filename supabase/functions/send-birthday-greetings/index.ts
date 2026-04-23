import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Get email configuration from settings table and notification_types table
 */
async function getEmailConfig(supabaseClient: any) {
  // Get email service configuration from settings table
  const { data: emailSettings } = await supabaseClient
    .from('settings')
    .select('key, value')
    .in('key', [
      'emailFrom',
      'emailFromName',
      'emailServiceProvider',
      'resendApiKey',
    ])
  
  const settingsMap: Record<string, string> = {}
  emailSettings?.forEach((setting: any) => {
    settingsMap[setting.key] = setting.value
  })

  // Get greeting configuration from notification_types table
  const { data: greetingNotification } = await supabaseClient
    .from('notification_types')
    .select('config')
    .eq('key', 'birthdayGreeting')
    .single()
  
  const greetingConfig = greetingNotification?.config || {}
  
  return {
    fromEmail: settingsMap.emailFrom || Deno.env.get('EMAIL_FROM') || 'noreply@gritsync.com',
    fromName: settingsMap.emailFromName || Deno.env.get('EMAIL_FROM_NAME') || 'GritSync',
    serviceProvider: settingsMap.emailServiceProvider || 'resend',
    resendApiKey: settingsMap.resendApiKey || Deno.env.get('RESEND_API_KEY') || '',
    greetingMorning: greetingConfig.morning || 'Good morning',
    greetingAfternoon: greetingConfig.afternoon || 'Good afternoon',
    greetingEvening: greetingConfig.evening || 'Good evening',
    greetingCustomEnabled: greetingConfig.customEnabled === true || greetingConfig.customEnabled === 'true',
  }
}

/**
 * Get time-based greeting
 */
function getTimeBasedGreeting(customEnabled: boolean, morning: string, afternoon: string, evening: string): string {
  if (!customEnabled) {
    return 'Happy Birthday!'
  }
  
  const hour = new Date().getHours()
  if (hour < 12) {
    return morning
  } else if (hour < 18) {
    return afternoon
  } else {
    return evening
  }
}

/**
 * Generate birthday greeting email HTML
 */
function generateBirthdayEmail(userName: string, greeting: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Happy Birthday!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .email-body {
      padding: 30px 20px;
    }
    .email-greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333;
    }
    .email-content {
      font-size: 15px;
      color: #555;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .email-button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      margin: 20px 0;
    }
    .email-footer {
      background-color: #f9f9f9;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #eee;
    }
    .email-footer a {
      color: #dc2626;
      text-decoration: none;
    }
    .birthday-icon {
      font-size: 48px;
      text-align: center;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>🎉 HAPPY BIRTHDAY! 🎉</h1>
    </div>
    <div class="email-body">
      <div class="email-greeting">
        ${greeting}, ${userName}!
      </div>
      <div class="birthday-icon">
        🎂🎈🎁
      </div>
      <div class="email-content">
        <p>We hope you have a wonderful day filled with joy and success!</p>
        <p>Thank you for being part of the GritSync family. We're grateful to have you with us on this special day.</p>
        <p>May this new year of your life bring you closer to achieving your dreams and goals!</p>
      </div>
      <div style="text-align: center;">
        <a href="https://gritsync.com/dashboard" class="email-button">Visit Dashboard</a>
      </div>
    </div>
    <div class="email-footer">
      <p>Wishing you all the best on your special day!</p>
      <p style="margin-top: 10px;">
        <a href="https://gritsync.com/dashboard">View Dashboard</a> | 
        <a href="mailto:support@gritsync.com">Contact Support</a>
      </p>
      <p style="margin-top: 10px; font-size: 11px; color: #999;">
        This is an automated birthday greeting from GritSync.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send email via Resend
 */
async function sendEmail(
  config: any,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (config.serviceProvider !== 'resend' || !config.resendApiKey) {
    console.log('Email service not configured for birthday greetings')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [to],
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ''),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Failed to send birthday email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending birthday email:', error)
    return false
  }
}

serve(async (req) => {
  try {
    // This function should be called by Supabase Cron
    // For manual testing, you can call it directly
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get email configuration
    const config = await getEmailConfig(supabaseClient)

    // Get today's date in YYYY-MM-DD format
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Query users with birthdays today
    // First get all user_details with date_of_birth
    const { data: userDetails, error: detailsError } = await supabaseClient
      .from('user_details')
      .select('user_id, date_of_birth, first_name, last_name')
      .not('date_of_birth', 'is', null)

    if (detailsError) {
      console.error('Error querying user_details:', detailsError)
      return new Response(
        JSON.stringify({ error: 'Failed to query user details', details: detailsError.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (!userDetails || userDetails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users with birthdays found',
          count: 0 
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Filter users whose birthday is today (MM-DD match)
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()
    
    const birthdayUserIds = userDetails
      .filter((user: any) => {
        if (!user.date_of_birth) return false
        
        // Parse date_of_birth (format: YYYY-MM-DD)
        const parts = user.date_of_birth.split('-')
        if (parts.length !== 3) return false
        
        const birthMonth = parseInt(parts[1], 10)
        const birthDay = parseInt(parts[2], 10)
        
        return birthMonth === todayMonth && birthDay === todayDay
      })
      .map((user: any) => user.user_id)

    if (birthdayUserIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No birthdays today',
          count: 0 
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user emails for birthday users (only clients)
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, email, role')
      .in('id', birthdayUserIds)
      .eq('role', 'client')

    if (usersError) {
      console.error('Error querying users:', usersError)
      return new Response(
        JSON.stringify({ error: 'Failed to query users', details: usersError.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No client birthdays today',
          count: 0 
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Combine user details with user info
    const birthdayUsers = users.map((user: any) => {
      const details = userDetails.find((d: any) => d.user_id === user.id)
      return {
        user_id: user.id,
        email: user.email,
        first_name: details?.first_name,
        last_name: details?.last_name,
        date_of_birth: details?.date_of_birth,
      }
    })


    // Get greeting message
    const greeting = getTimeBasedGreeting(
      config.greetingCustomEnabled,
      config.greetingMorning,
      config.greetingAfternoon,
      config.greetingEvening
    )

    // Send birthday emails
    const results = []
    for (const user of birthdayUsers) {
      const userName = user.first_name || user.email?.split('@')[0] || 'Valued Client'
      const userEmail = user.email
      
      if (!userEmail) {
        console.warn(`User ${user.user_id} has no email, skipping birthday greeting`)
        continue
      }

      const emailHtml = generateBirthdayEmail(userName, greeting)
      const success = await sendEmail(
        config,
        userEmail,
        `Happy Birthday! 🎉 - ${config.fromName}`,
        emailHtml
      )

      results.push({
        userId: user.user_id,
        email: userEmail,
        success,
      })
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    return new Response(
      JSON.stringify({
        success: true,
        message: `Birthday greetings sent: ${successCount} successful, ${failCount} failed`,
        total: birthdayUsers.length,
        successful: successCount,
        failed: failCount,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in send-birthday-greetings function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
