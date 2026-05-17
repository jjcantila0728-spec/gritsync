import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, errorMessage, setUnauthorizedHandler } from '@/lib/api'
import { storage, StorageKeys } from '@/lib/storage'
import { biometric } from '@/lib/biometric'
import { User } from '@/lib/types'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadFromStorage = useCallback(async () => {
    try {
      const cached = await storage.get(StorageKeys.user)
      if (cached) setUser(JSON.parse(cached) as User)
    } catch {
      // ignore
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: User }>('/auth/me')
      setUser(res.data.user)
      await storage.set(StorageKeys.user, JSON.stringify(res.data.user))
    } catch {
      // /auth/me failed — interceptor will clear us if it's a 401
    }
  }, [])

  const signIn = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<{
      user: User
      session: { access_token: string; refresh_token: string }
    }>('/auth/login', { email: identifier, password })
    const { user: u, session } = res.data
    await storage.set(StorageKeys.accessToken, session.access_token)
    await storage.set(StorageKeys.refreshToken, session.refresh_token)
    await storage.set(StorageKeys.user, JSON.stringify(u))
    await storage.set(StorageKeys.lastIdentifier, identifier.trim())
    setUser(u)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // best-effort
    }
    await Promise.all([
      storage.remove(StorageKeys.accessToken),
      storage.remove(StorageKeys.refreshToken),
      storage.remove(StorageKeys.user),
      biometric.forget(),
    ])
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut()
    })
  }, [signOut])

  useEffect(() => {
    let mounted = true
    async function init() {
      await loadFromStorage()
      const token = await storage.get(StorageKeys.accessToken)
      if (token) await refresh()
      if (mounted) setLoading(false)
    }
    void init()
    return () => {
      mounted = false
    }
  }, [loadFromStorage, refresh])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export { errorMessage }
