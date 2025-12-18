/**
 * Email Template Service
 * Utility functions to send emails using templates from email_templates table
 * Supports real-time template-based email sending
 */

import { sendEmail } from './email-service'
import { emailTemplatesAPI, EmailTemplate, renderTemplate } from './email-templates-api'

export interface SendTemplateEmailOptions {
  templateSlug: string
  to: string
  variables: Record<string, string>
  emailType?: 'transactional' | 'notification' | 'marketing' | 'manual' | 'automated'
  recipientUserId?: string
  recipientName?: string
  applicationId?: string
  quotationId?: string
  donationId?: string
  sponsorshipId?: string
  metadata?: Record<string, any>
  tags?: string[]
  fromName?: string
  fromEmailAddressId?: string
  cc?: string
  bcc?: string
  replyTo?: string
}

/**
 * Send an email using a template from the database
 */
export async function sendEmailWithTemplate(
  options: SendTemplateEmailOptions
): Promise<boolean> {
  try {
    // Get template by slug
    const template = await emailTemplatesAPI.getBySlug(options.templateSlug)
    
    if (!template) {
      console.error(`Template not found: ${options.templateSlug}`)
      return false
    }

    if (!template.is_active) {
      console.error(`Template is inactive: ${options.templateSlug}`)
      return false
    }

    // Render template with variables
    const rendered = renderTemplate(template, options.variables)

    // Increment usage count
    await emailTemplatesAPI.incrementUsage(template.id).catch(err => {
      console.warn('Failed to increment template usage:', err)
      // Don't fail the email send if usage tracking fails
    })

    // Send email
    const success = await sendEmail({
      to: options.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      emailType: options.emailType || 'transactional',
      emailCategory: template.category,
      recipientUserId: options.recipientUserId,
      recipientName: options.recipientName,
      applicationId: options.applicationId,
      quotationId: options.quotationId,
      donationId: options.donationId,
      sponsorshipId: options.sponsorshipId,
      metadata: {
        ...options.metadata,
        templateId: template.id,
        templateSlug: template.slug,
        templateName: template.name,
      },
      tags: [
        ...(options.tags || []),
        `template:${template.slug}`,
        `category:${template.category}`,
      ],
      fromName: options.fromName,
      fromEmailAddressId: options.fromEmailAddressId,
    })

    return success
  } catch (error) {
    console.error('Error sending email with template:', error)
    return false
  }
}

/**
 * Get rendered template content (subject, html, text) without sending
 * Useful for preview or manual email composition
 */
export async function getRenderedTemplate(
  templateSlug: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string; text?: string } | null> {
  try {
    const template = await emailTemplatesAPI.getBySlug(templateSlug)
    
    if (!template || !template.is_active) {
      return null
    }

    return renderTemplate(template, variables)
  } catch (error) {
    console.error('Error rendering template:', error)
    return null
  }
}

/**
 * Convenience function to send employer verification letter request (Admin version)
 */
export async function sendEmployerVerificationLetterRequestAdmin(
  to: string,
  options: {
    applicantName: string
    spouseName: string
    spouseEmail: string
    spouseContactNumber: string
    applicantEmail: string
    applicantPhone: string
    applicationId?: string
    recipientUserId?: string
    recipientName?: string
    cc?: string
    replyTo?: string
  }
): Promise<boolean> {
  return sendEmailWithTemplate({
    templateSlug: 'employer-verification-letter-request-admin',
    to,
    variables: {
      APPLICANT_NAME: options.applicantName,
      SPOUSE_NAME: options.spouseName,
      SPOUSE_EMAIL: options.spouseEmail,
      SPOUSE_CONTACT_NUMBER: options.spouseContactNumber,
      APPLICANT_EMAIL: options.applicantEmail,
      APPLICANT_PHONE: options.applicantPhone,
    },
    emailType: 'transactional',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.recipientName,
    cc: options.cc,
    replyTo: options.replyTo || 'info@gritsync.com',
    fromName: 'GritSync Information',
    tags: ['employer-verification', 'admin', 'ead'],
  })
}

/**
 * Convenience function to send employer verification letter request (Client version)
 */
