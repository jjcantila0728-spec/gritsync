// One-off verification: did the push_token migration land?
require('dotenv').config()
const { Client } = require('pg')

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
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
    const r = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name IN ('push_token','push_platform','push_token_updated_at')
        ORDER BY column_name`
    )
    console.table(r.rows)
    const idx = await c.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_push_token_idx'`
    )
    console.log('Index present:', idx.rowCount > 0)
    const trg = await c.query(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'users_push_token_touch'`
    )
    console.log('Trigger present:', trg.rowCount > 0)
  } finally {
    await c.end()
  }
})()
