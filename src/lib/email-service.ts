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
  const { data: emailSettings, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['emailFrom', 'emailFromName', 'emailServiceProvider', 'resendApiKey'])
  
  if (error) {
    console.error('Error fetching email settings:', error)
  }
  
  const settingsMap: Record<string, string> = {}
  if (emailSettings && Array.isArray(emailSettings) && !('error' in emailSettings)) {
    emailSettings.forEach((setting: any) => {
      if (setting && typeof setting === 'object' && 'key' in setting && 'value' in setting) {
        settingsMap[setting.key] = setting.value
      }
    })
  }
  
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
function generateEmailTemplate(data: EmailTemplateData & { customHtml?: string }): string {
  const {
    userName = 'User',
    title = 'Notification',
    message = '',
    actionUrl,
    actionText = 'View Details',
    footerText = 'Thank you for using GritSync',
    customHtml,
  } = data

  // If custom HTML is provided, use it instead of message
  const messageContent = customHtml || message.split('\n').map(p => `<p>${p}</p>`).join('')

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
        ${messageContent}
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
    // Validate required fields before calling the function
    if (!options.to || !options.subject || !options.html) {
      console.error('Missing required email fields:', {
        hasTo: !!options.to,
        hasSubject: !!options.subject,
        hasHtml: !!options.html,
        to: options.to,
        subject: options.subject,
        htmlLength: options.html?.length || 0
      })
      return false
    }

    const config = await getEmailConfig()
    
    // Prepare the email payload
    const emailPayload = {
      to: options.to.trim(),
      subject: options.subject.trim(),
      html: options.html,
      text: options.text || generatePlainTextEmail({ message: options.html.replace(/<[^>]*>/g, '') }),
      from: options.from || `${config.fromName} <${config.fromEmail}>`,
    }

    console.log('Sending email with payload:', {
      to: emailPayload.to,
      subject: emailPayload.subject,
      htmlLength: emailPayload.html.length,
      hasText: !!emailPayload.text,
      from: emailPayload.from
    })
    
    // Call Supabase Edge Function to send email
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: emailPayload,
    })

    if (error) {
      console.error('Error sending email:', error)
      
      // Check if it's a CORS error
      if (error.message?.includes('CORS') || error.message?.includes('Failed to send a request')) {
        console.error('CORS Error: The send-email Edge Function may need to be redeployed.')
        console.error('To fix this, run: supabase functions deploy send-email')
      }
      
      return false
    }

    // Check if the response indicates success
    if (data && typeof data === 'object' && 'success' in data) {
      return data.success === true
    }

    return true
  } catch (error: any) {
    console.error('Error sending email:', error)
    
    // Check if it's a CORS error
    if (error?.message?.includes('CORS') || error?.message?.includes('Failed to send')) {
      console.error('CORS Error: The send-email Edge Function may need to be redeployed.')
      console.error('To fix this, run: supabase functions deploy send-email')
    }
    
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
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
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
 * Send email verification
 */
export async function sendEmailVerification(
  email: string,
  userName: string,
  verificationUrl: string
): Promise<boolean> {
  const template = await emailTemplates.emailVerification({
    userName,
    email,
    verificationUrl,
  })

  return sendEmail({
    to: email,
    subject: 'Verify Your Email Address - GritSync',
    html: template,
  })
}

/**
 * Send forgot password email
 */
export async function sendForgotPasswordEmail(
  email: string,
  userName: string,
  resetUrl: string
): Promise<boolean> {
  const template = await emailTemplates.forgotPassword({
    userName,
    resetUrl,
  })

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - GritSync',
    html: template,
  })
}

/**
 * Send payment receipt email
 */
export async function sendPaymentReceipt(
  email: string,
  data: {
    userName: string
    receiptNumber: string
    amount: number
    paymentType: string
    items: Array<{ name: string; amount: number }>
    paymentDate: string
    applicationId?: string
  }
): Promise<boolean> {
  const template = await emailTemplates.paymentReceipt(data)

  return sendEmail({
    to: email,
    subject: `Payment Receipt ${data.receiptNumber} - GritSync`,
    html: template,
  })
}

