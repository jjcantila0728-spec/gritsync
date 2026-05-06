import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { json, urlencoded } from 'express'
import authRoutes from './routes/auth'
import queryRoutes from './routes/query'
import paymentRoutes from './routes/payments'
import emailRoutes from './routes/emails'
import questionRoutes, { autoSeedIfEmpty } from './routes/questions'
import storageRoutes from './routes/storage'
import contactRoutes from './routes/contact'
import messageRoutes from './routes/messages'
import { query } from './db'
import { getSeedQuestions } from './data/nclex-seed'

async function runStartupMigrations() {
  try {
    // Fix test_sessions.user_id type: ensure it is UUID to match users.id.
    // PostgreSQL cannot automatically cast integer→uuid using ALTER COLUMN SET DATA TYPE,
    // so we use DROP COLUMN + ADD COLUMN. Any rows with non-uuid user_ids are cleared
    // (sessions from before auth was UUID-based have no valid owner anyway).
    const colTypeResult = await query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'test_sessions' AND column_name = 'user_id'`
    )
    const currentType = colTypeResult.rows[0]?.data_type
    if (currentType && currentType !== 'uuid') {
      console.log(`Migrating test_sessions.user_id from ${currentType.toUpperCase()} to UUID...`)
      // Delete rows that cannot be migrated (integer ids have no uuid equivalent)
      await query(`DELETE FROM test_sessions WHERE user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`)
      await query(`ALTER TABLE test_sessions DROP COLUMN user_id`)
      await query(`ALTER TABLE test_sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE`)
      console.log('test_sessions.user_id migrated to UUID successfully.')
    }
  } catch (err) {
    console.warn('Startup migration warning (test_sessions user_id type fix):', err)
  }

  try {
    // Existing columns
    await query(`ALTER TABLE session_responses ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT false`)

    // Case study support columns
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_group VARCHAR(100)`)
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_scenario TEXT`)

    // Payment submissions table
    await query(`
      CREATE TABLE IF NOT EXISTS nclex_payment_submissions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(20) NOT NULL,
        payment_method VARCHAR(50),
        payment_reference VARCHAR(200),
        payment_amount NUMERIC(10,2),
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Payment screenshot column
    await query(`ALTER TABLE nclex_payment_submissions ADD COLUMN IF NOT EXISTS screenshot_url TEXT`)

    // Auto-seed question bank if fewer than 10 questions exist
    const countResult = await query(`SELECT COUNT(*) FROM question_bank WHERE is_active = true`)
    const count = parseInt(countResult.rows[0].count, 10)
    if (count < 10) {
      console.log(`Question bank has only ${count} questions — auto-seeding...`)
      const questions = getSeedQuestions()
      let inserted = 0
      for (const q of questions) {
        try {
          await query(
            `INSERT INTO question_bank
               (question_text, question_type, content_area, subcategory, difficulty,
                cognitive_level, is_ngn, options, correct_answer, rationale, tags,
                case_study_group, case_study_scenario, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)`,
            [
              q.question_text, q.question_type, q.content_area, q.subcategory || null,
              q.difficulty, q.cognitive_level || 'Application', q.is_ngn,
              JSON.stringify(q.options), JSON.stringify(q.correct_answer),
              q.rationale, q.tags ? q.tags.split(',').map((t: string) => t.trim()) : null,
              q.case_study_group || null, q.case_study_scenario || null,
            ]
          )
          inserted++
        } catch (seedErr: any) {
          console.warn('Seed insert warning:', seedErr.message)
        }
      }
      console.log(`Auto-seeded ${inserted} questions into the question bank.`)
    }
  } catch (err) {
    console.warn('Startup migration warning (marked_for_review):', err)
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS case_studies (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        scenario TEXT NOT NULL,
        content_area TEXT,
        difficulty TEXT DEFAULT 'medium',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  } catch (err) {
    console.warn('Startup migration warning (case_studies table):', err)
  }

  try {
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_id INTEGER REFERENCES case_studies(id) ON DELETE SET NULL`)
  } catch (err) {
    console.warn('Startup migration warning (case_study_id column):', err)
  }

  try {
    await query(`ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)
  } catch (err) {
    console.warn('Startup migration warning (case_studies updated_at):', err)
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_question_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, question_id)
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_uqb_user_id ON user_question_bookmarks(user_id)`)
  } catch (err) {
    console.warn('Startup migration warning (user_question_bookmarks table):', err)
  }

  await autoSeedIfEmpty()

  // Messages table migration — fully idempotent, never drops data
  try {
    // 1. Ensure the table exists with the minimal required shape
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT,
        body TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    // 2. Additive column additions for existing tables
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT`)
    // 3. Indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`)
    console.log('Messages table ready.')
  } catch (err) {
    console.warn('Startup migration warning (messages table):', err)
  }
}

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
app.use('/api/contact', contactRoutes)
app.use('/api/messages', messageRoutes)

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
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
  runStartupMigrations().catch((err) => {
    console.error('Unhandled error in startup migrations (non-fatal):', err)
  })
})

export default app
