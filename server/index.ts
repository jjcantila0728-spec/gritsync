import express from 'express'
import cors from 'cors'
import { json, urlencoded } from 'express'
import authRoutes from './routes/auth'
import queryRoutes from './routes/query'
import paymentRoutes from './routes/payments'
import emailRoutes from './routes/emails'

const app = express()
const PORT = process.env.SERVER_PORT || 3001

app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(json({ limit: '10mb' }))
app.use(urlencoded({ extended: true, limit: '10mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/db', queryRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/emails', emailRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`)
})

export default app
