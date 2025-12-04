// Rate Limiting Middleware
// Simple in-memory rate limiter (consider Redis for distributed systems)

const isProduction = process.env.NODE_ENV === 'production'

// Store for rate limit tracking
const rateLimitStore = new Map()

// Clean up old entries every 15 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > 0) {
      rateLimitStore.delete(key)
    }
  }
}, 15 * 60 * 1000)

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100, // 100 requests per window
  message = 'Too many requests, please try again later',
  keyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown'
}) {
  return (req, res, next) => {
    // Skip rate limiting in development unless explicitly enabled
    if (!isProduction && process.env.ENABLE_RATE_LIMIT !== 'true') {
      return next()
    }
    
    const key = keyGenerator(req)
    const now = Date.now()
    const record = rateLimitStore.get(key)
    
    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      })
      return next()
    }
    
    if (record.count >= max) {
      // Rate limit exceeded
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000) // seconds
      })
      return
    }
    
    // Increment count
    record.count++
    next()
  }
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => {
    // Use IP + email if available for more specific limiting
    const email = req.body?.email || req.body?.username || ''
    return `${req.ip || 'unknown'}-${email}`
  }
})

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many API requests, please try again later'
})

export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Rate limit exceeded, please try again later'
})
