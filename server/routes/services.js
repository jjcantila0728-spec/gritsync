import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken, cacheAPIResponse, responseCache } from '../middleware/index.js'
import { TAX_RATE, SERVICE_PAYMENT_TYPES } from '../config/constants.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Get all services (public endpoint for quote generation)
// Cache for 5 minutes since services don't change frequently
router.get('/', responseCache({ ttl: 300 }), cacheAPIResponse(300), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    
    // Ensure default services exist (both Full and Staggered)
    const { data: existingStaggered } = await supabase
      .from('services')
      .select('*')
      .eq('service_name', 'NCLEX Processing')
      .eq('state', 'New York')
      .eq('payment_type', 'staggered')
      .single()
    
    const { data: existingFull } = await supabase
      .from('services')
      .select('*')
      .eq('service_name', 'NCLEX Processing')
      .eq('state', 'New York')
      .eq('payment_type', 'full')
      .single()
    
    // Create Staggered Payment service if it doesn't exist
    if (!existingStaggered) {
      const staggeredLineItems = JSON.stringify([
        { description: 'NCLEX NY BON Application Fee', amount: 143, step: 1 },
        { description: 'NCLEX NY Mandatory Courses', amount: 54.99, step: 1 },
        { description: 'NCLEX NY Bond Fee', amount: 70, step: 1 },
        { description: 'NCLEX PV Application Fee', amount: 200, step: 2 },
        { description: 'NCLEX PV NCSBN Exam Fee', amount: 150, step: 2 },
        { description: 'NCLEX GritSync Service Fee', amount: 150, step: 2 },
        { description: 'NCLEX NY Quick Results', amount: 8, step: 2 },
      ])
      const totalStep1 = 143 + 54.99 + 70
      const totalStep2 = 200 + 150 + 150 + 8
      const totalFull = totalStep1 + totalStep2
      
      try {
        await supabase
          .from('services')
          .insert({
            id: 'svc_nclex_ny_staggered',
            service_name: 'NCLEX Processing',
            state: 'New York',
            payment_type: 'staggered',
            line_items: staggeredLineItems,
            total_full: totalFull,
            total_step1: totalStep1,
            total_step2: totalStep2
          })
        logger.info('Created default NCLEX Processing - New York (Staggered Payment) service on API call')
      } catch (insertError) {
        logger.error('Error creating default staggered service', insertError)
      }
    }
    
    // Create Full Payment service if it doesn't exist
    if (!existingFull) {
      const fullLineItems = JSON.stringify([
        { description: 'NCLEX NY BON Application Fee', amount: 143 },
        { description: 'NCLEX NY Mandatory Courses', amount: 54.99 },
        { description: 'NCLEX NY Bond Fee', amount: 70 },
        { description: 'NCLEX PV Application Fee', amount: 200 },
        { description: 'NCLEX PV NCSBN Exam Fee', amount: 150 },
        { description: 'NCLEX GritSync Service Fee', amount: 150 },
        { description: 'NCLEX NY Quick Results', amount: 8 },
      ])
      const totalFull = 143 + 54.99 + 70 + 200 + 150 + 150 + 8
      
      try {
        await supabase
          .from('services')
          .insert({
            id: 'svc_nclex_ny_full',
            service_name: 'NCLEX Processing',
            state: 'New York',
            payment_type: 'full',
            line_items: fullLineItems,
            total_full: totalFull,
            total_step1: null,
            total_step2: null
          })
        logger.info('Created default NCLEX Processing - New York (Full Payment) service on API call')
      } catch (insertError) {
        logger.error('Error creating default full service', insertError)
      }
    }
    
    const { data: services, error: fetchError } = await supabase
      .from('services')
      .select('*')
      .order('service_name', { ascending: true })
      .order('state', { ascending: true })
    
    if (fetchError) {
      throw fetchError
    }
    
    logger.debug(`Found ${services?.length || 0} services in database`)
    const formatted = (services || []).map(service => {
      try {
        const lineItems = service.line_items ? (typeof service.line_items === 'string' ? JSON.parse(service.line_items) : service.line_items) : []
        return {
          id: service.id,
          service_name: service.service_name,
          state: service.state,
          payment_type: service.payment_type || 'staggered',
          line_items: lineItems,
          total_full: service.total_full || service.total || 0,
          total_step1: service.total_step1 || null,
          total_step2: service.total_step2 || null,
          created_at: service.created_at,
          updated_at: service.updated_at
        }
      } catch (e) {
        logger.error('Error parsing line_items for service', e, { serviceId: service.id })
        return {
          id: service.id,
          service_name: service.service_name,
          state: service.state,
          payment_type: service.payment_type || 'staggered',
          line_items: [],
          total_full: service.total_full || service.total || 0,
          total_step1: service.total_step1 || null,
          total_step2: service.total_step2 || null,
          created_at: service.created_at,
          updated_at: service.updated_at
        }
      }
    })
    logger.debug(`Returning ${formatted.length} formatted services`)
    res.json(formatted)
  } catch (error) {
    logger.error('Error fetching services', error)
    res.status(500).json({ error: 'Failed to fetch services', details: error.message })
  }
})