export async function sendEmployerVerificationLetterRequestClient(
  to: string,
  options: {
    applicantName: string
    spouseName: string
    spouseEmail: string
    spouseContactNumber: string
    applicantEmail: string
    applicantPhone: string
    applicationId?: string
    recipientUserId?: string
    recipientName?: string
    cc?: string
    replyTo?: string
  }
): Promise<boolean> {
  return sendEmailWithTemplate({
    templateSlug: 'employer-verification-letter-request-client',
    to,
    variables: {
      APPLICANT_NAME: options.applicantName,
      SPOUSE_NAME: options.spouseName,
      SPOUSE_EMAIL: options.spouseEmail,
      SPOUSE_CONTACT_NUMBER: options.spouseContactNumber,
      APPLICANT_EMAIL: options.applicantEmail,
      APPLICANT_PHONE: options.applicantPhone,
    },
    emailType: 'transactional',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.recipientName,
    cc: options.cc,
    replyTo: options.replyTo || options.spouseEmail,
    tags: ['employer-verification', 'client', 'ead'],
  })
}

/**
 * Convenience function to send timeline update email
 */
export async function sendTimelineUpdateEmailWithTemplate(
  to: string,
  options: {
    userName: string
    applicationId: string
    updateTitle: string
    updateMessage: string
    newStatus?: string
    actionUrl: string
    timeline?: Array<{ date: string; title: string; completed: boolean }>
    recipientUserId?: string
  }
): Promise<boolean> {
  // Build timeline HTML if provided
  let timelineHtml = ''
  if (options.timeline && options.timeline.length > 0) {
    timelineHtml = '<div style="margin: 20px 0;"><h3 style="margin-bottom: 15px;">Application Timeline:</h3>'
    options.timeline.forEach(item => {
      const statusClass = item.completed ? 'completed' : 'pending'
      const statusIcon = item.completed ? '✓' : '○'
      timelineHtml += `<div class="timeline-item ${statusClass}" style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
        <strong>${statusIcon} ${item.date}:</strong> ${item.title}
      </div>`
    })
    timelineHtml += '</div>'
  }

  return sendEmailWithTemplate({
    templateSlug: 'timeline-update',
    to,
    variables: {
      USER_NAME: options.userName,
      APPLICATION_ID: options.applicationId,
      UPDATE_TITLE: options.updateTitle,
      UPDATE_MESSAGE: options.updateMessage,
      NEW_STATUS: options.newStatus || '',
      ACTION_URL: options.actionUrl,
      TIMELINE: timelineHtml,
    },
    emailType: 'notification',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['timeline', 'update', 'notification'],
  })
}

/**
 * Convenience function to send payment receipt email
 */
export async function sendPaymentReceiptEmailWithTemplate(
  to: string,
  options: {
    userName: string
    amount: number
    currency: string
    transactionId: string
    paymentDate: string
    paymentMethod: string
    description: string
    applicationId?: string
    items?: Array<{ name: string; amount: number }>
    receiptUrl?: string
    recipientUserId?: string
  }
): Promise<boolean> {
  // Build items HTML if provided
  let itemsSection = ''
  if (options.items && options.items.length > 0) {
    itemsSection = '<div class="items-list" style="margin: 20px 0;"><h3 style="margin-bottom: 15px;">Items:</h3>'
    options.items.forEach(item => {
      itemsSection += `<div class="item-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
        <span>${item.name}</span>
        <span><strong>${options.currency}${item.amount.toFixed(2)}</strong></span>
      </div>`
    })
    itemsSection += '</div>'
  }

  const applicationIdRow = options.applicationId
    ? `<div class="receipt-row" style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span class="receipt-label" style="font-weight: 600; color: #6b7280;">Application ID:</span><span class="receipt-value" style="color: #111827;">#${options.applicationId}</span></div>`
    : ''

  const applicationIdText = options.applicationId ? `Application ID: #${options.applicationId}` : ''

  const receiptUrlButton = options.receiptUrl
    ? `<div style="text-align: center;"><a href="${options.receiptUrl}" class="button" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">Download Receipt</a></div>`
    : ''

  const receiptUrlText = options.receiptUrl ? `Download receipt: ${options.receiptUrl}` : ''

  return sendEmailWithTemplate({
    templateSlug: 'payment-receipt-enhanced',
    to,
    variables: {
      USER_NAME: options.userName,
      AMOUNT: options.amount.toFixed(2),
      CURRENCY: options.currency,
      TRANSACTION_ID: options.transactionId,
      PAYMENT_DATE: options.paymentDate,
      PAYMENT_METHOD: options.paymentMethod,
      DESCRIPTION: options.description,
      APPLICATION_ID: options.applicationId || '',
      APPLICATION_ID_ROW: applicationIdRow,
      APPLICATION_ID_TEXT: applicationIdText,
      ITEMS_SECTION: itemsSection,
      RECEIPT_URL: options.receiptUrl || '',
      RECEIPT_URL_BUTTON: receiptUrlButton,
      RECEIPT_URL_TEXT: receiptUrlText,
    },
    emailType: 'transactional',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['payment', 'receipt', 'transactional'],
  })
}

