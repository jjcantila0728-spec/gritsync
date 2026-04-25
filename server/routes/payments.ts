import { Router, Response } from 'express'
import Stripe from 'stripe'
import { query } from '../db'
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2023-10-16' as any })
}

// POST /api/payments/create-intent — quotation payment intent
router.post('/create-intent', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service is not configured' })
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
      return res.status(503).json({ error: 'Payment service is not configured' })
    }

    const { payment_id } = req.body
    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id is required' })
    }

    // Fetch payment record to get amount and metadata
    // application_payments has no user_id — join with applications to get it
    const result = await query(
      `SELECT ap.id, ap.amount, ap.currency, ap.description, ap.application_id, a.user_id
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
      description: payment.description || `Application payment ${payment_id}`,
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
      return res.status(503).json({ error: 'Payment service is not configured' })
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

export default router
