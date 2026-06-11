import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { query } from '../db'
import { optionalAuth, authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { grantNclexPremiumOnPayment } from './nclex'
import {
  applyNclexSubscriptionPayment,
  revokeNclexSubscriptionByPaymentReference,
  isNclexPlan,
} from './questions'
import { pushNotifyUser } from '../lib/push'

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

// ═══════════════════════════════════════════════════════════════════════════
// Shared "apply successful payment" logic.
// These functions are the single way a Stripe payment is recorded server-side.
// They are used by the webhook (reliable backstop) and mirror exactly what the
// existing client-driven flows write (same tables, same columns, same receipt
// row), so client-confirm and webhook never diverge. Every function is
// idempotent — keyed on the payment-intent id plus the row's current status —
// so a Stripe event delivered twice never double-applies.
// ═══════════════════════════════════════════════════════════════════════════

/** Mark a quotation paid (mirrors quotationsAPI.updateStatus(id, 'paid')). */
async function applyQuotationPaid(quotationId: string, paymentIntentId: string): Promise<boolean> {
  const result = await query(
    `UPDATE quotations
        SET status = 'paid',
            paid_at = COALESCE(paid_at, NOW()),
            stripe_intent_id = COALESCE(stripe_intent_id, $2),
            updated_at = NOW()
      WHERE id::text = $1
        AND status NOT IN ('paid', 'refunded')
      RETURNING id`,
    [String(quotationId), paymentIntentId]
  )
  return (result.rowCount || 0) > 0
}

/**
 * Mark an application payment paid + ensure its receipt row exists
 * (mirrors applicationPaymentsAPI markCompleted for payment_method 'stripe':
 * status='paid' + payment_method + intent id, then a receipts insert).
 * Receipt PDFs/emails are a client-side nicety and explicitly non-fatal in the
 * existing flow, so the webhook backstop only guarantees the DB records.
 */
async function applyApplicationPaymentPaid(paymentId: string, paymentIntentId: string): Promise<boolean> {
  const result = await query(
    `UPDATE application_payments
        SET status = 'paid',
            payment_method = COALESCE(payment_method, 'stripe'),
            stripe_intent_id = COALESCE(stripe_intent_id, $2),
            paid_at = COALESCE(paid_at, NOW()),
            updated_at = NOW()
      WHERE id::text = $1
        AND status NOT IN ('paid', 'refunded')
      RETURNING id`,
    [String(paymentId), paymentIntentId]
  )
  const applied = (result.rowCount || 0) > 0

  // Ensure a receipt exists for this payment (same shape as the client flow's
  // default receipt: one line item, RCP-<ts>-<rand> number). NOT EXISTS guard
  // makes redelivery + client/webhook races safe.
  const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  await query(
    `INSERT INTO receipts (payment_id, application_id, user_id, receipt_number, amount, payment_type, items, payment_method)
     SELECT ap.id, ap.application_id, a.user_id, $2, COALESCE(ap.amount, 0), ap.payment_type,
            jsonb_build_array(jsonb_build_object(
              'name', 'NCLEX Application Processing (' || COALESCE(ap.payment_type, 'payment') || ')',
              'amount', COALESCE(ap.amount, 0)
            )),
            'stripe'
       FROM application_payments ap
       LEFT JOIN applications a ON a.id = ap.application_id
      WHERE ap.id::text = $1
        AND ap.status = 'paid'
        AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.payment_id = ap.id)`,
    [String(paymentId), receiptNumber]
  )
  return applied
}

/** Mark a donation completed (mirrors donationsAPI.updateStatus(id, 'completed')). */
async function applyDonationPaid(donationId: string, paymentIntentId: string): Promise<boolean> {
  const result = await query(
    `UPDATE donations
        SET status = 'completed',
            donated_at = COALESCE(donated_at, NOW()),
            stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $2),
            stripe_intent_id = COALESCE(stripe_intent_id, $2),
            payment_method = COALESCE(payment_method, 'stripe'),
            updated_at = NOW()
      WHERE id::text = $1
        AND status NOT IN ('completed', 'refunded')
      RETURNING id`,
    [String(donationId), paymentIntentId]
  )
  return (result.rowCount || 0) > 0
}

type IntentMetadata = Record<string, string | undefined>

/**
 * Route a succeeded payment intent to the right "apply" function based on the
 * metadata each create-intent endpoint stamps on it:
 *   quotations    → { quotation_id }
 *   applications  → { payment_id, application_id, user_id }
 *   donations     → { donation_id }
 *   NCLEX subs    → { user_id, plan } (questions.ts create-payment-intent)
 */
async function applySuccessfulPaymentIntent(intentId: string, md: IntentMetadata): Promise<void> {
  if (md.quotation_id) {
    const applied = await applyQuotationPaid(md.quotation_id, intentId)
    console.log(`[payments webhook] quotation ${md.quotation_id} ${applied ? 'marked paid' : 'already paid (no-op)'} (pi ${intentId})`)
  } else if (md.payment_id) {
    const applied = await applyApplicationPaymentPaid(md.payment_id, intentId)
    console.log(`[payments webhook] application payment ${md.payment_id} ${applied ? 'marked paid' : 'already paid (no-op)'} (pi ${intentId})`)
  } else if (md.donation_id) {
    const applied = await applyDonationPaid(md.donation_id, intentId)
    console.log(`[payments webhook] donation ${md.donation_id} ${applied ? 'marked completed' : 'already completed (no-op)'} (pi ${intentId})`)
  } else if (md.user_id && isNclexPlan(md.plan)) {
    const { alreadyApplied } = await applyNclexSubscriptionPayment(md.user_id, md.plan, intentId)
    console.log(`[payments webhook] NCLEX ${md.plan} subscription for user ${md.user_id} ${alreadyApplied ? 'already granted (no-op)' : 'granted'} (pi ${intentId})`)
  } else {
    console.warn(`[payments webhook] payment_intent ${intentId} succeeded but has no recognized metadata — nothing to apply`)
  }
}

/**
 * Mark whichever record a refunded/disputed payment intent paid for as
 * refunded, and revoke any NCLEX subscription the intent granted.
 */
async function applyRefundOrDispute(intentId: string, md: IntentMetadata, reason: string): Promise<void> {
  if (md.quotation_id) {
    const r = await query(
      `UPDATE quotations SET status = 'refunded', updated_at = NOW()
        WHERE id::text = $1 AND status <> 'refunded' RETURNING id`,
      [String(md.quotation_id)]
    )
    if (r.rowCount) console.error(`[payments webhook] quotation ${md.quotation_id} marked refunded (${reason}, pi ${intentId})`)
  } else if (md.payment_id) {
    const r = await query(
      `UPDATE application_payments SET status = 'refunded', updated_at = NOW()
        WHERE id::text = $1 AND status <> 'refunded' RETURNING id`,
      [String(md.payment_id)]
    )
    if (r.rowCount) console.error(`[payments webhook] application payment ${md.payment_id} marked refunded (${reason}, pi ${intentId})`)
  } else if (md.donation_id) {
    const r = await query(
      `UPDATE donations SET status = 'refunded', updated_at = NOW()
        WHERE id::text = $1 AND status <> 'refunded' RETURNING id`,
      [String(md.donation_id)]
    )
    if (r.rowCount) console.error(`[payments webhook] donation ${md.donation_id} marked refunded (${reason}, pi ${intentId})`)
  }
  // Always attempt subscription revocation by payment_reference — covers both
  // metadata-routed subscription intents and any edge case where metadata was
  // lost but the grant recorded the intent id.
  await revokeNclexSubscriptionByPaymentReference(intentId, reason)
}

/**
 * Resolve the payment-intent id + metadata for a charge-level event. Charges
 * inherit metadata from their PaymentIntent in the normal confirm flow, but if
 * the charge carries none of our known keys we fall back to retrieving the
 * intent itself.
 */
async function resolveChargeIntent(
  stripe: Stripe,
  charge: { payment_intent?: string | Stripe.PaymentIntent | null; metadata?: Stripe.Metadata | null }
): Promise<{ intentId: string; metadata: IntentMetadata } | null> {
  const pi = charge.payment_intent
  const intentId = typeof pi === 'string' ? pi : pi?.id
  if (!intentId) return null
  const KNOWN_KEYS = ['quotation_id', 'payment_id', 'donation_id', 'plan'] as const
  const chargeMd = (charge.metadata || {}) as IntentMetadata
  if (KNOWN_KEYS.some((k) => chargeMd[k])) return { intentId, metadata: chargeMd }
  if (typeof pi === 'object' && pi?.metadata) return { intentId, metadata: pi.metadata as IntentMetadata }
  const intent = await stripe.paymentIntents.retrieve(intentId)
  return { intentId, metadata: (intent.metadata || {}) as IntentMetadata }
}

/** Transient infra errors should make Stripe retry (HTTP 500); data errors should not (HTTP 200 + log). */
function isTransientInfraError(err: any): boolean {
  const code = String(err?.code || '')
  if (/^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)$/.test(code)) return true
  // Postgres SQLSTATE classes: 08 connection, 53 insufficient resources,
  // 57 operator intervention (e.g. shutdown), 40 transaction rollback (deadlock).
  if (/^(08|53|57|40)/.test(code)) return true
  if (err?.message && /connect|timeout|terminat/i.test(String(err.message)) && !code) return true
  return false
}

