import { Router, Response } from 'express'
import { query } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()
router.use(authenticateToken)

function isAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin'
}

// Admin and advisors can manage processing accounts (create/update/activate/deactivate)
// for any application. Clients cannot.
function isStaff(req: AuthenticatedRequest): boolean {
  const role = req.user?.role
  return role === 'admin' || role === 'advisor' || role === 'staff'
}

// Resolve a URL :id segment (UUID or GRIT APP ID like AP1234ABCDEFGH) to a row from `applications`.
async function resolveApplication(idOrAppId: string): Promise<{ id: string; user_id: string } | null> {
  const isGritAppId = /^AP[0-9A-Z]{12}$/i.test(idOrAppId)
  if (isGritAppId) {
    const r = await query(
      `SELECT id, user_id FROM applications WHERE UPPER(grit_app_id) = UPPER($1) LIMIT 1`,
      [idOrAppId]
    )
    return (r.rows[0] as { id: string; user_id: string } | undefined) ?? null
  }
  // Treat as UUID; guard against syntax errors by validating shape.
  if (!/^[0-9a-fA-F-]{36}$/.test(idOrAppId)) return null
  const r = await query(`SELECT id, user_id FROM applications WHERE id = $1 LIMIT 1`, [idOrAppId])
  return (r.rows[0] as { id: string; user_id: string } | undefined) ?? null
}

// Password formula: "@" + first 2 letters of first name (UPPER) + MM + first 2 of last name (lower) + DD.
// Example: Juan Delacruz, DOB 1995-07-14  →  @JU07de14
function generatePassword(firstName: string | null, lastName: string | null, dob: string | null): string {
  if (!firstName || !lastName || !dob || firstName.length < 2 || lastName.length < 2) return ''
  const d = new Date(dob)
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `@${firstName.slice(0, 2).toUpperCase()}${mm}${lastName.slice(0, 2).toLowerCase()}${dd}`
}

function generateSecurityAnswers(
  elementarySchool: string | null,
  gender: string | null,
  middleName: string | null,
): { question1: string; question2: string; question3: string } {
  const question1 = elementarySchool
    ? elementarySchool.trim().split(/\s+/)[0].toLowerCase()
    : 'unknown'
  const g = (gender || '').toLowerCase()
  const question2 = g === 'female' ? 'darna' : g === 'male' ? 'superman' : 'superman'
  const question3 = middleName
    ? middleName.trim().split(/\s+/)[0].toLowerCase()
    : 'none'
  return { question1, question2, question3 }
}

