import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, includeTime: boolean = false): string {
  const dateObj = new Date(date)
  const dateStr = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  if (includeTime) {
    const timeStr = dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    })
    return `${dateStr} at ${timeStr}`
  }
  
  return dateStr
}

export function formatDistanceToNow(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''}`
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''}`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''}`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''}`
  }
  
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''}`
  }
  
  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

// Phone number validation (basic)
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  // Check if it has 10-15 digits (international format)
  return digits.length >= 10 && digits.length <= 15
}

// Password strength validation
// This function now uses admin settings for validation
export async function validatePassword(password: string): Promise<{ valid: boolean; message?: string }> {
  // Import settings dynamically to avoid circular dependencies
  const { validatePasswordAgainstSettings } = await import('./settings')
  
  // Use settings-based validation
  const settingsValidation = await validatePasswordAgainstSettings(password)
  if (!settingsValidation.valid) {
    return settingsValidation
  }
  
  // Additional basic checks
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' }
  }
  
  return { valid: true }
}

// Legacy synchronous version for backward compatibility
// This uses default values if settings can't be loaded
export function validatePasswordSync(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' }
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' }
  }
  return { valid: true }
}

// Get full name from first_name and last_name
export function getFullName(firstName?: string | null, lastName?: string | null, fallback?: string): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim()
  }
  if (firstName) return firstName
  if (lastName) return lastName
  return fallback || ''
}

// Get full name with middle name (first, middle, last)
export function getFullNameWithMiddle(firstName?: string | null, middleName?: string | null, lastName?: string | null, fallback?: string): string {
  const parts = [firstName, middleName, lastName].filter(Boolean)
  if (parts.length > 0) {
    return parts.join(' ').trim()
  }
  return fallback || ''
}

// Get first name from full name or first_name
export function getFirstName(user?: { first_name?: string | null; last_name?: string | null; full_name?: string | null }): string {
  if (user?.first_name) return user.first_name
  if (user?.full_name) return user.full_name.split(' ')[0]
  return ''
}

// Input sanitization - remove potentially dangerous characters
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

// HTML sanitization using DOMPurify for XSS protection
// Cache DOMPurify instance to avoid repeated imports
let DOMPurifyInstance: any = null
let DOMPurifyInitPromise: Promise<any> | null = null

function initDOMPurify() {
  if (DOMPurifyInitPromise) {
    return DOMPurifyInitPromise
  }
  
  if (typeof window === 'undefined') {
    return Promise.resolve(null)
  }
  
  DOMPurifyInitPromise = (async () => {
    try {
      const createDOMPurify = (await import('isomorphic-dompurify')).default
      DOMPurifyInstance = createDOMPurify(window)
      return DOMPurifyInstance
    } catch (error) {
      console.error('Error loading DOMPurify:', error)
      return null
    }
  })()
  
  return DOMPurifyInitPromise
}

// Initialize DOMPurify on module load (non-blocking)
if (typeof window !== 'undefined') {
  initDOMPurify().catch(() => {
    // Silently fail - will be retried on first use
  })
}

export function sanitizeHTML(html: string, options?: { allowEmailTemplates?: boolean }): string {
  if (typeof window === 'undefined') {
    // Server-side: return as-is (DOMPurify needs DOM)
    return html
  }
  
  // If DOMPurify is already loaded, use it synchronously
  if (DOMPurifyInstance) {
    try {
      // For email templates, use more permissive settings
      if (options?.allowEmailTemplates) {
        return DOMPurifyInstance.sanitize(html, {
          ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'thead', 'tbody',
            'tr', 'td', 'th', 'blockquote', 'pre', 'code', 'hr', 'b', 'i', 'small',
            'sub', 'sup', 'mark', 'del', 'ins', 'abbr', 'address', 'article', 'aside',
            'footer', 'header', 'main', 'nav', 'section', 'time', 'html', 'head', 'body',
            'meta', 'title', 'style', 'link', 'script', 'form', 'input', 'button', 'label',
            'select', 'option', 'textarea', 'fieldset', 'legend', 'colgroup', 'col', 'tfoot'
          ],
          ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'width', 'height',
            'align', 'valign', 'colspan', 'rowspan', 'target', 'rel', 'type', 'charset',
            'name', 'content', 'media', 'lang', 'dir', 'role', 'aria-label', 'data-*',
            'bgcolor', 'color', 'border', 'cellpadding', 'cellspacing', 'valign', 'align',
            'background', 'background-color', 'font-family', 'font-size', 'font-weight',
            'text-align', 'padding', 'margin', 'border-radius', 'display', 'flex', 'flex-direction',
            'border-color', 'border-width', 'border-style', 'text-decoration', 'line-height'
          ],
          ALLOW_DATA_ATTR: true,
          ALLOW_UNKNOWN_PROTOCOLS: false,
          ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
          KEEP_CONTENT: true,
          RETURN_DOM: false,
          RETURN_DOM_FRAGMENT: false,
          RETURN_TRUSTED_TYPE: false
        })
      }
      
      // Default sanitization for regular content
      return DOMPurifyInstance.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'thead', 'tbody',
          'tr', 'td', 'th', 'blockquote', 'pre', 'code', 'hr', 'b', 'i', 'small',
          'sub', 'sup', 'mark', 'del', 'ins', 'abbr', 'address', 'article', 'aside',
          'footer', 'header', 'main', 'nav', 'section', 'time'
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'width', 'height',
          'align', 'valign', 'colspan', 'rowspan', 'target', 'rel'
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        RETURN_TRUSTED_TYPE: false
      })
    } catch (error) {
      console.error('Error sanitizing HTML:', error)
      return html
    }
  }
  
  // If DOMPurify is not loaded yet, try to initialize it (non-blocking)
  // and return HTML as-is for now (safe for trusted templates)
  if (!DOMPurifyInitPromise) {
    initDOMPurify().catch(() => {
      // Silently fail
    })
  }
  
  // For trusted templates like cover letters, return as-is if DOMPurify isn't ready yet
  return html
}

// Export data to CSV
export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (!data || data.length === 0) {
    return
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0])
  
  // Create CSV content
  const csvContent = [
    // Headers
    csvHeaders.map(h => `"${h}"`).join(','),
    // Data rows
    ...data.map(row => 
      csvHeaders.map(header => {
        const value = row[header] ?? ''
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`
      }).join(',')
    )
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Pagination helper
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  return {
    data: items.slice(startIndex, endIndex),
    totalPages: Math.ceil(items.length / pageSize),
    currentPage: page,
    totalItems: items.length,
    hasNextPage: endIndex < items.length,
    hasPreviousPage: page > 1
  }
}

