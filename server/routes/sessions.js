// Session Management Routes
import express from 'express'
import { authenticateToken } from '../middleware/index.js'
import {
  getUserSessions,
  revokeSession,
  revokeAllUserSessions,
  refreshSession,
  createSession
} from '../utils/sessions.js'
import { logger } from '../utils/logger.js'
import { getSupabaseAdmin } from '../db/supabase.js'

const router = express.Router()

/**
 * GET /api/sessions
 * Get all active sessions for the current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sessions = await getUserSessions(req.user.id)
    
    // Remove sensitive information before sending
    const sanitizedSessions = sessions.map(session => ({
      id: session.id,
      device_name: session.device_name,
      ip_address: session.ip_address,
      last_activity: session.last_activity,
      created_at: session.created_at,
      expires_at: session.expires_at,
      is_current: session.id === req.session?.id
    }))
    
    res.json({
      sessions: sanitizedSessions,
      count: sanitizedSessions.length
    })
  } catch (error) {
    logger.error('Error fetching user sessions', error)
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

/**
 * POST /api/sessions/refresh
 * Refresh a session token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' })
    }
    
    const session = await refreshSession(refreshToken, req)
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }
    
    res.json({
      token: session.token,
      expiresAt: session.expires_at,
      message: 'Session refreshed successfully'
    })
  } catch (error) {
    logger.error('Error refreshing session', error)
    res.status(500).json({ error: 'Failed to refresh session' })
  }
})

/**
 * DELETE /api/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params
    
    // Verify the session belongs to the user
    const sessions = await getUserSessions(req.user.id)
    const session = sessions.find(s => s.id === sessionId)
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    
    const success = await revokeSession(sessionId, 'user_revoked')
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to revoke session' })
    }
    
    res.json({ message: 'Session revoked successfully' })
  } catch (error) {
    logger.error('Error revoking session', error)
    res.status(500).json({ error: 'Failed to revoke session' })
  }
})

/**
 * DELETE /api/sessions
 * Revoke all sessions for the current user (except current session)
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const currentSessionId = req.session?.id
    
    // Get all sessions
    const sessions = await getUserSessions(req.user.id)
    
    // Revoke all except current
    const revokedCount = await Promise.all(
      sessions
        .filter(s => s.id !== currentSessionId)
        .map(s => revokeSession(s.id, 'user_revoked_all'))
    )
    
    res.json({
      message: 'All other sessions revoked successfully',
      revokedCount: revokedCount.filter(Boolean).length
    })
  } catch (error) {
    logger.error('Error revoking all sessions', error)
    res.status(500).json({ error: 'Failed to revoke sessions' })
  }
})

/**
 * POST /api/sessions/logout
 * Logout from current session
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.session?.id
    
    if (sessionId) {
      await revokeSession(sessionId, 'logout')
    }
    
    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    logger.error('Error during logout', error)
    res.status(500).json({ error: 'Failed to logout' })
  }
})

/**
 * GET /api/sessions/current
 * Get current session information
 */
router.get('/current', authenticateToken, async (req, res) => {
  try {
    if (!req.session) {
      return res.status(404).json({ error: 'No active session' })
    }
    
    const session = {
      id: req.session.id,
      device_name: req.session.device_name,
      ip_address: req.session.ip_address,
      last_activity: req.session.last_activity,
      created_at: req.session.created_at,
      expires_at: req.session.expires_at
    }
    
    res.json({ session })
  } catch (error) {
    logger.error('Error fetching current session', error)
    res.status(500).json({ error: 'Failed to fetch session' })
  }
})

export default router
