// CSRF Protection Middleware
import crypto from 'crypto'
import { logger } from '../utils/logger.js'

// In-memory store for CSRF tokens (in production, use Redis or database)
const csrfTokens = new Map()

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of csrfTokens.entries()) {
    if (data.expiresAt < now) {
      csrfTokens.delete(token)
    }
  }
}, 60 * 60 * 1000)

/**
 * Generate a CSRF token
 * @param {string} sessionId - Session ID (optional, for session-based tokens)
 * @returns {string} CSRF token
 */
export function generateCSRFToken(sessionId = null) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  
  csrfTokens.set(token, {
    sessionId,
    expiresAt,
    createdAt: Date.now()
  })
  
  return token
}

/**
 * Validate CSRF token
 * @param {string} token - CSRF token to validate
 * @param {string} sessionId - Session ID (optional)
 * @returns {boolean} True if valid
 */
export function validateCSRFToken(token, sessionId = null) {
  if (!token) {
    return false
  }
  
  const tokenData = csrfTokens.get(token)
  
  if (!tokenData) {
    return false
  }
  
  // Check if token is expired
  if (tokenData.expiresAt < Date.now()) {
    csrfTokens.delete(token)
    return false
  }
  
  // If sessionId is provided, verify it matches
  if (sessionId && tokenData.sessionId !== sessionId) {
    return false
  }
  
  return true
}

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 */
export function csrfProtection(req, res, next) {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  
  // Skip CSRF for webhook endpoints (they use signature verification instead)
  if (req.path.startsWith('/api/webhooks')) {
    return next()
  }
  
  // Get token from header or body
  const token = req.headers['x-csrf-token'] || req.body?.csrfToken || req.query?.csrfToken
  
  // Get session ID if available
  const sessionId = req.session?.id || null
  
  if (!token) {
    logger.warn('CSRF token missing', {
      method: req.method,
      path: req.path,
      ip: req.ip
    })
    return res.status(403).json({ 
      error: 'CSRF token required',
      message: 'Please include a CSRF token in the X-CSRF-Token header or request body'
    })
  }
  
  if (!validateCSRFToken(token, sessionId)) {
    logger.warn('Invalid CSRF token', {
      method: req.method,
      path: req.path,
      ip: req.ip
    })
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      message: 'The CSRF token is invalid or expired. Please refresh the page and try again.'
    })
  }
  
  // Token is valid, continue
  next()
}

/**
 * Middleware to add CSRF token to response
 * Call this after authentication to include token in response
 */
export function addCSRFToken(req, res, next) {
  // Only add token if user is authenticated
  if (req.user || req.session) {
    const sessionId = req.session?.id || null
    const token = generateCSRFToken(sessionId)
    
    // Add token to response header
    res.setHeader('X-CSRF-Token', token)
    
    // Also add to response body if it's a JSON response
    if (req.path.startsWith('/api')) {
      const originalJson = res.json.bind(res)
      res.json = function(data) {
        if (data && typeof data === 'object') {
          data.csrfToken = token
        }
        return originalJson(data)
      }
    }
  }
  
  next()
}
