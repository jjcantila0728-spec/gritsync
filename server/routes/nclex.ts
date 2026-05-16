/**
 * NCLEX router — ported from Prisma controller to raw pg.
 *
 * Translation rules:
 *   - Prisma's cuid()-keyed string IDs become TEXT primary keys; we generate
 *     new IDs with crypto.randomUUID().
 *   - JSON columns (options, correctAnswer, result, metadata, tabs,
 *     specialAccess, questionPool) are JSONB; the pg driver auto-parses them
 *     to JS values on read. Writes use JSON.stringify when needed.
 *   - Date/time columns are TIMESTAMPTZ DEFAULT NOW() where Prisma had
 *     @default(now()) / @updatedAt.
 *   - findMany with relation includes are split into multiple queries and
 *     stitched in JS.
 *   - Admin routes inline-check req.user.role === 'admin' (gritsync convention).
 *   - AI handlers (Anthropic/Claude) live in ../lib/nclex-ai.ts and write
 *     into nclex_pending_questions / nclex_pending_case_studies. Requires
 *     ANTHROPIC_API_KEY to be set; model is claude-opus-4-7.
 *   - File upload for upgrade receipts is optional (multer memoryStorage); we
 *     accept multipart, but only store the original filename if a file was
 *     attached — there's no bucket wired up here yet.
 */

import { Router, Response } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import Stripe from 'stripe'
import { query, withTransaction } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { generateQuestions as aiGenerateQuestions, generateCaseStudy as aiGenerateCaseStudy } from '../lib/nclex-ai'

// Mirrors server/routes/payments.ts — return null on missing/placeholder keys
// so the caller can emit a clear 503 instead of forwarding Stripe's opaque 401.
const STRIPE_KEY_PLACEHOLDERS = new Set(['sk_test_replace_me', 'sk_live_replace_me'])
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (STRIPE_KEY_PLACEHOLDERS.has(key)) return null
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) return null
  return new Stripe(key, { apiVersion: '2023-10-16' as any })
}

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

// All NCLEX routes require auth.
router.use(authenticateToken)

// ───────────────────────────── helpers ────────────────────────────────────────

const ok = (res: Response, data: unknown, message = 'Success') =>
  res.status(200).json({ success: true, message, data })
const created = (res: Response, data: unknown, message = 'Created') =>
  res.status(201).json({ success: true, message, data })
const badRequest = (res: Response, message = 'Bad request') =>
  res.status(400).json({ success: false, message })
const forbidden = (res: Response, message = 'Forbidden') =>
  res.status(403).json({ success: false, message })
const notFound = (res: Response, message = 'Not found') =>
  res.status(404).json({ success: false, message })
const serverError = (res: Response, message = 'Internal server error') =>
  res.status(500).json({ success: false, message })
const notImplemented = (res: Response, message: string) =>
  res.status(501).json({ success: false, message })

function newId(): string {
  return crypto.randomUUID()
}

function isAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin'
}

function requireAdminInline(req: AuthenticatedRequest, res: Response): boolean {
  if (!isAdmin(req)) {
    forbidden(res, 'Admin access required')
    return false
  }
  return true
}

const VALID_FORMATS = new Set([
  'MCQ', 'SATA', 'ORDERED_RESPONSE', 'FILL_IN_BLANK', 'HIGHLIGHT_TEXT',
  'BOW_TIE', 'DROP_DOWN', 'MATRIX_MCQ', 'MATRIX_SATA', 'DRAG_DROP',
])
const VALID_BANKS = new Set(['CLASSIC', 'NGN'])
const VALID_EXAM_TYPES = new Set(['READINESS_ASSESSMENT', 'CAT', 'TUTORIAL', 'EXIT_EXAM'])

// ─────────────────────── DB row → API shape helpers ───────────────────────────

function camelQuestion(row: any) {
  if (!row) return row
  return {
    id: row.id,
    bank: row.bank,
    format: row.format,
    caseStudyId: row.case_study_id,
    itemNumber: row.item_number,
    stem: row.stem,
    options: row.options,
    correctAnswer: row.correct_answer,
    rationale: row.rationale,
    additionalInfo: row.additional_info,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: typeof row.difficulty === 'string' ? Number(row.difficulty) : row.difficulty,
    discrimination: typeof row.discrimination === 'string' ? Number(row.discrimination) : row.discrimination,
    isActive: row.is_active,
    rationaleImage: row.rationale_image,
    stemImage: row.stem_image,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    caseStudy: row.case_study_id_join_title !== undefined ? {
      id: row.case_study_id,
      title: row.case_study_id_join_title,
      scenario: row.case_study_id_join_scenario ?? undefined,
      tabs: row.case_study_id_join_tabs ?? undefined,
      caseType: row.case_study_id_join_case_type,
    } : undefined,
  }
}

