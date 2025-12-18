/**
 * Modern Email Templates System
 * Beautiful, responsive email designs for all notification types
 */

import { generalSettings } from './settings'

// Color scheme defaults (will be overridden by settings)
const defaultColors = {
  primary: '#10b981', // green-500
  primaryDark: '#059669', // green-600
  secondary: '#3b82f6', // blue-500
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#1f2937',
  light: '#f9fafb',
  gray: '#6b7280',
  border: '#e5e7eb',
}

interface BaseEmailData {
  userName?: string
  userEmail?: string
  siteName?: string
  siteUrl?: string
  supportEmail?: string
  phoneNumber?: string
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  companyAddress?: string
  companyDescription?: string
  socialMedia?: {
    facebook?: string
    twitter?: string
    linkedin?: string
    instagram?: string
  }
}

/**
 * Get branding settings for email templates
 */
async function getBrandingSettings(): Promise<{
  siteName: string
  siteUrl: string
  supportEmail: string
  phoneNumber: string
  logoUrl: string
  primaryColor: string
  primaryDark: string
  secondaryColor: string
  companyAddress: string
  companyDescription: string
  socialMedia: {
    facebook?: string
    twitter?: string
    linkedin?: string
    instagram?: string
  }
}> {
  const [
    siteName,
    siteUrl,
    supportEmail,
    phoneNumber,
    logoUrl,
    primaryColor,
    secondaryColor,
    companyAddress,
    companyDescription,
    socialMedia,
  ] = await Promise.all([
    generalSettings.getSiteName(),
    generalSettings.getWebsiteUrl(),
    generalSettings.getSupportEmail(),
    generalSettings.getPhoneNumber(),
    generalSettings.getLogoUrl(),
    generalSettings.getPrimaryColor(),
    generalSettings.getSecondaryColor(),
    generalSettings.getCompanyAddress(),
    generalSettings.getCompanyDescription(),
    generalSettings.getSocialMediaUrls(),
  ])

  // Calculate primary dark color (darken by 10%)
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }
  const primaryRgb = hexToRgb(primaryColor)
  const primaryDark = primaryRgb
    ? rgbToHex(primaryRgb.r * 0.9, primaryRgb.g * 0.9, primaryRgb.b * 0.9)
    : '#059669'

  return {
    siteName,
    siteUrl,
    supportEmail,
    phoneNumber,
    logoUrl,
    primaryColor,
    primaryDark,
    secondaryColor,
    companyAddress,
    companyDescription,
    socialMedia,
  }
}

/**
 * Base email template with modern, responsive design
 */
