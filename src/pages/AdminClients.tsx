import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CardSkeleton } from '@/components/ui/Loading'
import { clientsAPI } from '@/lib/api'
import { formatDate, getFullName, exportToCSV, paginate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// Generate Gmail address function (same as in supabase-api.ts)
function generateGmailAddress(firstName: string, middleName: string | null, lastName: string): string {
  const firstInitial = (firstName || '').trim().charAt(0).toLowerCase()
  const lastNameParts = (lastName || '').trim().split(/\s+/).filter(part => part.trim())
  
  if (lastNameParts.length === 0) {
    return `${firstInitial}usrn@gmail.com`
  }
  
  let email: string
  if (lastNameParts.length > 1) {
    const firstPartInitial = lastNameParts[0].charAt(0).toLowerCase()
    const lastPart = lastNameParts[lastNameParts.length - 1].toLowerCase()
    email = `${firstInitial}${firstPartInitial}${lastPart}usrn@gmail.com`
  } else {
    const middleInitial = (middleName || '').trim().charAt(0).toLowerCase()
    const lastPart = lastNameParts[0].toLowerCase()
    const fallbackInitial = lastPart.charAt(0).toLowerCase()
    const initialToUse = middleInitial || fallbackInitial
    email = `${firstInitial}${initialToUse}${lastPart}usrn@gmail.com`
  }
  
  return email
}
import { Users, Search, Mail, Calendar, RefreshCw, Download, ChevronLeft, ChevronRight, FileText, Eye, Download as DownloadIcon, User, MapPin, Award, School } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { subscribeToAllClients, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Modal } from '@/components/ui/Modal'
import { userDetailsAPI, userDocumentsAPI, getSignedFileUrl } from '@/lib/api'

interface Client {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  role: string
  created_at: string
  grit_id: string
  gmail_account?: string
}

export function AdminClients() {
  const { isAdmin, signIn } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [exporting, setExporting] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [clientDocuments, setClientDocuments] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    if (isAdmin()) {
      fetchClients()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

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

      if (eventType === 'INSERT' && newRecord && newRecord.role === 'client') {
        // New client registered - add to list
        setClients((prev) => [newRecord, ...prev])
        showToast('New client registered', 'info')
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
      const data = await clientsAPI.getAll()
      const clientsData = (data as unknown as Client[]) || []
      
      // Fetch Gmail accounts for each client
      const clientsWithGmail = await Promise.all(
        clientsData.map(async (client) => {
          try {
            // Get the most recent application for this client
            const { data: applications } = await supabase
              .from('applications')
              .select('id, first_name, middle_name, last_name')
              .eq('user_id', client.id)
              .order('created_at', { ascending: false })
              .limit(1)
            
            if (applications && applications.length > 0) {
              const app = applications[0]
              // Try to get existing Gmail account from processing_accounts
              const { data: gmailAccounts } = await supabase
                .from('processing_accounts')
                .select('email')
                .eq('application_id', app.id)
                .eq('account_type', 'gmail')
                .limit(1)
              
              if (gmailAccounts && gmailAccounts.length > 0) {
                return { ...client, gmail_account: gmailAccounts[0].email }
              } else {
                // Generate Gmail address if not found
                const firstName = app.first_name || client.first_name || ''
                const middleName = app.middle_name || null
                const lastName = app.last_name || client.last_name || ''
                if (firstName && lastName) {
                  const gmailAddress = generateGmailAddress(firstName, middleName, lastName)
                  return { ...client, gmail_account: gmailAddress }
                }
              }
            }
            return { ...client, gmail_account: client.email }
          } catch (error) {
            console.error(`Error fetching Gmail for client ${client.id}:`, error)
            return { ...client, gmail_account: client.email }
          }
        })
      )
      
      setClients(clientsWithGmail)
      setCurrentPage(1)
    } catch (error: any) {
      console.error('Error fetching clients:', error)
      showToast(error?.message || 'Failed to load clients', 'error')
      setClients([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchClients()
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
        const { data, error } = await supabase
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
        const { data: allRows } = await supabase
          .from('user_details')
          .select('*')
          .eq('user_id', client.id)
        
        if (allRows && allRows.length > 0) {
          detailsResult = allRows[0]
        }
      }
      
      // If still no data, try fetching from latest application as fallback
      if (!detailsResult) {
        const { data: applications } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (applications && applications.length > 0) {
          const latestApp = applications[0]
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
        const { data, error } = await supabase
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

  const handleViewDocument = async (filePath: string, fileName: string) => {
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

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients

    const query = searchQuery.toLowerCase()
    return clients.filter((client) => {
      const fullName = getFullName(client.first_name, client.last_name).toLowerCase()
      return (
        fullName.includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.id.toLowerCase().includes(query) ||
        (client.grit_id && client.grit_id.toLowerCase().includes(query))
      )
    })
  }, [clients, searchQuery])

  const stats = useMemo(() => {
    return {
      total: clients.length,
      filtered: filteredClients.length,
    }
  }, [clients.length, filteredClients.length])

  const paginatedClients = useMemo(() => {
    return paginate(filteredClients, currentPage, pageSize)
  }, [filteredClients, currentPage, pageSize])

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
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  Clients
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage and view all registered clients
                </p>
              </div>
              <div className="flex gap-2">
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

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Clients</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                    <Users className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Showing</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.filtered}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Search */}
            <Card className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </Card>
          </div>

          {clients.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">No clients found</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Clients will appear here once they register
                </p>
              </div>
            </Card>
          ) : filteredClients.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No clients match your search
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
              <Card>
                <div className="overflow-x-auto -mx-6 px-6">
                  <div className="min-w-full inline-block align-middle">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 w-12">#</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">Name</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[180px]">Email</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[100px]">Joined</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[100px]">GRIT-ID</th>
                          <th className="text-right py-3 px-2 sm:px-4 text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
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
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                              <td className="py-3 px-2 sm:px-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                {rowNumber}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-sm text-gray-900 dark:text-gray-100">
                                <button
                                  onClick={() => handleViewClient(client)}
                                  className="flex items-center gap-3 w-full text-left hover:text-primary-600 dark:hover:text-primary-400 transition-all cursor-pointer group border border-transparent hover:border-primary-300 dark:hover:border-primary-700 rounded-lg px-2 py-1 -mx-2 -my-1"
                                >
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs sm:text-sm flex-shrink-0 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                                    {initials}
                                  </div>
                                  <span className="truncate max-w-[120px] sm:max-w-none">
                                    {fullName}
                                  </span>
                                </button>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="truncate max-w-[180px] sm:max-w-none">{client.gmail_account || client.email}</div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatDate(client.created_at)}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-sm">
                                {client.grit_id ? (
                                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {client.grit_id}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-right">
                                <Button 
                                  size="sm"
                                  className="text-xs sm:text-sm whitespace-nowrap bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white border-0"
                                  onClick={async () => {
                                    try {
                                      showToast('Logging in as user...', 'info')
                                      
                                      // Get current session and token
                                      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
                                      
                                      if (sessionError || !session?.access_token) {
                                        throw new Error('No active session. Please log in again.')
                                      }
                                      
                                      // Call server endpoint to generate login link
                                      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
                                      // Ensure we don't double up on /api
                                      let baseUrl = API_URL
                                      if (baseUrl.endsWith('/api')) {
                                        baseUrl = baseUrl.slice(0, -4)
                                      }
                                      const response = await fetch(`${baseUrl}/api/clients/${client.id}/login-as`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${session.access_token}`
                                        }
                                      })

                                      if (!response.ok) {
                                        const error = await response.json()
                                        throw new Error(error.error || 'Failed to generate login link')
                                      }

                                      const data = await response.json()
                                      
                                      if (data.loginUrl) {
                                        // Store admin session to restore later
                                        const { data: { session: adminSession } } = await supabase.auth.getSession()
                                        if (adminSession) {
                                          localStorage.setItem('admin_session_backup', JSON.stringify({
                                            access_token: adminSession.access_token,
                                            refresh_token: adminSession.refresh_token,
                                            expires_at: adminSession.expires_at
                                          }))
                                        }
                                        
                                        // Redirect to the magic link
                                        window.location.href = data.loginUrl
                                      } else if (data.email) {
                                        // Fallback: show email for manual login
                                        showToast(`Please login manually with: ${data.email}`, 'info')
                                      } else {
                                        throw new Error('No login method available')
                                      }
                                    } catch (error: any) {
                                      console.error('Error logging in as user:', error)
                                      showToast(error.message || 'Failed to login as user', 'error')
                                    }
                                  }}
                                >
                                  Login
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              {/* Pagination */}
              {paginatedClients.totalPages > 1 && (
                <Card className="mt-6">
                  <div className="flex items-center justify-between p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, paginatedClients.totalItems)} of {paginatedClients.totalItems} clients
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!paginatedClients.hasPreviousPage}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="text-sm text-gray-600 dark:text-gray-400 px-3">
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

      {/* Client Details Modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={handleCloseModal}
        title={selectedClient ? getFullName(selectedClient.first_name, selectedClient.last_name) : ''}
        size="xl"
      >
        {loadingDetails ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Personal Information */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.first_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Middle Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.middle_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.last_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Gender</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.gender || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Marital Status</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.marital_status || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Single Full Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.single_full_name || clientDetails?.single_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Date of Birth</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.date_of_birth) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Birth Place</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.birth_place || clientDetails?.place_of_birth || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Contact Information */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.email || selectedClient?.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile Number</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.mobile_number || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Address */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">House Number & Street Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.house_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Barangay</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.street_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City / Municipality Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.city || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.province || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.country || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Zipcode</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.zipcode || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Education - Elementary School */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <School className="h-5 w-5" />
                Elementary School
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">School Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.elementary_school || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.elementary_city || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.elementary_province || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.elementary_country || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Years Attended</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.elementary_years_attended || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.elementary_start_date, true) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.elementary_end_date, true) || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Education - High School */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <School className="h-5 w-5" />
                High School
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">School Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.high_school || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.high_school_city || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.high_school_province || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.high_school_country || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Years Attended</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.high_school_years_attended || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.high_school_start_date, true) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.high_school_end_date, true) || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Education - Nursing School */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Award className="h-5 w-5" />
                Nursing School
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">School Name</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.nursing_school || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.nursing_school_city || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.nursing_school_province || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.nursing_school_country || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Years Attended</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.nursing_school_years_attended || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.nursing_school_start_date, true) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.nursing_school_end_date, true) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Major/Field of Study</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{clientDetails?.nursing_school_major || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Diploma Date</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatDisplayDate(clientDetails?.nursing_school_diploma_date) || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Documents */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </h3>
              {clientDocuments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded</p>
              ) : (
                <div className="space-y-2">
                  {clientDocuments.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {getDocumentDisplayName(doc.document_type)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.file_name} • {formatDate(doc.uploaded_at)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDocument(doc.file_path, doc.file_name)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  )
}
