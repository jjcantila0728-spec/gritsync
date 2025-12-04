import express from 'express'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/index.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Get all notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { unreadOnly } = req.query
    const supabase = getSupabaseAdmin()
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
    
    if (unreadOnly === 'true') {
      query = query.eq('read', false)
    }
    
    query = query.order('created_at', { ascending: false }).limit(50)
    
    const { data: notifications, error } = await query
    
    if (error) {
      throw error
    }
    
    res.json(notifications || [])
  } catch (error) {
    logger.error('Error fetching notifications', error)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false)
    
    if (error) {
      throw error
    }
    
    res.json({ count: count || 0 })
  } catch (error) {
    logger.error('Error fetching unread count', error)
    res.status(500).json({ error: 'Failed to fetch unread count' })
  }
})

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const supabase = getSupabaseAdmin()
    
    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()
    
    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }
    
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    
    if (updateError) {
      throw updateError
    }
    
    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    logger.error('Error marking notification as read', error)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
    
    if (error) {
      throw error
    }
    
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    logger.error('Error marking all notifications as read', error)
    res.status(500).json({ error: 'Failed to mark all notifications as read' })
  }
})

export default router
