import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authAPI, apiClient, User, SignUpData } from '@/lib/api-client'

type UserRole = 'client' | 'admin'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signUp: (data: SignUpData) => Promise<void>
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

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      apiClient.setToken(token)
      loadUserProfile()
    } else {
      setLoading(false)
    }
  }, [])

  async function loadUserProfile() {
    try {
      const currentUser = await authAPI.getCurrentUser()
      setUser(currentUser)
    } catch (error: any) {
      console.error('Error loading user profile:', error?.message)
      localStorage.removeItem('auth_token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(identifier: string, password: string) {
    const response = await authAPI.signIn(identifier, password)
    setUser(response.user)
  }

  async function signUp(data: SignUpData) {
    const response = await authAPI.signUp(data)
    setUser(response.user)
  }

  async function signOut() {
    try {
      await authAPI.signOut()
    } catch {
    }
    apiClient.setToken(null)
    setUser(null)
  }

  async function refreshUser() {
    if (apiClient.getToken()) {
      await loadUserProfile()
    }
  }

  async function requestPasswordReset(email: string) {
    await authAPI.requestPasswordReset(email)
  }

  async function resetPassword(_token: string, newPassword: string) {
    await authAPI.changePassword('', newPassword)
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await authAPI.changePassword(currentPassword, newPassword)
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
