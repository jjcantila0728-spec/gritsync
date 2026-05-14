/**
 * Email Notifications System
 * High-level functions to send specific notification emails
 */

import { db } from './api-client'
import { sendEmail } from './email-service'
import * as EmailTemplates from './email-templates'

/**
 * Send Forgot Password Email
 */
export async function sendForgotPasswordEmail(
  email: string,
  userName: string,
  resetLink: string,
  expiryTime?: string,
  recipientUserId?: string | null
): Promise<boolean> {
  const { subject, html } = await EmailTemplates.createForgotPasswordEmail({
    userName,
    resetLink,
    expiryTime
  })

  return await sendEmail({
    to: email,
    subject,
    html,
    recipientUserId: recipientUserId || undefined,
    emailType: 'transactional',
    emailCategory: 'password_reset'
  })
}

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
  const { subject, html } = await EmailTemplates.createPaymentReceiptEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
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
    timeline?: Array<{ date: string; title: string; completed: boolean }>
  }
): Promise<boolean> {
  const { subject, html } = await EmailTemplates.createTimelineUpdateEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
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
  const { subject, html } = await EmailTemplates.createMissingDocumentEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
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
  const { subject, html } = await EmailTemplates.createMissingDetailsEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
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
  const { subject, html } = await EmailTemplates.createSchoolLetterEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
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
  const { subject, html } = await EmailTemplates.createFullInstructionsEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
  })
}

/**
 * Send Welcome Email
 */
export async function sendWelcomeEmail(
  email: string,
  data: {
    userName: string
    userEmail: string
    dashboardUrl: string
  }
): Promise<boolean> {
  const { subject, html } = await EmailTemplates.createWelcomeEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html
  })
}

/**
 * Send Application Status Change Email
 * Uses specialized templates for approved/rejected, timeline update for others
 */
export async function sendApplicationStatusEmail(
  email: string,
  userName: string,
  applicationId: string,
  _oldStatus: string,
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

  // Use specialized templates for approved/rejected
  if (status === 'approved' || status === 'completed') {
    return await sendApplicationApprovedEmail(email, {
      userName,
      applicationId,
      serviceType: additionalData?.serviceType || 'Application',
      approvalDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nextSteps: additionalData?.nextSteps,
      applicationUrl,
      certificateUrl: additionalData?.certificateUrl
    })
  }

  if (status === 'rejected') {
    return await sendApplicationRejectedEmail(email, {
      userName,
      applicationId,
      serviceType: additionalData?.serviceType || 'Application',
      rejectionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      reason: additionalData?.reason || message,
      appealProcess: additionalData?.appealProcess,
      applicationUrl,
      supportContact: additionalData?.supportContact
    })
  }

  // Use timeline update for other status changes
  const statusMessages: Record<string, string> = {
    submitted: 'Your application has been received and is under review.',
    in_review: 'Our team is currently reviewing your application.',
    documents_requested: 'We need additional documents to process your application.',
    on_hold: 'Your application has been temporarily placed on hold.',
    pending: 'Your application is pending review.'
  }

  return await sendTimelineUpdateEmail(email, {
    userName,
    applicationId,
    updateTitle: `Status Changed: ${newStatus}`,
    updateMessage: message || statusMessages[status] || 'Your application status has been updated.',
    newStatus,
    actionUrl: applicationUrl
  })
}

/**
 * Send Payment Confirmation Email
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  userName: string,
  paymentData: {
    amount: number
    currency: string
    transactionId: string
    applicationId: string
    serviceName: string
  }
): Promise<boolean> {
  const { amount, currency, transactionId, applicationId, serviceName } = paymentData

  return await sendPaymentReceiptEmail(email, {
    userName,
    amount,
    currency,
    transactionId,
    paymentDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    description: `${serviceName} - Application #${applicationId}`,
    receiptUrl: `${window.location.origin}/payments/${transactionId}/receipt`
  })
}

/**
 * Check and send missing document reminders
 */
