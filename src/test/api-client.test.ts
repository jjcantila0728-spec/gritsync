import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/lib/api-client'

/**
 * Unit tests for the local-Postgres API client (`db`) — a Supabase-style
 * chainable query builder that talks to the Express `/api` backend.
 * `fetch` is mocked so these run with no server.
 */

type FetchCall = { url: string; init: RequestInit | undefined }

let calls: FetchCall[]
let nextResponses: Array<{ ok?: boolean; status?: number; body: any }>

function jsonResponse({ ok = true, status = 200, body }: { ok?: boolean; status?: number; body: any }) {
  return {
    ok,
    status,
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)]),
  } as unknown as Response
}

beforeEach(() => {
  calls = []
  nextResponses = []
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    const next = nextResponses.shift()
    if (!next) return jsonResponse({ body: { data: [], error: null } })
    return jsonResponse(next)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('db query builder — select', () => {
  it('GETs /api/db/<table> with select + filters + order + limit', async () => {
    nextResponses.push({ body: { data: [{ id: '1', status: 'pending' }], error: null } })

    const { data, error } = await db
      .from('applications')
      .select('id, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)

    expect(error).toBeNull()
    expect(data).toEqual([{ id: '1', status: 'pending' }])
    expect(calls).toHaveLength(1)
    const url = new URL(calls[0].url, 'http://localhost')
    expect(url.pathname).toBe('/api/db/applications')
    expect(url.searchParams.get('select')).toBe('id, status')
    expect(url.searchParams.get('status')).toBe('pending')
    expect(url.searchParams.get('order')).toBe('created_at.desc')
    expect(url.searchParams.get('limit')).toBe('10')
  })

  it('encodes comparison operators as a JSON filter blob', async () => {
    nextResponses.push({ body: { data: [], error: null } })
    await db.from('notifications').select('*').lt('created_at', '2020-01-01')
    const url = new URL(calls[0].url, 'http://localhost')
    expect(JSON.parse(url.searchParams.get('created_at')!)).toEqual({ _op: 'lt', value: '2020-01-01' })
  })

  it('single() returns the first row, or a PGRST116-style error when empty', async () => {
    nextResponses.push({ body: { data: [{ id: 'abc' }], error: null } })
    const ok = await db.from('users').select('*').eq('id', 'abc').single()
    expect(ok.data).toEqual({ id: 'abc' })
    expect(ok.error).toBeNull()

    nextResponses.push({ body: { data: [], error: null } })
    const empty = await db.from('users').select('*').eq('id', 'missing').single()
    expect(empty.data).toBeNull()
    expect(empty.error?.code).toBe('PGRST116')
  })

  it('maybeSingle() returns null (not an error) when empty', async () => {
    nextResponses.push({ body: { data: [], error: null } })
    const res = await db.from('users').select('*').eq('id', 'missing').maybeSingle()
    expect(res.data).toBeNull()
    expect(res.error).toBeNull()
  })

  it('surfaces a non-2xx response as { data: null, error }', async () => {
    nextResponses.push({ ok: false, status: 500, body: { error: { message: 'boom' } } })
    const res = await db.from('applications').select('*')
    expect(res.data).toBeNull()
    expect(res.error?.message).toBe('boom')
  })

  it('with { count: "exact", head: true } hits /count and skips the row fetch', async () => {
    nextResponses.push({ body: { data: 42, error: null } }) // the /count response
    const res = await db.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'paid')
    expect(res.count).toBe(42)
    expect(res.data).toBeNull()
    expect(calls).toHaveLength(1)
    const url = new URL(calls[0].url, 'http://localhost')
    expect(url.pathname).toBe('/api/db/applications/count')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ status: 'paid' })
  })

  it('with { count: "exact" } (no head) returns both the rows and the count', async () => {
    nextResponses.push({ body: { data: 2, error: null } })          // /count
    nextResponses.push({ body: { data: [{ id: '1' }, { id: '2' }], error: null } }) // rows
    const res = await db.from('applications').select('*', { count: 'exact' })
    expect(res.count).toBe(2)
    expect(res.data).toHaveLength(2)
    expect(calls).toHaveLength(2)
  })
})

