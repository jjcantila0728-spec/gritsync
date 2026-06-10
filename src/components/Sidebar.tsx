import { useEffect, useState, useRef, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { roleUrl, type AppRole, type RolePermissions } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { quotationsAPI, userDocumentsAPI, applicationsAPI, applicationPaymentsAPI } from '@/lib/api'
import { cachedRequest, invalidate } from '@/lib/cache'
import { reviewUrl } from '@/lib/routing'
import { useToast } from '@/components/ui/Toast'

const SHOW_NCLEX_REVIEW = true

/**
 * Cross-subdomain SSO hop: ask the backend for a 60-second SSO token, then
 * redirect to https://review.gritsync.com/sso?token=... where the token is
 * exchanged for a normal session. Falls back to opening review without SSO if
 * the issue call fails — the user will just see the login screen there.
 */
async function openReviewWithSso() {
  try {
    const accessToken = localStorage.getItem('gritsync_token')
    if (!accessToken) {
      window.location.href = reviewUrl('/')
      return
    }
    const res = await fetch('/api/auth/sso/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ target: 'review' }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.sso_token) {
      window.location.href = reviewUrl('/')
      return
    }
    window.location.href = reviewUrl(`/sso?token=${encodeURIComponent(body.sso_token)}`)
  } catch {
    window.location.href = reviewUrl('/')
  }
}
import {
  LayoutDashboard,
  DollarSign,
  ClipboardList,
  Users,
  Settings,
  FolderOpen,
  Award,
  Briefcase,
  Mail,
  BookOpen,
  MessageSquare,
  Link2,
  ArrowUpRight,
  Share2,
  AlertCircle,
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  /** Permission id the (non-admin) role must hold for this item to appear. */
  permission?: string
  /** Restrict the item to specific non-admin roles. */
  roles?: AppRole[]
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'All Applications', path: '/admin/applications', icon: ClipboardList },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Quotations', path: '/admin/quotations', icon: DollarSign },
  { label: 'Emails', path: '/admin/emails', icon: Mail },
  { label: 'Messages', path: '/admin/messages', icon: MessageSquare },
  { label: 'Social', path: '/admin/social', icon: Share2 },
  { label: 'NCLEX', path: '/admin/nclex', icon: BookOpen },
  { label: 'Sponsorships', path: '/admin/sponsorships', icon: Award },
  { label: 'Career Applications', path: '/admin/careers', icon: Briefcase },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
]

// Non-admin nav is built per-role so every link lives under the user's panel
// prefix (e.g. /client/messages, /affiliate/messages). The shared utility
// items (Applications / Documents / Emails / Messages) only show up when the
// role's permission matrix grants the underlying capability.
function buildNavItems(role: string | undefined, matrix: RolePermissions): NavItem[] {
  if (role === 'admin') return adminNavItems
  const r = (role || 'client') as AppRole

  const items: NavItem[] = []
  if (r === 'client') {
    items.push({ label: 'Dashboard', path: roleUrl(r, 'dashboard'), icon: LayoutDashboard })
  } else if (r === 'affiliate') {
    items.push({ label: 'Affiliate Panel', path: roleUrl(r, 'dashboard'), icon: Link2, permission: 'referrals.view_own' })
  } else if (r === 'advisor') {
    items.push({ label: 'Dashboard', path: roleUrl(r, 'dashboard'), icon: LayoutDashboard, permission: 'referrals.view_own' })
  }
  // Advisor-only client management list.
  if (r === 'advisor') {
    items.push({ label: 'Clients', path: roleUrl(r, 'clients'), icon: Users, permission: 'users.view' })
  }
  items.push(
    { label: 'Applications', path: roleUrl(r, 'applications'), icon: ClipboardList, permission: 'applications.view' },
  )
  // Advisors don't need a personal Documents tab — they work on their assigned
  // clients' documents inside the Advisor Panel, not their own.
  if (r !== 'advisor') {
    items.push({ label: 'Documents', path: roleUrl(r, 'documents'), icon: FolderOpen, permission: 'documents.view' })
  }
  items.push(
    { label: 'Emails', path: roleUrl(r, 'emails'), icon: Mail, permission: 'emails.view' },
    { label: 'Messages', path: roleUrl(r, 'messages'), icon: MessageSquare, permission: 'messages.view' },
  )

  return items.filter((it) => !it.permission || !!matrix[r]?.[it.permission])
}

