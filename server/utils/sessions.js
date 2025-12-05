// Session Management Utilities
import { getSupabaseAdmin } from '../db/supabase.js'
import { logger } from './logger.js'
import { generateId } from './index.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION_MINUTES || '480', 10) // 8 hours default
const REFRESH_TOKEN_DURATION = parseInt(process.env.REFRESH_TOKEN_DURATION_DAYS || '30', 10) // 30 days default

/**
 * Generate device fingerprint from request
 * @param {Object} req - Express request object
 * @returns {string} Device fingerprint
 */
export function generateDeviceFingerprint(req) {
  const userAgent = req.get('user-agent') || ''
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  const acceptLanguage = req.get('accept-language') || ''
  const acceptEncoding = req.get('accept-encoding') || ''
  
  // Create a simple fingerprint (in production, use a more sophisticated method)
  const fingerprint = `${ip}-${userAgent.substring(0, 50)}-${acceptLanguage.substring(0, 20)}`
  return Buffer.from(fingerprint).toString('base64').substring(0, 64)
}

/**
 * Get device name from user agent
 * @param {string} userAgent - User agent string
 * @returns {string} Device name
 */
export function getDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device'
  
  // Simple device detection
  if (userAgent.includes('Mobile')) {
    if (userAgent.includes('iPhone')) return 'iPhone'
    if (userAgent.includes('Android')) return 'Android Device'
    return 'Mobile Device'
  }
  
  if (userAgent.includes('Windows')) return 'Windows PC'
  if (userAgent.includes('Mac')) return 'Mac'
  if (userAgent.includes('Linux')) return 'Linux PC'
  
  return 'Desktop Browser'
}

/**
 * Create a new session for a user
 * @param {string} userId - User ID
 * @param {string} token - JWT token
 * @param {Object} req - Express request object
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Session object
 */
export async function createSession(userId, token, req, options = {}) {
  try {
    const supabase = getSupabaseAdmin()
    const sessionId = generateId()
    const deviceFingerprint = generateDeviceFingerprint(req)
    const deviceName = getDeviceName(req.get('user-agent'))
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown'
    const userAgent = req.get('user-agent') || ''
    
    // Calculate expiration
    const expiresAt = new Date(Date.now() + SESSION_DURATION * 60 * 1000)
    
    // Generate refresh token if needed
    const refreshToken = options.generateRefreshToken 
      ? jwt.sign({ userId, sessionId, type: 'refresh' }, JWT_SECRET, { 
          expiresIn: `${REFRESH_TOKEN_DURATION}d` 
        })
      : null
    
    const sessionData = {
      id: sessionId,
      user_id: userId,
      token,
      refresh_token: refreshToken,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_fingerprint: deviceFingerprint,
      device_name: deviceName,
      is_active: true,
      last_activity: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    }
    
    const { data: session, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()
    
    if (error) {
      logger.error('Error creating session', error)
      throw error
    }
    
    logger.info('Session created', { userId, sessionId, deviceName })
    return session
  } catch (error) {
    logger.error('Failed to create session', error)
    throw error
  }
}

/**
 * Validate and get session by token
 * @param {string} token - Session token
 * @returns {Promise<Object|null>} Session object or null
 */
export async function getSessionByToken(token) {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single()
    
    if (error || !session) {
      return null
    }
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('sessions')
        .update({ 
          is_active: false, 
          revoked_at: new Date().toISOString(),
          revoked_reason: 'expired'
        })
        .eq('id', session.id)
      
      return null
    }
    
    return session
  } catch (error) {
    logger.error('Error getting session by token', error)
    return null
  }
}

/**
 * Update session activity timestamp
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(sessionId) {
  try {
    const supabase = getSupabaseAdmin()
    
    await supabase
      .from('sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('is_active', true)
  } catch (error) {
    logger.error('Error updating session activity', error)
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Revoke a session
 * @param {string} sessionId - Session ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<boolean>} Success status
 */
export async function revokeSession(sessionId, reason = 'logout') {
  try {
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase
      .from('sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: reason
      })
      .eq('id', sessionId)
    
    if (error) {
      logger.error('Error revoking session', error)
      return false
    }
    
    logger.info('Session revoked', { sessionId, reason })
    return true
  } catch (error) {
    logger.error('Failed to revoke session', error)
    return false
  }
}

