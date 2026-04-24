import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { json, urlencoded } from 'express'
import authRoutes from './routes/auth'
import queryRoutes from './routes/query'
import paymentRoutes from './routes/payments'
import emailRoutes from './routes/emails'
import questionRoutes from './routes/questions'
import storageRoutes from './routes/storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

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

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/db', queryRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/emails', emailRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/storage', storageRoutes)

if (isProd) {
  // Serve built frontend static files
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))

  // SPA fallback — send index.html for all non-API routes (Express 5 syntax)
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // Dev: 404 for unknown routes (Vite handles the frontend)
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
}

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT} (${isProd ? 'production' : 'development'})`)
})

export default app
