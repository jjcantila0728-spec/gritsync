import express from 'express'
import { getStripe } from '../services/stripe.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Test route to verify server is running new code
router.get('/user-details-route', (req, res) => {
  res.json({ message: 'User details routes are loaded!', timestamp: new Date().toISOString() })
})

// Test route for documents
router.get('/documents-route', (req, res) => {
  res.json({ message: 'Documents routes are loaded!', timestamp: new Date().toISOString() })
})

// Test route for Stripe connection
router.get('/stripe-connection', async (req, res) => {
  try {
    const stripe = getStripe()
    // Check if Stripe is initialized
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Stripe is not configured',
        message: 'STRIPE_SECRET_KEY environment variable is not set',
        timestamp: new Date().toISOString()
      })
    }

    // Check if secret key is set
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      return res.status(503).json({
        success: false,
        error: 'Stripe secret key not found',
        message: 'STRIPE_SECRET_KEY environment variable is not set',
        timestamp: new Date().toISOString()
      })
    }

    // Determine if test or live mode
    const isTestMode = secretKey.startsWith('sk_test_')
    const keyPrefix = secretKey.substring(0, 8) // Show first 8 chars for identification

    // Test the connection by retrieving account information
    const account = await stripe.accounts.retrieve()
    
    // Also try to retrieve balance to verify full API access
    const balance = await stripe.balance.retrieve()

    res.json({
      success: true,
      message: 'Stripe connection successful!',
      details: {
        accountId: account.id,
        accountType: account.type,
        country: account.country,
        defaultCurrency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        mode: isTestMode ? 'test' : 'live',
        keyPrefix: keyPrefix + '...',
        balance: {
          available: balance.available.map(b => ({
            amount: b.amount / 100, // Convert from cents
            currency: b.currency
          })),
          pending: balance.pending.map(b => ({
            amount: b.amount / 100,
            currency: b.currency
          }))
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Stripe connection test error', error)
    res.status(500).json({
      success: false,
      error: 'Stripe connection test failed',
      message: error.message,
      type: error.type || 'Unknown',
      code: error.code || 'unknown_error',
      timestamp: new Date().toISOString()
    })
  }
})

export default router


