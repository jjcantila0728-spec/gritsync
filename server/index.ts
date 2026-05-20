import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { json, urlencoded } from 'express'
import authRoutes from './routes/auth'
import queryRoutes from './routes/query'
import paymentRoutes from './routes/payments'
import emailRoutes from './routes/emails'
import questionRoutes from './routes/questions'
import storageRoutes from './routes/storage'
import contactRoutes from './routes/contact'
import messageRoutes from './routes/messages'
import referralRoutes from './routes/referrals'
import socialRoutes, { processDuePosts } from './routes/social'
import { pollPushReceipts, pruneStalePushTokens } from './lib/push'
import socialAiRoutes from './routes/social-ai'
import integrationsRoutes from './routes/integrations'
import nclexRoutes from './routes/nclex'
import processingAccountsRoutes from './routes/processing-accounts'
// agentsRoutes uses Playwright (Chromium) which cannot run in Vercel serverless.
// Loaded dynamically below — skipped entirely when process.env.VERCEL is set.

const app = express()
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(json({ limit: '10mb' }))
app.use(urlencoded({ extended: true, limit: '10mb' }))

// Health check — quick liveness probe (DB health is in api/health.ts)
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
app.use('/api/contact', contactRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/social/ai', socialAiRoutes)
app.use('/api/integrations', integrationsRoutes)
app.use('/api/nclex', nclexRoutes)
app.use('/api/processing-accounts', processingAccountsRoutes)

// Playwright-based agents: only available outside Vercel serverless.
// Use a computed path so esbuild cannot statically trace the import and
// bundle playwright (a native binary) into the lambda.
if (!process.env.VERCEL) {
  const agentsModule = './routes/' + 'agents'
  import(agentsModule).then(({ default: agentsRoutes }) => {
    app.use('/api/agents', agentsRoutes)
  }).catch((err) => {
    console.warn('Agents route failed to load (Playwright may be missing):', err.message)
  })
}

// On Vercel the Vite build is served as static files by the CDN; the Express
// app only handles /api/* routes.  Locally / on self-hosted servers we still
// serve the compiled frontend from dist/.
if (isProd && !process.env.VERCEL) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else if (!isProd) {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
}

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// Start local server (Vercel uses the exported app instead)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT} (${isProd ? 'production' : 'development'})`)
    // Poll for due scheduled social posts every minute (local/self-hosted only).
    setInterval(() => {
      processDuePosts().catch((err) => console.error('Scheduled post tick failed:', err))
    }, 60_000)
    // Poll Expo for push delivery receipts every 5 minutes. Drops tokens whose
    // receipts come back DeviceNotRegistered so the next send isn't wasted.
    setInterval(() => {
      pollPushReceipts().catch((err) => console.error('Push receipt poll failed:', err))
    }, 5 * 60_000)
    // Once a day, drop push tokens that haven't been refreshed in 90+ days —
    // those devices have almost certainly uninstalled or stopped using the app.
    setInterval(() => {
      pruneStalePushTokens().catch((err) => console.error('Push token prune failed:', err))
    }, 24 * 60 * 60_000)
    // Also run once on boot so a fresh deploy clears junk immediately.
    pruneStalePushTokens().catch((err) => console.error('Push token prune (boot) failed:', err))
  })
}

export default app
