/**
 * Email Notifications System
 * Uses database-managed templates from email_templates table
 * Templates are managed via /admin/emails/templates
 */

import { sendEmail } from './email-service'
import { apiClient } from './api-client'
import { generalSettings } from './settings'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  html_content: string
  text_content: string | null
  template_type: string
  variables: string[]
  is_active: boolean
}

async function getTemplateByType(_templateType: string): Promise<EmailTemplate | null> {
  return null
}

/**
 * Render template by replacing {{variables}} with values
 */
function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): { subject: string; html: string; text?: string } {
  let subject = template.subject
  let html = template.html_content
  let text = template.text_content || ''

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    const safeValue = value || ''
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    subject = subject.replace(new RegExp(escapedPlaceholder, 'g'), safeValue)
    html = html.replace(new RegExp(escapedPlaceholder, 'g'), safeValue)
    text = text.replace(new RegExp(escapedPlaceholder, 'g'), safeValue)
  })

  return { subject, html, text: text || undefined }
}

/**
 * Wrap content in base email template
 */
async function wrapInBaseTemplate(content: string): Promise<string> {
  const [siteName, siteUrl, supportEmail, phoneNumber, logoUrl, primaryColor, companyAddress] = await Promise.all([
    generalSettings.getSiteName(),
    generalSettings.getWebsiteUrl(),
    generalSettings.getSupportEmail(),
    generalSettings.getPhoneNumber(),
    generalSettings.getLogoUrl(),
    generalSettings.getPrimaryColor(),
    generalSettings.getCompanyAddress(),
  ])

  const primaryDark = primaryColor.replace(/^#/, '')
  const r = parseInt(primaryDark.slice(0, 2), 16) * 0.9
  const g = parseInt(primaryDark.slice(2, 4), 16) * 0.9
  const b = parseInt(primaryDark.slice(4, 6), 16) * 0.9
  const darkerColor = `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 0; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .email-header { background: linear-gradient(135deg, ${primaryColor} 0%, ${darkerColor} 100%); padding: 40px 20px; text-align: center; }
    .email-body { padding: 40px 30px; }
    h1 { font-size: 28px; color: #1f2937; margin-bottom: 20px; }
    p { margin-bottom: 16px; color: #6b7280; font-size: 16px; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, ${darkerColor} 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .info-box { background-color: #f0fdf4; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 25px 0; border-radius: 6px; }
    .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px; }
    .card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .email-footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer-text { color: #6b7280; font-size: 14px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      ${logoUrl 
        ? `<a href="${siteUrl}"><img src="${logoUrl}" alt="${siteName}" width="180" style="max-width: 180px; height: auto;" /></a>`
        : `<a href="${siteUrl}" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none;">GRIT<span style="color: rgba(255,255,255,0.85);">SYNC</span></a>`
      }
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Your NCLEX Journey Partner</p>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      ${companyAddress ? `<p class="footer-text">${companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
      <p class="footer-text">
        Email: <a href="mailto:${supportEmail}" style="color: ${primaryColor};">${supportEmail}</a>
        ${phoneNumber ? `<br>Phone: <a href="tel:${phoneNumber.replace(/[^\d+]/g, '')}" style="color: ${primaryColor};">${phoneNumber}</a>` : ''}
      </p>
      <p class="footer-text" style="font-size: 12px; margin-top: 20px;">
        © ${new Date().getFullYear()} ${siteName}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Send email using database template
 */
async function sendTemplateEmail(
  templateType: string,
  to: string,
  variables: Record<string, string>,
  options?: {
    recipientUserId?: string
    emailType?: 'transactional' | 'notification' | 'marketing'
    tags?: string[]
  }
): Promise<boolean> {
  const template = await getTemplateByType(templateType)
  
  if (!template) {
    console.error(`Template not found or inactive: ${templateType}`)
    return false
  }

  const rendered = renderTemplate(template, variables)
  const wrappedHtml = await wrapInBaseTemplate(rendered.html)

  return sendEmail({
    to,
    subject: rendered.subject,
    html: wrappedHtml,
    text: rendered.text,
    recipientUserId: options?.recipientUserId,
    emailType: options?.emailType || 'transactional',
    emailCategory: templateType,
    tags: options?.tags || [templateType],
  })
}

// ============================================
// PUBLIC EMAIL FUNCTIONS
// ============================================

/**
 * Send Payment Receipt Email
 */
export async function sendPaymentReceiptEmail(
  email: string,
  data: {
    userName: string
    amount: number
    currency: string
    transactionId: string
    paymentDate: string
    description: string
    items?: Array<{ name: string; amount: number }>
    receiptUrl?: string
  }
): Promise<boolean> {
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.currency
  }).format(value)

  const formattedAmount = formatCurrency(data.amount)
  
  const itemsHtml = data.items && data.items.length > 0 
    ? data.items.map(item => `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.name}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.amount)}</td></tr>`).join('')
    : ''

  return sendTemplateEmail('payment_receipt', email, {
    userName: data.userName,
    amount: formattedAmount,
    transactionId: data.transactionId,
    paymentDate: data.paymentDate,
    description: data.description,
    itemsTable: itemsHtml,
    receiptUrl: data.receiptUrl || '',
  })
}

/**
 * Send Timeline Update Email
 */
export async function sendTimelineUpdateEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    updateTitle: string
    updateMessage: string
    newStatus?: string
    actionUrl?: string
  }
): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
  
  return sendTemplateEmail('timeline_update', email, {
    userName: data.userName,
    updateTitle: data.updateTitle,
    updateMessage: data.updateMessage,
    actionUrl: data.actionUrl || `${baseUrl}/applications/${data.applicationId}`,
  })
}

/**
 * Send Missing Document Reminder Email
 */
export async function sendMissingDocumentEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    missingDocuments: Array<{ name: string; description?: string; required: boolean }>
    deadline?: string
    uploadUrl: string
  }
): Promise<boolean> {
  const documentList = data.missingDocuments
    .map(doc => `- ${doc.name}${doc.required ? ' (Required)' : ''}`)
    .join('<br>')

  return sendTemplateEmail('missing_document', email, {
    userName: data.userName,
    documentList,
    uploadUrl: data.uploadUrl,
  })
}

/**
 * Send Missing Details Reminder Email
 */
export async function sendMissingDetailsEmail(
  email: string,
  data: {
    userName: string
    missingFields: Array<{ fieldName: string; description?: string }>
    profileUrl: string
    isUrgent?: boolean
  }
): Promise<boolean> {
  const fieldList = data.missingFields
    .map(field => `- ${field.fieldName}`)
    .join('<br>')

  return sendTemplateEmail('missing_details', email, {
    userName: data.userName,
    fieldList,
    profileUrl: data.profileUrl,
  })
}

/**
 * Send School Letter Email
 */
export async function sendSchoolLetterEmail(
  email: string,
  data: {
    userName: string
    schoolName: string
    letterUrl: string
    applicationId: string
    instructions?: string
  }
): Promise<boolean> {
  return sendTemplateEmail('school_letter', email, {
    applicantName: data.userName,
    applicationId: data.applicationId,
    schoolName: data.schoolName,
    letterUrl: data.letterUrl,
    documentRequirements: data.instructions || 'Please provide official transcripts and graduation verification.',
  })
}

/**
 * Send Full Instructions Email
 */
export async function sendFullInstructionsEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    serviceType: string
    steps: Array<{ stepNumber: number; title: string; description: string; dueDate?: string }>
    resourcesUrl?: string
  }
): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
  const instructions = data.steps
    .map(step => `<p><strong>Step ${step.stepNumber}: ${step.title}</strong><br>${step.description}</p>`)
    .join('')

  return sendTemplateEmail('full_instructions', email, {
    userName: data.userName,
    instructions,
    dashboardUrl: `${baseUrl}/dashboard`,
  })
}

/**
 * Send Application Approved Email
 */
export async function sendApplicationApprovedEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    serviceType: string
    approvalDate: string
    nextSteps?: string[]
    applicationUrl: string
    certificateUrl?: string
  }
): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
  const nextSteps = data.nextSteps?.map(step => `- ${step}`).join('<br>') || 'Check your dashboard for next steps.'

  return sendTemplateEmail('application_approved', email, {
    userName: data.userName,
    applicationId: data.applicationId,
    serviceType: data.serviceType,
    approvalDate: data.approvalDate,
    nextSteps,
    applicationUrl: data.applicationUrl,
    certificateUrl: data.certificateUrl || '',
    dashboardUrl: `${baseUrl}/dashboard`,
  })
}

/**
 * Send Application Rejected Email
 */
export async function sendApplicationRejectedEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    serviceType: string
    rejectionDate: string
    reason?: string
    appealProcess?: string
    applicationUrl: string
    supportContact?: string
  }
): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'

  return sendTemplateEmail('application_rejected', email, {
    userName: data.userName,
    applicationId: data.applicationId,
    serviceType: data.serviceType,
    rejectionDate: data.rejectionDate,
    rejectionReason: data.reason || 'Please contact support for more details.',
    actionItems: data.appealProcess || 'You may resubmit your application with the required corrections.',
    applicationUrl: data.applicationUrl,
    supportContact: data.supportContact || 'support@gritsync.com',
    dashboardUrl: `${baseUrl}/dashboard`,
  })
}

/**
 * Send Document Approved Email
 */
export async function sendDocumentApprovedEmail(
  email: string,
  data: {
    userName: string
    documentName: string
    documentType: string
    applicationId: string
    applicationUrl: string
    remainingDocuments?: Array<{ name: string; status: string }>
  }
): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'

  return sendTemplateEmail('document_approved', email, {
    userName: data.userName,
    documentName: data.documentName,
    dashboardUrl: `${baseUrl}/dashboard`,
  })
}

/**
 * Send Document Rejected Email
 */
export async function sendDocumentRejectedEmail(
  email: string,
  data: {
    userName: string
    documentName: string
    documentType: string
    applicationId: string
    reason: string
    resubmissionUrl: string
    tips?: string[]
  }
): Promise<boolean> {
  return sendTemplateEmail('document_rejected', email, {
    userName: data.userName,
    documentName: data.documentName,
    rejectionReason: data.reason,
    uploadUrl: data.resubmissionUrl,
  })
}

/**
 * Send Visa Bulletin Update Email
 */
export async function sendVisaBulletinUpdateEmail(
  email: string,
  data: {
    userName: string
    month: string
    year: string
    finalActionDate: string
    datesForFiling: string
    bulletinUrl: string
  }
): Promise<boolean> {
  return sendTemplateEmail('visa_bulletin_update', email, {
    userName: data.userName,
    month: data.month,
    year: data.year,
    finalActionDate: data.finalActionDate,
    datesForFiling: data.datesForFiling,
    bulletinUrl: data.bulletinUrl,
  }, { emailType: 'notification' })
}

/**
 * Send Application Status Change Email
 * Uses specialized templates for approved/rejected, timeline update for others
 */
export async function sendApplicationStatusEmail(
  email: string,
  userName: string,
  applicationId: string,
  oldStatus: string,
  newStatus: string,
  message?: string,
  additionalData?: {
    serviceType?: string
    nextSteps?: string[]
    certificateUrl?: string
    reason?: string
    appealProcess?: string
    supportContact?: string
  }
): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gritsync.com'
  const applicationUrl = `${baseUrl}/applications/${applicationId}`
  const status = newStatus.toLowerCase()

  if (status === 'approved' || status === 'completed') {
    return sendApplicationApprovedEmail(email, {
      userName,
      applicationId,
      serviceType: additionalData?.serviceType || 'Application',
      approvalDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      nextSteps: additionalData?.nextSteps,
      applicationUrl,
      certificateUrl: additionalData?.certificateUrl
    })
  }

  if (status === 'rejected') {
    return sendApplicationRejectedEmail(email, {
      userName,
      applicationId,
      serviceType: additionalData?.serviceType || 'Application',
      rejectionDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      reason: additionalData?.reason || message,
      appealProcess: additionalData?.appealProcess,
      applicationUrl,
      supportContact: additionalData?.supportContact
    })
  }

  const statusMessages: Record<string, string> = {
    submitted: 'Your application has been received and is under review.',
    in_review: 'Our team is currently reviewing your application.',
    documents_requested: 'We need additional documents to process your application.',
    on_hold: 'Your application has been temporarily placed on hold.',
    pending: 'Your application is pending review.'
  }

  return sendTimelineUpdateEmail(email, {
    userName,
    applicationId,
    updateTitle: `Status Changed: ${newStatus}`,
    updateMessage: message || statusMessages[status] || 'Your application status has been updated.',
    newStatus,
    actionUrl: applicationUrl
  })
}

/**
 * Send Welcome Email (for new registrations)
 * Note: This is handled by Supabase Auth. Use Supabase Dashboard to customize.
 */
export async function sendWelcomeEmail(
  email: string,
  data: {
    userName: string
    userEmail: string
    dashboardUrl: string
  }
): Promise<boolean> {
  console.log('Welcome email should be sent via Supabase Auth templates')
  return true
}

/**
 * Send Forgot Password Email
 * Note: This is handled by Supabase Auth. Use Supabase Dashboard to customize.
 */
export async function sendForgotPasswordEmail(
  email: string,
  userName: string,
  resetLink: string,
  expiryTime?: string,
  recipientUserId?: string | null
): Promise<boolean> {
  console.log('Forgot password email should be sent via Supabase Auth templates')
  return true
}