/**
 * Convenience function to send missing documents reminder
 */
export async function sendMissingDocumentsEmailWithTemplate(
  to: string,
  options: {
    userName: string
    applicationId: string
    missingDocuments: Array<{ name: string; description?: string; required: boolean }>
    deadline?: string
    uploadUrl: string
    recipientUserId?: string
  }
): Promise<boolean> {
  // Build documents list HTML
  let documentsHtml = ''
  let documentsText = ''
  
  options.missingDocuments.forEach(doc => {
    const requiredClass = doc.required ? 'required' : 'optional'
    const requiredBadge = doc.required ? '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">Required</span>' : '<span style="background: #6b7280; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">Optional</span>'
    
    documentsHtml += `<div class="document-item ${requiredClass}" style="padding: 12px; margin: 8px 0; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${doc.required ? '#ef4444' : '#6b7280'};">
      <strong>${doc.name}</strong>${requiredBadge}
      ${doc.description ? `<p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">${doc.description}</p>` : ''}
    </div>`
    
    documentsText += `- ${doc.name}${doc.required ? ' (Required)' : ' (Optional)'}${doc.description ? `: ${doc.description}` : ''}\n`
  })

  const deadlineSection = options.deadline
    ? `<p style="margin: 10px 0 0 0;">Please upload these documents by: <span class="deadline" style="color: #ef4444; font-weight: 600;">${options.deadline}</span></p>`
    : ''

  const deadlineText = options.deadline ? `Please upload these documents by: ${options.deadline}` : ''

  return sendEmailWithTemplate({
    templateSlug: 'missing-documents-reminder',
    to,
    variables: {
      USER_NAME: options.userName,
      APPLICATION_ID: options.applicationId,
      DOCUMENTS_LIST: documentsHtml,
      DOCUMENTS_LIST_TEXT: documentsText.trim(),
      DEADLINE: options.deadline || '',
      DEADLINE_SECTION: deadlineSection,
      DEADLINE_TEXT: deadlineText,
      UPLOAD_URL: options.uploadUrl,
    },
    emailType: 'reminder',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['documents', 'reminder', 'required'],
  })
}

/**
 * Convenience function to send missing profile details reminder
 */
export async function sendMissingProfileDetailsEmailWithTemplate(
  to: string,
  options: {
    userName: string
    missingFields: Array<{ fieldName: string; description?: string }>
    profileUrl: string
    isUrgent?: boolean
    recipientUserId?: string
  }
): Promise<boolean> {
  // Build fields list HTML
  let fieldsHtml = ''
  let fieldsText = ''
  
  options.missingFields.forEach(field => {
    fieldsHtml += `<div class="field-item" style="padding: 12px; margin: 8px 0; background: #ffffff; border-left: 4px solid #8b5cf6; border-radius: 4px;">
      <strong>${field.fieldName}</strong>
      ${field.description ? `<p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">${field.description}</p>` : ''}
    </div>`
    
    fieldsText += `- ${field.fieldName}${field.description ? `: ${field.description}` : ''}\n`
  })

  return sendEmailWithTemplate({
    templateSlug: 'missing-profile-details',
    to,
    variables: {
      USER_NAME: options.userName,
      FIELDS_LIST: fieldsHtml,
      FIELDS_LIST_TEXT: fieldsText.trim(),
      PROFILE_URL: options.profileUrl,
      URGENT_CLASS: options.isUrgent ? 'urgent' : '',
      URGENCY_TEXT: options.isUrgent ? 'URGENT' : '',
    },
    emailType: 'reminder',
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['profile', 'reminder', 'details'],
  })
}

/**
 * Convenience function to send school letter generated email
 */
export async function sendSchoolLetterEmailWithTemplate(
  to: string,
  options: {
    userName: string
    schoolName: string
    letterUrl: string
    applicationId: string
    instructions?: string
    recipientUserId?: string
  }
): Promise<boolean> {
  const instructionsSection = options.instructions
    ? `<div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3>Next Steps:</h3><p style="white-space: pre-line;">${options.instructions}</p></div>`
    : ''

  const instructionsText = options.instructions ? `Next Steps:\n${options.instructions}` : ''

  return sendEmailWithTemplate({
    templateSlug: 'school-letter-generated',
    to,
    variables: {
      USER_NAME: options.userName,
      SCHOOL_NAME: options.schoolName,
      APPLICATION_ID: options.applicationId,
      LETTER_URL: options.letterUrl,
      INSTRUCTIONS: options.instructions || '',
      INSTRUCTIONS_SECTION: instructionsSection,
      INSTRUCTIONS_TEXT: instructionsText,
    },
    emailType: 'notification',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['school', 'letter', 'notification'],
  })
}

/**
 * Convenience function to send application status change email
 */
export async function sendApplicationStatusChangeEmailWithTemplate(
  to: string,
  options: {
    userName: string
    applicationId: string
    oldStatus?: string
    newStatus: string
    message: string
    applicationUrl: string
    recipientUserId?: string
  }
): Promise<boolean> {
  const oldStatusBadge = options.oldStatus
    ? `<span class="old-status" style="padding: 8px 16px; background: #e5e7eb; color: #6b7280; border-radius: 20px;">${options.oldStatus}</span>`
    : ''
  
  const statusArrow = options.oldStatus ? '<span class="arrow" style="font-size: 24px; color: #6b7280;">→</span>' : ''

  const statusChangeText = options.oldStatus
    ? `${options.oldStatus} → ${options.newStatus}`
    : `New Status: ${options.newStatus}`

  return sendEmailWithTemplate({
    templateSlug: 'application-status-change',
    to,
    variables: {
      USER_NAME: options.userName,
      APPLICATION_ID: options.applicationId,
      OLD_STATUS: options.oldStatus || '',
      OLD_STATUS_BADGE: oldStatusBadge,
      STATUS_ARROW: statusArrow,
      NEW_STATUS: options.newStatus,
      STATUS_CHANGE_TEXT: statusChangeText,
      MESSAGE: options.message,
      APPLICATION_URL: options.applicationUrl,
    },
    emailType: 'notification',
    applicationId: options.applicationId,
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['status', 'application', 'notification'],
  })
}

/**
 * Convenience function to send welcome email
 */
export async function sendWelcomeEmailWithTemplate(
  to: string,
  options: {
    userName: string
    dashboardUrl: string
    supportEmail?: string
    websiteUrl?: string
    recipientUserId?: string
  }
): Promise<boolean> {
  return sendEmailWithTemplate({
    templateSlug: 'welcome-new-user-enhanced',
    to,
    variables: {
      USER_NAME: options.userName,
      DASHBOARD_URL: options.dashboardUrl,
      SUPPORT_EMAIL: options.supportEmail || 'support@gritsync.com',
      WEBSITE_URL: options.websiteUrl || 'https://gritsync.com',
    },
    emailType: 'transactional',
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['welcome', 'onboarding', 'new-user'],
  })
}

/**
 * Convenience function to send password reset email
 */
export async function sendPasswordResetEmailWithTemplate(
  to: string,
  options: {
    userName: string
    resetLink: string
    expiryTime?: string
    recipientUserId?: string
  }
): Promise<boolean> {
  return sendEmailWithTemplate({
    templateSlug: 'password-reset',
    to,
    variables: {
      USER_NAME: options.userName,
      RESET_LINK: options.resetLink,
      EXPIRY_TIME: options.expiryTime || '1 hour',
    },
    emailType: 'transactional',
    recipientUserId: options.recipientUserId,
    recipientName: options.userName,
    tags: ['password', 'reset', 'security'],
  })
}

