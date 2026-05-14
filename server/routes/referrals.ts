import { Router } from 'express'
import crypto from 'crypto'
import { query } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const PARTNER_ROLES = ['affiliate', 'advisor']

function genCode(): string {
  // 8-char uppercase alphanumeric (avoids ambiguous chars)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

export async function getReferralBonusPercent(): Promise<number> {
  try {
    const r = await query(`SELECT value FROM settings WHERE key = 'referralBonusPercent'`)
    const v = parseFloat(r.rows[0]?.value ?? '10')
    return Number.isFinite(v) && v >= 0 ? v : 10
  } catch {
    return 10
  }
}

// Generate (and persist) a referral code for the user if they don't have one.
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const r = await query(`SELECT referral_code FROM users WHERE id = $1`, [userId])
  if (r.rowCount === 0) return null
  if (r.rows[0].referral_code) return r.rows[0].referral_code
  for (let i = 0; i < 12; i++) {
    const code = genCode()
    const c = await query(`SELECT 1 FROM users WHERE referral_code = $1`, [code])
    if (c.rowCount === 0) {
      await query(`UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2`, [code, userId])
      return code
    }
  }
  return null
}

// GET /api/referrals/lookup/:code — resolve a referral code to a partner's name (used on the register page)
router.get('/lookup/:code', async (req, res) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase()
    if (!code) return res.json({ data: null })
    const r = await query(
      `SELECT first_name, last_name, role FROM users WHERE referral_code = $1 AND is_active = true AND role = ANY($2::text[])`,
      [code, PARTNER_ROLES]
    )
    const u = r.rows[0]
    res.json({ data: u ? { first_name: u.first_name, last_name: u.last_name, role: u.role } : null })
  } catch {
    res.json({ data: null })
  }
})