function camelSession(row: any) {
  if (!row) return row
  return {
    id: row.id,
    userId: row.user_id,
    examType: row.exam_type,
    status: row.status,
    currentTheta: typeof row.current_theta === 'string' ? Number(row.current_theta) : row.current_theta,
    standardError: typeof row.standard_error === 'string' ? Number(row.standard_error) : row.standard_error,
    currentIndex: row.current_index,
    correctCount: row.correct_count,
    questionPool: row.question_pool,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    timeLimit: row.time_limit,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function camelSessionItem(row: any) {
  if (!row) return row
  return {
    id: row.id,
    sessionId: row.session_id,
    questionId: row.question_id,
    itemIndex: row.item_index,
    response: row.response,
    isCorrect: row.is_correct,
    timeSpent: row.time_spent,
    answeredAt: row.answered_at,
    createdAt: row.created_at,
  }
}

function camelCaseStudy(row: any) {
  if (!row) return row
  return {
    id: row.id,
    title: row.title,
    scenario: row.scenario,
    tabs: row.tabs,
    caseType: row.case_type,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function camelProfile(row: any) {
  if (!row) return row
  return {
    id: row.id,
    userId: row.user_id,
    examDate: row.exam_date,
    tier: row.tier,
    tierExpiresAt: row.tier_expires_at,
    paymentRef: row.payment_ref,
    grantedById: row.granted_by_id,
    specialAccess: row.special_access,
    upgradeRequested: row.upgrade_requested,
    upgradePaymentRef: row.upgrade_payment_ref,
    upgradePaymentMethod: row.upgrade_payment_method,
    upgradeReceiptPath: row.upgrade_receipt_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function camelExitAccess(row: any) {
  if (!row) return row
  return {
    id: row.id,
    userId: row.user_id,
    grantedAt: row.granted_at,
    paymentRef: row.payment_ref,
    grantedById: row.granted_by_id,
    createdAt: row.created_at,
  }
}

function camelTestimonial(row: any) {
  if (!row) return row
  return {
    id: row.id,
    clientName: row.client_name,
    designation: row.designation,
    location: row.location,
    content: row.content,
    rating: row.rating,
    isFeatured: row.is_featured,
    isActive: row.is_active,
    createdAt: row.created_at,
    isPending: row.is_pending,
    submittedByUserId: row.submitted_by_user_id,
  }
}

function camelPendingQuestion(row: any) {
  if (!row) return row
  return {
    id: row.id,
    bank: row.bank,
    format: row.format,
    stem: row.stem,
    stemImage: row.stem_image,
    options: row.options,
    correctAnswer: row.correct_answer,
    rationale: row.rationale,
    additionalInfo: row.additional_info,
    rationaleImage: row.rationale_image,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: typeof row.difficulty === 'string' ? Number(row.difficulty) : row.difficulty,
    discrimination: typeof row.discrimination === 'string' ? Number(row.discrimination) : row.discrimination,
    status: row.status,
    generatedBy: row.generated_by,
    generationBatch: row.generation_batch,
    rejectionNote: row.rejection_note,
    aiRaw: row.ai_raw,
    cognitiveSkill: row.cognitive_skill,
    itemNumber: row.item_number,
    pendingCaseStudyId: row.pending_case_study_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function camelPendingCaseStudy(row: any) {
  if (!row) return row
  return {
    id: row.id,
    title: row.title,
    scenario: row.scenario,
    tabs: row.tabs,
    caseType: row.case_type,
    status: row.status,
    generatedBy: row.generated_by,
    generationBatch: row.generation_batch,
    rejectionNote: row.rejection_note,
    aiRaw: row.ai_raw,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ──────────────────────── IRT (CAT) helper functions ──────────────────────────

function logistic(x: number): number { return 1 / (1 + Math.exp(-x)) }
function irtProbability(theta: number, a: number, b: number): number {
  return logistic(a * (theta - b))
}
function updateTheta(prev: number, responses: { difficulty: number; discrimination: number; correct: boolean }[]): number {
  if (responses.length === 0) return 0
  let theta = prev
  for (let iter = 0; iter < 20; iter++) {
    let grad = 0, hess = 0
    for (const r of responses) {
      const p = irtProbability(theta, r.discrimination, r.difficulty)
      const q = 1 - p
      grad += r.discrimination * ((r.correct ? 1 : 0) - p)
      hess -= r.discrimination * r.discrimination * p * q
    }
    if (Math.abs(hess) < 1e-10) break
    const step = Math.max(-1, Math.min(1, -grad / hess))
    theta += step
    if (Math.abs(step) < 0.001) break
  }
  return Math.max(-3.5, Math.min(3.5, theta))
}
function fisherInfo(theta: number, items: { difficulty: number; discrimination: number }[]): number {
  return items.reduce((sum, i) => {
    const p = irtProbability(theta, i.discrimination, i.difficulty)
    return sum + i.discrimination * i.discrimination * p * (1 - p)
  }, 0)
}
function calcSE(theta: number, items: { difficulty: number; discrimination: number }[]): number {
  const info = fisherInfo(theta, items)
  return info > 0 ? 1 / Math.sqrt(info) : 1.5
}

function checkAnswer(format: string, response: unknown, correct: unknown): boolean {
  try {
    switch (format) {
      case 'MCQ':
        return String(response) === String(correct)
      case 'SATA':
      case 'HIGHLIGHT_TEXT':
      case 'DRAG_DROP': {
        const r = [...(response as string[])].sort()
        const c = [...(correct as string[])].sort()
        return r.length === c.length && r.every((v, i) => v === c[i])
      }
      case 'ORDERED_RESPONSE': {
        const r = response as string[]
        const c = correct as string[]
        return r.length === c.length && r.every((v, i) => v === c[i])
      }
      case 'FILL_IN_BLANK': {
        const ans = correct as { value: number; tolerance?: number }
        return Math.abs(Number(response) - ans.value) <= (ans.tolerance ?? 0.1)
      }
      case 'BOW_TIE': {
        const r = response as { leftIds: string[]; rightIds: string[] }
        const c = correct as { leftIds: string[]; rightIds: string[] }
        const sortLeft = [...r.leftIds].sort()
        const sortRight = [...r.rightIds].sort()
        const cLeft = [...c.leftIds].sort()
        const cRight = [...c.rightIds].sort()
        return (
          sortLeft.length === cLeft.length &&
          sortLeft.every((v, i) => v === cLeft[i]) &&
          sortRight.length === cRight.length &&
          sortRight.every((v, i) => v === cRight[i])
        )
      }
      case 'DROP_DOWN':
      case 'MATRIX_MCQ': {
        const r = response as Record<string, string>
        const c = correct as Record<string, string>
        return Object.keys(c).every((k) => r[k] === c[k])
      }
      case 'MATRIX_SATA': {
        const r = response as Record<string, string[]>
        const c = correct as Record<string, string[]>
        return Object.keys(c).every((k) => {
          const rv = [...(r[k] ?? [])].sort()
          const cv = [...c[k]].sort()
          return rv.length === cv.length && rv.every((v, i) => v === cv[i])
        })
      }
      default:
        return false
    }
  } catch {
    return false
  }
}

type ReadinessLevel = 'Low' | 'Near Passing' | 'Approaching' | 'High' | 'Very High'
function calcReadiness(correctCount: number, totalItems: number, lastFour: boolean[]): ReadinessLevel {
  const pct = totalItems > 0 ? (correctCount / totalItems) * 100 : 0
  if (lastFour.length >= 4 && lastFour.slice(-4).every(Boolean) && pct >= 70) return 'Very High'
  if (pct >= 80) return 'High'
  if (pct >= 65) return 'Approaching'
  if (pct >= 50) return 'Near Passing'
  return 'Low'
}

async function selectCATQuestion(theta: number, usedIds: string[], bank?: string): Promise<string | null> {
  const params: any[] = []
  let sql = `SELECT id, difficulty FROM nclex_questions WHERE is_active = TRUE`
  if (usedIds.length) {
    params.push(usedIds)
    sql += ` AND id <> ALL($${params.length}::text[])`
  }
  if (bank) {
    params.push(bank)
    sql += ` AND bank = $${params.length}`
  }
  const { rows } = await query(sql, params)
  if (rows.length === 0) return null
  rows.sort((a: any, b: any) => Math.abs(Number(a.difficulty) - theta) - Math.abs(Number(b.difficulty) - theta))
  return rows[0].id
}

async function selectQuestionPool(count: number, bank?: string, topics?: string[], formats?: string[]): Promise<string[]> {
  const params: any[] = []
  let sql = `SELECT id FROM nclex_questions WHERE is_active = TRUE`
  if (bank) {
    params.push(bank)
    sql += ` AND bank = $${params.length}`
  }
  if (topics?.length) {
    params.push(topics)
    sql += ` AND topic = ANY($${params.length}::text[])`
  }
  if (formats?.length) {
    params.push(formats)
    sql += ` AND format = ANY($${params.length}::text[])`
  }
  const { rows } = await query(sql, params)
  // Fisher-Yates shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return rows.slice(0, count).map((q: any) => q.id)
}

async function fetchQuestionWithCaseStudy(id: string): Promise<any> {
  const { rows } = await query(
    `SELECT q.*, cs.id AS cs_id, cs.title AS cs_title, cs.scenario AS cs_scenario,
            cs.tabs AS cs_tabs, cs.case_type AS cs_case_type
       FROM nclex_questions q
       LEFT JOIN nclex_case_studies cs ON cs.id = q.case_study_id
      WHERE q.id = $1 LIMIT 1`,
    [id]
  )
  const r = rows[0]
  if (!r) return null
  const q = camelQuestion(r)
  q.caseStudy = r.cs_id ? { id: r.cs_id, title: r.cs_title, scenario: r.cs_scenario, tabs: r.cs_tabs, caseType: r.cs_case_type } : null
  return q
}

async function touchUpdatedAt(table: string, id: string, client?: any) {
  const sql = `UPDATE ${table} SET updated_at = NOW() WHERE id = $1`
  if (client) await client(sql, [id])
  else await query(sql, [id])
}

// ─────────────────────────────────────────────────────────────────────────────
// USER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/home', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id

    const sessionsRes = await query(
      `SELECT id, exam_type, status, result, started_at, completed_at, correct_count, current_index
         FROM nclex_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    )
    const sessions = sessionsRes.rows.map((r: any) => ({
      id: r.id,
      examType: r.exam_type,
      status: r.status,
      result: r.result,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      correctCount: r.correct_count,
      currentIndex: r.current_index,
    }))

    const exitAccessRes = await query(`SELECT * FROM nclex_exit_access WHERE user_id = $1 LIMIT 1`, [userId])
    const exitAccess = camelExitAccess(exitAccessRes.rows[0])

    const qByBankRes = await query(
      `SELECT bank, COUNT(*)::int AS count FROM nclex_questions WHERE is_active = TRUE GROUP BY bank`,
      []
    )
    const qByBank = qByBankRes.rows.map((r: any) => ({ bank: r.bank, _count: r.count }))

    const qByTopicRes = await query(
      `SELECT topic, COUNT(*)::int AS count FROM nclex_questions
         WHERE is_active = TRUE GROUP BY topic ORDER BY count DESC`,
      []
    )
    const qByTopic = qByTopicRes.rows.map((r: any) => ({ topic: r.topic, _count: r.count }))

    const qByFormatRes = await query(
      `SELECT format, COUNT(*)::int AS count FROM nclex_questions
         WHERE is_active = TRUE GROUP BY format ORDER BY count DESC`,
      []
    )
    const qByFormat = qByFormatRes.rows.map((r: any) => ({ format: r.format, _count: r.count }))

    const profileRes = await query(`SELECT * FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    const profile = camelProfile(profileRes.rows[0])

    // Questions today
    const todayCountRes = await query(
      `SELECT COUNT(*)::int AS c FROM nclex_session_items si
         JOIN nclex_sessions s ON s.id = si.session_id
        WHERE s.user_id = $1 AND si.answered_at >= date_trunc('day', NOW())`,
      [userId]
    )
    const questionsToday = todayCountRes.rows[0]?.c ?? 0

    // Unique questions answered, grouped by bank
    const usedByBankRes = await query(
      `SELECT q.bank, COUNT(DISTINCT q.id)::int AS c
         FROM nclex_session_items si
         JOIN nclex_sessions s ON s.id = si.session_id
         JOIN nclex_questions q ON q.id = si.question_id
        WHERE s.user_id = $1 AND si.answered_at IS NOT NULL
        GROUP BY q.bank`,
      [userId]
    )
    const usedByBank: Record<string, number> = {}
    for (const r of usedByBankRes.rows) usedByBank[r.bank] = r.c

    // Unique questions answered, grouped by topic
    const usedByTopicRes = await query(
      `SELECT COALESCE(q.topic, 'General') AS topic, COUNT(DISTINCT q.id)::int AS c
         FROM nclex_session_items si
         JOIN nclex_sessions s ON s.id = si.session_id
         JOIN nclex_questions q ON q.id = si.question_id
        WHERE s.user_id = $1 AND si.answered_at IS NOT NULL
        GROUP BY COALESCE(q.topic, 'General')`,
      [userId]
    )
    const usedByTopic: Record<string, number> = {}
    for (const r of usedByTopicRes.rows) usedByTopic[r.topic] = r.c

    // Peer averages
    const raResults = await query(
      `SELECT result FROM nclex_sessions
        WHERE exam_type = 'READINESS_ASSESSMENT' AND status = 'COMPLETED' LIMIT 2000`,
      []
    )
    const catResults = await query(
      `SELECT result FROM nclex_sessions
        WHERE exam_type = 'CAT' AND status = 'COMPLETED' LIMIT 2000`,
      []
    )
    const raScores = raResults.rows
      .map((s: any) => (s.result || {})?.percentCorrect)
      .filter((v: any) => typeof v === 'number' && !isNaN(v))
    const catScores = catResults.rows
      .map((s: any) => (s.result || {})?.percentCorrect)
      .filter((v: any) => typeof v === 'number' && !isNaN(v))

    const peerAvgRA = raScores.length > 0 ? raScores.reduce((a: number, b: number) => a + b, 0) / raScores.length : null
    const peerAvgCAT = catScores.length > 0 ? catScores.reduce((a: number, b: number) => a + b, 0) / catScores.length : null

    const completed = sessions.filter((s) => s.status === 'COMPLETED')
    ok(res, {
      sessions,
      exitAccess,
      profile,
      questionsToday,
      peerStats: {
        avgRA: peerAvgRA !== null ? Math.round(peerAvgRA * 10) / 10 : null,
        countRA: raScores.length,
        avgCAT: peerAvgCAT !== null ? Math.round(peerAvgCAT * 10) / 10 : null,
        countCAT: catScores.length,
      },
      stats: {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        questionBanks: qByBank,
        usedByBank,
        usedByTopic,
        byTopic: qByTopic.map((r) => ({ topic: r.topic ?? 'General', count: r._count })),
        byFormat: qByFormat.map((r) => ({ format: r.format, count: r._count })),
      },
    })
  } catch (err) {
    console.error('[nclex/home]', err)
    serverError(res)
  }
})

router.post('/sessions', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { examType, bank, questionCount, topics, formats } = req.body as {
      examType: string; bank?: string;
      questionCount?: number; topics?: string[]; formats?: string[];
    }
    if (!examType) { badRequest(res, 'examType is required'); return }
    if (!VALID_EXAM_TYPES.has(examType)) { badRequest(res, 'Invalid examType'); return }

    if (examType === 'EXIT_EXAM') {
      const a = await query(`SELECT 1 FROM nclex_exit_access WHERE user_id = $1 LIMIT 1`, [userId])
      if (!a.rowCount) { forbidden(res, 'Exit Exam requires purchase. Please contact admin.'); return }
    }

    const profileRes = await query(`SELECT tier FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    const tier = profileRes.rows[0]?.tier ?? 'FREE'
    if (tier === 'FREE') {
      // FREE users may only run the Tutorial. CAT, the readiness
      // assessment, and the exit exam are paywalled.
      if (examType !== 'TUTORIAL') {
        forbidden(
          res,
          'Free plan can only access Tutorial mode. Upgrade to Premium to unlock CAT, Readiness Assessment, and Exit Exam.',
        )
        return
      }
      // Daily question quota for the tutorial — keeps the free tier capped
      // at 25 items per day so heavy users have a reason to upgrade.
      const todayRes = await query(
        `SELECT COUNT(*)::int AS c FROM nclex_session_items si
           JOIN nclex_sessions s ON s.id = si.session_id
          WHERE s.user_id = $1 AND si.answered_at >= date_trunc('day', NOW())`,
        [userId]
      )
      const todayCount = todayRes.rows[0]?.c ?? 0
      if (todayCount >= 25) {
        forbidden(res, 'Daily limit reached (25 questions). Upgrade to Premium for unlimited access.')
        return
      }
    }

    // Abandon any existing IN_PROGRESS session for this examType
    await query(
      `UPDATE nclex_sessions SET status = 'ABANDONED', updated_at = NOW()
        WHERE user_id = $1 AND exam_type = $2 AND status = 'IN_PROGRESS'`,
      [userId, examType]
    )

    let questionPool: string[] | null = null
    let timeLimit: number | null = null

    if (examType === 'READINESS_ASSESSMENT') {
      questionPool = await selectQuestionPool(85, bank)
    } else if (examType === 'EXIT_EXAM') {
      questionPool = await selectQuestionPool(150, bank)
      timeLimit = 350
    } else if (examType === 'TUTORIAL') {
      if (questionCount || topics?.length || formats?.length) {
        const count = Math.min(Math.max(questionCount ?? 10, 1), 200)
        questionPool = await selectQuestionPool(count, bank, topics, formats)
      } else {
        // Default tutorial: one of each format type, up to 8
        const distinct = await query(
          `SELECT DISTINCT ON (format) id FROM nclex_questions
            WHERE is_active = TRUE ORDER BY format, id LIMIT 8`,
          []
        )
        questionPool = distinct.rows.map((r: any) => r.id)
      }
    }

    if (examType !== 'CAT' && questionPool !== null && questionPool.length === 0) {
      badRequest(res, 'Not enough questions in the bank to start this exam. Please contact admin.')
      return
    }

    const sessionId = newId()
    const insertSession = await query(
      `INSERT INTO nclex_sessions (id, user_id, exam_type, time_limit, question_pool)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
      [
        sessionId,
        userId,
        examType,
        timeLimit,
        questionPool === null ? null : JSON.stringify(questionPool),
      ]
    )
    const session = camelSession(insertSession.rows[0])

    const firstQId = examType === 'CAT'
      ? await selectCATQuestion(0, [], bank)
      : (questionPool ?? [])[0] ?? null

    if (!firstQId) {
      badRequest(res, 'No questions available. Please contact admin.')
      return
    }

    if (examType === 'CAT') {
      await query(
        `INSERT INTO nclex_session_items (id, session_id, question_id, item_index)
           VALUES ($1, $2, $3, $4)`,
        [newId(), sessionId, firstQId, 0]
      )
    }

    const firstQuestion = await fetchQuestionWithCaseStudy(firstQId)
    created(res, { session, currentQuestion: firstQuestion, currentIndex: 0 }, 'Session started')
  } catch (err: any) {
    // Surface the real reason — the previous generic "Internal server error"
    // made test-creation failures undebuggable from the client. Postgres
    // error codes and message live in err.code / err.message.
    const detail = err?.message || String(err)
    console.error('[nclex/sessions POST]', err)
    res.status(500).json({
      success: false,
      message: `Failed to create session: ${detail}`,
      code: err?.code,
    })
  }
})

router.get('/sessions/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const sessRes = await query(
      `SELECT * FROM nclex_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, userId]
    )
    if (!sessRes.rowCount) { notFound(res, 'Session not found'); return }
    const session = camelSession(sessRes.rows[0])

    // items with questions+caseStudy
    const itemsRes = await query(
      `SELECT si.*, q.id AS q_id, q.bank AS q_bank, q.format AS q_format,
              q.case_study_id AS q_case_study_id, q.item_number AS q_item_number,
              q.stem AS q_stem, q.options AS q_options, q.correct_answer AS q_correct_answer,
              q.rationale AS q_rationale, q.additional_info AS q_additional_info,
              q.topic AS q_topic, q.subtopic AS q_subtopic,
              q.difficulty AS q_difficulty, q.discrimination AS q_discrimination,
              q.is_active AS q_is_active, q.rationale_image AS q_rationale_image,
              q.stem_image AS q_stem_image, q.metadata AS q_metadata,
              q.created_at AS q_created_at, q.updated_at AS q_updated_at,
              cs.id AS cs_id, cs.title AS cs_title, cs.scenario AS cs_scenario,
              cs.tabs AS cs_tabs, cs.case_type AS cs_case_type
         FROM nclex_session_items si
         JOIN nclex_questions q ON q.id = si.question_id
         LEFT JOIN nclex_case_studies cs ON cs.id = q.case_study_id
        WHERE si.session_id = $1
        ORDER BY si.item_index ASC`,
      [session.id]
    )
    const items = itemsRes.rows.map((r: any) => {
      const item: any = camelSessionItem(r)
      item.question = {
        id: r.q_id, bank: r.q_bank, format: r.q_format,
        caseStudyId: r.q_case_study_id, itemNumber: r.q_item_number,
        stem: r.q_stem, options: r.q_options, correctAnswer: r.q_correct_answer,
        rationale: r.q_rationale, additionalInfo: r.q_additional_info,
        topic: r.q_topic, subtopic: r.q_subtopic,
        difficulty: Number(r.q_difficulty), discrimination: Number(r.q_discrimination),
        isActive: r.q_is_active, rationaleImage: r.q_rationale_image,
        stemImage: r.q_stem_image, metadata: r.q_metadata,
        createdAt: r.q_created_at, updatedAt: r.q_updated_at,
        caseStudy: r.cs_id ? {
          id: r.cs_id, title: r.cs_title, scenario: r.cs_scenario,
          tabs: r.cs_tabs, caseType: r.cs_case_type,
        } : null,
      }
      return item
    })
    ;(session as any).items = items

    if (session.status !== 'IN_PROGRESS') {
      ok(res, { session, currentQuestion: null })
      return
    }

    const pool: string[] | null = session.questionPool ?? null
    let currentQuestion: any = null
    if (session.examType === 'CAT') {
      const unanswered = items.find((i: any) => i.response === null)
      if (unanswered) currentQuestion = unanswered.question
    } else if (pool) {
      const qId = pool[session.currentIndex]
      if (qId) currentQuestion = await fetchQuestionWithCaseStudy(qId)
    }
    ok(res, { session, currentQuestion, currentIndex: session.currentIndex })
  } catch (err) {
    console.error('[nclex/sessions/:id GET]', err)
    serverError(res)
  }
})

router.post('/sessions/:id/answer', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { questionId, response, timeSpent } = req.body as {
      questionId: string; response: unknown; timeSpent?: number;
    }

    const sessRes = await query(
      `SELECT * FROM nclex_sessions
        WHERE id = $1 AND user_id = $2 AND status = 'IN_PROGRESS' LIMIT 1`,
      [req.params.id, userId]
    )
    if (!sessRes.rowCount) { notFound(res, 'Session not found or not in progress'); return }
    const session = camelSession(sessRes.rows[0])

    const qRes = await query(`SELECT * FROM nclex_questions WHERE id = $1 LIMIT 1`, [questionId])
    if (!qRes.rowCount) { notFound(res, 'Question not found'); return }
    const question = camelQuestion(qRes.rows[0])

    const isCorrect = checkAnswer(question.format, response, question.correctAnswer)

    // Peer stats
    const peerRes = await query(
      `SELECT response, is_correct FROM nclex_session_items
        WHERE question_id = $1 AND answered_at IS NOT NULL`,
      [questionId]
    )
    const peerAnswered = peerRes.rows.filter((i: any) => i.is_correct !== null)
    const peerCorrectPct = peerAnswered.length > 0
      ? Math.round((peerAnswered.filter((i: any) => i.is_correct).length / peerAnswered.length) * 100)
      : null
    const optionStats: Record<string, number> = {}
    if (question.format === 'MCQ' && peerAnswered.length > 0) {
      for (const item of peerAnswered) {
        const key = String(item.response ?? '')
        if (key) optionStats[key] = (optionStats[key] ?? 0) + 1
      }
      for (const k of Object.keys(optionStats)) {
        optionStats[k] = Math.round((optionStats[k] / peerAnswered.length) * 100)
      }
    }

    const pool: string[] | null = session.questionPool ?? null
    const newIndex = session.currentIndex + 1
    const newCorrect = session.correctCount + (isCorrect ? 1 : 0)

    // record the answer
    if (session.examType === 'CAT') {
      await query(
        `UPDATE nclex_session_items
            SET response = $1::jsonb, is_correct = $2, time_spent = $3, answered_at = NOW()
          WHERE session_id = $4 AND question_id = $5`,
        [JSON.stringify(response ?? null), isCorrect, timeSpent ?? null, session.id, questionId]
      )
    } else {
      await query(
        `INSERT INTO nclex_session_items
            (id, session_id, question_id, item_index, response, is_correct, time_spent, answered_at)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())`,
        [newId(), session.id, questionId, session.currentIndex,
         JSON.stringify(response ?? null), isCorrect, timeSpent ?? null]
      )
    }

    const totalItems = pool ? pool.length : 150
    const minItems = session.examType === 'TUTORIAL' ? 1 : 85
    let shouldStop = false
    let newTheta = session.currentTheta
    let newSE = session.standardError
    let result: Record<string, unknown> | null = null

    if (session.examType === 'CAT') {
      const ansRes = await query(
        `SELECT si.is_correct, q.difficulty, q.discrimination
           FROM nclex_session_items si
           JOIN nclex_questions q ON q.id = si.question_id
          WHERE si.session_id = $1 AND si.is_correct IS NOT NULL`,
        [session.id]
      )
      const irtData = ansRes.rows.map((r: any) => ({
        difficulty: Number(r.difficulty),
        discrimination: Number(r.discrimination),
        correct: r.is_correct ?? false,
      }))
      newTheta = updateTheta(newTheta, irtData)
      newSE = calcSE(newTheta, irtData.map((i: any) => ({ difficulty: i.difficulty, discrimination: i.discrimination })))
      const itemCount = irtData.length
      if (itemCount >= minItems && (newSE < 0.4 || itemCount >= 150)) {
        shouldStop = true
        result = {
          examType: 'CAT',
          totalItems: itemCount,
          finalTheta: newTheta,
          standardError: newSE,
          passed: newTheta >= 0.0,
          stopReason: newSE < 0.4 ? 'SE_THRESHOLD' : 'MAX_ITEMS',
        }
      }
    } else {
      const itemCount = newIndex
      if (itemCount >= totalItems || (session.examType === 'TUTORIAL' && itemCount >= (pool?.length ?? 3))) {
        shouldStop = true
        const pct = totalItems > 0 ? (newCorrect / itemCount) * 100 : 0
        if (session.examType === 'READINESS_ASSESSMENT') {
          const allItems = await query(
            `SELECT is_correct FROM nclex_session_items
              WHERE session_id = $1 AND is_correct IS NOT NULL
              ORDER BY item_index ASC`,
            [session.id]
          )
          const allCorrect = [...allItems.rows.map((i: any) => i.is_correct ?? false), isCorrect]
          const readiness = calcReadiness(newCorrect, itemCount, allCorrect)
          result = {
            examType: 'READINESS_ASSESSMENT',
            totalItems: itemCount,
            correctCount: newCorrect,
            percentCorrect: pct,
            readiness,
            passed: ['High', 'Very High'].includes(readiness),
          }
        } else if (session.examType === 'EXIT_EXAM') {
          result = {
            examType: 'EXIT_EXAM',
            totalItems: itemCount,
            correctCount: newCorrect,
            percentCorrect: pct,
            passed: pct >= 68,
          }
        } else {
          result = { examType: 'TUTORIAL', totalItems: itemCount, message: 'Tutorial complete' }
        }
      }
    }

    if (shouldStop) {
      // Category breakdown by topic
      const breakRes = await query(
        `SELECT COALESCE(q.topic, 'General') AS topic, si.is_correct
           FROM nclex_session_items si
           JOIN nclex_questions q ON q.id = si.question_id
          WHERE si.session_id = $1 AND si.is_correct IS NOT NULL`,
        [session.id]
      )
      const breakdown: Record<string, { correct: number; total: number }> = {}
      for (const r of breakRes.rows) {
        if (!breakdown[r.topic]) breakdown[r.topic] = { correct: 0, total: 0 }
        breakdown[r.topic].total++
        if (r.is_correct) breakdown[r.topic].correct++
      }
      if (result) {
        (result as any).categoryBreakdown = Object.entries(breakdown).map(([topic, data]) => ({
          topic,
          correct: data.correct,
          total: data.total,
          percent: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        }))
      }

      await query(
        `UPDATE nclex_sessions SET status = 'COMPLETED', completed_at = NOW(),
            current_index = $1, correct_count = $2, current_theta = $3,
            standard_error = $4, result = $5::jsonb, updated_at = NOW()
          WHERE id = $6`,
        [newIndex, newCorrect, newTheta, newSE, JSON.stringify(result), session.id]
      )

      ok(res, {
        completed: true,
        result,
        isCorrect,
        correctAnswer: question.correctAnswer,
        rationale: question.rationale,
        additionalInfo: question.additionalInfo ?? null,
        metadata: question.metadata ?? null,
        peerCorrectPct,
        optionStats,
      })
      return
    }

    // Next question
    const updRes = await query(
      `UPDATE nclex_sessions SET current_index = $1, correct_count = $2,
          current_theta = $3, standard_error = $4, updated_at = NOW()
        WHERE id = $5 RETURNING *`,
      [newIndex, newCorrect, newTheta, newSE, session.id]
    )
    const updatedSession = camelSession(updRes.rows[0])

    let nextQuestion: any = null
    if (session.examType === 'CAT') {
      const usedIdsRes = await query(
        `SELECT question_id FROM nclex_session_items WHERE session_id = $1`,
        [session.id]
      )
      const usedIds = usedIdsRes.rows.map((r: any) => r.question_id)
      const nextQId = await selectCATQuestion(newTheta, usedIds, undefined)
      if (nextQId) {
        await query(
          `INSERT INTO nclex_session_items (id, session_id, question_id, item_index)
             VALUES ($1, $2, $3, $4)`,
          [newId(), session.id, nextQId, newIndex]
        )
        nextQuestion = await fetchQuestionWithCaseStudy(nextQId)
      }
    } else if (pool) {
      const nextQId = pool[newIndex]
      if (nextQId) nextQuestion = await fetchQuestionWithCaseStudy(nextQId)
    }

    ok(res, {
      completed: false,
      isCorrect,
      correctAnswer: question.correctAnswer,
      rationale: question.rationale,
      additionalInfo: question.additionalInfo ?? null,
      metadata: question.metadata ?? null,
      peerCorrectPct,
      optionStats,
      nextQuestion,
      currentIndex: updatedSession.currentIndex,
      currentTheta: newTheta,
      standardError: newSE,
    })
  } catch (err) {
    console.error('[nclex/sessions/:id/answer]', err)
    serverError(res)
  }
})

router.post('/sessions/:id/abandon', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const sessRes = await query(
      `SELECT id FROM nclex_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, userId]
    )
    if (!sessRes.rowCount) { notFound(res, 'Session not found'); return }
    await query(
      `UPDATE nclex_sessions SET status = 'ABANDONED', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    )
    ok(res, null, 'Session abandoned')
  } catch {
    serverError(res)
  }
})

router.get('/sessions/:id/review', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const sessRes = await query(
      `SELECT * FROM nclex_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, userId]
    )
    if (!sessRes.rowCount) { notFound(res, 'Session not found'); return }
    const session = camelSession(sessRes.rows[0])

    const itemsRes = await query(
      `SELECT si.*, q.id AS q_id, q.bank AS q_bank, q.format AS q_format,
              q.case_study_id AS q_case_study_id, q.item_number AS q_item_number,
              q.stem AS q_stem, q.options AS q_options, q.correct_answer AS q_correct_answer,
              q.rationale AS q_rationale, q.additional_info AS q_additional_info,
              q.topic AS q_topic, q.subtopic AS q_subtopic,
              q.difficulty AS q_difficulty, q.discrimination AS q_discrimination,
              q.is_active AS q_is_active, q.rationale_image AS q_rationale_image,
              q.stem_image AS q_stem_image, q.metadata AS q_metadata,
              q.created_at AS q_created_at, q.updated_at AS q_updated_at,
              cs.id AS cs_id, cs.title AS cs_title, cs.scenario AS cs_scenario,
              cs.tabs AS cs_tabs, cs.case_type AS cs_case_type
         FROM nclex_session_items si
         JOIN nclex_questions q ON q.id = si.question_id
         LEFT JOIN nclex_case_studies cs ON cs.id = q.case_study_id
        WHERE si.session_id = $1
        ORDER BY si.item_index ASC`,
      [session.id]
    )
    const items = itemsRes.rows.map((r: any) => {
      const item: any = camelSessionItem(r)
      item.question = {
        id: r.q_id, bank: r.q_bank, format: r.q_format,
        caseStudyId: r.q_case_study_id, itemNumber: r.q_item_number,
        stem: r.q_stem, options: r.q_options, correctAnswer: r.q_correct_answer,
        rationale: r.q_rationale, additionalInfo: r.q_additional_info,
        topic: r.q_topic, subtopic: r.q_subtopic,
        difficulty: Number(r.q_difficulty), discrimination: Number(r.q_discrimination),
        isActive: r.q_is_active, rationaleImage: r.q_rationale_image,
        stemImage: r.q_stem_image, metadata: r.q_metadata,
        createdAt: r.q_created_at, updatedAt: r.q_updated_at,
        caseStudy: r.cs_id ? {
          id: r.cs_id, title: r.cs_title, scenario: r.cs_scenario,
          tabs: r.cs_tabs, caseType: r.cs_case_type,
        } : null,
      }
      return item
    })
    ok(res, { ...session, items })
  } catch {
    serverError(res)
  }
})

