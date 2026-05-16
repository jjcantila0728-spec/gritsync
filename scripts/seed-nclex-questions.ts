/**
 * One-shot seeder for `nclex_questions` from server/data/nclex-seed.ts.
 *
 * Why this exists: the legacy seed in server/routes/questions.ts writes to
 * the old `question_bank` table; review.gritsync.com's NCLEX learner
 * experience reads from `nclex_questions` (a separate table introduced by
 * the 2026-05-15_nclex_schema migration). Result: 184 sample questions
 * already existed in code, none in the table the new app actually queries.
 *
 * This script converts each SeedQuestion into the nclex_questions schema
 * and upserts. Idempotent — the id is derived from a content hash so
 * re-running won't duplicate rows.
 *
 * Usage:
 *   npx tsx scripts/seed-nclex-questions.ts
 *
 * Env: DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL (same as
 * scripts/run-migration.cjs).
 */

import 'dotenv/config'
import { Client } from 'pg'
import { createHash } from 'crypto'
import { getSeedQuestions, type SeedQuestion } from '../server/data/nclex-seed'

// ── Mappings from seed shape → nclex_questions enum values ───────────────────

const FORMAT_MAP: Record<string, string> = {
  traditional_mcq: 'MCQ',
  ngn_sata: 'SATA',
  ngn_cloze: 'DROP_DOWN',
  ngn_matrix: 'MATRIX_MCQ',
}

const TOPIC_MAP: Record<string, string> = {
  safe_effective_care_environment: 'Safe & Effective Care',
  physiological_integrity: 'Physiological Integrity',
  psychosocial_integrity: 'Psychosocial Integrity',
  health_promotion_and_maintenance: 'Health Promotion & Maintenance',
}

const DIFFICULTY_MAP: Record<string, number> = {
  easy: 0.3,
  medium: 0.5,
  hard: 0.75,
}

// ── correct_answer rebuilders per format ────────────────────────────────────
// The seed stores `{ value: 'c' }` or `{ values: [...] }` or
// `{ cells: [...] }`. nclex_questions wants the unboxed shape per format:
//   MCQ          → "c"
//   SATA         → ["a","c"]
//   DROP_DOWN    → array of indices (we don't have those in seed → skip)
//   MATRIX_MCQ   → array of indices (we approximate from cells)
function shapeCorrectAnswer(format: string, raw: any): any {
  if (!raw) return null
  if (format === 'MCQ') return raw.value
  if (format === 'SATA') return raw.values || []
  if (format === 'MATRIX_MCQ') {
    // cells: [[rowIdx, colIdLetter], ...]  →  number[] of column indices
    // 'a' → 0, 'b' → 1, 'c' → 2, ...
    if (Array.isArray(raw.cells)) {
      return raw.cells.map((cell: any[]) => {
        const c = String(cell[1] ?? 'a').toLowerCase()
        return c.charCodeAt(0) - 'a'.charCodeAt(0)
      })
    }
    return []
  }
  if (format === 'DROP_DOWN') {
    // Best-effort: assume `value` is the chosen index
    return Array.isArray(raw.values) ? raw.values : [raw.value]
  }
  return raw
}

// Stable id from content so re-runs don't duplicate.
function makeId(q: SeedQuestion): string {
  const h = createHash('sha1')
    .update(q.question_text + '|' + (q.question_type || ''))
    .digest('hex')
    .slice(0, 16)
  return `seed_${h}`
}

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('No DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL set.')
    process.exit(2)
  }
  const u = new URL(url)
  const c = new Client({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const before = await c.query(`SELECT COUNT(*)::int AS c FROM nclex_questions`)
  console.log(`Before: ${before.rows[0].c} questions in nclex_questions`)

  const seed = getSeedQuestions()
  let inserted = 0
  let skippedFormat = 0
  let updated = 0

  for (const q of seed) {
    const format = FORMAT_MAP[q.question_type]
    if (!format) {
      skippedFormat++
      continue
    }
    const id = makeId(q)
    const bank = q.is_ngn ? 'NGN' : 'CLASSIC'
    const topic = TOPIC_MAP[q.content_area] || q.content_area
    const difficulty = DIFFICULTY_MAP[q.difficulty] ?? 0.5
    const correctAnswer = shapeCorrectAnswer(format, q.correct_answer)

    const result = await c.query(
      `INSERT INTO nclex_questions
         (id, bank, format, stem, options, correct_answer, rationale,
          topic, subtopic, difficulty, discrimination, is_active, metadata,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,TRUE,$12::jsonb,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         stem = EXCLUDED.stem,
         options = EXCLUDED.options,
         correct_answer = EXCLUDED.correct_answer,
         rationale = EXCLUDED.rationale,
         topic = EXCLUDED.topic,
         subtopic = EXCLUDED.subtopic,
         difficulty = EXCLUDED.difficulty,
         updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [
        id, bank, format, q.question_text,
        JSON.stringify(q.options), JSON.stringify(correctAnswer),
        q.rationale, topic, q.subcategory || null, difficulty, 0.5,
        JSON.stringify({ seed: true, original_type: q.question_type, tags: q.tags || '' }),
      ],
    )
    if (result.rows[0]?.inserted) inserted++
    else updated++
  }

  const after = await c.query(`SELECT COUNT(*)::int AS c FROM nclex_questions`)
  console.log(`After:  ${after.rows[0].c} questions in nclex_questions`)
  console.log(`Inserted: ${inserted}, Updated: ${updated}, Skipped (unsupported format): ${skippedFormat}`)

  const byBank = await c.query(`SELECT bank, COUNT(*)::int AS c FROM nclex_questions GROUP BY bank ORDER BY bank`)
  console.log('By bank:')
  byBank.rows.forEach(r => console.log(`  ${r.bank}: ${r.c}`))

  await c.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