// Debounce utility for optimizing real-time updates
// PDF text wrapping helper for jsPDF
// Wraps text to fit within a specified width and returns an array of lines
export function wrapTextForPDF(
  doc: any,
  text: string,
  maxWidth: number,
  options?: { fontSize?: number; font?: string; fontStyle?: string }
): string[] {
  if (!text) return []
  
  // Set font if provided
  if (options?.fontSize) {
    doc.setFontSize(options.fontSize)
  }
  if (options?.font) {
    doc.setFont(options.font, options.fontStyle || 'normal')
  }
  
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = doc.getTextWidth(testLine)
    
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }
  
  return lines
}

// PDF helper to add text with automatic wrapping and page breaks
export function addWrappedTextToPDF(
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  pageHeight: number,
  margin: number,
  options?: { fontSize?: number; font?: string; fontStyle?: string; color?: [number, number, number] }
): number {
  // Set font and color if provided
  if (options?.fontSize) {
    doc.setFontSize(options.fontSize)
  }
  if (options?.font) {
    doc.setFont(options.font, options.fontStyle || 'normal')
  }
  if (options?.color) {
    doc.setTextColor(...options.color)
  }
  
  const lines = wrapTextForPDF(doc, text, maxWidth, options)
  let currentY = y
  
  for (const line of lines) {
    // Check if we need a new page
    if (currentY > pageHeight - margin - lineHeight) {
      doc.addPage()
      currentY = margin
    }
    
    doc.text(line, x, currentY)
    currentY += lineHeight
  }
  
  return currentY
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

