import { Pool } from 'pg'

// Minimal one-shot pool — health checks should not share the main app pool
// so a stuck main pool doesn't mask the real connectivity error.
function makePool() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING

  if (!connectionString) return null

  const needsSsl =
    connectionString.includes('supabase') ||
    connectionString.includes('amazonaws') ||
    connectionString.includes('neon.tech') ||
    process.env.NODE_ENV === 'production'

  return new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 6_000,
  })
}

export default async function handler(req: any, res: any) {
  const start = Date.now()
  const checks: Record<string, any> = {
    env: process.env.NODE_ENV,
    ts: new Date().toISOString(),
    hasDbUrl: !!(
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING
    ),
  }

  let dbOk = false
  let dbError: string | null = null
  const pool = makePool()

  if (!pool) {
    dbError = 'No database connection string configured'
  } else {
    const client = await pool.connect().catch((err: Error) => {
      dbError = `connect: ${err.message}`
      return null
    })

    if (client) {
      try {
        const { rows } = await client.query('SELECT 1 AS ping')
        dbOk = rows[0]?.ping === 1
      } catch (err: any) {
        dbError = `query: ${err?.message}`
      } finally {
        client.release()
      }
    }

    await pool.end().catch(() => {})
  }

  checks.db = dbOk ? 'ok' : 'error'
  if (dbError) checks.dbError = dbError
  checks.latencyMs = Date.now() - start

  const ok = dbOk

  res.setHeader('Content-Type', 'application/json')
  res.statusCode = ok ? 200 : 503
  res.end(JSON.stringify({ ok, ...checks }))
}
