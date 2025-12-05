import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeStripe, getStripe } from './services/stripe.js'
import { errorHandler } from './middleware/errorHandler.js'
import { logger } from './utils/logger.js'
import { securityHeaders, requestLogger, validateEnvironment } from './middleware/security.js'
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimiter.js'
import { sanitizeInput, validateNoSQLInjection } from './middleware/sanitize.js'
import { csrfProtection, addCSRFToken } from './middleware/csrf.js'
import { compressionMiddleware } from './middleware/compression.js'
import { performanceMonitor, getMetrics } from './middleware/performance.js'
import authRoutes from './routes/auth.js'
import sessionsRoutes from './routes/sessions.js'
import applicationsRoutes from './routes/applications.js'
import quotationsRoutes from './routes/quotations.js'
import servicesRoutes from './routes/services.js'
import clientsRoutes from './routes/clients.js'
import userRoutes from './routes/user.js'
import paymentsRoutes from './routes/payments.js'
import notificationsRoutes from './routes/notifications.js'
import webhooksRoutes from './routes/webhooks.js'
import dashboardRoutes from './routes/dashboard.js'
import filesRoutes from './routes/files.js'
import trackRoutes from './routes/track.js'
import usersRoutes from './routes/users.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production'

// Validate environment variables in production
if (isProduction) {
  try {
    validateEnvironment()
  } catch (error) {
    logger.error('Environment validation failed:', error)
    process.exit(1)
  }
}

// Trust proxy (important for rate limiting and IP detection behind reverse proxy)
app.set('trust proxy', 1)

// Request timeout (30 seconds for API requests)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'The request took too long to process'
      })
    }
  })
  next()
})

// Compression middleware (reduces response size)
app.use(compressionMiddleware)

// Security headers middleware (must be early)
app.use(securityHeaders)

// Request logging
app.use(requestLogger)

