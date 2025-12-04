// Centralized Error Handler Middleware

import { logger } from '../utils/logger.js'

/**
 * Standard error handler middleware
 * Catches errors and returns consistent error responses
 */
export function errorHandler(err, req, res, next) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Log full error details (always log for debugging)
  logger.error('Request error', err, {
    method: req.method,
    path: req.path,
    user: req.user?.id,
    ip: req.ip || req.connection.remoteAddress
  })

  // Determine status code
  const status = err.status || err.statusCode || 500

  // Sanitize error message for production
  let errorMessage = err.message || 'Internal server error'
  
  // In production, hide sensitive error details
  if (!isDevelopment) {
    // Don't expose internal errors, database errors, etc.
    if (status === 500) {
      errorMessage = 'An internal server error occurred'
    }
    
    // Sanitize database errors
    if (errorMessage.includes('database') || errorMessage.includes('SQL')) {
      errorMessage = 'A database error occurred'
    }
    
    // Sanitize authentication errors (but keep 401/403 messages)
    if (status === 401 || status === 403) {
      // Keep auth error messages as they're not sensitive
      errorMessage = err.message || 'Authentication failed'
    }
  }

  // Build error response
  const errorResponse = {
    success: false,
    error: errorMessage,
    ...(isDevelopment && {
      stack: err.stack,
      details: err.details,
      originalMessage: err.message
    })
  }

  // Add validation errors if present (safe to expose)
  if (err.validationErrors) {
    errorResponse.validationErrors = err.validationErrors
  }

  // Add error code if available (useful for client-side handling)
  if (err.code) {
    errorResponse.code = err.code
  }

  res.status(status).json(errorResponse)
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Create standardized error object
 */
export function createError(message, status = 500, details = null) {
  const error = new Error(message)
  error.status = status
  if (details) {
    error.details = details
  }
  return error
}

/**
 * Validation error creator
 */
export function createValidationError(message, validationErrors = {}) {
  const error = createError(message, 400)
  error.validationErrors = validationErrors
  return error
}