// POST /api/payments/webhook — Stripe webhook endpoint.
// Signature-verified against the raw request bytes (stashed on req.rawBody by
// the json `verify` hook in server/index.ts). This is the authoritative,
// server-to-server confirmation of payment outcomes — the client-driven
// confirm flows remain, but this backstop means a closed browser tab can no
// longer leave a paid record unpaid, and refunds/disputes revoke access.
router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' })
  }
  const stripe = getStripe()
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY missing or placeholder)' })
  }

  const signature = req.headers['stripe-signature']
  const rawBody = (req as any).rawBody as Buffer | undefined
  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'Missing Stripe signature or raw request body' })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature as string, webhookSecret)
  } catch (err: any) {
    console.error('[payments webhook] signature verification failed:', err?.message)
    return res.status(400).json({ error: `Webhook signature verification failed` })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent
        await applySuccessfulPaymentIntent(intent.id, (intent.metadata || {}) as IntentMetadata)
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const md = (intent.metadata || {}) as IntentMetadata
        const lastError = intent.last_payment_error?.message || 'unknown error'
        console.warn(`[payments webhook] payment_intent ${intent.id} failed (${lastError}); metadata:`, md)
        // Only donations have a 'failed' state in the app's status vocabulary;
        // quotations/application payments stay 'pending' so they can be retried.
        if (md.donation_id) {
          await query(
            `UPDATE donations SET status = 'failed', updated_at = NOW()
              WHERE id::text = $1 AND status = 'pending'`,
            [String(md.donation_id)]
          )
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const resolved = await resolveChargeIntent(stripe, charge)
        if (resolved) {
          await applyRefundOrDispute(resolved.intentId, resolved.metadata, 'charge.refunded')
        } else {
          console.warn(`[payments webhook] charge.refunded ${charge.id} has no payment_intent — skipping`)
        }
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        console.error(`[payments webhook] DISPUTE created: ${dispute.id} (charge ${typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id}, amount ${dispute.amount} ${dispute.currency}, reason ${dispute.reason})`)
        const resolved = await resolveChargeIntent(stripe, dispute as any)
        if (resolved) {
          await applyRefundOrDispute(resolved.intentId, resolved.metadata, 'charge.dispute.created')
        }
        break
      }

      default:
        // Unhandled event types are acknowledged so Stripe doesn't retry them.
        break
    }
    return res.json({ received: true })
  } catch (err: any) {
    console.error(`[payments webhook] error handling ${event.type} (${event.id}):`, err)
    if (isTransientInfraError(err)) {
      // Let Stripe retry — the DB hiccupped, not the data.
      return res.status(500).json({ error: 'Transient error, please retry' })
    }
    // Permanent data error (bad row, missing record): acknowledge so Stripe
    // doesn't retry forever; the console.error above surfaces it in logs.
    return res.json({ received: true, warning: 'handler error logged' })
  }
})

