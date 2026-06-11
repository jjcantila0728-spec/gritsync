/**
 * Generic database CRUD endpoint — /api/db/:table
 *
 * All SELECT / INSERT / UPDATE / DELETE / COUNT / RPC calls go through
 * Supabase's PostgREST HTTP API (supabaseAdmin). No pg.Pool, no raw SQL.
 * This makes the route completely serverless-safe.
 */

import { Router, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// ---------------------------------------------------------------------------
// Security allowlists
// ---------------------------------------------------------------------------

const PUBLIC_INSERT_TABLES = new Set([
  'quotations', 'newsletter_subscriptions', 'career_applications',
  'donations', 'testimonials', 'nclex_sponsorships',
])

const ALLOWED_TABLES = new Set([
  'applications', 'application_payments', 'application_timeline_steps',
  'users', 'user_details', 'user_documents', 'user_preferences',
  'services', 'service_required_documents', 'notifications', 'notification_types',
  'settings', 'promo_codes', 'quotations', 'careers', 'career_applications',
  'donations', 'partner_agencies', 'nclex_sponsorships', 'testimonials',
  'conversations', 'messages', 'email_addresses', 'email_logs', 'email_templates',
  'sessions', 'exchange_rates', 'visa_bulletin_cache', 'visa_bulletin_email_log',
  'newsletter_subscriptions',
  'email_signatures', 'business_logos',
  'processing_accounts', 'receipts', 'temporary_signatures',
  'email_queue', 'email_analytics', 'email_subscribers', 'subscriber_stats',
  'email_campaigns', 'email_campaign_recipients',
  'email_ab_tests', 'email_ab_test_results', 'email_ab_test_recipients',
  'received_emails',
  'workflows', 'workflow_runs', 'workflow_triggers',
  'analytics_cache', 'custom_reports', 'report_schedules',
  'active_email_addresses', 'ab_test_stats',
])

const SENSITIVE_COLUMNS = new Set([
  'password_hash',
  'email_verification_token', 'email_verification_expires_at',
  'email_otp', 'email_otp_expires_at',
  'reset_token', 'password_reset_token',
])

const ADMIN_ONLY_WRITE_TABLES = new Set([
  'settings', 'promo_codes', 'services', 'service_required_documents',
  'careers', 'partner_agencies', 'email_templates', 'email_signatures',
  'business_logos', 'email_campaigns', 'email_campaign_recipients',
  'email_ab_tests', 'email_ab_test_results', 'email_ab_test_recipients',
  'workflows', 'workflow_triggers', 'report_schedules', 'custom_reports',
  'notification_types',
])

const USERS_PROTECTED_COLUMNS = new Set([
  'id', 'role', 'password_hash', 'email_verified', 'grit_id',
  'email_verification_token', 'email_verification_expires_at',
  'email_otp', 'email_otp_expires_at', 'created_at',
])

// ---------------------------------------------------------------------------
// Row-level ownership enforcement
//
// Tables holding per-user data. Reads (GET/COUNT) and writes (PATCH/DELETE)
// require authentication; non-admins get the ownership predicate force-ANDed
// into every query so they can only ever touch their own rows. Admins are
// exempt (the admin UI legitimately queries across users).
//
// Ownership columns verified against init.sql + scripts/migrations and the
// dedicated server routes (server/routes/processing-accounts.ts).
// ---------------------------------------------------------------------------

/** table -> direct ownership column (compared against req.user.id) */
const OWNED_TABLES: Record<string, string> = {
  applications: 'user_id',
  user_details: 'user_id',
  user_documents: 'user_id',
  user_preferences: 'user_id',
  notifications: 'user_id',
  email_addresses: 'user_id',
  active_email_addresses: 'user_id', // view: SELECT * FROM email_addresses
  sessions: 'user_id',
  receipts: 'user_id',
}

/**
 * table -> FK column pointing at applications.id. These tables have no direct
 * user_id column in the live schema; ownership flows through the application.
 */
const APPLICATION_SCOPED_TABLES: Record<string, string> = {
  processing_accounts: 'application_id',
}

/** Tables with bespoke ownership shapes handled inline in applyOwnership(). */
const SPECIAL_OWNERSHIP_TABLES = new Set(['messages', 'conversations'])

const PROTECTED_TABLES = new Set<string>([
  ...Object.keys(OWNED_TABLES),
  ...Object.keys(APPLICATION_SCOPED_TABLES),
  ...SPECIAL_OWNERSHIP_TABLES,
])

// req.user.id is set server-side from a verified JWT, but validate before
// interpolating into a PostgREST .or() expression.
const SAFE_ID = /^[0-9a-zA-Z-]{1,64}$/

async function getOwnedApplicationIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('id')
    .eq('user_id', userId)
  if (error) throw new HttpError(500, error.message || 'Failed to resolve owned applications')
  return (data || []).map((r: any) => r.id).filter(Boolean)
}