async function createBaseTemplate(content: string, data?: Partial<BaseEmailData>): Promise<string> {
  const branding = await getBrandingSettings()
  
  const siteName = data?.siteName || branding.siteName
  const siteUrl = data?.siteUrl || branding.siteUrl
  const supportEmail = data?.supportEmail || branding.supportEmail
  const phoneNumber = data?.phoneNumber || branding.phoneNumber
  const logoUrl = data?.logoUrl || branding.logoUrl
  const primaryColor = data?.primaryColor || branding.primaryColor
  const secondaryColor = data?.secondaryColor || branding.secondaryColor
  const companyAddress = data?.companyAddress || branding.companyAddress
  const socialMedia = data?.socialMedia || branding.socialMedia

  // Use primaryDark from branding (already calculated)
  const primaryDark = branding.primaryDark

  const colors = {
    ...defaultColors,
    primary: primaryColor,
    primaryDark: primaryDark,
    secondary: secondaryColor,
  }

  // Build social media links
  const socialLinks = []
  if (socialMedia.facebook) socialLinks.push(`<a href="${socialMedia.facebook}" class="social-link" style="color: ${colors.primary};">Facebook</a>`)
  if (socialMedia.twitter) socialLinks.push(`<a href="${socialMedia.twitter}" class="social-link" style="color: ${colors.primary};">Twitter</a>`)
  if (socialMedia.linkedin) socialLinks.push(`<a href="${socialMedia.linkedin}" class="social-link" style="color: ${colors.primary};">LinkedIn</a>`)
  if (socialMedia.instagram) socialLinks.push(`<a href="${socialMedia.instagram}" class="social-link" style="color: ${colors.primary};">Instagram</a>`)

  // Logo HTML
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${siteName}" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;" />`
    : `<a href="${siteUrl}" class="email-logo" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 1px;">${siteName}</a>`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${colors.dark};
      background-color: ${colors.light};
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .email-logo {
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: 1px;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-content {
      margin-bottom: 30px;
    }
    h1 {
      font-size: 28px;
      color: ${colors.dark};
      margin-bottom: 20px;
      font-weight: 700;
    }
    h2 {
      font-size: 22px;
      color: ${colors.dark};
      margin: 25px 0 15px;
      font-weight: 600;
    }
    h3 {
      font-size: 18px;
      color: ${colors.dark};
      margin: 20px 0 10px;
      font-weight: 600;
    }
    p {
      margin-bottom: 16px;
      color: ${colors.gray};
      font-size: 16px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(16, 185, 129, 0.3);
    }
    .button-secondary {
      background: linear-gradient(135deg, ${colors.secondary} 0%, #2563eb 100%);
      box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
    }
    .info-box {
      background-color: #f0fdf4;
      border-left: 4px solid ${colors.primary};
      padding: 20px;
      margin: 25px 0;
      border-radius: 6px;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid ${colors.warning};
      padding: 20px;
      margin: 25px 0;
      border-radius: 6px;
    }
    .danger-box {
      background-color: #fee2e2;
      border-left: 4px solid ${colors.danger};
      padding: 20px;
      margin: 25px 0;
      border-radius: 6px;
    }
    .card {
      background-color: #f9fafb;
      border: 1px solid ${colors.border};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .divider {
      border: none;
      border-top: 1px solid ${colors.border};
      margin: 30px 0;
    }
    .email-footer {
      background-color: ${colors.light};
      padding: 30px 20px;
      text-align: center;
      border-top: 1px solid ${colors.border};
    }
    .footer-text {
      color: ${colors.gray};
      font-size: 14px;
      margin-bottom: 10px;
    }
    .footer-links {
      margin: 15px 0;
    }
    .footer-link {
      color: ${colors.primary};
      text-decoration: none;
      margin: 0 10px;
      font-size: 14px;
    }
    .social-links {
      margin: 20px 0;
    }
    .social-link {
      display: inline-block;
      margin: 0 8px;
      color: ${colors.gray};
      text-decoration: none;
    }
    ul {
      margin: 15px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 10px;
      color: ${colors.gray};
    }
    .highlight {
      background-color: #fef3c7;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      margin: 0 5px;
    }
    .badge-success {
      background-color: #d1fae5;
      color: #065f46;
    }
    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    .badge-danger {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .badge-info {
      background-color: #dbeafe;
      color: #1e40af;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: ${colors.light};
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: ${colors.dark};
      border-bottom: 2px solid ${colors.border};
    }
    td {
      padding: 12px;
      border-bottom: 1px solid ${colors.border};
      color: ${colors.gray};
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 30px 20px;
      }
      h1 {
        font-size: 24px;
      }
      .button {
        display: block;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      ${logoHtml}
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      ${companyAddress ? `<p class="footer-text" style="margin-bottom: 10px;">${companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
      <p class="footer-text">
        <strong>Contact Us:</strong><br>
        📧 <a href="mailto:${supportEmail}" style="color: ${colors.primary}; text-decoration: none;">${supportEmail}</a>
        ${phoneNumber ? `<br>📞 <a href="tel:${phoneNumber.replace(/[^\d+]/g, '')}" style="color: ${colors.primary}; text-decoration: none;">${phoneNumber}</a>` : ''}
      </p>
      ${socialLinks.length > 0 ? `
        <div class="social-links">
          <p style="margin: 15px 0 10px; color: ${colors.gray}; font-size: 14px;"><strong>Follow Us:</strong></p>
          ${socialLinks.join(' | ')}
        </div>
      ` : ''}
      <div class="footer-links" style="margin: 20px 0;">
        <a href="${siteUrl}/privacy" class="footer-link" style="color: ${colors.primary}; text-decoration: none; margin: 0 10px; font-size: 14px;">Privacy Policy</a>
        <a href="${siteUrl}/terms" class="footer-link" style="color: ${colors.primary}; text-decoration: none; margin: 0 10px; font-size: 14px;">Terms of Service</a>
        <a href="${siteUrl}/contact" class="footer-link" style="color: ${colors.primary}; text-decoration: none; margin: 0 10px; font-size: 14px;">Contact Us</a>
      </div>
      <p class="footer-text" style="margin-top: 20px; color: ${colors.gray}; font-size: 12px;">
        © ${new Date().getFullYear()} ${siteName}. All rights reserved.<br>
        This email was sent by ${siteName}. If you have any questions, please contact us at ${supportEmail}.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Forgot Password Email
 */
export async function createForgotPasswordEmail(data: {
  userName: string
  resetLink: string
  expiryTime?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, resetLink, expiryTime = '1 hour' } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>🔐 Password Reset Request</h1>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset My Password</a>
      </div>

      <div class="warning-box">
        <p style="margin: 0;"><strong>⏰ Important:</strong> This link will expire in ${expiryTime} for security reasons.</p>
      </div>

      <p><strong>If you didn't request this password reset,</strong> please ignore this email. Your password will remain unchanged.</p>

      <hr class="divider">

      <div class="card">
        <h3>Security Tips:</h3>
        <ul>
          <li>Never share your password with anyone</li>
          <li>Use a strong, unique password</li>
          <li>Enable two-factor authentication if available</li>
          <li>Change your password regularly</li>
        </ul>
      </div>

      <p style="color: ${colors.gray}; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="color: ${colors.primary}; word-break: break-all;">${resetLink}</span>
      </p>
    </div>
  `

  return {
    subject: '🔐 Reset Your Password',
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Payment Receipt Email
 */
export async function createPaymentReceiptEmail(data: {
  userName: string
  amount: number
  currency: string
  transactionId: string
  paymentDate: string
  description: string
  items?: Array<{ name: string; amount: number }>
  receiptUrl?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, amount, currency, transactionId, paymentDate, description, items, receiptUrl } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency 
    }).format(value)
  }

  const itemsTable = items && items.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align: right;">${formatCurrency(item.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  const content = `
    <div class="email-content">
      <h1>✅ Payment Received</h1>
      <p>Hi ${userName},</p>
      <p>Thank you for your payment! Your transaction has been completed successfully.</p>

      <div class="info-box">
        <h2 style="margin-top: 0;">Payment Details</h2>
        <table style="margin: 0;">
          <tr>
            <td style="border: none;"><strong>Amount:</strong></td>
            <td style="border: none; text-align: right; color: ${colors.primary}; font-size: 24px; font-weight: bold;">
              ${formatCurrency(amount)}
            </td>
          </tr>
          <tr>
            <td style="border: none;"><strong>Transaction ID:</strong></td>
            <td style="border: none; text-align: right;">${transactionId}</td>
          </tr>
          <tr>
            <td style="border: none;"><strong>Date:</strong></td>
            <td style="border: none; text-align: right;">${paymentDate}</td>
          </tr>
          <tr>
            <td style="border: none;"><strong>Description:</strong></td>
            <td style="border: none; text-align: right;">${description}</td>
          </tr>
        </table>
      </div>

      ${itemsTable}

      ${receiptUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${receiptUrl}" class="button">Download Receipt</a>
        </div>
      ` : ''}

      <p>This payment confirmation has been sent to your email for your records.</p>

      <div class="card">
        <p style="margin: 0;"><strong>Need help?</strong> If you have any questions about this payment, please don't hesitate to contact our support team.</p>
      </div>
    </div>
  `

  return {
    subject: `✅ Payment Receipt - ${formatCurrency(amount)}`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Timeline Update Email
 */
export async function createTimelineUpdateEmail(data: {
  userName: string
  applicationId: string
  updateTitle: string
  updateMessage: string
  newStatus?: string
  actionUrl?: string
  timeline?: Array<{ date: string; title: string; completed: boolean }>
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, updateTitle, updateMessage, newStatus, actionUrl, timeline } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const timelineHtml = timeline && timeline.length > 0 ? `
    <div class="card">
      <h3>Application Timeline</h3>
      <div style="position: relative; padding-left: 30px;">
        ${timeline.map((item, index) => `
          <div style="position: relative; margin-bottom: 20px;">
            <div style="position: absolute; left: -25px; top: 5px; width: 12px; height: 12px; border-radius: 50%; background-color: ${item.completed ? colors.primary : colors.gray}; border: 3px solid white; box-shadow: 0 0 0 2px ${item.completed ? colors.primary : colors.gray};"></div>
            ${index < timeline.length - 1 ? `<div style="position: absolute; left: -20px; top: 20px; width: 2px; height: calc(100% + 10px); background-color: ${colors.border};"></div>` : ''}
            <div>
              <p style="margin: 0; font-weight: 600; color: ${item.completed ? colors.primary : colors.gray};">
                ${item.title}
              </p>
              <p style="margin: 5px 0 0; font-size: 14px; color: ${colors.gray};">
                ${item.date}
              </p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''

  const content = `
    <div class="email-content">
      <h1>📋 Application Update</h1>
      <p>Hi ${userName},</p>
      <p>There's an update on your application <strong>#${applicationId}</strong>:</p>

      <div class="info-box">
        <h2 style="margin-top: 0;">${updateTitle}</h2>
        <p style="margin: 0; font-size: 16px;">${updateMessage}</p>
        ${newStatus ? `<p style="margin: 15px 0 0;"><span class="badge badge-success">${newStatus}</span></p>` : ''}
      </div>

      ${timelineHtml}

      ${actionUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" class="button">View Application</a>
        </div>
      ` : ''}

      <p>Stay tuned for more updates. We'll keep you informed every step of the way!</p>
    </div>
  `

  return {
    subject: `📋 Update: ${updateTitle}`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Missing Document Reminder Email
 */
export async function createMissingDocumentEmail(data: {
  userName: string
  applicationId: string
  missingDocuments: Array<{ name: string; description?: string; required: boolean }>
  deadline?: string
  uploadUrl: string
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, missingDocuments, deadline, uploadUrl } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>📄 Document Upload Required</h1>
      <p>Hi ${userName},</p>
      <p>We noticed that some documents are still missing from your application <strong>#${applicationId}</strong>.</p>

      ${deadline ? `
        <div class="warning-box">
          <p style="margin: 0;"><strong>⏰ Deadline:</strong> Please upload the required documents by <strong>${deadline}</strong> to avoid delays in processing your application.</p>
        </div>
      ` : ''}

      <div class="card">
        <h3>Missing Documents:</h3>
        <ul style="margin: 15px 0;">
          ${missingDocuments.map(doc => `
            <li>
              <strong>${doc.name}</strong>
              ${doc.required ? '<span class="badge badge-danger">Required</span>' : '<span class="badge badge-info">Optional</span>'}
              ${doc.description ? `<br><span style="font-size: 14px; color: ${colors.gray};">${doc.description}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${uploadUrl}" class="button">Upload Documents</a>
      </div>

      <div class="info-box">
        <h3 style="margin-top: 0;">Document Upload Tips:</h3>
        <ul style="margin: 10px 0 0;">
          <li>Ensure all documents are clear and legible</li>
          <li>Accepted formats: PDF, JPG, PNG</li>
          <li>Maximum file size: 10MB per document</li>
          <li>Make sure all pages are included</li>
        </ul>
      </div>

      <p>If you have any questions about the required documents, please don't hesitate to reach out to our support team.</p>
    </div>
  `

  return {
    subject: `📄 Action Required: Upload Missing Documents`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Missing "My Details" Information Email
 */
export async function createMissingDetailsEmail(data: {
  userName: string
  missingFields: Array<{ fieldName: string; description?: string }>
  profileUrl: string
  isUrgent?: boolean
}): Promise<{ subject: string; html: string }> {
  const { userName, missingFields, profileUrl, isUrgent = false } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const boxClass = isUrgent ? 'danger-box' : 'warning-box'

  const content = `
    <div class="email-content">
      <h1>✏️ Complete Your Profile</h1>
      <p>Hi ${userName},</p>
      <p>We need some additional information to complete your profile and process your application.</p>

      <div class="${boxClass}">
        <p style="margin: 0;">
          <strong>${isUrgent ? '🚨 Urgent:' : '⚠️ Action Required:'}</strong> 
          Please update the following information in your profile.
        </p>
      </div>

      <div class="card">
        <h3>Missing Information:</h3>
        <ul style="margin: 15px 0;">
          ${missingFields.map(field => `
            <li>
              <strong>${field.fieldName}</strong>
              ${field.description ? `<br><span style="font-size: 14px; color: ${colors.gray};">${field.description}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${profileUrl}" class="button">Update My Profile</a>
      </div>

      <p>Completing your profile helps us serve you better and speeds up the processing of your application.</p>

      <div class="info-box">
        <p style="margin: 0;"><strong>💡 Tip:</strong> Having all your information ready before you start will make the process faster. You can save your progress and come back later if needed.</p>
      </div>
    </div>
  `

  return {
    subject: isUrgent ? '🚨 Urgent: Complete Your Profile' : '✏️ Action Required: Complete Your Profile',
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * School Letter Generation Email
 */
export async function createSchoolLetterEmail(data: {
  userName: string
  schoolName: string
  letterUrl: string
  applicationId: string
  instructions?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, schoolName, letterUrl, applicationId, instructions } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>🎓 Your School Letter is Ready</h1>
      <p>Hi ${userName},</p>
      <p>Great news! Your verification letter for <strong>${schoolName}</strong> has been generated and is ready for download.</p>

      <div class="info-box">
        <p style="margin: 0;">
          <strong>Application ID:</strong> #${applicationId}<br>
          <strong>School:</strong> ${schoolName}
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${letterUrl}" class="button">Download Letter</a>
      </div>

      ${instructions ? `
        <div class="card">
          <h3>Next Steps:</h3>
          <p style="white-space: pre-line;">${instructions}</p>
        </div>
      ` : `
        <div class="card">
          <h3>What to do with this letter:</h3>
          <ol style="margin: 10px 0 0; padding-left: 20px;">
            <li>Download and review the letter carefully</li>
            <li>Print the letter on official letterhead if required</li>
            <li>Submit to your school's admissions office</li>
            <li>Keep a copy for your records</li>
          </ol>
        </div>
      `}

      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Important:</strong> This letter is valid for 90 days from the date of issue. Please ensure you submit it within this timeframe.</p>
      </div>

      <p>If you need any changes or have questions about the letter, please contact our support team.</p>
    </div>
  `

  return {
    subject: `🎓 Your School Letter for ${schoolName}`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Full Instructions Email
 */
export async function createFullInstructionsEmail(data: {
  userName: string
  applicationId: string
  serviceType: string
  steps: Array<{ stepNumber: number; title: string; description: string; dueDate?: string }>
  resourcesUrl?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, serviceType, steps, resourcesUrl } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>📚 Complete Instructions for Your Application</h1>
      <p>Hi ${userName},</p>
      <p>Welcome! Here are the complete instructions for your <strong>${serviceType}</strong> application (#${applicationId}).</p>

      <div class="info-box">
        <p style="margin: 0;">Follow these steps carefully to ensure a smooth application process. We're here to help you every step of the way!</p>
      </div>

      <h2>Step-by-Step Guide</h2>

      ${steps.map((step, index) => `
        <div class="card" style="border-left: 4px solid ${colors.primary};">
          <div style="display: flex; align-items: start;">
            <div style="flex-shrink: 0; width: 40px; height: 40px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; margin-right: 15px;">
              ${step.stepNumber}
            </div>
            <div style="flex-grow: 1;">
              <h3 style="margin-top: 0;">${step.title}</h3>
              <p style="margin: 10px 0;">${step.description}</p>
              ${step.dueDate ? `<p style="margin: 10px 0 0; font-size: 14px;"><strong>Due Date:</strong> <span class="highlight">${step.dueDate}</span></p>` : ''}
            </div>
          </div>
        </div>
      `).join('')}

      ${resourcesUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resourcesUrl}" class="button button-secondary">View Additional Resources</a>
        </div>
      ` : ''}

      <hr class="divider">

      <h2>Important Reminders</h2>
      <div class="warning-box">
        <ul style="margin: 10px 0;">
          <li>Complete each step in order</li>
          <li>Double-check all information before submission</li>
          <li>Keep copies of all documents</li>
          <li>Contact us immediately if you encounter any issues</li>
          <li>Watch for email notifications for updates</li>
        </ul>
      </div>

      <div class="card">
        <h3 style="margin-top: 0;">Need Help?</h3>
        <p>Our support team is ready to assist you:</p>
        <ul style="margin: 10px 0 0;">
          <li>📧 Email: support@gritsync.com</li>
          <li>📞 Phone: Available in your dashboard</li>
          <li>💬 Live Chat: Available on our website</li>
          <li>📖 Help Center: Comprehensive guides and FAQs</li>
        </ul>
      </div>

      <p>We're excited to work with you and look forward to helping you achieve your goals!</p>
    </div>
  `

  return {
    subject: `📚 Complete Instructions - ${serviceType} Application`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Welcome Email
 */
export async function createWelcomeEmail(data: {
  userName: string
  userEmail: string
  dashboardUrl: string
}): Promise<{ subject: string; html: string }> {
  const { userName, userEmail, dashboardUrl } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>🎉 Welcome to GritSync!</h1>
      <p>Hi ${userName},</p>
      <p>Thank you for joining GritSync! We're thrilled to have you on board.</p>

      <div class="info-box">
        <p style="margin: 0;">
          <strong>Your account has been created successfully!</strong><br>
          Email: ${userEmail}
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
      </div>

      <h2>Getting Started</h2>
      <div class="card">
        <ol style="margin: 10px 0 0; padding-left: 20px;">
          <li style="margin-bottom: 15px;">
            <strong>Complete Your Profile</strong><br>
            <span style="font-size: 14px; color: ${colors.gray};">Add your personal information to get started</span>
          </li>
          <li style="margin-bottom: 15px;">
            <strong>Upload Required Documents</strong><br>
            <span style="font-size: 14px; color: ${colors.gray};">Have your important documents ready for processing</span>
          </li>
          <li style="margin-bottom: 15px;">
            <strong>Start Your Application</strong><br>
            <span style="font-size: 14px; color: ${colors.gray};">Choose the service you need and begin</span>
          </li>
        </ol>
      </div>

      <p>If you have any questions, our support team is here to help you 24/7.</p>
    </div>
  `

  return {
    subject: '🎉 Welcome to GritSync!',
    html: await createBaseTemplate(content, { userName, userEmail })
  }
}

/**
 * Email Verification Email
 */
export async function createEmailVerificationEmail(data: {
  userName: string
  userEmail: string
  verificationLink: string
  expiryTime?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, userEmail, verificationLink, expiryTime = '24 hours' } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>✉️ Verify Your Email Address</h1>
      <p>Hi ${userName},</p>
      <p>Thank you for signing up! Please verify your email address to complete your account setup.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" class="button">Verify Email Address</a>
      </div>

      <div class="info-box">
        <p style="margin: 0;"><strong>⏰ Important:</strong> This verification link will expire in ${expiryTime}.</p>
      </div>

      <p><strong>If you didn't create an account,</strong> please ignore this email.</p>

      <hr class="divider">

      <div class="card">
        <h3>Why verify your email?</h3>
        <ul style="margin: 10px 0 0;">
          <li>Secure your account and protect your information</li>
          <li>Receive important notifications about your applications</li>
          <li>Reset your password if needed</li>
          <li>Access all features of your account</li>
        </ul>
      </div>

      <p style="color: ${colors.gray}; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="color: ${colors.primary}; word-break: break-all;">${verificationLink}</span>
      </p>
    </div>
  `

  return {
    subject: '✉️ Verify Your Email Address',
    html: await createBaseTemplate(content, { userName, userEmail })
  }
}

/**
 * Application Approved Email
 */
export async function createApplicationApprovedEmail(data: {
  userName: string
  applicationId: string
  serviceType: string
  approvalDate: string
  nextSteps?: string[]
  applicationUrl: string
  certificateUrl?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, serviceType, approvalDate, nextSteps, applicationUrl, certificateUrl } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const nextStepsHtml = nextSteps && nextSteps.length > 0 ? `
    <div class="card">
      <h3 style="margin-top: 0;">Next Steps:</h3>
      <ol style="margin: 10px 0 0; padding-left: 20px;">
        ${nextSteps.map(step => `<li style="margin-bottom: 10px;">${step}</li>`).join('')}
      </ol>
    </div>
  ` : ''

  const content = `
    <div class="email-content">
      <h1>🎉 Congratulations! Your Application Has Been Approved</h1>
      <p>Hi ${userName},</p>
      <p>We're thrilled to inform you that your <strong>${serviceType}</strong> application has been <strong>approved</strong>!</p>

      <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid ${colors.primary};">
        <h2 style="margin-top: 0; color: ${colors.primary};">Application Details</h2>
        <table style="margin: 0; width: 100%;">
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Application ID:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">#${applicationId}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Service Type:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${serviceType}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Approval Date:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${approvalDate}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Status:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">
              <span class="badge badge-success">Approved ✅</span>
            </td>
          </tr>
        </table>
      </div>

      ${nextStepsHtml}

      ${certificateUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${certificateUrl}" class="button button-secondary">Download Certificate</a>
        </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${applicationUrl}" class="button">View Application Details</a>
      </div>

      <div class="card" style="background-color: #f0fdf4;">
        <p style="margin: 0;"><strong>🎊 What's Next?</strong></p>
        <p style="margin: 10px 0 0;">Your application has been successfully processed. You can now proceed with the next steps in your journey. If you have any questions, our support team is here to help!</p>
      </div>

      <p>Thank you for choosing us. We're excited to be part of your success story!</p>
    </div>
  `

  return {
    subject: `🎉 Application Approved - ${serviceType}`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Application Rejected Email
 */
export async function createApplicationRejectedEmail(data: {
  userName: string
  applicationId: string
  serviceType: string
  rejectionDate: string
  reason?: string
  appealProcess?: string
  applicationUrl: string
  supportContact?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, serviceType, rejectionDate, reason, appealProcess, applicationUrl, supportContact } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>Application Status Update</h1>
      <p>Hi ${userName},</p>
      <p>We regret to inform you that your <strong>${serviceType}</strong> application could not be approved at this time.</p>

      <div class="danger-box">
        <h2 style="margin-top: 0;">Application Details</h2>
        <table style="margin: 0; width: 100%;">
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Application ID:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">#${applicationId}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Service Type:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${serviceType}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Decision Date:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${rejectionDate}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Status:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">
              <span class="badge badge-danger">Not Approved</span>
            </td>
          </tr>
        </table>
      </div>

      ${reason ? `
        <div class="card">
          <h3 style="margin-top: 0;">Reason for Decision:</h3>
          <p style="margin: 0;">${reason}</p>
        </div>
      ` : ''}

      ${appealProcess ? `
        <div class="info-box">
          <h3 style="margin-top: 0;">Appeal Process:</h3>
          <p style="margin: 0; white-space: pre-line;">${appealProcess}</p>
        </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${applicationUrl}" class="button">View Application Details</a>
      </div>

      <div class="card">
        <h3 style="margin-top: 0;">Need Help?</h3>
        <p>If you have questions about this decision or would like to discuss your options, please don't hesitate to contact our support team.</p>
        ${supportContact ? `
          <p style="margin: 10px 0 0;">
            <strong>Contact Support:</strong><br>
            📧 <a href="mailto:${supportContact}" style="color: ${colors.primary}; text-decoration: none;">${supportContact}</a>
          </p>
        ` : ''}
      </div>

      <p>We understand this may be disappointing, and we're here to help you understand your options moving forward.</p>
    </div>
  `

  return {
    subject: `Application Status Update - ${serviceType}`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Document Approved Email
 */
export async function createDocumentApprovedEmail(data: {
  userName: string
  applicationId: string
  documentName: string
  approvedDate: string
  approvedBy?: string
  applicationUrl: string
  notes?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, documentName, approvedDate, approvedBy, applicationUrl, notes } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const content = `
    <div class="email-content">
      <h1>✅ Document Approved</h1>
      <p>Hi ${userName},</p>
      <p>Great news! Your document has been reviewed and <strong>approved</strong>.</p>

      <div class="info-box">
        <h2 style="margin-top: 0;">Document Details</h2>
        <table style="margin: 0; width: 100%;">
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Document:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${documentName}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Application ID:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">#${applicationId}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Approved Date:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${approvedDate}</td>
          </tr>
          ${approvedBy ? `
            <tr>
              <td style="border: none; padding: 8px 0;"><strong>Reviewed By:</strong></td>
              <td style="border: none; padding: 8px 0; text-align: right;">${approvedBy}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Status:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">
              <span class="badge badge-success">Approved ✅</span>
            </td>
          </tr>
        </table>
      </div>

      ${notes ? `
        <div class="card">
          <h3 style="margin-top: 0;">Notes:</h3>
          <p style="margin: 0; white-space: pre-line;">${notes}</p>
        </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${applicationUrl}" class="button">View Application</a>
      </div>

      <p>Your application is progressing well. We'll keep you updated on any further developments.</p>
    </div>
  `

  return {
    subject: `✅ Document Approved: ${documentName}`,
    html: await createBaseTemplate(content, { userName })
  }
}

/**
 * Document Rejected Email
 */
export async function createDocumentRejectedEmail(data: {
  userName: string
  applicationId: string
  documentName: string
  rejectionDate: string
  rejectionReason: string
  requiredActions?: string[]
  uploadUrl: string
  reviewedBy?: string
}): Promise<{ subject: string; html: string }> {
  const { userName, applicationId, documentName, rejectionDate, rejectionReason, requiredActions, uploadUrl, reviewedBy } = data
  const branding = await getBrandingSettings()
  const colors = {
    ...defaultColors,
    primary: branding.primaryColor,
    primaryDark: branding.primaryDark,
    secondary: branding.secondaryColor,
  }

  const actionsHtml = requiredActions && requiredActions.length > 0 ? `
    <div class="warning-box">
      <h3 style="margin-top: 0;">Required Actions:</h3>
      <ul style="margin: 10px 0 0;">
        ${requiredActions.map(action => `<li>${action}</li>`).join('')}
      </ul>
    </div>
  ` : ''

  const content = `
    <div class="email-content">
      <h1>⚠️ Document Needs Revision</h1>
      <p>Hi ${userName},</p>
      <p>We've reviewed your document, but it needs some revisions before it can be approved.</p>

      <div class="danger-box">
        <h2 style="margin-top: 0;">Document Details</h2>
        <table style="margin: 0; width: 100%;">
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Document:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${documentName}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Application ID:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">#${applicationId}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Review Date:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">${rejectionDate}</td>
          </tr>
          ${reviewedBy ? `
            <tr>
              <td style="border: none; padding: 8px 0;"><strong>Reviewed By:</strong></td>
              <td style="border: none; padding: 8px 0; text-align: right;">${reviewedBy}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="border: none; padding: 8px 0;"><strong>Status:</strong></td>
            <td style="border: none; padding: 8px 0; text-align: right;">
              <span class="badge badge-warning">Needs Revision</span>
            </td>
          </tr>
        </table>
      </div>

      <div class="card">
        <h3 style="margin-top: 0;">Reason for Revision:</h3>
        <p style="margin: 0; white-space: pre-line;">${rejectionReason}</p>
      </div>

      ${actionsHtml}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${uploadUrl}" class="button">Upload Revised Document</a>
      </div>

      <div class="info-box">
        <h3 style="margin-top: 0;">Document Upload Tips:</h3>
        <ul style="margin: 10px 0 0;">
          <li>Ensure the document is clear and legible</li>
          <li>All pages must be included</li>
          <li>Accepted formats: PDF, JPG, PNG</li>
          <li>Maximum file size: 10MB per document</li>
          <li>Make sure all information is visible and not cut off</li>
        </ul>
      </div>

      <p>Once you've uploaded the revised document, our team will review it again. If you have any questions, please contact our support team.</p>
    </div>
  `

  return {
    subject: `⚠️ Action Required: Revise ${documentName}`,
    html: await createBaseTemplate(content, { userName })
  }
}

