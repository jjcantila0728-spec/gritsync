// One-off: turn OFF maintenance mode by setting the `maintenanceMode` setting
// to 'false'. Connects with the same SSL-safe param parsing as run-migration.cjs.
require('dotenv').config()
const { Client } = require('pg')

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('DATABASE_URL is not set. Check your .env file.')
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
    const before = await c.query(`SELECT key, value FROM settings WHERE key = 'maintenanceMode'`)
    console.log('Before:', before.rows)

    const res = await c.query(
      `INSERT INTO settings (key, value) VALUES ('maintenanceMode', 'false')
       ON CONFLICT (key) DO UPDATE SET value = 'false'
       RETURNING key, value`
    )
    console.log('After :', res.rows)
    console.log('OK — maintenance mode disabled.')
  } catch (err) {
    console.error('Failed:', err.message)
    process.exitCode = 1
  } finally {
    await c.end()
  }
})()
