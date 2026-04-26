import { Router } from 'express'
import { query, withTransaction } from '../db'
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
        parseTags(tags),
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
        parseTags(tags),
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
    // Note: pool === 'case_studies' is handled via a separate CTE query below

    const where = `WHERE ${conditions.join(' AND ')}`
    let limit = question_count

    if (session_type === 'readiness') limit = 75
    if (session_type === 'cat') limit = 85

    // CAT mode: order medium-first so adaptive reordering has all tiers available
    const orderBy = session_type === 'cat'
      ? `ORDER BY CASE qb.difficulty WHEN 'medium' THEN 0 WHEN 'easy' THEN 1 ELSE 2 END, RANDOM()`
      : `ORDER BY RANDOM()`

    // For case studies pool: use a CTE to select complete, ordered clusters
    // This ensures questions from the same scenario are always served together in sequence
    let questionsResult: any
    if (pool === 'case_studies') {
      const numCases = Math.max(1, Math.ceil(limit / 6))
      questionsResult = await query(
        `WITH selected_cases AS (
           SELECT qb.case_study_id
           FROM question_bank qb
           WHERE qb.is_active = true AND qb.case_study_id IS NOT NULL
           GROUP BY qb.case_study_id
           ORDER BY RANDOM()
           LIMIT $1
         )
         SELECT qb.id, qb.question_text, qb.question_type, qb.content_area, qb.subcategory,
                qb.difficulty, qb.cognitive_level, qb.is_ngn, qb.options, qb.tags,
                qb.case_study_id,
                cs.title AS case_study_title,
                cs.scenario AS case_study_scenario
         FROM question_bank qb
         JOIN case_studies cs ON qb.case_study_id = cs.id
         WHERE qb.case_study_id IN (SELECT case_study_id FROM selected_cases)
           AND qb.is_active = true
         ORDER BY qb.case_study_id, qb.id`,
        [numCases]
      )
    } else {
      questionsResult = await query(
        `SELECT qb.id, qb.question_text, qb.question_type, qb.content_area, qb.subcategory,
                qb.difficulty, qb.cognitive_level, qb.is_ngn, qb.options, qb.tags,
                qb.case_study_id,
                cs.title AS case_study_title,
                cs.scenario AS case_study_scenario
         FROM question_bank qb
         LEFT JOIN case_studies cs ON qb.case_study_id = cs.id
         ${where}
         ${orderBy}
         LIMIT $${paramIdx}`,
        [...params, limit]
      )
    }

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
              qb.case_study_id,
              cs.title AS case_study_title,
              cs.scenario AS case_study_scenario
       FROM session_responses sr
       JOIN question_bank qb ON sr.question_id = qb.id
       LEFT JOIN case_studies cs ON qb.case_study_id = cs.id
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
            cognitive_level, is_ngn, options, correct_answer, rationale, tags, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         ON CONFLICT DO NOTHING`,
        [
          q.question_text, q.question_type, q.content_area, q.subcategory || null,
          q.difficulty, q.cognitive_level || 'Application', q.is_ngn,
          JSON.stringify(q.options), JSON.stringify(q.correct_answer),
          q.rationale, parseTags(q.tags),
        ]
      )
    }
    console.log(`[seed] Question bank seeded with ${questions.length} sample questions.`)
  } catch (err) {
    console.warn('[seed] Auto-seed failed (non-fatal):', err)
  }
}

// ─── Seed NGN Case Studies (Admin only) ───────────────────────────────────────
router.post('/seed-case-studies', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  try {
    const existing = await query(`SELECT COUNT(*) FROM case_studies`)
    if (parseInt(existing.rows[0].count) > 0) {
      return res.json({ message: 'Case studies already seeded', count: parseInt(existing.rows[0].count) })
    }

    const caseStudies = getCaseStudySeedData()
    let insertedStudies = 0
    let insertedQuestions = 0

    for (const cs of caseStudies) {
      const csResult = await query(
        `INSERT INTO case_studies (title, scenario, content_area, difficulty)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [cs.title, cs.scenario, cs.content_area, cs.difficulty]
      )
      const csId = csResult.rows[0].id
      insertedStudies++

      for (const q of cs.questions) {
        await query(
          `INSERT INTO question_bank
             (question_text, question_type, content_area, subcategory, difficulty,
              cognitive_level, is_ngn, options, correct_answer, rationale, tags, is_active, case_study_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)`,
          [
            q.question_text, q.question_type, q.content_area, q.subcategory || null,
            q.difficulty, q.cognitive_level || 'Analysis', true,
            JSON.stringify(q.options), JSON.stringify(q.correct_answer),
            q.rationale, q.tags || null, csId,
          ]
        )
        insertedQuestions++
      }
    }

    res.json({ message: 'Case studies seeded successfully', insertedStudies, insertedQuestions })
  } catch (error: any) {
    console.error('Seed case studies error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─── Payment Submission Routes ────────────────────────────────────────────────

router.post('/subscription/submit-payment', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { plan, payment_method, payment_reference, payment_amount, notes } = req.body

    if (!plan || !['premium', 'vip'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be premium or vip.' })
    }

    const existing = await query(
      `SELECT id FROM nclex_payment_submissions WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You already have a pending payment submission. Please wait for admin review.' })
    }

    const result = await query(
      `INSERT INTO nclex_payment_submissions
         (user_id, plan, payment_method, payment_reference, payment_amount, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [userId, plan, payment_method || null, payment_reference || null,
       payment_amount || null, notes || null]
    )

    const submission = result.rows[0]

    const userName = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ') || req.user?.email || 'A user'
    const planLabel = plan === 'vip' ? 'VIP' : 'Premium'
    const notifMessage = `${userName} submitted ${planLabel} plan payment proof${payment_method ? ` via ${payment_method}` : ''}${payment_reference ? ` (ref: ${payment_reference})` : ''}. Review in NCLEX Subscriptions → Pending Approvals.`

    const adminUsers = await query(`SELECT id FROM users WHERE role = 'admin'`)
    for (const admin of adminUsers.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, read)
         VALUES ($1, 'payment_pending', 'New Payment Submission', $2, false)`,
        [admin.id, notifMessage]
      ).catch((err) => {
        console.warn('Admin notification insert failed (non-fatal):', err?.message || err)
      })
    }

    res.status(201).json(submission)
  } catch (error: any) {
    console.error('Submit payment error:', error)
    res.status(500).json({ error: error.message })
  }
})

function getCaseStudySeedData() {
  return [
    // ─────────────────────────────────────────────────────────────────────────
    // CASE STUDY 1: Post-CABG Hemorrhage
    // ─────────────────────────────────────────────────────────────────────────
    {
      title: 'Post-CABG Patient with Excessive Chest Tube Drainage',
      scenario: `A 67-year-old male (Mr. Rivera) is 6 hours postoperative following a 3-vessel coronary artery bypass graft (CABG) surgery performed under cardiopulmonary bypass. His medical history includes: type 2 diabetes mellitus (on insulin), hypertension (on lisinopril), and hyperlipidemia (on atorvastatin). He is admitted to the cardiac surgery ICU.

Current Vital Signs:
• BP: 86/54 mmHg (MAP 65)
• HR: 122 bpm (sinus tachycardia on monitor)
• RR: 26/min
• SpO₂: 91% on 4 L/min O₂ via nasal cannula
• Temperature: 35.8°C (96.4°F)
• Urine output: 18 mL/hr (Foley catheter in place)

Physical Assessment:
• Client is restless and reports feeling "cold and shaky"
• Skin is cool, pale, and diaphoretic
• Mediastinal chest tube output: 200 mL/hr for the past 2 consecutive hours
• Sternal wound dressing is dry and intact
• IV access: two large-bore peripheral IVs and a central venous line

Current Orders:
• Normal saline IV at 100 mL/hr
• Insulin drip per protocol
• Morphine 2 mg IV q4h PRN pain
• Heparin 800 units/hr IV infusion (resumed 2 hours postoperatively per cardiac surgeon)

Recent Lab Results:
• Hemoglobin: 7.2 g/dL (preoperative: 13.8 g/dL)
• Hematocrit: 21%
• Platelet count: 88,000/mm³
• PT/INR: 2.1 / 1.9
• aPTT: 98 seconds (therapeutic range per heparin protocol: 60–100 sec)
• Serum creatinine: 1.8 mg/dL (baseline: 1.1 mg/dL)
• Blood glucose: 248 mg/dL`,
      content_area: 'physiological_integrity',
      difficulty: 'hard',
      questions: [
        {
          question_text: 'Based on Mr. Rivera\'s clinical presentation, which finding should the nurse identify as the most immediately life-threatening?',
          question_type: 'traditional_mcq',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: [
            { id: 'a', text: 'SpO₂ of 91% on 4 L/min nasal cannula' },
            { id: 'b', text: 'Mediastinal chest tube output of 200 mL/hr × 2 hours' },
            { id: 'c', text: 'Blood glucose of 248 mg/dL' },
            { id: 'd', text: 'Serum creatinine of 1.8 mg/dL' },
          ],
          correct_answer: { value: 'b' },
          rationale: 'Mediastinal chest tube drainage of ≥200 mL/hr for 2 consecutive hours following cardiac surgery is a critical indicator of postoperative hemorrhage, which may require surgical re-exploration. Hemorrhage after CABG is immediately life-threatening and the highest priority. The SpO₂ and creatinine elevations are concerning but secondary. Hyperglycemia requires management but is not acutely life-threatening compared to active hemorrhage.',
          tags: 'post-CABG,hemorrhage,chest-tube,cardiac-surgery,priority',
        },
        {
          question_text: 'The nurse is preparing to notify the cardiac surgeon about Mr. Rivera\'s condition using SBAR communication. Which actions should the nurse take before making the call? Select all that apply.',
          question_type: 'ngn_sata',
          content_area: 'safe_effective_care_environment',
          subcategory: 'Management of Care',
          difficulty: 'hard',
          cognitive_level: 'Application',
          options: [
            { id: 'a', text: 'Pause the heparin infusion and notify the surgeon immediately' },
            { id: 'b', text: 'Reassess vital signs and document a complete set of current data' },
            { id: 'c', text: 'Administer morphine 2 mg IV to manage the client\'s restlessness before calling' },
            { id: 'd', text: 'Have blood products (PRBCs, FFP, platelets) available and crossmatch confirmed' },
            { id: 'e', text: 'Ensure two large-bore IV sites are patent and functioning' },
            { id: 'f', text: 'Request a 12-lead ECG to rule out arrhythmia as cause of hypotension' },
          ],
          correct_answer: { values: ['a', 'b', 'd', 'e'] },
          rationale: 'Before calling the surgeon: (A) Pausing heparin is critical — an INR of 1.9 and aPTT of 98 sec in the setting of hemorrhage increases bleeding risk; (B) Current vital signs are essential SBAR data; (D) Blood products should be immediately available given hemoglobin of 7.2 and platelet count of 88,000; (E) Two patent large-bore IVs are needed for rapid volume resuscitation. Administering morphine to a hemodynamically unstable client (BP 86/54) could worsen hypotension and is contraindicated. A 12-lead ECG is not the immediate priority.',
          tags: 'SBAR,post-CABG,hemorrhage,nursing-actions,heparin,transfusion',
        },
        {
          question_text: 'The nurse reviews Mr. Rivera\'s laboratory findings. For each lab value listed, indicate whether the result is a contributing factor to hemorrhage, a consequence of hemorrhage, or both.',
          question_type: 'ngn_matrix',
          content_area: 'physiological_integrity',
          subcategory: 'Reduction of Risk Potential',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: {
            rows: [
              { id: 1, text: 'Platelet count 88,000/mm³' },
              { id: 2, text: 'INR 1.9 (therapeutic heparin)' },
              { id: 3, text: 'Hemoglobin 7.2 g/dL (from 13.8 g/dL preoperatively)' },
              { id: 4, text: 'Serum creatinine 1.8 mg/dL (from 1.1 mg/dL baseline)' },
            ],
            columns: [
              { id: 1, text: 'Contributing factor to hemorrhage' },
              { id: 2, text: 'Consequence of hemorrhage' },
              { id: 3, text: 'Both' },
            ],
          },
          correct_answer: {
            cells: [
              [1, 1],
              [2, 1],
              [3, 2],
              [4, 2],
            ],
          },
          rationale: 'Thrombocytopenia (platelet count 88,000) and elevated INR from heparin are contributing factors because they impair clotting and increase bleeding risk. The significantly dropped hemoglobin (13.8→7.2) is a direct consequence of hemorrhage — this 6.6 g/dL drop represents major blood loss. The rise in creatinine is a consequence of decreased renal perfusion secondary to hemorrhage and hypotension (prerenal azotemia).',
          tags: 'lab-values,hemorrhage,post-CABG,matrix,thrombocytopenia,INR',
        },
        {
          question_text: 'The surgeon orders a transfusion of 2 units of packed red blood cells (PRBCs). The nurse is preparing to administer the first unit. Complete the following statement by selecting from the options provided.\n\nBefore initiating the blood transfusion, the nurse must verify the client\'s identity using [1] and confirm the blood type compatibility with [2]. The nurse should initiate the transfusion at a rate of [3] for the first 15 minutes, then adjust to complete the unit within [4] hours.',
          question_type: 'ngn_cloze',
          content_area: 'physiological_integrity',
          subcategory: 'Pharmacological and Parenteral Therapies',
          difficulty: 'medium',
          cognitive_level: 'Application',
          options: {
            stem: 'Before initiating the blood transfusion, the nurse must verify the client\'s identity using [1] and confirm the blood type compatibility with [2]. The nurse should initiate the transfusion at a rate of [3] for the first 15 minutes, then adjust to complete the unit within [4] hours.',
            blanks: [
              { id: '1', choices: ['one patient identifier (name only)', 'two patient identifiers (name and date of birth or MRN)', 'the room number and bed assignment', 'a verbal confirmation from a family member'] },
              { id: '2', choices: ['the medication administration record', 'a second nurse at the bedside using the blood bank slip and blood bag label', 'the client\'s medical record number alone', 'the attending physician\'s verbal order'] },
              { id: '3', choices: ['50–75 mL/hr', '200 mL/hr', '10–25 mL/hr', '125 mL/hr'] },
              { id: '4', choices: ['1', '4', '6', '8'] },
            ],
          },
          correct_answer: {
            values: {
              '1': 'two patient identifiers (name and date of birth or MRN)',
              '2': 'a second nurse at the bedside using the blood bank slip and blood bag label',
              '3': '10–25 mL/hr',
              '4': '4',
            },
          },
          rationale: 'Blood transfusion safety requires two patient identifiers per The Joint Commission NPSG.01.01.01. Two nurses must verify the blood product at the bedside using the blood bank slip and bag label. Transfusions must begin at a slow rate (10–25 mL/hr) for the first 15 minutes to monitor for transfusion reactions. Each unit of PRBCs must be completed within 4 hours to prevent bacterial growth and maintain product integrity.',
          tags: 'blood-transfusion,safety,PRBC,two-nurse-verification,transfusion-rate',
        },
        {
          question_text: 'Twenty minutes after starting the PRBC transfusion, Mr. Rivera develops fever (38.8°C), rigors, and lumbar back pain. His BP drops to 74/46 mmHg. Which interventions should the nurse implement? Select all that apply.',
          question_type: 'ngn_sata',
          content_area: 'physiological_integrity',
          subcategory: 'Pharmacological and Parenteral Therapies',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: [
            { id: 'a', text: 'Stop the transfusion immediately and keep the IV line open with normal saline using new tubing' },
            { id: 'b', text: 'Slow the transfusion rate to 25 mL/hr and administer diphenhydramine IV' },
            { id: 'c', text: 'Notify the provider and blood bank immediately' },
            { id: 'd', text: 'Return the blood bag and tubing to the blood bank for testing' },
            { id: 'e', text: 'Obtain a urine specimen and monitor for hemoglobinuria' },
            { id: 'f', text: 'Administer the second unit of PRBCs to compensate for hemolysis' },
          ],
          correct_answer: { values: ['a', 'c', 'd', 'e'] },
          rationale: 'The symptoms (fever, rigors, back pain, hypotension during transfusion) indicate a potential acute hemolytic transfusion reaction — a life-threatening emergency caused by ABO incompatibility. The nurse must: (A) Stop the transfusion immediately — do not slow it — and maintain IV access with normal saline via NEW tubing to prevent infusing more incompatible blood; (C) Notify provider and blood bank immediately; (D) Return blood product and tubing for analysis; (E) Monitor urine for hemoglobinuria (dark/red urine = hemolysis). Slowing the rate (B) is inappropriate for a hemolytic reaction. Administering the second unit (F) is dangerous.',
          tags: 'hemolytic-transfusion-reaction,blood-transfusion,emergency,PRBC,safety',
        },
        {
          question_text: 'After the acute situation is stabilized, the nurse is completing discharge education with Mr. Rivera\'s wife regarding post-CABG home care. Which statement by the wife indicates a need for further teaching?',
          question_type: 'traditional_mcq',
          content_area: 'health_promotion_and_maintenance',
          subcategory: 'Health Promotion and Disease Prevention',
          difficulty: 'medium',
          cognitive_level: 'Evaluation',
          options: [
            { id: 'a', text: '"I should call 911 if he develops sudden chest pain or difficulty breathing at home."' },
            { id: 'b', text: '"He should avoid lifting anything heavier than 10 pounds for at least 6–8 weeks to protect the sternum."' },
            { id: 'c', text: '"He can stop his cholesterol medication once he is fully recovered since the bypass fixed the blockages."' },
            { id: 'd', text: '"I should monitor the incision sites daily for redness, swelling, or drainage."' },
          ],
          correct_answer: { value: 'c' },
          rationale: 'CABG does not cure the underlying atherosclerotic disease process. Statin therapy (e.g., atorvastatin) must be continued lifelong because it reduces LDL cholesterol, stabilizes plaques, and reduces the risk of recurrent MI and graft occlusion. Stopping statins post-CABG significantly increases cardiovascular event risk. The other statements demonstrate correct understanding of post-CABG home care.',
          tags: 'post-CABG,discharge-teaching,statins,health-promotion,atherosclerosis',
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CASE STUDY 2: Septic Shock
    // ─────────────────────────────────────────────────────────────────────────
    {
      title: 'Older Adult with Septic Shock from Urinary Source',
      scenario: `Mrs. Tanaka, a 74-year-old female, is brought to the emergency department by ambulance from her assisted living facility. The paramedics report she was found confused and increasingly lethargic over the past 12 hours. She has not eaten or taken her medications in the past 24 hours. Her medical history includes: heart failure with reduced ejection fraction (EF 30%), type 2 diabetes mellitus, and recurrent urinary tract infections.

Current Vital Signs (on arrival):
• BP: 78/50 mmHg (MAP 59)
• HR: 132 bpm (atrial fibrillation with rapid ventricular response)
• RR: 30/min
• SpO₂: 88% on room air
• Temperature: 39.4°C (102.9°F)
• GCS: 11 (E3V3M5) — confused and lethargic

Physical Assessment:
• Skin: mottled, warm peripherally, diaphoretic
• Mucous membranes: dry
• Capillary refill: 4 seconds
• No urine output in last 12 hours (Foley catheter inserted in triage — no urine draining)

Diagnostic Findings:
• Lactate: 5.2 mmol/L
• WBC: 26,800/mm³ with 18% bands
• Blood cultures: ×2 drawn (results pending)
• Urinalysis: cloudy, foul-smelling; nitrites (+), leukocyte esterase (+), >100 WBC/hpf, gram-negative rods on microscopy
• Procalcitonin: 48 ng/mL (normal <0.5)
• Serum creatinine: 3.1 mg/dL (baseline: 0.9 mg/dL)
• Blood glucose: 312 mg/dL
• Chest X-ray: No infiltrates; mild cardiomegaly

Medications prior to admission:
• Metformin 1000 mg twice daily
• Furosemide 40 mg daily
• Carvedilol 6.25 mg twice daily
• Warfarin 5 mg daily (INR on file: 2.4)`,
      content_area: 'physiological_integrity',
      difficulty: 'hard',
      questions: [
        {
          question_text: 'Based on Mrs. Tanaka\'s clinical presentation and diagnostic findings, the nurse interprets that she is experiencing which condition?',
          question_type: 'traditional_mcq',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: [
            { id: 'a', text: 'Systemic inflammatory response syndrome (SIRS) from a urinary source' },
            { id: 'b', text: 'Septic shock with multi-organ dysfunction' },
            { id: 'c', text: 'Decompensated heart failure with cardiogenic shock' },
            { id: 'd', text: 'Hypovolemic shock from inadequate fluid intake' },
          ],
          correct_answer: { value: 'b' },
          rationale: 'Septic shock is defined as sepsis (organ dysfunction from infection) plus vasopressor requirement to maintain MAP ≥65 mmHg AND a serum lactate >2 mmol/L despite adequate fluid resuscitation. Mrs. Tanaka has: suspected urinary source infection (UA findings, procalcitonin 48 ng/mL), MAP of 59 (<65), lactate 5.2 mmol/L, acute kidney injury (creatinine 3.1 from 0.9 baseline), and altered mental status — all consistent with septic shock with MODS. Cardiogenic shock is less likely given the infectious source and elevated lactate.',
          tags: 'septic-shock,MODS,sepsis,lactate,diagnosis',
        },
        {
          question_text: 'The nurse anticipates implementing the Surviving Sepsis Campaign Hour-1 Bundle for Mrs. Tanaka. Which interventions are included in this bundle? Select all that apply.',
          question_type: 'ngn_sata',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Application',
          options: [
            { id: 'a', text: 'Obtain blood cultures (×2 sets) before administering antibiotics' },
            { id: 'b', text: 'Administer broad-spectrum IV antibiotics within 1 hour of recognition' },
            { id: 'c', text: 'Administer 30 mL/kg IV crystalloid bolus for hypotension or lactate ≥4 mmol/L' },
            { id: 'd', text: 'Measure lactate level (remeasure if initial lactate >2 mmol/L)' },
            { id: 'e', text: 'Apply vasopressors to maintain MAP ≥65 mmHg if hypotension persists after fluids' },
            { id: 'f', text: 'Administer corticosteroids empirically to all septic shock patients' },
          ],
          correct_answer: { values: ['a', 'b', 'c', 'd', 'e'] },
          rationale: 'The Surviving Sepsis Campaign Hour-1 Bundle (2018 update) includes: (A) Blood cultures ×2 before antibiotics — to identify organism and guide de-escalation; (B) Broad-spectrum antibiotics within 1 hour — reduces mortality significantly; (C) 30 mL/kg crystalloid bolus — for hypotension or lactate ≥4; (D) Measure lactate — and remeasure if >2 mmol/L to assess response; (E) Vasopressors (norepinephrine first-line) if MAP <65 after fluids. Corticosteroids (F) are NOT part of the standard Hour-1 Bundle — they are considered in refractory septic shock unresponsive to vasopressors.',
          tags: 'sepsis-bundle,surviving-sepsis,antibiotics,vasopressors,lactate,Hour-1',
        },
        {
          question_text: 'The nurse is monitoring Mrs. Tanaka\'s response to 2 L of normal saline administered over 30 minutes. For each assessment finding below, indicate whether it suggests the fluid resuscitation is effective, ineffective, or requires further evaluation.',
          question_type: 'ngn_matrix',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: {
            rows: [
              { id: 1, text: 'MAP increases from 59 to 68 mmHg' },
              { id: 2, text: 'HR decreases from 132 to 118 bpm' },
              { id: 3, text: 'Urine output remains 0 mL over next 30 minutes' },
              { id: 4, text: 'SpO₂ drops from 88% to 84% and crackles appear at lung bases bilaterally' },
              { id: 5, text: 'Lactate decreases from 5.2 to 3.8 mmol/L at 2 hours' },
            ],
            columns: [
              { id: 1, text: 'Effective resuscitation' },
              { id: 2, text: 'Ineffective / ongoing shock' },
              { id: 3, text: 'Requires further evaluation' },
            ],
          },
          correct_answer: {
            cells: [
              [1, 1],
              [2, 1],
              [3, 3],
              [4, 2],
              [5, 1],
            ],
          },
          rationale: 'MAP ≥65 (row 1) and decreasing HR (row 2) indicate improved perfusion — effective. Decreasing lactate (row 5) indicates improved tissue oxygenation — effective. Persistent anuria (row 3) in the setting of AKI requires further evaluation — could be ATN from ischemia or ongoing hypoperfusion. Worsening oxygenation with pulmonary crackles (row 4) suggests fluid overload in a patient with EF 30% — a complication of aggressive resuscitation indicating inadequate response or fluid toxicity.',
          tags: 'fluid-resuscitation,sepsis,matrix,assessment,MAP,lactate',
        },
        {
          question_text: 'The provider orders norepinephrine infusion and meropenem IV. The nurse notes that Mrs. Tanaka\'s current medications include metformin 1000 mg twice daily and warfarin 5 mg daily. Complete the following statement.\n\nThe nurse should [1] the metformin because of the risk of [2] in the setting of acute kidney injury and hemodynamic instability. The nurse should also [3] warfarin administration and monitor for [4] given Mrs. Tanaka\'s elevated INR of 2.4 and risk of bleeding.',
          question_type: 'ngn_cloze',
          content_area: 'physiological_integrity',
          subcategory: 'Pharmacological and Parenteral Therapies',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: {
            stem: 'The nurse should [1] the metformin because of the risk of [2] in the setting of acute kidney injury and hemodynamic instability. The nurse should also [3] warfarin administration and monitor for [4] given Mrs. Tanaka\'s elevated INR of 2.4 and risk of bleeding.',
            blanks: [
              { id: '1', choices: ['continue', 'hold', 'double the dose of', 'crush and administer via NG tube'] },
              { id: '2', choices: ['hypoglycemia', 'lactic acidosis', 'agranulocytosis', 'nephrotoxicity'] },
              { id: '3', choices: ['continue', 'hold', 'double the dose of', 'switch to heparin for'] },
              { id: '4', choices: ['thrombotic events', 'signs of bleeding and worsening coagulopathy', 'hepatotoxicity', 'hyperkalemia'] },
            ],
          },
          correct_answer: {
            values: {
              '1': 'hold',
              '2': 'lactic acidosis',
              '3': 'hold',
              '4': 'signs of bleeding and worsening coagulopathy',
            },
          },
          rationale: 'Metformin must be held in acute kidney injury because reduced renal clearance leads to drug accumulation, causing potentially fatal lactic acidosis. Warfarin should be held given the elevated INR (2.4) and sepsis-related coagulopathy — INR typically worsens in sepsis due to consumptive coagulopathy and hepatic dysfunction. Monitoring for bleeding is essential. These are critical medication safety decisions in septic shock management.',
          tags: 'metformin,warfarin,AKI,lactic-acidosis,medication-safety,sepsis,INR',
        },
        {
          question_text: 'Mrs. Tanaka is transferred to the medical ICU. The nurse is assessing for complications of septic shock and MODS. Which findings are consistent with developing acute respiratory distress syndrome (ARDS)? Select all that apply.',
          question_type: 'ngn_sata',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: [
            { id: 'a', text: 'PaO₂/FiO₂ (P/F) ratio of 180 mmHg' },
            { id: 'b', text: 'Bilateral infiltrates on chest X-ray not fully explained by effusions or atelectasis' },
            { id: 'c', text: 'Pulmonary artery wedge pressure (PAWP) of 28 mmHg' },
            { id: 'd', text: 'Acute onset within 1 week of a known clinical insult (sepsis)' },
            { id: 'e', text: 'Worsening hypoxemia refractory to supplemental oxygen' },
            { id: 'f', text: 'Respiratory alkalosis on ABG (pH 7.52, PaCO₂ 28)' },
          ],
          correct_answer: { values: ['a', 'b', 'd', 'e'] },
          rationale: 'ARDS (Berlin Definition) requires: acute onset within 1 week of insult (D), bilateral opacities on imaging not explained by other causes (B), P/F ratio <300 (moderate <200, severe <100) — P/F of 180 (A) indicates moderate ARDS, and hypoxemia refractory to O₂ (E). PAWP >18 mmHg (C) suggests cardiogenic pulmonary edema, which would exclude the diagnosis of ARDS. Respiratory alkalosis (F) is a nonspecific early sign of hypoxia or anxiety but is not diagnostic of ARDS.',
          tags: 'ARDS,Berlin-definition,sepsis,MODS,hypoxemia,P/F-ratio',
        },
        {
          question_text: 'The family asks the nurse, "Will my mother be okay? Why is she on so many machines?" The nurse\'s most therapeutic response to the family is:',
          question_type: 'traditional_mcq',
          content_area: 'psychosocial_integrity',
          subcategory: 'Coping and Adaptation',
          difficulty: 'medium',
          cognitive_level: 'Application',
          options: [
            { id: 'a', text: '"Your mother is very sick, but we are doing everything we can. The machines are supporting her organs while her body fights the infection. Would you like me to explain what each one does?"' },
            { id: 'b', text: '"Don\'t worry — she\'s in the best hands. She will definitely pull through."' },
            { id: 'c', text: '"I can\'t share any information until the doctor arrives. You\'ll need to speak with the attending physician."' },
            { id: 'd', text: '"She\'s on life support. The machines are breathing for her and keeping her heart going."' },
          ],
          correct_answer: { value: 'a' },
          rationale: 'The therapeutic response honestly acknowledges the severity of the situation without giving false reassurance (choice B) or withholding information unnecessarily (choice C). It offers to educate the family (empowering them) and demonstrates compassion and transparency. Choice D uses alarming and imprecise language ("life support," "breathing for her") that may increase fear without being fully accurate — norepinephrine supports BP, not breathing, unless she is intubated.',
          tags: 'therapeutic-communication,family-education,septic-shock,ICU,coping',
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CASE STUDY 3: Pediatric Status Asthmaticus
    // ─────────────────────────────────────────────────────────────────────────
    {
      title: 'Pediatric Patient with Status Asthmaticus',
      scenario: `Jaylen, an 8-year-old male, is brought to the emergency department by his mother at 11 PM. She reports a 3-day history of increasing cough, wheezing, and shortness of breath. Jaylen has a diagnosis of moderate persistent asthma and uses an albuterol metered-dose inhaler (MDI) as needed and a fluticasone/salmeterol combination inhaler daily. His mother reports he has been using albuterol every 2 hours for the past 12 hours without improvement. He has missed 2 days of school.

Physical Assessment on Arrival:
• Weight: 28 kg
• HR: 138 bpm
• RR: 40/min with nasal flaring
• BP: 104/68 mmHg
• SpO₂: 86% on room air
• Temperature: 37.6°C (99.7°F)

Respiratory Assessment:
• Audible wheeze bilaterally
• Significant intercostal, subcostal, and suprasternal retractions
• Accessory muscle use (sternocleidomastoid) noted
• Speaking in 2–3 word phrases only
• Inspiratory:expiratory ratio prolonged (I:E 1:4)
• Breath sounds: diffuse expiratory wheeze with decreased air entry at bilateral bases

Peak Expiratory Flow Rate (PEFR): 35% of predicted

ABG (obtained after initial treatment failure):
• pH: 7.26
• PaCO₂: 54 mmHg
• PaO₂: 52 mmHg
• HCO₃⁻: 22 mEq/L
• SaO₂: 82%

Medications given in triage (prior to ABG):
• Albuterol 2.5 mg via nebulizer × 2 doses (15 min apart)
• Ipratropium bromide 0.5 mg via nebulizer × 1 dose`,
      content_area: 'physiological_integrity',
      difficulty: 'hard',
      questions: [
        {
          question_text: 'Based on Jaylen\'s clinical presentation, PEFR of 35%, and ABG results, the nurse classifies his asthma exacerbation as which severity?',
          question_type: 'traditional_mcq',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: [
            { id: 'a', text: 'Mild exacerbation — PEFR >70%, SpO₂ >95%' },
            { id: 'b', text: 'Moderate exacerbation — PEFR 40–69%, SpO₂ 90–95%' },
            { id: 'c', text: 'Severe exacerbation — PEFR <40%, SpO₂ <90%, use of accessory muscles' },
            { id: 'd', text: 'Impending respiratory failure (status asthmaticus) — PEFR <25%, altered mental status, rising PaCO₂' },
          ],
          correct_answer: { value: 'd' },
          rationale: 'Jaylen has PEFR 35% (approaching <25%), rising PaCO₂ of 54 mmHg (normal 35–45, indicating CO₂ retention = impending respiratory failure), pH 7.26 (respiratory acidosis), SpO₂ 82%, and the inability to speak in full sentences. In asthma, a "normal" or rising PaCO₂ is paradoxically ominous — the child has been hyperventilating to compensate; CO₂ retention signals respiratory muscle fatigue and impending arrest. This is status asthmaticus requiring urgent escalation.',
          tags: 'asthma,status-asthmaticus,PEFR,respiratory-failure,PaCO2,pediatric',
        },
        {
          question_text: 'The nurse prepares to escalate Jaylen\'s care due to failure to respond to initial bronchodilator therapy. Which interventions should the nurse anticipate? Select all that apply.',
          question_type: 'ngn_sata',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Application',
          options: [
            { id: 'a', text: 'Administer IV methylprednisolone (systemic corticosteroid)' },
            { id: 'b', text: 'Prepare for possible endotracheal intubation and mechanical ventilation' },
            { id: 'c', text: 'Administer IV magnesium sulfate as a bronchodilator' },
            { id: 'd', text: 'Initiate continuous albuterol nebulization' },
            { id: 'e', text: 'Discontinue albuterol — further doses are contraindicated after tachycardia >120 bpm' },
            { id: 'f', text: 'Apply a non-rebreather mask at 15 L/min oxygen' },
          ],
          correct_answer: { values: ['a', 'b', 'c', 'd', 'f'] },
          rationale: '(A) IV corticosteroids reduce airway inflammation — essential in status asthmaticus; (B) Impending respiratory failure (rising PaCO₂, acidosis, fatigue) requires preparation for intubation; (C) IV magnesium sulfate is a second-line bronchodilator that causes smooth muscle relaxation — used in severe/refractory asthma; (D) Continuous albuterol nebulization maintains sustained bronchodilation; (F) High-flow O₂ corrects hypoxemia. Albuterol (E) is NOT contraindicated due to tachycardia in status asthmaticus — the tachycardia is from hypoxia and the disease itself, and the benefit outweighs the risk.',
          tags: 'status-asthmaticus,magnesium-sulfate,corticosteroids,intubation,albuterol,pediatric',
        },
        {
          question_text: 'The nurse is monitoring Jaylen\'s response to escalated treatment. For each assessment finding, indicate whether it suggests improvement, deterioration, or no change in his respiratory status.',
          question_type: 'ngn_matrix',
          content_area: 'physiological_integrity',
          subcategory: 'Physiological Adaptation',
          difficulty: 'hard',
          cognitive_level: 'Analysis',
          options: {
            rows: [
              { id: 1, text: 'PEFR improves from 35% to 52% of predicted' },
              { id: 2, text: 'PaCO₂ increases from 54 mmHg to 62 mmHg' },
              { id: 3, text: 'SpO₂ improves from 86% to 94% on high-flow O₂' },
              { id: 4, text: 'Retractions persist; child now only speaking in 1-word answers' },
              { id: 5, text: 'Wheeze diminishes and the child becomes suddenly quiet with decreased breath sounds' },
            ],
            columns: [
              { id: 1, text: 'Improvement' },
              { id: 2, text: 'Deterioration' },
              { id: 3, text: 'No change in status' },
            ],
          },
          correct_answer: {
            cells: [
              [1, 1],
              [2, 2],
              [3, 1],
              [4, 2],
              [5, 2],
            ],
          },
          rationale: 'PEFR improving (row 1) and SpO₂ improving (row 3) indicate positive response to treatment. Rising PaCO₂ (row 2) signals worsening respiratory acidosis and CO₂ retention — deterioration. Worsening speech (row 4) and persistent retractions indicate increasing work of breathing — deterioration. CRITICAL: In asthma, a "quiet chest" with sudden absence of wheeze and decreased breath sounds (row 5) is an ominous sign of severe air trapping or near-complete airway obstruction — NOT improvement. This signals impending respiratory arrest.',
          tags: 'asthma,assessment,silent-chest,PEFR,deterioration,matrix,pediatric',
        },
        {
          question_text: 'The provider orders IV magnesium sulfate 75 mg/kg (max 2 g) in 20 mL NS over 20 minutes. Jaylen weighs 28 kg. Complete the following.',
          question_type: 'ngn_cloze',
          content_area: 'physiological_integrity',
          subcategory: 'Pharmacological and Parenteral Therapies',
          difficulty: 'hard',
          cognitive_level: 'Application',
          options: {
            stem: 'The nurse first calculates the weight-based dose as [1] mg. Because this exceeds the maximum dose, the nurse prepares [2] grams of magnesium sulfate to administer. Before and during the infusion, the nurse monitors for [3], which is the earliest sign of magnesium toxicity. The nurse keeps [4] at the bedside as the specific antidote.',
            blanks: [
              { id: '1', choices: ['700 mg', '1,400 mg', '2,100 mg', '2,800 mg'] },
              { id: '2', choices: ['0.5', '1', '2 (capped at maximum)', '4'] },
              { id: '3', choices: ['bradycardia and hypertension', 'loss of deep tendon reflexes, hypotension, and respiratory depression', 'seizures and rigidity', 'elevated temperature and diaphoresis'] },
              { id: '4', choices: ['sodium bicarbonate', 'calcium gluconate', 'protamine sulfate', 'flumazenil'] },
            ],
          },
          correct_answer: {
            values: {
              '1': '2,100 mg',
              '2': '2 (capped at maximum)',
              '3': 'loss of deep tendon reflexes, hypotension, and respiratory depression',
              '4': 'calcium gluconate',
            },
          },
          rationale: '75 mg/kg × 28 kg = 2,100 mg. Because 2,100 mg exceeds the maximum ordered dose of 2 g (2,000 mg), the nurse applies the cap and prepares exactly 2 g. Signs of magnesium toxicity appear in order of severity: loss of deep tendon reflexes (DTRs) is the earliest sign (serum Mg ≈7 mEq/L), followed by respiratory depression and hypotension at higher levels (>12 mEq/L). Calcium gluconate (10 mL of 10% solution IV) is the specific antidote — it reverses magnesium toxicity through competitive antagonism at neuromuscular junctions and cardiac cell membranes.',
          tags: 'magnesium-sulfate,dose-calculation,toxicity,calcium-gluconate,antidote,pediatric,asthma',
        },
        {
          question_text: 'Jaylen is stabilized and admitted to the pediatric unit. His mother asks the nurse, "What can I do to prevent this from happening again?" Which instructions should the nurse include in the discharge teaching? Select all that apply.',
          question_type: 'ngn_sata',
          content_area: 'health_promotion_and_maintenance',
          subcategory: 'Health Promotion and Disease Prevention',
          difficulty: 'medium',
          cognitive_level: 'Application',
          options: [
            { id: 'a', text: 'Use the fluticasone/salmeterol controller inhaler every day, even when Jaylen feels well' },
            { id: 'b', text: 'Identify and eliminate or reduce known triggers (allergens, smoke, exercise in cold air)' },
            { id: 'c', text: 'Develop and follow a written asthma action plan with green/yellow/red zones' },
            { id: 'd', text: 'Stop the controller inhaler once the PEFR stays above 80% for 2 weeks' },
            { id: 'e', text: 'Ensure Jaylen receives annual influenza vaccination' },
            { id: 'f', text: 'Use albuterol before exercise as directed by the provider to prevent exercise-induced bronchospasm' },
          ],
          correct_answer: { values: ['a', 'b', 'c', 'e', 'f'] },
          rationale: '(A) Controller inhalers must be used daily — stopping during asymptomatic periods leads to loss of control; (B) Trigger avoidance is a cornerstone of asthma management; (C) A written asthma action plan helps families recognize escalation and take appropriate action; (E) Influenza can trigger severe asthma exacerbations — annual vaccination is recommended for all patients with asthma; (F) Pre-exercise albuterol (15 min before) prevents exercise-induced bronchospasm. (D) is INCORRECT — controller medications should not be stopped based on symptom improvement without provider guidance; stopping controller therapy is a leading cause of exacerbations.',
          tags: 'asthma-education,controller-inhaler,action-plan,trigger-avoidance,influenza,discharge-teaching',
        },
        {
          question_text: 'The nurse is reviewing Jaylen\'s inhaler technique with his mother using a spacer/valved holding chamber (VHC). Which observation indicates the mother needs additional teaching?',
          question_type: 'traditional_mcq',
          content_area: 'health_promotion_and_maintenance',
          subcategory: 'Health Promotion and Disease Prevention',
          difficulty: 'medium',
          cognitive_level: 'Evaluation',
          options: [
            { id: 'a', text: 'She shakes the MDI vigorously for 5 seconds before attaching it to the spacer' },
            { id: 'b', text: 'She fires the MDI once into the spacer and instructs Jaylen to inhale slowly and deeply, then hold his breath for 10 seconds' },
            { id: 'c', text: 'She fires two puffs simultaneously into the spacer before having Jaylen inhale' },
            { id: 'd', text: 'She rinses Jaylen\'s mouth with water after the fluticasone/salmeterol inhaler' },
          ],
          correct_answer: { value: 'c' },
          rationale: 'Each puff of a metered-dose inhaler should be fired separately, with a complete inhalation cycle between puffs. Firing two puffs simultaneously into the spacer results in coalescence of larger drug particles, reducing the amount of fine-particle drug that reaches the small airways. Proper technique: shake the inhaler, fire ONE puff into the spacer, inhale slowly over 3–5 seconds, hold breath 10 seconds, wait 30–60 seconds before the second puff. Rinsing the mouth after inhaled corticosteroids (D) is correct to prevent oral candidiasis.',
          tags: 'inhaler-technique,spacer,MDI,asthma-education,fluticasone,pediatric',
        },
      ],
    },
  ]
}

router.get('/subscription/my-submissions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const result = await query(
      `SELECT * FROM nclex_payment_submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/subscription/admin/pending-approvals', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const result = await query(
      `SELECT ps.*,
              u.email as user_email,
              u.first_name,
              u.last_name,
              u.grit_id
       FROM nclex_payment_submissions ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.status = 'pending'
       ORDER BY ps.created_at ASC`
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscription/admin/approve', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const { submission_id, review_notes } = req.body
    if (!submission_id) return res.status(400).json({ error: 'submission_id is required' })

    const subResult = await query(
      `SELECT * FROM nclex_payment_submissions WHERE id = $1`,
      [submission_id]
    )
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Submission not found' })

    const submission = subResult.rows[0]
    if (submission.status !== 'pending') {
      return res.status(409).json({ error: `Submission is already ${submission.status}. Only pending submissions can be approved.` })
    }

    const adminId = req.user?.id

    let expiresAt: string | null = null
    if (submission.plan === 'premium') {
      const d = new Date()
      d.setMonth(d.getMonth() + 2)
      expiresAt = d.toISOString()
    } else if (submission.plan === 'vip') {
      const d = new Date()
      d.setMonth(d.getMonth() + 6)
      expiresAt = d.toISOString()
    }

    await withTransaction(async (q) => {
      await q(
        `UPDATE nclex_payment_submissions
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'pending'`,
        [adminId, review_notes || null, submission_id]
      )

      await q(
        `UPDATE nclex_subscriptions SET status = 'expired', updated_at = NOW()
         WHERE user_id = $1::text AND status = 'active'`,
        [submission.user_id]
      )

      await q(
        `INSERT INTO nclex_subscriptions
           (user_id, plan, status, expires_at, payment_amount, payment_currency,
            payment_reference, payment_method, notes, activated_by)
         VALUES ($1::text, $2, 'active', $3, $4, 'PHP', $5, $6, $7, $8::text)`,
        [
          submission.user_id, submission.plan, expiresAt,
          submission.payment_amount || null,
          submission.payment_reference || null,
          submission.payment_method || null,
          submission.notes || null,
          adminId,
        ]
      )
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Approve submission error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscription/admin/reject', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    const { submission_id, review_notes } = req.body
    if (!submission_id) return res.status(400).json({ error: 'submission_id is required' })

    const subResult = await query(
      `SELECT status FROM nclex_payment_submissions WHERE id = $1`,
      [submission_id]
    )
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Submission not found' })
    if (subResult.rows[0].status !== 'pending') {
      return res.status(409).json({ error: `Submission is already ${subResult.rows[0].status}. Only pending submissions can be rejected.` })
    }

    await query(
      `UPDATE nclex_payment_submissions
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending'`,
      [req.user?.id, review_notes || null, submission_id]
    )

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Seed Questions (Admin only) ──────────────────────────────────────────────
router.post('/seed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' })

  const force = req.query.force === 'true'

  try {
    const existing = await query(`SELECT COUNT(*) FROM question_bank WHERE is_active = true`)
    const existingCount = parseInt(existing.rows[0].count)

    if (existingCount > 10 && !force) {
      return res.json({ message: 'Question bank already has questions', count: existingCount })
    }

    if (force && existingCount > 0) {
      await query(`DELETE FROM question_bank`)
      console.log(`[seed] Cleared ${existingCount} existing questions for re-seed.`)
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

    const action = force && existingCount > 0 ? 'Reset and re-seeded' : 'Seeded'
    res.json({ message: `${action} successfully`, inserted, replaced: force ? existingCount : 0 })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