/**
 * Send donation receipt email
 */
export async function sendDonationReceipt(
  email: string,
  data: {
    donorName?: string | null
    donationId: string
    amount: number
    donationDate: string
    isAnonymous?: boolean
    message?: string | null
  }
): Promise<boolean> {
  const template = await emailTemplates.donationReceipt(data)

  return sendEmail({
    to: email,
    subject: `Donation Receipt - Thank You for Your Generosity!`,
    html: template,
  })
}

/**
 * Send birthday greeting
 */
export async function sendBirthdayGreeting(
  email: string,
  userName: string,
  greeting: string
): Promise<boolean> {
  const template = await emailTemplates.birthdayGreeting({
    userName,
    greeting,
  })

  return sendEmail({
    to: email,
    subject: 'Happy Birthday! - GritSync',
    html: template,
  })
}

/**
 * Send reminder email
 */
export async function sendReminderEmail(
  email: string,
  data: {
    userName: string
    reminderType: string
    message: string
    actionUrl?: string
  }
): Promise<boolean> {
  const template = await emailTemplates.reminder(data)

  return sendEmail({
    to: email,
    subject: `Reminder: ${data.reminderType} - GritSync`,
    html: template,
  })
}

/**
 * Send test email
 */
export async function sendTestEmail(email: string): Promise<boolean> {
  const template = generateEmailTemplate({
    userName: 'Test User',
    title: 'Test Email',
    message: 'This is a test email from GritSync. If you received this, your email configuration is working correctly!',
    actionUrl: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : 'https://gritsync.com/dashboard',
    actionText: 'Visit Dashboard',
    footerText: 'This is a test email. Your email service is configured correctly.',
  })

  return sendEmail({
    to: email,
    subject: 'Test Email - GritSync Email Configuration',
    html: template,
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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
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

  emailVerification: async (data: {
    userName: string
    email: string
    verificationUrl: string
  }) => {
    return generateEmailTemplate({
      userName: data.userName,
      title: 'Verify Your Email Address',
      message: `Thank you for registering with GritSync!\n\nPlease verify your email address by clicking the button below. This helps us ensure the security of your account.\n\nIf you did not create an account, please ignore this email.`,
      actionUrl: data.verificationUrl,
      actionText: 'Verify Email Address',
      footerText: 'This verification link will expire in 24 hours.',
    })
  },

  forgotPassword: async (data: {
    userName: string
    resetUrl: string
  }) => {
    return generateEmailTemplate({
      userName: data.userName,
      title: 'Reset Your Password',
      message: `We received a request to reset your password. Click the button below to create a new password.\n\nIf you did not request a password reset, please ignore this email. Your password will remain unchanged.`,
      actionUrl: data.resetUrl,
      actionText: 'Reset Password',
      footerText: 'This password reset link will expire in 1 hour.',
    })
  },

  paymentReceipt: async (data: {
    userName: string
    receiptNumber: string
    amount: number
    paymentType: string
    items: Array<{ name: string; amount: number }>
    paymentDate: string
    applicationId?: string
  }) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
    const actionUrl = data.applicationId 
      ? `${baseUrl}/applications/${data.applicationId}/payment`
      : `${baseUrl}/dashboard`
    
    const itemsHtml = data.items.map(item => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount.toFixed(2)}</td>
      </tr>`
    ).join('')

    const receiptHtml = `
      <p>Thank you for your payment!</p>
      <p>Your payment has been processed successfully. Please find your receipt details below.</p>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #dc2626;">Payment Receipt</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Receipt Number:</td>
            <td style="padding: 8px;">${data.receiptNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Payment Type:</td>
            <td style="padding: 8px;">${data.paymentType}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date:</td>
            <td style="padding: 8px;">${new Date(data.paymentDate).toLocaleDateString()}</td>
          </tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #dc2626; color: white;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr>
              <td style="padding: 8px; font-weight: bold; border-top: 2px solid #dc2626;">Total</td>
              <td style="padding: 8px; font-weight: bold; text-align: right; border-top: 2px solid #dc2626;">$${data.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `

    return generateEmailTemplate({
      userName: data.userName,
      title: 'Payment Receipt',
      customHtml: receiptHtml,
      actionUrl,
      actionText: 'View Payment Details',
      footerText: 'Keep this receipt for your records.',
    })
  },

  birthdayGreeting: async (data: {
    userName: string
    greeting: string
  }) => {
    return generateEmailTemplate({
      userName: data.userName,
      title: 'Happy Birthday!',
      message: `${data.greeting}\n\nWe hope you have a wonderful day filled with joy and success!\n\nThank you for being part of the GritSync family.`,
      actionUrl: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : 'https://gritsync.com/dashboard',
      actionText: 'Visit Dashboard',
      footerText: 'Wishing you all the best on your special day!',
    })
  },

  reminder: async (data: {
    userName: string
    reminderType: string
    message: string
    actionUrl?: string
  }) => {
    return generateEmailTemplate({
      userName: data.userName,
      title: `Reminder: ${data.reminderType}`,
      message: data.message,
      actionUrl: data.actionUrl || (typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : 'https://gritsync.com/dashboard'),
      actionText: 'Take Action',
      footerText: 'This is an automated reminder from GritSync.',
    })
  },

  donationReceipt: async (data: {
    donorName?: string | null
    donationId: string
    amount: number
    donationDate: string
    isAnonymous?: boolean
    message?: string | null
  }) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
    const donorName = data.donorName || (data.isAnonymous ? 'Generous Donor' : 'Valued Supporter')
    
    const receiptHtml = `
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
        <h2 style="margin: 0 0 10px 0; font-size: 28px;">Thank You for Your Donation!</h2>
        <p style="margin: 0; font-size: 18px; opacity: 0.95;">Your generosity is making a real difference</p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333;">
        Dear ${donorName},
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333;">
        We are incredibly grateful for your generous donation of <strong style="color: #2563eb; font-size: 18px;">$${data.amount.toFixed(2)}</strong>. 
        Your contribution directly supports aspiring nurses in achieving their USRN dreams.
      </p>
      
      ${data.message ? `
      <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-style: italic; color: #1e40af;">
          "${data.message}"
        </p>
      </div>
      ` : ''}
      
      <div style="background: #f9fafb; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #e5e7eb;">
        <h3 style="margin-top: 0; color: #1f2937; font-size: 20px;">Donation Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; font-weight: 600; color: #4b5563; width: 40%;">Donation ID:</td>
            <td style="padding: 10px 0; color: #1f2937; font-family: monospace;">${data.donationId.substring(0, 8)}...</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-weight: 600; color: #4b5563;">Amount:</td>
            <td style="padding: 10px 0; color: #1f2937; font-size: 18px; font-weight: bold; color: #2563eb;">$${data.amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-weight: 600; color: #4b5563;">Date:</td>
            <td style="padding: 10px 0; color: #1f2937;">${new Date(data.donationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-weight: 600; color: #4b5563;">Status:</td>
            <td style="padding: 10px 0; color: #059669; font-weight: 600;">✓ Completed</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #065f46; font-size: 18px;">Your Impact</h4>
        <p style="margin: 0; color: #047857; line-height: 1.6;">
          Your donation helps remove financial barriers for nurses pursuing their USRN certification. 
          Every contribution directly funds NCLEX exam fees and processing costs, making dreams achievable.
        </p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333;">
        This email serves as your receipt for tax purposes. Please keep it for your records.
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333;">
        Thank you again for your generosity and for being part of our mission to support nurses worldwide.
      </p>
    `
    
    return generateEmailTemplate({
      userName: donorName,
      title: 'Donation Receipt',
      customHtml: receiptHtml,
      actionUrl: `${baseUrl}/donate`,
      actionText: 'Make Another Donation',
      footerText: 'This is your official donation receipt. Your donation may be tax-deductible.',
    })
  },
}

