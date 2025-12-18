/**
 * Email System - Main Export
 * Centralized email functionality for the entire application
 */

// Core email service
export { sendEmail, type EmailOptions, type SendEmailResult } from '../email-service'

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
} from '../email-notifications'

// Template-based email service
export {
  sendEmailWithTemplate,
  getRenderedTemplate,
} from '../email-template-service'
