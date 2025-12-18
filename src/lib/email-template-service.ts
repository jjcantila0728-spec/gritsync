/**
 * Email Template Service
 * Utility functions to send emails using templates from email_templates table
 * NOTE: This feature is currently stubbed pending full migration
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
    })

    // Send email
    const result = await sendEmail({
      to: options.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      fromName: options.fromName,
      fromEmailAddressId: options.fromEmailAddressId,
    })

    return result.success
  } catch (error) {
    console.error('Error sending email with template:', error)
    return false
  }
}

/**
 * Get rendered template content (subject, html, text) without sending
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

// Re-export for convenience
export { emailTemplatesAPI, renderTemplate }
export type { EmailTemplate }
