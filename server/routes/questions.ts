import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { getSeedQuestions } from '../data/nclex-seed'

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

async function getUserPlanAndUsage(userId: number): Promise<{ plan: string; questionsToday: number; dailyLimit: number | null; canAnswer: boolean }> {
  const today = new Date().toISOString().split('T')[0]
  const subResult = await query(
    `SELECT plan FROM nclex_subscriptions
     WHERE user_id = $1 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  const plan = subResult.rows[0]?.plan || 'free'
  const usageResult = await query(
    `SELECT questions_answered FROM nclex_daily_usage WHERE user_id = $1 AND usage_date = $2`,
    [userId, today]
  )
  const questionsToday = usageResult.rows[0]?.questions_answered || 0
  const dailyLimit = plan === 'free' ? 25 : null
  return { plan, questionsToday, dailyLimit, canAnswer: dailyLimit === null || questionsToday < dailyLimit }
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

    // Enforce daily limit before creating session
    const { canAnswer, dailyLimit, questionsToday } = await getUserPlanAndUsage(userId)
    if (!canAnswer) {
      return res.status(403).json({
        error: `Daily question limit reached (${questionsToday}/${dailyLimit}). Upgrade to Premium or VIP for more questions.`,
        daily_limit_reached: true,
      })
    }

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

    // CAT: no difficulty constraint — select from all tiers, medium-first ordering
    // Adaptive reordering happens question-by-question in the answer endpoint

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

    // CAT mode: order medium-first so adaptive reordering has all tiers available
    const orderBy = session_type === 'cat'
      ? `ORDER BY CASE qb.difficulty WHEN 'medium' THEN 0 WHEN 'easy' THEN 1 ELSE 2 END, RANDOM()`
      : `ORDER BY RANDOM()`

    const questionsResult = await query(
      `SELECT qb.id, qb.question_text, qb.question_type, qb.content_area, qb.subcategory,
              qb.difficulty, qb.cognitive_level, qb.is_ngn, qb.options, qb.tags
       FROM question_bank qb ${where}
       ${orderBy}
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
              qb.correct_answer, qb.rationale, qb.tags,
              qb.case_study_group, qb.case_study_scenario
       FROM session_responses sr
       JOIN question_bank qb ON sr.question_id = qb.id
       WHERE sr.session_id = $1
       ORDER BY sr.question_order`,
      [sessionId]
    )

    const session = sessionResult.rows[0]
    const isInProgress = session.status === 'in_progress'

    // For in-progress sessions, redact correct_answer and rationale for unanswered questions
    // to prevent answer key leakage via network inspection during active exams
    const questions = responsesResult.rows.map((q: any) => {
      if (isInProgress && !q.answered_at) {
        const { correct_answer: _ca, rationale: _r, ...safe } = q
        return safe
      }
      return q
    })

    res.json({
      session,
      questions,
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

    // Enforce daily limit server-side before accepting answer
    const { canAnswer, dailyLimit, questionsToday } = await getUserPlanAndUsage(userId!)
    if (!canAnswer) {
      return res.status(403).json({
        error: `Daily question limit reached (${questionsToday}/${dailyLimit}). Upgrade to continue.`,
        daily_limit_reached: true,
      })
    }

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

    await query(
      `UPDATE session_responses
       SET user_answer = $1, is_correct = $2, time_spent = $3, answered_at = NOW()
       WHERE session_id = $4 AND question_id = $5`,
      [JSON.stringify(user_answer), is_correct, time_spent, sessionId, question_id]
    )

    const session = sessionResult.rows[0]
    const newAnswered = session.questions_answered + 1
    const newCorrect = session.correct_answers + (is_correct ? 1 : 0)
    const isComplete = newAnswered >= session.total_questions

    // Increment daily usage (server-side, so enforcement is reliable regardless of client)
    await query(
      `INSERT INTO nclex_daily_usage (user_id, usage_date, questions_answered)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET questions_answered = nclex_daily_usage.questions_answered + 1,
                     updated_at = NOW()`,
      [userId]
    ).catch(() => {}) // Non-fatal: don't fail the answer submission if tracking fails

    // CAT adaptive difficulty with 3-tier logic
    let catNextDifficulty: string | null = null
    let nextQuestionId: number | null = null
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

      // Adaptive reordering: swap the upcoming question to match catNextDifficulty
      try {
        const currentOrderResult = await query(
          `SELECT question_order FROM session_responses WHERE session_id = $1 AND question_id = $2`,
          [sessionId, question_id]
        )
        const currentOrder = currentOrderResult.rows[0]?.question_order

        if (currentOrder !== undefined) {
          // Find the actual next unanswered question (regardless of difficulty)
          const actualNextResult = await query(
            `SELECT sr.question_id, sr.question_order
             FROM session_responses sr
             WHERE sr.session_id = $1 AND sr.answered_at IS NULL
               AND sr.question_order > $2
             ORDER BY sr.question_order LIMIT 1`,
            [sessionId, currentOrder]
          )
          const actualNext = actualNextResult.rows[0]

          // Find the nearest unanswered question matching the desired difficulty
          const bestNextResult = await query(
            `SELECT sr.question_id, sr.question_order
             FROM session_responses sr
             JOIN question_bank qb ON sr.question_id = qb.id
             WHERE sr.session_id = $1 AND sr.answered_at IS NULL
               AND sr.question_order > $2 AND qb.difficulty = $3
             ORDER BY sr.question_order LIMIT 1`,
            [sessionId, currentOrder, catNextDifficulty]
          )
          const bestNext = bestNextResult.rows[0]

          if (actualNext && bestNext && actualNext.question_id !== bestNext.question_id) {
            // Swap question_order so the best-difficulty question comes next
            await query(
              `UPDATE session_responses
               SET question_order = CASE
                 WHEN question_id = $1 THEN $2
                 WHEN question_id = $3 THEN $4
               END
               WHERE session_id = $5 AND question_id IN ($1, $3)`,
              [actualNext.question_id, bestNext.question_order,
               bestNext.question_id, actualNext.question_order,
               sessionId]
            )
            nextQuestionId = bestNext.question_id
          } else if (actualNext) {
            nextQuestionId = actualNext.question_id
          }
        }
      } catch (catErr) {
        console.warn('CAT reorder warning (non-fatal):', catErr)
      }
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
      next_question_id: nextQuestionId,
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

// ─── Free Review Eligibility (Processing Clients) ─────────────────────────────
router.get('/free-review-eligibility', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // Check if user has any active NCLEX processing application
    const appResult = await query(
      `SELECT id, grit_app_id, service_type, status, created_at
       FROM applications
       WHERE user_id = $1 AND status NOT IN ('rejected', 'cancelled')
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    )
    const hasApplication = appResult.rows.length > 0
    const application = appResult.rows[0] || null

    // Check if user has already claimed the processing bonus
    const claimedResult = await query(
      `SELECT id FROM nclex_subscriptions
       WHERE user_id = $1 AND notes = 'processing_bonus'`,
      [userId]
    )
    const alreadyClaimed = claimedResult.rows.length > 0

    // Check current subscription
    const subResult = await query(
      `SELECT plan FROM nclex_subscriptions
       WHERE user_id = $1 AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    const currentPlan = subResult.rows[0]?.plan || 'free'

    res.json({
      eligible: hasApplication && !alreadyClaimed,
      has_application: hasApplication,
      already_claimed: alreadyClaimed,
      current_plan: currentPlan,
      application: application ? {
        id: application.id,
        grit_app_id: application.grit_app_id,
        service_type: application.service_type,
        status: application.status,
      } : null,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Activate Free Review (Processing Clients) ────────────────────────────────
router.post('/free-review-activate', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // Verify eligibility
    const appResult = await query(
      `SELECT id, grit_app_id FROM applications
       WHERE user_id = $1 AND status NOT IN ('rejected', 'cancelled')
       LIMIT 1`,
      [userId]
    )
    if (appResult.rows.length === 0) {
      return res.status(403).json({ error: 'No active NCLEX processing application found.' })
    }

    const claimedResult = await query(
      `SELECT id FROM nclex_subscriptions WHERE user_id = $1 AND notes = 'processing_bonus'`,
      [userId]
    )
    if (claimedResult.rows.length > 0) {
      return res.status(400).json({ error: 'Free review has already been activated for your account.' })
    }

    // Expire any existing active subscription
    await query(
      `UPDATE nclex_subscriptions SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    )

    // Grant 2 months free premium
    const result = await query(
      `INSERT INTO nclex_subscriptions
         (user_id, plan, status, expires_at, payment_amount, activated_by, notes)
       VALUES ($1, 'premium', 'active', NOW() + INTERVAL '2 months', 0, 'system', 'processing_bonus')
       RETURNING *`,
      [userId]
    )

    res.json({
      message: 'Your 2 months FREE Premium NCLEX Review has been activated!',
      subscription: result.rows[0],
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
       JOIN users u ON s.user_id = u.id::text
       LEFT JOIN nclex_daily_usage du ON s.user_id = du.user_id::text
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
                WHERE user_id::text = u.id::text
              ), 0) as questions_total
       FROM users u
       LEFT JOIN nclex_subscriptions s ON s.user_id = u.id::text
         AND s.status = 'active'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       LEFT JOIN nclex_daily_usage du ON u.id::text = du.user_id::text
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
       LEFT JOIN nclex_subscriptions s ON u.id::text = s.user_id AND s.status = 'active'
       LEFT JOIN nclex_daily_usage du ON u.id::text = du.user_id AND du.usage_date = CURRENT_DATE
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

// ─── Seed Questions (shared logic) ────────────────────────────────────────────
function parseTags(tags: string | string[] | null | undefined): string[] | null {
  if (!tags) return null
  if (Array.isArray(tags)) return tags
  return tags.split(',').map((t: string) => t.trim()).filter(Boolean)
}

export async function autoSeedIfEmpty(): Promise<void> {
  try {
    const existing = await query(`SELECT COUNT(*) FROM question_bank WHERE is_active = true`)
    if (parseInt(existing.rows[0].count) > 10) return

    const questions = getSeedQuestions()
    for (const q of questions) {
      await query(
        `INSERT INTO question_bank
           (question_text, question_type, content_area, subcategory, difficulty,
            cognitive_level, is_ngn, options, correct_answer, rationale, tags,
            case_study_group, case_study_scenario, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
         ON CONFLICT DO NOTHING`,
        [
          q.question_text, q.question_type, q.content_area, q.subcategory || null,
          q.difficulty, q.cognitive_level || 'Application', q.is_ngn,
          JSON.stringify(q.options), JSON.stringify(q.correct_answer),
          q.rationale, parseTags(q.tags),
          (q as any).case_study_group || null, (q as any).case_study_scenario || null,
        ]
      )
    }
    console.log(`[seed] Question bank seeded with ${questions.length} sample questions.`)
  } catch (err) {
    console.warn('[seed] Auto-seed failed (non-fatal):', err)
  }
}

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
            cognitive_level, is_ngn, options, correct_answer, rationale, tags,
            case_study_group, case_study_scenario, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
         ON CONFLICT DO NOTHING`,
        [
          q.question_text, q.question_type, q.content_area, q.subcategory || null,
          q.difficulty, q.cognitive_level || 'Application', q.is_ngn,
          JSON.stringify(q.options), JSON.stringify(q.correct_answer),
          q.rationale, parseTags(q.tags),
          (q as any).case_study_group || null, (q as any).case_study_scenario || null,
        ]
      )
      inserted++
    }

    res.json({ message: 'Seeded successfully', inserted })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Payment Submission (User) ────────────────────────────────────────────────
router.post('/payment/submit', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { plan, amount, payment_method, reference_number, notes } = req.body
  if (!plan || !amount || !payment_method || !reference_number) {
    return res.status(400).json({ error: 'plan, amount, payment_method, and reference_number are required' })
  }
  if (!['premium', 'vip'].includes(plan)) {
    return res.status(400).json({ error: 'Plan must be premium or vip' })
  }

  try {
    const existing = await query(
      `SELECT id FROM nclex_payment_submissions WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending payment submission. Please wait for admin review.' })
    }

    const result = await query(
      `INSERT INTO nclex_payment_submissions
         (user_id, plan, amount, payment_method, reference_number, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [userId, plan, parseFloat(amount), payment_method, reference_number.trim(), notes || null]
    )
    res.json({ message: 'Payment submitted successfully. Admin will review within 24 hours.', submission: result.rows[0] })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Get User's Own Payment Submissions ──────────────────────────────────────
router.get('/payment/my-submissions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const result = await query(
      `SELECT id, plan, amount, payment_method, reference_number, notes, status, submitted_at, reviewed_at, admin_notes
       FROM nclex_payment_submissions
       WHERE user_id = $1
       ORDER BY submitted_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Admin: List All Payment Submissions ─────────────────────────────────────
router.get('/payment/submissions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  const { status } = req.query
  try {
    const result = await query(
      `SELECT ps.*, u.email, u.first_name, u.last_name, u.grit_id
       FROM nclex_payment_submissions ps
       JOIN users u ON ps.user_id = u.id::text
       ${status && status !== 'all' ? `WHERE ps.status = $1` : ''}
       ORDER BY ps.submitted_at DESC`,
      status && status !== 'all' ? [status] : []
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Admin: Approve or Reject a Payment Submission ───────────────────────────
router.patch('/payment/submissions/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  const { id } = req.params
  const { action, admin_notes } = req.body
  const adminId = req.user?.id

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject' })
  }

  try {
    const subResult = await query(
      `SELECT * FROM nclex_payment_submissions WHERE id = $1`,
      [id]
    )
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Submission not found' })

    const sub = subResult.rows[0]
    if (sub.status !== 'pending') {
      return res.status(400).json({ error: 'Submission has already been reviewed' })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    await query(
      `UPDATE nclex_payment_submissions
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2, admin_notes = $3
       WHERE id = $4`,
      [newStatus, adminId, admin_notes || null, id]
    )

    if (action === 'approve') {
      const durationMonths = sub.plan === 'vip' ? 6 : 2
      await query(
        `INSERT INTO nclex_subscriptions
           (user_id, plan, status, expires_at, payment_amount, payment_method, payment_reference, activated_by, notes)
         VALUES ($1, $2, 'active', NOW() + INTERVAL '${durationMonths} months', $3, $4, $5, $6, $7)`,
        [sub.user_id, sub.plan, sub.amount, sub.payment_method, sub.reference_number, adminId, `Auto-approved from submission #${id}`]
      )
    }

    res.json({ message: `Submission ${newStatus} successfully` })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
