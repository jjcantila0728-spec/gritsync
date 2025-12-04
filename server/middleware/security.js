// Security Middleware for Production
import { logger } from '../utils/logger.js'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Security headers middleware
 * Sets important security headers for production
 */
export function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy (adjust based on your needs)
  if (isProduction) {
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL?.replace('/api', '') || ''
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ${frontendUrl} https://api.stripe.com https://*.supabase.co; frame-src https://js.stripe.com;`
    )
  }
  
  // Strict Transport Security (only in production with HTTPS)
  if (isProduction && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  next()
}

/**
 * Request logging middleware for production monitoring
 */
export function requestLogger(req, res, next) {
  const start = Date.now()
  
  // Log request in production
  if (isProduction) {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
  }
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - start
    if (isProduction && duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`)
    }
  })
  
  next()
}

/**
 * Validate required environment variables in production
 */
export function validateEnvironment() {
  if (!isProduction) {
    return // Skip validation in development
  }
  
  const required = [
    'JWT_SECRET',
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'FRONTEND_URL'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  // Warn if using test keys in production
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    logger.warn('⚠️  Using Stripe test key in production!')
  }
  
  if (process.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) {
    logger.warn('⚠️  Using Stripe test publishable key in production!')
  }
}
