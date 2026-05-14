/**
 * Role-based permission catalog + helpers.
 *
 * Permissions are stored in the `settings` table under the `rolePermissions`
 * key as a JSON object: { [role]: { [permissionId]: boolean } }.
 *
 * `admin` is always a superuser — it implicitly holds every permission and is
 * not editable from the Permissions settings page.
 */

import { getSetting } from './settings'

export type AppRole = 'client' | 'affiliate' | 'advisor' | 'admin'

export const MANAGED_ROLES: AppRole[] = ['client', 'affiliate', 'advisor']
export const ALL_ROLES: AppRole[] = ['client', 'affiliate', 'advisor', 'admin']

export const ROLE_LABELS: Record<AppRole, string> = {
  client: 'Client',
  affiliate: 'Affiliate',
  advisor: 'Advisor',
  admin: 'Admin',
}

export interface PermissionDef {
  id: string
  label: string
  description: string
}

export interface PermissionCategory {
  id: string
  label: string
  description: string
  permissions: PermissionDef[]
}

/** The full catalog of permissions, grouped by feature area. */
export const PERMISSION_CATALOG: PermissionCategory[] = [
  {
    id: 'applications',
    label: 'Applications',
    description: 'Visa / credentialing application records and their timelines.',
    permissions: [
      { id: 'applications.view', label: 'View applications', description: 'See application records the user has access to.' },
      { id: 'applications.view_all', label: 'View all applications', description: 'See every client’s applications, not just their own or assigned ones.' },
      { id: 'applications.create', label: 'Create applications', description: 'Start and submit new applications.' },
      { id: 'applications.edit', label: 'Edit applications', description: 'Update application details and uploaded information.' },
      { id: 'applications.manage_status', label: 'Manage status & timeline', description: 'Change application status and post timeline updates.' },
      { id: 'applications.delete', label: 'Delete applications', description: 'Permanently remove application records.' },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    description: 'Client, affiliate, advisor and admin accounts.',
    permissions: [
      { id: 'users.view', label: 'View users', description: 'Browse the user directory.' },
      { id: 'users.create', label: 'Create users', description: 'Add new user accounts.' },
      { id: 'users.edit', label: 'Edit users', description: 'Update profile and account details of other users.' },
      { id: 'users.deactivate', label: 'Deactivate / reactivate users', description: 'Disable or re-enable other accounts.' },
      { id: 'users.change_role', label: 'Change user roles', description: 'Promote or demote users between roles.' },
      { id: 'users.delete', label: 'Delete users', description: 'Permanently delete user accounts.' },
      { id: 'users.impersonate', label: 'Log in as user', description: 'Impersonate another user for support.' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Files uploaded against users and applications.',
    permissions: [
      { id: 'documents.view', label: 'View documents', description: 'Open and download stored documents.' },
      { id: 'documents.upload', label: 'Upload documents', description: 'Add new documents.' },
      { id: 'documents.delete', label: 'Delete documents', description: 'Remove stored documents.' },
    ],
  },
  {
    id: 'billing',
    label: 'Quotations & Payments',
    description: 'Quotes, invoices and payment records.',
    permissions: [
      { id: 'quotations.view', label: 'View quotations', description: 'See quotations available to the user.' },
      { id: 'quotations.create', label: 'Create quotations', description: 'Draft new quotations.' },
      { id: 'quotations.manage', label: 'Manage quotations', description: 'Edit, approve or void quotations.' },
      { id: 'payments.view', label: 'View payments', description: 'See payment history.' },
      { id: 'payments.record', label: 'Record payments', description: 'Mark payments as received / confirmed.' },
      { id: 'payments.refund', label: 'Issue refunds', description: 'Process refunds against payments.' },
    ],
  },
  {
    id: 'messaging',
    label: 'Messaging & Notifications',
    description: 'In-app messaging and notification campaigns.',
    permissions: [
      { id: 'messages.view', label: 'View messages', description: 'Read message threads.' },
      { id: 'messages.send', label: 'Send messages', description: 'Reply to and start message threads.' },
      { id: 'messages.create_group', label: 'Create group chats', description: 'Start a message to a hand-picked set of users at once.' },
      { id: 'messages.broadcast', label: 'Broadcast messages', description: 'Send an announcement to a whole audience (all clients, affiliates, advisors, or everyone).' },
      { id: 'notifications.manage', label: 'Manage notifications', description: 'Create and manage notification campaigns.' },
    ],
  },
  {
    id: 'emails',
    label: 'Email Mailbox',
    description: 'GritSync email accounts and templates.',
    permissions: [
      { id: 'emails.view', label: 'View mailbox', description: 'Access the email inbox and sent items.' },
      { id: 'emails.send', label: 'Send emails', description: 'Compose and send emails.' },
      { id: 'emails.templates', label: 'Manage templates', description: 'Create and edit email templates.' },
    ],
  },
  {
    id: 'referrals',
    label: 'Referrals & Affiliates',
    description: 'Referral links, commissions and partner reporting.',
    permissions: [
      { id: 'referrals.view_own', label: 'View own referrals', description: 'See the user’s own referral code and earnings.' },
      { id: 'referrals.view_all', label: 'View all referrals', description: 'See the full referral / commission ledger.' },
      { id: 'referrals.manage', label: 'Manage referral program', description: 'Adjust commissions and partner settings.' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    description: 'Dashboards, analytics and data exports.',
    permissions: [
      { id: 'reports.view', label: 'View analytics', description: 'Open analytics dashboards.' },
      { id: 'reports.export', label: 'Export data', description: 'Download CSV / report exports.' },
    ],
  },
  {
    id: 'content',
    label: 'Content & Programs',
    description: 'Public content, careers, sponsorships and the question bank.',
    permissions: [
      { id: 'content.manage_careers', label: 'Manage careers', description: 'Create and edit job postings and applications.' },
      { id: 'content.manage_sponsorships', label: 'Manage sponsorships & donations', description: 'Administer sponsorship and donation records.' },
      { id: 'content.manage_question_bank', label: 'Manage NCLEX question bank', description: 'Add and edit NCLEX practice questions.' },
    ],
  },
  {
    id: 'system',
    label: 'System & Settings',
    description: 'Admin settings, integrations and monitoring.',
    permissions: [
      { id: 'settings.view', label: 'View admin settings', description: 'Open the admin settings area.' },
      { id: 'settings.manage', label: 'Manage settings', description: 'Change system configuration.' },
      { id: 'settings.manage_permissions', label: 'Manage role permissions', description: 'Edit this permissions matrix.' },
      { id: 'system.view_monitoring', label: 'View monitoring', description: 'See system health and monitoring dashboards.' },
      { id: 'system.manage_integrations', label: 'Manage integrations', description: 'Configure third-party services and integrations.' },
    ],
  },
]

/** Flat list of every permission id. */
export const ALL_PERMISSION_IDS: string[] = PERMISSION_CATALOG.flatMap(c => c.permissions.map(p => p.id))

export function getPermissionDef(id: string): PermissionDef | undefined {
  for (const cat of PERMISSION_CATALOG) {
    const found = cat.permissions.find(p => p.id === id)
    if (found) return found
  }
  return undefined
}

export type RolePermissionMap = Record<string, boolean>
export type RolePermissions = Record<AppRole, RolePermissionMap>

function fromIds(ids: string[]): RolePermissionMap {
  const map: RolePermissionMap = {}
  for (const id of ALL_PERMISSION_IDS) map[id] = ids.includes(id)
  return map
}

function allTrue(): RolePermissionMap {
  const map: RolePermissionMap = {}
  for (const id of ALL_PERMISSION_IDS) map[id] = true
  return map
}

/** Sensible out-of-the-box permissions per role. Admin always has everything. */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: allTrue(),
  advisor: fromIds([
    'applications.view', 'applications.view_all', 'applications.create', 'applications.edit', 'applications.manage_status',
    'users.view',
    'documents.view', 'documents.upload',
    'quotations.view', 'quotations.create',
    'payments.view',
    'messages.view', 'messages.send',
    'emails.view', 'emails.send',
    'referrals.view_own',
    'reports.view', 'reports.export',
  ]),
  affiliate: fromIds([
    'messages.view', 'messages.send',
    'referrals.view_own',
  ]),
  client: fromIds([
    'applications.view', 'applications.create', 'applications.edit',
    'documents.view', 'documents.upload', 'documents.delete',
    'quotations.view',
    'payments.view',
    'messages.view', 'messages.send',
    'emails.view', 'emails.send',
    'referrals.view_own',
  ]),
}

/**
 * Merge stored overrides on top of the defaults so newly-added permissions
 * always get a defined value.
 */
export function normalizeRolePermissions(stored: Partial<Record<string, Partial<RolePermissionMap>>> | null | undefined): RolePermissions {
  const result = {} as RolePermissions
  for (const role of ALL_ROLES) {
    if (role === 'admin') {
      result.admin = allTrue() // admin is always a superuser
      continue
    }
    const base = { ...DEFAULT_ROLE_PERMISSIONS[role] }
    const overrides = stored?.[role] || {}
    for (const id of ALL_PERMISSION_IDS) {
      if (typeof overrides[id] === 'boolean') base[id] = overrides[id] as boolean
    }
    result[role] = base
  }
  return result
}

const PERMISSIONS_SETTING_KEY = 'rolePermissions'

/** Read the effective permission matrix (defaults merged with stored overrides). */
export async function getRolePermissions(): Promise<RolePermissions> {
  try {
    const raw = await getSetting(PERMISSIONS_SETTING_KEY, '')
    if (!raw) return normalizeRolePermissions(null)
    return normalizeRolePermissions(JSON.parse(raw))
  } catch {
    return normalizeRolePermissions(null)
  }
}

/** Check whether a role currently holds a given permission. */
export async function roleHasPermission(role: AppRole | string | null | undefined, permissionId: string): Promise<boolean> {
  if (role === 'admin') return true
  if (!role) return false
  const matrix = await getRolePermissions()
  return !!matrix[role as AppRole]?.[permissionId]
}

export { PERMISSIONS_SETTING_KEY }

/**
 * Every authenticated panel lives under its own role-prefixed URL space.
 * Use this helper instead of hard-coding the prefix at call sites.
 */
export function rolePanelPrefix(role: AppRole | string | null | undefined): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'affiliate': return '/affiliate'
    case 'advisor': return '/advisor'
    default: return '/client'
  }
}

/** Build a role-prefixed URL: `roleUrl('client', 'dashboard')` → `/client/dashboard`. */
export function roleUrl(role: AppRole | string | null | undefined, subpath: string = ''): string {
  const prefix = rolePanelPrefix(role)
  if (!subpath) return prefix
  const tail = subpath.startsWith('/') ? subpath : '/' + subpath
  return prefix + tail
}

/** The landing route for a given role. */
export function homePathForRole(role: AppRole | string | null | undefined): string {
  return roleUrl(role, 'dashboard')
}

/**
 * Maps a router pathname to the permission a non-admin user needs to view it.
 * Prefixes are matched against the role-stripped pathname so each rule covers
 * `/client/foo`, `/affiliate/foo`, `/advisor/foo` and `/admin/foo` at once
 * (admins always pass; the unprefixed legacy form is also accepted).
 *
 * Longest prefix wins.
 */
const ROUTE_PERMISSION_PREFIXES: { prefix: string; permission: string }[] = [
  { prefix: '/applications', permission: 'applications.view' },
  { prefix: '/application/new', permission: 'applications.create' },
  { prefix: '/documents', permission: 'documents.view' },
  { prefix: '/emails', permission: 'emails.view' },
  { prefix: '/quotations', permission: 'quotations.view' },
  { prefix: '/messages', permission: 'messages.view' },
  { prefix: '/dashboard', permission: '' }, // dashboard is always allowed once authed
]

const PANEL_PREFIX_RE = /^\/(client|affiliate|advisor|admin)(?=\/|$)/

export function permissionForPath(pathname: string): string | null {
  // For partner panels, viewing the panel root requires the referrals permission.
  if (pathname === '/affiliate' || pathname.startsWith('/affiliate/')) {
    // Sub-routes like /affiliate/messages get their own permission below.
    if (pathname === '/affiliate' || pathname === '/affiliate/dashboard') return 'referrals.view_own'
  }
  if (pathname === '/advisor' || pathname.startsWith('/advisor/')) {
    if (pathname === '/advisor' || pathname === '/advisor/dashboard' || pathname.startsWith('/advisor/clients')) return 'referrals.view_own'
  }

  // Strip the panel prefix so the same rules cover all four panels at once.
  const stripped = pathname.replace(PANEL_PREFIX_RE, '') || '/'

  let best: { prefix: string; permission: string } | null = null
  for (const r of ROUTE_PERMISSION_PREFIXES) {
    if (stripped === r.prefix || stripped.startsWith(r.prefix + '/')) {
      if (!best || r.prefix.length > best.prefix.length) best = r
    }
  }
  return best && best.permission ? best.permission : null
}
