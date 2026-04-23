/**
 * React hook for Supabase session management
 * Provides session state and utilities for session validation
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import {
  ensureValidSession,
  requireAuth,
  getAuthenticatedUserId,
  forceRefreshSession,
  isSessionExpired,
} from '@/lib/session-utils'

export interface UseSessionOptions {
  /** Enable automatic session refresh (default: true) */
  autoRefresh?: boolean
  /** Interval for session checks in ms (default: 60000 = 1 minute) */
  checkInterval?: number
  /** Require valid session (default: false) */
  requireValid?: boolean
}

export interface SessionState {
  session: Session | null
  userId: string | null
  loading: boolean
  error: string | null
  isValid: boolean
  isExpired: boolean
}

/**
 * Hook for managing Supabase session state and validation
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { 
 *     session, 
 *     userId, 
 *     isValid,
 *     refreshSession 
 *   } = useSession({ autoRefresh: true })
 * 
 *   if (!isValid) {
 *     return <div>Please log in</div>
 *   }
 * 
 *   return <div>Welcome, {userId}</div>
 * }
 * ```
 */
export function useSession(options: UseSessionOptions = {}) {
  const {
    autoRefresh = true,
    checkInterval = 60000, // 1 minute
    requireValid = false,
  } = options

  const [state, setState] = useState<SessionState>({
    session: null,
    userId: null,
    loading: true,
    error: null,
    isValid: false,
    isExpired: false,
  })

  const checkSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const session = await ensureValidSession()
      const expired = await isSessionExpired()

      if (session) {
        const userId = session.user?.id || null
        setState({
          session,
          userId,
          loading: false,
          error: null,
          isValid: true,
          isExpired: expired,
        })
      } else {
        setState({
          session: null,
          userId: null,
          loading: false,
          error: requireValid ? 'No valid session' : null,
          isValid: false,
          isExpired: true,
        })
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to check session',
        isValid: false,
      }))
    }
  }, [requireValid])

  const refreshSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }))
      const session = await forceRefreshSession()
      
      if (session) {
        const userId = session.user?.id || null
        setState(prev => ({
          ...prev,
          session,
          userId,
          loading: false,
          isValid: true,
          error: null,
        }))
        return session
      } else {
        setState(prev => ({
          ...prev,
          session: null,
          userId: null,
          loading: false,
          isValid: false,
        }))
        return null
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to refresh session',
        isValid: false,
      }))
      return null
    }
  }, [])

  const ensureAuth = useCallback(async (): Promise<Session> => {
    return await requireAuth()
  }, [])

  const getUserId = useCallback(async (): Promise<string> => {
    return await getAuthenticatedUserId()
  }, [])

  // Initial session check
  useEffect(() => {
    checkSession()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const userId = session.user?.id || null
        setState(prev => ({
          ...prev,
          session,
          userId,
          isValid: true,
          isExpired: false,
        }))
      } else {
        setState(prev => ({
          ...prev,
          session: null,
          userId: null,
          isValid: false,
          isExpired: true,
        }))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [checkSession])

  // Auto-refresh session
  useEffect(() => {
    if (autoRefresh && state.session) {
      const interval = setInterval(() => {
        checkSession()
      }, checkInterval)

      return () => {
        clearInterval(interval)
      }
    }
  }, [autoRefresh, checkInterval, state.session, checkSession])

  return {
    // State
    session: state.session,
    userId: state.userId,
    loading: state.loading,
    error: state.error,
    isValid: state.isValid,
    isExpired: state.isExpired,

    // Actions
    checkSession,
    refreshSession,
    ensureAuth,
    getUserId,
  }
}