// GET /api/referrals/me — referral dashboard data for the logged-in user
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const role = req.user!.role
    const isPartner = PARTNER_ROLES.includes(role)

    let referralCode: string | null = null
    if (isPartner) {
      referralCode = await ensureReferralCode(me)
    } else {
      const r = await query(`SELECT referral_code FROM users WHERE id = $1`, [me])
      referralCode = r.rows[0]?.referral_code ?? null
    }

    const bonusPercent = await getReferralBonusPercent()

    // Users this person referred + how much they have paid so far
    const referredRes = await query(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.role, u.grit_id, u.is_active, u.created_at,
        COALESCE((SELECT SUM(a.paid_amount) FROM applications a WHERE a.user_id = u.id), 0) AS paid_total,
        (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) AS application_count
      FROM users u
      WHERE u.referred_by = $1
      ORDER BY u.created_at DESC
    `, [me])
    const referred = referredRes.rows.map((r: any) => {
      const paid = Number(r.paid_total) || 0
      return {
        id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email,
        role: r.role, grit_id: r.grit_id, is_active: r.is_active, created_at: r.created_at,
        application_count: Number(r.application_count) || 0,
        paid_total: paid,
        converted: paid > 0,
        bonus_earned: Math.round(paid * bonusPercent) / 100,
      }
    })

    // Advisors: clients automatically assigned to them
    let assigned: any[] = []
    if (role === 'advisor') {
      const a = await query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email, u.grit_id, u.is_active, u.created_at,
          (SELECT COUNT(*) FROM applications ap WHERE ap.user_id = u.id) AS application_count,
          (u.referred_by = $1) AS via_referral
        FROM users u
        WHERE u.advisor_id = $1
        ORDER BY u.created_at DESC
      `, [me])
      assigned = a.rows.map((r: any) => ({
        id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email,
        grit_id: r.grit_id, is_active: r.is_active, created_at: r.created_at,
        application_count: Number(r.application_count) || 0,
        via_referral: !!r.via_referral,
      }))
    }

    const totalReferred = referred.length
    const totalConverted = referred.filter((r) => r.converted).length
    const totalPaidVolume = referred.reduce((s, r) => s + r.paid_total, 0)
    const totalEarnings = Math.round(referred.reduce((s, r) => s + r.bonus_earned, 0) * 100) / 100

    res.json({
      role,
      referralCode,
      bonusPercent,
      stats: { totalReferred, totalConverted, totalPaidVolume, totalEarnings, assignedClients: assigned.length },
      referred,
      assigned,
    })
  } catch (err: any) {
    console.error('GET /api/referrals/me error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/referrals/assigned/applications — every application across the advisor's assigned clients
router.get('/assigned/applications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const role = req.user!.role
    if (role !== 'advisor' && role !== 'admin') return res.status(403).json({ error: 'Advisor access required' })
    // Admins can optionally inspect a specific advisor's assigned-clients view.
    const advisorId = role === 'admin' && req.query.advisorId ? String(req.query.advisorId) : me

    const apps = await query(`
      SELECT
        a.id, a.grit_app_id, a.application_type, a.status, a.total_amount, a.paid_amount, a.created_at, a.updated_at, a.submitted_at,
        u.id           AS client_id,
        u.first_name   AS client_first_name,
        u.last_name    AS client_last_name,
        u.email        AS client_email,
        u.grit_id      AS client_grit_id,
        u.avatar_path  AS client_avatar_path,
        u.is_active    AS client_is_active,
        (SELECT COUNT(*) FROM application_timeline_steps s WHERE s.application_id = a.id) AS total_steps,
        (SELECT COUNT(*) FROM application_timeline_steps s WHERE s.application_id = a.id AND s.status = 'completed') AS completed_steps,
        (SELECT MAX(s.updated_at) FROM application_timeline_steps s WHERE s.application_id = a.id) AS last_step_at
      FROM applications a
      JOIN users u ON u.id = a.user_id
      WHERE u.advisor_id = $1
      ORDER BY COALESCE(a.updated_at, a.created_at) DESC
    `, [advisorId])

    const data = apps.rows.map((r: any) => ({
      id: r.id,
      grit_app_id: r.grit_app_id,
      application_type: r.application_type,
      status: r.status,
      total_amount: r.total_amount != null ? Number(r.total_amount) : null,
      paid_amount: r.paid_amount != null ? Number(r.paid_amount) : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      submitted_at: r.submitted_at,
      last_step_at: r.last_step_at,
      total_steps: Number(r.total_steps) || 0,
      completed_steps: Number(r.completed_steps) || 0,
      client: {
        id: r.client_id,
        first_name: r.client_first_name,
        last_name: r.client_last_name,
        email: r.client_email,
        grit_id: r.client_grit_id,
        avatar_path: r.client_avatar_path,
        is_active: r.client_is_active,
      },
    }))

    res.json({ data })
  } catch (err: any) {
    console.error('GET /api/referrals/assigned/applications error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/referrals/assigned/:clientId/applications — advisor views one assigned client's applications
router.get('/assigned/:clientId/applications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const role = req.user!.role
    const { clientId } = req.params
    if (role !== 'advisor' && role !== 'admin') return res.status(403).json({ error: 'Advisor access required' })
    if (role === 'advisor') {
      const c = await query(`SELECT 1 FROM users WHERE id = $1 AND advisor_id = $2`, [clientId, me])
      if (c.rowCount === 0) return res.status(403).json({ error: 'This client is not assigned to you' })
    }
    const u = await query(`SELECT id, first_name, last_name, email, grit_id, is_active FROM users WHERE id = $1`, [clientId])
    if (u.rowCount === 0) return res.status(404).json({ error: 'Client not found' })
    const apps = await query(`
      SELECT
        a.id, a.grit_app_id, a.application_type, a.status, a.total_amount, a.paid_amount, a.created_at, a.updated_at,
        (SELECT COUNT(*) FROM application_timeline_steps s WHERE s.application_id = a.id) AS total_steps,
        (SELECT COUNT(*) FROM application_timeline_steps s WHERE s.application_id = a.id AND s.status = 'completed') AS completed_steps
      FROM applications a
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
    `, [clientId])
    res.json({
      client: u.rows[0],
      data: apps.rows.map((r: any) => ({
        ...r,
        total_steps: Number(r.total_steps) || 0,
        completed_steps: Number(r.completed_steps) || 0,
        total_amount: r.total_amount != null ? Number(r.total_amount) : null,
        paid_amount: r.paid_amount != null ? Number(r.paid_amount) : null,
      })),
    })
  } catch (err: any) {
    console.error('GET /api/referrals/assigned/:clientId/applications error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