// Get services by service name and state
// Cache for 5 minutes
router.get('/:serviceName/:state', responseCache({ ttl: 300 }), cacheAPIResponse(300), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    
    // Decode URL-encoded parameters
    const serviceName = decodeURIComponent(req.params.serviceName)
    const state = decodeURIComponent(req.params.state)
    
    logger.debug(`Fetching services for: ${serviceName} - ${state}`)
    
    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('service_name', serviceName)
      .eq('state', state)
      .single()
    
    if (error || !service) {
      return res.json(null)
    }
    
    logger.debug('Found service', { serviceId: service.id })
    
    try {
      const formatted = {
        ...service,
        line_items: typeof service.line_items === 'string' ? JSON.parse(service.line_items || '[]') : (service.line_items || [])
      }
      res.json(formatted)
    } catch (e) {
      res.json({
        ...service,
        line_items: []
      })
    }
  } catch (error) {
    logger.error('Error fetching services', error)
    res.status(500).json({ error: 'Failed to fetch services' })
  }
})

// Create or update service (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { id, service_name, state, payment_type, line_items, total_full, total_step1, total_step2 } = req.body

    if (!service_name || !state || !payment_type || !line_items) {
      return res.status(400).json({ error: 'Service name, state, payment type, and line items are required' })
    }

    // Calculate totals with tax (12% for taxable items)
    const TAX_RATE = 0.12
    let calculatedTotalFull = total_full
    let calculatedTotalStep1 = total_step1
    let calculatedTotalStep2 = total_step2

    if (!calculatedTotalFull || !calculatedTotalStep1 || (payment_type === 'staggered' && !calculatedTotalStep2)) {
      const step1Items = line_items.filter((item) => !item.step || item.step === 1)
      const step2Items = line_items.filter((item) => item.step === 2)
      
      // Calculate subtotals (before tax)
      const subtotalStep1 = step1Items.reduce((sum, item) => sum + (item.amount || 0), 0)
      const subtotalStep2 = step2Items.reduce((sum, item) => sum + (item.amount || 0), 0)
      
      // Calculate tax for taxable items
      const taxStep1 = step1Items.reduce((sum, item) => {
        return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
      }, 0)
      const taxStep2 = step2Items.reduce((sum, item) => {
        return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
      }, 0)
      
      // Calculate totals (subtotal + tax)
      calculatedTotalStep1 = subtotalStep1 + taxStep1
      calculatedTotalStep2 = subtotalStep2 + taxStep2
      calculatedTotalFull = calculatedTotalStep1 + calculatedTotalStep2
    }

    const lineItemsJson = typeof line_items === 'string' ? line_items : JSON.stringify(line_items)
    const serviceId = id || `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const supabase = getSupabaseAdmin()

    // Check if service exists (by unique constraint - now includes payment_type)
    const { data: existing } = await supabase
      .from('services')
      .select('id')
      .eq('service_name', service_name)
      .eq('state', state)
      .eq('payment_type', payment_type)
      .single()

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('services')
        .update({
          payment_type,
          line_items: lineItemsJson,
          total_full: calculatedTotalFull,
          total_step1: calculatedTotalStep1,
          total_step2: calculatedTotalStep2 || null
        })
        .eq('id', existing.id)
      
      if (updateError) {
        throw updateError
      }
      
      res.json({ id: existing.id, message: 'Service updated successfully' })
    } else {
      // Create new
      const { error: insertError } = await supabase
        .from('services')
        .insert({
          id: serviceId,
          service_name,
          state,
          payment_type,
          line_items: lineItemsJson,
          total_full: calculatedTotalFull,
          total_step1: calculatedTotalStep1,
          total_step2: calculatedTotalStep2 || null
        })
      
      if (insertError) {
        throw insertError
      }
      
      res.json({ id: serviceId, message: 'Service created successfully' })
    }
  } catch (error) {
    logger.error('Error saving service', error)
    res.status(500).json({ error: 'Failed to save service' })
  }
})

// Update service (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { service_name, state, payment_type, line_items, total_full, total_step1, total_step2 } = req.body
    const supabase = getSupabaseAdmin()
    
    const { data: service, error: fetchError } = await supabase
      .from('services')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (fetchError || !service) {
      return res.status(404).json({ error: 'Service not found' })
    }

    const lineItemsJson = line_items 
      ? (typeof line_items === 'string' ? line_items : JSON.stringify(line_items))
      : (typeof service.line_items === 'string' ? service.line_items : JSON.stringify(service.line_items || []))

    // Calculate totals with tax (12% for taxable items)
    const TAX_RATE = 0.12
    let calculatedTotalFull = total_full
    let calculatedTotalStep1 = total_step1
    let calculatedTotalStep2 = total_step2

    if (line_items && (!calculatedTotalFull || !calculatedTotalStep1 || (payment_type === 'staggered' && !calculatedTotalStep2))) {
      const step1Items = line_items.filter((item) => !item.step || item.step === 1)
      const step2Items = line_items.filter((item) => item.step === 2)
      
      // Calculate subtotals (before tax)
      const subtotalStep1 = step1Items.reduce((sum, item) => sum + (item.amount || 0), 0)
      const subtotalStep2 = step2Items.reduce((sum, item) => sum + (item.amount || 0), 0)
      
      // Calculate tax for taxable items
      const taxStep1 = step1Items.reduce((sum, item) => {
        return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
      }, 0)
      const taxStep2 = step2Items.reduce((sum, item) => {
        return sum + (item.taxable ? (item.amount || 0) * TAX_RATE : 0)
      }, 0)
      
      // Calculate totals (subtotal + tax)
      calculatedTotalStep1 = subtotalStep1 + taxStep1
      calculatedTotalStep2 = subtotalStep2 + taxStep2
      calculatedTotalFull = calculatedTotalStep1 + calculatedTotalStep2
    }

    const updateData = {}
    if (service_name !== undefined) updateData.service_name = service_name
    if (state !== undefined) updateData.state = state
    if (payment_type !== undefined) updateData.payment_type = payment_type
    if (lineItemsJson !== undefined) updateData.line_items = lineItemsJson
    if (calculatedTotalFull !== undefined) updateData.total_full = calculatedTotalFull
    if (calculatedTotalStep1 !== undefined) updateData.total_step1 = calculatedTotalStep1
    if (calculatedTotalStep2 !== undefined) updateData.total_step2 = calculatedTotalStep2

    const { error: updateError } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', req.params.id)
    
    if (updateError) {
      throw updateError
    }

    const { data: updated, error: fetchUpdatedError } = await supabase
      .from('services')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (fetchUpdatedError) {
      throw fetchUpdatedError
    }
    
    updated.line_items = typeof updated.line_items === 'string' 
      ? JSON.parse(updated.line_items || '[]') 
      : (updated.line_items || [])
    res.json(updated)
  } catch (error) {
    logger.error('Error updating service', error)
    res.status(500).json({ error: 'Failed to update service' })
  }
})

// Delete service (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const supabase = getSupabaseAdmin()
    
    const { data: service, error: fetchError } = await supabase
      .from('services')
      .select('*')
      .eq('id', req.params.id)
      .single()
    
    if (fetchError || !service) {
      return res.status(404).json({ error: 'Service not found' })
    }

    const { error: deleteError } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
    
    if (deleteError) {
      throw deleteError
    }
    
    res.json({ message: 'Service deleted successfully' })
  } catch (error) {
    logger.error('Error deleting service', error)
    res.status(500).json({ error: 'Failed to delete service' })
  }
})

export default router
