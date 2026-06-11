// Runs every .sql file in scripts/migrations/ against $DATABASE_URL in
// filename order. Idempotent — every migration uses CREATE/ALTER ... IF NOT
// EXISTS, so re-running is safe.
//
// Usage:
//   node scripts/run-all-migrations.cjs                   # all migrations
//   node scripts/run-all-migrations.cjs --since 2026-05-20 # only files >= date
//
// Set DATABASE_URL in your env (or .env) to the database you want to migrate.
// For prod, that's the Supabase connection string from Supabase → Project
// Settings → Database → Connection string (URI, transaction pooler).

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations')

const args = process.argv.slice(2)
const sinceIdx = args.indexOf('--since')
const sinceDate = sinceIdx >= 0 ? args[sinceIdx + 1] : null

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`)
  process.exit(2)
}

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => !sinceDate || f >= sinceDate) // YYYY-MM-DD prefix sorts lexicographically as date
  .sort()

if (files.length === 0) {
  console.log('No migration files to run.')
  process.exit(0)
}

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Check your .env file.')
    process.exit(2)
  }
  const u = new URL(url)
  const target = `${u.hostname}/${u.pathname.replace(/^\//, '')}`
  console.log(`Target: ${target}`)
  console.log(`Found ${files.length} migration file(s)${sinceDate ? ` since ${sinceDate}` : ''}.\n`)

  const c = new Client({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // Tracking table: records which migration files have been applied so this
  // script can skip them (and so "what's applied where?" is answerable).
  // Pass --force to re-run files even if recorded (all migrations are
  // IF NOT EXISTS-idempotent, so that's safe).
  await c.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename   TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  )
  const force = args.includes('--force')
  const appliedRows = await c.query(`SELECT filename FROM schema_migrations`)
  const applied = new Set(appliedRows.rows.map((r) => r.filename))

  let failed = 0
  let skipped = 0
  for (const f of files) {
    if (!force && applied.has(f)) {
      skipped++
      continue
    }
    const full = path.join(MIGRATIONS_DIR, f)
    const sql = fs.readFileSync(full, 'utf8')
    process.stdout.write(`→ ${f} ... `)
    try {
      await c.query(sql)
      await c.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
        [f]
      )
      console.log('OK')
    } catch (err) {
      failed++
      console.log('FAILED')
      console.error(`  ${err.message}`)
      if (err.position) console.error(`  Position: ${err.position}`)
      // A migration that opens a transaction and fails leaves the connection
      // in "aborted transaction" state, which poisons every later query.
      await c.query('ROLLBACK').catch(() => {})
    }
  }
  if (skipped > 0) console.log(`(${skipped} already applied — skipped; use --force to re-run)`)

  await c.end()
  console.log(failed === 0 ? `\nDone — ${files.length} migration(s) applied.` : `\nDone with ${failed} failure(s).`)
  if (failed > 0) process.exitCode = 1
})()
