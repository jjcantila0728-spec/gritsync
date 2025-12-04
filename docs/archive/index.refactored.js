import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDatabase } from './db/index.js'
import { initializeStripe } from './services/stripe.js'
import authRoutes from './routes/auth.js'

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
  console.log(`\n✅ Server is running with all routes!\n`)
})


