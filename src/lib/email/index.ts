/**
 * Email System - Main Export
 * Centralized email functionality for the entire application
 */

// Core email service
export { sendEmail, sendTestEmail, type EmailOptions } from '../email-service'

// Email templates
export * as EmailTemplates from '../email-templates'

// High-level notification functions
export {
  sendForgotPasswordEmail,
  sendPaymentReceiptEmail,
  sendTimelineUpdateEmail,
  sendMissingDocumentEmail,
  sendMissingDetailsEmail,
  sendSchoolLetterEmail,
  sendFullInstructionsEmail,
  sendWelcomeEmail,
  sendApplicationStatusEmail,
  sendPaymentConfirmationEmail,
  checkAndSendDocumentReminders,
  checkAndSendDetailsReminders
} from '../email-notifications'

// Usage Examples:
/*

// Send a password reset email
import { sendForgotPasswordEmail } from '@/lib/email'
await sendForgotPasswordEmail(email, userName, resetLink)

// Send a payment receipt
import { sendPaymentReceiptEmail } from '@/lib/email'
await sendPaymentReceiptEmail(email, {
  userName, amount, currency, transactionId, paymentDate, description
})

// Send timeline update
import { sendTimelineUpdateEmail } from '@/lib/email'
await sendTimelineUpdateEmail(email, {
  userName, applicationId, updateTitle, updateMessage, newStatus, actionUrl
})

// Send missing document reminder
import { sendMissingDocumentEmail } from '@/lib/email'
await sendMissingDocumentEmail(email, {
  userName, applicationId, missingDocuments, deadline, uploadUrl
})

// Check and send automated reminders
import { checkAndSendDocumentReminders } from '@/lib/email'
await checkAndSendDocumentReminders(userId)

*/

