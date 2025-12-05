import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/index.js'
import { generateId, generateGritId } from '../utils/index.js'
import { validateEmail, validatePassword, validateRequired } from '../utils/validation.js'
import { logger } from '../utils/logger.js'
import { JWT_EXPIRY } from '../config/constants.js'
import {
  recordLoginAttempt,
  getFailedAttemptsCount,
  isAccountLocked,
  lockAccount,
  getRemainingAttempts,
  getAccountLockStatus
} from '../utils/loginAttempts.js'
import { createSession, getUserSessions, revokeSession } from '../utils/sessions.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role = 'client' } = req.body

    // Validation
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' })
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const supabase = getSupabaseAdmin()

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    const id = generateId()
    const gritId = await generateGritId()
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    // Insert user - Note: Supabase schema may need password column added
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id,
        email,
        password: hashedPassword,
        role,
        grit_id: gritId,
        first_name: firstName.trim(),
        last_name: lastName.trim()
      })
      .select()
      .single()

    if (insertError) {
      logger.error('User insert error', insertError)
      return res.status(500).json({ success: false, error: 'Registration failed' })
    }

    // Generate token
    const token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY })

    res.json({
      user: { id, email, role, grit_id: gritId, full_name: fullName },
      token
    })
  } catch (error) {
    logger.error('Registration error', error)
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const supabase = getSupabaseAdmin()
    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single()

    // Check if account is locked (before checking credentials)
    if (user) {
      const lockStatus = await getAccountLockStatus(user.id)
      if (lockStatus.locked) {
        await recordLoginAttempt(normalizedEmail, user.id, false, req, 'account_locked')
        return res.status(423).json({ 
          error: 'Account is temporarily locked due to too many failed login attempts',
          lockedUntil: lockStatus.lockedUntil,
          minutesRemaining: lockStatus.minutesRemaining
        })
      }
    }

    // Check if user exists
    if (fetchError || !user) {
      // Record failed attempt (even if user doesn't exist, for security)
      await recordLoginAttempt(normalizedEmail, null, false, req, 'user_not_found')
      
      // Get remaining attempts for this email
      const attempts = await getRemainingAttempts(normalizedEmail)
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        remainingAttempts: attempts.remaining,
        maxAttempts: attempts.max
      })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password)
    
    if (!valid) {
      // Record failed attempt
      await recordLoginAttempt(normalizedEmail, user.id, false, req, 'invalid_password')
      
      // Get remaining attempts
      const attempts = await getRemainingAttempts(normalizedEmail)
      
      // Check if we should lock the account
      if (attempts.remaining <= 0) {
        await lockAccount(user.id, 30) // Lock for 30 minutes
        const lockStatus = await getAccountLockStatus(user.id)
        
        return res.status(423).json({
          error: 'Account has been locked due to too many failed login attempts. Please try again later.',
          lockedUntil: lockStatus.lockedUntil,
          minutesRemaining: lockStatus.minutesRemaining
        })
      }
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        remainingAttempts: attempts.remaining,
        maxAttempts: attempts.max
      })
    }

    // Successful login - record success and clear any lock
    await recordLoginAttempt(normalizedEmail, user.id, true, req)
    if (user.locked_until) {
      const { unlockAccount } = await import('../utils/loginAttempts.js')
      await unlockAccount(user.id)
    }

    // Generate token
    const fullName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`.trim()
      : user.full_name || null

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY })

    // Create server-side session
    let session = null
    try {
      session = await createSession(user.id, token, req, { generateRefreshToken: true })
    } catch (sessionError) {
      logger.warn('Failed to create session, continuing with token only', sessionError)
      // Continue without session if creation fails (backward compatibility)
    }

    res.json({
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        full_name: fullName, 
        grit_id: user.grit_id 
      },
      token,
      refreshToken: session?.refresh_token || null,
      sessionId: session?.id || null
    })
  } catch (error) {
    logger.error('Login error', error)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, grit_id')
      .eq('id', req.user.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const fullName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`.trim()
      : null

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: fullName,
      grit_id: user.grit_id
    })
  } catch (error) {
    logger.error('Error fetching user', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }

    const supabase = getSupabaseAdmin()

    // Get user with password
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single()

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', req.user.id)

    if (updateError) {
      logger.error('Error updating password', updateError)
      return res.status(500).json({ success: false, error: 'Failed to change password' })
    }

    // Revoke all other sessions for security (password change should invalidate old sessions)
    try {
      const { revokeAllUserSessions } = await import('../utils/sessions.js')
      const currentSessionId = req.session?.id
      
      // Revoke all sessions except current
      const sessions = await getUserSessions(req.user.id)
      await Promise.all(
        sessions
          .filter(s => s.id !== currentSessionId)
          .map(s => revokeSession(s.id, 'password_change'))
      )
      
      logger.info('Sessions revoked after password change', { userId: req.user.id })
    } catch (sessionError) {
      logger.warn('Failed to revoke sessions after password change', sessionError)
      // Don't fail the password change if session revocation fails
    }

    res.json({ message: 'Password changed successfully. All other sessions have been revoked for security.' })
  } catch (error) {
    logger.error('Error changing password', error)
    res.status(500).json({ success: false, error: 'Failed to change password' })
  }
})

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const supabase = getSupabaseAdmin()

    // Find user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (fetchError || !user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account exists with this email, password reset instructions have been sent.' })
    }

    // Generate reset token
    const resetToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' })
    const tokenId = generateId()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now

    // Store reset token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        id: tokenId,
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt,
        used: false
      })

    if (insertError) {
      logger.error('Error storing reset token', insertError)
      return res.status(500).json({ success: false, error: 'Failed to process password reset request' })
    }

    // In a real application, send email here
    // For MVP, we'll just return success
    // Note: Email sending service should be implemented for production
    logger.info(`Password reset token generated for ${email}`)
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Reset link: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`)
    }

    res.json({ 
      message: 'If an account exists with this email, password reset instructions have been sent.',
      // In development, include token for testing
      ...(process.env.NODE_ENV === 'development' && { token: resetToken })
    })
  } catch (error) {
    logger.error('Error requesting password reset', error)
    res.status(500).json({ success: false, error: 'Failed to process password reset request' })
  }
})

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }

    const supabase = getSupabaseAdmin()

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    // Check if token exists in database and is not used
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (tokenError || !resetToken) {
      return res.status(400).json({ error: 'Invalid or already used reset token' })
    }

    // Check if token is expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' })
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id)

    if (updateError) {
      logger.error('Error updating password', updateError)
      return res.status(500).json({ success: false, error: 'Failed to reset password' })
    }

    // Revoke all sessions for security (password reset should invalidate all sessions)
    try {
      const { revokeAllUserSessions } = await import('../utils/sessions.js')
      await revokeAllUserSessions(user.id, 'password_reset')
      logger.info('All sessions revoked after password reset', { userId: user.id })
    } catch (sessionError) {
      logger.warn('Failed to revoke sessions after password reset', sessionError)
      // Don't fail the password reset if session revocation fails
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id)

    res.json({ message: 'Password reset successfully. All sessions have been revoked for security.' })
  } catch (error) {
    logger.error('Error resetting password', error)
    res.status(500).json({ success: false, error: 'Failed to reset password' })
  }
})

export default router

