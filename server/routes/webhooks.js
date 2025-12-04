import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { getStripe } from '../services/stripe.js'
import { generateId, generateReceiptNumber } from '../utils/index.js'
import { logger } from '../utils/logger.js'
import { createNotification } from '../utils/notifications.js'

const router = express.Router()

// Stripe Webhook Handler
// IMPORTANT: This endpoint should be configured in Stripe Dashboard
// The webhook URL should be: https://yourdomain.com/api/webhooks/stripe
// For local development, use Stripe CLI: stripe listen --forward-to localhost:3001/api/webhooks/stripe
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe()
  if (!stripe) {
    logger.error('Stripe webhook received but Stripe is not configured')
    return res.status(503).send('Stripe is not configured')
  }

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.warn('STRIPE_WEBHOOK_SECRET not set. Webhook verification skipped.')
    // In production, you should always verify webhooks
    // For development, you can skip verification if using Stripe CLI
  }

  let event

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } else {
      // For development without webhook secret, parse the event directly
      event = JSON.parse(req.body.toString())
    }
  } catch (err) {
    logger.error('Webhook signature verification failed', err)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  try {
    const supabase = getSupabaseAdmin()
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object
        logger.info('PaymentIntent succeeded', { paymentIntentId: paymentIntent.id })
        
        // Handle application payment
        if (paymentIntent.metadata.payment_id) {
          const paymentId = paymentIntent.metadata.payment_id
          const { data: payment, error: paymentError } = await supabase
            .from('application_payments')
            .select('*')
            .eq('id', paymentId)
            .single()
          
          if (!paymentError && payment && payment.status === 'pending') {
            // Update payment status
            await supabase
              .from('application_payments')
              .update({
                status: 'paid',
                payment_method: 'stripe',
                stripe_payment_intent_id: paymentIntent.id
              })
              .eq('id', paymentId)

            // Generate receipt
            const receiptId = generateId()
            const receiptNumber = await generateReceiptNumber()
            
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

            await supabase
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

            // Create notification for successful payment
            if (payment.user_id) {
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

            logger.info('Payment completed via webhook', { paymentId, receiptNumber })
          }
        }
        
        // Handle quotation payment
        if (paymentIntent.metadata.quotation_id) {
          const quotationId = paymentIntent.metadata.quotation_id
          const { data: quotation, error: quoteError } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', quotationId)
            .single()
          
          if (!quoteError && quotation && quotation.status !== 'paid') {
            await supabase
              .from('quotations')
              .update({ status: 'paid' })
              .eq('id', quotationId)
            logger.info('Quotation marked as paid via webhook', { quotationId })
          }
        }
        break

      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object
        logger.warn('PaymentIntent failed', { paymentIntentId: failedPaymentIntent.id })
        // You can update payment status to 'failed' if needed
        break

      default:
        logger.warn('Unhandled event type', { eventType: event.type })
    }

    res.json({ received: true })
  } catch (error) {
    logger.error('Error processing webhook', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router