export async function checkAndSendDocumentReminders(
  userId: string
): Promise<void> {
  try {
    // Get user's applications with missing documents
    const { data: applications, error } = await db
      .from('applications')
      .select(`
        id,
        user_id,
        status,
        users!inner (
          email,
          full_name
        ),
        documents (
          id,
          document_type,
          status
        )
      `)
      .eq('user_id', userId)
      .in('status', ['submitted', 'in_review', 'documents_requested'])

    if (error) throw error

    for (const app of applications || []) {
      const requiredDocs = [
        { type: 'passport', name: 'Passport Copy', required: true },
        { type: 'diploma', name: 'Diploma/Degree', required: true },
        { type: 'transcript', name: 'Academic Transcript', required: true },
        { type: 'license', name: 'Professional License', required: false }
      ]

      const uploadedDocs = (app.documents || []).map((d: any) => d.document_type)
      const missingDocs = requiredDocs.filter(doc => !uploadedDocs.includes(doc.type))

      if (missingDocs.length > 0) {
        await sendMissingDocumentEmail(app.users.email, {
          userName: app.users.full_name || 'User',
          applicationId: app.id,
          missingDocuments: missingDocs.map(doc => ({
            name: doc.name,
            required: doc.required
          })),
          uploadUrl: `${window.location.origin}/applications/${app.id}/documents`
        })
      }
    }
  } catch (error) {
    console.error('Error checking document reminders:', error)
  }
}

/**
 * Check and send missing details reminders
 */
export async function checkAndSendDetailsReminders(
  userId: string
): Promise<void> {
  try {
    // Get user details
    const { data: user, error: userError } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    // Get user_details
    const { data: details, error: detailsError } = await db
      .from('user_details')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (detailsError && detailsError.code !== 'PGRST116') throw detailsError

    const missingFields: Array<{ fieldName: string; description?: string }> = []

    // Check required fields
    if (!user.phone) {
      missingFields.push({ fieldName: 'Phone Number', description: 'Your contact phone number' })
    }
    if (!details?.date_of_birth) {
      missingFields.push({ fieldName: 'Date of Birth', description: 'Required for verification' })
    }
    if (!details?.address) {
      missingFields.push({ fieldName: 'Address', description: 'Your current residential address' })
    }
    if (!details?.country) {
      missingFields.push({ fieldName: 'Country', description: 'Your country of residence' })
    }

    if (missingFields.length > 0) {
      await sendMissingDetailsEmail(user.email, {
        userName: user.full_name || 'User',
        missingFields,
        profileUrl: `${window.location.origin}/my-details`,
        isUrgent: missingFields.length > 2
      })
    }
  } catch (error) {
    console.error('Error checking details reminders:', error)
  }
}

/**
 * Send Email Verification Email
 */
export async function sendEmailVerificationEmail(
  email: string,
  userName: string,
  verificationLink: string,
  expiryTime?: string
): Promise<boolean> {
  const { subject, html } = await EmailTemplates.createEmailVerificationEmail({
    userName,
    userEmail: email,
    verificationLink,
    expiryTime
  })

  return await sendEmail({
    to: email,
    subject,
    html,
    emailType: 'transactional',
    emailCategory: 'email_verification'
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
  const { subject, html } = await EmailTemplates.createApplicationApprovedEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html,
    emailType: 'notification',
    emailCategory: 'application_approved',
    applicationId: data.applicationId,
    recipientName: data.userName
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
  const { subject, html } = await EmailTemplates.createApplicationRejectedEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html,
    emailType: 'notification',
    emailCategory: 'application_rejected',
    applicationId: data.applicationId,
    recipientName: data.userName
  })
}

/**
 * Send Document Approved Email
 */
export async function sendDocumentApprovedEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    documentName: string
    approvedDate: string
    approvedBy?: string
    applicationUrl: string
    notes?: string
  }
): Promise<boolean> {
  const { subject, html } = await EmailTemplates.createDocumentApprovedEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html,
    emailType: 'notification',
    emailCategory: 'document_approved',
    applicationId: data.applicationId,
    recipientName: data.userName
  })
}

/**
 * Send Document Rejected Email
 */
export async function sendDocumentRejectedEmail(
  email: string,
  data: {
    userName: string
    applicationId: string
    documentName: string
    rejectionDate: string
    rejectionReason: string
    requiredActions?: string[]
    uploadUrl: string
    reviewedBy?: string
  }
): Promise<boolean> {
  const { subject, html } = await EmailTemplates.createDocumentRejectedEmail(data)

  return await sendEmail({
    to: email,
    subject,
    html,
    emailType: 'notification',
    emailCategory: 'document_rejected',
    applicationId: data.applicationId,
    recipientName: data.userName
  })
}