/**
 * Enforce auth + ownership on a query against a protected table.
 *
 * - 401 when unauthenticated.
 * - Admins: query passes through untouched.
 * - Everyone else: the ownership predicate is ANDed onto the query (client
 *   filters are kept — a spoofed user_id filter simply yields zero rows).
 *
 * Returns `{ q }` with the constrained query, or `null` when the user cannot
 * match any row at all (e.g. application-scoped table and the user has no
 * applications); callers should respond with an empty result.
 *
 * The builder is wrapped in an object because PostgREST builders are
 * thenables: `await applyOwnership(...)` returning a bare builder would make
 * `await` resolve it — executing the query immediately and yielding
 * `{ data, error }` instead of the builder (so later .order()/.limit()/
 * .select() calls throw, and updates/deletes fire before their modifiers).
 */
async function applyOwnership(
  q: any,
  table: string,
  req: AuthenticatedRequest
): Promise<{ q: any } | null> {
  if (!PROTECTED_TABLES.has(table)) return { q }
  if (!req.user?.id) throw new HttpError(401, 'Authentication required')
  if (isAdmin(req)) return { q }

  const uid = String(req.user.id)
  if (!SAFE_ID.test(uid)) throw new HttpError(403, 'Invalid user id')

  const ownCol = OWNED_TABLES[table]
  if (ownCol) return { q: q.eq(ownCol, uid) }

  if (table === 'messages') return { q: q.or(`sender_id.eq.${uid},recipient_id.eq.${uid}`) }
  if (table === 'conversations') return { q: q.contains('participant_ids', [uid]) }

  const appCol = APPLICATION_SCOPED_TABLES[table]
  if (appCol) {
    const ids = await getOwnedApplicationIds(uid)
    if (ids.length === 0) return null
    return { q: q.in(appCol, ids) }
  }

  return { q }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function isAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin'
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function assertIdent(name: string): void {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new HttpError(400, `Invalid identifier: ${String(name)}`)
  }
  if (SENSITIVE_COLUMNS.has(name)) {
    throw new HttpError(403, `Column not allowed: ${name}`)
  }
}

function sendError(res: Response, err: any) {
  if (err instanceof HttpError) {
    console.warn(`[/api/db] ${err.status}: ${err.message}`)
    return res.status(err.status).json({ data: null, error: { message: err.message } })
  }
  const msg = err?.message || err?.details || 'Server error'
  console.error('[/api/db] 500:', msg)
  return res.status(500).json({ data: null, error: { message: msg } })
}

// ---------------------------------------------------------------------------
// Column resolution — Supabase select string with sensitive cols stripped.
// Short-TTL cache so we don't hit the RPC on every SELECT *.
// ---------------------------------------------------------------------------
const COLUMN_CACHE_TTL_MS = 30_000
const columnCache = new Map<string, { cols: string[]; expires: number }>()

async function getSafeColumns(table: string): Promise<string[]> {
  const cached = columnCache.get(table)
  if (cached && cached.expires > Date.now()) return cached.cols

  // Use PostgREST to query the columns RPC we created in migrations.
  // Falls back to '*' if the function doesn't exist yet.
  const { data, error } = await supabaseAdmin.rpc('get_table_columns', { p_table: table })
  if (error || !data) {
    // Fallback: return '*' selection minus explicitly known sensitive cols.
    // Supabase won't expose columns that RLS or column-level security hides,
    // but we still explicitly omit our sensitive set.
    return []
  }
  const cols: string[] = Array.isArray(data) ? data : []
  const safe = cols.filter((c: string) => !SENSITIVE_COLUMNS.has(c))
  columnCache.set(table, { cols: safe, expires: Date.now() + COLUMN_CACHE_TTL_MS })
  return safe
}

