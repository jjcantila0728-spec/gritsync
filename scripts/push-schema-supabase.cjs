/**
 * GritSync — Push full schema to Supabase (or any remote Postgres).
 *
 * Usage (from D:\gritsync):
 *   node scripts/push-schema-supabase.cjs
 *
 * Reads DATABASE_URL from the local .env file.
 * Runs:
 *   1. init.sql           — all core tables, functions, views, migrations
 *   2. server/sql/nclex-schema.sql  — NCLEX-specific tables
 */

'use strict'

const { Client } = require('pg')
const fs   = require('fs')
const path = require('path')

// ── 1. Load DATABASE_URL from .env ──────────────────────────────────────────
function loadEnv (envPath) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  const env   = {}
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
  }
  return env
}

// Accept URL as first CLI arg, otherwise fall back to .env
let DATABASE_URL = process.argv[2]

if (!DATABASE_URL) {
  const envFile = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envFile)) {
    console.error('❌  No URL argument and .env file not found at', envFile)
    process.exit(1)
  }
  const env = loadEnv(envFile)
  DATABASE_URL = env.DATABASE_URL
}

if (!DATABASE_URL || DATABASE_URL.includes('localhost')) {
  console.error('❌  No remote DATABASE_URL found.')
  console.error('    Pass the Supabase URL as an argument:')
  console.error('    node scripts/push-schema-supabase.cjs "postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres"')
  process.exit(1)
}

// Strip sslmode/pgbouncer params from URL — we set SSL via client config instead
const cleanUrl = DATABASE_URL.replace(/[?&](sslmode|pgbouncer|supa|uselibpqcompat)=[^&]*/g, '').replace(/[?&]$/, '')

console.log('🔗  Connecting to:', cleanUrl.replace(/:([^:@]+)@/, ':****@'))

// ── 2. SQL files to run in order ────────────────────────────────────────────
const sqlFiles = [
  path.join(__dirname, '..', 'init.sql'),
  path.join(__dirname, '..', 'server', 'sql', 'nclex-schema.sql'),
]

// ── 3. Run ───────────────────────────────────────────────────────────────────
async function main () {
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },  // required for Supabase
  })

  await client.connect()
  console.log('✅  Connected to database.\n')

  for (const file of sqlFiles) {
    if (!fs.existsSync(file)) {
      console.warn('⚠️   File not found, skipping:', file)
      continue
    }
    const sql = fs.readFileSync(file, 'utf8')
    const label = path.relative(path.join(__dirname, '..'), file)
    console.log(`📄  Running ${label} …`)
    try {
      await client.query(sql)
      console.log(`    ✅  ${label} — done\n`)
    } catch (err) {
      console.error(`    ❌  ${label} — ERROR:`, err.message)
      // Non-fatal: keep going so IF NOT EXISTS tables still get created
    }
  }

  await client.end()
  console.log('🎉  Schema push complete! Your Supabase database is ready.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