router.get('/exit-access', async (req: AuthenticatedRequest, res) => {
  try {
    const r = await query(`SELECT * FROM nclex_exit_access WHERE user_id = $1 LIMIT 1`, [req.user!.id])
    const access = camelExitAccess(r.rows[0])
    ok(res, { hasAccess: !!access, access })
  } catch {
    serverError(res)
  }
})

// ─────────────────────── PROFILE / SUBSCRIPTIONS ──────────────────────────────

async function upsertProfile(userId: string): Promise<any> {
  const existing = await query(`SELECT * FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
  if (existing.rowCount) return camelProfile(existing.rows[0])
  const ins = await query(
    `INSERT INTO nclex_profiles (id, user_id) VALUES ($1, $2) RETURNING *`,
    [newId(), userId]
  )
  return camelProfile(ins.rows[0])
}

router.get('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await upsertProfile(req.user!.id)
    ok(res, profile)
  } catch {
    serverError(res)
  }
})

router.put('/profile/exam-date', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { examDate } = req.body
    const existing = await query(`SELECT id FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    let row
    if (existing.rowCount) {
      const upd = await query(
        `UPDATE nclex_profiles SET exam_date = $1, updated_at = NOW()
          WHERE user_id = $2 RETURNING *`,
        [examDate ? new Date(examDate) : null, userId]
      )
      row = upd.rows[0]
    } else {
      const ins = await query(
        `INSERT INTO nclex_profiles (id, user_id, exam_date) VALUES ($1, $2, $3) RETURNING *`,
        [newId(), userId, examDate ? new Date(examDate) : null]
      )
      row = ins.rows[0]
    }
    ok(res, camelProfile(row), 'Exam date updated')
  } catch {
    serverError(res)
  }
})