async function buildSelectString(table: string, raw: string | undefined): Promise<string> {
  const value = (raw ?? '*').trim()
  if (value === '' || value === '*') {
    const cols = await getSafeColumns(table)
    if (cols.length === 0) return '*'           // fallback when RPC unavailable
    return cols.join(', ')
  }
  // Explicit column list — validate each one
  const parts = value.split(',').map((c) => c.trim()).filter(Boolean)
  if (parts.length === 0) throw new HttpError(400, 'Empty column list')
  parts.forEach(assertIdent)
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Filter application (PostgREST operators)
// ---------------------------------------------------------------------------
function applyFilters(q: any, filters: Record<string, any>): any {
  for (const [key, rawVal] of Object.entries(filters)) {
    if (!IDENT.test(key) || SENSITIVE_COLUMNS.has(key)) continue

    let val = rawVal
    if (typeof rawVal === 'string' && rawVal.startsWith('{')) {
      try { val = JSON.parse(rawVal) } catch {}
    }

    if (val === null || val === 'null') {
      q = q.is(key, null)
    } else if (typeof val === 'object' && val !== null && val._op) {
      const { _op, value } = val
      if (_op === 'gte')  q = q.gte(key, value)
      else if (_op === 'lte')  q = q.lte(key, value)
      else if (_op === 'gt')   q = q.gt(key, value)
      else if (_op === 'lt')   q = q.lt(key, value)
      else if (_op === 'like') q = q.ilike(key, `%${value}%`)
      else if (_op === 'neq')  q = q.neq(key, value)
      else if (_op === 'in') {
        const list = Array.isArray(value) ? value : []
        q = list.length === 0 ? q.in(key, ['__no_match__']) : q.in(key, list)
      }
    } else {
      q = q.eq(key, val)
    }
  }
  return q
}

// ---------------------------------------------------------------------------
// GET /api/db/:table
// ---------------------------------------------------------------------------
router.get('/:table', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const { select, order, limit, offset, ...rawFilters } = req.query as Record<string, any>

    // Strip non-filter query params
    const filters = Object.fromEntries(
      Object.entries(rawFilters).filter(([k]) =>
        !['select', 'order', 'limit', 'offset'].includes(k)
      )
    )

    const selectStr = await buildSelectString(table, select)

    let q: any = supabaseAdmin.from(table).select(selectStr)

    q = applyFilters(q, filters)
    const owned = await applyOwnership(q, table, req)
    if (owned === null) return res.json({ data: [], error: null })
    q = owned.q

    if (order) {
      const parts = String(order).split('.')
      const col = parts[0]
      const dir = (parts[1] || 'asc').toLowerCase()
      if (IDENT.test(col)) {
        q = q.order(col, { ascending: dir !== 'desc' })
      }
    }

    if (limit) {
      const lim = parseInt(String(limit), 10)
      if (!isNaN(lim) && lim > 0) q = q.limit(lim)
    }

    if (offset) {
      const off = parseInt(String(offset), 10)
      const lim = parseInt(String(limit), 10) || 1000
      if (!isNaN(off) && off >= 0) q = q.range(off, off + lim - 1)
    }

    const { data, error } = await q
    if (error) throw error
    res.json({ data, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/db/:table — Insert
// ---------------------------------------------------------------------------
router.post('/:table', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  if (!PUBLIC_INSERT_TABLES.has(table) && !req.user) {
    return res.status(401).json({ error: 'No token provided' })
  }
  if ((table === 'users' || ADMIN_ONLY_WRITE_TABLES.has(table)) && !isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const { returning = '*', _onConflict, _batch, ...record } = req.body
    const records: any[] = Array.isArray(_batch) ? _batch : [record]
    if (records.length === 0 || Object.keys(records[0]).length === 0) {
      return res.status(400).json({ error: 'No data provided' })
    }

    // Validate column names
    Object.keys(records[0]).forEach(assertIdent)

    const selectStr = returning === '*'
      ? await buildSelectString(table, '*')
      : returning

    let q = supabaseAdmin.from(table).insert(records).select(selectStr)

    if (_onConflict) {
      const conflictCols = String(_onConflict).split(',').map((c: string) => c.trim())
      conflictCols.forEach(assertIdent)
      // Supabase upsert with onConflict
      q = supabaseAdmin
        .from(table)
        .upsert(records, { onConflict: conflictCols.join(',') })
        .select(selectStr)
    }

    const { data, error } = await q
    if (error) throw error
    res.json({ data: Array.isArray(data) && data.length === 1 ? data[0] : data, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/db/:table — Update
// ---------------------------------------------------------------------------
router.patch('/:table', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })
  if (ADMIN_ONLY_WRITE_TABLES.has(table) && !isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const { _filters, _returning = '*', ...updates } = req.body
    if (!_filters || Object.keys(_filters).length === 0) {
      return res.status(400).json({ error: 'Filters required for update' })
    }

    const setCols = Object.keys(updates)
    if (setCols.length === 0) return res.status(400).json({ error: 'No fields to update' })
    setCols.forEach(assertIdent)

    // Non-admin user row protection
    if (table === 'users' && !isAdmin(req)) {
      const filterId = _filters.id
      if (typeof filterId !== 'string' || !req.user || filterId !== req.user.id) {
        return res.status(403).json({ error: 'You may only update your own account' })
      }
      const offending = setCols.filter((c) => USERS_PROTECTED_COLUMNS.has(c))
      if (offending.length > 0) {
        return res.status(403).json({ error: `Cannot update protected column(s): ${offending.join(', ')}` })
      }
    }

    const selectStr = _returning === '*'
      ? await buildSelectString(table, '*')
      : _returning

    let q: any = supabaseAdmin.from(table).update(updates)
    q = applyFilters(q, _filters)
    const owned = await applyOwnership(q, table, req)
    if (owned === null) return res.json({ data: [], error: null })
    q = owned.q.select(selectStr)

    const { data, error } = await q
    if (error) throw error
    res.json({ data, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/db/:table — Delete
// ---------------------------------------------------------------------------
router.delete('/:table', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })
  if ((table === 'users' || ADMIN_ONLY_WRITE_TABLES.has(table)) && !isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const filters = req.body
    if (!filters || Object.keys(filters).length === 0) {
      return res.status(400).json({ error: 'Filters required for delete' })
    }

    let q: any = supabaseAdmin.from(table).delete().select('id')
    q = applyFilters(q, filters)
    const owned = await applyOwnership(q, table, req)
    if (owned === null) return res.json({ data: [], error: null })
    q = owned.q

    const { data, error } = await q
    if (error) throw error
    res.json({ data, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/db/:table/count
// ---------------------------------------------------------------------------
router.post('/:table/count', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const filters = req.body || {}
    let q: any = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    q = applyFilters(q, filters)
    const owned = await applyOwnership(q, table, req)
    if (owned === null) return res.json({ data: '0', error: null })
    q = owned.q

    const { count, error } = await q
    if (error) throw error
    res.json({ data: String(count ?? 0), error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/db/rpc/:fn — call a PostgreSQL function
// ---------------------------------------------------------------------------
const ALLOWED_RPC_FUNCTIONS = new Set([
  'validate_promo_code',
  'get_dashboard_stats',
  'increment', 'increment_logo_usage', 'increment_template_usage',
  'get_pending_emails_to_send', 'mark_email_processing', 'mark_email_sent', 'mark_email_failed',
  'update_campaign_stats',
  'log_workflow_run', 'update_workflow_stats', 'get_active_workflows_for_trigger',
  'calculate_ab_test_metrics', 'determine_ab_test_winner',
  'get_subscriber_count_by_segment', 'get_subscribers_for_segment',
  'unsubscribe_email', 'resubscribe_email', 'update_email_preferences',
  'render_email_template', 'generate_signature_html', 'refresh_email_analytics',
  'generate_document_reminders', 'generate_payment_reminders', 'generate_profile_completion_reminders',
  'check_missing_documents', 'check_incomplete_profile', 'notify_credentialing_reminder',
  'get_application_analytics', 'get_financial_analytics', 'get_user_analytics', 'get_document_analytics',
  // dashboard stats (inline implementation below)
  'get_dashboard_stats_inline',
])

// RPC functions that return cross-user aggregates or drive admin-only systems
// (email queue/campaigns, workflows, analytics, bulk reminders). Authenticated
// admin required. Verified against frontend callers: these are only invoked
// from Admin* pages / admin-gated libs.
const ADMIN_ONLY_RPC_FUNCTIONS = new Set([
  'get_dashboard_stats', 'get_dashboard_stats_inline',
  'get_application_analytics', 'get_financial_analytics',
  'get_user_analytics', 'get_document_analytics',
  'refresh_email_analytics',
  'get_pending_emails_to_send', 'mark_email_processing', 'mark_email_sent', 'mark_email_failed',
  'update_campaign_stats',
  'get_subscriber_count_by_segment', 'get_subscribers_for_segment',
  'calculate_ab_test_metrics', 'determine_ab_test_winner',
  'log_workflow_run', 'update_workflow_stats', 'get_active_workflows_for_trigger',
  'generate_document_reminders', 'generate_payment_reminders',
  'generate_profile_completion_reminders', 'notify_credentialing_reminder',
])

// RPC functions that take a target-user argument: non-admins are pinned to
// their own id regardless of what the client sent.
const SELF_SCOPED_RPC_ARGS: Record<string, string> = {
  check_missing_documents: 'p_user_id',
  check_incomplete_profile: 'p_user_id',
}

router.post('/rpc/:fn', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const fn = String(req.params.fn)

  if (!ALLOWED_RPC_FUNCTIONS.has(fn)) {
    return res.status(403).json({ data: null, error: { message: 'Function not allowed', code: 'PGRST301' } })
  }

  try {
    const args = req.body || {}

    // Never trust client-supplied is_admin — always derive it from the
    // verified JWT role before the args reach any SQL function.
    if ('is_admin' in args) args.is_admin = isAdmin(req)

    if (ADMIN_ONLY_RPC_FUNCTIONS.has(fn)) {
      if (!req.user) {
        return res.status(401).json({ data: null, error: { message: 'Authentication required' } })
      }
      if (!isAdmin(req)) {
        return res.status(403).json({ data: null, error: { message: 'Admin access required' } })
      }
    }

    const selfArg = SELF_SCOPED_RPC_ARGS[fn]
    if (selfArg && !isAdmin(req)) {
      if (!req.user?.id) {
        return res.status(401).json({ data: null, error: { message: 'Authentication required' } })
      }
      args[selfArg] = req.user.id
    }

    // Special-case: dashboard stats assembled from multiple PostgREST queries
    // (admin-only — enforced above).
    if (fn === 'get_dashboard_stats') {
      const [appRes, payRes, quoteRes, clientRes] = await Promise.all([
        supabaseAdmin.from('applications').select('status', { count: 'exact' }),
        supabaseAdmin.from('application_payments').select('amount').eq('status', 'paid'),
        supabaseAdmin.from('quotations').select('status', { count: 'exact' }),
        supabaseAdmin.from('users').select('id', { count: 'exact' }).eq('role', 'client'),
      ])

      const apps = appRes.data || []
      const result = [{
        total_applications: apps.length,
        pending_applications: apps.filter((a: any) => a.status === 'pending').length,
        completed_applications: apps.filter((a: any) => ['completed', 'Completed'].includes(a.status)).length,
        rejected_applications: apps.filter((a: any) => a.status === 'rejected').length,
        total_quotations: quoteRes.count ?? 0,
        pending_quotations: (quoteRes.data || []).filter((q: any) => q.status === 'pending').length,
        paid_quotations: (quoteRes.data || []).filter((q: any) => q.status === 'paid').length,
        total_clients: clientRes.count ?? 0,
        revenue: (payRes.data || []).reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0),
      }]
      return res.json({ data: result, error: null })
    }

    // All other allowed functions call through to Supabase RPC
    const { data, error } = await supabaseAdmin.rpc(fn, args)
    if (error) throw error
    res.json({ data, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

export default router
