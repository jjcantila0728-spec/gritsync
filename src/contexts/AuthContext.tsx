import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
        loadUserProfile()
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
        loadUserProfile()
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserProfile() {
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
          created_at: authUser.created_at,
        })
      } else {
        setUser(null)
      }
    } catch (error: any) {
      console.error('Error loading user profile:', error?.message)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
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
  }

  async function signUp(firstName: string, lastName: string, mobile: string, password: string, role: UserRole = 'client', personalEmail?: string, referralCode?: string) {
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
      throw new Error(error.message)
    }

    // If registration requires email verification, return that info
    if ((data as any)?.requiresVerification) {
      return { requiresVerification: true, personal_email: (data as any).personal_email }
    }

    // Return the generated GRIT ID and email so the registration page can display them
    return data?.session?.user?.user_metadata || (data as any)?.user?.user_metadata || null
  }

  async function signOut() {
    // Clear auth cache before signing out
    try {
      const { clearAuthCache } = await import('@/lib/api-service')
      clearAuthCache()
    } catch {
      // Ignore if import fails
    }
    
    const { error } = await db.auth.signOut()
    if (error) {
      throw new Error((error as { message?: string }).message ?? 'Sign out failed')
    }
    setUser(null)
  }

  async function refreshUser() {
    if (session?.user) {
      await loadUserProfile()
    }
  }

  async function requestPasswordReset(email: string) {
    const res = await fetch('/api/auth/reset-password-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send reset email')
    }
  }

  async function resetPassword(token: string, newPassword: string) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password')
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
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
  }

  function isAdmin() {
    return user?.role === 'admin'
  }

  function isClient() {
    return user?.role === 'client'
  }

  function isAffiliate() {
    return user?.role === 'affiliate'
  }

  function isAdvisor() {
    return user?.role === 'advisor'
  }

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
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
