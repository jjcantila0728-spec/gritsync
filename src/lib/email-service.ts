/**
 * Email Service
 * Handles sending emails with templates and proper formatting
 */

import { supabase } from './supabase'
import { generalSettings } from './settings'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

interface EmailTemplateData {
  userName?: string
  title?: string
  message?: string
  actionUrl?: string
  actionText?: string
  footerText?: string
  [key: string]: any
}

/**
 * Get email configuration from settings
 */
async function getEmailConfig() {
  const siteName = await generalSettings.getSiteName()
  const adminEmail = await generalSettings.getAdminEmail()
  const supportEmail = await generalSettings.getSupportEmail()
  
  // Get email settings from database
  const { data: emailSettings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['emailFrom', 'emailFromName', 'emailServiceProvider', 'resendApiKey'])
  
  const settingsMap: Record<string, string> = {}
  emailSettings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })
  
  return {
    fromName: settingsMap.emailFromName || siteName || 'GritSync',
    fromEmail: settingsMap.emailFrom || adminEmail || 'noreply@gritsync.com',
    supportEmail: supportEmail || 'support@gritsync.com',
    serviceProvider: settingsMap.emailServiceProvider || 'resend',
    resendApiKey: settingsMap.resendApiKey || '',
  }
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(data: EmailTemplateData): string {
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
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>GRITSYNC</h1>
    </div>
    <div class="email-body">
      <div class="email-greeting">
        Hello ${userName},
      </div>
      <div class="email-content">
        ${message.split('\n').map(p => `<p>${p}</p>`).join('')}
      </div>
      ${actionUrl ? `
        <div style="text-align: center;">
          <a href="${actionUrl}" class="email-button">${actionText}</a>
        </div>
      ` : ''}
    </div>
    <div class="email-footer">
      <p>${footerText}</p>
      <p style="margin-top: 10px;">
        <a href="${actionUrl || '#'}">View in Dashboard</a> | 
        <a href="mailto:support@gritsync.com">Contact Support</a>
      </p>
      <p style="margin-top: 10px; font-size: 11px; color: #999;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email
 */
function generatePlainTextEmail(data: EmailTemplateData): string {
  const {
    userName = 'User',
    message = '',
    actionUrl,
    actionText = 'View Details',
  } = data

  let text = `Hello ${userName},\n\n${message}\n\n`
  
  if (actionUrl) {
    text += `${actionText}: ${actionUrl}\n\n`
  }
  
  text += `Thank you for using GritSync.\n\n`
  text += `This is an automated message. Please do not reply to this email.`
  
  return text
}

/**
 * Send email via Supabase Edge Function or API
 * This will call a Supabase Edge Function that handles actual email sending
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const config = await getEmailConfig()
    
    // Call Supabase Edge Function to send email
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || generatePlainTextEmail({ message: options.html.replace(/<[^>]*>/g, '') }),
        from: options.from || `${config.fromName} <${config.fromEmail}>`,
      },
    })

    if (error) {
      console.error('Error sending email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to: string,
  type: 'timeline_update' | 'status_change' | 'payment' | 'general',
  data: {
    userName?: string
    title: string
    message: string
    actionUrl?: string
    applicationId?: string
  }
): Promise<boolean> {
  const config = await getEmailConfig()
  
  // Determine action URL based on type
  let actionUrl = data.actionUrl
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.VITE_API_URL?.replace('/api', '') || 'https://gritsync.com'
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
 * Email templates for different notification types
 */
export const emailTemplates = {
  timelineUpdate: async (data: {
    userName: string
    applicationId: string
    stepName: string
    message: string
  }) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.VITE_API_URL?.replace('/api', '') || 'https://gritsync.com'
    const actionUrl = `${baseUrl}/applications/${data.applicationId}`
    return generateEmailTemplate({
      userName: data.userName,
      title: 'Timeline Update',
      message: `Your application timeline has been updated.\n\n${data.message}\n\nStep: ${data.stepName}`,
      actionUrl,
      actionText: 'View Application',
    })
  },

  statusChange: async (data: {
    userName: string
    applicationId: string
    oldStatus: string
    newStatus: string
    message?: string
  }) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.VITE_API_URL?.replace('/api', '') || 'https://gritsync.com'
    const actionUrl = `${baseUrl}/applications/${data.applicationId}`
    return generateEmailTemplate({
      userName: data.userName,
      title: 'Application Status Changed',
      message: data.message || `Your application status has been updated from "${data.oldStatus}" to "${data.newStatus}".`,
      actionUrl,
      actionText: 'View Application',
    })
  },

  payment: async (data: {
    userName: string
    applicationId: string
    amount: number
    paymentType: string
    message?: string
  }) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.VITE_API_URL?.replace('/api', '') || 'https://gritsync.com'
    const actionUrl = `${baseUrl}/applications/${data.applicationId}`
    return generateEmailTemplate({
      userName: data.userName,
      title: 'Payment Update',
      message: data.message || `Your payment of $${data.amount} for ${data.paymentType} has been processed successfully.`,
      actionUrl,
      actionText: 'View Payment',
    })
  },

  general: async (data: {
    userName: string
    title: string
    message: string
    actionUrl?: string
  }) => {
    return generateEmailTemplate({
      userName: data.userName,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl || (typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : 'https://gritsync.com/dashboard'),
      actionText: 'View Dashboard',
    })
  },
}