router.post('/profile/upgrade-request', upload.single('receipt'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { paymentRef, paymentMethod, targetPlanId } = req.body
    if (!paymentRef) { badRequest(res, 'Payment reference is required'); return }
    // NOTE: file upload is accepted via multer memoryStorage but not persisted
    // to any bucket here. To wire up storage, mirror server/routes/storage.ts.
    const receiptPath = (req as any).file?.originalname ?? null
    const methodEncoded = targetPlanId ? `${paymentMethod ?? 'gcash'}:${targetPlanId}` : (paymentMethod ?? null)

    const existing = await query(`SELECT id FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    let row
    if (existing.rowCount) {
      const upd = await query(
        `UPDATE nclex_profiles
            SET upgrade_requested = TRUE,
                upgrade_payment_ref = $1,
                upgrade_payment_method = $2,
                upgrade_receipt_path = $3,
                updated_at = NOW()
          WHERE user_id = $4 RETURNING *`,
        [paymentRef, methodEncoded, receiptPath, userId]
      )
      row = upd.rows[0]
    } else {
      const ins = await query(
        `INSERT INTO nclex_profiles
            (id, user_id, upgrade_requested, upgrade_payment_ref, upgrade_payment_method, upgrade_receipt_path)
          VALUES ($1, $2, TRUE, $3, $4, $5) RETURNING *`,
        [newId(), userId, paymentRef, methodEncoded, receiptPath]
      )
      row = ins.rows[0]
    }
    ok(res, camelProfile(row), 'Upgrade request submitted. Admin will review your payment.')
  } catch (err) {
    console.error('[nclex/profile/upgrade-request]', err)
    serverError(res)
  }
})

router.post('/testimonials', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const userRes = await query(`SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1`, [userId])
    if (!userRes.rowCount) { notFound(res, 'User not found'); return }
    const u = userRes.rows[0]

    const { content, rating, designation, location } = req.body
    if (!content) { badRequest(res, 'Testimonial content is required'); return }

    const id = newId()
    const ins = await query(
      `INSERT INTO nclex_testimonials
          (id, client_name, content, rating, designation, location, is_pending, is_active, submitted_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, $7) RETURNING *`,
      [id, `${u.first_name} ${u.last_name}`, content, rating ? Number(rating) : 5,
       designation || null, location || null, userId]
    )
    created(res, camelTestimonial(ins.rows[0]), 'Testimonial submitted for review.')
  } catch {
    serverError(res)
  }
})

router.get('/testimonials/approved', async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT * FROM nclex_testimonials
        WHERE is_active = TRUE AND is_pending = FALSE
        ORDER BY is_featured DESC, created_at DESC LIMIT 50`,
      []
    )
    // Edge-cache for 60 s; serve stale up to 5 min while revalidating. Every
    // reviewer / landing visitor hits the same payload — Vercel's CDN avoids
    // touching Postgres at all for the common case.
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    ok(res, r.rows.map(camelTestimonial))
  } catch {
    serverError(res)
  }
})

// ─── Live Sessions (Zoom-powered) ─────────────────────────────────────────────
// Admin creates rows from /admin/nclex → Live Sessions. Clients on
// review.gritsync.com see upcoming sessions (with a Join button) and past
// sessions (with the recording link if uploaded). No Zoom API call here — the
// admin pastes the join URL they generated in Zoom.
function camelLiveSession(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    scheduledAt: row.scheduled_at,
    durationMin: row.duration_min,
    zoomJoinUrl: row.zoom_join_url,
    zoomMeetingId: row.zoom_meeting_id,
    zoomPasscode: row.zoom_passcode,
    recordingUrl: row.recording_url,
    instructor: row.instructor,
    topic: row.topic,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

router.get('/live-sessions', async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT * FROM nclex_live_sessions
        WHERE is_active = TRUE
        ORDER BY scheduled_at DESC`,
      []
    )
    // Edge-cache 30 s, stale up to 5 min. Live Lectures changes infrequently
    // and dozens of learners hit this list per minute when sessions go live.
    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300')
    ok(res, r.rows.map(camelLiveSession))
  } catch (err) {
    console.error('[nclex/live-sessions]', err)
    serverError(res)
  }
})

router.post('/admin/live-sessions', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const {
      title, description, scheduledAt, durationMin, zoomJoinUrl, zoomMeetingId,
      zoomPasscode, recordingUrl, instructor, topic, status,
    } = req.body || {}
    if (!title || !scheduledAt) {
      badRequest(res, 'title and scheduledAt are required')
      return
    }
    const id = newId()
    const ins = await query(
      `INSERT INTO nclex_live_sessions
         (id, title, description, scheduled_at, duration_min, zoom_join_url,
          zoom_meeting_id, zoom_passcode, recording_url, instructor, topic,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        id, title, description ?? null, scheduledAt, Number(durationMin) || 60,
        zoomJoinUrl ?? null, zoomMeetingId ?? null, zoomPasscode ?? null,
        recordingUrl ?? null, instructor ?? null, topic ?? null,
        status ?? 'scheduled', req.user!.id,
      ]
    )
    created(res, camelLiveSession(ins.rows[0]), 'Live session created')
  } catch (err) {
    console.error('[nclex/admin/live-sessions POST]', err)
    serverError(res)
  }
})

router.put('/admin/live-sessions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { id } = req.params
    const fields = [
      ['title', 'title'], ['description', 'description'],
      ['scheduledAt', 'scheduled_at'], ['durationMin', 'duration_min'],
      ['zoomJoinUrl', 'zoom_join_url'], ['zoomMeetingId', 'zoom_meeting_id'],
      ['zoomPasscode', 'zoom_passcode'], ['recordingUrl', 'recording_url'],
      ['instructor', 'instructor'], ['topic', 'topic'],
      ['status', 'status'], ['isActive', 'is_active'],
    ] as const
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    for (const [src, col] of fields) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, src)) {
        sets.push(`${col} = $${i++}`)
        vals.push(req.body[src])
      }
    }
    if (!sets.length) { badRequest(res, 'No fields to update'); return }
    sets.push(`updated_at = NOW()`)
    vals.push(id)
    const upd = await query(
      `UPDATE nclex_live_sessions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    )
    if (!upd.rowCount) { notFound(res, 'Session not found'); return }
    ok(res, camelLiveSession(upd.rows[0]), 'Session updated')
  } catch (err) {
    console.error('[nclex/admin/live-sessions PUT]', err)
    serverError(res)
  }
})

router.delete('/admin/live-sessions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const del = await query(`DELETE FROM nclex_live_sessions WHERE id = $1`, [req.params.id])
    if (!del.rowCount) { notFound(res, 'Session not found'); return }
    ok(res, null, 'Session deleted')
  } catch (err) {
    console.error('[nclex/admin/live-sessions DELETE]', err)
    serverError(res)
  }
})

// ─── Order History ────────────────────────────────────────────────────────────
// User's own plan-upgrade payment history. Sourced from the payment_ref stored
// on nclex_profiles (current active plan) plus any historical rows we keep in
// the nclex_orders table if it ever lands. For now we return at most one entry
// (the current active subscription) — enough for the review subapp's Order
// History panel to be non-empty when a user is paid up.
router.get('/order-history', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const r = await query(
      `SELECT tier, tier_expires_at, payment_ref, upgrade_payment_method,
              upgrade_payment_ref, upgrade_requested, updated_at, created_at
         FROM nclex_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    if (!r.rowCount) { ok(res, []); return }
    const p = r.rows[0]
    const orders: any[] = []
    if (p.tier === 'PREMIUM' && p.payment_ref) {
      const ref = String(p.payment_ref)
      const method = ref.startsWith('stripe:') ? 'stripe' :
                     (p.upgrade_payment_method || '').includes('gcash') ? 'gcash' :
                     (p.upgrade_payment_method || '').includes('bdo') ? 'bdo' : 'unknown'
      orders.push({
        id: ref,
        method,
        reference: ref.replace(/^stripe:/, ''),
        status: 'completed',
        tier: p.tier,
        expiresAt: p.tier_expires_at,
        date: p.updated_at,
      })
    }
    if (p.upgrade_requested && p.upgrade_payment_ref) {
      orders.push({
        id: `pending:${p.upgrade_payment_ref}`,
        method: p.upgrade_payment_method?.split(':')[0] || 'manual',
        reference: p.upgrade_payment_ref,
        status: 'pending_admin_review',
        tier: 'PREMIUM',
        expiresAt: null,
        date: p.updated_at,
      })
    }
    ok(res, orders)
  } catch (err) {
    console.error('[nclex/order-history]', err)
    serverError(res)
  }
})

// ─── Site settings (admin-configurable single values) ─────────────────────────
// Currently exposes:
//   • group_support_url — Facebook group URL shown on the "Group Support" nav
//     item in the review subapp.
router.get('/site-settings', async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT key, value FROM nclex_site_settings
        WHERE key IN ('group_support_url')`,
      []
    )
    const map: Record<string, string> = {}
    for (const row of r.rows) map[row.key] = row.value
    // Site settings change only when an admin edits them. 2 min edge cache
    // means most pageloads skip Postgres entirely.
    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    ok(res, map)
  } catch {
    serverError(res)
  }
})

router.put('/admin/site-settings', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const allowedKeys = new Set(['group_support_url'])
    const updates = Object.entries(req.body || {}).filter(([k]) => allowedKeys.has(k))
    if (!updates.length) { badRequest(res, 'No settings to update'); return }
    for (const [key, value] of updates) {
      const existing = await query(`SELECT id FROM nclex_site_settings WHERE key = $1 LIMIT 1`, [key])
      if (existing.rowCount) {
        await query(
          `UPDATE nclex_site_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
          [String(value ?? ''), key]
        )
      } else {
        await query(
          `INSERT INTO nclex_site_settings (id, key, value) VALUES ($1, $2, $3)`,
          [newId(), key, String(value ?? '')]
        )
      }
    }
    ok(res, null, 'Settings updated')
  } catch (err) {
    console.error('[nclex/admin/site-settings PUT]', err)
    serverError(res)
  }
})

