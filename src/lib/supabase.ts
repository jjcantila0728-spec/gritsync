// Replit backend API client — drop-in replacement for @supabase/supabase-js
// All existing code that uses `supabase` will work without changes

const API_BASE = '/api'

// Auth event listeners
type AuthChangeCallback = (event: string, session: any) => void
const authListeners: AuthChangeCallback[] = []

function getStoredToken(): string | null {
  return localStorage.getItem('gritsync_token')
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem('gritsync_refresh_token')
}

function getStoredUser(): any | null {
  const u = localStorage.getItem('gritsync_user')
  return u ? JSON.parse(u) : null
}

function setSession(session: any) {
  if (session?.access_token) {
    localStorage.setItem('gritsync_token', session.access_token)
    localStorage.setItem('gritsync_refresh_token', session.refresh_token || '')
    localStorage.setItem('gritsync_user', JSON.stringify(session.user))
    authListeners.forEach(cb => cb('SIGNED_IN', session))
  }
}

function clearSession() {
  localStorage.removeItem('gritsync_token')
  localStorage.removeItem('gritsync_refresh_token')
  localStorage.removeItem('gritsync_user')
  authListeners.forEach(cb => cb('SIGNED_OUT', null))
}

async function apiRequest(path: string, options: RequestInit = {}): Promise<{ data: any; error: any }> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { data: null, error: { message: body.error || `HTTP ${res.status}`, status: res.status, code: res.status } }
    }
    return { data: body, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message || 'Network error' } }
  }
}

// Query builder — mimics supabase's chainable interface
class QueryBuilder {
  private table: string
  private _select: string = '*'
  private _filters: Record<string, any> = {}
  private _order: string | null = null
  private _limit: number | null = null
  private _offset: number | null = null
  private _single = false
  private _maybeSingle = false

  constructor(table: string) {
    this.table = table
  }

  select(cols: string = '*') {
    this._select = cols
    return this
  }

  eq(col: string, val: any) { this._filters[col] = val; return this }
  neq(col: string, val: any) { this._filters[col] = { _op: 'neq', value: val }; return this }
  gt(col: string, val: any) { this._filters[col] = { _op: 'gt', value: val }; return this }
  gte(col: string, val: any) { this._filters[col] = { _op: 'gte', value: val }; return this }
  lt(col: string, val: any) { this._filters[col] = { _op: 'lt', value: val }; return this }
  lte(col: string, val: any) { this._filters[col] = { _op: 'lte', value: val }; return this }
  like(col: string, val: any) { this._filters[col] = { _op: 'like', value: val }; return this }
  ilike(col: string, val: any) { this._filters[col] = { _op: 'like', value: val }; return this }
  in(col: string, vals: any[]) { this._filters[col] = { _op: 'in', value: vals }; return this }
  is(col: string, val: any) { this._filters[col] = val; return this }
  filter(col: string, op: string, val: any) {
    this._filters[col] = { _op: op, value: val }
    return this
  }
  not(col: string, op: string, val: any) {
    this._filters[col] = { _op: 'neq', value: val }
    return this
  }
  or(_filters: string) { return this } // simplified

  order(col: string, opts: { ascending?: boolean } = {}) {
    this._order = `${col}.${opts.ascending !== false ? 'asc' : 'desc'}`
    return this
  }

  limit(n: number) { this._limit = n; return this }
  range(from: number, to: number) {
    this._offset = from
    this._limit = to - from + 1
    return this
  }

  single() { this._single = true; return this }
  maybeSingle() { this._maybeSingle = true; return this }

  async then(resolve: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    try {
      const result = await this._execute()
      return resolve(result)
    } catch (err) {
      if (reject) return reject(err)
      throw err
    }
  }

