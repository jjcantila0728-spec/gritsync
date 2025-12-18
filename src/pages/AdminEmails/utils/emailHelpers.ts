import { BusinessLogo } from '@/lib/email-signatures-api'

/**
 * Get email preview text from HTML or plain text
 */
export const getEmailPreview = (html?: string, text?: string, maxLength: number = 80): string => {
  if (text && text.trim()) {
    const cleaned = text.trim().replace(/\s+/g, ' ')
    return cleaned.substring(0, maxLength) + (cleaned.length > maxLength ? '...' : '')
  }
  if (html && html.trim()) {
    const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    return stripped.substring(0, maxLength) + (stripped.length > maxLength ? '...' : '')
  }
  return ''
}

/**
 * Get email logo/avatar for a given email address
 */
export const getEmailLogo = (email: any, businessLogos: BusinessLogo[]): BusinessLogo | null => {
  if (!email || !businessLogos || businessLogos.length === 0) return null
  
  // Try to match by email address
  const matchedLogo = businessLogos.find(logo => 
    logo.associated_email && email.email_address && 
    logo.associated_email.toLowerCase() === email.email_address.toLowerCase()
  )
  
  if (matchedLogo) return matchedLogo
  
  // Try to match by address type
  if (email.address_type) {
    const typeMatchedLogo = businessLogos.find(logo => 
      logo.associated_email && 
      logo.associated_email.toLowerCase().includes(email.address_type.toLowerCase())
    )
    if (typeMatchedLogo) return typeMatchedLogo
  }
  
  return null
}

/**
 * Get avatar for email address
 */
export const getAvatarForEmail = (emailAddress: string, businessLogos: BusinessLogo[]): BusinessLogo | null => {
  if (!emailAddress || !businessLogos || businessLogos.length === 0) return null
  
  return businessLogos.find(logo => 
    logo.associated_email && 
    logo.associated_email.toLowerCase() === emailAddress.toLowerCase()
  ) || null
}

/**
 * Export email logs to CSV
 */
export const exportToCSV = (emailLogs: any[], format: typeof import('date-fns').format) => {
  const headers = ['Date', 'To', 'Subject', 'Status', 'Type', 'Category']
  const rows = emailLogs.map(log => [
    format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
    log.recipient_email,
    log.subject || '',
    log.status || '',
    log.email_type || '',
    log.category || '',
  ])
  
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sent-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}







