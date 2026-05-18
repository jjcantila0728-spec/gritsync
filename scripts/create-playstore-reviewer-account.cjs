#!/usr/bin/env node
/**
 * Create / refresh the dedicated Play Console reviewer account.
 *
 * Google's "App access" form needs working credentials so the review
 * team can sign in and test the app's restricted areas. Using a real
 * client account is risky (we'd be sharing a customer's PII), and a
 * disposable test account that gets re-created with a fresh password
 * before every Play Console review is the safest pattern.
 *
 * Idempotent — re-running the script:
 *   - resets the password on the existing reviewer row, OR
 *   - inserts a new one if it's the first run.
 *
 * Output prints the credentials Google needs. Save them in Play Console
 * → App access → "Some functionality is restricted" → fill the form.
 *
 * Required env (from .env):
 *   DATABASE_URL or POSTGRES_*  (Postgres connection)
 *
 * Optional env:
 *   PLAYSTORE_REVIEWER_EMAIL    default playstore-reviewer@gritsync.com
 *   PLAYSTORE_REVIEWER_PASSWORD default randomly generated 16-char string
 */
require('dotenv').config()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { Client } = require('pg')

const EMAIL = (process.env.PLAYSTORE_REVIEWER_EMAIL || 'playstore-reviewer@gritsync.com').toLowerCase()
const PASSWORD =
  process.env.PLAYSTORE_REVIEWER_PASSWORD || generatePassword(16)

function generatePassword(len) {
  // Memorable enough for a reviewer to type, random enough to be safe.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz!@$'
  let s = ''
  while (s.length < len) {
    const byte = crypto.randomBytes(1)[0]
    if (byte < (256 - (256 % chars.length))) s += chars[byte % chars.length]
  }
  return s
}

function generateGritId() {
  const num = Math.floor(100000 + Math.random() * 900000)
  return `GRIT${num}`
}

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Check .env')
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

  try {
    const hash = await bcrypt.hash(PASSWORD, 12)

    // Try update first — if no row matches, fall back to insert.
    const upd = await c.query(
      `UPDATE users SET password_hash = $2, email_verified = true, is_active = true,
                       updated_at = NOW()
        WHERE LOWER(email) = $1 OR LOWER(personal_email) = $1
        RETURNING id, email, grit_id, role`,
      [EMAIL, hash],
    )

    let userRow
    if (upd.rowCount && upd.rowCount > 0) {
      userRow = upd.rows[0]
      console.log(`✔ Reset password on existing reviewer ${userRow.email} (id ${userRow.id})`)
    } else {
      const grit_id = generateGritId()
      const ins = await c.query(
        `INSERT INTO users (
           email, personal_email, password_hash, role,
           first_name, last_name, grit_id,
           email_verified, is_active, created_at
         )
         VALUES ($1, $1, $2, 'client', 'Play Store', 'Reviewer', $3, true, true, NOW())
         RETURNING id, email, grit_id, role`,
        [EMAIL, hash, grit_id],
      )
      userRow = ins.rows[0]
      console.log(`✔ Created new reviewer account ${userRow.email} (id ${userRow.id})`)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Play Console → App access → "Some functionality is restricted"')
    console.log('')
    console.log('  Login URL: https://app.gritsync.com/login')
    console.log(`  Username:  ${userRow.email}`)
    console.log(`  Password:  ${PASSWORD}`)
    console.log(`  GRIT ID:   ${userRow.grit_id}`)
    console.log('')
    console.log('  Notes for the reviewer:')
    console.log('  • Sign in with the credentials above.')
    console.log('  • All app features are reachable from the home screen tabs.')
    console.log('  • To exit the in-app NCLEX exam runner, tap the X icon')
    console.log('    in the top-left then confirm "End exam".')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (err) {
    console.error('Failed:', err.message)
    process.exitCode = 1
  } finally {
    await c.end()
  }
})()