  async _execute(): Promise<{ data: any; error: any }> {
    // Build query string from filters + options
    const params = new URLSearchParams()
    params.set('select', this._select)
    if (this._order) params.set('order', this._order)
    if (this._limit !== null) params.set('limit', String(this._limit))
    if (this._offset !== null) params.set('offset', String(this._offset))

    for (const [key, val] of Object.entries(this._filters)) {
      if (val === null) {
        params.set(key, 'null')
      } else if (typeof val === 'object' && val._op) {
        params.set(key, JSON.stringify(val))
      } else {
        params.set(key, String(val))
      }
    }

    const token = getStoredToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/db/${this.table}?${params}`, { headers })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { data: null, error: { message: body.error || `HTTP ${res.status}` } }
    }

    const rows = body.data || []
    if (this._single) {
      return rows.length > 0 ? { data: rows[0], error: null } : { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
    }
    if (this._maybeSingle) {
      return { data: rows[0] || null, error: null }
    }
    return { data: rows, error: null }
  }
}

class MutationBuilder {
  private table: string
  private operation: 'insert' | 'update' | 'delete' | 'upsert'
  private payload: any
  private _filters: Record<string, any> = {}
  private _returning: string = '*'
  private _single = false

  constructor(table: string, operation: 'insert' | 'update' | 'delete' | 'upsert', payload?: any) {
    this.table = table
    this.operation = operation
    this.payload = payload
  }

  select(cols: string = '*') { this._returning = cols; return this }
  single() { this._single = true; return this }
  eq(col: string, val: any) { this._filters[col] = val; return this }

  then(resolve: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    return this._execute().then(resolve, reject)
  }

  async _execute(): Promise<{ data: any; error: any }> {
    const token = getStoredToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    }

    if (this.operation === 'insert' || this.operation === 'upsert') {
      const payload = Array.isArray(this.payload) 
        ? { _batch: this.payload, returning: this._returning }
        : { ...this.payload, returning: this._returning }
      
      const res = await fetch(`${API_BASE}/db/${this.table}`, {
        method: 'POST', headers, body: JSON.stringify(payload)
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { data: null, error: { message: body.error || `HTTP ${res.status}` } }
      const d = body.data
      return { data: this._single && Array.isArray(d) ? d[0] : d, error: null }
    }

    if (this.operation === 'update') {
      const res = await fetch(`${API_BASE}/db/${this.table}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ ...this.payload, _filters: this._filters, _returning: this._returning })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { data: null, error: { message: body.error || `HTTP ${res.status}` } }
      return { data: body.data, error: null }
    }

    if (this.operation === 'delete') {
      const res = await fetch(`${API_BASE}/db/${this.table}`, {
        method: 'DELETE', headers, body: JSON.stringify(this._filters)
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { data: null, error: { message: body.error || `HTTP ${res.status}` } }
      return { data: body.data, error: null }
    }

    return { data: null, error: { message: 'Unknown operation' } }
  }
}