async function hasApprovedPayment(applicationId: string): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM application_payments WHERE application_id = $1 AND status = 'paid' LIMIT 1`,
    [applicationId]
  )
  return r.rowCount! > 0
}

// GET /api/processing-accounts/by-application/:idOrAppId
// Returns the application's processing accounts, auto-provisioning the
// system-managed Pearson Vue and Mandatory Courses entries (inactive) if
// they don't already exist.
router.get('/by-application/:idOrAppId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idOrAppId = String(req.params.idOrAppId)
    const app = await resolveApplication(idOrAppId)
    if (!app) return res.status(404).json({ error: 'Application not found' })

    if (!isAdmin(req) && app.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Applicant profile fields live on user_details.
    const detailsR = await query(
      `SELECT first_name, middle_name, last_name, email, elementary_school, gender, marital_status, date_of_birth
         FROM user_details WHERE user_id = $1 LIMIT 1`,
      [app.user_id]
    )
    const details = detailsR.rows[0] as
      | {
          first_name?: string | null
          middle_name?: string | null
          last_name?: string | null
          email?: string | null
          elementary_school?: string | null
          gender?: string | null
          marital_status?: string | null
          date_of_birth?: string | null
        }
      | undefined

    const userR = await query(`SELECT grit_id, gritsync_email FROM users WHERE id = $1`, [app.user_id])
    const userRow = userR.rows[0] as { grit_id?: string | null; gritsync_email?: string | null } | undefined

    const password = generatePassword(
      details?.first_name ?? null,
      details?.last_name ?? null,
      details?.date_of_birth ?? null
    )

    const existingR = await query(
      `SELECT * FROM processing_accounts WHERE application_id = $1 ORDER BY created_at DESC`,
      [app.id]
    )
    const existing = existingR.rows as Array<{ account_type?: string; email?: string }>
    const existingGritsync = existing.find((a) => a.account_type === 'gritsync')
    const hasPearson = existing.some((a) => a.account_type === 'pearson_vue')
    const hasMandatory = existing.some((a) => a.account_type === 'mandatory_courses')

    const gritsyncEmail =
      existingGritsync?.email || userRow?.gritsync_email || details?.email || ''

    // Auto-provision Pearson Vue (inactive)
    if (!hasPearson && password && gritsyncEmail && details?.first_name && details?.last_name) {
      const sa = generateSecurityAnswers(
        details.elementary_school ?? null,
        details.gender ?? null,
        details.middle_name ?? null
      )
      try {
        await query(
          `INSERT INTO processing_accounts
             (application_id, account_type, email, password, security_question_1, security_question_2,
              security_question_3, status, created_by)
           VALUES ($1, 'pearson_vue', $2, $3, $4, $5, $6, 'inactive', $7)`,
          [app.id, gritsyncEmail, password, sa.question1, sa.question2, sa.question3, app.user_id]
        )
      } catch (err: any) {
        if (err?.code !== '23505') console.warn('[processing-accounts] pearson auto-create:', err?.message)
      }
    }

    // Auto-provision Mandatory Courses (inactive)
    if (!hasMandatory && password && gritsyncEmail) {
      try {
        await query(
          `INSERT INTO processing_accounts
             (application_id, account_type, link, email, password, status, created_by)
           VALUES ($1, 'mandatory_courses', 'https://nyrequirements.com/', $2, $3, 'inactive', $4)`,
          [app.id, gritsyncEmail, password, app.user_id]
        )
      } catch (err: any) {
        if (err?.code !== '23505') console.warn('[processing-accounts] mandatory_courses auto-create:', err?.message)
      }
    }

    // Re-fetch and sort: gritsync, pearson_vue, mandatory_courses, custom, then by created_at desc
    const finalR = await query(
      `SELECT * FROM processing_accounts WHERE application_id = $1 ORDER BY created_at DESC`,
      [app.id]
    )
    const accounts = finalR.rows as Array<{ account_type?: string; created_at?: string }>
    const order: Record<string, number> = { gritsync: 1, pearson_vue: 2, mandatory_courses: 3, custom: 4 }
    accounts.sort((a, b) => {
      const av = order[a.account_type ?? ''] ?? 99
      const bv = order[b.account_type ?? ''] ?? 99
      if (av !== bv) return av - bv
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    })

    res.json({
      data: accounts,
      has_approved_payment: await hasApprovedPayment(app.id),
    })
  } catch (err: any) {
    console.error('[processing-accounts] by-application:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// POST /api/processing-accounts
// Admin-only. Create a non-system processing account (custom, gmail, etc.)
// for an application. The two system-managed account types (pearson_vue,
// mandatory_courses) are auto-provisioned by the GET /by-application route
// and cannot be created here.
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStaff(req)) return res.status(403).json({ error: 'Admin or advisor access required' })
    const {
      application_id,
      account_type,
      name,
      link,
      email,
      password,
      security_question_1,
      security_question_2,
      security_question_3,
      status = 'active',
    } = req.body ?? {}

    if (!application_id) return res.status(400).json({ error: 'application_id is required' })
    if (!account_type) return res.status(400).json({ error: 'account_type is required' })
    if (account_type === 'pearson_vue' || account_type === 'mandatory_courses') {
      return res.status(400).json({
        error: 'Pearson Vue and Mandatory Courses accounts are auto-provisioned and cannot be created manually',
      })
    }
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

    const appR = await query(`SELECT user_id FROM applications WHERE id = $1 LIMIT 1`, [application_id])
    if (appR.rowCount === 0) return res.status(404).json({ error: 'Application not found' })
    const userId = (appR.rows[0] as { user_id: string }).user_id

    const insR = await query(
      `INSERT INTO processing_accounts
         (application_id, account_type, name, link, email, password,
          security_question_1, security_question_2, security_question_3,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        application_id,
        account_type,
        name ?? null,
        link ?? null,
        email,
        password,
        security_question_1 ?? null,
        security_question_2 ?? null,
        security_question_3 ?? null,
        status,
        userId,
      ]
    )
    res.json({ data: insR.rows[0] })
  } catch (err: any) {
    console.error('[processing-accounts] create:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// PATCH /api/processing-accounts/:id
// Admin-only. Update editable fields on a processing account.
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStaff(req)) return res.status(403).json({ error: 'Admin or advisor access required' })
    const id = String(req.params.id)
    const allowed = [
      'name', 'link', 'email', 'password',
      'security_question_1', 'security_question_2', 'security_question_3',
      'status', 'account_type',
    ]
    const updates: Record<string, any> = {}
    for (const k of allowed) {
      if (k in (req.body ?? {})) updates[k] = req.body[k]
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' })

    // Disallow re-typing an account into a system type via update.
    if (updates.account_type === 'pearson_vue' || updates.account_type === 'mandatory_courses') {
      return res.status(400).json({ error: 'Cannot change account type to a system-managed type' })
    }

    const keys = Object.keys(updates)
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
    const vals = keys.map((k) => updates[k])
    vals.push(id)

    const r = await query(
      `UPDATE processing_accounts SET ${setClause}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
      vals
    )
    if (r.rowCount === 0) return res.status(404).json({ error: 'Account not found' })
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    console.error('[processing-accounts] update:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// DELETE /api/processing-accounts/:id
// Admin-only. System accounts (pearson_vue, mandatory_courses) cannot be deleted
// — only deactivated.
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStaff(req)) return res.status(403).json({ error: 'Admin or advisor access required' })
    const id = String(req.params.id)
    const acctR = await query(`SELECT account_type FROM processing_accounts WHERE id = $1`, [id])
    if (acctR.rowCount === 0) return res.status(404).json({ error: 'Account not found' })
    const at = (acctR.rows[0] as { account_type: string }).account_type
    if (at === 'pearson_vue' || at === 'mandatory_courses') {
      return res.status(400).json({ error: 'System-managed accounts cannot be deleted — deactivate instead' })
    }
    await query(`DELETE FROM processing_accounts WHERE id = $1`, [id])
    res.json({ data: { id } })
  } catch (err: any) {
    console.error('[processing-accounts] delete:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// POST /api/processing-accounts/:id/activate
// Admin-only. Refuses unless the application has at least one approved payment.
router.post('/:id/activate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStaff(req)) return res.status(403).json({ error: 'Admin or advisor access required' })
    const id = String(req.params.id)

    const acctR = await query(
      `SELECT id, application_id, account_type FROM processing_accounts WHERE id = $1 LIMIT 1`,
      [id]
    )
    const acct = acctR.rows[0] as
      | { id: string; application_id: string | null; account_type: string }
      | undefined
    if (!acct) return res.status(404).json({ error: 'Account not found' })
    if (!acct.application_id) return res.status(400).json({ error: 'Account has no associated application' })

    if (!(await hasApprovedPayment(acct.application_id))) {
      return res.status(409).json({
        error: 'Activation requires an approved payment on this application',
      })
    }

    const updR = await query(
      `UPDATE processing_accounts SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    )
    res.json({ data: updR.rows[0] })
  } catch (err: any) {
    console.error('[processing-accounts] activate:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// POST /api/processing-accounts/:id/deactivate
// Admin-only. Flips a previously-activated account back to inactive.
router.post('/:id/deactivate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStaff(req)) return res.status(403).json({ error: 'Admin or advisor access required' })
    const id = String(req.params.id)

    const acctR = await query(`SELECT id FROM processing_accounts WHERE id = $1 LIMIT 1`, [id])
    if (acctR.rowCount === 0) return res.status(404).json({ error: 'Account not found' })

    const updR = await query(
      `UPDATE processing_accounts SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    )
    res.json({ data: updR.rows[0] })
  } catch (err: any) {
    console.error('[processing-accounts] deactivate:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

export default router