// Public plan config + video config (auth-required, but not admin-only)
router.get('/plans', (req: AuthenticatedRequest, res) => getSubscriptionPlansHandler(req, res))
router.get('/videos', (req: AuthenticatedRequest, res) => getVideoConfigHandler(req, res))

// ─── Stripe plan-upgrade payment ─────────────────────────────────────────────
// Stripe is the primary payment method on review.gritsync.com. The flow:
//   1. Client POST /create-upgrade-intent with { planId }
//   2. Server resolves the plan price, creates a Stripe PaymentIntent with
//      metadata.user_id + metadata.plan_id, returns { clientSecret }
//   3. Client confirms the PaymentIntent with @stripe/react-stripe-js
//   4. Client POST /confirm-stripe-upgrade with { paymentIntentId }
//   5. Server fetches the PaymentIntent from Stripe, verifies status='succeeded'
//      and metadata.user_id matches the caller, then upgrades the profile.
async function loadPlans(): Promise<any> {
  const row = await query(
    `SELECT value FROM nclex_site_settings WHERE key = 'nclex_plans' LIMIT 1`, []
  )
  if (!row.rowCount) return DEFAULT_PLANS
  try { return JSON.parse(row.rows[0].value) } catch { return DEFAULT_PLANS }
}

router.post('/create-upgrade-intent', async (req: AuthenticatedRequest, res) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is not configured. Set STRIPE_SECRET_KEY in the server env to a real test/live secret key.',
      })
    }
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { planId } = (req.body || {}) as { planId?: string }
    if (!planId) return res.status(400).json({ success: false, error: 'planId is required' })

    const planConfig = await loadPlans()
    const plan = (planConfig.plans || []).find((p: any) => p.id === planId)
    if (!plan) return res.status(404).json({ success: false, error: `Plan '${planId}' not found` })
    if (!plan.isActive) return res.status(400).json({ success: false, error: `Plan '${planId}' is not active` })
    if (typeof plan.price !== 'number' || plan.price <= 0) {
      return res.status(400).json({ success: false, error: `Plan '${planId}' has no priceable amount` })
    }

    const currency = (plan.currency || 'usd').toLowerCase()
    const amountCents = Math.round(Number(plan.price) * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      description: `NCLEX ${plan.name} upgrade`,
      metadata: {
        purpose: 'nclex_plan_upgrade',
        user_id: userId,
        plan_id: planId,
        duration_days: String(plan.durationDays ?? ''),
      },
    })

    return ok(res, { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err: any) {
    console.error('[nclex/create-upgrade-intent]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create payment intent' })
  }
})

router.post('/confirm-stripe-upgrade', async (req: AuthenticatedRequest, res) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Payment service is not configured.' })
    }
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { paymentIntentId } = (req.body || {}) as { paymentIntentId?: string }
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, error: 'paymentIntentId is required' })
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (intent.metadata?.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'This payment is not associated with the caller.' })
    }
    if (intent.status !== 'succeeded') {
      return res.status(400).json({ success: false, error: `Payment is ${intent.status}, not yet succeeded.` })
    }

    const planId = intent.metadata?.plan_id || 'premium'
    const planConfig = await loadPlans()
    const plan = (planConfig.plans || []).find((p: any) => p.id === planId)
    const durationDays = Number(plan?.durationDays ?? intent.metadata?.duration_days ?? 60)
    const isVip = planId === 'vip'

    const existing = await query(`SELECT * FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    if (!existing.rowCount) {
      // Create a profile row on the fly if the user has never visited NCLEX
      // home — keeps the upgrade idempotent.
      await query(
        `INSERT INTO nclex_profiles (id, user_id, tier, created_at, updated_at)
         VALUES ($1, $2, 'FREE', NOW(), NOW())`,
        [crypto.randomUUID(), userId]
      )
    }
    const previousSpecial = existing.rows[0]?.special_access ?? []
    const specialAccess = isVip
      ? Array.from(new Set([...(previousSpecial as string[]), 'live_lectures', 'cheat_sheets', 'week_of_exam']))
      : previousSpecial

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + durationDays)

    const upd = await query(
      `UPDATE nclex_profiles SET
          tier = 'PREMIUM',
          tier_expires_at = $1,
          upgrade_requested = FALSE,
          payment_ref = $2,
          special_access = $3::jsonb,
          updated_at = NOW()
        WHERE user_id = $4 RETURNING *`,
      [expiresAt, `stripe:${paymentIntentId}`, JSON.stringify(specialAccess), userId]
    )
    return ok(res, camelProfile(upd.rows[0]), `${isVip ? 'VIP' : 'Premium'} access granted for ${durationDays} days`)
  } catch (err: any) {
    console.error('[nclex/confirm-stripe-upgrade]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Failed to confirm upgrade' })
  }
})

// AI suggest test — stubbed; original called Claude
router.post('/ai/suggest', (_req: AuthenticatedRequest, res) => {
  notImplemented(res, 'AI suggest endpoint not yet ported. TODO: see E:/grit/backend/src/controllers/ai-generate.controller.ts (suggestTest) — requires Anthropic API config.')
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS — inline admin checks
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/stats', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const classicRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_questions WHERE bank = 'CLASSIC' AND is_active = TRUE`, [])
    const ngnRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_questions WHERE bank = 'NGN' AND is_active = TRUE`, [])
    const csRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_case_studies WHERE is_active = TRUE`, [])
    const byFormatRes = await query(
      `SELECT format, COUNT(*)::int AS c FROM nclex_questions WHERE is_active = TRUE GROUP BY format`, []
    )
    const sessionsRes = await query(
      `SELECT status, COUNT(*)::int AS c FROM nclex_sessions GROUP BY status`, []
    )
    ok(res, {
      classic: classicRes.rows[0].c,
      ngn: ngnRes.rows[0].c,
      caseStudies: csRes.rows[0].c,
      byFormat: byFormatRes.rows.map((b: any) => ({ format: b.format, _count: b.c })),
      sessions: sessionsRes.rows.map((s: any) => ({ status: s.status, _count: s.c })),
    })
  } catch (err) {
    console.error('[nclex/admin/stats]', err)
    serverError(res)
  }
})

router.get('/admin/sessions', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)
    const totalRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_sessions`, [])
    const listRes = await query(
      `SELECT s.*, u.id AS user_id_join, u.first_name, u.last_name, u.email
         FROM nclex_sessions s
         LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`,
      [Number(limit), skip]
    )
    const sessions = listRes.rows.map((r: any) => ({
      ...camelSession(r),
      user: r.user_id_join ? {
        id: r.user_id_join,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
      } : null,
    }))
    ok(res, { sessions, total: totalRes.rows[0].c, page: Number(page), limit: Number(limit) })
  } catch {
    serverError(res)
  }
})

router.get('/admin/questions', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { bank, format, topic, page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)
    const conds: string[] = [`q.is_active = TRUE`]
    const params: any[] = []
    if (bank) { params.push(bank); conds.push(`q.bank = $${params.length}`) }
    if (format) { params.push(format); conds.push(`q.format = $${params.length}`) }
    if (topic) { params.push(`%${topic}%`); conds.push(`q.topic ILIKE $${params.length}`) }
    if (search) { params.push(`%${search}%`); conds.push(`q.stem ILIKE $${params.length}`) }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const countRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_questions q ${whereSql}`, params)

    params.push(Number(limit))
    params.push(skip)
    const listRes = await query(
      `SELECT q.*, cs.id AS cs_id, cs.title AS cs_title, cs.case_type AS cs_case_type
         FROM nclex_questions q
         LEFT JOIN nclex_case_studies cs ON cs.id = q.case_study_id
         ${whereSql}
        ORDER BY q.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const questions = listRes.rows.map((r: any) => {
      const q = camelQuestion(r)
      q.caseStudy = r.cs_id ? { id: r.cs_id, title: r.cs_title, caseType: r.cs_case_type } : null
      return q
    })
    ok(res, { questions, total: countRes.rows[0].c, page: Number(page), limit: Number(limit) })
  } catch {
    serverError(res)
  }
})

router.post('/admin/questions', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { bank, format, stem, options, correctAnswer, rationale, topic, subtopic, difficulty, discrimination, caseStudyId, itemNumber } = req.body
    if (!bank || !format || !stem || !rationale || correctAnswer === undefined) {
      badRequest(res, 'bank, format, stem, correctAnswer, and rationale are required')
      return
    }
    if (!VALID_BANKS.has(bank) || !VALID_FORMATS.has(format)) {
      badRequest(res, 'Invalid bank or format'); return
    }
    const id = newId()
    const ins = await query(
      `INSERT INTO nclex_questions
          (id, bank, format, stem, options, correct_answer, rationale, topic, subtopic,
           difficulty, discrimination, case_study_id, item_number)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [id, bank, format, stem,
       JSON.stringify(options ?? []),
       JSON.stringify(correctAnswer),
       rationale, topic || null, subtopic || null,
       difficulty !== undefined ? Number(difficulty) : 0.0,
       discrimination !== undefined ? Number(discrimination) : 1.0,
       caseStudyId || null,
       itemNumber ? Number(itemNumber) : null,
      ]
    )
    created(res, camelQuestion(ins.rows[0]), 'Question created')
  } catch (err) {
    console.error('[admin/questions POST]', err)
    serverError(res)
  }
})

router.get('/admin/questions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const q = await fetchQuestionWithCaseStudy(String(req.params.id))
    if (!q) { notFound(res, 'Question not found'); return }
    ok(res, q)
  } catch {
    serverError(res)
  }
})

router.put('/admin/questions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const existing = await query(`SELECT * FROM nclex_questions WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!existing.rowCount) { notFound(res, 'Question not found'); return }
    const ex = existing.rows[0]
    const { bank, format, stem, options, correctAnswer, rationale, topic, subtopic, difficulty, discrimination, caseStudyId, itemNumber, isActive } = req.body
    const upd = await query(
      `UPDATE nclex_questions SET
          bank = $1, format = $2, stem = $3,
          options = $4::jsonb, correct_answer = $5::jsonb,
          rationale = $6, topic = $7, subtopic = $8,
          difficulty = $9, discrimination = $10,
          case_study_id = $11, item_number = $12, is_active = $13,
          updated_at = NOW()
        WHERE id = $14 RETURNING *`,
      [
        bank ?? ex.bank,
        format ?? ex.format,
        stem ?? ex.stem,
        JSON.stringify(options !== undefined ? options : ex.options),
        JSON.stringify(correctAnswer !== undefined ? correctAnswer : ex.correct_answer),
        rationale ?? ex.rationale,
        topic !== undefined ? topic : ex.topic,
        subtopic !== undefined ? subtopic : ex.subtopic,
        difficulty !== undefined ? Number(difficulty) : Number(ex.difficulty),
        discrimination !== undefined ? Number(discrimination) : Number(ex.discrimination),
        caseStudyId !== undefined ? (caseStudyId || null) : ex.case_study_id,
        itemNumber !== undefined ? (itemNumber ? Number(itemNumber) : null) : ex.item_number,
        isActive !== undefined ? isActive : ex.is_active,
        req.params.id,
      ]
    )
    ok(res, camelQuestion(upd.rows[0]), 'Question updated')
  } catch (err) {
    console.error('[admin/questions PUT]', err)
    serverError(res)
  }
})

