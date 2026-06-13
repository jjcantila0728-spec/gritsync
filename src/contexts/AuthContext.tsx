import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { db } from '@/lib/api-client'
import { User, UserRole } from '@/lib/types'
import type { Session } from '@db/db-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (firstName: string, lastName: string, mobile: string, password: string, role?: UserRole, personalEmail?: string, referralCode?: string) => Promise<{ requiresVerification?: boolean; personal_email?: string } | null>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  isAdmin: () => boolean
  isClient: () => boolean
  isAffiliate: () => boolean
  isAdvisor: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  const loadUserProfile = useCallback(async () => {
    try {
      // SIMPLE: Just use auth metadata - no database queries, instant loading
      const { data: { user: authUser } } = await db.auth.getUser()

      if (authUser) {
        // Extract role from auth metadata
        const role = (authUser.user_metadata?.role || authUser.app_metadata?.role || 'client') as UserRole

        // Use auth metadata and direct fields from /auth/me response
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: role,
          first_name: (authUser as any).first_name || authUser.user_metadata?.first_name || undefined,
          middle_name: (authUser as any).middle_name || undefined,
          last_name: (authUser as any).last_name || authUser.user_metadata?.last_name || undefined,
          mobile: (authUser as any).mobile || undefined,
          grit_id: (authUser as any).grit_id || authUser.user_metadata?.grit_id || undefined,
          must_change_password: (authUser as any).must_change_password === true,
          created_at: authUser.created_at,
        })

        // Tag subsequent Sentry events with the current user so error reports
        // can be traced back to a specific account. Dynamic import keeps the
        // SDK out of the critical path when no DSN is configured.
        import('@/lib/sentry').then(({ setSentryUser }) => {
          setSentryUser({ id: authUser.id, email: authUser.email || undefined, role })
        }).catch(() => { /* ignore */ })
      } else {
        setUser(null)
        import('@/lib/sentry').then(({ setSentryUser }) => setSentryUser(null)).catch(() => { /* ignore */ })
      }
    } catch (error: any) {
      console.error('Error loading user profile:', error?.message)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Keep a ref to the latest loadUserProfile so the empty-dep subscription
  // effect below never calls a stale closure.
  const loadUserProfileRef = useRef(loadUserProfile)
  useEffect(() => {
    loadUserProfileRef.current = loadUserProfile
  })

  useEffect(() => {
    // SIMPLE: Get session and load user immediately
    db.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) {
        loadUserProfileRef.current()
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadUserProfileRef.current()
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await db.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    // Don't wait for profile load - let onAuthStateChange handle it
    // This makes login faster and more resilient to RLS issues
    // The profile will load automatically via the auth state change listener
  }, [])

  const signUp = useCallback(async (firstName: string, lastName: string, mobile: string, password: string, role: UserRole = 'client', personalEmail?: string, referralCode?: string) => {
    const { data, error } = await db.auth.signUp({
      email: '',
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          mobile,
          role,
          personal_email: personalEmail,
          referralCode: referralCode || undefined,
        },
      },
    })

    if (error) {
      // Preserve the "account already exists" signal so the registration page
      // can redirect a returning client to login instead of showing an error.
      const e = new Error(error.message) as Error & { accountExists?: boolean; email?: string }
      e.accountExists = (error as any).accountExists
      e.email = (error as any).email
      throw e
    }

    // If registration requires email verification, return that info
    if ((data as any)?.requiresVerification) {
      return { requiresVerification: true, personal_email: (data as any).personal_email }
    }

    // Return the generated GRIT ID and email so the registration page can display them
    return data?.session?.user?.user_metadata || (data as any)?.user?.user_metadata || null
  }, [])

  const signOut = useCallback(async () => {
    // Clear all client-side caches before signing out so the next user
    // doesn't see stale data from the previous session.
    try {
      const { clearAuthCache } = await import('@/lib/api-service')
      clearAuthCache()
    } catch {
      // Ignore if import fails
    }
    try {
      const { clearAllCache } = await import('@/lib/cache')
      clearAllCache()
    } catch {
      // Ignore if import fails
    }

    const { error } = await db.auth.signOut()
    if (error) {
      throw new Error((error as { message?: string }).message ?? 'Sign out failed')
    }
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (session?.user) {
      await loadUserProfile()
    }
  }, [session, loadUserProfile])

  const requestPasswordReset = useCallback(async (email: string) => {
    const res = await fetch('/api/auth/reset-password-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send reset email')
    }
  }, [])

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password')
    }
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    // Verify current password by attempting to sign in
    if (!session?.user?.email) {
      throw new Error('No user session found')
    }

    // Verify current password
    const { error: verifyError } = await db.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })

    if (verifyError) {
      throw new Error('Current password is incorrect')
    }

    // Update password
    const { error } = await db.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }
  }, [session])

  const isAdmin = useCallback(() => {
    return user?.role === 'admin'
  }, [user?.role])

  const isClient = useCallback(() => {
    return user?.role === 'client'
  }, [user?.role])

  const isAffiliate = useCallback(() => {
    return user?.role === 'affiliate'
  }, [user?.role])

  const isAdvisor = useCallback(() => {
    return user?.role === 'advisor'
  }, [user?.role])

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
    requestPasswordReset,
    resetPassword,
    changePassword,
    isAdmin,
    isClient,
    isAffiliate,
    isAdvisor,
  }), [
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
    requestPasswordReset,
    resetPassword,
    changePassword,
    isAdmin,
    isClient,
    isAffiliate,
    isAdvisor,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
