/**
 * Email Service
 * Handles sending emails with templates and proper formatting
 * NOTE: This feature uses the server-side email routes
 */

import { generalSettings } from './settings'
import * as EmailTemplates from './email-templates'
import { apiClient } from './api-client'

interface EmailAttachment {
  filename: string
  content: string
  type?: string
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  fromName?: string
  fromEmailAddressId?: string
  replyTo?: string
  cc?: string
  bcc?: string
  attachments?: File[] | EmailAttachment[]
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

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export {
  EmailTemplates
}

/**
 * Get email configuration from settings
 */
async function getEmailConfig() {
  const siteName = await generalSettings.getSiteName()
  const adminEmail = await generalSettings.getAdminEmail()
  const supportEmail = await generalSettings.getSupportEmail()
  
  return {
    fromName: siteName || 'GritSync',
    fromEmail: adminEmail || 'noreply@gritsync.com',
    supportEmail: supportEmail || 'support@gritsync.com',
    serviceProvider: 'resend',
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
    }
    .header {
      background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .button {
      display: inline-block;
      background: #DC2626;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      border-radius: 0 0 8px 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
  </div>
  <div class="content">
    <p>Hello ${userName},</p>
    ${messageContent}
    ${actionUrl ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ''}
  </div>
  <div class="footer">
    <p>${footerText}</p>
    <p>GritSync - Your NCLEX Processing Partner</p>
  </div>
</body>
</html>`
}

/**
 * Send an email via the server API
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  try {
    const config = await getEmailConfig()
    
    const emailData = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      from: options.from || config.fromEmail,
      fromName: options.fromName || config.fromName,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
    }

    const result = await apiClient.post<{ success: boolean; messageId?: string; error?: string }>('/emails/send', emailData)
    
    return result
  } catch (error: any) {
    console.error('Error sending email:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email',
    }
  }
}

/**
 * Send a templated notification email
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  templateData: EmailTemplateData
): Promise<SendEmailResult> {
  const html = generateEmailTemplate(templateData)
  
  return sendEmail({
    to,
    subject,
    html,
  })
}

/**
 * Send a welcome email to new users
 */
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  loginUrl: string
): Promise<SendEmailResult> {
  return sendNotificationEmail(to, 'Welcome to GritSync!', {
    userName,
    title: 'Welcome to GritSync!',
    message: 'Thank you for registering with GritSync. We are excited to help you achieve your NCLEX goals.',
    actionUrl: loginUrl,
    actionText: 'Login to Your Account',
  })
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<SendEmailResult> {
  return sendNotificationEmail(to, 'Reset Your Password', {
    userName,
    title: 'Password Reset Request',
    message: 'We received a request to reset your password. Click the button below to create a new password. This link will expire in 1 hour.',
    actionUrl: resetUrl,
    actionText: 'Reset Password',
  })
}

/**
 * Send an application status update email
 */
export async function sendApplicationStatusEmail(
  to: string,
  userName: string,
  applicationId: string,
  status: string,
  detailsUrl: string
): Promise<SendEmailResult> {
  return sendNotificationEmail(to, `Application Status Update: ${status}`, {
    userName,
    title: 'Application Status Update',
    message: `Your application (ID: ${applicationId}) status has been updated to: ${status}`,
    actionUrl: detailsUrl,
    actionText: 'View Application',
  })
}

/**
 * Send a payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  to: string,
  userName: string,
  amount: number,
  paymentId: string,
  receiptUrl?: string
): Promise<SendEmailResult> {
  return sendNotificationEmail(to, 'Payment Confirmation', {
    userName,
    title: 'Payment Received',
    message: `Thank you for your payment of $${amount.toFixed(2)}. Your payment ID is: ${paymentId}`,
    actionUrl: receiptUrl,
    actionText: receiptUrl ? 'View Receipt' : undefined,
  })
}

/**
 * Send a test email (for admin notifications settings)
 */
export async function sendTestEmail(
  to: string,
  subject?: string
): Promise<SendEmailResult> {
  const config = await getEmailConfig()
  return sendEmail({
    to,
    subject: subject || 'Test Email from GritSync',
    html: generateEmailTemplate({
      userName: 'Admin',
      title: 'Test Email',
      message: 'This is a test email to verify your email settings are working correctly.',
      footerText: 'Sent from GritSync admin panel',
    }),
    from: config.fromEmail,
    fromName: config.fromName,
  })
}

/**
 * Send a donation receipt email
 */
export async function sendDonationReceipt(
  to: string,
  userName: string,
  amount: number,
  donationId: string,
  receiptUrl?: string
): Promise<SendEmailResult> {
  return sendNotificationEmail(to, 'Thank You for Your Donation', {
    userName,
    title: 'Donation Receipt',
    message: `Thank you for your generous donation of $${amount.toFixed(2)}. Your donation ID is: ${donationId}. Your support helps us continue our mission.`,
    actionUrl: receiptUrl,
    actionText: receiptUrl ? 'View Receipt' : undefined,
  })
}
