import { getSupabaseAdmin } from '../db/supabase.js'
import { generateId } from './index.js'
import { logger } from './logger.js'

/**
 * Get max login attempts from settings
 */
async function getMaxLoginAttempts() {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'maxLoginAttempts')
      .single()
    
    if (data && data.value) {
      return parseInt(data.value, 10) || 5
    }
    return 5 // Default
  } catch (error) {
    logger.error('Error getting max login attempts', error)
    return 5 // Default
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown'
}

/**
 * Get user agent from request
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown'
}

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(email, userId, success, req, failureReason = null) {
  try {
    const supabase = getSupabaseAdmin()
    const ipAddress = getClientIp(req)
    const userAgent = getUserAgent(req)
    
    const { error } = await supabase
      .from('login_attempts')
      .insert({
        id: generateId(),
        user_id: userId || null,
        email: email.toLowerCase().trim(),
        ip_address: ipAddress,
        success,
        user_agent: userAgent,
        failure_reason: failureReason || null
      })
    
    if (error) {
      logger.error('Error recording login attempt', error)
    }
  } catch (error) {
    logger.error('Error recording login attempt', error)
  }
}

/**
 * Get failed login attempts count for an email within time window
 */
export async function getFailedAttemptsCount(email, minutes = 15) {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase.rpc('get_failed_login_attempts', {
      p_email: email.toLowerCase().trim(),
      p_minutes: minutes
    })
    
    if (error) {
      logger.error('Error getting failed attempts count', error)
      return 0
    }
    
    return data || 0
  } catch (error) {
    logger.error('Error getting failed attempts count', error)
    return 0
  }
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(userId) {
  try {
    if (!userId) return false
    
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase.rpc('is_account_locked', {
      p_user_id: userId
    })
    
    if (error) {
      logger.error('Error checking account lock status', error)
      return false
    }
    
    return data === true
  } catch (error) {
    logger.error('Error checking account lock status', error)
    return false
  }
}

/**
 * Lock an account
 */
export async function lockAccount(userId, lockDurationMinutes = 30) {
  try {
    if (!userId) return false
    
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase.rpc('lock_account', {
      p_user_id: userId,
      p_lock_duration_minutes: lockDurationMinutes
    })
    
    if (error) {
      logger.error('Error locking account', error)
      return false
    }
    
    return true
  } catch (error) {
    logger.error('Error locking account', error)
    return false
  }
}

/**
 * Unlock an account
 */
export async function unlockAccount(userId) {
  try {
    if (!userId) return false
    
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase.rpc('unlock_account', {
      p_user_id: userId
    })
    
    if (error) {
      logger.error('Error unlocking account', error)
      return false
    }
    
    return true
  } catch (error) {
    logger.error('Error unlocking account', error)
    return false
  }
}

/**
 * Get remaining login attempts before lockout
 */
export async function getRemainingAttempts(email) {
  try {
    const maxAttempts = await getMaxLoginAttempts()
    const failedAttempts = await getFailedAttemptsCount(email, 15) // 15 minute window
    const remaining = Math.max(0, maxAttempts - failedAttempts)
    
    return {
      remaining,
      failed: failedAttempts,
      max: maxAttempts
    }
  } catch (error) {
    logger.error('Error getting remaining attempts', error)
    return {
      remaining: 5, // Default fallback
      failed: 0,
      max: 5
    }
  }
}

/**
 * Get account lock status with remaining time
 */
export async function getAccountLockStatus(userId) {
  try {
    if (!userId) {
      return { locked: false, lockedUntil: null }
    }
    
    const supabase = getSupabaseAdmin()
    
    const { data: user, error } = await supabase
      .from('users')
      .select('locked_until')
      .eq('id', userId)
      .single()
    
    if (error || !user) {
      return { locked: false, lockedUntil: null }
    }
    
    if (!user.locked_until) {
      return { locked: false, lockedUntil: null }
    }
    
    const lockedUntil = new Date(user.locked_until)
    const now = new Date()
    
    if (lockedUntil > now) {
      const minutesRemaining = Math.ceil((lockedUntil - now) / (1000 * 60))
      return {
        locked: true,
        lockedUntil: lockedUntil.toISOString(),
        minutesRemaining
      }
    } else {
      // Lock expired, clear it
      await unlockAccount(userId)
      return { locked: false, lockedUntil: null }
    }
  } catch (error) {
    logger.error('Error getting account lock status', error)
    return { locked: false, lockedUntil: null }
  }
}

