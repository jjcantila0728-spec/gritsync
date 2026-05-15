/**
 * Database access layer.
 *
 * Uses one-shot pg.Client (never pg.Pool) so there are no persistent
 * connections to manage in Vercel's serverless environment.
 * Each query opens a client, runs, and closes — Supabase's Supavisor
 * pooler (POSTGRES_PRISMA_URL) handles actual connection pooling
 * server-side, so this is cheap.
 *
 * The supabaseAdmin export is used by routes that prefer the HTTP
 * PostgREST API (e.g. server/routes/query.ts).
 */

import { Client, types } from 'pg'

// Return DATE columns as raw 'YYYY-MM-DD' string, not a JS Date.
types.setTypeParser(1082, (v: string) => v)

export { supabaseAdmin } from './lib/supabase'

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING

if (!connectionString) {
  console.error('[db] FATAL: No database connection string found.')
}

function needsSsl(): boolean {
  if (!connectionString) return false
  return (
    connectionString.includes('supabase') ||
    connectionString.includes('amazonaws') ||
    connectionString.includes('neon.tech') ||
    process.env.NODE_ENV === 'production'
  )
}

/** Run a single SQL statement, opening and closing a fresh client each time. */
export async function query(text: string, params?: any[]) {
  const client = new Client({
    connectionString,
    ssl: needsSsl() ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 25_000,
  })
  await client.connect()
  try {
    return await client.query(text, params)
  } finally {
    await client.end().catch(() => {})
  }
}

/** Run multiple statements inside a single transaction. */
export async function withTransaction<T>(
  fn: (q: (text: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  const client = new Client({
    connectionString,
    ssl: needsSsl() ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 25_000,
  })
  await client.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((text: string, params?: any[]) =>
      client.query(text, params)
    )
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await client.end().catch(() => {})
  }
}

/**
 * Compatibility shim for routes that imported the old `pool` default export.
 * (storage.ts uses `pool` for file streaming.)
 */
const pool = {
  async connect() {
    const client = new Client({
      connectionString,
      ssl: needsSsl() ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8_000,
    })
    await client.connect()
    return {
      query: (text: string, params?: any[]) => client.query(text, params),
      release: () => client.end().catch(() => {}),
    }
  },
  query: (text: string, params?: any[]) => query(text, params),
}

export default pool
