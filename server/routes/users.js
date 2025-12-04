import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/index.js'
import { logger } from '../utils/logger.js'
import { unlockAccount, getAccountLockStatus, getFailedAttemptsCount } from '../utils/loginAttempts.js'

const router = express.Router()

// Update user role (Admin only or for making specific user admin)
router.put('/:email/role', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params
    const { role } = req.body

    // Only allow admins to update roles, OR allow updating to admin for specific email
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jjcantila0728@gmail.com'
    if (req.user.role !== 'admin' && email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    if (!role || !['client', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "client" or "admin"' })
    }

    const supabase = getSupabaseAdmin()

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('email', email)

    if (updateError) {
      throw updateError
    }

    res.json({ message: `User role updated to ${role}`, user: { ...user, role } })
  } catch (error) {
    logger.error('Error updating user role', error)
    res.status(500).json({ error: 'Failed to update user role' })
  }
})

// Unlock user account (Admin only)
router.post('/:userId/unlock', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { userId } = req.params
    const supabase = getSupabaseAdmin()

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Unlock account
    const unlocked = await unlockAccount(userId)
    
    if (!unlocked) {
      return res.status(500).json({ error: 'Failed to unlock account' })
    }

    res.json({ 
      message: 'Account unlocked successfully',
      user: { id: user.id, email: user.email }
    })
  } catch (error) {
    logger.error('Error unlocking account', error)
    res.status(500).json({ error: 'Failed to unlock account' })
  }
})

// Get account lock status (Admin only)
router.get('/:userId/lock-status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { userId } = req.params
    const supabase = getSupabaseAdmin()

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get lock status
    const lockStatus = await getAccountLockStatus(userId)
    const failedAttempts = await getFailedAttemptsCount(user.email, 15)

    res.json({
      ...lockStatus,
      failedAttempts,
      email: user.email
    })
  } catch (error) {
    logger.error('Error getting lock status', error)
    res.status(500).json({ error: 'Failed to get lock status' })
  }
})

// Get login attempts for a user (Admin only)
router.get('/:userId/login-attempts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { userId } = req.params
    const { limit = 50 } = req.query
    const supabase = getSupabaseAdmin()

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get login attempts
    const { data: attempts, error: attemptsError } = await supabase
      .from('login_attempts')
      .select('*')
      .or(`user_id.eq.${userId},email.eq.${user.email}`)
      .order('attempted_at', { ascending: false })
      .limit(parseInt(limit, 10))

    if (attemptsError) {
      throw attemptsError
    }

    res.json(attempts || [])
  } catch (error) {
    logger.error('Error fetching login attempts', error)
    res.status(500).json({ error: 'Failed to fetch login attempts' })
  }
})

export default router

