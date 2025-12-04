// Response Helper Utilities

/**
 * Send success response
 */
export function success(res, data = null, message = null, status = 200) {
  const response = {
    success: true
  }
  
  if (data !== null) {
    response.data = data
  }
  
  if (message) {
    response.message = message
  }
  
  return res.status(status).json(response)
}

/**
 * Send error response
 */
export function error(res, message, status = 500, details = null) {
  const response = {
    success: false,
    error: message
  }
  
  if (details) {
    response.details = details
  }
  
  if (process.env.NODE_ENV === 'development') {
    // Add additional debug info in development
  }
  
  return res.status(status).json(response)
}

/**
 * Send validation error response
 */
export function validationError(res, message, validationErrors = {}) {
  return res.status(400).json({
    success: false,
    error: message,
    validationErrors
  })
}

/**
 * Send not found response
 */
export function notFound(res, resource = 'Resource') {
  return error(res, `${resource} not found`, 404)
}

/**
 * Send unauthorized response
 */
export function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401)
}

/**
 * Send forbidden response
 */
export function forbidden(res, message = 'Access denied') {
  return error(res, message, 403)
}


