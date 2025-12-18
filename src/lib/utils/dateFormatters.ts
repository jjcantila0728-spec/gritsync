/**
 * Shared date formatting utilities used across multiple pages
 */

// Helper function to format MM/DD/YYYY input
export function formatMMDDYYYY(value: string): string {
  const digits = value.replace(/\D/g, '')
  const limited = digits.slice(0, 8)
  
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 4) {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`
  } else {
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`
  }
}

// Helper function to format MM/YYYY input
export function formatMMYYYY(value: string): string {
  const digits = value.replace(/\D/g, '')
  const limited = digits.slice(0, 6)
  
  if (limited.length <= 2) {
    return limited
  } else {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`
  }
}

// Convert from database format (YYYY-MM-DD or other) to MM/DD/YYYY
export function convertFromDatabaseFormat(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  
  if (/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(dateStr)) {
    return dateStr
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-')
    return `${month}/${day}/${year}`
  }
  
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) {
    const [month, year] = dateStr.split('/')
    return `${month}/01/${year}`
  }
  
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }
  
  return dateStr
}

// Convert MM/DD/YYYY to YYYY-MM-DD for database storage
export function convertToDatabaseFormat(mmddyyyy: string): string {
  if (!mmddyyyy || !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(mmddyyyy)) return ''
  
  const [month, day, year] = mmddyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Convert YYYY-MM to MM/YYYY
export function convertToMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) return dateStr
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-')
    return `${month}/${year}`
  }
  return dateStr
}

// Convert MM/YYYY to YYYY-MM for database storage
export function convertMMYYYYToDatabase(mmyyyy: string): string {
  if (!mmyyyy || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(mmyyyy)) return ''
  
  const [month, year] = mmyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}`
}

// Helper function to validate MM/DD/YYYY format
export function isValidMMDDYYYY(value: string): boolean {
  const pattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
  if (!pattern.test(value)) return false
  
  const [month, day, year] = value.split('/').map(Number)
  
  // Validate month
  if (month < 1 || month > 12) return false
  
  // Validate year
  if (year < 1900 || year > 2100) return false
  
  // Validate day based on month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  // Check for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  if (isLeapYear) daysInMonth[1] = 29
  
  if (day < 1 || day > daysInMonth[month - 1]) return false
  
  return true
}







