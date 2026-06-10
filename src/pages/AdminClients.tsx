import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { appUrl } from '@/lib/routing'
import { pushCurrentSession } from '@/lib/impersonation'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CardSkeleton } from '@/components/ui/Loading'
import { clientsAPI } from '@/lib/api'
import { formatDate, getFullName, exportToCSV, paginate, cn, generatePassword } from '@/lib/utils'
import { db } from '@/lib/api-client'
import { useDebounce } from '@/hooks/useDebounce'

// GritSync email generation is now handled server-side via database functions
// Removed client-side generation logic
import { Users, Search, Mail, RefreshCw, ChevronLeft, ChevronRight, FileText, Eye, EyeOff, Award, School, Download, User, MapPin, UserX, Trash2, MessageSquare, Briefcase, Shield, Link2, UserPlus, X, RefreshCcw, AlertTriangle, LogIn } from 'lucide-react'
import { subscribeToAllClients, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@db/db-js'
import { Modal } from '@/components/ui/Modal'
import { userDetailsAPI, userDocumentsAPI, getSignedFileUrl } from '@/lib/api'
import { CredentialsModal, type CreatedAccountCredentials } from '@/components/CredentialsModal'

interface Client {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  role: string
  created_at: string
  grit_id: string
  gmail_account?: string
  is_active?: boolean
  referral_code?: string | null
  referred_by?: string | null
  advisor_id?: string | null
}

type RoleTab = 'client' | 'affiliate' | 'advisor' | 'admin'

const ROLE_TABS: { id: RoleTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'client', label: 'Clients', icon: Users },
  { id: 'affiliate', label: 'Affiliates', icon: Link2 },
  { id: 'advisor', label: 'Advisors', icon: Briefcase },
  { id: 'admin', label: 'Admins', icon: Shield },
]

const ROLE_SINGULAR: Record<RoleTab, string> = {
  client: 'Client',
  affiliate: 'Affiliate',
  advisor: 'Advisor',
  admin: 'Admin',
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  client: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  affiliate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  advisor: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  admin: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300',
}

function RoleBadge({ role }: { role: string }) {
  const label = role.charAt(0).toUpperCase() + role.slice(1)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.client)}>
      {label}
    </span>
  )
}

// Profile section card used inside the admin View Profile modal.
// `accent` is a tailwind gradient class fragment (e.g. "from-sky-500 to-blue-600")
// that colors the icon chip — gives each section a distinct visual feel
// without recoloring the entire card.
interface ProfileSectionProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  accent: string
  summary?: string
  fields: { label: string; value?: string | null; capitalize?: boolean }[]
}

