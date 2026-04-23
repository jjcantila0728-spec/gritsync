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
      question_type = 'traditional_mcq',
      content_area = 'safe_effective_care_environment',
      subcategory,
      difficulty = 'medium',
      cognitive_level = 'apply',
      is_ngn = false,
      options = [],
      correct_answer,
      rationale,
      tags = [],
    } = req.body

    if (!question_text) {
      return res.status(400).json({ error: 'question_text is required' })
    }

    const result = await query(
      `INSERT INTO question_bank
         (question_text, question_type, content_area, subcategory, difficulty,
          cognitive_level, is_ngn, options, correct_answer, rationale, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        question_text,
        question_type,
        content_area,
        subcategory || null,
        difficulty,
        cognitive_level,
        is_ngn,
        JSON.stringify(options),
        correct_answer ? JSON.stringify(correct_answer) : null,
        rationale || null,
        tags,
        req.user?.id || null,
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
         cognitive_level = COALESCE($6, cognitive_level),
         is_ngn = COALESCE($7, is_ngn),
         options = COALESCE($8, options),
         correct_answer = COALESCE($9, correct_answer),
         rationale = $10,
         tags = COALESCE($11, tags),
         is_active = COALESCE($12, is_active),
         updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        question_text || null,
        question_type || null,
        content_area || null,
        subcategory ?? null,
        difficulty || null,
        cognitive_level || null,
        is_ngn ?? null,
        options ? JSON.stringify(options) : null,
        correct_answer ? JSON.stringify(correct_answer) : null,
        rationale ?? null,
        tags || null,
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

router.post('/session/start', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const {
      session_type = 'practice',
      content_area = 'all',
      difficulty = 'all',
      question_type = 'all',
      is_ngn,
      question_count = 25,
    } = req.body

    const conditions: string[] = ['is_active = true']
    const params: any[] = []
    let paramIdx = 1

    if (content_area !== 'all') {
      conditions.push(`content_area = $${paramIdx++}`)
      params.push(content_area)
    }
    if (difficulty !== 'all' && session_type === 'practice') {
      conditions.push(`difficulty = $${paramIdx++}`)
      params.push(difficulty)
    }
    if (question_type !== 'all') {
      conditions.push(`question_type = $${paramIdx++}`)
      params.push(question_type)
    }
    if (typeof is_ngn === 'boolean') {
      conditions.push(`is_ngn = $${paramIdx++}`)
      params.push(is_ngn)
    }

    if (session_type === 'cat') {
      conditions.push(`difficulty = 'medium'`)
    }
    if (session_type === 'readiness') {
      conditions.push(`difficulty = ANY($${paramIdx++})`)
      params.push(['easy', 'medium', 'hard'])
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    let limit = question_count

    if (session_type === 'readiness') limit = 75
    if (session_type === 'cat') limit = 85

    const questionsResult = await query(
      `SELECT id, question_text, question_type, content_area, subcategory,
              difficulty, cognitive_level, is_ngn, options
       FROM question_bank ${where}
       ORDER BY RANDOM()
       LIMIT $${paramIdx}`,
      [...params, limit]
    )

    if (questionsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No questions found matching the criteria' })
    }

    const totalQuestions = questionsResult.rows.length

    const sessionResult = await query(
      `INSERT INTO test_sessions (user_id, session_type, total_questions, settings)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        userId,
        session_type,
        totalQuestions,
        JSON.stringify({ content_area, difficulty, question_type, is_ngn }),
      ]
    )

    const sessionId = sessionResult.rows[0].id

    const insertValues = questionsResult.rows
      .map((q: any, i: number) => `($1, ${q.id}, ${i + 1})`)
      .join(', ')

    await query(
      `INSERT INTO session_responses (session_id, question_id, question_order) VALUES ${insertValues}`,
      [sessionId]
    )

    res.status(201).json({
      session_id: sessionId,
      total_questions: totalQuestions,
      questions: questionsResult.rows,
    })
  } catch (error: any) {
    console.error('Start session error:', error)
    res.status(500).json({ error: error.message })
  }
})

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
      `SELECT correct_answer, rationale, question_type, is_ngn FROM question_bank WHERE id = $1`,
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
      is_correct =
        JSON.stringify(userVals) === JSON.stringify(correctVals)
    } else if (question.question_type === 'ngn_cloze') {
      const userVals = user_answer?.values || {}
      const correctVals = correctAnswer?.values || {}
      is_correct =
        JSON.stringify(userVals) === JSON.stringify(correctVals)
    } else if (question.question_type === 'ngn_matrix') {
      const userCells = (user_answer?.cells || [])
        .map((c: number[]) => c.join(','))
        .sort()
      const correctCells = (correctAnswer?.cells || [])
        .map((c: number[]) => c.join(','))
        .sort()
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

    const isComplete =
      session.session_type === 'readiness'
        ? newAnswered >= session.total_questions
        : newAnswered >= session.total_questions

    let catNextDifficulty: string | null = null

    if (session.session_type === 'cat' && !isComplete) {
      catNextDifficulty = is_correct ? 'hard' : 'easy'
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
    const result = await query(
      `SELECT * FROM test_sessions WHERE user_id = $1 ORDER BY time_started DESC LIMIT 10`,
      [userId]
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

export default router
