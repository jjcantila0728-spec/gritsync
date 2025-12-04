import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken, cacheShortLived, responseCache } from '../middleware/index.js'
import { reinitializeStripe } from '../services/stripe.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Get dashboard stats
// Cache for 1 minute (stats change frequently)
router.get('/stats', authenticateToken, responseCache({ ttl: 60 }), cacheShortLived(60), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    
    // Build applications query
    let applicationsQuery = supabase
      .from('applications')
      .select('id, status', { count: 'exact' })
    
    if (req.user.role !== 'admin') {
      applicationsQuery = applicationsQuery.eq('user_id', req.user.id)
    }
    
    const { data: applications, count: totalApps, error: appsError } = await applicationsQuery
    
    if (appsError) {
      throw appsError
    }
    
    const pending = applications?.filter(app => app.status === 'pending').length || 0
    const approved = applications?.filter(app => app.status === 'completed').length || 0
    
    // Build quotations query
    let quotationsQuery = supabase
      .from('quotations')
      .select('id', { count: 'exact', head: true })
    
    if (req.user.role !== 'admin') {
      quotationsQuery = quotationsQuery.eq('user_id', req.user.id)
    }
    
    const { count: totalQuotes, error: quotesError } = await quotationsQuery
    
    if (quotesError) {
      throw quotesError
    }

    res.json({
      applications: totalApps || 0,
      pending,
      approved,
      quotations: totalQuotes || 0
    })
  } catch (error) {
    logger.error('Error fetching stats', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Admin stats (Admin only)
// Cache for 1 minute
router.get('/admin/stats', authenticateToken, responseCache({ ttl: 60 }), cacheShortLived(60), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const supabase = getSupabaseAdmin()

    // Total users (excluding admins)
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'client')
    
    if (usersError) {
      throw usersError
    }
    
    // Total applications
    const { count: totalApplications, error: appsError } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
    
    if (appsError) {
      throw appsError
    }
    
    // Total revenue from completed payments
    const { data: payments, error: paymentsError } = await supabase
      .from('application_payments')
      .select('amount')
      .eq('status', 'paid')
    
    if (paymentsError) {
      throw paymentsError
    }
    
    const revenue = payments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

    // Total quotations
    const { count: totalQuotations, error: quotesError } = await supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true })
    
    if (quotesError) {
      throw quotesError
    }

    res.json({
      totalUsers: totalUsers || 0,
      totalApplications: totalApplications || 0,
      revenue,
      totalQuotations: totalQuotations || 0
    })
  } catch (error) {
    logger.error('Error fetching admin stats', error)
    res.status(500).json({ error: 'Failed to fetch admin stats' })
  }
})

// Get admin settings (Admin only)
// Cache for 5 minutes (settings don't change frequently)
router.get('/admin/settings', authenticateToken, responseCache({ ttl: 300 }), cacheAPIResponse(300), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const supabase = getSupabaseAdmin()
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
    
    if (error) {
      throw error
    }
    
    const settingsObj = {}
    settings?.forEach(setting => {
      settingsObj[setting.key] = setting.value
    })

    // Return default values if settings don't exist
    res.json({
      siteName: settingsObj.siteName || 'GritSync',
      siteEmail: settingsObj.siteEmail || 'admin@gritsync.com',
      supportEmail: settingsObj.supportEmail || 'support@gritsync.com',
      stripeEnabled: settingsObj.stripeEnabled === 'true',
      maintenanceMode: settingsObj.maintenanceMode === 'true',
      stripePublishableKey: settingsObj.stripePublishableKey || '',
      stripeSecretKey: settingsObj.stripeSecretKey ? '***' + settingsObj.stripeSecretKey.slice(-4) : '', // Mask secret key
      stripeWebhookSecret: settingsObj.stripeWebhookSecret ? '***' + settingsObj.stripeWebhookSecret.slice(-4) : '', // Mask webhook secret
    })
  } catch (error) {
    logger.error('Error fetching admin settings', error)
    res.status(500).json({ error: 'Failed to fetch admin settings' })
  }
})

// Save admin settings (Admin only)
router.post('/admin/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const {
      siteName,
      siteEmail,
      supportEmail,
      stripeEnabled,
      maintenanceMode,
      stripePublishableKey,
      stripeSecretKey,
      stripeWebhookSecret,
    } = req.body

    const supabase = getSupabaseAdmin()

    // Helper function to upsert setting
    const upsertSetting = async (key, value) => {
      const { data: existing } = await supabase
        .from('settings')
        .select('key')
        .eq('key', key)
        .single()
      
      if (existing) {
        await supabase
          .from('settings')
          .update({ value })
          .eq('key', key)
      } else {
        await supabase
          .from('settings')
          .insert({ key, value })
      }
    }

    // Save all settings
    if (siteName !== undefined) await upsertSetting('siteName', siteName)
    if (siteEmail !== undefined) await upsertSetting('siteEmail', siteEmail)
    if (supportEmail !== undefined) await upsertSetting('supportEmail', supportEmail)
    if (stripeEnabled !== undefined) await upsertSetting('stripeEnabled', stripeEnabled.toString())
    if (maintenanceMode !== undefined) await upsertSetting('maintenanceMode', maintenanceMode.toString())
    if (stripePublishableKey !== undefined) await upsertSetting('stripePublishableKey', stripePublishableKey)
    
    // Only update secret keys if they're provided and not masked (don't start with ***)
    if (stripeSecretKey !== undefined && !stripeSecretKey.startsWith('***')) {
      await upsertSetting('stripeSecretKey', stripeSecretKey)
      // Update environment variable for current session (note: this won't persist after server restart)
      process.env.STRIPE_SECRET_KEY = stripeSecretKey
      // Re-initialize Stripe with new key
      reinitializeStripe()
    }
    
    if (stripeWebhookSecret !== undefined && !stripeWebhookSecret.startsWith('***')) {
      await upsertSetting('stripeWebhookSecret', stripeWebhookSecret)
      process.env.STRIPE_WEBHOOK_SECRET = stripeWebhookSecret
    }

    res.json({ message: 'Settings saved successfully' })
  } catch (error) {
    logger.error('Error saving admin settings', error)
    res.status(500).json({ error: 'Failed to save admin settings' })
  }
})

export default router