function ProfileSection({ icon: Icon, title, accent, summary, fields }: ProfileSectionProps) {
  const filledCount = fields.filter(f => f.value && String(f.value).trim() !== '' && String(f.value) !== 'N/A').length
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className={cn('h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm', accent)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {summary && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{summary}</p>
          )}
        </div>
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 flex-shrink-0">
          {filledCount}/{fields.length}
        </span>
      </div>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {fields.map(({ label, value, capitalize }) => {
          const v = value && String(value).trim() !== '' ? String(value) : null
          return (
            <div key={label} className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</div>
              <div className={cn(
                'mt-0.5 text-sm break-words',
                v ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600 italic',
                capitalize && v && 'capitalize',
              )}>
                {v || 'Not provided'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AdminClients() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300) // Debounce search input
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [exporting, setExporting] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [clientDocuments, setClientDocuments] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [actioningClientId, setActioningClientId] = useState<string | null>(null)
  // Validation modal for deactivate/reactivate/delete. Delete requires typing
  // the user's email to enable the confirm button (account deletion is
  // irreversible — we want a deliberate keystroke, not just a click).
  const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'delete'; client: Client } | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<RoleTab>('client')
  const emptyCreateForm = { role: 'client' as RoleTab, first_name: '', last_name: '', middle_name: '', personal_email: '', mobile: '', password: '' }
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<CreatedAccountCredentials | null>(null)
  // Entrance motion plays once on the first rendered page of results, then is
  // disabled so pagination / tab / search changes don't re-trigger it.
  const entrancePlayedRef = useRef(false)
  const entrance = !entrancePlayedRef.current
  useEffect(() => {
    if (loading) return
    // Wait for the longest stagger (0.35s anim + 300ms max delay) to finish
    // before turning the classes off on the next render.
    const t = setTimeout(() => { entrancePlayedRef.current = true }, 700)
    return () => clearTimeout(t)
  }, [loading])

  const openCreateModal = (role: RoleTab) => {
    setCreateForm({ ...emptyCreateForm, role, password: generatePassword(14) })
    setShowCreatePassword(true)
    setShowCreateModal(true)
  }

  useEffect(() => {
    if (isAdmin()) {
      fetchClients()
      fetchUnreadCounts()
      const pollInterval = setInterval(fetchUnreadCounts, 60_000)
      return () => clearInterval(pollInterval)
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  async function fetchUnreadCounts() {
    try {
      const token = localStorage.getItem('gritsync_token')
      if (!token) return
      const res = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const conversations: Array<{ client_id: string; unread_count: number }> = data.data || []
      const counts: Record<string, number> = {}
      for (const conv of conversations) {
        if (conv.unread_count > 0) {
          counts[conv.client_id] = conv.unread_count
        }
      }
      setUnreadCounts(counts)
    } catch {
      // silently ignore — badge is non-critical
    }
  }

  // Set up real-time subscription for new client registrations
  useEffect(() => {
    if (!isAdmin()) return

    const clientsChannel = subscribeToAllClients((payload) => {
      handleClientRealtimeUpdate(payload)
    })
    channelRef.current = clientsChannel

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isAdmin])

  // Handle real-time client updates
  function handleClientRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord && ['client', 'affiliate', 'advisor', 'admin'].includes(newRecord.role)) {
        // New user registered - add to list
        setClients((prev) => prev.some((c) => c.id === newRecord.id) ? prev : [newRecord, ...prev])
        if (newRecord.role === 'client') showToast('New client registered', 'info')
      } else if (eventType === 'UPDATE' && newRecord) {
        // Client updated - update in place
        setClients((prev) => {
          const index = prev.findIndex((c) => c.id === newRecord.id)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = { ...updated[index], ...newRecord }
            return updated
          }
          return prev
        })
      } else if (eventType === 'DELETE' && oldRecord) {
        // Client deleted - remove from list
        setClients((prev) => prev.filter((c) => c.id !== oldRecord.id))
      }
    } catch (error) {
      console.error('Error handling real-time client update:', error)
      // Fallback to full refresh on error
      fetchClients()
    }
  }

  async function fetchClients() {
    try {
      setLoading(true)
      // Fetch every user (all roles) so the role tabs can be populated
      const usersWithGmail = await clientsAPI.getAllUsersWithGmailAccounts()

      setClients(usersWithGmail as Client[])
      setCurrentPage(1)
    } catch (error: any) {
      console.error('Error fetching users:', error)
      showToast(error?.message || 'Failed to load users', 'error')
      // Fallback to basic getAll if the batch method fails
      try {
        const data = await clientsAPI.getAll()
        const clientsData = (data as unknown as Client[]) || []
        setClients(clientsData.map(c => ({ ...c, gmail_account: c.email })))
      } catch (fallbackError) {
        setClients([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleChangeRole(client: Client, newRole: RoleTab) {
    if (client.role === newRole) return
    if (!confirm(`Change ${getFullName(client.first_name, client.last_name)}'s role from "${client.role}" to "${newRole}"?`)) return
    setActioningClientId(client.id)
    try {
      const token = localStorage.getItem('gritsync_token')
      const res = await fetch(`/api/auth/admin/users/${client.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change role')
      const referral_code = data.user?.referral_code ?? client.referral_code ?? null
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: newRole, referral_code } : c))
      showToast(`${getFullName(client.first_name, client.last_name)} is now ${/^[aeiou]/i.test(newRole) ? 'an' : 'a'} ${newRole}`, 'success')
      setActiveTab(newRole)
    } catch (error: any) {
      showToast(error.message || 'Failed to change role', 'error')
    } finally {
      setActioningClientId(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchClients(), fetchUnreadCounts()])
  }

  const handleViewClient = async (client: Client) => {
    setSelectedClient(client)
    setLoadingDetails(true)
    setClientDetails(null)
    setClientDocuments([])
    
    try {
      // Try fetching user details - first via API, then direct query as fallback
      let detailsResult = null
      try {
        detailsResult = await userDetailsAPI.getByUserId(client.id)
      } catch {
        // Fallback: direct Supabase query
        const { data, error } = await db
          .from('user_details')
          .select('*')
          .eq('user_id', client.id)
          .maybeSingle()
        
        if (!error) {
          detailsResult = data
        }
      }
      
      // If still no data, try querying without maybeSingle to see if there are any rows
      if (!detailsResult) {
        const { data: allRows } = await db
          .from('user_details')
          .select('*')
          .eq('user_id', client.id)
        
        if (allRows && allRows.length > 0) {
          detailsResult = allRows[0]
        }
      }
      
      // If still no data, try fetching from latest application as fallback
      if (!detailsResult) {
        const { data: applications } = await db
          .from('applications')
          .select('*')
          .eq('user_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (applications && applications.length > 0) {
          const latestApp = applications[0] as {
            first_name?: string | null
            middle_name?: string | null
            last_name?: string | null
            gender?: string | null
            marital_status?: string | null
            single_full_name?: string | null
            date_of_birth?: string | null
            birth_place?: string | null
            email?: string | null
            mobile_number?: string | null
            house_number?: string | null
            street_name?: string | null
            city?: string | null
            province?: string | null
            country?: string | null
            zipcode?: string | null
            elementary_school?: string | null
            elementary_city?: string | null
            elementary_province?: string | null
            elementary_country?: string | null
            elementary_years_attended?: string | null
            elementary_start_date?: string | null
            elementary_end_date?: string | null
            high_school?: string | null
            high_school_city?: string | null
            high_school_province?: string | null
            high_school_country?: string | null
            high_school_years_attended?: string | null
            high_school_start_date?: string | null
            high_school_end_date?: string | null
            nursing_school?: string | null
            nursing_school_city?: string | null
            nursing_school_province?: string | null
            nursing_school_country?: string | null
            nursing_school_years_attended?: string | null
            nursing_school_start_date?: string | null
            nursing_school_end_date?: string | null
            nursing_school_major?: string | null
            nursing_school_diploma_date?: string | null
          }
          // Map application fields to user_details format
          detailsResult = {
            first_name: latestApp.first_name,
            middle_name: latestApp.middle_name,
            last_name: latestApp.last_name,
            gender: latestApp.gender,
            marital_status: latestApp.marital_status,
            single_full_name: latestApp.single_full_name,
            date_of_birth: latestApp.date_of_birth,
            birth_place: latestApp.birth_place,
            email: latestApp.email,
            mobile_number: latestApp.mobile_number,
            house_number: latestApp.house_number,
            street_name: latestApp.street_name,
            city: latestApp.city,
            province: latestApp.province,
            country: latestApp.country,
            zipcode: latestApp.zipcode,
            elementary_school: latestApp.elementary_school,
            elementary_city: latestApp.elementary_city,
            elementary_province: latestApp.elementary_province,
            elementary_country: latestApp.elementary_country,
            elementary_years_attended: latestApp.elementary_years_attended,
            elementary_start_date: latestApp.elementary_start_date,
            elementary_end_date: latestApp.elementary_end_date,
            high_school: latestApp.high_school,
            high_school_city: latestApp.high_school_city,
            high_school_province: latestApp.high_school_province,
            high_school_country: latestApp.high_school_country,
            high_school_years_attended: latestApp.high_school_years_attended,
            high_school_start_date: latestApp.high_school_start_date,
            high_school_end_date: latestApp.high_school_end_date,
            nursing_school: latestApp.nursing_school,
            nursing_school_city: latestApp.nursing_school_city,
            nursing_school_province: latestApp.nursing_school_province,
            nursing_school_country: latestApp.nursing_school_country,
            nursing_school_years_attended: latestApp.nursing_school_years_attended,
            nursing_school_start_date: latestApp.nursing_school_start_date,
            nursing_school_end_date: latestApp.nursing_school_end_date,
            nursing_school_major: latestApp.nursing_school_major,
            nursing_school_diploma_date: latestApp.nursing_school_diploma_date,
          }
        }
      }
      
      // Fetch documents
      let documents: any[] = []
      try {
        documents = await userDocumentsAPI.getByUserId(client.id) || []
      } catch {
        // Fallback: direct Supabase query
        const { data, error } = await db
          .from('user_documents')
          .select('*')
          .eq('user_id', client.id)
          .order('uploaded_at', { ascending: false })
        
        if (!error) {
          documents = data || []
        }
      }
      
      if (!detailsResult) {
        // Don't show toast as it might be normal if user hasn't filled details yet
      }
      
      setClientDetails(detailsResult)
      setClientDocuments(documents)
    } catch (error: any) {
      console.error('Error fetching client details:', error)
      showToast('Failed to load client details: ' + (error.message || 'Unknown error'), 'error')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedClient(null)
    setClientDetails(null)
    setClientDocuments([])
  }

  const handleViewDocument = async (filePath: string, _fileName: string) => {
    try {
      const url = await getSignedFileUrl(filePath)
      window.open(url, '_blank')
    } catch (error: any) {
      showToast('Failed to open document', 'error')
    }
  }

  const getDocumentDisplayName = (type: string): string => {
    switch (type) {
      case 'picture':
        return '2x2 Picture'
      case 'diploma':
        return 'Nursing Diploma'
      case 'passport':
        return 'Passport'
      default:
        if (type?.startsWith('mandatory_course_')) {
          const courseName = type.replace('mandatory_course_', '').replace(/_/g, ' ')
          return courseName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') + ' Course'
        }
        return type?.charAt(0).toUpperCase() + type?.slice(1).replace(/_/g, ' ') || 'Document'
    }
  }

  // Format date from database format (YYYY-MM-DD or YYYY-MM) to display format
  const formatDisplayDate = (dateStr: string | null | undefined, isMonthYear: boolean = false): string => {
    if (!dateStr) return 'N/A'
    
    if (isMonthYear) {
      // Format YYYY-MM to "Month YYYY" (e.g., "April 2025")
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        const [year, month] = dateStr.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
      // If already in MM/YYYY format, convert to "Month YYYY"
      if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) {
        const [month, year] = dateStr.split('/')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
      return dateStr
    } else {
      // Format YYYY-MM-DD to MM/DD/YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-')
        return `${month}/${day}/${year}`
      }
      // If already in MM/DD/YYYY format, return as is
      if (/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(dateStr)) {
        return dateStr
      }
      return dateStr
    }
  }

  const roleCounts = useMemo(() => {
    const counts: Record<RoleTab, number> = { client: 0, affiliate: 0, advisor: 0, admin: 0 }
    for (const c of clients) {
      const r = (c.role as RoleTab)
      if (r in counts) counts[r]++
      else counts.client++ // unknown roles bucket under clients
    }
    return counts
  }, [clients])

  const tabClients = useMemo(
    () => clients.filter((c) => (c.role === activeTab) || (activeTab === 'client' && !ROLE_TABS.some(t => t.id === c.role))),
    [clients, activeTab]
  )

  const filteredClients = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return tabClients

    const query = debouncedSearchQuery.toLowerCase()
    return tabClients.filter((client) => {
      const fullName = getFullName(client.first_name, client.last_name).toLowerCase()
      return (
        fullName.includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.id.toLowerCase().includes(query) ||
        (client.grit_id && client.grit_id.toLowerCase().includes(query)) ||
        (client.referral_code && client.referral_code.toLowerCase().includes(query))
      )
    })
  }, [tabClients, debouncedSearchQuery])

  const stats = useMemo(() => {
    return {
      total: clients.length,
      tabTotal: tabClients.length,
      filtered: filteredClients.length,
    }
  }, [clients.length, tabClients.length, filteredClients.length])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, debouncedSearchQuery])

  const paginatedClients = useMemo(() => {
    return paginate(filteredClients, currentPage, pageSize)
  }, [filteredClients, currentPage, pageSize])

  // Stage 1: row buttons just open the validation modal. The actual API call
  // happens after the admin confirms in performDeactivate / performDelete.
  const handleDeactivateClient = (client: Client) => {
    setConfirmInput('')
    setConfirmAction({ type: 'deactivate', client })
  }

  const handleDeleteClient = (client: Client) => {
    setConfirmInput('')
    setConfirmAction({ type: 'delete', client })
  }

  const performDeactivate = async (client: Client) => {
    const isActive = client.is_active !== false
    const action = isActive ? 'deactivate' : 'reactivate'
    setActioningClientId(client.id)
    try {
      const adminToken = localStorage.getItem('gritsync_token')
      const res = await fetch(`/api/auth/admin/users/${client.id}/deactivate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ is_active: !isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to ${action} user`)

      setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: !isActive } : c))
      showToast(`${getFullName(client.first_name, client.last_name)} ${action}d successfully`, 'success')
      setConfirmAction(null)
    } catch (error: any) {
      showToast(error.message || `Failed to ${action} client`, 'error')
    } finally {
      setActioningClientId(null)
    }
  }

  const performDelete = async (client: Client) => {
    const name = getFullName(client.first_name, client.last_name)
    setActioningClientId(client.id)
    try {
      const adminToken = localStorage.getItem('gritsync_token')
      const res = await fetch(`/api/auth/admin/users/${client.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')

      setClients(prev => prev.filter(c => c.id !== client.id))
      showToast(`${name} deleted successfully`, 'success')
      setConfirmAction(null)
    } catch (error: any) {
      showToast(error.message || 'Failed to delete client', 'error')
    } finally {
      setActioningClientId(null)
    }
  }

  const handleExport = () => {
    if (filteredClients.length === 0) {
      showToast('No data to export', 'error')
      return
    }

    setExporting(true)
    try {
      const exportData = filteredClients.map(client => ({
        'First Name': client.first_name || '',
        'Last Name': client.last_name || '',
        'Email': client.email,
        'GRIT ID': client.grit_id || '',
        'User ID': client.id,
        'Role': client.role,
        'Joined Date': formatDate(client.created_at)
      }))

      exportToCSV(exportData, 'clients')
      showToast('Clients exported successfully', 'success')
    } catch (error: any) {
      console.error('Error exporting clients:', error)
      showToast('Failed to export clients', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = createForm
    if (!form.first_name.trim() || !form.last_name.trim() || !form.personal_email.trim() || !form.mobile.trim() || !form.password) {
      showToast('First name, last name, email, mobile and password are required', 'error')
      return
    }
    if (form.password.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    setCreatingUser(true)
    try {
      const token = localStorage.getItem('gritsync_token')
      const res = await fetch('/api/auth/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role: form.role,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          middle_name: form.middle_name.trim() || undefined,
          personal_email: form.personal_email.trim(),
          mobile: form.mobile.trim(),
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')
      const created = data.user as Client & { gritsync_email?: string | null; personal_email?: string; middle_name?: string | null }
      setClients(prev => prev.some(c => c.id === created.id) ? prev : [created, ...prev])
      setShowCreateModal(false)
      // Surface the brand-new credentials so the admin can copy & deliver them.
      setCreatedCredentials({
        id: created.id,
        first_name: created.first_name,
        last_name: created.last_name,
        middle_name: created.middle_name ?? null,
        personal_email: created.personal_email || form.personal_email.trim(),
        gritsync_email: created.gritsync_email ?? null,
        grit_id: created.grit_id || null,
        mobile: form.mobile.trim(),
        password: form.password,
        role_label: form.role,
      })
      setCreateForm(emptyCreateForm)
      setActiveTab(form.role)
      setSearchQuery('')
      showToast(`${getFullName(created.first_name, created.last_name)} created as ${form.role}`, 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to create user', 'error')
    } finally {
      setCreatingUser(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <Card>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Access denied. Admin privileges required.
                </p>
              </div>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  Users
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage clients, affiliates, advisors and admins
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  onClick={() => openCreateModal(activeTab)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  New {ROLE_SINGULAR[activeTab]}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || filteredClients.length === 0}
                >
                  <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-spin' : ''}`} />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Role tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
              <nav className={cn('-mb-px flex gap-1 overflow-x-auto', entrance && 'anim-stagger')} aria-label="User roles">
                {ROLE_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSearchQuery('') }}
                      className={cn(
                        'group inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                        entrance && 'anim-fade-up',
                        isActive
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {tab.label}
                      <span className={cn(
                        'ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                        isActive ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}>
                        {roleCounts[tab.id]}
                      </span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Search */}
            <Card>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={`Search ${activeTab === 'admin' ? 'admins' : activeTab + 's'} by name, email, ID${activeTab !== 'client' && activeTab !== 'admin' ? ' or referral code' : ''}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Showing {stats.filtered} of {stats.tabTotal} {activeTab === 'admin' ? 'admins' : activeTab + 's'} · {stats.total} users total
              </p>
            </Card>
          </div>

          {tabClients.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">No {activeTab === 'admin' ? 'admins' : activeTab + 's'} yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  {activeTab === 'client'
                    ? 'Clients will appear here once they register'
                    : `Promote a client to ${activeTab} from the Clients tab, or create one directly`}
                </p>
                <Button size="sm" onClick={() => openCreateModal(activeTab)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  New {ROLE_SINGULAR[activeTab]}
                </Button>
              </div>
            </Card>
          ) : filteredClients.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No {activeTab === 'admin' ? 'admins' : activeTab + 's'} match your search
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* Mobile card list — replaces the table below md. Same data, but
                  laid out vertically so the role dropdown and the three action
                  buttons stop colliding with each other on narrow phones. */}
              <div className={cn('md:hidden space-y-3 mb-4', entrance && 'anim-stagger')}>
                {paginatedClients.data.map((client, index) => {
                  const fullName = getFullName(client.first_name, client.last_name, 'No name')
                  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  const rowNumber = (currentPage - 1) * pageSize + index + 1
                  return (
                    <Card key={client.id} className={cn('p-4', entrance && 'anim-fade-up')}>
                      <button
                        onClick={() => handleViewClient(client)}
                        className="flex items-center gap-3 w-full text-left mb-3"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm">
                            {initials}
                          </div>
                          {unreadCounts[client.id] > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white dark:ring-gray-900">
                              {unreadCounts[client.id] > 99 ? '99+' : unreadCounts[client.id]}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{fullName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.gmail_account || client.email}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <span>#{rowNumber}</span>
                            {client.grit_id && <span className="font-mono">{client.grit_id}</span>}
                            <span>{formatDate(client.created_at)}</span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-2 mb-3">
                        <RoleBadge role={client.role} />
                        {(client.role === 'affiliate' || client.role === 'advisor') && (
                          <span className="font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded truncate" title="Referral code">
                            {client.referral_code || 'no code'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          title="Login as this user"
                          aria-label="Login as this user"
                          className="h-11 text-xs whitespace-nowrap bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white border-0 w-full"
                          disabled={actioningClientId === client.id}
                          onClick={async () => {
                            try {
                              showToast('Logging in as user...', 'info')
                              const adminToken = localStorage.getItem('gritsync_token')
                              if (!adminToken) throw new Error('No active session. Please log in again.')
                              const res = await fetch('/api/auth/admin-login-as', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                                body: JSON.stringify({ userId: client.id }),
                              })
                              const data = await res.json()
                              if (!res.ok || !data.access_token) throw new Error(data.error || 'Failed to generate login token')
                              pushCurrentSession()
                              localStorage.setItem('gritsync_token', data.access_token)
                              localStorage.setItem('gritsync_refresh_token', data.refresh_token || '')
                              localStorage.setItem('gritsync_user', JSON.stringify(data.user))
                              showToast(`Logged in as ${data.user?.first_name || 'user'}`, 'success')
                              window.location.href = appUrl('/dashboard')
                            } catch (error: any) {
                              showToast(error.message || 'Failed to login as user', 'error')
                            }
                          }}
                        >
                          <LogIn className="h-4 w-4 min-[360px]:mr-1" />
                          <span className="hidden min-[360px]:inline">Login</span>
                        </Button>
                        <Button
                          size="sm"
                          title={client.is_active !== false ? 'Deactivate account' : 'Reactivate account'}
                          aria-label={client.is_active !== false ? 'Deactivate account' : 'Reactivate account'}
                          disabled={actioningClientId === client.id}
                          className={`h-11 text-xs whitespace-nowrap border-0 w-full ${client.is_active !== false ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400' : 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400'}`}
                          onClick={() => handleDeactivateClient(client)}
                        >
                          <UserX className="h-4 w-4 min-[360px]:mr-1" />
                          <span className="hidden min-[360px]:inline">{client.is_active !== false ? 'Deact.' : 'Activate'}</span>
                        </Button>
                        <Button
                          size="sm"
                          title="Delete account permanently"
                          aria-label="Delete account permanently"
                          disabled={actioningClientId === client.id}
                          className="h-11 text-xs whitespace-nowrap bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 border-0 w-full"
                          onClick={() => handleDeleteClient(client)}
                        >
                          <Trash2 className="h-4 w-4 min-[360px]:mr-1" />
                          <span className="hidden min-[360px]:inline">Delete</span>
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Desktop table — hidden on mobile (use the card list above). */}
              <Card className="hidden md:block">
                <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                  <div className="min-w-full inline-block align-middle">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="hidden sm:table-cell text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 w-12">#</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Name</th>
                          <th className="hidden md:table-cell text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Email</th>
                          <th className="hidden lg:table-cell text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Joined</th>
                          <th className="hidden lg:table-cell text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">GRIT-ID</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Role</th>
                          <th className="text-right py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={cn(entrance && 'anim-stagger')}>
                        {paginatedClients.data.map((client, index) => {
                          const fullName = getFullName(client.first_name, client.last_name, 'No name')
                          const initials = fullName
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                          const rowNumber = (currentPage - 1) * pageSize + index + 1
                          
                          return (
                            <tr
                              key={client.id}
                              className={cn('border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors', entrance && 'anim-fade-up')}
                            >
                              <td className="hidden sm:table-cell py-3 px-2 sm:px-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                {rowNumber}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-sm text-gray-900 dark:text-gray-100">
                                <button
                                  onClick={() => handleViewClient(client)}
                                  className="flex items-center gap-3 w-full text-left hover:text-primary-600 dark:hover:text-primary-400 transition-all cursor-pointer group border border-transparent hover:border-primary-300 dark:hover:border-primary-700 rounded-lg px-2 py-1 -mx-2 -my-1"
                                >
                                  <div className="relative flex-shrink-0">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs sm:text-sm group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                                      {initials}
                                    </div>
                                    {unreadCounts[client.id] > 0 && (
                                      <span
                                        title={`${unreadCounts[client.id]} unread message${unreadCounts[client.id] > 1 ? 's' : ''}`}
                                        className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white dark:ring-gray-900"
                                      >
                                        {unreadCounts[client.id] > 99 ? '99+' : unreadCounts[client.id]}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate">{fullName}</span>
                                    {/* On mobile, surface email + GRIT-ID under the name since
                                        their dedicated columns are hidden below md. */}
                                    <span className="md:hidden block text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {client.gmail_account || client.email}
                                    </span>
                                    {client.grit_id && (
                                      <span className="lg:hidden block text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">
                                        {client.grit_id}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </td>
                              <td className="hidden md:table-cell py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="truncate max-w-[180px] xl:max-w-none">{client.gmail_account || client.email}</div>
                              </td>
                              <td className="hidden lg:table-cell py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatDate(client.created_at)}
                              </td>
                              <td className="hidden lg:table-cell py-3 px-2 sm:px-4 text-sm">
                                {client.grit_id ? (
                                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {client.grit_id}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-sm">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <RoleBadge role={client.role} />
                                  </div>
                                  {(client.role === 'affiliate' || client.role === 'advisor') && (
                                    <span className="self-start font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded" title="Referral code">
                                      {client.referral_code || 'no code'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Login as user */}
                                  <Button 
                                    size="sm"
                                    title="Login as this user"
                                    className="text-xs whitespace-nowrap bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white border-0"
                                    disabled={actioningClientId === client.id}
                                    onClick={async () => {
                                      try {
                                        showToast('Logging in as user...', 'info')
                                        const adminToken = localStorage.getItem('gritsync_token')
                                        if (!adminToken) throw new Error('No active session. Please log in again.')
                                        const res = await fetch('/api/auth/admin-login-as', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                                          body: JSON.stringify({ userId: client.id }),
                                        })
                                        const data = await res.json()
                                        if (!res.ok || !data.access_token) throw new Error(data.error || 'Failed to generate login token')
                                        pushCurrentSession()
                                        localStorage.setItem('gritsync_token', data.access_token)
                                        localStorage.setItem('gritsync_refresh_token', data.refresh_token || '')
                                        localStorage.setItem('gritsync_user', JSON.stringify(data.user))
                                        showToast(`Logged in as ${data.user?.first_name || 'user'}`, 'success')
                                        window.location.href = appUrl('/dashboard')
                                      } catch (error: any) {
                                        showToast(error.message || 'Failed to login as user', 'error')
                                      }
                                    }}
                                  >
                                    Login
                                  </Button>
                                  {/* Deactivate / Reactivate */}
                                  <Button
                                    size="sm"
                                    title={client.is_active !== false ? 'Deactivate account' : 'Reactivate account'}
                                    disabled={actioningClientId === client.id}
                                    className={`text-xs whitespace-nowrap border-0 ${client.is_active !== false ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400' : 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400'}`}
                                    onClick={() => handleDeactivateClient(client)}
                                  >
                                    <UserX className="h-3.5 w-3.5 sm:mr-1" />
                                    <span className="hidden sm:inline">{client.is_active !== false ? 'Deactivate' : 'Activate'}</span>
                                  </Button>
                                  {/* Delete */}
                                  <Button
                                    size="sm"
                                    title="Delete account permanently"
                                    disabled={actioningClientId === client.id}
                                    className="text-xs whitespace-nowrap bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 border-0"
                                    onClick={() => handleDeleteClient(client)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                                    <span className="hidden sm:inline">Delete</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              {/* Pagination — stacks on mobile so the "Showing X to Y" line
                  doesn't crowd the prev/next buttons on a 360 px screen. */}
              {paginatedClients.totalPages > 1 && (
                <Card className="mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, paginatedClients.totalItems)} of {paginatedClients.totalItems} clients
                    </div>
                    <div className="flex items-center justify-center sm:justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!paginatedClients.hasPreviousPage}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="text-sm text-gray-600 dark:text-gray-400 px-3 whitespace-nowrap">
                        Page {currentPage} of {paginatedClients.totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(paginatedClients.totalPages, prev + 1))}
                        disabled={!paginatedClients.hasNextPage}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </main>
      </div>

      {/* Deactivate / Reactivate / Delete confirmation */}
      {(() => {
        if (!confirmAction) return null
        const { type, client } = confirmAction
        const name = getFullName(client.first_name, client.last_name) || client.email
        const isActive = client.is_active !== false
        const isDelete = type === 'delete'
        const action = isDelete ? 'Delete' : (isActive ? 'Deactivate' : 'Reactivate')
        const busy = actioningClientId === client.id
        const requiredText = client.email || ''
        const canConfirm = isDelete
          ? !busy && requiredText.length > 0 && confirmInput.trim().toLowerCase() === requiredText.trim().toLowerCase()
          : !busy
        const onConfirm = () => {
          if (isDelete) performDelete(client)
          else performDeactivate(client)
        }
        return (
          <Modal
            isOpen
            onClose={() => { if (!busy) { setConfirmAction(null); setConfirmInput('') } }}
            title={`${action} user`}
            size="sm"
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${isDelete ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {isDelete ? (
                      <>
                        Permanently delete <span className="font-semibold">{name}</span>?
                      </>
                    ) : isActive ? (
                      <>
                        Deactivate <span className="font-semibold">{name}</span>?
                      </>
                    ) : (
                      <>
                        Reactivate <span className="font-semibold">{name}</span>?
                      </>
                    )}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                    {isDelete
                      ? 'This removes the account and all associated data. This action cannot be undone.'
                      : isActive
                        ? 'The user will be signed out and blocked from logging in until reactivated.'
                        : 'The user will be able to sign in again.'}
                  </p>
                </div>
              </div>

              {isDelete && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type <span className="font-mono text-red-600 dark:text-red-400">{requiredText}</span> to confirm.
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={requiredText}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setConfirmAction(null); setConfirmInput('') }}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={onConfirm}
                  disabled={!canConfirm}
                  className={isDelete
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : (isActive
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white')}
                >
                  {busy ? `${action.replace(/e$/, '')}ing…` : action}
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Create user modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { if (!creatingUser) setShowCreateModal(false) }}
        title={`Create ${ROLE_SINGULAR[createForm.role]}`}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleCreateUser}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as RoleTab }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="client">Client</option>
              <option value="affiliate">Affiliate</option>
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
            {(createForm.role === 'affiliate' || createForm.role === 'advisor') && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">A referral code is generated automatically once the account is created.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={createForm.first_name} onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Juan" />
            <Input label="Last Name" value={createForm.last_name} onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Dela Cruz" />
          </div>
          <Input label="Middle Name (optional)" value={createForm.middle_name} onChange={(e) => setCreateForm((f) => ({ ...f, middle_name: e.target.value }))} />
          <Input label="Personal Email" type="email" value={createForm.personal_email} onChange={(e) => setCreateForm((f) => ({ ...f, personal_email: e.target.value }))} placeholder="name@example.com" />
          <Input label="Mobile Number" value={createForm.mobile} onChange={(e) => setCreateForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="+63..." />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => setShowCreatePassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={showCreatePassword ? 'Hide' : 'Show'}>
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateForm((f) => ({ ...f, password: generatePassword(14) }))} title="Generate a strong password">
                <RefreshCcw className="h-4 w-4 mr-2" /> Generate
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              A strong 14-character password is pre-filled. You'll be able to copy & share it after the account is created — it's only shown once.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)} disabled={creatingUser}>Cancel</Button>
            <Button type="submit" size="sm" disabled={creatingUser}>
              <UserPlus className={`h-4 w-4 mr-2 ${creatingUser ? 'animate-pulse' : ''}`} />
              {creatingUser ? 'Creating…' : `Create ${ROLE_SINGULAR[createForm.role]}`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Client Details Modal — single source of truth is `user_details`.
          /app/my-details and /app/application/new both upsert to that
          table, so what shows here is what the user sees in their own
          profile (and vice versa). */}
      <Modal
        isOpen={!!selectedClient}
        onClose={handleCloseModal}
        title=""
        size="xl"
      >
        {(() => {
          const c = selectedClient
          // Prefer the canonical name from `users`; fall back to user_details.
          const fullName = c
            ? getFullName(c.first_name || clientDetails?.first_name, c.last_name || clientDetails?.last_name)
            : ''
          const initials = fullName
            ? fullName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
            : '?'
          const memberSince = c ? formatDate(c.created_at) : ''
          const emailDisplay = clientDetails?.email || c?.email || 'No email'
          const mobileDisplay = clientDetails?.mobile_number || 'No mobile'
          const fmtAddress = [
            clientDetails?.house_number,
            clientDetails?.street_name,
            clientDetails?.city,
            clientDetails?.province,
            clientDetails?.country,
            clientDetails?.zipcode,
          ].filter(Boolean).join(', ')

          if (loadingDetails) {
            return (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile…</p>
              </div>
            )
          }

          return (
            <div className="-m-3 sm:-m-4 md:-m-6 max-h-[85vh] overflow-y-auto">
              {/* ───────── Hero header ───────── */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-violet-700 dark:from-primary-700 dark:via-primary-800 dark:to-violet-900" />
                <div
                  className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, white 0%, transparent 35%), radial-gradient(circle at 80% 100%, white 0%, transparent 35%)' }}
                />
                <div className="relative p-6 sm:p-8 text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white/15 backdrop-blur ring-2 ring-white/30 flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-lg">
                        {initials}
                      </div>
                    </div>
                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl sm:text-3xl font-bold truncate">{fullName || 'Unnamed user'}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {c && (
                          <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-white/30">
                            {c.role}
                          </span>
                        )}
                        {c?.grit_id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur px-2.5 py-0.5 text-[11px] font-mono ring-1 ring-white/20">
                            <Shield className="h-3 w-3" /> {c.grit_id}
                          </span>
                        )}
                        {c && (c.role === 'affiliate' || c.role === 'advisor') && c.referral_code && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur px-2.5 py-0.5 text-[11px] font-mono ring-1 ring-white/20">
                            <Link2 className="h-3 w-3" /> {c.referral_code}
                          </span>
                        )}
                        {c?.is_active === false && (
                          <span className="inline-flex items-center rounded-full bg-red-500/30 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-red-300/40">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/90">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-4 w-4 flex-shrink-0 text-white/70" />
                          <span className="truncate">{emailDisplay}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="h-4 w-4 flex-shrink-0 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                          </svg>
                          <span className="truncate">{mobileDisplay}</span>
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-row sm:flex-col gap-2 sm:items-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!c) return
                          handleCloseModal()
                          navigate('/messages', { state: { userId: c.id } })
                        }}
                        className="bg-white text-primary-700 hover:bg-white/90 border-0 shadow-md flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Message
                      </Button>
                      <button
                        onClick={handleCloseModal}
                        className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors sm:order-first"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stat strip */}
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Member since</div>
                      <div className="mt-0.5 text-sm font-semibold truncate">{memberSince}</div>
                    </div>
                    <div className="rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Documents</div>
                      <div className="mt-0.5 text-sm font-semibold">{clientDocuments.length}</div>
                    </div>
                    <div className="rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Status</div>
                      <div className="mt-0.5 text-sm font-semibold">{c?.is_active === false ? 'Inactive' : 'Active'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ───────── Body ───────── */}
              <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/40 space-y-4">
                {/* Account access — change role / manage permissions.
                    Moved here from the user-list Role column on 2026-05-15 so
                    the table row stops being so dense and role changes
                    require an intentional "open profile → change" instead
                    of a one-click misclick from the list view. */}
                {c && (
                  <div className="rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account access</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Change the user's role to grant or revoke permissions.</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 sm:w-24">Current role</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <RoleBadge role={c.role} />
                        <select
                          value={c.role}
                          disabled={actioningClientId === c.id}
                          onChange={(e) => handleChangeRole(c, e.target.value as RoleTab)}
                          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          title="Change role"
                        >
                          <option value="client">Client</option>
                          <option value="affiliate">Affiliate</option>
                          <option value="advisor">Advisor</option>
                          <option value="admin">Admin</option>
                        </select>
                        {actioningClientId === c.id && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Saving…</span>
                        )}
                      </div>
                    </div>
                    {(c.role === 'affiliate' || c.role === 'advisor') && c.referral_code && (
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Referral code: <span className="font-mono text-gray-700 dark:text-gray-300">{c.referral_code}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Personal Information */}
                <ProfileSection
                  icon={User}
                  title="Personal Information"
                  accent="from-sky-500 to-blue-600"
                  fields={[
                    { label: 'First name', value: c?.first_name || clientDetails?.first_name },
                    { label: 'Middle name', value: clientDetails?.middle_name },
                    { label: 'Last name', value: c?.last_name || clientDetails?.last_name },
                    { label: 'Gender', value: clientDetails?.gender, capitalize: true },
                    { label: 'Marital status', value: clientDetails?.marital_status, capitalize: true },
                    { label: 'Single full name', value: clientDetails?.single_full_name || clientDetails?.single_name },
                    { label: 'Date of birth', value: formatDisplayDate(clientDetails?.date_of_birth) },
                    { label: 'Birth place', value: clientDetails?.birth_place || clientDetails?.place_of_birth },
                  ]}
                />

                {/* Address */}
                <ProfileSection
                  icon={MapPin}
                  title="Address"
                  accent="from-emerald-500 to-green-600"
                  summary={fmtAddress || undefined}
                  fields={[
                    { label: 'House number', value: clientDetails?.house_number },
                    { label: 'Barangay / Street', value: clientDetails?.street_name },
                    { label: 'City / Municipality', value: clientDetails?.city },
                    { label: 'Province', value: clientDetails?.province },
                    { label: 'Country', value: clientDetails?.country },
                    { label: 'Zipcode', value: clientDetails?.zipcode },
                  ]}
                />

                {/* Elementary School */}
                <ProfileSection
                  icon={School}
                  title="Elementary School"
                  accent="from-amber-500 to-orange-600"
                  summary={clientDetails?.elementary_school || undefined}
                  fields={[
                    { label: 'School name', value: clientDetails?.elementary_school },
                    { label: 'City', value: clientDetails?.elementary_city },
                    { label: 'Province', value: clientDetails?.elementary_province },
                    { label: 'Country', value: clientDetails?.elementary_country },
                    { label: 'Years attended', value: clientDetails?.elementary_years_attended },
                    { label: 'Start date', value: formatDisplayDate(clientDetails?.elementary_start_date, true) },
                    { label: 'End date', value: formatDisplayDate(clientDetails?.elementary_end_date, true) },
                  ]}
                />

                {/* High School */}
                <ProfileSection
                  icon={School}
                  title="High School"
                  accent="from-rose-500 to-pink-600"
                  summary={clientDetails?.high_school || undefined}
                  fields={[
                    { label: 'School name', value: clientDetails?.high_school },
                    { label: 'City', value: clientDetails?.high_school_city },
                    { label: 'Province', value: clientDetails?.high_school_province },
                    { label: 'Country', value: clientDetails?.high_school_country },
                    { label: 'Years attended', value: clientDetails?.high_school_years_attended },
                    { label: 'Start date', value: formatDisplayDate(clientDetails?.high_school_start_date, true) },
                    { label: 'End date', value: formatDisplayDate(clientDetails?.high_school_end_date, true) },
                  ]}
                />

                {/* Nursing School */}
                <ProfileSection
                  icon={Award}
                  title="Nursing School"
                  accent="from-violet-500 to-purple-600"
                  summary={clientDetails?.nursing_school || undefined}
                  fields={[
                    { label: 'School name', value: clientDetails?.nursing_school },
                    { label: 'City', value: clientDetails?.nursing_school_city },
                    { label: 'Province', value: clientDetails?.nursing_school_province },
                    { label: 'Country', value: clientDetails?.nursing_school_country },
                    { label: 'Years attended', value: clientDetails?.nursing_school_years_attended },
                    { label: 'Start date', value: formatDisplayDate(clientDetails?.nursing_school_start_date, true) },
                    { label: 'End date', value: formatDisplayDate(clientDetails?.nursing_school_end_date, true) },
                    { label: 'Major / Field', value: clientDetails?.nursing_school_major },
                    { label: 'Diploma date', value: formatDisplayDate(clientDetails?.nursing_school_diploma_date) },
                  ]}
                />

                {/* Documents */}
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Documents</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{clientDocuments.length} uploaded</p>
                    </div>
                  </div>
                  <div className="p-4">
                    {clientDocuments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                          <FileText className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {clientDocuments.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all"
                          >
                            <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {getDocumentDisplayName(doc.document_type)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {formatDate(doc.uploaded_at)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDocument(doc.file_path, doc.file_name)}
                              className="opacity-70 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Credentials modal — shown after a successful create with the temp password */}
      <CredentialsModal
        credentials={createdCredentials}
        onClose={() => setCreatedCredentials(null)}
      />
    </div>
  )
}
