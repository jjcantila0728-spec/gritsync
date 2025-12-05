// Input Sanitization Middleware
import { logger } from '../utils/logger.js'

/**
 * Sanitize string input
 * Removes potentially dangerous characters and normalizes input
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  return sanitized
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }
  
  if (typeof obj === 'object') {
    const sanitized = {}
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const sanitizedKey = sanitizeString(key)
      // Sanitize value
      sanitized[sanitizedKey] = sanitizeObject(value)
    }
    return sanitized
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  return obj
}

/**
 * Input sanitization middleware
 * Sanitizes request body, query parameters, and params
 */
export function sanitizeInput(req, res, next) {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body)
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query)
    }
    
    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params)
    }
    
    next()
  } catch (error) {
    logger.error('Input sanitization error', error)
    res.status(400).json({ error: 'Invalid input data' })
  }
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return null
  }
  
  const sanitized = sanitizeString(email).toLowerCase()
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized)) {
    return null
  }
  
  return sanitized
}

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') {
    return null
  }
  
  const sanitized = sanitizeString(url)
  
  try {
    const parsed = new URL(sanitized)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    return sanitized
  } catch {
    return null
  }
}

/**
 * Sanitize SQL injection patterns (basic check)
 * Note: This is a basic check. Always use parameterized queries!
 */
export function containsSQLInjection(input) {
  if (typeof input !== 'string') {
    return false
  }
  
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|;|\*|'|"|`)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * Validate input doesn't contain SQL injection patterns
 */
export function validateNoSQLInjection(req, res, next) {
  const checkObject = (obj) => {
    if (obj === null || obj === undefined) {
      return true
    }
    
    if (Array.isArray(obj)) {
      return obj.every(item => checkObject(item))
    }
    
    if (typeof obj === 'object') {
      return Object.values(obj).every(value => checkObject(value))
    }
    
    if (typeof obj === 'string') {
      if (containsSQLInjection(obj)) {
        logger.warn('Potential SQL injection detected', {
          input: obj.substring(0, 100),
          ip: req.ip,
          path: req.path
        })
        return false
      }
    }
    
    return true
  }
  
  const checks = [
    checkObject(req.body),
    checkObject(req.query),
    checkObject(req.params)
  ]
  
  if (checks.every(check => check)) {
    next()
  } else {
    res.status(400).json({ error: 'Invalid input detected' })
  }
}
