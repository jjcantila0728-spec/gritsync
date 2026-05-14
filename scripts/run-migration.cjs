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
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Check your .env file.')
    process.exit(2)
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  console.log(`Running migration: ${path.relative(process.cwd(), file)}`)
  try {
    await c.query(sql)
    console.log('OK — migration applied.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    if (err.position) console.error('Position:', err.position)
    process.exitCode = 1
  } finally {
    await c.end()
  }
})()
