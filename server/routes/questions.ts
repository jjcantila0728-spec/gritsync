import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const CONTENT_AREAS = [
  'safe_effective_care_environment',
  'health_promotion_and_maintenance',
  'psychosocial_integrity',
  'physiological_integrity',
]

const QUESTION_TYPES = [
  'traditional_mcq',
  'ngn_sata',
  'ngn_cloze',
  'ngn_matrix',
]

function isAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin'
}

// ─── Public: Payment Info ─────────────────────────────────────────────────────
router.get('/payment-info', async (_req, res) => {
  res.json({
    accounts: [
      { method: 'GCash', name: 'Joy Jeric Cantila', number: '09691533239' },
      { method: 'Maya', name: 'Joy Jeric Cantila', number: '09691533239' },
    ],
    note: 'Send payment and message admin with your proof of payment and reference number.',
  })
})

// ─── Questions CRUD ───────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      content_area,
      difficulty,
      question_type,
      is_ngn,
      search,
      page = '1',
      limit = '20',
      active_only = 'true',
    } = req.query as Record<string, string>

    const conditions: string[] = []
    const params: any[] = []
    let paramIdx = 1

    if (active_only === 'true') {
      conditions.push(`is_active = true`)
    }
    if (content_area && content_area !== 'all') {
      conditions.push(`content_area = $${paramIdx++}`)
      params.push(content_area)
    }
    if (difficulty && difficulty !== 'all') {
      conditions.push(`difficulty = $${paramIdx++}`)
      params.push(difficulty)
    }
    if (question_type && question_type !== 'all') {
      conditions.push(`question_type = $${paramIdx++}`)
      params.push(question_type)
    }
    if (is_ngn === 'true') {
      conditions.push(`is_ngn = true`)
    } else if (is_ngn === 'false') {
      conditions.push(`is_ngn = false`)
    }
    if (search) {
      conditions.push(`question_text ILIKE $${paramIdx++}`)
      params.push(`%${search}%`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const pageNum = parseInt(page) || 1
    const limitNum = Math.min(parseInt(limit) || 20, 200)
    const offset = (pageNum - 1) * limitNum

    const countResult = await query(
      `SELECT COUNT(*) FROM question_bank ${where}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    const result = await query(
      `SELECT id, question_text, question_type, content_area, subcategory,
              difficulty, cognitive_level, is_ngn, options, correct_answer,
              rationale, tags, is_active, created_at, updated_at
       FROM question_bank ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limitNum, offset]
    )

    res.json({
      questions: result.rows,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    })
  } catch (error: any) {
    console.error('Get questions error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  try {
    const {
      question_text,
      question_type,
      content_area,
      subcategory,
      difficulty,
      cognitive_level,
      is_ngn,
      options,
      correct_answer,
      rationale,
      tags,
      is_active = true,
    } = req.body

    if (!question_text || !question_type || !content_area || !difficulty) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const result = await query(
      `INSERT INTO question_bank
         (question_text, question_type, content_area, subcategory, difficulty,
          cognitive_level, is_ngn, options, correct_answer, rationale, tags, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        question_text,
        question_type,
        content_area,
        subcategory || null,
        difficulty,
        cognitive_level || null,
        is_ngn ?? false,
        JSON.stringify(options || []),
        JSON.stringify(correct_answer || {}),
        rationale || null,
        tags || null,
        is_active,
      ]
    )

    res.status(201).json(result.rows[0])
  } catch (error: any) {
    console.error('Create question error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  try {
    const { id } = req.params
    const {
      question_text,
      question_type,
      content_area,
      subcategory,
      difficulty,
      cognitive_level,
      is_ngn,
      options,
      correct_answer,
      rationale,
      tags,
      is_active,
    } = req.body

    const result = await query(
      `UPDATE question_bank SET
         question_text = COALESCE($1, question_text),
         question_type = COALESCE($2, question_type),
         content_area = COALESCE($3, content_area),
         subcategory = $4,
         difficulty = COALESCE($5, difficulty),
         cognitive_level = $6,
         is_ngn = COALESCE($7, is_ngn),
         options = COALESCE($8, options),
         correct_answer = COALESCE($9, correct_answer),
         rationale = $10,
         tags = $11,
         is_active = COALESCE($12, is_active),
         updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        question_text ?? null,
        question_type ?? null,
        content_area ?? null,
        subcategory ?? null,
        difficulty ?? null,
        cognitive_level ?? null,
        is_ngn ?? null,
        options ? JSON.stringify(options) : null,
        correct_answer ? JSON.stringify(correct_answer) : null,
        rationale ?? null,
        tags ?? null,
        is_active ?? null,
        id,
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' })
    }

    res.json(result.rows[0])
  } catch (error: any) {
    console.error('Update question error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  try {
    const { id } = req.params
    await query(`DELETE FROM question_bank WHERE id = $1`, [id])
    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete question error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── User Stats ───────────────────────────────────────────────────────────────
router.get('/user-stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id

    // Total questions in bank
    const bankResult = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_ngn = false) as total_classic,
         COUNT(*) FILTER (WHERE is_ngn = true) as total_ngn,
         COUNT(*) FILTER (WHERE question_type = 'ngn_sata') as total_sata
       FROM question_bank WHERE is_active = true`
    )

    // User's answered questions
    const answeredResult = await query(
      `SELECT
         COUNT(DISTINCT sr.question_id) as total_used,
         COUNT(DISTINCT sr.question_id) FILTER (WHERE sr.is_correct = true) as total_correct,
         COUNT(DISTINCT sr.question_id) FILTER (WHERE sr.is_correct = false) as total_incorrect
       FROM session_responses sr
       JOIN test_sessions ts ON sr.session_id = ts.id
       WHERE ts.user_id = $1 AND sr.answered_at IS NOT NULL`,
      [userId]
    )

    const bank = bankResult.rows[0]
    const answered = answeredResult.rows[0]

    const totalBank = parseInt(bank.total) || 0
    const totalClassic = parseInt(bank.total_classic) || 0
    const totalNgn = parseInt(bank.total_ngn) || 0
    const totalSata = parseInt(bank.total_sata) || 0
    const used = parseInt(answered.total_used) || 0
    const correct = parseInt(answered.total_correct) || 0
    const incorrect = parseInt(answered.total_incorrect) || 0
    const unused = Math.max(0, totalBank - used)

    res.json({
      total_questions: totalBank,
      total_classic: totalClassic,
      total_ngn: totalNgn,
      total_sata: totalSata,
      used,
      unused,
      correct,
      incorrect,
      omitted: 0,
    })
  } catch (error: any) {
    console.error('User stats error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── Session Routes ───────────────────────────────────────────────────────────
router.post('/session/start', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const {
      session_type = 'practice',
      mode = 'tutorial',
      test_type = 'mixed',
      pool = 'all',
      content_area = 'all',
      difficulty = 'all',
      question_type = 'all',
      is_ngn,
      question_count = 25,
    } = req.body

    const conditions: string[] = ['qb.is_active = true']
    const params: any[] = []
    let paramIdx = 1

    // Test type filter
    if (test_type === 'classic') {
      conditions.push(`qb.is_ngn = false`)
    } else if (test_type === 'ngn') {
      conditions.push(`qb.is_ngn = true`)
    }

    // Question type filter (SATA, NGN case studies, etc.)
    if (question_type === 'ngn_sata') {
      conditions.push(`qb.question_type = 'ngn_sata'`)
    } else if (question_type !== 'all') {
      conditions.push(`qb.question_type = $${paramIdx++}`)
      params.push(question_type)
    }

    if (content_area !== 'all') {
      conditions.push(`qb.content_area = $${paramIdx++}`)
      params.push(content_area)
    }

    if (difficulty !== 'all' && session_type === 'practice') {
      conditions.push(`qb.difficulty = $${paramIdx++}`)
      params.push(difficulty)
    }

    if (typeof is_ngn === 'boolean') {
      conditions.push(`qb.is_ngn = $${paramIdx++}`)
      params.push(is_ngn)
    }

    if (session_type === 'cat') {
      conditions.push(`qb.difficulty = 'medium'`)
    }

    // Pool filter
    if (pool === 'unused') {
      conditions.push(`
        qb.id NOT IN (
          SELECT DISTINCT sr.question_id
          FROM session_responses sr
          JOIN test_sessions ts ON sr.session_id = ts.id
          WHERE ts.user_id = $${paramIdx++} AND sr.answered_at IS NOT NULL
        )
      `)
      params.push(userId)
    } else if (pool === 'incorrect') {
      conditions.push(`
        qb.id IN (
          SELECT DISTINCT ON (sr.question_id) sr.question_id
          FROM session_responses sr
          JOIN test_sessions ts ON sr.session_id = ts.id
          WHERE ts.user_id = $${paramIdx++} AND sr.answered_at IS NOT NULL AND sr.is_correct = false
          ORDER BY sr.question_id, sr.answered_at DESC
        )
      `)
      params.push(userId)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    let limit = question_count

    if (session_type === 'readiness') limit = 75
    if (session_type === 'cat') limit = 85

    const questionsResult = await query(
      `SELECT qb.id, qb.question_text, qb.question_type, qb.content_area, qb.subcategory,
              qb.difficulty, qb.cognitive_level, qb.is_ngn, qb.options, qb.tags
       FROM question_bank qb ${where}
       ORDER BY RANDOM()
       LIMIT $${paramIdx}`,
      [...params, limit]
    )

    if (questionsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No questions found matching the criteria. Try a different filter.' })
    }

    const totalQuestions = questionsResult.rows.length

    const sessionResult = await query(
      `INSERT INTO test_sessions (user_id, session_type, total_questions, settings)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        userId,
        session_type,
        totalQuestions,
        JSON.stringify({ mode, test_type, pool, content_area, difficulty, question_type, is_ngn }),
      ]
    )

    const sessionId = sessionResult.rows[0].id

    const insertValues = questionsResult.rows
      .map((_q: any, i: number) => `($1, $${i + 2}, ${i + 1})`)
      .join(', ')

    const insertParams = [sessionId, ...questionsResult.rows.map((q: any) => q.id)]
    await query(
      `INSERT INTO session_responses (session_id, question_id, question_order) VALUES ${insertValues}`,
      insertParams
    )

    res.status(201).json({
      session_id: sessionId,
      total_questions: totalQuestions,
      mode,
      test_type,
      questions: questionsResult.rows,
    })
  } catch (error: any) {
    console.error('Start session error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get session questions (for exam/review mode)
router.get('/session/:id/questions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    const sessionId = parseInt(req.params.id)

    const sessionResult = await query(
      `SELECT * FROM test_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    )

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const responsesResult = await query(
      `SELECT sr.id as response_id, sr.question_id, sr.question_order, sr.user_answer,
              sr.is_correct, sr.time_spent, sr.answered_at,
              COALESCE(sr.marked_for_review, false) as marked_for_review,
              qb.question_text, qb.question_type, qb.content_area, qb.subcategory,
              qb.difficulty, qb.cognitive_level, qb.is_ngn, qb.options,
              qb.correct_answer, qb.rationale, qb.tags
       FROM session_responses sr
       JOIN question_bank qb ON sr.question_id = qb.id
       WHERE sr.session_id = $1
       ORDER BY sr.question_order`,
      [sessionId]
    )

    res.json({
      session: sessionResult.rows[0],
      questions: responsesResult.rows,
    })
  } catch (error: any) {
    console.error('Get session questions error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Submit answer
router.post('/session/:id/answer', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    const sessionId = parseInt(req.params.id)
    const { question_id, user_answer, time_spent = 0 } = req.body

    const sessionResult = await query(
      `SELECT * FROM test_sessions WHERE id = $1 AND user_id = $2 AND status = 'in_progress'`,
      [sessionId, userId]
    )

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or already completed' })
    }

    const questionResult = await query(
      `SELECT correct_answer, rationale, question_type, is_ngn, difficulty,
              content_area, subcategory, cognitive_level, tags FROM question_bank WHERE id = $1`,
      [question_id]
    )

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' })
    }

    const question = questionResult.rows[0]
    const correctAnswer = question.correct_answer

    let is_correct = false

    if (question.question_type === 'traditional_mcq') {
      is_correct = user_answer?.value === correctAnswer?.value
    } else if (question.question_type === 'ngn_sata') {
      const userVals = (user_answer?.values || []).sort()
      const correctVals = (correctAnswer?.values || []).sort()
      is_correct = JSON.stringify(userVals) === JSON.stringify(correctVals)
    } else if (question.question_type === 'ngn_cloze') {
      const userVals = user_answer?.values || {}
      const correctVals = correctAnswer?.values || {}
      is_correct = JSON.stringify(userVals) === JSON.stringify(correctVals)
    } else if (question.question_type === 'ngn_matrix') {
      const userCells = (user_answer?.cells || []).map((c: number[]) => c.join(',')).sort()
      const correctCells = (correctAnswer?.cells || []).map((c: number[]) => c.join(',')).sort()
      is_correct = JSON.stringify(userCells) === JSON.stringify(correctCells)
    }

    // Try to update with marked_for_review column (may not exist yet, handle gracefully)
    try {
      await query(
        `UPDATE session_responses
         SET user_answer = $1, is_correct = $2, time_spent = $3, answered_at = NOW()
         WHERE session_id = $4 AND question_id = $5`,
        [JSON.stringify(user_answer), is_correct, time_spent, sessionId, question_id]
      )
    } catch {
      await query(
        `UPDATE session_responses
         SET user_answer = $1, is_correct = $2, time_spent = $3, answered_at = NOW()
         WHERE session_id = $4 AND question_id = $5`,
        [JSON.stringify(user_answer), is_correct, time_spent, sessionId, question_id]
      )
    }

    const session = sessionResult.rows[0]
    const newAnswered = session.questions_answered + 1
    const newCorrect = session.correct_answers + (is_correct ? 1 : 0)
    const isComplete = newAnswered >= session.total_questions

    // CAT adaptive difficulty with 3-tier logic
    let catNextDifficulty: string | null = null
    if (session.session_type === 'cat' && !isComplete) {
      const settings = session.settings || {}
      const currentDifficulty = settings.cat_current_difficulty || 'medium'
      const streak = settings.cat_streak || 0
      const newStreak = is_correct ? Math.max(0, streak) + 1 : Math.min(0, streak) - 1

      if (newStreak >= 2) {
        catNextDifficulty = currentDifficulty === 'easy' ? 'medium' : 'hard'
      } else if (newStreak <= -2) {
        catNextDifficulty = currentDifficulty === 'hard' ? 'medium' : 'easy'
      } else {
        catNextDifficulty = currentDifficulty
      }

      await query(
        `UPDATE test_sessions
         SET settings = settings || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify({ cat_current_difficulty: catNextDifficulty, cat_streak: newStreak }), sessionId]
      )
    }

    if (isComplete) {
      const score = (newCorrect / session.total_questions) * 100
      await query(
        `UPDATE test_sessions
         SET questions_answered = $1, correct_answers = $2, score = $3,
             status = 'completed', time_completed = NOW()
         WHERE id = $4`,
        [newAnswered, newCorrect, score, sessionId]
      )
    } else {
      await query(
        `UPDATE test_sessions
         SET questions_answered = $1, correct_answers = $2
         WHERE id = $3`,
        [newAnswered, newCorrect, sessionId]
      )
    }

    res.json({
      is_correct,
      correct_answer: correctAnswer,
      rationale: question.rationale,
      difficulty: question.difficulty,
      content_area: question.content_area,
      subcategory: question.subcategory,
      cognitive_level: question.cognitive_level,
      tags: question.tags,
      session_complete: isComplete,
      questions_answered: newAnswered,
      correct_answers: newCorrect,
      cat_next_difficulty: catNextDifficulty,
    })
  } catch (error: any) {
    console.error('Submit answer error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Mark question for review
router.post('/session/:id/mark-review', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    const sessionId = parseInt(req.params.id)
    const { question_id, marked } = req.body

    // Ensure column exists
    await query(
      `ALTER TABLE session_responses ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT false`
    ).catch(() => {})

    const sessionResult = await query(
      `SELECT id FROM test_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    )
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await query(
      `UPDATE session_responses SET marked_for_review = $1
       WHERE session_id = $2 AND question_id = $3`,
      [!!marked, sessionId, question_id]
    )

    res.json({ success: true })
  } catch (error: any) {
    console.error('Mark review error:', error)
    res.status(500).json({ error: error.message })
  }
})

// End/abandon session
router.post('/session/:id/end', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    const sessionId = parseInt(req.params.id)

    const sessionResult = await query(
      `SELECT * FROM test_sessions WHERE id = $1 AND user_id = $2 AND status = 'in_progress'`,
      [sessionId, userId]
    )
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const session = sessionResult.rows[0]
    const score = session.total_questions > 0
      ? (session.correct_answers / session.total_questions) * 100
      : 0

    await query(
      `UPDATE test_sessions
       SET status = 'completed', score = $1, time_completed = NOW()
       WHERE id = $2`,
      [score, sessionId]
    )

    res.json({ success: true, session_id: sessionId })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/session/:id/results', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    const sessionId = parseInt(req.params.id)

    const sessionResult = await query(
      `SELECT * FROM test_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    )

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const responsesResult = await query(
      `SELECT sr.*, qb.question_text, qb.question_type, qb.content_area,
              qb.difficulty, qb.options, qb.correct_answer, qb.rationale
       FROM session_responses sr
       JOIN question_bank qb ON sr.question_id = qb.id
       WHERE sr.session_id = $1
       ORDER BY sr.question_order`,
      [sessionId]
    )

    const session = sessionResult.rows[0]
    const responses = responsesResult.rows

    const byContentArea: Record<string, { total: number; correct: number }> = {}
    const byDifficulty: Record<string, { total: number; correct: number }> = {}

    for (const r of responses) {
      if (!r.is_correct && r.is_correct !== false) continue
      if (!byContentArea[r.content_area]) byContentArea[r.content_area] = { total: 0, correct: 0 }
      if (!byDifficulty[r.difficulty]) byDifficulty[r.difficulty] = { total: 0, correct: 0 }
      byContentArea[r.content_area].total++
      byDifficulty[r.difficulty].total++
      if (r.is_correct) {
        byContentArea[r.content_area].correct++
        byDifficulty[r.difficulty].correct++
      }
    }

    res.json({
      session,
      responses,
      breakdown: { by_content_area: byContentArea, by_difficulty: byDifficulty },
    })
  } catch (error: any) {
    console.error('Get results error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/my-sessions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const status = req.query.status as string

    let where = `WHERE ts.user_id = $1`
    const params: any[] = [userId]

    if (status && status !== 'all') {
      where += ` AND ts.status = $2`
      params.push(status)
    }

    const result = await query(
      `SELECT ts.* FROM test_sessions ts ${where}
       ORDER BY ts.time_started DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const countResult = await query(
      `SELECT COUNT(*) FROM question_bank WHERE is_active = true`
    )
    const byType = await query(
      `SELECT question_type, COUNT(*) as count FROM question_bank WHERE is_active = true GROUP BY question_type`
    )
    const byArea = await query(
      `SELECT content_area, COUNT(*) as count FROM question_bank WHERE is_active = true GROUP BY content_area`
    )
    const byDiff = await query(
      `SELECT difficulty, COUNT(*) as count FROM question_bank WHERE is_active = true GROUP BY difficulty`
    )
    res.json({
      total: parseInt(countResult.rows[0].count),
      by_type: byType.rows,
      by_content_area: byArea.rows,
      by_difficulty: byDiff.rows,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Subscription routes ──────────────────────────────────────────────────────

router.get('/subscription/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const today = new Date().toISOString().split('T')[0]

    const subResult = await query(
      `SELECT * FROM nclex_subscriptions
       WHERE user_id = $1 AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    const subscription = subResult.rows[0] || null

    const usageResult = await query(
      `SELECT questions_answered FROM nclex_daily_usage
       WHERE user_id = $1 AND usage_date = $2`,
      [userId, today]
    )
    const questionsToday = usageResult.rows[0]?.questions_answered || 0

    const plan = subscription?.plan || 'free'
    const dailyLimit = plan === 'free' ? 25 : null

    res.json({
      plan,
      status: subscription?.status || 'active',
      expires_at: subscription?.expires_at || null,
      questions_today: questionsToday,
      daily_limit: dailyLimit,
      can_answer: dailyLimit === null || questionsToday < dailyLimit,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscription/track-usage', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const today = new Date().toISOString().split('T')[0]

    await query(
      `INSERT INTO nclex_daily_usage (user_id, usage_date, questions_answered)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET questions_answered = nclex_daily_usage.questions_answered + 1,
                     updated_at = NOW()`,
      [userId, today]
    )

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Admin: list all subscriptions
router.get('/subscription/admin/list', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const result = await query(
      `SELECT s.*,
              u.email as user_email,
              u.first_name,
              u.last_name,
              u.grit_id,
              du.questions_answered as questions_today
       FROM nclex_subscriptions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN nclex_daily_usage du ON s.user_id = du.user_id
         AND du.usage_date = CURRENT_DATE
       ORDER BY s.created_at DESC`
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/subscription/admin/users', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.grit_id,
              s.plan, s.status, s.expires_at, s.created_at as subscribed_at,
              COALESCE(du.questions_answered, 0) as questions_today,
              COALESCE((
                SELECT SUM(questions_answered)
                FROM nclex_daily_usage
                WHERE user_id = u.id
              ), 0) as questions_total
       FROM users u
       LEFT JOIN nclex_subscriptions s ON s.user_id = u.id
         AND s.status = 'active'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       LEFT JOIN nclex_daily_usage du ON u.id = du.user_id
         AND du.usage_date = CURRENT_DATE
       WHERE u.role = 'client'
       ORDER BY u.created_at DESC`
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscription/admin/assign', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const { user_id, plan, payment_amount, payment_currency, payment_reference, payment_method, notes } = req.body

    if (!user_id || !plan) return res.status(400).json({ error: 'user_id and plan are required' })

    let expiresAt: string | null = null
    if (plan === 'premium') {
      const d = new Date()
      d.setMonth(d.getMonth() + 2)
      expiresAt = d.toISOString()
    } else if (plan === 'vip') {
      const d = new Date()
      d.setMonth(d.getMonth() + 6)
      expiresAt = d.toISOString()
    }

    await query(
      `UPDATE nclex_subscriptions SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [user_id]
    )

    const result = await query(
      `INSERT INTO nclex_subscriptions
         (user_id, plan, status, expires_at, payment_amount, payment_currency,
          payment_reference, payment_method, notes, activated_by)
       VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user_id, plan, expiresAt, payment_amount || null,
       payment_currency || 'PHP', payment_reference || null,
       payment_method || null, notes || null, req.user?.id]
    )

    res.json(result.rows[0])
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscription/admin/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const { subscription_id } = req.body
    if (!subscription_id) return res.status(400).json({ error: 'subscription_id is required' })

    await query(
      `UPDATE nclex_subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [subscription_id]
    )

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/subscription/admin/analytics', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const summary = await query(
      `SELECT
         COUNT(DISTINCT CASE WHEN s.plan = 'free' OR s.id IS NULL THEN u.id END) as free_users,
         COUNT(DISTINCT CASE WHEN s.plan = 'premium' AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW()) THEN u.id END) as premium_users,
         COUNT(DISTINCT CASE WHEN s.plan = 'vip' AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW()) THEN u.id END) as vip_users,
         COALESCE(SUM(du.questions_answered), 0) as questions_today
       FROM users u
       LEFT JOIN nclex_subscriptions s ON u.id = s.user_id AND s.status = 'active'
       LEFT JOIN nclex_daily_usage du ON u.id = du.user_id AND du.usage_date = CURRENT_DATE
       WHERE u.role = 'client'`
    )

    const daily = await query(
      `SELECT usage_date, SUM(questions_answered) as total
       FROM nclex_daily_usage
       WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY usage_date
       ORDER BY usage_date DESC`
    )

    res.json({
      summary: summary.rows[0],
      daily_usage: daily.rows,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Seed Questions (Admin only) ──────────────────────────────────────────────
router.post('/seed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  try {
    const existing = await query(`SELECT COUNT(*) FROM question_bank WHERE is_active = true`)
    if (parseInt(existing.rows[0].count) > 10) {
      return res.json({ message: 'Question bank already has questions', count: parseInt(existing.rows[0].count) })
    }

    const questions = getSeedQuestions()
    let inserted = 0

    for (const q of questions) {
      await query(
        `INSERT INTO question_bank
           (question_text, question_type, content_area, subcategory, difficulty,
            cognitive_level, is_ngn, options, correct_answer, rationale, tags, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         ON CONFLICT DO NOTHING`,
        [
          q.question_text, q.question_type, q.content_area, q.subcategory || null,
          q.difficulty, q.cognitive_level || 'Application', q.is_ngn,
          JSON.stringify(q.options), JSON.stringify(q.correct_answer),
          q.rationale, q.tags || null,
        ]
      )
      inserted++
    }

    res.json({ message: 'Seeded successfully', inserted })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

function getSeedQuestions() {
  return [
    // ── Safe & Effective Care ──────────────────────────────────────────────────
    {
      question_text: 'A nurse is preparing to administer medications to four clients. Which client should the nurse assess first?',
      question_type: 'traditional_mcq',
      content_area: 'safe_effective_care_environment',
      subcategory: 'Management of Care',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'A client with type 2 diabetes who has a blood glucose of 180 mg/dL' },
        { id: 'b', text: 'A client with hypertension who has a blood pressure of 150/90 mmHg' },
        { id: 'c', text: 'A client receiving IV heparin who reports sudden onset of chest pain and dyspnea' },
        { id: 'd', text: 'A client post-appendectomy on day 2 who reports incision pain of 4/10' },
      ],
      correct_answer: { value: 'c' },
      rationale: 'Chest pain and dyspnea in a client receiving heparin suggests a potential pulmonary embolism or heparin-induced complication, which is life-threatening and requires immediate assessment. The other clients have findings that are concerning but not immediately life-threatening.',
      tags: 'priority,safety,heparin',
    },
    {
      question_text: 'A nurse is preparing to perform a sterile wound dressing change. In which order should the nurse perform these steps? Place in correct order.',
      question_type: 'traditional_mcq',
      content_area: 'safe_effective_care_environment',
      subcategory: 'Safety and Infection Control',
      difficulty: 'easy',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Don sterile gloves and open sterile supplies' },
        { id: 'b', text: 'Perform hand hygiene and open the sterile field' },
        { id: 'c', text: 'Remove old dressing with clean gloves and discard' },
        { id: 'd', text: 'Apply new dressing and secure with tape' },
      ],
      correct_answer: { value: 'c' },
      rationale: 'The correct sequence for a sterile dressing change begins with removing the old dressing using clean gloves to prevent contamination of the sterile field. Hand hygiene is performed before opening the sterile field, sterile gloves are donned before applying the new dressing. Removing the old dressing first is the initial step.',
      tags: 'sterile technique,wound care,infection control',
    },
    {
      question_text: 'A nurse receives a telephone order from a physician for morphine 4 mg IV every 4 hours PRN for pain. Which action should the nurse take?',
      question_type: 'traditional_mcq',
      content_area: 'safe_effective_care_environment',
      subcategory: 'Management of Care',
      difficulty: 'easy',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Administer the medication as ordered since a physician ordered it' },
        { id: 'b', text: 'Write the order, read it back to the physician, and have the physician countersign within 24 hours' },
        { id: 'c', text: 'Refuse to accept the order and request a written order' },
        { id: 'd', text: 'Document the order and have another nurse witness the read-back' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'Telephone orders require the nurse to write the order, then read it back to the prescriber to verify accuracy (SBAR communication). The prescriber must countersign the order within the timeframe specified by facility policy, typically 24 hours. This is required for controlled substances per Joint Commission standards.',
      tags: 'medication safety,communication,telephone orders',
    },
    {
      question_text: 'A nurse notes that a client\'s identification band is missing. Which action should the nurse take before administering medications?',
      question_type: 'traditional_mcq',
      content_area: 'safe_effective_care_environment',
      subcategory: 'Safety and Infection Control',
      difficulty: 'easy',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Ask the client to state their name before giving the medication' },
        { id: 'b', text: 'Apply a new identification band before administering medications' },
        { id: 'c', text: 'Check the room number against the medication administration record' },
        { id: 'd', text: 'Have a family member confirm the client\'s identity' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'The nurse must apply a new identification band before administering medications. Using at least two patient identifiers (name and date of birth or MRN) is required by The Joint Commission\'s National Patient Safety Goals. Verbal confirmation alone or checking the room number are not sufficient identifiers.',
      tags: 'patient identification,medication safety,NPSG',
    },
    // ── Health Promotion ──────────────────────────────────────────────────────
    {
      question_text: 'A nurse is teaching a 45-year-old male client about colorectal cancer screening. Which recommendation should the nurse include?',
      question_type: 'traditional_mcq',
      content_area: 'health_promotion_and_maintenance',
      subcategory: 'Health Screening',
      difficulty: 'easy',
      cognitive_level: 'Knowledge',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Begin annual fecal occult blood testing at age 50' },
        { id: 'b', text: 'Begin colonoscopy screening at age 45 for average-risk individuals' },
        { id: 'c', text: 'Colonoscopy is only indicated if there is a family history of colon cancer' },
        { id: 'd', text: 'Annual sigmoidoscopy is the preferred screening method' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'Current guidelines from the American Cancer Society and USPSTF recommend that average-risk individuals begin colorectal cancer screening at age 45. Colonoscopy every 10 years is one of the recommended screening options. The previous recommendation of starting at age 50 has been updated.',
      tags: 'cancer screening,health promotion,colorectal',
    },
    {
      question_text: 'A nurse is providing teaching to a pregnant client about nutrition during the first trimester. Which statement by the client indicates understanding?',
      question_type: 'traditional_mcq',
      content_area: 'health_promotion_and_maintenance',
      subcategory: 'Ante/Intra/Postpartum and Newborn Care',
      difficulty: 'easy',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: '"I should increase my caloric intake by 500 calories per day during the first trimester."' },
        { id: 'b', text: '"I will take 400-800 mcg of folic acid daily to prevent neural tube defects."' },
        { id: 'c', text: '"I should avoid all fish during pregnancy due to mercury concerns."' },
        { id: 'd', text: '"I need to double my iron intake starting in the first trimester."' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'Folic acid 400-800 mcg daily is recommended during the first trimester (and ideally before conception) to prevent neural tube defects such as spina bifida and anencephaly. The additional caloric intake of 300-350 calories is recommended in the second and third trimesters, not the first. Low-mercury fish can be consumed in moderation.',
      tags: 'pregnancy,nutrition,folic acid,prenatal',
    },
    // ── Psychosocial Integrity ────────────────────────────────────────────────
    {
      question_text: 'A client tells the nurse, "I\'ve been thinking about ending my life. I have a plan to use my husband\'s gun." Which action should the nurse take first?',
      question_type: 'traditional_mcq',
      content_area: 'psychosocial_integrity',
      subcategory: 'Mental Health Concepts',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Contact the client\'s husband immediately to secure the firearm' },
        { id: 'b', text: 'Ask the client about the details of the plan and their intent' },
        { id: 'c', text: 'Ensure client safety and notify the provider and charge nurse immediately' },
        { id: 'd', text: 'Document the statement and continue with the assessment' },
      ],
      correct_answer: { value: 'c' },
      rationale: 'Safety is the priority. When a client expresses suicidal ideation with a specific plan, the nurse must immediately ensure the client\'s safety (one-to-one supervision, safe environment) and notify the provider and charge nurse. The client has identified a specific method (gun) and means (husband\'s gun), which increases risk. Contacting the husband may be appropriate but is not the first action.',
      tags: 'suicide,mental health,safety,priority',
    },
    {
      question_text: 'A nurse is caring for a client with schizophrenia who refuses to take their antipsychotic medication and says, "I don\'t need these pills. The TV is sending me messages." Which response by the nurse is most therapeutic?',
      question_type: 'traditional_mcq',
      content_area: 'psychosocial_integrity',
      subcategory: 'Mental Health Concepts',
      difficulty: 'medium',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: '"That is not true. The TV cannot send messages. You need your medication."' },
        { id: 'b', text: '"I understand that you believe the TV is sending you messages. I don\'t see it that way, but I\'m concerned about your health."' },
        { id: 'c', text: '"If you don\'t take your medication, I will have to restrain you."' },
        { id: 'd', text: '"Let\'s turn off the TV so it can\'t bother you anymore."' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'The most therapeutic response acknowledges the client\'s perception without reinforcing or arguing against the delusion. This approach maintains therapeutic rapport while gently introducing reality. Arguing against the delusion (choice A) or making threats (choice C) are not therapeutic. Turning off the TV (choice D) reinforces the delusion.',
      tags: 'schizophrenia,therapeutic communication,delusions',
    },
    {
      question_text: 'A nurse is caring for a client with terminal cancer who says, "I know I\'m going to die soon. I just want to make sure my children are taken care of." Which stage of grief does this statement reflect according to Kübler-Ross?',
      question_type: 'traditional_mcq',
      content_area: 'psychosocial_integrity',
      subcategory: 'Grief and Loss',
      difficulty: 'easy',
      cognitive_level: 'Knowledge',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Anger' },
        { id: 'b', text: 'Bargaining' },
        { id: 'c', text: 'Depression' },
        { id: 'd', text: 'Acceptance' },
      ],
      correct_answer: { value: 'd' },
      rationale: 'The acceptance stage of the Kübler-Ross grief model is characterized by the client coming to terms with their mortality and focusing on making arrangements and ensuring loved ones are cared for. This is a peaceful stage where the client is not fighting or depressed, but rather preparing for death with clarity.',
      tags: 'grief,Kübler-Ross,end of life,terminal illness',
    },
    // ── Physiological Integrity ──────────────────────────────────────────────
    {
      question_text: 'A nurse is caring for a client with a nasogastric tube. Which finding requires the nurse to take immediate action?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Basic Care and Comfort',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'pH of 4.5 on gastric aspirate' },
        { id: 'b', text: 'Client reports mild nasal discomfort' },
        { id: 'c', text: 'Tube is taped to the nose with visible markings at 45 cm' },
        { id: 'd', text: 'Sudden onset of coughing and respiratory distress during tube feeding' },
      ],
      correct_answer: { value: 'd' },
      rationale: 'Sudden coughing and respiratory distress during tube feeding indicates possible aspiration or misplacement of the NG tube into the respiratory tract. This is a life-threatening emergency requiring immediate cessation of feeding and assessment of tube placement. A pH of 4.5 indicates correct gastric placement. Nasal discomfort is expected.',
      tags: 'nasogastric tube,aspiration,airway,emergency',
    },
    {
      question_text: 'A nurse is reviewing lab results for a client with chronic kidney disease. Which finding should the nurse report to the provider immediately?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Reduction of Risk Potential',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Serum creatinine 2.1 mg/dL (baseline 1.9 mg/dL)' },
        { id: 'b', text: 'Serum potassium 6.8 mEq/L' },
        { id: 'c', text: 'Hemoglobin 10.2 g/dL' },
        { id: 'd', text: 'Urine output 35 mL/hr' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'A serum potassium of 6.8 mEq/L represents severe hyperkalemia (normal 3.5-5.0 mEq/L) and is immediately life-threatening due to the risk of fatal cardiac dysrhythmias. In chronic kidney disease, the kidneys cannot excrete excess potassium. The other findings are concerning but not as immediately dangerous.',
      tags: 'hyperkalemia,CKD,electrolytes,critical values',
    },
    {
      question_text: 'A nurse is caring for a client who is 24 hours post-op following a total knee replacement. The client reports sudden onset of left calf pain, warmth, and redness. Which action should the nurse take first?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Physiological Adaptation',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Apply warm compresses to the affected calf' },
        { id: 'b', text: 'Elevate the leg and massage the calf' },
        { id: 'c', text: 'Notify the provider and avoid massaging the area' },
        { id: 'd', text: 'Ambulate the client to promote circulation' },
      ],
      correct_answer: { value: 'c' },
      rationale: 'The client\'s symptoms (calf pain, warmth, redness after orthopedic surgery) are classic signs of deep vein thrombosis (DVT). The nurse should notify the provider immediately and avoid massaging the area, which could dislodge a clot and cause pulmonary embolism. Ambulation and massage are contraindicated with suspected DVT.',
      tags: 'DVT,post-op,thrombosis,complications',
    },
    {
      question_text: 'A nurse is caring for a client receiving a blood transfusion. Thirty minutes into the transfusion, the client develops fever (38.9°C), chills, and back pain. Which action should the nurse take first?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Pharmacological and Parenteral Therapies',
      difficulty: 'hard',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Slow the transfusion rate and notify the provider' },
        { id: 'b', text: 'Stop the transfusion immediately and keep the IV line open with normal saline' },
        { id: 'c', text: 'Administer diphenhydramine and continue the transfusion' },
        { id: 'd', text: 'Obtain blood cultures and send the blood bag to the blood bank' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'Fever, chills, and back pain during a blood transfusion are signs of an acute hemolytic transfusion reaction, which is life-threatening. The priority action is to immediately stop the transfusion and maintain IV access with normal saline (not the original tubing to prevent infusing more incompatible blood). The provider, blood bank, and charge nurse are then notified. Slowing the rate is not appropriate for a hemolytic reaction.',
      tags: 'blood transfusion,hemolytic reaction,emergency,blood product',
    },
    {
      question_text: 'A client with asthma is prescribed a short-acting beta-2 agonist (SABA) and an inhaled corticosteroid (ICS). Which statement by the client indicates they need further teaching?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Pharmacological and Parenteral Therapies',
      difficulty: 'medium',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: '"I use my albuterol rescue inhaler when I have sudden shortness of breath."' },
        { id: 'b', text: '"I rinse my mouth after using my corticosteroid inhaler."' },
        { id: 'c', text: '"I use my corticosteroid inhaler every day even when I feel fine."' },
        { id: 'd', text: '"I use my corticosteroid inhaler first, then my albuterol, when I have an attack."' },
      ],
      correct_answer: { value: 'd' },
      rationale: 'During an acute asthma attack, the short-acting bronchodilator (albuterol/SABA) should be used first to open the airways, followed by the corticosteroid if needed. Using the corticosteroid first during an attack delays the rapid bronchodilation needed. The corticosteroid is a controller medication used daily for prevention, not quick relief.',
      tags: 'asthma,inhaler technique,bronchodilator,corticosteroid',
    },
    // ── NGN SATA Questions ────────────────────────────────────────────────────
    {
      question_text: 'A nurse is caring for a client with heart failure who is receiving furosemide (Lasix). Which assessments should the nurse perform? Select all that apply.',
      question_type: 'ngn_sata',
      content_area: 'physiological_integrity',
      subcategory: 'Pharmacological and Parenteral Therapies',
      difficulty: 'medium',
      cognitive_level: 'Application',
      is_ngn: true,
      options: [
        { id: 'a', text: 'Monitor serum potassium levels' },
        { id: 'b', text: 'Assess daily weight' },
        { id: 'c', text: 'Monitor blood glucose levels' },
        { id: 'd', text: 'Assess urine output' },
        { id: 'e', text: 'Monitor for signs of ototoxicity' },
        { id: 'f', text: 'Check liver function tests daily' },
      ],
      correct_answer: { values: ['a', 'b', 'd', 'e'] },
      rationale: 'Furosemide is a loop diuretic. Key monitoring includes: (A) potassium levels — furosemide causes hypokalemia; (B) daily weight — best indicator of fluid status changes; (D) urine output — to evaluate diuretic effectiveness; (E) ototoxicity — a known adverse effect of loop diuretics, especially at high doses. Blood glucose and liver function tests are not primary concerns with furosemide.',
      tags: 'furosemide,diuretics,heart failure,SATA,monitoring',
    },
    {
      question_text: 'A nurse is assessing a client with suspected myocardial infarction (MI). Which findings are consistent with an acute MI? Select all that apply.',
      question_type: 'ngn_sata',
      content_area: 'physiological_integrity',
      subcategory: 'Physiological Adaptation',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: true,
      options: [
        { id: 'a', text: 'Chest pain radiating to the left arm and jaw' },
        { id: 'b', text: 'Diaphoresis and nausea' },
        { id: 'c', text: 'Elevated troponin levels' },
        { id: 'd', text: 'ST-segment elevation on ECG' },
        { id: 'e', text: 'Bounding radial pulses' },
        { id: 'f', text: 'Bradycardia below 60 bpm' },
      ],
      correct_answer: { values: ['a', 'b', 'c', 'd'] },
      rationale: 'Classic MI findings include: (A) chest pain radiating to the arm, jaw, or shoulder; (B) diaphoresis and nausea due to sympathetic nervous system activation; (C) elevated troponin (most sensitive/specific cardiac biomarker); (D) ST-segment elevation indicating myocardial injury. Bounding pulses and bradycardia are not typical MI findings.',
      tags: 'MI,cardiac,SATA,troponin,ECG',
    },
    {
      question_text: 'A nurse is caring for a child with eczema. Which of the following findings should the nurse expect? Select all that apply.',
      question_type: 'ngn_sata',
      content_area: 'physiological_integrity',
      subcategory: 'Basic Care and Comfort',
      difficulty: 'easy',
      cognitive_level: 'Knowledge',
      is_ngn: true,
      options: [
        { id: 'a', text: 'Erythema' },
        { id: 'b', text: 'Pruritus' },
        { id: 'c', text: 'Papules' },
        { id: 'd', text: 'Skin ulcers' },
        { id: 'e', text: 'Purpura' },
      ],
      correct_answer: { values: ['a', 'b', 'c'] },
      rationale: 'Eczema (atopic dermatitis) presents with: (A) erythema — superficial reddening of the skin; (B) pruritus — intense itching is a hallmark symptom; (C) papules — raised skin lesions less than 1 cm. Skin ulcers (D) are not characteristic of eczema. Purpura (E) refers to purple spots from bleeding under the skin and is associated with vascular/hematologic conditions, not eczema.',
      tags: 'eczema,dermatology,SATA,pediatric',
    },
    {
      question_text: 'A nurse is developing a care plan for a client with a hearing impairment. Which interventions should the nurse include? Select all that apply.',
      question_type: 'ngn_sata',
      content_area: 'safe_effective_care_environment',
      subcategory: 'Management of Care',
      difficulty: 'easy',
      cognitive_level: 'Application',
      is_ngn: true,
      options: [
        { id: 'a', text: 'Ensure that the room is well lit when communicating with the client' },
        { id: 'b', text: 'Use non-verbal forms of communication like gestures and sign language, if applicable' },
        { id: 'c', text: 'Speak loudly and shout when communicating with the client' },
        { id: 'd', text: 'Face the client directly when speaking' },
        { id: 'e', text: 'Provide written information as needed' },
      ],
      correct_answer: { values: ['a', 'b', 'd', 'e'] },
      rationale: 'For clients with hearing impairment: (A) good lighting helps with lip reading; (B) non-verbal communication supplements verbal; (D) facing the client directly allows lip reading; (E) written information ensures comprehension. Shouting (C) distorts speech sounds and makes it harder to understand — speak clearly at a normal volume instead.',
      tags: 'hearing impairment,communication,SATA,accessibility',
    },
    // ── NGN Cloze Questions ───────────────────────────────────────────────────
    {
      question_text: 'The nurse is caring for a client with type 1 diabetes who is complaining of weakness, sweating, and confusion. The client\'s blood glucose is 48 mg/dL. Complete the following statement.',
      question_type: 'ngn_cloze',
      content_area: 'physiological_integrity',
      subcategory: 'Pharmacological and Parenteral Therapies',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: true,
      options: {
        stem: 'The client is experiencing [1] and the priority nursing intervention is to administer [2].',
        blanks: [
          { id: '1', choices: ['hypoglycemia', 'hyperglycemia', 'diabetic ketoacidosis', 'hyperosmolar syndrome'] },
          { id: '2', choices: ['15-20g of fast-acting carbohydrates orally', 'insulin subcutaneously', 'glucagon IM injection', 'IV normal saline bolus'] },
        ],
      },
      correct_answer: { values: { '1': 'hypoglycemia', '2': '15-20g of fast-acting carbohydrates orally' } },
      rationale: 'A blood glucose of 48 mg/dL (normal 70-99 mg/dL fasting) combined with the classic Whipple\'s triad (symptoms of hypoglycemia, low blood glucose, and relief with glucose) indicates hypoglycemia. For a conscious client who can swallow, the 15-20g rule of fast-acting carbohydrates orally is the first-line treatment. Insulin would worsen hypoglycemia. Glucagon is used for unconscious patients.',
      tags: 'hypoglycemia,diabetes,NGN,cloze',
    },
    {
      question_text: 'The nurse cares for a client who arrived at the emergency department complaining of generalized weakness.',
      question_type: 'ngn_cloze',
      content_area: 'physiological_integrity',
      subcategory: 'Physiological Adaptation',
      difficulty: 'hard',
      cognitive_level: 'Analysis',
      is_ngn: true,
      options: {
        stem: 'The client is at highest risk for developing [1] based on the client\'s [2].',
        blanks: [
          { id: '1', choices: ['diabetic ketoacidosis', 'hyperosmolar hyperglycemic state', 'hypoglycemia', 'metabolic alkalosis'] },
          { id: '2', choices: ['positive serum ketones', 'blood glucose of 320 mg/dL without ketones', 'blood glucose of 48 mg/dL', 'serum bicarbonate of 28 mEq/L'] },
        ],
      },
      correct_answer: { values: { '1': 'diabetic ketoacidosis', '2': 'positive serum ketones' } },
      rationale: 'Diabetic ketoacidosis (DKA) is characterized by hyperglycemia (typically >250 mg/dL), metabolic acidosis, and the presence of ketones (from fat breakdown). DKA occurs primarily in type 1 diabetes when insulin is absent. Positive serum ketones combined with hyperglycemia is the distinguishing feature of DKA versus HHS (which has extreme hyperglycemia without significant ketosis).',
      tags: 'DKA,diabetes,NGN,cloze,ketones',
    },
    // ── NGN Matrix Questions ──────────────────────────────────────────────────
    {
      question_text: 'A nurse is caring for four clients. For each client, indicate whether the finding is expected or requires immediate nursing action.',
      question_type: 'ngn_matrix',
      content_area: 'physiological_integrity',
      subcategory: 'Reduction of Risk Potential',
      difficulty: 'hard',
      cognitive_level: 'Analysis',
      is_ngn: true,
      options: {
        rows: [
          { id: '1', text: 'Post-op day 1 appendectomy: temperature 37.8°C (100°F), BP 122/78, pain 3/10' },
          { id: '2', text: 'Client on warfarin: INR 5.8, reports blood in urine' },
          { id: '3', text: 'Client with chronic kidney disease: potassium 5.4 mEq/L' },
          { id: '4', text: 'Client with heart failure: SpO2 88%, respiratory rate 28, pink frothy sputum' },
        ],
        columns: [
          { id: 'a', text: 'Expected finding' },
          { id: 'b', text: 'Requires immediate action' },
        ],
      },
      correct_answer: {
        cells: [['1', 'a'], ['2', 'b'], ['3', 'a'], ['4', 'b']],
      },
      rationale: 'Row 1 (Post-op appendectomy): Low-grade fever and mild pain are expected findings in post-op day 1. Row 2 (Warfarin): INR 5.8 (therapeutic range 2-3) with hematuria indicates dangerous over-anticoagulation requiring immediate intervention. Row 3 (CKD with K+ 5.4): Mildly elevated potassium is an expected finding in CKD and is not immediately life-threatening. Row 4 (Heart failure): SpO2 88%, RR 28, and pink frothy sputum indicate acute pulmonary edema, a life-threatening emergency.',
      tags: 'NGN,matrix,priority,critical thinking',
    },
    // ── More MCQ questions ───────────────────────────────────────────────────
    {
      question_text: 'A nurse is caring for a client with increased intracranial pressure (ICP). Which position should the nurse maintain for this client?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Physiological Adaptation',
      difficulty: 'easy',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Prone position with head of bed flat' },
        { id: 'b', text: 'Head of bed elevated 30-45 degrees, head in neutral alignment' },
        { id: 'c', text: 'Trendelenburg position (head lower than feet)' },
        { id: 'd', text: 'Side-lying position with head of bed at 90 degrees' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'Elevating the head of bed 30-45 degrees with the head in neutral alignment promotes venous drainage from the brain and helps reduce ICP. Trendelenburg and flat positions increase ICP by promoting venous congestion in the cranium. Turning the head to the side can compress jugular veins and increase ICP.',
      tags: 'ICP,neurological,positioning,brain',
    },
    {
      question_text: 'A nurse is preparing to administer IV potassium chloride to a client with hypokalemia. Which action is most important?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Pharmacological and Parenteral Therapies',
      difficulty: 'medium',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Administer the potassium as an IV push for rapid correction' },
        { id: 'b', text: 'Dilute the potassium and administer no faster than 10 mEq/hr via infusion pump' },
        { id: 'c', text: 'Give the potassium undiluted through a peripheral IV line' },
        { id: 'd', text: 'Administer the maximum dose of 40 mEq/hr for faster correction' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'IV potassium must always be diluted and administered via infusion pump at no more than 10 mEq/hr peripherally (up to 20 mEq/hr via central line in critical situations). IV push is absolutely contraindicated and can cause fatal cardiac arrest. Concentrated potassium is never given undiluted as it causes severe venous irritation and cardiac dysrhythmias.',
      tags: 'potassium,electrolytes,IV medications,safety',
    },
    {
      question_text: 'A nurse is caring for a postpartum client who delivered 2 hours ago. The nurse notes the uterine fundus is boggy, displaced to the right of midline, and located 2 cm above the umbilicus. Which intervention should the nurse implement?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Physiological Adaptation',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Administer oxytocin (Pitocin) immediately' },
        { id: 'b', text: 'Assist the client to empty their bladder and then reassess' },
        { id: 'c', text: 'Massage the fundus firmly until it becomes firm' },
        { id: 'd', text: 'Notify the provider of postpartum hemorrhage' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'A boggy uterus displaced to the right with fundal height above the umbilicus is a classic sign of urinary retention. A distended bladder displaces the uterus and prevents it from contracting properly (uterine atony). The priority intervention is to assist the client to void or catheterize if unable to void. After bladder emptying, the fundus should firm up. Fundal massage without addressing the bladder will not resolve the problem.',
      tags: 'postpartum,uterus,bladder,atony',
    },
    {
      question_text: 'A nurse is reviewing the laboratory values of a client with chronic obstructive pulmonary disease (COPD). The ABG results are: pH 7.32, PaCO2 58 mmHg, HCO3 30 mEq/L, PaO2 58 mmHg. How should the nurse interpret these results?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Reduction of Risk Potential',
      difficulty: 'hard',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Respiratory alkalosis with metabolic compensation' },
        { id: 'b', text: 'Metabolic acidosis with respiratory compensation' },
        { id: 'c', text: 'Respiratory acidosis with metabolic compensation' },
        { id: 'd', text: 'Metabolic alkalosis with respiratory compensation' },
      ],
      correct_answer: { value: 'c' },
      rationale: 'ABG interpretation: pH 7.32 (acidotic), PaCO2 58 (elevated — respiratory problem), HCO3 30 (elevated — alkalotic compensation). The primary problem is respiratory acidosis (elevated CO2 causes acidosis). The elevated HCO3 represents metabolic compensation by the kidneys retaining bicarbonate to buffer the acidosis. This is expected in chronic COPD (CO2 retainer). The low PaO2 indicates hypoxemia.',
      tags: 'ABG,COPD,respiratory acidosis,compensation',
    },
    {
      question_text: 'A nurse is preparing to administer morning medications. Which client should the nurse assess before giving medications?',
      question_type: 'traditional_mcq',
      content_area: 'safe_effective_care_environment',
      subcategory: 'Management of Care',
      difficulty: 'hard',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'A client prescribed metformin with a serum creatinine of 2.4 mg/dL' },
        { id: 'b', text: 'A client prescribed lisinopril with a blood pressure of 142/88 mmHg' },
        { id: 'c', text: 'A client prescribed aspirin with a temperature of 37.8°C' },
        { id: 'd', text: 'A client prescribed omeprazole who just finished eating breakfast' },
      ],
      correct_answer: { value: 'a' },
      rationale: 'Metformin is contraindicated with significant renal impairment (serum creatinine >1.4 mg/dL in women or >1.5 mg/dL in men, or eGFR <30). A creatinine of 2.4 mg/dL indicates renal dysfunction that requires the nurse to hold the metformin and notify the provider, as continued use risks lactic acidosis. The other situations require assessment but are not contraindications that prevent medication administration.',
      tags: 'metformin,renal function,contraindication,medication safety',
    },
    {
      question_text: 'A nurse is educating a client about warfarin (Coumadin) therapy. Which statement by the client requires further teaching?',
      question_type: 'traditional_mcq',
      content_area: 'health_promotion_and_maintenance',
      subcategory: 'Health and Wellness',
      difficulty: 'medium',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: '"I will have regular blood tests to check my INR."' },
        { id: 'b', text: '"I will avoid making sudden changes in the amount of leafy green vegetables I eat."' },
        { id: 'c', text: '"I should take aspirin if I have a headache while on warfarin."' },
        { id: 'd', text: '"I will wear a medical alert bracelet indicating I am on blood thinners."' },
      ],
      correct_answer: { value: 'c' },
      rationale: 'Aspirin should be avoided with warfarin as it increases bleeding risk (anti-platelet effect combined with anticoagulation). Clients should use acetaminophen for pain unless otherwise directed. Regular INR monitoring, consistent vitamin K intake (not elimination), and medical alert identification are all appropriate and indicate understanding of warfarin therapy.',
      tags: 'warfarin,anticoagulation,patient education,bleeding risk',
    },
    {
      question_text: 'A nurse is caring for a newborn who is 12 hours old. Which finding requires immediate intervention?',
      question_type: 'traditional_mcq',
      content_area: 'health_promotion_and_maintenance',
      subcategory: 'Ante/Intra/Postpartum and Newborn Care',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Heart rate of 148 beats per minute' },
        { id: 'b', text: 'Respiratory rate of 52 breaths per minute' },
        { id: 'c', text: 'Axillary temperature of 36.4°C (97.5°F)' },
        { id: 'd', text: 'Respiratory rate of 18 breaths per minute with grunting and cyanosis' },
      ],
      correct_answer: { value: 'd' },
      rationale: 'A respiratory rate of 18 (below normal 30-60 for newborns) with grunting (sign of respiratory distress) and cyanosis (inadequate oxygenation) is an emergency indicating respiratory failure or severe respiratory distress syndrome. Normal newborn HR is 120-160, RR 30-60, and temperature 36.5-37.5°C. Options A, B, and C are all within normal ranges for a newborn.',
      tags: 'newborn,neonatal,respiratory distress,normal values',
    },
    {
      question_text: 'A client is receiving vancomycin IV for a MRSA infection. Which assessment finding should the nurse report to the provider immediately?',
      question_type: 'traditional_mcq',
      content_area: 'physiological_integrity',
      subcategory: 'Pharmacological and Parenteral Therapies',
      difficulty: 'medium',
      cognitive_level: 'Analysis',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Serum vancomycin trough level of 15 mcg/mL' },
        { id: 'b', text: 'Urine output of 25 mL/hr for the past 3 hours' },
        { id: 'c', text: 'Client reports mild nausea during the infusion' },
        { id: 'd', text: 'Skin flushing over the face and neck during infusion' },
      ],
      correct_answer: { value: 'b' },
      rationale: 'Urine output of 25 mL/hr (less than 30 mL/hr minimum) suggests vancomycin nephrotoxicity. Vancomycin requires dose adjustment for renal impairment and regular monitoring of BUN, creatinine, and urine output. A trough of 15 mcg/mL is within acceptable range (10-20 mcg/mL). Flushing is "Red Man Syndrome" from too-rapid infusion (slow the rate, not an emergency). Mild nausea is a common side effect.',
      tags: 'vancomycin,MRSA,nephrotoxicity,antibiotics',
    },
    {
      question_text: 'A nurse is teaching a client with Parkinson\'s disease about safety measures at home. Which instruction is most important?',
      question_type: 'traditional_mcq',
      content_area: 'health_promotion_and_maintenance',
      subcategory: 'Health and Wellness',
      difficulty: 'medium',
      cognitive_level: 'Application',
      is_ngn: false,
      options: [
        { id: 'a', text: 'Use a raised toilet seat and grab bars in the bathroom' },
        { id: 'b', text: 'Avoid all physical activity to prevent falls' },
        { id: 'c', text: 'Take levodopa/carbidopa on an empty stomach for best absorption' },
        { id: 'd', text: 'Sleep in a recliner to reduce the risk of aspiration' },
      ],
      correct_answer: { value: 'a' },
      rationale: 'Fall prevention is the priority safety concern for clients with Parkinson\'s disease due to shuffling gait, postural instability, and bradykinesia. Bathroom modifications (raised toilet seat, grab bars) address the highest-risk area. Physical activity is encouraged, not avoided. Levodopa should be taken with food to reduce nausea. Sleeping in a recliner is not a standard safety recommendation.',
      tags: 'Parkinsons,fall prevention,safety,home care',
    },
  ]
}

export default router