router.delete('/admin/questions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const existing = await query(`SELECT id FROM nclex_questions WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!existing.rowCount) { notFound(res, 'Question not found'); return }
    await query(`UPDATE nclex_questions SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [req.params.id])
    ok(res, null, 'Question deleted')
  } catch {
    serverError(res)
  }
})

router.get('/admin/case-studies', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)
    const conds: string[] = [`is_active = TRUE`]
    const params: any[] = []
    if (search) { params.push(`%${search}%`); conds.push(`title ILIKE $${params.length}`) }
    const whereSql = `WHERE ${conds.join(' AND ')}`

    const totalRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_case_studies ${whereSql}`, params)
    params.push(Number(limit))
    params.push(skip)
    const listRes = await query(
      `SELECT cs.*, (SELECT COUNT(*)::int FROM nclex_questions q WHERE q.case_study_id = cs.id) AS q_count
         FROM nclex_case_studies cs ${whereSql}
        ORDER BY cs.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const caseStudies = listRes.rows.map((r: any) => ({
      ...camelCaseStudy(r),
      _count: { questions: r.q_count },
    }))
    ok(res, { caseStudies, total: totalRes.rows[0].c, page: Number(page), limit: Number(limit) })
  } catch {
    serverError(res)
  }
})

router.post('/admin/case-studies', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { title, scenario, tabs, caseType } = req.body
    if (!title || !scenario || !caseType) {
      badRequest(res, 'title, scenario, and caseType are required'); return
    }
    const ins = await query(
      `INSERT INTO nclex_case_studies (id, title, scenario, tabs, case_type)
        VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
      [newId(), title, scenario, JSON.stringify(tabs ?? []), caseType]
    )
    created(res, camelCaseStudy(ins.rows[0]), 'Case study created')
  } catch {
    serverError(res)
  }
})

router.put('/admin/case-studies/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const existing = await query(`SELECT * FROM nclex_case_studies WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!existing.rowCount) { notFound(res, 'Case study not found'); return }
    const ex = existing.rows[0]
    const { title, scenario, tabs, caseType, isActive } = req.body
    const upd = await query(
      `UPDATE nclex_case_studies SET
          title = $1, scenario = $2, tabs = $3::jsonb, case_type = $4, is_active = $5,
          updated_at = NOW()
        WHERE id = $6 RETURNING *`,
      [
        title ?? ex.title,
        scenario ?? ex.scenario,
        JSON.stringify(tabs !== undefined ? tabs : ex.tabs),
        caseType ?? ex.case_type,
        isActive !== undefined ? isActive : ex.is_active,
        req.params.id,
      ]
    )
    ok(res, camelCaseStudy(upd.rows[0]), 'Case study updated')
  } catch {
    serverError(res)
  }
})

router.delete('/admin/case-studies/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const existing = await query(`SELECT id FROM nclex_case_studies WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!existing.rowCount) { notFound(res, 'Case study not found'); return }
    await query(`UPDATE nclex_case_studies SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [req.params.id])
    ok(res, null, 'Case study deleted')
  } catch {
    serverError(res)
  }
})

router.get('/admin/exit-access', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(
      `SELECT ea.*, u.id AS u_id, u.first_name, u.last_name, u.email
         FROM nclex_exit_access ea
         LEFT JOIN users u ON u.id = ea.user_id
        ORDER BY ea.granted_at DESC`,
      []
    )
    const records = r.rows.map((row: any) => ({
      ...camelExitAccess(row),
      user: row.u_id ? {
        id: row.u_id, firstName: row.first_name, lastName: row.last_name, email: row.email,
      } : null,
    }))
    ok(res, records)
  } catch {
    serverError(res)
  }
})

router.post('/admin/grant-exit/:userId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { userId } = req.params
    const { paymentRef } = req.body
    const userRes = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId])
    if (!userRes.rowCount) { notFound(res, 'User not found'); return }

    const existing = await query(`SELECT id FROM nclex_exit_access WHERE user_id = $1 LIMIT 1`, [userId])
    let row
    if (existing.rowCount) {
      const upd = await query(
        `UPDATE nclex_exit_access
            SET granted_at = NOW(), payment_ref = $1, granted_by_id = $2
          WHERE user_id = $3 RETURNING *`,
        [paymentRef || null, req.user!.id, userId]
      )
      row = upd.rows[0]
    } else {
      const ins = await query(
        `INSERT INTO nclex_exit_access (id, user_id, payment_ref, granted_by_id)
          VALUES ($1, $2, $3, $4) RETURNING *`,
        [newId(), userId, paymentRef || null, req.user!.id]
      )
      row = ins.rows[0]
    }
    ok(res, camelExitAccess(row), 'Exit exam access granted')
  } catch (err) {
    console.error('[admin/grant-exit]', err)
    serverError(res)
  }
})

router.delete('/admin/revoke-exit/:userId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { userId } = req.params
    const existing = await query(`SELECT id FROM nclex_exit_access WHERE user_id = $1 LIMIT 1`, [userId])
    if (!existing.rowCount) { notFound(res, 'Access record not found'); return }
    await query(`DELETE FROM nclex_exit_access WHERE user_id = $1`, [userId])
    ok(res, null, 'Exit exam access revoked')
  } catch {
    serverError(res)
  }
})

router.get('/admin/profiles', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { page = '1', limit = '20', search } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)
    const params: any[] = []
    let whereSql = ''
    if (search) {
      params.push(`%${search}%`)
      whereSql = `WHERE u.first_name ILIKE $${params.length} OR u.email ILIKE $${params.length}`
    }
    const totalRes = await query(
      `SELECT COUNT(*)::int AS c FROM nclex_profiles p LEFT JOIN users u ON u.id = p.user_id ${whereSql}`,
      params
    )
    params.push(Number(limit))
    params.push(skip)
    const listRes = await query(
      `SELECT p.*, u.id AS u_id, u.first_name, u.last_name, u.email
         FROM nclex_profiles p
         LEFT JOIN users u ON u.id = p.user_id
         ${whereSql}
        ORDER BY p.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const profiles = listRes.rows.map((r: any) => ({
      ...camelProfile(r),
      user: r.u_id ? { id: r.u_id, firstName: r.first_name, lastName: r.last_name, email: r.email } : null,
    }))
    ok(res, { profiles, total: totalRes.rows[0].c })
  } catch {
    serverError(res)
  }
})

router.get('/admin/upgrade-requests', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(
      `SELECT p.*, u.id AS u_id, u.first_name, u.last_name, u.email
         FROM nclex_profiles p
         LEFT JOIN users u ON u.id = p.user_id
        WHERE p.upgrade_requested = TRUE
        ORDER BY p.updated_at DESC`,
      []
    )
    const profiles = r.rows.map((row: any) => ({
      ...camelProfile(row),
      user: row.u_id ? { id: row.u_id, firstName: row.first_name, lastName: row.last_name, email: row.email } : null,
    }))
    ok(res, profiles)
  } catch {
    serverError(res)
  }
})

async function readNclexPlansSetting(): Promise<any | null> {
  const r = await query(`SELECT value FROM nclex_site_settings WHERE key = 'nclex_plans' LIMIT 1`, [])
  if (!r.rowCount) return null
  try { return JSON.parse(r.rows[0].value) } catch { return null }
}

