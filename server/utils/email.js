import { getSupabaseAdmin } from '../db/supabase.js'
import { logger } from './logger.js'

/**
 * Get email configuration from settings
 */
async function getEmailConfig() {
  const supabase = getSupabaseAdmin()
  
  const { data: emailSettings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['emailFrom', 'emailFromName', 'emailServiceProvider', 'resendApiKey', 'siteName', 'adminEmail'])
  
  const settingsMap = {}
  emailSettings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })
  
  return {
    fromName: settingsMap.emailFromName || settingsMap.siteName || 'GritSync',
    fromEmail: settingsMap.emailFrom || settingsMap.adminEmail || 'noreply@gritsync.com',
    serviceProvider: settingsMap.emailServiceProvider || 'resend',
    resendApiKey: settingsMap.resendApiKey || process.env.RESEND_API_KEY || '',
  }
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(data) {
  const {
    userName = 'User',
    title = 'Notification',
    message = '',
    actionUrl,
    actionText = 'View Details',
    footerText = 'Thank you for using GritSync',
  } = data

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
    .email-body h2 {
      margin-top: 0;
      color: #1f2937;
    }
    .email-body p {
      margin: 15px 0;
      color: #4b5563;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #dc2626;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .button:hover {
      background-color: #991b1b;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>${title}</h1>
    </div>
    <div class="email-body">
      <p>Hello ${userName},</p>
      <p>${message}</p>
      ${actionUrl ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ''}
    </div>
    <div class="email-footer">
      <p>${footerText}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send email using Resend API
 */
async function sendEmail(options) {
  const { to, subject, html } = options
  const config = await getEmailConfig()
  
  if (!config.resendApiKey) {
    logger.warn('Resend API key not configured. Email not sent.', { to, subject })
    return false
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      logger.error('Failed to send email', { status: response.status, error, to, subject })
      return false
    }
    
    const data = await response.json()
    logger.info('Email sent successfully', { to, subject, id: data.id })
    return true
  } catch (error) {
    logger.error('Error sending email', { error: error.message, to, subject })
    return false
  }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to,
  type,
  data
) {
  const config = await getEmailConfig()
  
  // Determine action URL
  let actionUrl = data.actionUrl
  const baseUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL?.replace('/api', '') || 'https://gritsync.com'
  if (!actionUrl && data.applicationId) {
    actionUrl = `${baseUrl}/applications/${data.applicationId}`
  } else if (!actionUrl) {
    actionUrl = `${baseUrl}/dashboard`
  }

  const emailHtml = generateEmailTemplate({
    userName: data.userName || 'User',
    title: data.title,
    message: data.message,
    actionUrl,
    actionText: type === 'payment' ? 'View Payment' : type === 'status_change' ? 'View Application' : 'View Details',
    footerText: 'Thank you for using GritSync',
  })

  return sendEmail({
    to,
    subject: `${data.title} - ${config.fromName}`,
    html: emailHtml,
  })
}

/**
 * Check if email notifications should be sent for a given type
 */
export async function shouldSendEmailNotification(type) {
  const supabase = getSupabaseAdmin()
  
  // Get email notification settings
  const { data: emailSettings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'emailNotificationsEnabled',
      'emailTimelineUpdates',
      'emailStatusChanges',
      'emailPaymentUpdates',
      'emailGeneralNotifications'
    ])
  
  const settingsMap = {}
  emailSettings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })
  
  // Check master switch
  const masterEnabled = settingsMap.emailNotificationsEnabled === 'true' || 
                        settingsMap.emailNotificationsEnabled === true ||
                        settingsMap.emailNotificationsEnabled === undefined // Default to enabled
  
  if (!masterEnabled) return false
  
  // Check type-specific settings
  switch (type) {
    case 'timeline_update':
      return settingsMap.emailTimelineUpdates === 'true' || 
             settingsMap.emailTimelineUpdates === true ||
             settingsMap.emailTimelineUpdates === undefined // Default to enabled
    case 'status_change':
      return settingsMap.emailStatusChanges === 'true' || 
             settingsMap.emailStatusChanges === true ||
             settingsMap.emailStatusChanges === undefined // Default to enabled
    case 'payment':
      return settingsMap.emailPaymentUpdates === 'true' || 
             settingsMap.emailPaymentUpdates === true ||
             settingsMap.emailPaymentUpdates === undefined // Default to enabled
    case 'general':
      return true // General notifications are always enabled if master is enabled
    default:
      return false
  }
}