/**
 * Revoke all sessions for a user
 * @param {string} userId - User ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<number>} Number of sessions revoked
 */
export async function revokeAllUserSessions(userId, reason = 'security_action') {
  try {
    const supabase = getSupabaseAdmin()
    
    // Use the database function if available, otherwise manual update
    const { data, error } = await supabase.rpc('revoke_all_user_sessions', {
      p_user_id: userId,
      p_reason: reason
    })
    
    if (error) {
      // Fallback to manual update
      const { count } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: reason
        })
        .eq('user_id', userId)
        .eq('is_active', true)
        .select('id', { count: 'exact', head: true })
      
      logger.info('All user sessions revoked (manual)', { userId, count, reason })
      return count || 0
    }
    
    logger.info('All user sessions revoked', { userId, count: data, reason })
    return data || 0
  } catch (error) {
    logger.error('Failed to revoke all user sessions', error)
    return 0
  }
}

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of session objects
 */
export async function getUserSessions(userId) {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('last_activity', { ascending: false })
    
    if (error) {
      logger.error('Error getting user sessions', error)
      return []
    }
    
    return sessions || []
  } catch (error) {
    logger.error('Failed to get user sessions', error)
    return []
  }
}

/**
 * Refresh a session token
 * @param {string} refreshToken - Refresh token
 * @param {Object} req - Express request object
 * @returns {Promise<Object|null>} New session object or null
 */
export async function refreshSession(refreshToken, req) {
  try {
    // Verify refresh token
    let decoded
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET)
      if (decoded.type !== 'refresh') {
        return null
      }
    } catch (error) {
      return null
    }
    
    const supabase = getSupabaseAdmin()
    
    // Find session by refresh token
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('refresh_token', refreshToken)
      .eq('is_active', true)
      .single()
    
    if (error || !session) {
      return null
    }
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await revokeSession(session.id, 'expired')
      return null
    }
    
    // Generate new token
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', session.user_id)
      .single()
    
    if (!user) {
      return null
    }
    
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: `${SESSION_DURATION}m` }
    )
    
    // Update session with new token
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION * 60 * 1000)
    
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        last_activity: new Date().toISOString()
      })
      .eq('id', session.id)
      .select()
      .single()
    
    if (updateError) {
      logger.error('Error refreshing session', updateError)
      return null
    }
    
    return updatedSession
  } catch (error) {
    logger.error('Failed to refresh session', error)
    return null
  }
}

/**
 * Clean up expired sessions (should be called periodically)
 * @returns {Promise<number>} Number of sessions cleaned up
 */
export async function cleanupExpiredSessions() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Use database function if available
    const { data, error } = await supabase.rpc('cleanup_expired_sessions')
    
    if (error) {
      // Fallback to manual cleanup
      const { count } = await supabase
        .from('sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: 'expired'
        })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true)
        .select('id', { count: 'exact', head: true })
      
      return count || 0
    }
    
    return data || 0
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', error)
    return 0
  }
}

/**
 * Validate session and check for suspicious activity
 * @param {Object} session - Session object
 * @param {Object} req - Express request object
 * @returns {Promise<{valid: boolean, suspicious: boolean, reason?: string}>}
 */
export async function validateSessionSecurity(session, req) {
  const currentFingerprint = generateDeviceFingerprint(req)
  const currentIp = req.ip || req.connection.remoteAddress || 'unknown'
  
  // Check if device fingerprint matches
  if (session.device_fingerprint !== currentFingerprint) {
    logger.warn('Session device fingerprint mismatch', {
      sessionId: session.id,
      expected: session.device_fingerprint,
      received: currentFingerprint
    })
    
    // This could be suspicious, but might also be legitimate (e.g., VPN, network change)
    // In production, you might want to require re-authentication or send notification
    return {
      valid: true, // Still allow, but log it
      suspicious: true,
      reason: 'device_fingerprint_mismatch'
    }
  }
  
  // Check if IP address changed significantly (optional - can be too strict)
  // For now, we'll just log it but allow the request
  
  return {
    valid: true,
    suspicious: false
  }
}
