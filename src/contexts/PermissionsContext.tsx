import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  getRolePermissions,
  normalizeRolePermissions,
  type RolePermissions,
  type AppRole,
} from '@/lib/permissions'

interface PermissionsContextType {
  /** Effective permission matrix (defaults merged with admin overrides). */
  matrix: RolePermissions
  /** True until the stored overrides have been fetched at least once. */
  loading: boolean
  /** Re-fetch the matrix (call after the Permissions settings page saves). */
  reload: () => void
  /** Whether the *current* user holds the given permission. */
  can: (permissionId: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // Seed with the built-in defaults so route guards / the sidebar have something
  // sensible to evaluate against before the stored overrides arrive.
  const [matrix, setMatrix] = useState<RolePermissions>(() => normalizeRolePermissions(null))
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    getRolePermissions()
      .then((m) => setMatrix(m))
      .catch(() => setMatrix(normalizeRolePermissions(null)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  // The Permissions settings page dispatches this after saving.
  useEffect(() => {
    const handler = () => reload()
    window.addEventListener('permissionsUpdated', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('permissionsUpdated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [reload])

  const role = (user?.role || 'client') as AppRole
  const can = useCallback(
    (permissionId: string) => (role === 'admin' ? true : !!matrix[role]?.[permissionId]),
    [matrix, role]
  )

  return (
    <PermissionsContext.Provider value={{ matrix, loading, reload, can }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used within a PermissionsProvider')
  return ctx
}
