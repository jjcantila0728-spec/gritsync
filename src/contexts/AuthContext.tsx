import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { User, UserRole } from '@/lib/types'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (firstName: string, lastName: string, email: string, password: string, role?: UserRole) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  isAdmin: () => boolean
  isClient: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // SIMPLE: Get session and load user immediately
    supabase.auth.getSession().then(({ data: { session }, error }) => {
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        // Extract role from auth metadata
        const role = (authUser.user_metadata?.role || authUser.app_metadata?.role || 'client') as UserRole
        
        // Use auth metadata only - fast and reliable
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: role,
          first_name: authUser.user_metadata?.first_name || undefined,
          last_name: authUser.user_metadata?.last_name || undefined,
          grit_id: authUser.user_metadata?.grit_id || undefined,
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
    const { error } = await supabase.auth.signInWithPassword({
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

  async function signUp(firstName: string, lastName: string, email: string, password: string, role: UserRole = 'client') {
    const normalizedEmail = email.toLowerCase().trim()

    // Simple registration - let Supabase Auth handle duplicate checking
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: role, // Store role in metadata for RLS checks
        },
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    })

    if (error) {
      // Handle Supabase auth errors with user-friendly messages
      if (error.message.includes('already registered') || 
          error.message.includes('already exists') ||
          error.message.includes('User already registered') ||
          error.message.includes('email address is already in use')) {
        throw new Error('This email address is already registered. Please use a different email or try logging in.')
      }
      throw new Error(error.message)
    }

    // Email verification is automatically sent by Supabase Auth
    // If you want to send a custom verification email, you can do it here:
    // if (data.user && !data.user.email_confirmed_at) {
    //   // Custom email verification can be sent here if needed
    // }

    // Don't wait for profile creation - the trigger will handle it
    // The auth state change listener will load the profile automatically
    // This makes registration faster and more resilient
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
    setUser(null)
  }

  async function refreshUser() {
    if (session?.user) {
      await loadUserProfile()
    }
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  async function resetPassword(_token: string, newPassword: string) {
    // Supabase handles password reset through email links
    // This function is kept for compatibility but may need adjustment
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    // Verify current password by attempting to sign in
    if (!session?.user?.email) {
      throw new Error('No user session found')
    }

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })

    if (verifyError) {
      throw new Error('Current password is incorrect')
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
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
