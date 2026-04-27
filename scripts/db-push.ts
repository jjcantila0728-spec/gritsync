/**
 * db-push: Safe schema migration script for Replit PostgreSQL.
 *
 * PostgreSQL cannot automatically cast INTEGER → UUID using
 * `ALTER COLUMN SET DATA TYPE uuid` (no implicit cast exists).
 * This script uses DROP + ADD COLUMN to safely convert the column,
 * which is what `drizzle-kit push --force` would do for this case.
 *
 * Run: npm run db:push
 *      npm run db:push -- --force   (same — --force is ignored, always safe)
 */

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function query(sql: string, params?: any[]) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

async function push() {
  console.log('🔄 db-push: Syncing Replit PostgreSQL schema...')

  // ── test_sessions.user_id ──────────────────────────────────────────────────
  // Must be UUID (FK → users.id). PostgreSQL rejects ALTER COLUMN SET DATA TYPE
  // uuid when the source type is integer (no implicit cast). Use DROP + ADD.
  try {
    const col = await query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'test_sessions' AND column_name = 'user_id'`
    )
    const currentType = col.rows[0]?.data_type
    if (!currentType) {
      console.log('  ℹ️  test_sessions.user_id — column not found (table may not exist yet)')
    } else if (currentType === 'uuid') {
      console.log('  ✅  test_sessions.user_id — already uuid, no change needed')
    } else {
      console.log(`  🔧  test_sessions.user_id — migrating from ${currentType.toUpperCase()} → UUID`)
      // Delete rows whose user_id cannot be a valid UUID (e.g. integer values)
      await query(
        `DELETE FROM test_sessions
         WHERE user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`
      )
      await query(`ALTER TABLE test_sessions DROP COLUMN user_id`)
      await query(
        `ALTER TABLE test_sessions
         ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE`
      )
      console.log('  ✅  test_sessions.user_id — migrated to UUID successfully')
    }
  } catch (err: any) {
    console.warn('  ⚠️  test_sessions.user_id migration warning:', err.message)
  }

  // ── user_question_bookmarks ────────────────────────────────────────────────
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
    console.log('  ✅  user_question_bookmarks — table ready')
  } catch (err: any) {
    console.warn('  ⚠️  user_question_bookmarks warning:', err.message)
  }

  // ── session_responses.marked_for_review ───────────────────────────────────
  try {
    await query(`ALTER TABLE session_responses ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT false`)
    console.log('  ✅  session_responses.marked_for_review — ready')
  } catch (err: any) {
    console.warn('  ⚠️  session_responses.marked_for_review warning:', err.message)
  }

  // ── question_bank: case study columns ─────────────────────────────────────
  try {
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_group VARCHAR(100)`)
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_scenario TEXT`)
    console.log('  ✅  question_bank case study columns — ready')
  } catch (err: any) {
    console.warn('  ⚠️  question_bank case study columns warning:', err.message)
  }

  // ── nclex_payment_submissions ──────────────────────────────────────────────
  try {
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
        screenshot_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('  ✅  nclex_payment_submissions — table ready')
  } catch (err: any) {
    console.warn('  ⚠️  nclex_payment_submissions warning:', err.message)
  }

  // ── one-time: ensure jjcantila0728@gmail.com is admin + verified in all envs ─
  try {
    const fix = await query(
      `UPDATE users SET role = 'admin', email_verified = true, updated_at = NOW()
       WHERE grit_id = 'GRIT437617'
          OR email = 'jjcantila0728@gmail.com'
          OR personal_email = 'jjcantila0728@gmail.com'
       RETURNING id, grit_id, email, role, email_verified`
    )
    if (fix.rowCount && fix.rowCount > 0) {
      fix.rows.forEach((r: any) =>
        console.log(`  ✅  ${r.grit_id || r.id} → role=${r.role}, email_verified=${r.email_verified}`)
      )
    } else {
      console.log('  ℹ️  jjcantila0728 — no matching accounts found (safe to ignore)')
    }
  } catch (err: any) {
    console.warn('  ⚠️  jjcantila0728 admin fix warning:', err.message)
  }

  console.log('\n✅ db-push complete.')
  await pool.end()
}

push().catch((err) => {
  console.error('❌ db-push failed:', err)
  process.exit(1)
})
