import { useEffect, useState, useRef, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { roleUrl, type AppRole, type RolePermissions } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { quotationsAPI, userDocumentsAPI, applicationsAPI, applicationPaymentsAPI } from '@/lib/api'
import { reviewUrl } from '@/lib/routing'
import { useToast } from '@/components/ui/Toast'
import {
  LayoutDashboard,
  DollarSign,
  ClipboardList,
  Users,
  Settings,
  FolderOpen,
  Award,
  Heart,
  Briefcase,
  Building2,
  Mail,
  BookOpen,
  Crown,
  MessageSquare,
  Link2,
  ArrowUpRight,
  Share2,
  Megaphone,
} from 'lucide-react'
import { AlertCircleSolid } from './icons/AlertCircleSolid'

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
  { label: 'AI Ads', path: '/admin/ads', icon: Megaphone },
  { label: 'Question Bank', path: '/admin/question-bank', icon: BookOpen },
  { label: 'NCLEX Subscriptions', path: '/admin/nclex-subscriptions', icon: Crown },
  { label: 'Sponsorships', path: '/admin/sponsorships', icon: Award },
  { label: 'Donations', path: '/admin/donations', icon: Heart },
  { label: 'Career Applications', path: '/admin/careers', icon: Briefcase },
  { label: 'Partner Agencies', path: '/admin/partner-agencies', icon: Building2 },
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
    if (!isAdmin()) return

    const fetchUnopenedCount = async () => {
      try {
        const quotations = await quotationsAPI.getAll()
        const opened = getOpenedQuotes()
        const unopened = quotations.filter((q: any) => !opened.has(q.id)).length
        setUnopenedQuotesCount(unopened)
      } catch (error) {
        console.error('Error fetching quotations for counter:', error)
      }
    }

    fetchUnopenedCount()

    // Listen for quotes updates
    const handleQuotesUpdate = () => {
      fetchUnopenedCount()
    }
    window.addEventListener('quotesUpdated', handleQuotesUpdate)
    
    // Also listen for storage changes (in case opened in another tab)
    const handleStorageChange = () => {
      fetchUnopenedCount()
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('quotesUpdated', handleQuotesUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [isAdmin])

  // Fetch documents status for non-admin users
  useEffect(() => {
    if (isAdmin() || !user) return

    // Load from cache first
    const cached = getCachedDocumentsStatus()
    setDocumentsStatus(cached)

    userDocumentsAPI.getAll()
      .then((docs) => {
        const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
        const status = {
          picture: !!docsMap.get('picture'),
          diploma: !!docsMap.get('diploma'),
          passport: !!docsMap.get('passport'),
        }
        setDocumentsStatus(status)
        
        // Cache the status
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
  }, [isAdmin, user])

  // Listen for document updates
  useEffect(() => {
    if (isAdmin() || !user) return

    const handleDocumentsUpdate = () => {
      // Invalidate cache and refetch
      try {
        localStorage.removeItem(`documentsStatus_${user.id}`)
      } catch {
        // Ignore errors
      }
      
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

    window.addEventListener('documentsUpdated', handleDocumentsUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === `documentsStatus_${user.id}`) {
        const cached = getCachedDocumentsStatus()
        setDocumentsStatus(cached)
      }
    })

    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdate)
    }
  }, [isAdmin, user])

  // Check for applications needing payment
  useEffect(() => {
    if (isAdmin() || !user) return

    // Load from cache first
    const cached = getCachedApplicationsPaymentStatus()
    setHasApplicationsNeedingPayment(cached)

    const checkApplicationsNeedingPayment = async () => {
      try {
        const applications = await applicationsAPI.getAll()
        if (applications && applications.length > 0) {
          // Check each application for pending payments
          const needsPaymentPromises = applications.map(async (app: any) => {
            try {
              const payments = await applicationPaymentsAPI.getByApplication(app.id)
              return payments.some(
                (p: any) => p.status === 'pending' || p.status === 'pending_approval'
              )
            } catch {
              return false
            }
          })
          
          const results = await Promise.all(needsPaymentPromises)
          const hasPayment = results.some(Boolean)
          setHasApplicationsNeedingPayment(hasPayment)
          
          // Cache the status
          try {
            localStorage.setItem(`applicationsPaymentStatus_${user.id}`, JSON.stringify({
              hasPayment,
              timestamp: Date.now(),
            }))
          } catch {
            // Ignore errors
          }
        } else {
          setHasApplicationsNeedingPayment(false)
          
          // Cache the status
          try {
            localStorage.setItem(`applicationsPaymentStatus_${user.id}`, JSON.stringify({
              hasPayment: false,
              timestamp: Date.now(),
            }))
          } catch {
            // Ignore errors
          }
        }
      } catch (error) {
        console.error('Error checking applications needing payment:', error)
        // Keep cached value on error
      }
    }

    checkApplicationsNeedingPayment()

    // Listen for application updates
    const handleApplicationsUpdate = () => {
      checkApplicationsNeedingPayment()
    }

    window.addEventListener('applicationsUpdated', handleApplicationsUpdate)
    
    // Check periodically (every 30 seconds)
    const interval = setInterval(checkApplicationsNeedingPayment, 30000)

    return () => {
      window.removeEventListener('applicationsUpdated', handleApplicationsUpdate)
      clearInterval(interval)
    }
  }, [isAdmin, user])

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
  }, [user, isAdmin, showToast])

  return (
    <>
      {/* Placeholder reserves the flex column so the fixed sidebar below
          doesn't overlap the main content. Hidden on mobile (MobileSidebar
          handles small screens). */}
      <div className="hidden md:block w-64 flex-shrink-0" aria-hidden />
    <aside className="hidden md:flex md:flex-col w-64 h-[calc(100vh-4rem)] fixed top-16 left-0 z-30 overflow-hidden border-r bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 p-4">
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
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 min-w-0">{item.label}</span>
              {showQuotesCounter && (
                <span className="flex-shrink-0 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unopenedQuotesCount > 99 ? '99+' : unopenedQuotesCount}
                </span>
              )}
              {showEmailsCounter && (
                <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadEmailsCount > 99 ? '99+' : unreadEmailsCount}
                </span>
              )}
              {showMessagesCounter && (
                <span className="flex-shrink-0 bg-green-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
              {showDocumentsStop && (
                <AlertCircleSolid className="h-4 w-4 flex-shrink-0" />
              )}
              {showApplicationsStop && (
                <AlertCircleSolid className="h-4 w-4 flex-shrink-0" />
              )}
            </Link>
          )
        })}
        {/* NCLEX Review — cross-subdomain link, opens in a new tab */}
        {!isAdmin() && (
          <a
            href={reviewUrl('/')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <BookOpen className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 min-w-0">NCLEX Review</span>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          </a>
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
    if (!isAdmin()) return

    const fetchUnopenedCount = async () => {
      try {
        const quotations = await quotationsAPI.getAll()
        const opened = getOpenedQuotes()
        const unopened = quotations.filter((q: any) => !opened.has(q.id)).length
        setUnopenedQuotesCount(unopened)
      } catch (error) {
        console.error('Error fetching quotations for counter:', error)
      }
    }

    fetchUnopenedCount()

    // Listen for quotes updates
    const handleQuotesUpdate = () => {
      fetchUnopenedCount()
    }
    window.addEventListener('quotesUpdated', handleQuotesUpdate)
    
    // Also listen for storage changes (in case opened in another tab)
    const handleStorageChange = () => {
      fetchUnopenedCount()
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('quotesUpdated', handleQuotesUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [isAdmin])

  // Fetch documents status for non-admin users
  useEffect(() => {
    if (isAdmin() || !user) return

    // Load from cache first
    const cached = getCachedDocumentsStatus()
    setDocumentsStatus(cached)

    userDocumentsAPI.getAll()
      .then((docs) => {
        const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
        const status = {
          picture: !!docsMap.get('picture'),
          diploma: !!docsMap.get('diploma'),
          passport: !!docsMap.get('passport'),
        }
        setDocumentsStatus(status)
        
        // Cache the status
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
  }, [isAdmin, user])

  // Listen for document updates
  useEffect(() => {
    if (isAdmin() || !user) return

    const handleDocumentsUpdate = () => {
      // Invalidate cache and refetch
      try {
        localStorage.removeItem(`documentsStatus_${user.id}`)
      } catch {
        // Ignore errors
      }
      
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

    window.addEventListener('documentsUpdated', handleDocumentsUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === `documentsStatus_${user.id}`) {
        const cached = getCachedDocumentsStatus()
        setDocumentsStatus(cached)
      }
    })

    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdate)
    }
  }, [isAdmin, user])

  // Check for applications needing payment
  useEffect(() => {
    if (isAdmin() || !user) return

    // Load from cache first
    const cached = getCachedApplicationsPaymentStatus()
    setHasApplicationsNeedingPayment(cached)

    const checkApplicationsNeedingPayment = async () => {
      try {
        const applications = await applicationsAPI.getAll()
        if (applications && applications.length > 0) {
          // Check each application for pending payments
          const needsPaymentPromises = applications.map(async (app: any) => {
            try {
              const payments = await applicationPaymentsAPI.getByApplication(app.id)
              return payments.some(
                (p: any) => p.status === 'pending' || p.status === 'pending_approval'
              )
            } catch {
              return false
            }
          })
          
          const results = await Promise.all(needsPaymentPromises)
          const hasPayment = results.some(Boolean)
          setHasApplicationsNeedingPayment(hasPayment)
          
          // Cache the status
          try {
            localStorage.setItem(`applicationsPaymentStatus_${user.id}`, JSON.stringify({
              hasPayment,
              timestamp: Date.now(),
            }))
          } catch {
            // Ignore errors
          }
        } else {
          setHasApplicationsNeedingPayment(false)
          
          // Cache the status
          try {
            localStorage.setItem(`applicationsPaymentStatus_${user.id}`, JSON.stringify({
              hasPayment: false,
              timestamp: Date.now(),
            }))
          } catch {
            // Ignore errors
          }
        }
      } catch (error) {
        console.error('Error checking applications needing payment:', error)
        // Keep cached value on error
      }
    }

    checkApplicationsNeedingPayment()

    // Listen for application updates
    const handleApplicationsUpdate = () => {
      checkApplicationsNeedingPayment()
    }

    window.addEventListener('applicationsUpdated', handleApplicationsUpdate)
    
    // Check periodically (every 30 seconds)
    const interval = setInterval(checkApplicationsNeedingPayment, 30000)

    return () => {
      window.removeEventListener('applicationsUpdated', handleApplicationsUpdate)
      clearInterval(interval)
    }
  }, [isAdmin, user])

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
  }, [user, isAdmin, showToast])

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
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              style={{ visibility: 'visible', display: 'flex' }}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 min-w-0 block">{item.label}</span>
              {showQuotesCounter && (
                <span className="flex-shrink-0 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unopenedQuotesCount > 99 ? '99+' : unopenedQuotesCount}
                </span>
              )}
              {showEmailsCounter && (
                <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadEmailsCount > 99 ? '99+' : unreadEmailsCount}
                </span>
              )}
              {showMessagesCounter && (
                <span className="flex-shrink-0 bg-green-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
              {showDocumentsStop && (
                <AlertCircleSolid className="h-4 w-4 flex-shrink-0" />
              )}
              {showApplicationsStop && (
                <AlertCircleSolid className="h-4 w-4 flex-shrink-0" />
              )}
            </Link>
          )
        })}
        {/* NCLEX Review — cross-subdomain link, opens in a new tab */}
        {!isAdmin() && (
          <a
            href={reviewUrl('/')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ visibility: 'visible', display: 'flex' }}
          >
            <BookOpen className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 min-w-0 block">NCLEX Review</span>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          </a>
        )}
      </nav>
    </aside>
  )
}

