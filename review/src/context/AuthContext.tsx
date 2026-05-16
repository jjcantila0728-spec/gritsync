import { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gritsync.com/api'

export interface NclexAuthUser {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
}

interface NclexAuthShape {
  user: NclexAuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface RawUser {
  id?: string
  email?: string
  role?: string
  first_name?: string
  last_name?: string
}

function readUser(): RawUser | null {
  try {
    const raw = localStorage.getItem('gritsync_user')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function useAuth(): NclexAuthShape {
  const [user, setUser] = useState<RawUser | null>(() => readUser())
  const [isLoading, setIsLoading] = useState<boolean>(() => !readUser())

  useEffect(() => {
    const token = localStorage.getItem('gritsync_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    if (user) {
      setIsLoading(false)
      return
    }
    axios
      .get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const fetched = res.data?.user ?? res.data
        if (fetched) {
          localStorage.setItem('gritsync_user', JSON.stringify(fetched))
          setUser(fetched)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [user])

  return {
    user: user
      ? {
          id: user.id ?? '',
          email: user.email ?? '',
          role: user.role ?? 'client',
          firstName: user.first_name,
          lastName: user.last_name,
        }
      : null,
    isAuthenticated: !!user,
    isLoading,
  }
}