router.post('/admin/approve-upgrade/:userId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { userId } = req.params
    const existingRes = await query(`SELECT * FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    if (!existingRes.rowCount) { notFound(res, 'Profile not found'); return }
    const existing = existingRes.rows[0]

    let durationDays = 60
    const plans = await readNclexPlansSetting()
    if (plans) {
      const premiumPlan = plans.plans?.find((p: any) => p.id === 'premium')
      if (premiumPlan?.durationDays) durationDays = premiumPlan.durationDays
    }

    const methodField = existing.upgrade_payment_method ?? ''
    const targetPlanId = methodField.includes(':') ? methodField.split(':')[1] : 'premium'
    const isVipUpgrade = targetPlanId === 'vip'

    if (isVipUpgrade && plans) {
      const vipPlan = plans.plans?.find((p: any) => p.id === 'vip')
      if (vipPlan?.durationDays) durationDays = vipPlan.durationDays
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + durationDays)

    const vipSpecialAccess = isVipUpgrade
      ? ['live_lectures', 'cheat_sheets', 'week_of_exam']
      : ((existing.special_access as string[] | null) ?? [])

    const upd = await query(
      `UPDATE nclex_profiles SET
          tier = 'PREMIUM',
          tier_expires_at = $1,
          upgrade_requested = FALSE,
          payment_ref = $2,
          granted_by_id = $3,
          special_access = $4::jsonb,
          updated_at = NOW()
        WHERE user_id = $5 RETURNING *`,
      [
        expiresAt,
        existing.upgrade_payment_ref,
        req.user!.id,
        JSON.stringify(isVipUpgrade ? vipSpecialAccess : ((existing.special_access as string[]) ?? [])),
        userId,
      ]
    )
    ok(res, camelProfile(upd.rows[0]), `${isVipUpgrade ? 'VIP' : 'Premium'} access granted for ${durationDays} days`)
  } catch (err) {
    console.error('[admin/approve-upgrade]', err)
    serverError(res)
  }
})

router.post('/admin/reject-upgrade/:userId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    await query(
      `UPDATE nclex_profiles SET upgrade_requested = FALSE, upgrade_payment_ref = NULL, updated_at = NOW()
        WHERE user_id = $1`,
      [req.params.userId]
    )
    ok(res, null, 'Upgrade request rejected')
  } catch {
    serverError(res)
  }
})

router.post('/admin/special-access/:userId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const userId = String(req.params.userId)
    const { resource } = req.body
    if (!resource) { badRequest(res, 'resource is required'); return }
    const profile = await upsertProfile(userId)
    const current = (profile.specialAccess as string[]) ?? []
    if (!current.includes(resource)) {
      await query(
        `UPDATE nclex_profiles SET special_access = $1::jsonb, updated_at = NOW() WHERE user_id = $2`,
        [JSON.stringify([...current, resource]), userId]
      )
    }
    ok(res, null, `Special access granted: ${resource}`)
  } catch {
    serverError(res)
  }
})

router.delete('/admin/special-access/:userId', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { userId } = req.params
    const { resource } = req.body
    const profRes = await query(`SELECT special_access FROM nclex_profiles WHERE user_id = $1 LIMIT 1`, [userId])
    if (!profRes.rowCount) { notFound(res, 'Profile not found'); return }
    const current = ((profRes.rows[0].special_access as string[] | null) ?? [])
    await query(
      `UPDATE nclex_profiles SET special_access = $1::jsonb, updated_at = NOW() WHERE user_id = $2`,
      [JSON.stringify(current.filter((r) => r !== resource)), userId]
    )
    ok(res, null, `Special access revoked: ${resource}`)
  } catch {
    serverError(res)
  }
})

router.get('/admin/pending-testimonials', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(
      `SELECT * FROM nclex_testimonials WHERE is_pending = TRUE ORDER BY created_at DESC`,
      []
    )
    ok(res, r.rows.map(camelTestimonial))
  } catch {
    serverError(res)
  }
})

router.post('/admin/approve-testimonial/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const existing = await query(`SELECT id FROM nclex_testimonials WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!existing.rowCount) { notFound(res, 'Testimonial not found'); return }
    const upd = await query(
      `UPDATE nclex_testimonials SET is_pending = FALSE, is_active = TRUE WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    ok(res, camelTestimonial(upd.rows[0]), 'Testimonial approved')
  } catch {
    serverError(res)
  }
})

// ─────────────────────── Subscription plan config ─────────────────────────────

const ALL_FEATURES = [
  'Unlimited Q-Bank questions',
  'CAT Adaptive Testing',
  'Readiness Assessment',
  'Study Calendar',
  'Video Library',
  'Performance Analytics',
  'Live Lectures',
  'Cheat Sheets',
  'Week of Exam Guide',
  'Priority Support',
]

const DEFAULT_PLANS = {
  plans: [
    {
      id: 'free', name: 'Free', price: 0, durationDays: null as number | null,
      currency: 'PHP', description: 'Get started with NCLEX prep',
      features: ALL_FEATURES.map(name => ({ name, included: ['Study Calendar'].includes(name) })),
      isPopular: false, isActive: true,
    },
    {
      id: 'premium', name: 'Premium', price: 300, durationDays: 60,
      currency: 'PHP', description: 'Full NCLEX prep — most popular',
      features: ALL_FEATURES.map(name => ({
        name, included: !['Live Lectures', 'Cheat Sheets', 'Week of Exam Guide'].includes(name),
      })),
      isPopular: true, isActive: true,
    },
    {
      id: 'vip', name: 'VIP', price: 500, durationDays: 90,
      currency: 'PHP', description: 'Everything unlocked — complete NCLEX mastery',
      features: ALL_FEATURES.map(name => ({ name, included: true })),
      isPopular: false, isActive: true,
    },
  ],
  paymentInstructions: 'Send payment via GCash / Bank Transfer. Enter your reference number and upload your receipt.',
  gcashNumber: '09XX-XXX-XXXX',
  gcashName: 'Admin Name',
}

async function getSubscriptionPlansHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const planRow = await query(`SELECT value FROM nclex_site_settings WHERE key = 'nclex_plans' LIMIT 1`, [])
    const paymentRows = await query(
      `SELECT key, value FROM nclex_site_settings
        WHERE key IN ('gcashNumber','gcashName','bdoNumber','bdoName','stripePublishableKey','paymentInstructions')`,
      []
    )
    let planConfig: any = DEFAULT_PLANS
    if (planRow.rowCount) {
      try { planConfig = JSON.parse(planRow.rows[0].value) } catch { /* keep default */ }
    }
    const paymentMap: Record<string, string> = {}
    for (const r of paymentRows.rows) paymentMap[r.key] = r.value
    // Plans rarely change; every learner who opens the upgrade modal hits this.
    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    ok(res, { ...planConfig, ...paymentMap })
  } catch {
    serverError(res)
  }
}

router.get('/admin/subscription-plans', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  return getSubscriptionPlansHandler(req, res)
})

router.put('/admin/subscription-plans', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const data = req.body
    const existing = await query(`SELECT id FROM nclex_site_settings WHERE key = 'nclex_plans' LIMIT 1`, [])
    if (existing.rowCount) {
      await query(
        `UPDATE nclex_site_settings SET value = $1, updated_at = NOW() WHERE key = 'nclex_plans'`,
        [JSON.stringify(data)]
      )
    } else {
      await query(
        `INSERT INTO nclex_site_settings (id, key, value) VALUES ($1, 'nclex_plans', $2)`,
        [newId(), JSON.stringify(data)]
      )
    }
    ok(res, data, 'Subscription plans updated')
  } catch {
    serverError(res)
  }
})

// ─────────────────────────── Video config ─────────────────────────────────────

const DEFAULT_VIDEOS = {
  videos: [
    { id: 'strategies', title: 'NCLEX Strategies & Test-Taking', description: 'Master the art of answering NCLEX questions confidently. Learn elimination, priority setting, and time management.', videoUrl: '', thumbnailUrl: '', duration: '', order: 1, isPublished: false, topic: 'NCLEX Strategies & Test-Taking' },
    { id: 'safety', title: 'Safety & Infection Control', description: 'Standard precautions, isolation protocols, and priority safety interventions every nurse must know.', videoUrl: '', thumbnailUrl: '', duration: '', order: 2, isPublished: false, topic: 'Safety & Infection Control' },
    { id: 'pharmacology', title: 'Pharmacology Fundamentals', description: 'High-yield drug categories, medication safety, drug calculations, and NCLEX-priority drugs.', videoUrl: '', thumbnailUrl: '', duration: '', order: 3, isPublished: false, topic: 'Pharmacology Fundamentals' },
    { id: 'cardiovascular', title: 'Cardiovascular Nursing', description: 'Heart failure, dysrhythmias, cardiac surgeries, and priority nursing interventions.', videoUrl: '', thumbnailUrl: '', duration: '', order: 4, isPublished: false, topic: 'Cardiovascular Nursing' },
    { id: 'respiratory', title: 'Respiratory Nursing', description: 'COPD, pneumonia, mechanical ventilation, and airway management priorities.', videoUrl: '', thumbnailUrl: '', duration: '', order: 5, isPublished: false, topic: 'Respiratory Nursing' },
    { id: 'neurological', title: 'Neurological Nursing', description: 'Stroke, TBI, seizures, and neuro assessment including Glasgow Coma Scale.', videoUrl: '', thumbnailUrl: '', duration: '', order: 6, isPublished: false, topic: 'Neurological Nursing' },
    { id: 'gastrointestinal', title: 'Gastrointestinal Nursing', description: 'GI disorders, surgical interventions, tube feedings, and priority GI emergencies.', videoUrl: '', thumbnailUrl: '', duration: '', order: 7, isPublished: false, topic: 'Gastrointestinal Nursing' },
    { id: 'genitourinary', title: 'Genitourinary/Renal Nursing', description: 'CKD, AKI, dialysis, and fluid/electrolyte management in renal disease.', videoUrl: '', thumbnailUrl: '', duration: '', order: 8, isPublished: false, topic: 'Genitourinary/Renal Nursing' },
    { id: 'endocrine', title: 'Endocrine Nursing', description: 'Diabetes management, thyroid disorders, adrenal crises, and hormonal emergencies.', videoUrl: '', thumbnailUrl: '', duration: '', order: 9, isPublished: false, topic: 'Endocrine Nursing' },
    { id: 'musculoskeletal', title: 'Musculoskeletal & Integumentary', description: 'Fractures, casts, traction, wound care, and skin integrity priorities.', videoUrl: '', thumbnailUrl: '', duration: '', order: 10, isPublished: false, topic: 'Musculoskeletal & Integumentary' },
    { id: 'mental-health', title: 'Mental Health Nursing', description: 'Therapeutic communication, psychiatric disorders, crisis intervention, and psych medications.', videoUrl: '', thumbnailUrl: '', duration: '', order: 11, isPublished: false, topic: 'Mental Health Nursing' },
    { id: 'maternal', title: 'Maternal-Newborn Nursing', description: 'Antepartum, intrapartum, postpartum care, and newborn assessment priorities.', videoUrl: '', thumbnailUrl: '', duration: '', order: 12, isPublished: false, topic: 'Maternal-Newborn Nursing' },
    { id: 'pediatric', title: 'Pediatric Nursing', description: 'Growth & development milestones, pediatric dosing, and child-specific conditions.', videoUrl: '', thumbnailUrl: '', duration: '', order: 13, isPublished: false, topic: 'Pediatric Nursing' },
    { id: 'critical-care', title: 'Critical Care & Emergency', description: 'Sepsis, shock states, ARDS, and NCLEX-priority critical care interventions.', videoUrl: '', thumbnailUrl: '', duration: '', order: 14, isPublished: false, topic: 'Critical Care & Emergency' },
    { id: 'leadership', title: 'Leadership & Management', description: 'Delegation, prioritization, chain of command, and ethical/legal nursing practice.', videoUrl: '', thumbnailUrl: '', duration: '', order: 15, isPublished: false, topic: 'Leadership & Management' },
    { id: 'community', title: 'Community & Transcultural', description: 'Community health, transcultural nursing, epidemiology, and public health priorities.', videoUrl: '', thumbnailUrl: '', duration: '', order: 16, isPublished: false, topic: 'Community & Transcultural' },
  ],
}

async function getVideoConfigHandler(_req: AuthenticatedRequest, res: Response) {
  try {
    const r = await query(`SELECT value FROM nclex_site_settings WHERE key = 'nclex_videos' LIMIT 1`, [])
    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    if (!r.rowCount) return ok(res, DEFAULT_VIDEOS)
    let config: any = DEFAULT_VIDEOS
    try { config = JSON.parse(r.rows[0].value) } catch { /* keep default */ }
    return ok(res, config)
  } catch {
    return serverError(res)
  }
}

router.put('/admin/videos', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const data = req.body
    const existing = await query(`SELECT id FROM nclex_site_settings WHERE key = 'nclex_videos' LIMIT 1`, [])
    if (existing.rowCount) {
      await query(
        `UPDATE nclex_site_settings SET value = $1, updated_at = NOW() WHERE key = 'nclex_videos'`,
        [JSON.stringify(data)]
      )
    } else {
      await query(
        `INSERT INTO nclex_site_settings (id, key, value) VALUES ($1, 'nclex_videos', $2)`,
        [newId(), JSON.stringify(data)]
      )
    }
    ok(res, data, 'Video config updated')
  } catch {
    serverError(res)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// AI generation / pending review endpoints
// ─────────────────────────────────────────────────────────────────────────────
//
// AI generation endpoints call Anthropic Claude (model claude-opus-4-7) via
// ../lib/nclex-ai.ts and insert rows into the pending-review tables. The
// admin UI then approves/rejects/edits before items move to the live bank.
//

// AI question generation — calls Anthropic (claude-opus-4-7) and inserts the
// result as pending rows for admin review.
router.post('/admin/generate-questions', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { format, bank, topic, count, customContext } = req.body || {}
    if (!format || !VALID_FORMATS.has(format)) return badRequest(res, 'Invalid format')
    if (!bank || !VALID_BANKS.has(bank)) return badRequest(res, 'Invalid bank')
    if (!topic || typeof topic !== 'string') return badRequest(res, 'Topic is required')
    const n = Math.max(1, Math.min(50, Number(count) || 1))

    const { questions, raw } = await aiGenerateQuestions({
      format,
      bank,
      topic,
      count: n,
      customContext: typeof customContext === 'string' ? customContext : undefined,
    })

    const batchId = newId()
    const inserted = await withTransaction(async (q) => {
      const rows: any[] = []
      for (const item of questions) {
        const id = newId()
        const r = await q(
          `INSERT INTO nclex_pending_questions (
             id, bank, format, stem, options, correct_answer, rationale,
             additional_info, topic, subtopic, difficulty, discrimination,
             status, generated_by, generation_batch, ai_raw, cognitive_skill,
             metadata, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7,
             $8, $9, $10, $11, $12,
             'PENDING', 'claude', $13, $14, $15,
             $16::jsonb, NOW(), NOW()
           ) RETURNING *`,
          [
            id,
            bank,
            format,
            String(item.stem ?? ''),
            JSON.stringify(item.options ?? []),
            JSON.stringify(item.correctAnswer ?? null),
            String(item.rationale ?? ''),
            item.additionalInfo ?? null,
            item.topic ?? topic,
            item.subtopic ?? null,
            Number.isFinite(Number(item.difficulty)) ? Number(item.difficulty) : 0,
            Number.isFinite(Number(item.discrimination)) ? Number(item.discrimination) : 1,
            batchId,
            raw,
            item.cognitiveSkill ?? null,
            JSON.stringify(item.metadata ?? null),
          ]
        )
        rows.push(r.rows[0])
      }
      return rows
    })

    created(res, {
      batch: batchId,
      count: inserted.length,
      pending: inserted.map(camelPendingQuestion),
    }, 'Generated and queued for review')
  } catch (err: any) {
    console.error('[admin/generate-questions]', err)
    res.status(500).json({ success: false, message: err?.message || 'AI generation failed' })
  }
})

// AI case-study generation — produces one pending case study and its child
// pending questions in a single transaction.
router.post('/admin/generate-case-study', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { caseType, topic, formats, customContext } = req.body || {}
    if (caseType !== 'UNFOLDING' && caseType !== 'STANDALONE') {
      return badRequest(res, 'caseType must be UNFOLDING or STANDALONE')
    }
    if (!topic || typeof topic !== 'string') return badRequest(res, 'Topic is required')
    if (!Array.isArray(formats) || formats.length === 0) {
      return badRequest(res, 'formats[] is required')
    }
    for (const f of formats) {
      if (!VALID_FORMATS.has(f)) return badRequest(res, `Invalid format: ${f}`)
    }

    const { caseStudy, raw } = await aiGenerateCaseStudy({
      caseType,
      topic,
      formats,
      customContext: typeof customContext === 'string' ? customContext : undefined,
    })

    const batchId = newId()
    const result = await withTransaction(async (q) => {
      const csId = newId()
      const csRow = await q(
        `INSERT INTO nclex_pending_case_studies (
           id, title, scenario, tabs, case_type, status, generated_by,
           generation_batch, ai_raw, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4::jsonb, $5, 'PENDING', 'claude',
           $6, $7, NOW(), NOW()
         ) RETURNING *`,
        [
          csId,
          String(caseStudy.title ?? `Case Study: ${topic}`),
          String(caseStudy.scenario ?? ''),
          JSON.stringify(caseStudy.tabs ?? []),
          caseType,
          batchId,
          raw,
        ]
      )
      const qRows: any[] = []
      let i = 1
      for (const item of caseStudy.questions ?? []) {
        const qid = newId()
        const fmt = VALID_FORMATS.has(item.format) ? item.format : (formats[0] as string)
        const r = await q(
          `INSERT INTO nclex_pending_questions (
             id, bank, format, stem, options, correct_answer, rationale,
             additional_info, topic, subtopic, difficulty, discrimination,
             status, generated_by, generation_batch, ai_raw, cognitive_skill,
             item_number, pending_case_study_id, metadata,
             created_at, updated_at
           ) VALUES (
             $1, 'NGN', $2, $3, $4::jsonb, $5::jsonb, $6,
             $7, $8, $9, $10, $11,
             'PENDING', 'claude', $12, $13, $14,
             $15, $16, $17::jsonb,
             NOW(), NOW()
           ) RETURNING *`,
          [
            qid,
            fmt,
            String(item.stem ?? ''),
            JSON.stringify(item.options ?? []),
            JSON.stringify(item.correctAnswer ?? null),
            String(item.rationale ?? ''),
            item.additionalInfo ?? null,
            item.topic ?? topic,
            item.subtopic ?? null,
            Number.isFinite(Number(item.difficulty)) ? Number(item.difficulty) : 0,
            Number.isFinite(Number(item.discrimination)) ? Number(item.discrimination) : 1,
            batchId,
            raw,
            item.cognitiveSkill ?? null,
            Number.isFinite(Number(item.itemNumber)) ? Number(item.itemNumber) : i,
            csId,
            JSON.stringify((item as any).metadata ?? null),
          ]
        )
        qRows.push(r.rows[0])
        i++
      }
      return { caseStudy: csRow.rows[0], questions: qRows }
    })

    created(res, {
      batch: batchId,
      caseStudy: camelPendingCaseStudy(result.caseStudy),
      questions: result.questions.map(camelPendingQuestion),
    }, 'Generated and queued for review')
  } catch (err: any) {
    console.error('[admin/generate-case-study]', err)
    res.status(500).json({ success: false, message: err?.message || 'AI generation failed' })
  }
})

// Pending questions CRUD (no AI dep)
router.get('/admin/pending-questions', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { status, batch, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)
    const conds: string[] = []
    const params: any[] = []
    if (status) { params.push(status); conds.push(`status = $${params.length}`) }
    if (batch) { params.push(batch); conds.push(`generation_batch = $${params.length}`) }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const totalRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_pending_questions ${whereSql}`, params)
    params.push(Number(limit))
    params.push(skip)
    const listRes = await query(
      `SELECT * FROM nclex_pending_questions ${whereSql}
        ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    ok(res, {
      pending: listRes.rows.map(camelPendingQuestion),
      total: totalRes.rows[0].c,
      page: Number(page),
      limit: Number(limit),
    })
  } catch {
    serverError(res)
  }
})

router.get('/admin/pending-questions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(`SELECT * FROM nclex_pending_questions WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!r.rowCount) { notFound(res, 'Pending question not found'); return }
    ok(res, camelPendingQuestion(r.rows[0]))
  } catch {
    serverError(res)
  }
})

