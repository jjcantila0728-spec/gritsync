import { Pool, types } from 'pg'

// Return DATE columns (OID 1082) as the raw 'YYYY-MM-DD' string instead of a JS
// Date. The default parser produces a Date at midnight local time, which then
// serializes to an ISO timestamp like '2026-05-01T07:00:00.000Z' over JSON and
// shifts by the server's timezone offset — flipping the day for users in
// different TZs. Keeping DATE as a string sidesteps the whole conversion.
types.setTypeParser(1082, (v: string) => v)

// Support both DATABASE_URL (manual) and POSTGRES_URL (Vercel Supabase integration).
// POSTGRES_PRISMA_URL is the pooler variant Vercel sets; prefer it over the direct host.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING   // Vercel Supabase direct connection

if (!connectionString) {
  console.error('[db] FATAL: No database connection string found. Set DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL in your environment variables.')
}

// SSL: enable for Supabase/any cloud host; auto-detect from the connection string.
// Never reject self-signed certs (Supabase uses a CA that Node trusts, but
// reject:false is needed for the Supavisor pooler's TLS termination).
const needsSsl =
  !!connectionString && (
    connectionString.includes('supabase') ||
    connectionString.includes('amazonaws') ||
    connectionString.includes('neon.tech') ||
    process.env.NODE_ENV === 'production'
  )

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  // Serverless-optimised pool settings:
  // Keep max low — each cold-start creates a new Pool and Supabase free tier
  // allows ~20 simultaneous connections across ALL deployments.
  max: process.env.VERCEL ? 3 : 10,
  // Release idle connections quickly (Vercel functions are short-lived).
  idleTimeoutMillis: 10_000,
  // Give up on connecting after 8 s so we surface errors fast.
  connectionTimeoutMillis: 8_000,
})

export default pool

export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

export async function withTransaction<T>(fn: (q: (text: string, params?: any[]) => Promise<any>) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((text: string, params?: any[]) => client.query(text, params))
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
