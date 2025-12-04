import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/index.js'
import { getStripe } from '../services/stripe.js'
import { generateId, generatePaymentId, generateReceiptNumber } from '../utils/index.js'
import { logger } from '../utils/logger.js'
import { createNotification } from '../utils/notifications.js'

const router = express.Router()

// Create Stripe Payment Intent
router.post('/:id/create-intent', authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' })
    }

    const paymentId = req.params.id
    const supabase = getSupabaseAdmin()

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('application_payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    
    if (paymentError || !payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment is not pending' })
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(payment.amount) * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        payment_id: paymentId,
        application_id: payment.application_id,
        user_id: payment.user_id,
        payment_type: payment.payment_type
      },
      description: `NCLEX Application Payment - ${payment.payment_type === 'step1' ? 'Step 1' : payment.payment_type === 'step2' ? 'Step 2' : 'Full'}`
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    logger.error('Error creating payment intent', error)
    res.status(500).json({ error: 'Failed to create payment intent', details: error.message })
  }
})

// Complete payment
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe()
    const { transaction_id, stripe_payment_intent_id, payment_method = 'stripe' } = req.body
    const paymentId = req.params.id
    const supabase = getSupabaseAdmin()

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('application_payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    
    if (paymentError || !payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // If Stripe payment intent is provided, verify it
    if (stripe_payment_intent_id && stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripe_payment_intent_id)
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ error: 'Payment intent has not been completed' })
        }
      } catch (error) {
        logger.error('Error verifying payment intent', error)
        return res.status(400).json({ error: 'Invalid payment intent' })
      }
    }

    // Get previous status to check if it changed
    const previousStatus = payment.status
    
    // Update payment status
    const { error: updateError } = await supabase
      .from('application_payments')
      .update({
        status: 'paid',
        payment_method,
        transaction_id: transaction_id || null,
        stripe_payment_intent_id: stripe_payment_intent_id || null
      })
      .eq('id', paymentId)

    if (updateError) {
      throw updateError
    }

    // Create notification if payment status changed to paid
    if (previousStatus !== 'paid' && payment.user_id) {
      const paymentTypeNames = {
        'step1': 'Step 1',
        'step2': 'Step 2',
        'full': 'Full Payment'
      }
      
      await createNotification(
        payment.user_id,
        payment.application_id,
        'payment',
        'Payment Successful',
        `Your ${paymentTypeNames[payment.payment_type] || 'payment'} of $${parseFloat(payment.amount).toFixed(2)} has been processed successfully.`
      )
    }

    // Generate receipt
    const receiptId = generateId()
    const receiptNumber = await generateReceiptNumber()
    
    // Define payment items based on payment type
    let items = []
    if (payment.payment_type === 'step1') {
      items = [
        { name: 'NCLEX NY BON Application Fee', amount: 143 },
        { name: 'NCLEX NY Mandatory Courses', amount: 54.99 },
        { name: 'NCLEX NY Bond Fee', amount: 70 }
      ]
    } else if (payment.payment_type === 'step2') {
      items = [
        { name: 'NCLEX PV Application Fee', amount: 200 },
        { name: 'NCLEX PV NCSBN Exam Fee', amount: 150 },
        { name: 'NCLEX GritSync Service Fee', amount: 150 },
        { name: 'NCLEX NY Quick Results', amount: 8 }
      ]
    } else if (payment.payment_type === 'full') {
      items = [
        { name: 'NCLEX PV Application Fee', amount: 200 },
        { name: 'NCLEX PV NCSBN Exam Fee', amount: 150 },
        { name: 'NCLEX GritSync Service Fee', amount: 100 },
        { name: 'NCLEX NY Quick Results', amount: 8 }
      ]
    }

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        id: receiptId,
        payment_id: paymentId,
        application_id: payment.application_id,
        user_id: payment.user_id,
        receipt_number: receiptNumber,
        amount: payment.amount,
        payment_type: payment.payment_type,
        items: items
      })
      .select()
      .single()

    if (receiptError) {
      throw receiptError
    }

    res.json({
      message: 'Payment completed successfully',
      payment: {
        ...payment,
        status: 'paid'
      },
      receipt: {
        ...receipt,
        items: typeof receipt.items === 'string' ? JSON.parse(receipt.items) : receipt.items
      }
    })
  } catch (error) {
    logger.error('Error completing payment', error)
    res.status(500).json({ error: 'Failed to complete payment' })
  }
})

// Get payment receipt
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  try {
    const paymentId = req.params.id
    const supabase = getSupabaseAdmin()

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('application_payments')
      .select('*')
      .eq('id', paymentId)
      .single()
    
    if (paymentError || !payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('payment_id', paymentId)
      .single()
    
    if (receiptError || !receipt) {
      return res.status(404).json({ error: 'Receipt not found' })
    }

    res.json({
      ...receipt,
      items: typeof receipt.items === 'string' ? JSON.parse(receipt.items) : receipt.items
    })
  } catch (error) {
    logger.error('Error fetching receipt', error)
    res.status(500).json({ error: 'Failed to fetch receipt' })
  }
})

export default router


