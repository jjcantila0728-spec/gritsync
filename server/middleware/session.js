// Session Middleware
import { getSessionByToken, updateSessionActivity, validateSessionSecurity } from '../utils/sessions.js'
import { logger } from '../utils/logger.js'

/**
 * Middleware to validate session and update activity
 * This should be used after authenticateToken middleware
 */
export async function validateSession(req, res, next) {
  try {
    // Get token from request (should already be validated by authenticateToken)
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    
    if (!token) {
      return res.status(401).json({ error: 'Session token required' })
    }
    
    // Get session from database
    const session = await getSessionByToken(token)
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    
    // Validate session security (device fingerprint, IP, etc.)
    const securityCheck = await validateSessionSecurity(session, req)
    
    if (!securityCheck.valid) {
      // Revoke session if invalid
      const { revokeSession } = await import('../utils/sessions.js')
      await revokeSession(session.id, 'security_breach')
      
      return res.status(401).json({ 
        error: 'Session security validation failed',
        reason: securityCheck.reason
      })
    }
    
    // Log suspicious activity but allow request
    if (securityCheck.suspicious) {
      logger.warn('Suspicious session activity detected', {
        sessionId: session.id,
        userId: session.user_id,
        reason: securityCheck.reason
      })
    }
    
    // Update session activity (non-blocking)
    updateSessionActivity(session.id).catch(err => {
      logger.error('Failed to update session activity', err)
    })
    
    // Attach session to request
    req.session = session
    
    next()
  } catch (error) {
    logger.error('Session validation error', error)
    res.status(500).json({ error: 'Session validation failed' })
  }
}

/**
 * Middleware to require active session
 * Combines authentication and session validation
 */
export async function requireSession(req, res, next) {
  // First check authentication (token exists and is valid)
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  // Then validate session
  return validateSession(req, res, next)
}
