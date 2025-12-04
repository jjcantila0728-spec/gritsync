import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDatabase } from './db/index.js'
import { initializeStripe } from './services/stripe.js'
import authRoutes from './routes/auth.js'
// TODO: Import other route modules as they are created:
// import applicationsRoutes from './routes/applications.js'
// import quotationsRoutes from './routes/quotations.js'
// import servicesRoutes from './routes/services.js'
// import clientsRoutes from './routes/clients.js'
// import userRoutes from './routes/user.js'
// import paymentsRoutes from './routes/payments.js'
// import dashboardRoutes from './routes/dashboard.js'
// import notificationsRoutes from './routes/notifications.js'
// import webhooksRoutes from './routes/webhooks.js'
// import testRoutes from './routes/test.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static('public'))

// Initialize database
initDatabase()

// Initialize Stripe after database is ready
initializeStripe()

// Routes
app.use('/api/auth', authRoutes)
// TODO: Mount other route modules:
// app.use('/api/applications', applicationsRoutes)
// app.use('/api/quotations', quotationsRoutes)
// app.use('/api/services', servicesRoutes)
// app.use('/api/clients', clientsRoutes)
// app.use('/api/user', userRoutes)
// app.use('/api/payments', paymentsRoutes)
// app.use('/api/dashboard', dashboardRoutes)
// app.use('/api/admin', dashboardRoutes) // Admin routes can share dashboard router
// app.use('/api/notifications', notificationsRoutes)
// app.use('/api/webhooks', webhooksRoutes)
// app.use('/api/test', testRoutes)

// Root route - API information
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

// 404 handler for undefined routes
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.path} - Route not found`)
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    message: 'The requested endpoint does not exist. Available endpoints: /api/auth, /api/applications, /api/user/details, etc.'
  })
})

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`${'='.repeat(50)}`)
  console.log(`User API endpoints:`)
  console.log(`  GET  /api/user/details`)
  console.log(`  POST /api/user/details`)
  console.log(`  GET  /api/user/documents`)
  console.log(`  POST /api/user/documents/:type`)
  console.log(`  GET  /api/files/:userId/:filename`)
  console.log(`  GET  /api/test/user-details-route (test endpoint)`)
  console.log(`${'='.repeat(50)}`)
  console.log(`\n✅ Server is running with all routes!\n`)
})


