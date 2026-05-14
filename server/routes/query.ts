import { Router, Response } from 'express'
import { query } from '../db'
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// Tables that allow unauthenticated inserts (public-facing forms)
const PUBLIC_INSERT_TABLES = new Set([
  'quotations', 'newsletter_subscriptions', 'career_applications',
  'donations', 'testimonials',
])

// Allowed tables for security (table names + read-only views the frontend uses)
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
  // email campaigns / newsletters / A-B testing
  'email_campaigns', 'email_campaign_recipients',
  'email_ab_tests', 'email_ab_test_results', 'email_ab_test_recipients',
  // inbound mail
  'received_emails',
  // automated workflows
  'workflows', 'workflow_runs', 'workflow_triggers',
  // analytics
  'analytics_cache', 'custom_reports', 'report_schedules',
  // views
  'active_email_addresses', 'ab_test_stats',
])
// NOTE: `password_reset_tokens` is deliberately NOT in ALLOWED_TABLES. It holds
// reset secrets and is only ever touched server-side (server/routes/auth.ts via
// the direct `query()` helper), never through this generic endpoint.

// Columns that must never leave the server through this generic API, regardless
// of which table they live on. `SELECT *` is expanded to the table's real
// columns minus this set; an explicit `select`/`returning` naming one of these
// is rejected.
const SENSITIVE_COLUMNS = new Set([
  'password_hash', 'password',
  'email_verification_token', 'email_verification_expires_at',
  'email_otp', 'email_otp_expires_at',
  'reset_token', 'password_reset_token',
])

// Tables that may only be written (INSERT / UPDATE / DELETE) by an admin. These
// are configuration/back-office tables with no legitimate client-side writer.
const ADMIN_ONLY_WRITE_TABLES = new Set([
  'settings', 'promo_codes', 'services', 'service_required_documents',
  'careers', 'partner_agencies', 'email_templates', 'email_signatures',
  'business_logos', 'email_campaigns', 'email_campaign_recipients',
  'email_ab_tests', 'email_ab_test_results', 'email_ab_test_recipients',
  'workflows', 'workflow_triggers', 'report_schedules', 'custom_reports',
  'notification_types',
])

// Columns on `users` that a non-admin may never set/change via this endpoint
// (account-takeover / privilege-escalation surface).
const USERS_PROTECTED_COLUMNS = new Set([
  'id', 'role', 'password_hash', 'email_verified', 'grit_id',
  'email_verification_token', 'email_verification_expires_at',
  'email_otp', 'email_otp_expires_at', 'created_at',
])

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

// Cache of public-schema column names per table (the schema is effectively
// static at runtime; startup migrations run before requests are served).
const columnCache = new Map<string, string[]>()
async function getTableColumns(table: string): Promise<string[]> {
  const cached = columnCache.get(table)
  if (cached) return cached
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  )
  const cols = r.rows.map((row: any) => row.column_name as string)
  columnCache.set(table, cols)
  return cols
}

// Resolve a `select` / `returning` clause to a safe, quoted column list.
// `*` becomes the table's real columns minus SENSITIVE_COLUMNS; an explicit
// list is validated identifier-by-identifier.
async function resolveColumnList(table: string, raw: string | undefined): Promise<string> {
  const value = (raw ?? '*').trim()
  if (value === '' || value === '*') {
    const cols = await getTableColumns(table)
    const safe = cols.filter((c) => !SENSITIVE_COLUMNS.has(c))
    return safe.length > 0 ? safe.map((c) => `"${c}"`).join(', ') : '1'
  }
  const parts = value.split(',').map((c) => c.trim()).filter(Boolean)
  if (parts.length === 0) throw new HttpError(400, 'Empty column list')
  parts.forEach(assertIdent)
  return parts.map((c) => `"${c}"`).join(', ')
}

function sendError(res: Response, err: any) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ data: null, error: { message: err.message } })
  }
  return res.status(500).json({ data: null, error: { message: err?.message || 'Server error' } })
}