export function Sidebar() {
  const { isAdmin, user } = useAuth()
  const { matrix: permissionMatrix } = usePermissions()
  const location = useLocation()
  const { showToast } = useToast()
  const navItems = useMemo(() => buildNavItems(user?.role, permissionMatrix), [user?.role, permissionMatrix])
  const [unopenedQuotesCount, setUnopenedQuotesCount] = useState(0)
  const [unreadEmailsCount, setUnreadEmailsCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const prevUnreadMessagesRef = useRef<number | null>(null)
  
  // Load cached applications payment status from localStorage
  const getCachedApplicationsPaymentStatus = () => {
    if (!user?.id) return false
    try {
      const cached = localStorage.getItem(`applicationsPaymentStatus_${user.id}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Check if cache is still valid (less than 2 minutes old)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 2 * 60 * 1000) {
          return parsed.hasPayment
        }
      }
    } catch {
      // Ignore errors
    }
    return false
  }
  
  const [hasApplicationsNeedingPayment, setHasApplicationsNeedingPayment] = useState(getCachedApplicationsPaymentStatus)
  
  // Load cached documents status from localStorage
  const getCachedDocumentsStatus = () => {
    if (!user?.id) return { picture: false, diploma: false, passport: false }
    try {
      const cached = localStorage.getItem(`documentsStatus_${user.id}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Check if cache is still valid (less than 5 minutes old)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.status
        }
      }
    } catch {
      // Ignore errors
    }
    return { picture: false, diploma: false, passport: false }
  }
  
  const [documentsStatus, setDocumentsStatus] = useState(getCachedDocumentsStatus)

  // Get opened quotes from localStorage
  const getOpenedQuotes = (): Set<string> => {
    try {
      const stored = localStorage.getItem('openedQuotes')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }

  // Fetch quotations and count unopened ones
  useEffect(() => {
    if (user?.role !== 'admin') return

    const fetchUnopenedCount = async () => {
      try {
        const quotations = await cachedRequest(
          'sidebar:quotations',
          () => quotationsAPI.getAll(),
          { ttl: 60_000 },
        )
        const opened = getOpenedQuotes()
        const unopened = quotations.filter((q: any) => !opened.has(q.id)).length
        setUnopenedQuotesCount(unopened)
      } catch (error) {
        console.error('Error fetching quotations for counter:', error)
      }
    }

    fetchUnopenedCount()

    // Listen for quotes updates — drop the cached entry first so the next
    // call hits the network and we see the new state instead of the stale one.
    const handleQuotesUpdate = () => {
      invalidate('sidebar:quotations')
      fetchUnopenedCount()
    }
    window.addEventListener('quotesUpdated', handleQuotesUpdate)

    // Also listen for storage changes (in case opened in another tab).
    const handleStorageChange = () => {
      invalidate('sidebar:quotations')
      fetchUnopenedCount()
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('quotesUpdated', handleQuotesUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user?.role])

  // Fetch documents status for non-admin users
  useEffect(() => {
    if (user?.role === 'admin' || !user) return

    // Load from cache first
    const cached = getCachedDocumentsStatus()
    setDocumentsStatus(cached)

    cachedRequest(
      `sidebar:documents:${user.id}`,
      () => userDocumentsAPI.getAll(),
      { ttl: 60_000 },
    )
      .then((docs) => {
        const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
        const status = {
          picture: !!docsMap.get('picture'),
          diploma: !!docsMap.get('diploma'),
          passport: !!docsMap.get('passport'),
        }
        setDocumentsStatus(status)

        try {
          localStorage.setItem(`documentsStatus_${user.id}`, JSON.stringify({
            status,
            timestamp: Date.now(),
          }))
        } catch {
          // Ignore errors
        }
      })
      .catch(() => {
        // Ignore errors, keep cached value
      })
  }, [user])

  // Listen for document updates
  useEffect(() => {
    if (user?.role === 'admin' || !user) return

    const handleDocumentsUpdate = () => {
      // Invalidate caches and refetch.
      try {
        localStorage.removeItem(`documentsStatus_${user.id}`)
      } catch {
        // Ignore errors
      }
      invalidate(`sidebar:documents:${user.id}`)

      userDocumentsAPI.getAll()
        .then((docs) => {
          const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
          const status = {
            picture: !!docsMap.get('picture'),
            diploma: !!docsMap.get('diploma'),
            passport: !!docsMap.get('passport'),
          }
          setDocumentsStatus(status)
          
          // Update cache
          try {
            localStorage.setItem(`documentsStatus_${user.id}`, JSON.stringify({
              status,
              timestamp: Date.now(),
            }))
          } catch {
            // Ignore errors
          }
        })
        .catch(() => {
          // Ignore errors
        })
    }

    const handleDocumentsStorageChange = (e: StorageEvent) => {
      if (e.key === `documentsStatus_${user.id}`) {
        const cached = getCachedDocumentsStatus()
        setDocumentsStatus(cached)
      }
    }

    window.addEventListener('documentsUpdated', handleDocumentsUpdate)
    window.addEventListener('storage', handleDocumentsStorageChange)

    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdate)
      window.removeEventListener('storage', handleDocumentsStorageChange)
    }
  }, [user])

  // Check for applications needing payment
  useEffect(() => {
    if (user?.role === 'admin' || !user) return

    // Load from cache first
    const cached = getCachedApplicationsPaymentStatus()
    setHasApplicationsNeedingPayment(cached)

    const checkApplicationsNeedingPayment = async () => {
      try {
        const hasPayment = await cachedRequest(
          `sidebar:hasPaymentsPending:${user.id}`,
          async () => {
            const applications = await applicationsAPI.getAll()
            if (!applications || applications.length === 0) return false
            const needsPaymentPromises = applications.map(async (app: any) => {
              try {
                const payments = await applicationPaymentsAPI.getByApplication(app.id)
                return payments.some(
                  (p: any) => p.status === 'pending' || p.status === 'pending_approval',
                )
              } catch {
                return false
              }
            })
            const results = await Promise.all(needsPaymentPromises)
            return results.some(Boolean)
          },
          { ttl: 60_000 },
        )
        setHasApplicationsNeedingPayment(hasPayment)
        try {
          localStorage.setItem(`applicationsPaymentStatus_${user.id}`, JSON.stringify({
            hasPayment,
            timestamp: Date.now(),
          }))
        } catch {
          // Ignore errors
        }
      } catch (error) {
        console.error('Error checking applications needing payment:', error)
        // Keep cached value on error
      }
    }

    checkApplicationsNeedingPayment()

    // Listen for application updates — bust the cache so the badge reflects
    // the new state on the very next render instead of waiting 60 s.
    const handleApplicationsUpdate = () => {
      invalidate(`sidebar:hasPaymentsPending:${user.id}`)
      checkApplicationsNeedingPayment()
    }

    window.addEventListener('applicationsUpdated', handleApplicationsUpdate)
    
    // Check periodically (every 30 seconds)
    const interval = setInterval(checkApplicationsNeedingPayment, 30000)

    return () => {
      window.removeEventListener('applicationsUpdated', handleApplicationsUpdate)
      clearInterval(interval)
    }
  }, [user])

  // Load unread emails count from localStorage and listen for updates
  useEffect(() => {
    if (!user?.id) return

    const getUnreadEmailsCount = (): number => {
      try {
        const cached = localStorage.getItem(`unreadEmailsCount_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Check if cache is still valid (less than 2 minutes old)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 2 * 60 * 1000) {
            return parsed.count || 0
          }
        }
      } catch {
        // Ignore errors
      }
      return 0
    }

    // Load initial count
    setUnreadEmailsCount(getUnreadEmailsCount())

    // Listen for updates from email pages
    const handleEmailsUpdate = () => {
      setUnreadEmailsCount(getUnreadEmailsCount())
    }
    window.addEventListener('emailsUpdated', handleEmailsUpdate)
    window.addEventListener('storage', handleEmailsUpdate)

    return () => {
      window.removeEventListener('emailsUpdated', handleEmailsUpdate)
      window.removeEventListener('storage', handleEmailsUpdate)
    }
  }, [user])

  // Load unread messages count from API (poll every 30s) and localStorage cache
  useEffect(() => {
    if (!user?.id) return

    const getValidCachedCount = (): number | null => {
      try {
        const cached = localStorage.getItem(`unreadMessagesCount_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 60 * 1000) {
            return parsed.count || 0
          }
        }
      } catch { /* ignore */ }
      return null
    }

    const messagesPath = roleUrl(user?.role, 'messages')

    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('gritsync_token')
        if (!token) return
        // Presence heartbeat — keeps the user's "online" status fresh app-wide
        fetch('/api/messages/heartbeat', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
        const res = await fetch('/api/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const count = data.count || 0
        setUnreadMessagesCount(count)
        localStorage.setItem(`unreadMessagesCount_${user.id}`, JSON.stringify({ count, timestamp: Date.now() }))

        const prev = prevUnreadMessagesRef.current
        if (prev !== null && count > prev) {
          const onMessagesPage = window.location.pathname === messagesPath ||
            window.location.pathname.startsWith(messagesPath + '/')
          if (!onMessagesPage) {
            const newCount = count - prev
            const msg = newCount === 1 ? 'You have a new message' : `You have ${newCount} new messages`
            showToast(
              msg,
              'info',
              8000,
              { label: 'View', onClick: () => { window.history.pushState(null, '', messagesPath); window.dispatchEvent(new PopStateEvent('popstate')) } },
              'messages-notification'
            )
          }
        }
        prevUnreadMessagesRef.current = count
      } catch { /* ignore */ }
    }

    const validCached = getValidCachedCount()
    if (validCached !== null) {
      setUnreadMessagesCount(validCached)
      prevUnreadMessagesRef.current = validCached
    }
    fetchCount()

    const interval = setInterval(fetchCount, 30000)

    const handleUpdate = () => {
      const c = getValidCachedCount()
      if (c !== null) setUnreadMessagesCount(c)
    }
    window.addEventListener('messagesUpdated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('messagesUpdated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [user, showToast])

  return (
    <>
      {/* Placeholder reserves the flex column so the fixed sidebar below
          doesn't overlap the main content. Hidden on mobile (MobileSidebar
          handles small screens). */}
      <div className="hidden md:block w-64 flex-shrink-0" aria-hidden />
    <aside
      className="hidden md:flex md:flex-col w-64 fixed left-0 z-30 overflow-hidden border-r bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 p-4"
      style={{
        // Sit directly below the sticky Header stack (header + optional
        // impersonation banner). Header.tsx publishes --app-header-h.
        top: 'var(--app-header-h, 4rem)',
        height: 'calc(100vh - var(--app-header-h, 4rem))',
      }}
    >
      <nav className="space-y-2 overflow-y-auto flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          let isActive = location.pathname === item.path || 
            location.pathname.startsWith(item.path + '/')
          
          // Special handling for "My Applications" to also match /application/new
          // under the user's panel (e.g. /client/application/new).
          if (item.path === roleUrl(user?.role, 'applications')) {
            const applicationBase = roleUrl(user?.role, 'application')
            isActive = isActive ||
              location.pathname === applicationBase + '/new' ||
              location.pathname.startsWith(applicationBase + '/')
          }

          // Show counter for Quotations link (admin only)
          const showQuotesCounter = item.path === '/admin/quotations' && unopenedQuotesCount > 0
          
          // Show counter for Emails link (every panel that surfaces /emails)
          const showEmailsCounter = item.path.endsWith('/emails') && unreadEmailsCount > 0

          // Show counter for Messages link (every panel that surfaces /messages)
          const showMessagesCounter = item.path.endsWith('/messages') && unreadMessagesCount > 0

          // Show stop indicator for Documents link if required documents are incomplete
          const showDocumentsStop = item.path === roleUrl(user?.role, 'documents') && !isAdmin() &&
            (!documentsStatus.picture || !documentsStatus.diploma || !documentsStatus.passport)

          // Show stop indicator for Applications link if there are applications needing payment
          const showApplicationsStop = item.path.endsWith('/applications') &&
            hasApplicationsNeedingPayment
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                // border-l-4 is reserved on both states (transparent when
                // inactive) so the text never shifts; pl-3 + 4px border = px-4.
                'flex items-center gap-3 border-l-4 pl-3 pr-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary-600 dark:text-primary-400')} />
              <span className={cn('flex-1 min-w-0', isActive && 'font-semibold')}>{item.label}</span>
              {showQuotesCounter && (
                <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unopenedQuotesCount > 99 ? '99+' : unopenedQuotesCount}
                </span>
              )}
              {showEmailsCounter && (
                <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadEmailsCount > 99 ? '99+' : unreadEmailsCount}
                </span>
              )}
              {showMessagesCounter && (
                <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
              {showDocumentsStop && (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
              )}
              {showApplicationsStop && (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
              )}
            </Link>
          )
        })}
        {/* NCLEX Review — cross-subdomain link, SSO-hop on click */}
        {SHOW_NCLEX_REVIEW && !isAdmin() && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); openReviewWithSso() }}
            className="w-full flex items-center gap-3 border-l-4 border-transparent pl-3 pr-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <BookOpen className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 min-w-0 text-left">NCLEX Review</span>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          </button>
        )}
      </nav>
    </aside>
    </>
  )
}

