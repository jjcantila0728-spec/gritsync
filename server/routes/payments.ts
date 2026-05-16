import { Router, Response } from 'express'
import Stripe from 'stripe'
import { query } from '../db'
import { optionalAuth, authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { grantNclexPremiumOnPayment } from './nclex'

const router = Router()

// Treat the `.env.example` placeholders the same as "not configured" so the
// 503 path fires with a useful message instead of forwarding Stripe's opaque
// "Invalid API Key provided: sk_test_******e_me" 401.
const STRIPE_KEY_PLACEHOLDERS = new Set(['sk_test_replace_me', 'sk_live_replace_me'])

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (STRIPE_KEY_PLACEHOLDERS.has(key)) return null
  // A valid Stripe secret key starts with sk_test_ or sk_live_; anything else
  // is almost certainly a misconfigured value (e.g. publishable key copy-paste).
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) return null
  return new Stripe(key, { apiVersion: '2023-10-16' as any })
}

// POST /api/payments/create-intent — quotation payment intent
router.post('/create-intent', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured. Set STRIPE_SECRET_KEY in your .env file to a real test/live secret key (currently empty or set to the placeholder).' })
    }

    const { quotation_id, amount } = req.body
    if (!quotation_id || !amount) {
      return res.status(400).json({ error: 'quotation_id and amount are required' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // already in cents
      currency: 'usd',
      metadata: { quotation_id },
    })

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payments/create-application-intent — application payment intent
router.post('/create-application-intent', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured. Set STRIPE_SECRET_KEY in your .env file to a real test/live secret key (currently empty or set to the placeholder).' })
    }

    const { payment_id } = req.body
    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id is required' })
    }

    // Fetch payment record to get amount and metadata
    // application_payments has no user_id — join with applications to get it
    const result = await query(
      `SELECT ap.id, ap.amount, ap.currency, ap.payment_type, ap.notes, ap.application_id, a.user_id
       FROM application_payments ap
       LEFT JOIN applications a ON a.id = ap.application_id
       WHERE ap.id = $1`,
      [payment_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    const payment = result.rows[0]
    const amountCents = Math.round(Number(payment.amount) * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: (payment.currency || 'usd').toLowerCase(),
      description: payment.notes || payment.payment_type || `Application payment ${payment_id}`,
      metadata: {
        payment_id,
        application_id: payment.application_id || '',
        user_id: payment.user_id || '',
      },
    })

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payments/create-donation-intent — donation payment intent
router.post('/create-donation-intent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured. Set STRIPE_SECRET_KEY in your .env file to a real test/live secret key (currently empty or set to the placeholder).' })
    }

    const { amount, currency = 'usd', metadata = {} } = req.body
    if (!amount) {
      return res.status(400).json({ error: 'amount is required' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: currency.toLowerCase(),
      metadata,
    })

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payments/:id/trigger-followup-tasks
// Triggered after approving a step1 or full payment. Creates two todo-list
// notifications ("Complete Mandatory Courses" and "Submit NYSED Form 1") for
// every admin and advisor so they can drive the next steps in the timeline.
router.post('/:id/trigger-followup-tasks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role
    if (role !== 'admin' && role !== 'advisor' && role !== 'staff') {
      return res.status(403).json({ error: 'Admin or advisor access required' })
    }

    const paymentId = String(req.params.id)
    const payR = await query(
      `SELECT id, payment_type, application_id, status FROM application_payments WHERE id = $1 LIMIT 1`,
      [paymentId]
    )
    const pay = payR.rows[0] as
      | { id: string; payment_type: string | null; application_id: string | null; status: string | null }
      | undefined
    if (!pay) return res.status(404).json({ error: 'Payment not found' })
    if (pay.status !== 'paid') return res.status(400).json({ error: 'Payment is not in paid status' })
    if (pay.payment_type !== 'step1' && pay.payment_type !== 'full') {
      // step2 doesn't unblock these timeline tasks — only step1/full do.
      return res.json({ data: { skipped: true, reason: 'payment_type is not step1 or full' } })
    }
    if (!pay.application_id) return res.status(400).json({ error: 'Payment has no application' })

    // Friendly identifier for the application + the owner's user_id (needed
    // for the NCLEX premium-bonus grant below).
    const appR = await query(
      `SELECT id, grit_app_id, user_id FROM applications WHERE id = $1 LIMIT 1`,
      [pay.application_id]
    )
    const appRow = appR.rows[0] as { id: string; grit_app_id: string | null; user_id: string | null } | undefined
    const appLabel = appRow?.grit_app_id || pay.application_id.slice(0, 8)

    // Grant N months of free Premium on review.gritsync.com to this
    // application's owner. N is admin-configurable (nclex_payment_bonus_months
    // site setting, default 4). GREATEST() ensures stacking earlier expiries
    // doesn't shorten an already-longer Premium window. Non-fatal: if this
    // step throws, the rest of the approval flow still completes.
    let nclexBonus: { granted: boolean; months: number; expiresAt: string | null } = { granted: false, months: 0, expiresAt: null }
    if (appRow?.user_id) {
      nclexBonus = await grantNclexPremiumOnPayment(appRow.user_id)
    }

    // Recipients: every active admin + advisor.
    const recipR = await query(
      `SELECT id, role FROM users WHERE role IN ('admin', 'advisor', 'staff')`
    )
    const recipients = recipR.rows as Array<{ id: string; role: string }>
    if (recipients.length === 0) {
      return res.json({ data: { recipients: 0, notifications: 0 } })
    }

    const tasks = [
      {
        key: 'mandatory_courses',
        title: 'Complete Mandatory Courses',
        message: `Application ${appLabel} has paid. Verify the client completes the NY Mandatory Courses (Infection Control + Child Abuse) and mark the timeline step done.`,
      },
      {
        key: 'nysed_form1',
        title: 'Submit NYSED Form 1 (Online Application)',
        message: `Application ${appLabel} has paid. Submit the NYSED Online Application (Form 1) and record the submission in the timeline.`,
      },
    ]

    let inserted = 0
    for (const r of recipients) {
      const rolePath = r.role === 'advisor' ? 'advisor' : 'admin'
      const link = `/${rolePath}/applications/${appLabel}/timeline`
      for (const t of tasks) {
        // Idempotency: don't double up if an unread task for this recipient +
        // application + task key is still outstanding.
        const existsR = await query(
          `SELECT 1 FROM notifications
            WHERE user_id = $1
              AND application_id = $2
              AND type = 'task'
              AND read = false
              AND extra ->> 'task_key' = $3
            LIMIT 1`,
          [r.id, pay.application_id, t.key]
        )
        if (existsR.rowCount && existsR.rowCount > 0) continue
        await query(
          `INSERT INTO notifications (user_id, application_id, title, message, type, link, extra, read)
           VALUES ($1, $2, $3, $4, 'task', $5, $6::jsonb, false)`,
          [
            r.id,
            pay.application_id,
            t.title,
            t.message,
            link,
            JSON.stringify({ task_key: t.key, payment_id: pay.id, payment_type: pay.payment_type }),
          ]
        )
        inserted++
      }
    }

    res.json({ data: { recipients: recipients.length, notifications: inserted, nclexBonus } })
  } catch (err: any) {
    console.error('[payments] trigger-followup-tasks:', err)
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

export default router