function buildWhereClause(filters: Record<string, any>): { sql: string; values: any[] } {
  const conditions: string[] = []
  const values: any[] = []
  let idx = 1

  for (const [key, rawVal] of Object.entries(filters)) {
    assertIdent(key)

    // Query string values arrive as strings — parse JSON-encoded filter objects
    let val = rawVal
    if (typeof rawVal === 'string' && rawVal.startsWith('{')) {
      try { val = JSON.parse(rawVal) } catch {}
    }

    if (val === null || val === 'null') {
      conditions.push(`"${key}" IS NULL`)
    } else if (typeof val === 'object' && val !== null) {
      if (val._op === 'gte') { conditions.push(`"${key}" >= $${idx++}`); values.push(val.value) }
      else if (val._op === 'lte') { conditions.push(`"${key}" <= $${idx++}`); values.push(val.value) }
      else if (val._op === 'gt') { conditions.push(`"${key}" > $${idx++}`); values.push(val.value) }
      else if (val._op === 'lt') { conditions.push(`"${key}" < $${idx++}`); values.push(val.value) }
      else if (val._op === 'like') { conditions.push(`"${key}" ILIKE $${idx++}`); values.push(`%${val.value}%`) }
      else if (val._op === 'neq') { conditions.push(`"${key}" != $${idx++}`); values.push(val.value) }
      else if (val._op === 'in') {
        const list = Array.isArray(val.value) ? val.value : []
        if (list.length === 0) {
          conditions.push('FALSE')
        } else {
          const placeholders = list.map(() => `$${idx++}`).join(', ')
          conditions.push(`"${key}" IN (${placeholders})`)
          values.push(...list)
        }
      }
    } else {
      conditions.push(`"${key}" = $${idx++}`)
      values.push(val)
    }
  }

  return { sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', values }
}

// GET /api/db/:table - Select query
router.get('/:table', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const { select = '*', order, limit, offset, ...filters } = req.query as Record<string, any>

    const selectClause = await resolveColumnList(table, select)

    const { sql: where, values } = buildWhereClause(
      Object.fromEntries(Object.entries(filters).filter(([k]) => !['select', 'order', 'limit', 'offset'].includes(k)))
    )

    let orderClause = ''
    if (order) {
      const [col, dir] = String(order).split('.')
      assertIdent(col)
      orderClause = `ORDER BY "${col}" ${String(dir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`
    }

    const limitClause = limit ? `LIMIT ${parseInt(String(limit), 10) || 0}` : ''
    const offsetClause = offset ? `OFFSET ${parseInt(String(offset), 10) || 0}` : ''

    const sql = `SELECT ${selectClause} FROM "${table}" ${where} ${orderClause} ${limitClause} ${offsetClause}`

    const result = await query(sql, values)
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// POST /api/db/:table - Insert
router.post('/:table', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  // Require auth for non-public tables
  if (!PUBLIC_INSERT_TABLES.has(table) && !req.user) {
    return res.status(401).json({ error: 'No token provided' })
  }
  // Configuration / back-office tables (and the users table itself) may only be
  // populated by an admin.
  if ((table === 'users' || ADMIN_ONLY_WRITE_TABLES.has(table)) && !isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const { returning = '*', _onConflict, ...record } = req.body
    if (Object.keys(record).length === 0) return res.status(400).json({ error: 'No data provided' })

    // Handle array of records or single record
    const records = Array.isArray(record._batch) ? record._batch : [record]

    const cols = Object.keys(records[0]).filter(k => k !== '_batch')
    if (cols.length === 0) return res.status(400).json({ error: 'No data provided' })
    cols.forEach(assertIdent)
    const colSQL = cols.map(c => `"${c}"`).join(', ')
    const returningClause = await resolveColumnList(table, returning)

    let conflictCols: string[] = []
    if (_onConflict) {
      conflictCols = String(_onConflict).split(',').map((c: string) => c.trim()).filter(Boolean)
      conflictCols.forEach(assertIdent)
    }

    const inserted: any[] = []
    for (const rec of records) {
      const vals = cols.map(c => rec[c])
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')

      let sql = `INSERT INTO "${table}" (${colSQL}) VALUES (${placeholders})`
      if (conflictCols.length > 0) {
        const updateCols = cols.filter(c => !conflictCols.includes(c))
        if (updateCols.length > 0) {
          const setClause = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')
          sql += ` ON CONFLICT (${conflictCols.map(c => `"${c}"`).join(', ')}) DO UPDATE SET ${setClause}`
        } else {
          sql += ` ON CONFLICT (${conflictCols.map(c => `"${c}"`).join(', ')}) DO NOTHING`
        }
      }
      sql += ` RETURNING ${returningClause}`

      const result = await query(sql, vals)
      inserted.push(...result.rows)
    }

    res.json({ data: inserted.length === 1 ? inserted[0] : inserted, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// PATCH /api/db/:table - Update
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

    // Hardening for the users table: a non-admin may only update *their own* row,
    // and may never touch privileged columns (role, password_hash, ...).
    if (table === 'users' && !isAdmin(req)) {
      const filterId = _filters.id
      if (typeof filterId !== 'string' || !req.user || filterId !== req.user.id) {
        return res.status(403).json({ error: 'You may only update your own account' })
      }
      const offending = setCols.filter(c => USERS_PROTECTED_COLUMNS.has(c))
      if (offending.length > 0) {
        return res.status(403).json({ error: `Cannot update protected column(s): ${offending.join(', ')}` })
      }
    }

    const setClause = setCols.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
    const setValues = setCols.map(k => updates[k])

    const { sql: where, values: filterValues } = buildWhereClause(_filters)
    const adjustedWhere = where.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + setValues.length}`)
    const returningClause = await resolveColumnList(table, _returning)

    const result = await query(
      `UPDATE "${table}" SET ${setClause} ${adjustedWhere} RETURNING ${returningClause}`,
      [...setValues, ...filterValues]
    )
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// DELETE /api/db/:table - Delete
router.delete('/:table', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })
  // Deleting users or back-office configuration is admin-only. (Other tables are
  // still scoped only by the caller-supplied filters — see the note below.)
  if ((table === 'users' || ADMIN_ONLY_WRITE_TABLES.has(table)) && !isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const filters = req.body
    if (!filters || Object.keys(filters).length === 0) {
      return res.status(400).json({ error: 'Filters required for delete' })
    }

    const { sql: where, values } = buildWhereClause(filters)
    if (!where) return res.status(400).json({ error: 'Filters required' })

    const result = await query(`DELETE FROM "${table}" ${where} RETURNING id`, values)
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})
// NOTE / KNOWN GAP: PATCH and DELETE on user-owned tables (applications,
// user_documents, notifications, ...) are still authorized only by "is logged
// in" + the filters the client sends — a determined client could mutate another
// user's rows by id. Closing that requires a per-table ownership model
// (e.g. enforce `user_id = req.user.id` for non-admins). Tracked separately.

// POST /api/db/:table/count - count rows
router.post('/:table/count', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = String(req.params.table)
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const filters = req.body || {}
    const { sql: where, values } = buildWhereClause(filters)
    const result = await query(`SELECT COUNT(*) as count FROM "${table}" ${where}`, values)
    res.json({ data: result.rows[0].count, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

// Allowed RPC functions (PostgreSQL stored procedures/functions defined in init.sql)
const ALLOWED_RPC_FUNCTIONS = new Set([
  'validate_promo_code',
  'get_dashboard_stats',
  // counters / usage
  'increment', 'increment_logo_usage', 'increment_template_usage',
  // email queue automation
  'get_pending_emails_to_send', 'mark_email_processing', 'mark_email_sent', 'mark_email_failed',
  // campaigns / workflows / A-B tests
  'update_campaign_stats',
  'log_workflow_run', 'update_workflow_stats', 'get_active_workflows_for_trigger',
  'calculate_ab_test_metrics', 'determine_ab_test_winner',
  // subscriber segments
  'get_subscriber_count_by_segment', 'get_subscribers_for_segment',
  'unsubscribe_email', 'resubscribe_email', 'update_email_preferences',
  // template / signature rendering
  'render_email_template', 'generate_signature_html', 'refresh_email_analytics',
  // reminders
  'generate_document_reminders', 'generate_payment_reminders', 'generate_profile_completion_reminders',
  'check_missing_documents', 'check_incomplete_profile', 'notify_credentialing_reminder',
  // analytics dashboards
  'get_application_analytics', 'get_financial_analytics', 'get_user_analytics', 'get_document_analytics',
])

const SAFE_ARG_KEY = /^[a-z_][a-z0-9_]*$/i

// POST /api/db/rpc/:fn — call a PostgreSQL function
router.post('/rpc/:fn', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const fn = String(req.params.fn)

  if (!ALLOWED_RPC_FUNCTIONS.has(fn)) {
    return res.status(403).json({ data: null, error: { message: 'Function not allowed', code: 'PGRST301' } })
  }

  try {
    const args = req.body || {}
    let result: any

    if (fn === 'validate_promo_code') {
      const { p_code, p_amount, p_service_fee_amount, p_application_type } = args
      const sql = `SELECT validate_promo_code($1, $2, $3, $4) AS result`
      const values = [p_code, p_amount, p_service_fee_amount ?? null, p_application_type ?? null]
      const rows = await query(sql, values)
      result = rows.rows[0]?.result ?? null

    } else if (fn === 'get_dashboard_stats') {
      const isAdminUser = args.is_admin === true
      const statsResult = await query(`
        SELECT
          COUNT(*) FILTER (WHERE TRUE) AS total_applications,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_applications,
          COUNT(*) FILTER (WHERE status IN ('completed', 'Completed')) AS completed_applications,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_applications
        FROM applications
        ${isAdminUser ? '' : 'WHERE FALSE'}
      `, [])

      const paymentsResult = await query(`
        SELECT COALESCE(SUM(amount), 0) AS revenue
        FROM application_payments
        WHERE status = 'paid'
      `, [])

      const quotationsResult = await query(`
        SELECT
          COUNT(*) AS total_quotations,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_quotations,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid_quotations
        FROM quotations
      `, [])

      const clientsResult = await query(`
        SELECT COUNT(*) AS total_clients FROM users WHERE role = 'client'
      `, [])

      const stats = statsResult.rows[0] || {}
      const payments = paymentsResult.rows[0] || {}
      const quotations = quotationsResult.rows[0] || {}
      const clients = clientsResult.rows[0] || {}

      result = [{
        total_applications: parseInt(stats.total_applications || '0'),
        pending_applications: parseInt(stats.pending_applications || '0'),
        completed_applications: parseInt(stats.completed_applications || '0'),
        rejected_applications: parseInt(stats.rejected_applications || '0'),
        total_quotations: parseInt(quotations.total_quotations || '0'),
        pending_quotations: parseInt(quotations.pending_quotations || '0'),
        paid_quotations: parseInt(quotations.paid_quotations || '0'),
        total_clients: parseInt(clients.total_clients || '0'),
        revenue: parseFloat(payments.revenue || '0'),
      }]

    } else {
      // Generic path: call the (allowlisted) PostgreSQL function with named args.
      const keys = Object.keys(args).filter((k) => SAFE_ARG_KEY.test(k))
      const placeholders = keys.map((k, i) => `${k} := $${i + 1}`).join(', ')
      const values = keys.map((k) => args[k])
      const rows = await query(`SELECT * FROM ${fn}(${placeholders})`, values)
      // A scalar/JSON-returning function comes back as one row with one column
      // (named after the function); a set-returning function comes back as rows.
      if (rows.rows.length === 1 && Object.keys(rows.rows[0]).length === 1) {
        result = rows.rows[0][Object.keys(rows.rows[0])[0]]
      } else {
        result = rows.rows
      }
    }

    res.json({ data: result, error: null })
  } catch (err: any) {
    sendError(res, err)
  }
})

export default router
