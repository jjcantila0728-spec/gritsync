import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/index.js'
import { generateQuoteId, generateGritId } from '../utils/index.js'
import { getStripe } from '../services/stripe.js'
import bcrypt from 'bcryptjs'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Get all quotations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    
    let query = supabase
      .from('quotations')
      .select('*')
    
    if (req.user.role !== 'admin') {
      query = query.eq('user_id', req.user.id)
    }
    
    query = query.order('created_at', { ascending: false })
    
    const { data: quotations, error } = await query
    
    if (error) {
      throw error
    }
    
    // Parse line_items JSON for each quotation
    const parsedQuotations = (quotations || []).map(q => {
      if (q.line_items) {
        try {
          q.line_items = typeof q.line_items === 'string' ? JSON.parse(q.line_items) : q.line_items
        } catch (e) {
          q.line_items = null
        }
      }
      return q
    })
    
    res.json(parsedQuotations)
  } catch (error) {
    logger.error('Error fetching quotations', error)
    res.status(500).json({ error: 'Failed to fetch quotations' })
  }
})

// Public endpoint for creating quotations (without authentication)
router.post('/public', async (req, res) => {
  try {
    const { amount, description, email, name } = req.body

    if (!amount || !description || !email) {
      return res.status(400).json({ error: 'Amount, description, and email are required' })
    }

    const supabase = getSupabaseAdmin()

    // Check if user exists, if not create a temporary user account
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    
    let userId
    if (!existingUser) {
      // Create a temporary user account
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const tempPassword = Math.random().toString(36).slice(-8)
      const hashedPassword = bcrypt.hashSync(tempPassword, 10)
      const gritId = await generateGritId()
      
      const nameParts = (name || 'Guest User').trim().split(' ')
      const firstName = nameParts[0] || 'Guest'
      const lastName = nameParts.slice(1).join(' ') || 'User'
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          password: hashedPassword,
          role: 'client',
          first_name: firstName,
          last_name: lastName,
          grit_id: gritId
        })
      
      if (insertError) {
        throw insertError
      }
    } else {
      userId = existingUser.id
    }

    const id = await generateQuoteId()
    const {
      service,
      state,
      payment_type,
      line_items,
      client_first_name,
      client_last_name,
      client_email: clientEmail,
      client_mobile
    } = req.body
    const lineItemsJson = line_items ? (typeof line_items === 'string' ? line_items : JSON.stringify(line_items)) : null
    
    // Calculate validity date (30 days from now) - quotes are saved until expiration
    const validityDate = new Date()
    validityDate.setDate(validityDate.getDate() + 30)

    const { data: quotation, error: insertError } = await supabase
      .from('quotations')
      .insert({
        id,
        user_id: userId,
        amount,
        description,
        status: 'pending',
        service: service || null,
        state: state || null,
        payment_type: payment_type || null,
        line_items: lineItemsJson,
        client_first_name: client_first_name || null,
        client_last_name: client_last_name || null,
        client_email: clientEmail || email,
        client_mobile: client_mobile || null,
        validity_date: validityDate.toISOString()
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    if (quotation.line_items) {
      try {
        quotation.line_items = typeof quotation.line_items === 'string' 
          ? JSON.parse(quotation.line_items) 
          : quotation.line_items
      } catch (e) {
        quotation.line_items = null
      }
    }
    res.status(201).json(quotation)
  } catch (error) {
    logger.error('Error creating quotation', error)
    res.status(500).json({ error: 'Failed to create quotation' })
  }
})

// Create quotation (authenticated)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { amount, description } = req.body

    if (!amount || !description) {
      return res.status(400).json({ error: 'Amount and description are required' })
    }

    const supabase = getSupabaseAdmin()
    const id = await generateQuoteId()
    
    const { error } = await supabase
      .from('quotations')
      .insert({
        id,
        user_id: req.user.id,
        amount,
        description,
        status: 'pending'
      })

    if (error) {
      throw error
    }

    res.json({ id, message: 'Quotation created successfully' })
  } catch (error) {
    logger.error('Error creating quotation', error)
    res.status(500).json({ error: 'Failed to create quotation' })
  }
})

// Public endpoint for getting quotation by ID (without authentication)
router.get('/public/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data: quotation, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (error || !quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }

    // Parse line_items JSON if it exists
    if (quotation.line_items) {
      try {
        quotation.line_items = typeof quotation.line_items === 'string'
          ? JSON.parse(quotation.line_items)
          : quotation.line_items
      } catch (e) {
        quotation.line_items = null
      }
    }

    res.json(quotation)
  } catch (error) {
    logger.error('Error fetching quotation', error)
    res.status(500).json({ error: 'Failed to fetch quotation' })
  }
})

