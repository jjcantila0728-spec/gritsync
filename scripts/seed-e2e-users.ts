/**
 * Seeds one test user for each role (admin/advisor/affiliate/client) directly
 * into the users table. Uses clearly-marked emails so the records are easy to
 * identify and clean up after the run.
 *
 * Required env: DATABASE_URL (read from .env).
 *
 * Run: npx tsx scripts/seed-e2e-users.ts
 *
 * Re-runs are idempotent: if a user with the same personal_email already
 * exists, we update the password hash and role rather than insert a duplicate.
 */

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { Client } from 'pg'

type RoleSeed = {
  role: 'admin' | 'advisor' | 'affiliate' | 'client'
  first: string
  last: string
}

const roles: RoleSeed[] = [
  { role: 'admin', first: 'Admin', last: 'TesterE2E' },
  { role: 'advisor', first: 'Advisor', last: 'TesterE2E' },
  { role: 'affiliate', first: 'Affiliate', last: 'TesterE2E' },
  { role: 'client', first: 'Client', last: 'TesterE2E' },
]

const gritId = () => `GRIT${Math.floor(100000 + Math.random() * 900000)}`

async function main() {
const STAMP = Date.now().toString().slice(-8)
const PASSWORD = 'E2eTestPass!2025'
const HASH = await bcrypt.hash(PASSWORD, 12)

const makeEmail = (role: string) => `e2e-${role}-${STAMP}@example.test`
const makeMobile = (idx: number) => `+639${(170000000 + (Number(STAMP) % 10000) + idx).toString().slice(-9)}`
const makeGritsync = (role: string) => `${role.toLowerCase()}.tester${STAMP}@gritsync.com`

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING

if (!connectionString) {
  console.error('FATAL: no DATABASE_URL/POSTGRES_URL in env')
  process.exit(1)
}

const url = new URL(connectionString.replace(/\?.*$/, ''))
const client = new Client({
  host: url.hostname,
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const seeded: { role: string; personal_email: string; password: string }[] = []

for (let i = 0; i < roles.length; i++) {
  const { role, first, last } = roles[i]
  const personal_email = makeEmail(role)
  const gritsync_email = makeGritsync(role)
  const mobile = makeMobile(i)

  // Idempotent: update if exists, insert if not.
  const existing = await client.query('SELECT id FROM users WHERE personal_email = $1', [personal_email])
  if (existing.rowCount && existing.rowCount > 0) {
    await client.query(
      `UPDATE users SET password_hash=$1, role=$2, email_verified=true, is_active=true WHERE personal_email=$3`,
      [HASH, role, personal_email]
    )
    console.log(`[seed] updated ${role}: ${personal_email}`)
  } else {
    await client.query(
      `INSERT INTO users (email, gritsync_email, personal_email, password_hash, first_name, last_name, mobile, role, grit_id, email_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true)`,
      [gritsync_email, gritsync_email, personal_email, HASH, first, last, mobile, role, gritId()]
    )
    console.log(`[seed] inserted ${role}: ${personal_email}`)
  }

  seeded.push({ role, personal_email, password: PASSWORD })
}

await client.end()

// Emit JSON so the Playwright runner can read it.
const fs = await import('node:fs')
const path = await import('node:path')
const out = path.resolve(process.cwd(), 'scripts/e2e-test-users.json')
fs.writeFileSync(out, JSON.stringify({ stamp: STAMP, password: PASSWORD, users: seeded }, null, 2), 'utf8')
console.log(`[seed] wrote ${out}`)
}

main().catch(err => {
  console.error('seed failed:', err)
  process.exit(1)
})
