// Runs a .sql file against $DATABASE_URL using the bundled `pg` client.
// Usage:  node scripts/run-migration.cjs path/to/migration.sql
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: node scripts/run-migration.cjs <path-to-sql>')
  process.exit(2)
}
const file = path.resolve(arg)
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`)
  process.exit(2)
}
const sql = fs.readFileSync(file, 'utf8')

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Check your .env file.')
    process.exit(2)
  }
  // Parse the URL into discrete params instead of passing `connectionString`,
  // because pg-connection-string maps Supabase's `sslmode=require` to
  // `verify-full`, which rejects Supabase's self-signed leaf cert. Same fix
  // as server/db.ts.
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
  console.log(`Running migration: ${path.relative(process.cwd(), file)}`)
  try {
    await c.query(sql)
    // Record in the tracking table so run-all-migrations.cjs skips this file.
    await c.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    )
    await c.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [path.basename(file)]
    )
    console.log('OK — migration applied.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    if (err.position) console.error('Position:', err.position)
    process.exitCode = 1
  } finally {
    await c.end()
  }
})()
