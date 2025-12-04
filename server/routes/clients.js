import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/index.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Admin impersonation - login as user (Admin only)
router.post('/:userId/login-as', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { userId } = req.params

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin()

    // Get user from Supabase users table
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .limit(1)

    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = users[0]

    // Generate magic link for the user with redirect to client dashboard
    const redirectTo = `${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/dashboard`
    
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: redirectTo
      }
    })

    if (error) {
      return res.status(500).json({ error: 'Failed to generate login link' })
    }

    // Return the magic link URL
    res.json({ 
      loginUrl: data.properties.action_link,
      email: user.email 
    })
  } catch (error) {
    logger.error('Error in login-as', error)
    res.status(500).json({ error: 'Failed to login as user' })
  }
})

// Get all clients (Admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const supabase = getSupabaseAdmin()

    // Only fetch registered clients (exclude users created from quotation generator)
    // Quotation-generated users have IDs starting with 'user_'
    const { data: clients, error } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, grit_id, created_at')
      .eq('role', 'client')
      .not('id', 'like', 'user_%')
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }

    // Format clients to include full_name for backward compatibility
    const formattedClients = clients?.map(client => ({
      ...client,
      full_name: client.first_name && client.last_name 
        ? `${client.first_name} ${client.last_name}`.trim()
        : null
    })) || []

    res.json(formattedClients)
  } catch (error) {
    logger.error('Error fetching clients', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

// Search client by GRIT-ID (Admin only)
router.get('/grit/:gritId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { gritId } = req.params
    const supabase = getSupabaseAdmin()
    
    const { data: client, error } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, grit_id, created_at')
      .eq('grit_id', gritId)
      .eq('role', 'client')
      .single()
    
    if (error || !client) {
      return res.status(404).json({ error: 'Client not found' })
    }

    // Format client to include full_name for backward compatibility
    const formattedClient = {
      ...client,
      full_name: client.first_name && client.last_name 
        ? `${client.first_name} ${client.last_name}`.trim()
        : null
    }

    res.json(formattedClient)
  } catch (error) {
    logger.error('Error searching client', error)
    res.status(500).json({ error: 'Failed to search client' })
  }
})

export default router
