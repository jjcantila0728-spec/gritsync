import { useAuth as useAuthGritsync } from '../contexts/AuthContext'

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

export function useAuth(): NclexAuthShape {
  const { user, loading } = useAuthGritsync()
  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
        }
      : null,
    isAuthenticated: !!user,
    isLoading: loading,
  }
}
