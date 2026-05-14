import { Pool, types } from 'pg'

// Return DATE columns (OID 1082) as the raw 'YYYY-MM-DD' string instead of a JS
// Date. The default parser produces a Date at midnight local time, which then
// serializes to an ISO timestamp like '2026-05-01T07:00:00.000Z' over JSON and
// shifts by the server's timezone offset — flipping the day for users in
// different TZs. Keeping DATE as a string sidesteps the whole conversion.
types.setTypeParser(1082, (v: string) => v)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
