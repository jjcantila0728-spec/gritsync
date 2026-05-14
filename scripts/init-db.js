/**
 * GritSync — Local Database Initialiser
 *
 * Creates the `gritsync` database (if it doesn't exist) and runs init.sql.
 *
 * Usage:
 *   node scripts/init-db.js
 *
 * Optionally override the connection via env vars:
 *   DB_USER=myuser DB_PASSWORD=mypass DB_HOST=localhost DB_PORT=5432 node scripts/init-db.js
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Config — read from env or fall back to defaults
// ---------------------------------------------------------------------------
const DB_USER     = process.env.DB_USER     || 'postgres'
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres'
const DB_HOST     = process.env.DB_HOST     || 'localhost'
const DB_PORT     = parseInt(process.env.DB_PORT || '5432', 10)
const DB_NAME     = process.env.DB_NAME     || 'gritsync'

// ---------------------------------------------------------------------------
// Step 1 — Create the database if it doesn't exist
// ---------------------------------------------------------------------------
console.log(`\n📦  Connecting to PostgreSQL as "${DB_USER}" on ${DB_HOST}:${DB_PORT} …`)

const adminClient = new pg.Client({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: DB_PORT,
  database: 'postgres', // connect to default DB first
})

try {
  await adminClient.connect()
  const res = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [DB_NAME]
  )
  if (res.rows.length === 0) {
    console.log(`🗄️   Database "${DB_NAME}" not found — creating…`)
    await adminClient.query(`CREATE DATABASE "${DB_NAME}"`)
    console.log(`✅  Database "${DB_NAME}" created.`)
  } else {
    console.log(`✅  Database "${DB_NAME}" already exists.`)
  }
} finally {
  await adminClient.end()
}

// ---------------------------------------------------------------------------
// Step 2 — Run init.sql against the gritsync database
// ---------------------------------------------------------------------------
console.log(`\n🔧  Running init.sql …`)

const gritsyncClient = new pg.Client({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
})

const sqlPath = resolve(__dirname, '..', 'init.sql')
const sql = readFileSync(sqlPath, 'utf8')

try {
  await gritsyncClient.connect()
  await gritsyncClient.query(sql)
  console.log('✅  All tables created (or already existed).')
} finally {
  await gritsyncClient.end()
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Database initialised successfully!

Next step — start the app:

    npm run dev

Then open: http://localhost:5000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