describe('db query builder — mutations', () => {
  it('insert() POSTs to /api/db/<table> with the record + returning', async () => {
    nextResponses.push({ body: { data: { id: 'new', name: 'x' }, error: null } })
    const res = await db.from('subscribers').insert({ email: 'a@b.com' }).select('*').single()
    expect(res.error).toBeNull()
    expect(res.data).toEqual({ id: 'new', name: 'x' })
    expect(calls[0].url).toContain('/api/db/subscribers')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'a@b.com', returning: '*' })
  })

  it('update() PATCHes with _filters and _returning', async () => {
    nextResponses.push({ body: { data: [{ id: '1', status: 'done' }], error: null } })
    const res = await db.from('applications').update({ status: 'done' }).eq('id', '1')
    expect(res.error).toBeNull()
    expect(calls[0].init?.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ status: 'done', _filters: { id: '1' }, _returning: '*' })
  })

  it('delete() DELETEs with the filters as the body', async () => {
    nextResponses.push({ body: { data: [{ id: '1' }], error: null } })
    await db.from('notifications').delete().eq('user_id', 'u1').lt('created_at', '2020-01-01')
    expect(calls[0].init?.method).toBe('DELETE')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      user_id: 'u1',
      created_at: { _op: 'lt', value: '2020-01-01' },
    })
  })
})

describe('db.auth', () => {
  it('getSession() returns null when there is no stored token', async () => {
    const { data } = await db.auth.getSession()
    expect(data.session).toBeNull()
  })

  it('signInWithPassword() stores the session on success', async () => {
    nextResponses.push({
      body: { session: { access_token: 'tok', refresh_token: 'ref', user: { id: 'u1', email: 'a@b.com' } } },
    })
    const { data, error } = await db.auth.signInWithPassword({ email: 'a@b.com', password: 'pw' })
    expect(error).toBeNull()
    expect(data.user).toEqual({ id: 'u1', email: 'a@b.com' })
    expect(localStorage.getItem('gritsync_token')).toBe('tok')
    expect(localStorage.getItem('gritsync_refresh_token')).toBe('ref')

    const { data: sess } = await db.auth.getSession()
    expect(sess.session?.access_token).toBe('tok')
  })

  it('signInWithPassword() returns the error and stores nothing on failure', async () => {
    nextResponses.push({ ok: false, status: 401, body: { error: 'Invalid login credentials' } })
    const { data, error } = await db.auth.signInWithPassword({ email: 'a@b.com', password: 'bad' })
    expect(error).toBeTruthy()
    expect(data.session).toBeNull()
    expect(localStorage.getItem('gritsync_token')).toBeNull()
  })

  it('signUp() forwards `options.data` and reports verification-required', async () => {
    nextResponses.push({ body: { requiresVerification: true, personal_email: 'me@gmail.com' } })
    const { data, error } = await db.auth.signUp({
      password: 'pw',
      options: { data: { first_name: 'A', last_name: 'B', mobile: '5551234567', personal_email: 'me@gmail.com' } },
    })
    expect(error).toBeNull()
    expect((data as any).requiresVerification).toBe(true)
    expect((data as any).personal_email).toBe('me@gmail.com')
    expect(calls[0].url).toContain('/api/auth/register')
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ password: 'pw', first_name: 'A', personal_email: 'me@gmail.com' })
  })

  it('signOut() clears the stored session', async () => {
    localStorage.setItem('gritsync_token', 'tok')
    localStorage.setItem('gritsync_user', JSON.stringify({ id: 'u1' }))
    nextResponses.push({ body: {} })
    const { error } = await db.auth.signOut()
    expect(error).toBeNull()
    expect(localStorage.getItem('gritsync_token')).toBeNull()
    expect(localStorage.getItem('gritsync_user')).toBeNull()
  })
})

describe('db.channel (realtime stub)', () => {
  it('returns a chainable no-op channel', () => {
    const ch = db.channel('anything')
    expect(typeof ch.on).toBe('function')
    expect(ch.on('postgres_changes', {}, () => {})).toBe(ch)
    const sub = ch.subscribe()
    expect(typeof sub.unsubscribe).toBe('function')
    expect(() => sub.unsubscribe()).not.toThrow()
  })
})