router.put('/admin/pending-questions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(`SELECT * FROM nclex_pending_questions WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!r.rowCount) { notFound(res, 'Pending question not found'); return }
    const ex = r.rows[0]
    const b = req.body
    const upd = await query(
      `UPDATE nclex_pending_questions SET
          bank = $1, format = $2, stem = $3, options = $4::jsonb,
          correct_answer = $5::jsonb, rationale = $6, additional_info = $7,
          topic = $8, subtopic = $9, difficulty = $10, discrimination = $11,
          cognitive_skill = $12, item_number = $13, metadata = $14::jsonb,
          updated_at = NOW()
        WHERE id = $15 RETURNING *`,
      [
        b.bank ?? ex.bank,
        b.format ?? ex.format,
        b.stem ?? ex.stem,
        JSON.stringify(b.options !== undefined ? b.options : ex.options),
        JSON.stringify(b.correctAnswer !== undefined ? b.correctAnswer : ex.correct_answer),
        b.rationale ?? ex.rationale,
        b.additionalInfo !== undefined ? b.additionalInfo : ex.additional_info,
        b.topic !== undefined ? b.topic : ex.topic,
        b.subtopic !== undefined ? b.subtopic : ex.subtopic,
        b.difficulty !== undefined ? Number(b.difficulty) : Number(ex.difficulty),
        b.discrimination !== undefined ? Number(b.discrimination) : Number(ex.discrimination),
        b.cognitiveSkill !== undefined ? b.cognitiveSkill : ex.cognitive_skill,
        b.itemNumber !== undefined ? (b.itemNumber ? Number(b.itemNumber) : null) : ex.item_number,
        JSON.stringify(b.metadata !== undefined ? b.metadata : ex.metadata),
        req.params.id,
      ]
    )
    ok(res, camelPendingQuestion(upd.rows[0]), 'Pending question updated')
  } catch (err) {
    console.error('[admin/pending-questions PUT]', err)
    serverError(res)
  }
})

async function promotePendingQuestionToLive(client: any, pq: any): Promise<string> {
  const id = newId()
  await client(
    `INSERT INTO nclex_questions
        (id, bank, format, stem, stem_image, options, correct_answer, rationale,
         additional_info, rationale_image, topic, subtopic, difficulty, discrimination,
         item_number, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)`,
    [
      id, pq.bank, pq.format, pq.stem, pq.stem_image,
      JSON.stringify(pq.options ?? []),
      JSON.stringify(pq.correct_answer),
      pq.rationale, pq.additional_info, pq.rationale_image,
      pq.topic, pq.subtopic, Number(pq.difficulty), Number(pq.discrimination),
      pq.item_number, pq.metadata ? JSON.stringify(pq.metadata) : null,
    ]
  )
  await client(
    `UPDATE nclex_pending_questions SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
    [pq.id]
  )
  return id
}

router.post('/admin/pending-questions/:id/approve', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const newQuestionId = await withTransaction(async (client) => {
      const r = await client(`SELECT * FROM nclex_pending_questions WHERE id = $1 LIMIT 1`, [req.params.id])
      if (!r.rowCount) throw new Error('NOT_FOUND')
      return await promotePendingQuestionToLive(client, r.rows[0])
    })
    ok(res, { questionId: newQuestionId }, 'Pending question approved')
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') return notFound(res, 'Pending question not found')
    console.error('[admin/pending-questions/:id/approve]', err)
    serverError(res)
  }
})

router.post('/admin/pending-questions/:id/reject', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { rejectionNote } = req.body
    const upd = await query(
      `UPDATE nclex_pending_questions
          SET status = 'REJECTED', rejection_note = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [rejectionNote ?? null, req.params.id]
    )
    if (!upd.rowCount) { notFound(res, 'Pending question not found'); return }
    ok(res, camelPendingQuestion(upd.rows[0]), 'Pending question rejected')
  } catch {
    serverError(res)
  }
})

router.delete('/admin/pending-questions/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(`DELETE FROM nclex_pending_questions WHERE id = $1`, [req.params.id])
    if (!r.rowCount) { notFound(res, 'Pending question not found'); return }
    ok(res, null, 'Pending question deleted')
  } catch {
    serverError(res)
  }
})

router.post('/admin/pending-questions/bulk-approve', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { ids } = req.body as { ids?: string[] }
    if (!Array.isArray(ids) || ids.length === 0) { badRequest(res, 'ids array required'); return }

    const approved: string[] = []
    await withTransaction(async (client) => {
      const r = await client(
        `SELECT * FROM nclex_pending_questions WHERE id = ANY($1::text[]) AND status = 'PENDING'`,
        [ids]
      )
      for (const pq of r.rows) {
        const id = await promotePendingQuestionToLive(client, pq)
        approved.push(id)
      }
    })
    ok(res, { approvedCount: approved.length, ids: approved }, `${approved.length} pending question(s) approved`)
  } catch (err) {
    console.error('[admin/pending-questions/bulk-approve]', err)
    serverError(res)
  }
})

// Pending case studies CRUD
router.get('/admin/pending-case-studies', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { status, batch, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)
    const conds: string[] = []
    const params: any[] = []
    if (status) { params.push(status); conds.push(`status = $${params.length}`) }
    if (batch) { params.push(batch); conds.push(`generation_batch = $${params.length}`) }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const totalRes = await query(`SELECT COUNT(*)::int AS c FROM nclex_pending_case_studies ${whereSql}`, params)
    params.push(Number(limit))
    params.push(skip)
    const listRes = await query(
      `SELECT * FROM nclex_pending_case_studies ${whereSql}
        ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    ok(res, {
      pending: listRes.rows.map(camelPendingCaseStudy),
      total: totalRes.rows[0].c,
      page: Number(page),
      limit: Number(limit),
    })
  } catch {
    serverError(res)
  }
})

router.get('/admin/pending-case-studies/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const csRes = await query(`SELECT * FROM nclex_pending_case_studies WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!csRes.rowCount) { notFound(res, 'Pending case study not found'); return }
    const cs = camelPendingCaseStudy(csRes.rows[0])
    const qRes = await query(
      `SELECT * FROM nclex_pending_questions WHERE pending_case_study_id = $1 ORDER BY item_number ASC NULLS LAST, created_at ASC`,
      [req.params.id]
    )
    ;(cs as any).questions = qRes.rows.map(camelPendingQuestion)
    ok(res, cs)
  } catch {
    serverError(res)
  }
})

router.put('/admin/pending-case-studies/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const r = await query(`SELECT * FROM nclex_pending_case_studies WHERE id = $1 LIMIT 1`, [req.params.id])
    if (!r.rowCount) { notFound(res, 'Pending case study not found'); return }
    const ex = r.rows[0]
    const b = req.body
    const upd = await query(
      `UPDATE nclex_pending_case_studies SET
          title = $1, scenario = $2, tabs = $3::jsonb, case_type = $4, updated_at = NOW()
        WHERE id = $5 RETURNING *`,
      [
        b.title ?? ex.title,
        b.scenario ?? ex.scenario,
        JSON.stringify(b.tabs !== undefined ? b.tabs : ex.tabs),
        b.caseType ?? ex.case_type,
        req.params.id,
      ]
    )
    ok(res, camelPendingCaseStudy(upd.rows[0]), 'Pending case study updated')
  } catch {
    serverError(res)
  }
})

router.post('/admin/pending-case-studies/:id/approve', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const result = await withTransaction(async (client) => {
      const csRes = await client(
        `SELECT * FROM nclex_pending_case_studies WHERE id = $1 LIMIT 1`, [req.params.id]
      )
      if (!csRes.rowCount) throw new Error('NOT_FOUND')
      const pcs = csRes.rows[0]

      // Create the live case study
      const newCsId = newId()
      await client(
        `INSERT INTO nclex_case_studies (id, title, scenario, tabs, case_type)
          VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [newCsId, pcs.title, pcs.scenario, JSON.stringify(pcs.tabs ?? []), pcs.case_type]
      )

      // Promote all pending questions to live, linked to the new case study
      const pqRes = await client(
        `SELECT * FROM nclex_pending_questions WHERE pending_case_study_id = $1`,
        [pcs.id]
      )
      const promoted: string[] = []
      for (const pq of pqRes.rows) {
        const qId = newId()
        await client(
          `INSERT INTO nclex_questions
              (id, bank, format, case_study_id, item_number, stem, stem_image,
               options, correct_answer, rationale, additional_info, rationale_image,
               topic, subtopic, difficulty, discrimination, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12,
                    $13, $14, $15, $16, $17::jsonb)`,
          [
            qId, pq.bank, pq.format, newCsId, pq.item_number, pq.stem, pq.stem_image,
            JSON.stringify(pq.options ?? []),
            JSON.stringify(pq.correct_answer),
            pq.rationale, pq.additional_info, pq.rationale_image,
            pq.topic, pq.subtopic, Number(pq.difficulty), Number(pq.discrimination),
            pq.metadata ? JSON.stringify(pq.metadata) : null,
          ]
        )
        await client(
          `UPDATE nclex_pending_questions SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
          [pq.id]
        )
        promoted.push(qId)
      }
      await client(
        `UPDATE nclex_pending_case_studies SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [pcs.id]
      )
      return { caseStudyId: newCsId, questionIds: promoted }
    })
    ok(res, result, 'Pending case study approved')
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') return notFound(res, 'Pending case study not found')
    console.error('[admin/pending-case-studies/:id/approve]', err)
    serverError(res)
  }
})

router.post('/admin/pending-case-studies/:id/reject', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    const { rejectionNote } = req.body
    const upd = await query(
      `UPDATE nclex_pending_case_studies
          SET status = 'REJECTED', rejection_note = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [rejectionNote ?? null, req.params.id]
    )
    if (!upd.rowCount) { notFound(res, 'Pending case study not found'); return }
    ok(res, camelPendingCaseStudy(upd.rows[0]), 'Pending case study rejected')
  } catch {
    serverError(res)
  }
})

router.delete('/admin/pending-case-studies/:id', async (req: AuthenticatedRequest, res) => {
  if (!requireAdminInline(req, res)) return
  try {
    await withTransaction(async (client) => {
      await client(`DELETE FROM nclex_pending_questions WHERE pending_case_study_id = $1`, [req.params.id])
      const r = await client(`DELETE FROM nclex_pending_case_studies WHERE id = $1`, [req.params.id])
      if (!r.rowCount) throw new Error('NOT_FOUND')
    })
    ok(res, null, 'Pending case study deleted')
  } catch (err: any) {
    if (err?.message === 'NOT_FOUND') return notFound(res, 'Pending case study not found')
    serverError(res)
  }
})

export default router
