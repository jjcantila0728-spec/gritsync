import { api } from './api'

interface DbListOptions {
  filter?: Record<string, string | number | boolean | null | undefined>
  select?: string
  order?: string
  limit?: number
  offset?: number
}

function buildParams(opts: DbListOptions = {}) {
  const params: Record<string, string> = {}
  if (opts.select) params.select = opts.select
  if (opts.order) params.order = opts.order
  if (typeof opts.limit === 'number') params.limit = String(opts.limit)
  if (typeof opts.offset === 'number') params.offset = String(opts.offset)
  for (const [k, v] of Object.entries(opts.filter ?? {})) {
    if (v === undefined || v === null) continue
    // Send the raw value — the server's /api/db/:table applies `eq` itself via
    // supabase-js. Sending `eq.<v>` here would double-prefix to `eq.eq.<v>`
    // and silently return zero rows (e.g. uploaded docs not showing).
    params[k] = String(v)
  }
  return params
}

export async function dbList<T = unknown>(table: string, opts: DbListOptions = {}): Promise<T[]> {
  const res = await api.get<{ data: T[] | null }>(`/db/${table}`, { params: buildParams(opts) })
  return res.data?.data ?? []
}

export async function dbFirst<T = unknown>(table: string, opts: DbListOptions = {}): Promise<T | null> {
  const rows = await dbList<T>(table, { ...opts, limit: 1 })
  return rows[0] ?? null
}