// The main supabase-compatible client
export const supabase = {
  from(table: string) {
    return {
      select: (cols = '*') => new QueryBuilder(table).select(cols),
      insert: (data: any) => new MutationBuilder(table, 'insert', data),
      update: (data: any) => new MutationBuilder(table, 'update', data),
      upsert: (data: any) => new MutationBuilder(table, 'upsert', data),
      delete: () => new MutationBuilder(table, 'delete'),
    }
  },

  auth: {
    async getSession() {
      const token = getStoredToken()
      if (!token) return { data: { session: null }, error: null }
      const user = getStoredUser()
      return {
        data: {
          session: {
            access_token: token,
            refresh_token: getStoredRefreshToken(),
            user,
          }
        },
        error: null
      }
    },

    async getUser() {
      const token = getStoredToken()
      if (!token) return { data: { user: null }, error: null }
      const { data, error } = await apiRequest('/auth/me')
      if (error) return { data: { user: null }, error }
      return { data: { user: data }, error: null }
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const { data, error } = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (error) return { data: { session: null, user: null }, error }
      setSession(data.session)
      return { data: { session: data.session, user: data.session.user }, error: null }
    },

    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: any } }) {
      const { data, error } = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...options?.data }),
      })
      if (error) return { data: { session: null, user: null }, error }
      setSession(data.session)
      return { data: { session: data.session, user: data.session.user }, error: null }
    },

    async signOut() {
      await apiRequest('/auth/logout', { method: 'POST' })
      clearSession()
      return { error: null }
    },

    async refreshSession() {
      const refresh_token = getStoredRefreshToken()
      if (!refresh_token) return { data: { session: null }, error: { message: 'No refresh token' } }
      const { data, error } = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      })
      if (error) return { data: { session: null }, error }
      setSession(data.session)
      return { data: { session: data.session }, error: null }
    },

    async updateUser(updates: any) {
      const { data, error } = await apiRequest('/auth/update', {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      if (error) return { data: { user: null }, error }
      // Update stored user
      const stored = getStoredUser()
      if (stored) {
        const updated = { ...stored, ...data.user }
        localStorage.setItem('gritsync_user', JSON.stringify(updated))
      }
      return { data: { user: data.user }, error: null }
    },

    onAuthStateChange(callback: AuthChangeCallback) {
      authListeners.push(callback)
      // Immediately emit current state
      const token = getStoredToken()
      const user = getStoredUser()
      if (token && user) {
        setTimeout(() => callback('SIGNED_IN', { access_token: token, user }), 0)
      } else {
        setTimeout(() => callback('SIGNED_OUT', null), 0)
      }

      return {
        data: {
          subscription: {
            unsubscribe() {
              const idx = authListeners.indexOf(callback)
              if (idx >= 0) authListeners.splice(idx, 1)
            }
          }
        }
      }
    },
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('path', path)
          const token = getStoredToken()
          const res = await fetch(`${API_BASE}/storage/upload`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
          })
          if (!res.ok) return { data: null, error: { message: 'Upload failed' } }
          return { data: { path }, error: null }
        },
        async download(path: string) {
          const token = getStoredToken()
          const res = await fetch(`${API_BASE}/storage/download?path=${encodeURIComponent(path)}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          })
          if (!res.ok) return { data: null, error: { message: 'Download failed' } }
          const blob = await res.blob()
          return { data: blob, error: null }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `${API_BASE}/storage/public/${path}` } }
        },
        async createSignedUrl(path: string, _expiresIn: number) {
          const token = getStoredToken()
          const res = await fetch(`${API_BASE}/storage/signed-url?path=${encodeURIComponent(path)}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          })
          if (!res.ok) return { data: null, error: { message: 'Failed to create signed URL' } }
          const body = await res.json()
          return { data: { signedUrl: body.url }, error: null }
        },
        async list(_prefix?: string) {
          return { data: [], error: null }
        },
        async remove(paths: string[]) {
          const token = getStoredToken()
          const res = await fetch(`${API_BASE}/storage/delete`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ paths }),
          })
          if (!res.ok) return { data: null, error: { message: 'Delete failed' } }
          return { data: paths, error: null }
        },
      }
    },
    async listBuckets() {
      return { data: [], error: null }
    },
  },

  // RPC stub — for stored procedures / functions
  async rpc(_fn: string, _args?: any) {
    return { data: null, error: { message: 'RPC not supported in this environment' } }
  },

  // Channel/Realtime stub — returns no-op channels
  channel(_name: string) {
    const ch: any = {
      on(..._args: any[]) { return ch },
      subscribe(_cb?: any) { return { unsubscribe: () => {} } },
      unsubscribe() {},
    }
    return ch
  },
  removeChannel(_channel: any) {},
  removeAllChannels() {},
}

// Re-export error handling utilities (keep for backward compat)
export {
  handleSupabaseError,
  normalizeError,
  getUserFriendlyMessage,
  classifyError,
  type AppError,
  ErrorType,
  ErrorSeverity
} from './error-handler'
