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

'use strict'

const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { resolve } = require('path')
const pg = require('pg')

// ---------------------------------------------------------------------------
// Config — pull from .env's DATABASE_URL when present, otherwise from
// DB_* env vars, otherwise fall back to local Postgres defaults.
// ---------------------------------------------------------------------------
function readDatabaseUrlFromEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const envPath = resolve(__dirname, '..', '.env')
    const content = readFileSync(envPath, 'utf8')
    const m = content.match(/^DATABASE_URL=(.+)$/m)
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null
  } catch { return null }
}

async function main() {
  let DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
  const databaseUrl = readDatabaseUrlFromEnv()
  if (databaseUrl) {
    const u = new URL(databaseUrl)
    DB_USER     = decodeURIComponent(u.username || 'postgres')
    DB_PASSWORD = decodeURIComponent(u.password || '')
    DB_HOST     = u.hostname || 'localhost'
    DB_PORT     = parseInt(u.port || '5432', 10)
    DB_NAME     = (u.pathname || '/gritsync').slice(1) || 'gritsync'
  } else {
    DB_USER     = process.env.DB_USER     || 'postgres'
    DB_PASSWORD = process.env.DB_PASSWORD || 'postgres'
    DB_HOST     = process.env.DB_HOST     || 'localhost'
    DB_PORT     = parseInt(process.env.DB_PORT || '5432', 10)
    DB_NAME     = process.env.DB_NAME     || 'gritsync'
  }

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
}

main().catch((err) => {
  console.error('❌  init-db failed:', err.message)
  process.exit(1)
})