interface MobileSidebarProps {
  onNavigate?: () => void
}

export function MobileSidebar({ onNavigate }: MobileSidebarProps) {
  const { isAdmin, user } = useAuth()
  const { matrix: permissionMatrix } = usePermissions()
  const location = useLocation()
  const { showToast } = useToast()
  const navItems = useMemo(() => buildNavItems(user?.role, permissionMatrix), [user?.role, permissionMatrix])
  const [unopenedQuotesCount, setUnopenedQuotesCount] = useState(0)
  const [unreadEmailsCount, setUnreadEmailsCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const prevUnreadMessagesRef = useRef<number | null>(null)
  
  // Load cached applications payment status from localStorage
  const getCachedApplicationsPaymentStatus = () => {
    if (!user?.id) return false
    try {
      const cached = localStorage.getItem(`applicationsPaymentStatus_${user.id}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Check if cache is still valid (less than 2 minutes old)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 2 * 60 * 1000) {
          return parsed.hasPayment
        }
      }
    } catch {
      // Ignore errors
    }
    return false
  }
  
  const [hasApplicationsNeedingPayment, setHasApplicationsNeedingPayment] = useState(getCachedApplicationsPaymentStatus)
  
  // Load cached documents status from localStorage
  const getCachedDocumentsStatus = () => {
    if (!user?.id) return { picture: false, diploma: false, passport: false }
    try {
      const cached = localStorage.getItem(`documentsStatus_${user.id}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Check if cache is still valid (less than 5 minutes old)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.status
        }
      }
    } catch {
      // Ignore errors
    }
    return { picture: false, diploma: false, passport: false }
  }
  
  const [documentsStatus, setDocumentsStatus] = useState(getCachedDocumentsStatus)

  // Get opened quotes from localStorage
  const getOpenedQuotes = (): Set<string> => {
    try {
      const stored = localStorage.getItem('openedQuotes')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }

  // Fetch quotations and count unopened ones
  useEffect(() => {
    if (user?.role !== 'admin') return

    const fetchUnopenedCount = async () => {
      try {
        const quotations = await cachedRequest(
          'sidebar:quotations',
          () => quotationsAPI.getAll(),
          { ttl: 60_000 },
        )
        const opened = getOpenedQuotes()
        const unopened = quotations.filter((q: any) => !opened.has(q.id)).length
        setUnopenedQuotesCount(unopened)
      } catch (error) {
        console.error('Error fetching quotations for counter:', error)
      }
    }

    fetchUnopenedCount()

    // Listen for quotes updates — drop the cached entry first so the next
    // call hits the network and we see the new state instead of the stale one.
    const handleQuotesUpdate = () => {
      invalidate('sidebar:quotations')
      fetchUnopenedCount()
    }
    window.addEventListener('quotesUpdated', handleQuotesUpdate)

    // Also listen for storage changes (in case opened in another tab).
    const handleStorageChange = () => {
      invalidate('sidebar:quotations')
      fetchUnopenedCount()
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('quotesUpdated', handleQuotesUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user?.role])

  // Fetch documents status for non-admin users
  useEffect(() => {
    if (user?.role === 'admin' || !user) return

    // Load from cache first
    const cached = getCachedDocumentsStatus()
    setDocumentsStatus(cached)

    cachedRequest(
      `sidebar:documents:${user.id}`,
      () => userDocumentsAPI.getAll(),
      { ttl: 60_000 },
    )
      .then((docs) => {
        const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
        const status = {
          picture: !!docsMap.get('picture'),
          diploma: !!docsMap.get('diploma'),
          passport: !!docsMap.get('passport'),
        }
        setDocumentsStatus(status)

        try {
          localStorage.setItem(`documentsStatus_${user.id}`, JSON.stringify({
            status,
            timestamp: Date.now(),
          }))
        } catch {
          // Ignore errors
        }
      })
      .catch(() => {
        // Ignore errors, keep cached value
      })
  }, [user])

  // Listen for document updates
  useEffect(() => {
    if (user?.role === 'admin' || !user) return

    const handleDocumentsUpdate = () => {
      // Invalidate caches and refetch.
      try {
        localStorage.removeItem(`documentsStatus_${user.id}`)
      } catch {
        // Ignore errors
      }
      invalidate(`sidebar:documents:${user.id}`)

      userDocumentsAPI.getAll()
        .then((docs) => {
          const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
          const status = {
            picture: !!docsMap.get('picture'),
            diploma: !!docsMap.get('diploma'),
            passport: !!docsMap.get('passport'),
          }
          setDocumentsStatus(status)
          
          // Update cache
          try {
            localStorage.setItem(`documentsStatus_${user.id}`, JSON.stringify({
              status,
              timestamp: Date.now(),
            }))
          } catch {
            // Ignore errors
          }
        })
        .catch(() => {
          // Ignore errors
        })
    }

    const handleDocumentsStorageChange = (e: StorageEvent) => {
      if (e.key === `documentsStatus_${user.id}`) {
        const cached = getCachedDocumentsStatus()
        setDocumentsStatus(cached)
      }
    }

    window.addEventListener('documentsUpdated', handleDocumentsUpdate)
    window.addEventListener('storage', handleDocumentsStorageChange)

    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdate)
      window.removeEventListener('storage', handleDocumentsStorageChange)
    }
  }, [user])

  // Check for applications needing payment
  useEffect(() => {
    if (user?.role === 'admin' || !user) return

    // Load from cache first
    const cached = getCachedApplicationsPaymentStatus()
    setHasApplicationsNeedingPayment(cached)

    const checkApplicationsNeedingPayment = async () => {
      try {
        const hasPayment = await cachedRequest(
          `sidebar:hasPaymentsPending:${user.id}`,
          async () => {
            const applications = await applicationsAPI.getAll()
            if (!applications || applications.length === 0) return false
            const needsPaymentPromises = applications.map(async (app: any) => {
              try {
                const payments = await applicationPaymentsAPI.getByApplication(app.id)
                return payments.some(
                  (p: any) => p.status === 'pending' || p.status === 'pending_approval',
                )
              } catch {
                return false
              }
            })
            const results = await Promise.all(needsPaymentPromises)
            return results.some(Boolean)
          },
          { ttl: 60_000 },
        )
        setHasApplicationsNeedingPayment(hasPayment)
        try {
          localStorage.setItem(`applicationsPaymentStatus_${user.id}`, JSON.stringify({
            hasPayment,
            timestamp: Date.now(),
          }))
        } catch {
          // Ignore errors
        }
      } catch (error) {
        console.error('Error checking applications needing payment:', error)
        // Keep cached value on error
      }
    }

    checkApplicationsNeedingPayment()

    // Listen for application updates — bust the cache so the badge reflects
    // the new state on the very next render instead of waiting 60 s.
    const handleApplicationsUpdate = () => {
      invalidate(`sidebar:hasPaymentsPending:${user.id}`)
      checkApplicationsNeedingPayment()
    }

    window.addEventListener('applicationsUpdated', handleApplicationsUpdate)
    
    // Check periodically (every 30 seconds)
    const interval = setInterval(checkApplicationsNeedingPayment, 30000)

    return () => {
      window.removeEventListener('applicationsUpdated', handleApplicationsUpdate)
      clearInterval(interval)
    }
  }, [user])

  // Load unread emails count from localStorage and listen for updates
  useEffect(() => {
    if (!user?.id) return

    const getUnreadEmailsCount = (): number => {
      try {
        const cached = localStorage.getItem(`unreadEmailsCount_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Check if cache is still valid (less than 2 minutes old)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 2 * 60 * 1000) {
            return parsed.count || 0
          }
        }
      } catch {
        // Ignore errors
      }
      return 0
    }

    // Load initial count
    setUnreadEmailsCount(getUnreadEmailsCount())

    // Listen for updates from email pages
    const handleEmailsUpdate = () => {
      setUnreadEmailsCount(getUnreadEmailsCount())
    }
    window.addEventListener('emailsUpdated', handleEmailsUpdate)
    window.addEventListener('storage', handleEmailsUpdate)

    return () => {
      window.removeEventListener('emailsUpdated', handleEmailsUpdate)
      window.removeEventListener('storage', handleEmailsUpdate)
    }
  }, [user])

  // Load unread messages count from API (poll every 30s) and localStorage cache
  useEffect(() => {
    if (!user?.id) return

    const getValidCachedCount = (): number | null => {
      try {
        const cached = localStorage.getItem(`unreadMessagesCount_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 60 * 1000) {
            return parsed.count || 0
          }
        }
      } catch { /* ignore */ }
      return null
    }

    const messagesPath = roleUrl(user?.role, 'messages')

    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('gritsync_token')
        if (!token) return
        // Presence heartbeat — keeps the user's "online" status fresh app-wide
        fetch('/api/messages/heartbeat', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
        const res = await fetch('/api/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const count = data.count || 0
        setUnreadMessagesCount(count)
        localStorage.setItem(`unreadMessagesCount_${user.id}`, JSON.stringify({ count, timestamp: Date.now() }))

        const prev = prevUnreadMessagesRef.current
        if (prev !== null && count > prev) {
          const onMessagesPage = window.location.pathname === messagesPath ||
            window.location.pathname.startsWith(messagesPath + '/')
          if (!onMessagesPage) {
            const newCount = count - prev
            const msg = newCount === 1 ? 'You have a new message' : `You have ${newCount} new messages`
            showToast(
              msg,
              'info',
              8000,
              { label: 'View', onClick: () => { window.history.pushState(null, '', messagesPath); window.dispatchEvent(new PopStateEvent('popstate')) } },
              'messages-notification'
            )
          }
        }
        prevUnreadMessagesRef.current = count
      } catch { /* ignore */ }
    }

    const validCached = getValidCachedCount()
    if (validCached !== null) {
      setUnreadMessagesCount(validCached)
      prevUnreadMessagesRef.current = validCached
    }
    fetchCount()

    const interval = setInterval(fetchCount, 30000)

    const handleUpdate = () => {
      const c = getValidCachedCount()
      if (c !== null) setUnreadMessagesCount(c)
    }
    window.addEventListener('messagesUpdated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('messagesUpdated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [user, showToast])

  return (
    <aside className="w-full h-full bg-white dark:bg-gray-900 p-4 overflow-visible">
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          let isActive = location.pathname === item.path || 
            location.pathname.startsWith(item.path + '/')
          
          // Special handling for "My Applications" to also match /application/new
          // under the user's panel (e.g. /client/application/new).
          if (item.path === roleUrl(user?.role, 'applications')) {
            const applicationBase = roleUrl(user?.role, 'application')
            isActive = isActive ||
              location.pathname === applicationBase + '/new' ||
              location.pathname.startsWith(applicationBase + '/')
          }

          // Show counter for Quotations link (admin only)
          const showQuotesCounter = item.path === '/admin/quotations' && unopenedQuotesCount > 0
          
          // Show counter for Emails link (every panel that surfaces /emails)
          const showEmailsCounter = item.path.endsWith('/emails') && unreadEmailsCount > 0

          // Show counter for Messages link (every panel that surfaces /messages)
          const showMessagesCounter = item.path.endsWith('/messages') && unreadMessagesCount > 0

          // Show stop indicator for Documents link if required documents are incomplete
          const showDocumentsStop = item.path === roleUrl(user?.role, 'documents') && !isAdmin() &&
            (!documentsStatus.picture || !documentsStatus.diploma || !documentsStatus.passport)

          // Show stop indicator for Applications link if there are applications needing payment
          const showApplicationsStop = item.path.endsWith('/applications') &&
            hasApplicationsNeedingPayment
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                // border-l-4 is reserved on both states (transparent when
                // inactive) so the text never shifts; pl-3 + 4px border = px-4.
                'flex items-center gap-3 border-l-4 pl-3 pr-4 py-3 rounded-lg transition-colors w-full',
                isActive
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              style={{ visibility: 'visible', display: 'flex' }}
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary-600 dark:text-primary-400')} />
              <span className={cn('flex-1 min-w-0 block', isActive && 'font-semibold')}>{item.label}</span>
              {showQuotesCounter && (
                <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unopenedQuotesCount > 99 ? '99+' : unopenedQuotesCount}
                </span>
              )}
              {showEmailsCounter && (
                <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadEmailsCount > 99 ? '99+' : unreadEmailsCount}
                </span>
              )}
              {showMessagesCounter && (
                <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
              {showDocumentsStop && (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
              )}
              {showApplicationsStop && (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
              )}
            </Link>
          )
        })}
        {/* NCLEX Review — cross-subdomain link, SSO-hop on click */}
        {SHOW_NCLEX_REVIEW && !isAdmin() && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onNavigate?.(); openReviewWithSso() }}
            className="flex items-center gap-3 border-l-4 border-transparent pl-3 pr-4 py-3 rounded-lg transition-colors w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ visibility: 'visible', display: 'flex' }}
          >
            <BookOpen className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 min-w-0 block text-left">NCLEX Review</span>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          </button>
        )}
      </nav>
    </aside>
  )
}

