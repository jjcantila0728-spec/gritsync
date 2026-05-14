import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { ShieldCheck, Save, RotateCcw, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from './useSettings'
import {
  PERMISSION_CATALOG,
  MANAGED_ROLES,
  ALL_ROLES,
  ROLE_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
  type RolePermissions as RolePermissionsType,
} from '@/lib/permissions'

const ROLE_COL_STYLES: Record<string, string> = {
  client: 'text-gray-700 dark:text-gray-300',
  affiliate: 'text-amber-700 dark:text-amber-300',
  advisor: 'text-violet-700 dark:text-violet-300',
  admin: 'text-primary-700 dark:text-primary-300',
}

function matricesEqual(a: RolePermissionsType, b: RolePermissionsType): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function RolePermissions() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [matrix, setMatrix] = useState<RolePermissionsType>(() => normalizeRolePermissions(null))
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const { settings, loading, saveSettings } = useSettings(
    { rolePermissions: '' },
    (data) => ({ rolePermissions: data.rolePermissions || '' })
  )

  // Hydrate the editable matrix from the stored setting once it loads.
  useEffect(() => {
    if (loading) return
    try {
      const parsed = settings.rolePermissions ? JSON.parse(settings.rolePermissions) : null
      setMatrix(normalizeRolePermissions(parsed))
    } catch {
      setMatrix(normalizeRolePermissions(null))
    }
  }, [loading, settings.rolePermissions])

  const savedMatrix = useMemo<RolePermissionsType>(() => {
    try {
      return normalizeRolePermissions(settings.rolePermissions ? JSON.parse(settings.rolePermissions) : null)
    } catch {
      return normalizeRolePermissions(null)
    }
  }, [settings.rolePermissions])

  const dirty = !matricesEqual(matrix, savedMatrix)

  const toggle = (role: string, permId: string) => {
    if (role === 'admin') return // admin is always a superuser
    setMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role as keyof RolePermissionsType], [permId]: !prev[role as keyof RolePermissionsType][permId] },
    }))
  }

  const setCategoryForRole = (role: string, categoryId: string, value: boolean) => {
    if (role === 'admin') return
    const cat = PERMISSION_CATALOG.find(c => c.id === categoryId)
    if (!cat) return
    setMatrix(prev => {
      const next = { ...prev[role as keyof RolePermissionsType] }
      for (const p of cat.permissions) next[p.id] = value
      return { ...prev, [role]: next }
    })
  }

  const resetToDefaults = () => {
    if (!confirm('Reset all role permissions to the recommended defaults? Unsaved changes will be lost.')) return
    setMatrix(normalizeRolePermissions(DEFAULT_ROLE_PERMISSIONS))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Persist the managed roles only; admin is implicit.
      const toStore: Record<string, Record<string, boolean>> = {}
      for (const role of MANAGED_ROLES) toStore[role] = matrix[role]
      await saveSettings({ rolePermissions: JSON.stringify(toStore) })
      // Let the live app (sidebar, route guards) pick up the new matrix immediately.
      window.dispatchEvent(new Event('permissionsUpdated'))
      showToast('Role permissions saved', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to save permissions', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-5">
        <Loading text="Loading permissions..." />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Role Permissions</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 sm:p-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4">
        Define what each role can do. <strong>Admins</strong> always have full access and cannot be restricted here.
        Toggle a whole category for a role using the header checkbox, or individual permissions in the rows below.
      </div>

      <div className="overflow-x-auto -mx-3 sm:-mx-4 md:mx-0">
        <div className="min-w-[640px] px-3 sm:px-4 md:px-0">
          {/* Column header */}
          <div className="flex items-stretch border-b-2 border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <div className="flex-1 min-w-[260px] py-2.5 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Permission
            </div>
            {ALL_ROLES.map(role => (
              <div key={role} className={cn('w-24 sm:w-28 flex-shrink-0 py-2.5 px-2 text-center text-xs font-semibold uppercase tracking-wide', ROLE_COL_STYLES[role])}>
                {ROLE_LABELS[role]}
                {role === 'admin' && <span className="block text-[10px] font-normal normal-case text-gray-400 dark:text-gray-500">full access</span>}
              </div>
            ))}
          </div>

          {PERMISSION_CATALOG.map(category => {
            const isCollapsed = collapsed[category.id]
            return (
              <div key={category.id} className="border-b border-gray-200 dark:border-gray-700">
                {/* Category row */}
                <div className="flex items-stretch bg-gray-50 dark:bg-gray-800/60">
                  <button
                    type="button"
                    onClick={() => setCollapsed(c => ({ ...c, [category.id]: !c[category.id] }))}
                    className="flex-1 min-w-[260px] flex items-center gap-1.5 py-2.5 px-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{category.label}</span>
                    <span className="hidden md:inline text-xs text-gray-400 dark:text-gray-500 truncate ml-1">— {category.description}</span>
                  </button>
                  {ALL_ROLES.map(role => {
                    const ids = category.permissions.map(p => p.id)
                    const granted = ids.filter(id => matrix[role][id]).length
                    const all = granted === ids.length
                    const some = granted > 0 && !all
                    const isAdmin = role === 'admin'
                    return (
                      <div key={role} className="w-24 sm:w-28 flex-shrink-0 flex items-center justify-center py-2 px-2">
                        <button
                          type="button"
                          disabled={isAdmin}
                          onClick={() => setCategoryForRole(role, category.id, !all)}
                          title={isAdmin ? 'Admins always have full access' : all ? `Disable all ${category.label} permissions` : `Enable all ${category.label} permissions`}
                          className={cn(
                            'h-5 w-5 rounded border flex items-center justify-center transition-colors',
                            isAdmin
                              ? 'bg-primary-600 border-primary-600 text-white cursor-not-allowed opacity-60'
                              : all
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : some
                                  ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-400 text-primary-600 dark:text-primary-300'
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-primary-400'
                          )}
                        >
                          {(all || isAdmin) ? <Check className="h-3.5 w-3.5" /> : some ? <span className="h-0.5 w-2.5 bg-current rounded" /> : null}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Permission rows */}
                {!isCollapsed && category.permissions.map(perm => (
                  <div key={perm.id} className="flex items-stretch hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex-1 min-w-[260px] py-2 px-2 pl-7">
                      <div className="text-sm text-gray-800 dark:text-gray-200">{perm.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{perm.description}</div>
                    </div>
                    {ALL_ROLES.map(role => {
                      const isAdmin = role === 'admin'
                      const checked = isAdmin || !!matrix[role][perm.id]
                      return (
                        <div key={role} className="w-24 sm:w-28 flex-shrink-0 flex items-center justify-center py-2 px-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isAdmin}
                            onChange={() => toggle(role, perm.id)}
                            title={isAdmin ? 'Admins always have full access' : undefined}
                            className={cn(
                              'h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 focus:ring-offset-0',
                              isAdmin && 'opacity-60 cursor-not-allowed'
                            )}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
