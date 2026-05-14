// Agent control plane — start runs, stream live progress, fetch history.
// Three GS Method agents share the same routes shape; we factor them into a
// per-kind sub-router and mount each at /api/agents/<kind>/*.
//
// Routes (per kind):
//   POST   /api/agents/<kind>/start             { applicationId, context? }
//   GET    /api/agents/<kind>/stream/:jobId     (SSE)
//   GET    /api/agents/<kind>/status/:jobId
//   GET    /api/agents/<kind>/active/:appId
//   GET    /api/agents/<kind>/runs/:appId
//   POST   /api/agents/<kind>/cancel/:jobId

import { Router, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { query } from '../db'
import {
  createJob, getJob, getActiveJobForApp, attachSubscriber, detachSubscriber,
  cancelJob, emit, emitStatus,
  type Job, type AgentKind,
} from '../agents/lib/jobs'
import { runMandatoryCourses } from '../agents/mandatory-courses/runner'
import { runNyApplication } from '../agents/ny-application/runner'
import { runPvApplication } from '../agents/pv-application/runner'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'gritsync-jwt-secret-key-2024'

function authenticateTokenOrQuery(req: AuthenticatedRequest, res: Response, next: any) {
  const authHeader = req.headers['authorization']
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.t as string)
  if (!token) return res.status(401).json({ error: 'No token provided' })
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

async function resolveApplicationId(appIdOrGritId: string): Promise<string | null> {
  const res = await query(
    `SELECT id FROM applications WHERE id::text = $1 OR grit_app_id = $1 LIMIT 1`,
    [appIdOrGritId]
  )
  return res.rows[0]?.id || null
}

interface AgentBinding {
  kind: AgentKind
  startLabel: string
  runsTable: string  // mandatory_course_runs | ny_application_runs | pv_application_runs
  run: (job: Job) => Promise<void>
}

const BINDINGS: AgentBinding[] = [
  { kind: 'mandatory-courses', startLabel: 'Mandatory Courses Agent', runsTable: 'mandatory_course_runs', run: runMandatoryCourses },
  { kind: 'ny-application',    startLabel: 'NY Application Agent',    runsTable: 'ny_application_runs',   run: runNyApplication },
  { kind: 'pv-application',    startLabel: 'PV Application Agent',    runsTable: 'pv_application_runs',   run: runPvApplication },
]

function bindAgent(b: AgentBinding) {
  router.post(`/${b.kind}/start`, authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { applicationId, context } = req.body || {}
      if (!applicationId) return res.status(400).json({ error: 'applicationId required' })
      const canonicalId = await resolveApplicationId(applicationId)
      if (!canonicalId) return res.status(404).json({ error: 'Application not found' })

      const existing = getActiveJobForApp(b.kind, canonicalId)
      if (existing && (existing.status === 'pending' || existing.status === 'running')) {
        return res.json({ jobId: existing.id, status: existing.status, reused: true })
      }

      const job = createJob(b.kind, canonicalId, req.user!.id, context)
      emit(job, { level: 'info', message: `${b.startLabel} queued.` })
      b.run(job).catch((err) => {
        // Without this, the only feedback to the live log was "queued." and
        // then silence. Surface the rejection both to the job stream and the
        // server console so admins can see what blew up.
        const msg = err?.stack || err?.message || String(err)
        console.error(`${b.kind} runner unhandled:`, msg)
        try {
          emit(job, { level: 'error', message: `Runner crashed: ${err?.message || err}` })
          job.result = { ...(job.result || {}), error: err?.message || String(err) }
          emitStatus(job, 'failed')
        } catch { /* */ }
      })
      res.json({ jobId: job.id, status: job.status })
    } catch (err: any) {
      console.error(`${b.kind} start error:`, err)
      res.status(500).json({ error: err.message || 'Failed to start agent' })
    }
  })

  router.get(`/${b.kind}/stream/:jobId`, authenticateTokenOrQuery, async (req: AuthenticatedRequest, res: Response) => {
    const job = getJob(req.params.jobId)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
    if (job.kind !== b.kind) return res.status(404).json({ error: 'Job kind mismatch' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    attachSubscriber(job, res)
    const hb = setInterval(() => { try { res.write(':\n\n') } catch { /* */ } }, 15_000)
    req.on('close', () => { clearInterval(hb); detachSubscriber(job, res) })
  })

  router.get(`/${b.kind}/status/:jobId`, authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const job = getJob(req.params.jobId)
    if (!job || job.kind !== b.kind) return res.status(404).json({ error: 'Job not found' })
    res.json({
      id: job.id, applicationId: job.applicationId, status: job.status,
      startedAt: job.startedAt, endedAt: job.endedAt, events: job.events,
      result: job.result || null,
    })
  })

  router.get(`/${b.kind}/active/:appId`, authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const canonicalId = await resolveApplicationId(req.params.appId)
    if (!canonicalId) return res.json({ active: null })
    const job = getActiveJobForApp(b.kind, canonicalId)
    if (!job) return res.json({ active: null })
    res.json({
      active: {
        id: job.id, status: job.status, startedAt: job.startedAt,
        lastEvent: job.events[job.events.length - 1] || null,
      },
    })
  })

  router.get(`/${b.kind}/runs/:appId`, authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const canonicalId = await resolveApplicationId(req.params.appId)
    if (!canonicalId) return res.json({ runs: [] })
    const result = await query(
      `SELECT id, status, started_at, ended_at, result
         FROM ${b.runsTable}
        WHERE application_id = $1
        ORDER BY started_at DESC
        LIMIT 25`,
      [canonicalId]
    )
    res.json({ runs: result.rows })
  })

  router.post(`/${b.kind}/cancel/:jobId`, authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const ok = cancelJob(req.params.jobId)
    res.json({ cancelled: ok })
  })
}

BINDINGS.forEach(bindAgent)

export default router