// POST /api/payments/create-intent — quotation payment intent
router.post('/create-intent', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured. Set STRIPE_SECRET_KEY in your .env file to a real test/live secret key (currently empty or set to the placeholder).' })
    }

    // The client still sends `amount` (kept for request-contract compatibility)
    // but it is deliberately IGNORED — the authoritative amount comes from the
    // quotation row in the DB, so a tampered client can't pay $1 for a $400 quote.
    const { quotation_id } = req.body
    if (!quotation_id) {
      return res.status(400).json({ error: 'quotation_id is required' })
    }

    const quoteR = await query(
      `SELECT id, amount, status FROM quotations WHERE id::text = $1 LIMIT 1`,
      [String(quotation_id)]
    )
    const quotation = quoteR.rows[0] as { id: string; amount: string | number | null; status: string | null } | undefined
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }
    if (quotation.status === 'paid') {
      return res.status(400).json({ error: 'Quotation is already paid' })
    }
    if (quotation.status === 'cancelled' || quotation.status === 'rejected' || quotation.status === 'expired') {
      return res.status(400).json({ error: `Quotation is ${quotation.status} and cannot be paid` })
    }

    // quotations.amount is NUMERIC dollars — convert to cents for Stripe.
    const amountCents = Math.round(Number(quotation.amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      return res.status(400).json({ error: 'Quotation has an invalid amount' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { quotation_id: String(quotation_id) },
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

    // Only USD is supported (matches the donations UI, which is USD-only).
    const normalizedCurrency = String(currency).toLowerCase()
    if (normalizedCurrency !== 'usd') {
      return res.status(400).json({ error: 'Unsupported currency' })
    }

    // `amount` arrives in dollars; enforce $1.00 minimum / $10,000 maximum.
    const amountCents = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 1_000_000) {
      return res.status(400).json({ error: 'Donation amount must be between $1 and $10,000' })
    }

    // Only pass through allowlisted metadata keys (the frontend sends
    // { donation_id }) — never forward arbitrary client-controlled objects.
    const ALLOWED_METADATA_KEYS = ['donation_id'] as const
    const safeMetadata: Record<string, string> = {}
    for (const key of ALLOWED_METADATA_KEYS) {
      if (metadata && metadata[key] !== undefined && metadata[key] !== null) {
        safeMetadata[key] = String(metadata[key])
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: normalizedCurrency,
      metadata: safeMetadata,
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

    // Re-trigger guard: the unread-task check below stops duplicates while
    // tasks are outstanding, but once staff mark them read a second click
    // would re-create the full batch. Atomic claim — refuse repeats within 24h.
    const guardR = await query(
      `UPDATE application_payments SET tasks_triggered_at = NOW()
        WHERE id = $1
          AND (tasks_triggered_at IS NULL OR tasks_triggered_at < NOW() - INTERVAL '24 hours')
        RETURNING id`,
      [paymentId]
    )
    if (guardR.rowCount === 0) {
      return res.json({ data: { skipped: true, reason: 'tasks already triggered for this payment in the last 24h' } })
    }

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

    // Idempotency in one round-trip: which (recipient, task) pairs still have
    // an unread task outstanding? (Previously one SELECT per pair.)
    const existingR = await query(
      `SELECT user_id::text AS user_id, extra ->> 'task_key' AS task_key
         FROM notifications
        WHERE application_id = $1
          AND type = 'task'
          AND read = false
          AND user_id::text = ANY($2::text[])
          AND extra ->> 'task_key' = ANY($3::text[])`,
      [pay.application_id, recipients.map((r) => r.id), tasks.map((t) => t.key)]
    )
    const existing = new Set(existingR.rows.map((row: any) => `${row.user_id}:${row.task_key}`))

    const toInsert: Array<{ rid: string; link: string; t: (typeof tasks)[number] }> = []
    for (const r of recipients) {
      const rolePath = r.role === 'advisor' ? 'advisor' : 'admin'
      const link = `/${rolePath}/applications/${appLabel}/timeline`
      for (const t of tasks) {
        if (existing.has(`${r.id}:${t.key}`)) continue
        toInsert.push({ rid: r.id, link, t })
      }
    }

    if (toInsert.length > 0) {
      // Single multi-row INSERT instead of one per pair.
      const values: string[] = []
      const params: any[] = []
      toInsert.forEach((x, i) => {
        const b = i * 6
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, 'task', $${b + 5}, $${b + 6}::jsonb, false)`)
        params.push(
          x.rid,
          pay.application_id,
          x.t.title,
          x.t.message,
          x.link,
          JSON.stringify({ task_key: x.t.key, payment_id: pay.id, payment_type: pay.payment_type })
        )
      })
      await query(
        `INSERT INTO notifications (user_id, application_id, title, message, type, link, extra, read)
         VALUES ${values.join(', ')}`,
        params
      )
      // Fan out mobile pushes. Fire and forget — push failures should never
      // roll back a payment-triggered notification insert.
      for (const x of toInsert) {
        void pushNotifyUser(x.rid, {
          title: x.t.title,
          body: x.t.message,
          data: {
            type: 'task',
            applicationId: pay.application_id,
            taskKey: x.t.key,
            link: x.link,
          },
        })
      }
    }
    const inserted = toInsert.length

    res.json({ data: { recipients: recipients.length, notifications: inserted, nclexBonus } })
  } catch (err: any) {
    console.error('[payments] trigger-followup-tasks:', err)
    // Release the 24h re-trigger claim — a failed run shouldn't lock out retries.
    await query(
      `UPDATE application_payments SET tasks_triggered_at = NULL WHERE id = $1`,
      [String(req.params.id)]
    ).catch(() => {})
    res.status(500).json({ error: err?.message || 'Server error' })
  }
})

export default router