// Get quotation by ID (authenticated)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data: quotation, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (error || !quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }

    // Check access
    if (req.user.role !== 'admin' && quotation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Parse line_items JSON if it exists
    if (quotation.line_items) {
      try {
        quotation.line_items = typeof quotation.line_items === 'string'
          ? JSON.parse(quotation.line_items)
          : quotation.line_items
      } catch (e) {
        quotation.line_items = null
      }
    }

    res.json(quotation)
  } catch (error) {
    logger.error('Error fetching quotation', error)
    res.status(500).json({ error: 'Failed to fetch quotation' })
  }
})

// Update quotation (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const supabase = getSupabaseAdmin()
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (fetchError || !quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }

    const {
      amount,
      description,
      service,
      state,
      payment_type,
      line_items,
      client_first_name,
      client_last_name,
      client_email,
      client_mobile,
      validity_date
    } = req.body

    const lineItemsJson = line_items 
      ? (typeof line_items === 'string' ? line_items : JSON.stringify(line_items))
      : quotation.line_items

    const updateData = {}
    if (amount !== undefined) updateData.amount = amount
    if (description !== undefined) updateData.description = description
    if (service !== undefined) updateData.service = service
    if (state !== undefined) updateData.state = state
    if (payment_type !== undefined) updateData.payment_type = payment_type
    if (lineItemsJson !== undefined) updateData.line_items = lineItemsJson
    if (client_first_name !== undefined) updateData.client_first_name = client_first_name
    if (client_last_name !== undefined) updateData.client_last_name = client_last_name
    if (client_email !== undefined) updateData.client_email = client_email
    if (client_mobile !== undefined) updateData.client_mobile = client_mobile
    if (validity_date !== undefined) updateData.validity_date = validity_date

    const { error: updateError } = await supabase
      .from('quotations')
      .update(updateData)
      .eq('id', req.params.id)

    if (updateError) {
      throw updateError
    }

    const { data: updated, error: fetchUpdatedError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (fetchUpdatedError) {
      throw fetchUpdatedError
    }

    if (updated.line_items) {
      try {
        updated.line_items = typeof updated.line_items === 'string'
          ? JSON.parse(updated.line_items)
          : updated.line_items
      } catch (e) {
        updated.line_items = null
      }
    }

    res.json(updated)
  } catch (error) {
    logger.error('Error updating quotation', error)
    res.status(500).json({ error: 'Failed to update quotation' })
  }
})

// Delete quotation (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    
    // Verify user role from database (not just JWT token, in case role was updated)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single()
    
    if (userError || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { data: quotation, error: quoteError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (quoteError || !quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }

    const { error: deleteError } = await supabase
      .from('quotations')
      .delete()
      .eq('id', req.params.id)

    if (deleteError) {
      throw deleteError
    }

    res.json({ message: 'Quotation deleted successfully' })
  } catch (error) {
    logger.error('Error deleting quotation', error)
    res.status(500).json({ error: 'Failed to delete quotation' })
  }
})

// Create payment intent for quotation
router.post('/:id/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' })
    }

    const quotationId = req.params.id
    const { amount } = req.body
    const supabase = getSupabaseAdmin()

    // Get quotation
    const { data: quotation, error: quoteError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .single()
    
    if (quoteError || !quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }

    // Check access
    if (req.user.role !== 'admin' && quotation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Use provided amount or quotation amount
    const paymentAmount = amount || quotation.amount

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentAmount), // Amount should already be in cents
      currency: 'usd',
      metadata: {
        quotation_id: quotationId,
        user_id: quotation.user_id,
        type: 'quotation'
      },
      description: `Quotation Payment - ${quotation.description || 'Service Payment'}`
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    logger.error('Error creating payment intent for quotation', error)
    res.status(500).json({ error: 'Failed to create payment intent', details: error.message })
  }
})

// Update quotation status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body
    const quotationId = req.params.id
    const supabase = getSupabaseAdmin()

    // Get quotation
    const { data: quotation, error: quoteError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .single()
    
    if (quoteError || !quotation) {
      return res.status(404).json({ error: 'Quotation not found' })
    }

    // Check access
    if (req.user.role !== 'admin' && quotation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { error: updateError } = await supabase
      .from('quotations')
      .update({ status })
      .eq('id', quotationId)

    if (updateError) {
      throw updateError
    }

    res.json({ message: 'Quotation status updated successfully' })
  } catch (error) {
    logger.error('Error updating quotation status', error)
    res.status(500).json({ error: 'Failed to update quotation status' })
  }
})

export default router
