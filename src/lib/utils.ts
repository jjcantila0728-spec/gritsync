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

