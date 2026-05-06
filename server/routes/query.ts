import { Router, Response } from 'express'
import { query } from '../db'
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// Tables that allow unauthenticated inserts (public-facing forms)
const PUBLIC_INSERT_TABLES = new Set([
  'quotations', 'newsletter_subscriptions', 'career_applications',
  'donations', 'testimonials',
])

// Allowed tables for security
const ALLOWED_TABLES = new Set([
  'applications', 'application_payments', 'application_timeline_steps',
  'users', 'user_details', 'user_documents', 'user_preferences',
  'services', 'service_required_documents', 'notifications',
  'settings', 'promo_codes', 'quotations', 'careers', 'career_applications',
  'donations', 'partner_agencies', 'nclex_sponsorships', 'testimonials',
  'conversations', 'messages', 'email_addresses', 'email_logs', 'email_templates',
  'sessions', 'exchange_rates', 'visa_bulletin_cache', 'visa_bulletin_email_log',
  'newsletter_subscriptions', 'password_reset_tokens',
  'email_signatures', 'business_logos',
  'processing_accounts',
  'email_queue', 'email_analytics', 'email_subscribers', 'subscriber_stats',
])

function buildWhereClause(filters: Record<string, any>): { sql: string; values: any[] } {
  const conditions: string[] = []
  const values: any[] = []
  let idx = 1

  for (const [key, rawVal] of Object.entries(filters)) {
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
        const placeholders = val.value.map((_: any) => `$${idx++}`).join(', ')
        conditions.push(`"${key}" IN (${placeholders})`)
        values.push(...val.value)
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
  const { table } = req.params
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const { select = '*', order, limit, offset, ...filters } = req.query as Record<string, any>

    const { sql: where, values } = buildWhereClause(
      Object.fromEntries(Object.entries(filters).filter(([k]) => !['select', 'order', 'limit', 'offset'].includes(k)))
    )

    let orderClause = ''
    if (order) {
      const [col, dir] = order.split('.')
      orderClause = `ORDER BY "${col}" ${dir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`
    }

    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : ''
    const offsetClause = offset ? `OFFSET ${parseInt(offset)}` : ''

    const sql = `SELECT ${select === '*' ? '*' : select.split(',').map((c: string) => `"${c.trim()}"`).join(', ')}
                 FROM "${table}" ${where} ${orderClause} ${limitClause} ${offsetClause}`

    const result = await query(sql, values)
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ data: null, error: { message: err.message } })
  }
})

// POST /api/db/:table - Insert
router.post('/:table', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  // Require auth for non-public tables
  if (!PUBLIC_INSERT_TABLES.has(table) && !req.user) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const { returning = '*', _onConflict, ...record } = req.body
    if (Object.keys(record).length === 0) return res.status(400).json({ error: 'No data provided' })

    // Handle array of records or single record
    const records = Array.isArray(record._batch) ? record._batch : [record]

    const cols = Object.keys(records[0]).filter(k => k !== '_batch')
    const colSQL = cols.map(c => `"${c}"`).join(', ')
    const inserted: any[] = []

    for (const rec of records) {
      const vals = cols.map(c => rec[c])
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')

      let sql = `INSERT INTO "${table}" (${colSQL}) VALUES (${placeholders})`
      if (_onConflict) {
        const conflictCols = _onConflict.split(',').map((c: string) => `"${c.trim()}"`).join(', ')
        const updateCols = cols.filter(c => !_onConflict.split(',').map((x: string) => x.trim()).includes(c))
        if (updateCols.length > 0) {
          const setClause = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')
          sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${setClause}`
        } else {
          sql += ` ON CONFLICT (${conflictCols}) DO NOTHING`
        }
      }
      sql += ` RETURNING ${returning}`

      const result = await query(sql, vals)
      inserted.push(...result.rows)
    }

    res.json({ data: inserted.length === 1 ? inserted[0] : inserted, error: null })
  } catch (err: any) {
    res.status(500).json({ data: null, error: { message: err.message } })
  }
})

// PATCH /api/db/:table - Update
router.patch('/:table', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const { _filters, _returning = '*', ...updates } = req.body
    if (!_filters || Object.keys(_filters).length === 0) {
      return res.status(400).json({ error: 'Filters required for update' })
    }

    const setCols = Object.keys(updates)
    if (setCols.length === 0) return res.status(400).json({ error: 'No fields to update' })

    const setClause = setCols.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
    const setValues = setCols.map(k => updates[k])

    const { sql: where, values: filterValues } = buildWhereClause(_filters)
    const adjustedWhere = where.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + setValues.length}`)

    const result = await query(
      `UPDATE "${table}" SET ${setClause} ${adjustedWhere} RETURNING ${_returning}`,
      [...setValues, ...filterValues]
    )
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ data: null, error: { message: err.message } })
  }
})

// DELETE /api/db/:table - Delete
router.delete('/:table', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

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
    res.status(500).json({ data: null, error: { message: err.message } })
  }
})

// POST /api/db/:table/rpc - Custom RPC / raw query (admin only)
router.post('/:table/count', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' })

  try {
    const filters = req.body || {}
    const { sql: where, values } = buildWhereClause(filters)
    const result = await query(`SELECT COUNT(*) as count FROM "${table}" ${where}`, values)
    res.json({ data: result.rows[0].count, error: null })
  } catch (err: any) {
    res.status(500).json({ data: null, error: { message: err.message } })
  }
})

// Allowed RPC functions (PostgreSQL stored procedures/functions)
const ALLOWED_RPC_FUNCTIONS = new Set([
  'validate_promo_code',
  'get_dashboard_stats',
])

// POST /api/db/rpc/:fn — call a PostgreSQL function
router.post('/rpc/:fn', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { fn } = req.params

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
      result = null
    }

    res.json({ data: result, error: null })
  } catch (err: any) {
    res.status(500).json({ data: null, error: { message: err.message } })
  }
})

export default router