// Performance monitoring
app.use(performanceMonitor)

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // In production, only allow specific origins
    if (isProduction) {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.VITE_API_URL?.replace('/api', '')
      ].filter(Boolean)
      
      // Allow requests with no origin (mobile apps, Postman, etc.) - be careful with this
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        logger.warn(`CORS blocked origin: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    } else {
      // In development, allow all origins
      callback(null, true)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}

app.use(cors(corsOptions))

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Input sanitization (before CSRF and routes)
app.use(sanitizeInput)
app.use(validateNoSQLInjection)

// Static files with optimized caching
app.use(express.static('public', {
  maxAge: isProduction ? '1y' : '0', // 1 year in production, no cache in dev
  etag: true,
  lastModified: true,
  immutable: true, // Mark as immutable for better caching
  setHeaders: (res, path) => {
    // Set appropriate cache headers based on file type
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate')
    } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
}))

// Initialize Stripe (async, but we don't wait for it)
initializeStripe().catch(err => {
  logger.error('Failed to initialize Stripe', err)
})

// Health check endpoints (before rate limiting)
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage()
  const metrics = getMetrics()
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.round(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    },
    performance: {
      totalRequests: metrics.requests,
      averageResponseTime: metrics.averageResponseTime,
      errors: metrics.errors
    }
  })
})

app.get('/ready', async (req, res) => {
  try {
    const startTime = Date.now()
    
    // Check critical services
    const checks = {
      database: true, // Supabase connection would be checked here
      stripe: !!getStripe()
    }
    
    // Additional health checks in production
    if (isProduction) {
      // Check memory usage
      const memUsage = process.memoryUsage()
      checks.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      }
      
      // Warn if memory usage is high (>80% of heap)
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100
      if (heapUsagePercent > 80) {
        logger.warn('High memory usage detected', { heapUsagePercent: Math.round(heapUsagePercent) })
      }
    }
    
    const allHealthy = Object.values(checks).every(v => {
      if (typeof v === 'object') return true // Skip object checks
      return v === true
    })
    
    const responseTime = Date.now() - startTime
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not ready',
      checks,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Readiness check failed', error)
    res.status(503).json({
      status: 'not ready',
      error: isProduction ? 'Service unavailable' : error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Apply rate limiting to API routes
app.use('/api', apiRateLimiter)

// CSRF protection for state-changing requests (after authentication routes)
// Note: CSRF is applied per-route where needed, not globally
// GET requests and webhooks are excluded

// Mount route modules
app.use('/api/auth', authRateLimiter, authRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/applications', applicationsRoutes)
app.use('/api/quotations', quotationsRoutes)
app.use('/api/services', servicesRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/user', userRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/webhooks', webhooksRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/track', trackRoutes)
app.use('/api/users', usersRoutes)

app.get('/', (req, res) => {
  res.json({
    message: 'GritSync API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      applications: '/api/applications',
      quotations: '/api/quotations',
      clients: '/api/clients',
      userDetails: '/api/user/details',
      userDocuments: '/api/user/documents',
      files: '/api/files/:userId/:filename',
      dashboard: '/api/dashboard/stats',
      notifications: '/api/notifications',
      payments: '/api/payments',
      webhooks: '/api/webhooks/stripe'
    },
    status: 'running'
  })
})

// Test routes - only available in development
if (!isProduction) {
  // Test route to verify server is running new code
  app.get('/api/test/user-details-route', (req, res) => {
    res.json({ message: 'User details routes are loaded!', timestamp: new Date().toISOString() })
  })

  // Test route for documents
  app.get('/api/test/documents-route', (req, res) => {
    res.json({ message: 'Documents routes are loaded!', timestamp: new Date().toISOString() })
  })

  // Test route for Stripe connection
  app.get('/api/test/stripe-connection', async (req, res) => {
  try {
    // Check if Stripe is initialized
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Stripe is not configured',
        message: 'STRIPE_SECRET_KEY environment variable is not set',
        timestamp: new Date().toISOString()
      })
    }

    // Check if secret key is set
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      return res.status(503).json({
        success: false,
        error: 'Stripe secret key not found',
        message: 'STRIPE_SECRET_KEY environment variable is not set',
        timestamp: new Date().toISOString()
      })
    }

    // Determine if test or live mode
    const isTestMode = secretKey.startsWith('sk_test_')
    const keyPrefix = secretKey.substring(0, 8) // Show first 8 chars for identification

    // Test the connection by retrieving account information
    const account = await stripe.accounts.retrieve()
    
    // Also try to retrieve balance to verify full API access
    const balance = await stripe.balance.retrieve()

    res.json({
      success: true,
      message: 'Stripe connection successful!',
      details: {
        accountId: account.id,
        accountType: account.type,
        country: account.country,
        defaultCurrency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        mode: isTestMode ? 'test' : 'live',
        keyPrefix: keyPrefix + '...',
        balance: {
          available: balance.available.map(b => ({
            amount: b.amount / 100, // Convert from cents
            currency: b.currency
          })),
          pending: balance.pending.map(b => ({
            amount: b.amount / 100,
            currency: b.currency
          }))
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Stripe connection test error', error)
    res.status(500).json({
      success: false,
      error: 'Stripe connection test failed',
      message: error.message,
      type: error.type || 'Unknown',
      code: error.code || 'unknown_error',
      timestamp: new Date().toISOString()
    })
  }
  })
}

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    message: 'The requested endpoint does not exist. Available endpoints: /api/auth, /api/applications, /api/user/details, etc.'
  })
})

// Error handler middleware (must be last)
app.use(errorHandler)

// Periodic cleanup of expired sessions (every hour)
if (isProduction) {
  setInterval(async () => {
    try {
      const { cleanupExpiredSessions } = await import('./utils/sessions.js')
      const count = await cleanupExpiredSessions()
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired sessions`)
      }
    } catch (error) {
      logger.error('Error during session cleanup', error)
    }
  }, 60 * 60 * 1000) // Every hour
}

// Create server instance for graceful shutdown
const server = app.listen(PORT, () => {
  if (isProduction) {
    logger.info('🚀 GritSync API Server running in PRODUCTION mode', {
      port: PORT,
      environment: process.env.NODE_ENV,
      frontendUrl: process.env.FRONTEND_URL || 'Not set',
      features: {
        sessionManagement: 'Enabled',
        csrfProtection: 'Enabled',
        inputSanitization: 'Enabled',
        compression: 'Enabled',
        rateLimiting: 'Enabled'
      }
    })
  } else {
    logger.info(`Server running on http://localhost:${PORT}`)
  }
})

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`)
  
  server.close(() => {
    logger.info('HTTP server closed')
    
    // Close database connections, cleanup, etc.
    // Supabase handles its own cleanup
    
    logger.info('Graceful shutdown complete')
    process.exit(0)
  })
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
  gracefulShutdown('uncaughtException')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise })
  // Don't exit on unhandled rejection in production, just log it
  if (!isProduction) {
    gracefulShutdown('unhandledRejection')
  }
})

// Export server for testing
export default app

