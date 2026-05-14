/**
 * Session management utilities for Supabase
 * Ensures tokens are refreshed and sessions are valid before critical operations
 */

import { db } from './api-client'
import type { Session } from '@db/db-js'

/**
 * Check if session is valid and refresh if needed
 * Call this before critical operations to prevent auth errors
 * 
 * @returns Promise<Session | null> - Current session or null if not authenticated
 */
export async function ensureValidSession(): Promise<Session | null> {
  try {
    // Get current session
    const { data: { session }, error } = await db.auth.getSession()
    
    if (error) {
      console.error('Error getting session:', error)
      return null
    }
    
    // If no session, return null
    if (!session) {
      return null
    }
    
    // Check if session is expired (with 5 minute buffer)
    const sessionExpiresAt = (session as { expires_at?: number }).expires_at
    const expiresAt = sessionExpiresAt ? sessionExpiresAt * 1000 : 0 // Convert to milliseconds
    const now = Date.now()
    const bufferMs = 5 * 60 * 1000 // 5 minutes
    
    // If session expires within 5 minutes, refresh it
    if (expiresAt - now < bufferMs) {
      console.log('Session expiring soon, refreshing...')
      const { data: { session: refreshedSession }, error: refreshError } = await db.auth.refreshSession()
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError)
        // Return original session if refresh fails
        return session
      }
      
      return refreshedSession?.session || session
    }
    
    return session
  } catch (error) {
    console.error('Unexpected error in ensureValidSession:', error)
    return null
  }
}

/**
 * Ensure user is authenticated, throw error if not
 * Use this for operations that require authentication
 * 
 * @throws Error if not authenticated
 * @returns Promise<Session> - Valid session
 */
export async function requireAuth(): Promise<Session> {
  const session = await ensureValidSession()
  
  if (!session) {
    throw new Error('Authentication required. Please log in.')
  }
  
  return session
}

/**
 * Get current user ID with session validation
 * Caches the user ID to reduce auth.getUser calls
 * 
 * @returns Promise<string> - User ID
 * @throws Error if not authenticated
 */
let cachedUserId: string | null = null
let cachedUserIdTimestamp = 0
const USER_ID_CACHE_TTL = 60 * 1000 // 1 minute

export async function getAuthenticatedUserId(): Promise<string> {
  // Check cache first
  const now = Date.now()
  if (cachedUserId && now - cachedUserIdTimestamp < USER_ID_CACHE_TTL) {
    return cachedUserId
  }
  
  // Ensure valid session first
  const session = await requireAuth()
  
  if (!session.user?.id) {
    cachedUserId = null
    throw new Error('User ID not found in session')
  }
  
  // Cache the user ID
  cachedUserId = session.user.id
  cachedUserIdTimestamp = now
  
  return session.user.id
}

/**
 * Force refresh the session (useful after role changes)
 * Clears cached user ID to force a fresh fetch
 * 
 * @returns Promise<Session | null> - Refreshed session or null
 */
export async function forceRefreshSession(): Promise<Session | null> {
  // Clear cache
  cachedUserId = null
  cachedUserIdTimestamp = 0
  
  try {
    const { data: { session }, error } = await db.auth.refreshSession()
    
    if (error) {
      console.error('Error forcing session refresh:', error)
      return null
    }
  
    return session?.session || null
  } catch (error) {
    console.error('Unexpected error forcing session refresh:', error)
    return null
  }
}

/**
 * Check if current session is expired
 * 
 * @returns Promise<boolean> - True if session is expired or will expire soon
 */
export async function isSessionExpired(): Promise<boolean> {
  const { data: { session } } = await db.auth.getSession()
  
  if (!session) {
    return true
  }
  
  const sessionExpiresAt = (session as { expires_at?: number }).expires_at
  const expiresAt = sessionExpiresAt ? sessionExpiresAt * 1000 : 0
  const now = Date.now()
  const bufferMs = 1 * 60 * 1000 // 1 minute buffer
  
  return expiresAt - now < bufferMs
}






