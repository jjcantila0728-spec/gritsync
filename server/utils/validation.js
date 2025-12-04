// Validation Utilities

/**
 * Validate email format
 */
export function validateEmail(email) {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate required fields
 */
export function validateRequired(fields, data) {
  const missing = fields.filter(field => !data[field] && data[field] !== 0)
  if (missing.length > 0) {
    return {
      valid: false,
      missing: missing,
      message: `Missing required fields: ${missing.join(', ')}`
    }
  }
  return { valid: true }
}

/**
 * Validate password strength
 */
export function validatePassword(password) {
  if (!password) {
    return { valid: false, message: 'Password is required' }
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' }
  }
  return { valid: true }
}

/**
 * Validate role
 */
export function validateRole(role, allowedRoles = ['client', 'admin']) {
  if (!role || !allowedRoles.includes(role)) {
    return {
      valid: false,
      message: `Invalid role. Must be one of: ${allowedRoles.join(', ')}`
    }
  }
  return { valid: true }
}

/**
 * Validate payment type
 */
export function validatePaymentType(paymentType) {
  const validTypes = ['step1', 'step2', 'full']
  if (!paymentType || !validTypes.includes(paymentType)) {
    return {
      valid: false,
      message: `Invalid payment type. Must be one of: ${validTypes.join(', ')}`
    }
  }
  return { valid: true }
}

/**
 * Validate status
 */
export function validateStatus(status, allowedStatuses) {
  if (!status || !allowedStatuses.includes(status)) {
    return {
      valid: false,
      message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
    }
  }
  return { valid: true }
}

/**
 * Sanitize string input
 */
export function sanitizeString(str, maxLength = null) {
  if (typeof str !== 'string') return ''
  let sanitized = str.trim()
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  return sanitized
}

/**
 * Validate file type
 */
export function validateFileType(filename, allowedTypes = ['jpg', 'jpeg', 'png', 'pdf']) {
  if (!filename) return { valid: false, message: 'Filename is required' }
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext || !allowedTypes.includes(ext)) {
    return {
      valid: false,
      message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    }
  }
  return { valid: true }
}


