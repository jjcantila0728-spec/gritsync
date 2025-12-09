import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { CardSkeleton } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { SEO } from '@/components/SEO'
import { FileText, ClipboardList, DollarSign, CheckCircle, ArrowRight, TrendingUp, Clock, Activity, Users, AlertCircle, XCircle, Settings, BarChart3, Zap, FileCheck, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { dashboardAPI, applicationsAPI, quotationsAPI, userDetailsAPI, userDocumentsAPI, applicationPaymentsAPI, timelineStepsAPI } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getSignedFileUrl } from '@/lib/supabase-api'
import { formatDate, formatCurrency, cn, debounce } from '@/lib/utils'
import { subscribeToUserApplications, subscribeToAllApplications, subscribeToQuotations, subscribeToAllQuotations, subscribeToPendingApprovalPayments, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { greetingSettings } from '@/lib/settings'

interface RecentActivity {
  id: string
  type: 'application' | 'quotation'
  title: string
  status: string
  date: string
  link: string
  service_type?: string
  grit_app_id?: string
}

interface PendingItem {
  id: string
  type: 'application' | 'quotation'
  title: string
  status: string
  date: string
  link: string
  priority?: 'high' | 'medium' | 'low'
  service_type?: string
  grit_app_id?: string
}

export function Dashboard() {
  const { user, isAdmin } = useAuth()
  const [stats, setStats] = useState({
    applications: 0,
    pending: 0,
    completed: 0,
    quotations: 0,
    totalClients: 0,
    revenue: 0,
    pendingApplications: 0,
    pendingQuotations: 0,
    completedApplications: 0,
    rejectedApplications: 0,
    paidQuotations: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Load firstName from cache on mount
  const getCachedFirstName = (userId: string | undefined): string | null => {
    if (!userId) return null
    try {
      const cached = localStorage.getItem(`firstName_${userId}`)
      if (cached) {
        return cached
      }
    } catch {
      // Ignore errors
    }
    return null
  }

  const [firstName, setFirstName] = useState<string | null>(() => {
    // Initialize from cache if available
    return getCachedFirstName(user?.id)
  })
  const [profileCompletion, setProfileCompletion] = useState(0)
  const [documentsStatus, setDocumentsStatus] = useState({
    picture: false,
    diploma: false,
    passport: false,
  })
  const { showToast } = useToast()
  const channelsRef = useRef<RealtimeChannel[]>([])

  // Helper to set firstName and cache it
  const setFirstNameWithCache = (name: string | null, userId: string | undefined) => {
    setFirstName(name)
    if (userId && name) {
      try {
        localStorage.setItem(`firstName_${userId}`, name)
      } catch {
        // Ignore errors
      }
    }
  }

  // Helper function to calculate completion percentage (same as MyDetails)
  const calculateCompletion = (details: any): number => {
    const personalInfoFields = [
      'firstName', 'lastName', 'gender', 'dateOfBirth', 'birthPlace'
    ]
    const addressFields = [
      'email', 'mobileNumber', 'houseNumber', 'streetName', 'city', 'province', 'country', 'zipcode'
    ]
    const elementaryFields = [
      'elementarySchool', 'elementaryCity', 'elementaryProvince', 'elementaryCountry',
      'elementaryYearsAttended', 'elementaryStartDate', 'elementaryEndDate'
    ]
    const highSchoolFields = [
      'highSchool', 'highSchoolCity', 'highSchoolProvince', 'highSchoolCountry',
      'highSchoolYearsAttended', 'highSchoolStartDate', 'highSchoolEndDate'
    ]
    const nursingSchoolFields = [
      'nursingSchool', 'nursingSchoolCity', 'nursingSchoolProvince', 'nursingSchoolCountry',
      'nursingSchoolYearsAttended', 'nursingSchoolStartDate', 'nursingSchoolEndDate',
      'nursingSchoolMajor', 'nursingSchoolDiplomaDate'
    ]
    const allFields = [
      ...personalInfoFields,
      ...addressFields,
      ...elementaryFields,
      ...highSchoolFields,
      ...nursingSchoolFields
    ]
    let completed = 0
    allFields.forEach(field => {
      const value = details[field]
      if (value && value.trim() !== '') {
        completed++
      }
    })
    return Math.round((completed / allFields.length) * 100)
  }

  useEffect(() => {
    if (user) {
      // Set firstName immediately from cache, user object, or email to prevent flickering during navigation
      const cachedName = getCachedFirstName(user.id)
      if (cachedName) {
        setFirstName(cachedName)
      } else if (user.first_name) {
        setFirstNameWithCache(user.first_name, user.id)
      } else if (user.email) {
        // Fallback to email prefix if first_name not available
        const emailName = user.email.split('@')[0]
        setFirstNameWithCache(emailName, user.id)
      }
      
      fetchData()
      // Fetch first name and profile completion from user details
      userDetailsAPI.get()
        .then((details) => {
          const typedDetails = details as {
            first_name?: string
            last_name?: string
            gender?: string
            date_of_birth?: string
            birth_place?: string
            place_of_birth?: string
            email?: string
            mobile_number?: string
            house_number?: string
            street_name?: string
            city?: string
            province?: string
            country?: string
            zipcode?: string
            elementary_school?: string
            elementary_city?: string
            elementary_province?: string
            elementary_country?: string
            elementary_years_attended?: string
            elementary_start_date?: string
            elementary_end_date?: string
            high_school?: string
            high_school_city?: string
            high_school_province?: string
            high_school_country?: string
            high_school_years_attended?: string
            high_school_start_date?: string
            high_school_end_date?: string
            nursing_school?: string
            nursing_school_city?: string
            nursing_school_province?: string
            nursing_school_country?: string
            nursing_school_years_attended?: string
            nursing_school_start_date?: string
            nursing_school_end_date?: string
            nursing_school_major?: string
            nursing_school_diploma_date?: string
          } | null
          if (typedDetails?.first_name) {
            setFirstNameWithCache(typedDetails.first_name, user.id)
          } else {
            const nameParts = user.first_name ? [user.first_name] : []
            const fallbackName = nameParts[0] || user.email.split('@')[0]
            setFirstNameWithCache(fallbackName, user.id)
          }
          
          // Calculate profile completion
          if (typedDetails) {
            const completion = calculateCompletion({
              firstName: typedDetails.first_name,
              lastName: typedDetails.last_name,
              gender: typedDetails.gender,
              dateOfBirth: typedDetails.date_of_birth,
              birthPlace: typedDetails.birth_place || typedDetails.place_of_birth,
              email: typedDetails.email || user?.email,
              mobileNumber: typedDetails.mobile_number,
              houseNumber: typedDetails.house_number,
              streetName: typedDetails.street_name,
              city: typedDetails.city,
              province: typedDetails.province,
              country: typedDetails.country,
              zipcode: typedDetails.zipcode,
              elementarySchool: typedDetails.elementary_school,
              elementaryCity: typedDetails.elementary_city,
              elementaryProvince: typedDetails.elementary_province,
              elementaryCountry: typedDetails.elementary_country,
              elementaryYearsAttended: typedDetails.elementary_years_attended,
              elementaryStartDate: typedDetails.elementary_start_date,
              elementaryEndDate: typedDetails.elementary_end_date,
              highSchool: typedDetails.high_school,
              highSchoolCity: typedDetails.high_school_city,
              highSchoolProvince: typedDetails.high_school_province,
              highSchoolCountry: typedDetails.high_school_country,
              highSchoolYearsAttended: typedDetails.high_school_years_attended,
              highSchoolStartDate: typedDetails.high_school_start_date,
              highSchoolEndDate: typedDetails.high_school_end_date,
              nursingSchool: typedDetails.nursing_school,
              nursingSchoolCity: typedDetails.nursing_school_city,
              nursingSchoolProvince: typedDetails.nursing_school_province,
              nursingSchoolCountry: typedDetails.nursing_school_country,
              nursingSchoolYearsAttended: typedDetails.nursing_school_years_attended,
              nursingSchoolStartDate: typedDetails.nursing_school_start_date,
              nursingSchoolEndDate: typedDetails.nursing_school_end_date,
              nursingSchoolMajor: typedDetails.nursing_school_major,
              nursingSchoolDiplomaDate: typedDetails.nursing_school_diploma_date
            })
            setProfileCompletion(completion)
          }
        })
        .catch(() => {
          // Keep cached name or use fallback
          const cachedName = getCachedFirstName(user.id)
          if (!cachedName) {
            const nameParts = user.first_name ? [user.first_name] : []
            const fallbackName = nameParts[0] || user.email.split('@')[0]
            setFirstNameWithCache(fallbackName, user.id)
          }
        })
      
      // Fetch documents status
      if (!isAdmin()) {
        userDocumentsAPI.getAll()
          .then((docs) => {
            const docsMap = new Map((docs || []).map((doc: any) => [doc.document_type, doc]))
            setDocumentsStatus({
              picture: !!docsMap.get('picture'),
              diploma: !!docsMap.get('diploma'),
              passport: !!docsMap.get('passport'),
            })
          })
          .catch(() => {
            // Ignore errors
          })
      }
    } else {
      setLoading(false)
    }
  }, [user])

  // Set up real-time subscriptions for application status changes
  useEffect(() => {
    if (!user) return

    const channels: RealtimeChannel[] = []

    // Subscribe to applications
    if (isAdmin()) {
      // Admin: subscribe to all applications
      const appsChannel = subscribeToAllApplications((payload) => {
        handleApplicationUpdate(payload)
      })
      channels.push(appsChannel)
    } else {
      // Client: subscribe to user's applications
      const appsChannel = subscribeToUserApplications(user.id, (payload) => {
        handleApplicationUpdate(payload)
      })
      channels.push(appsChannel)
    }

    // Subscribe to quotations
    if (isAdmin()) {
      // Admin: subscribe to all quotations
      const quotesChannel = subscribeToAllQuotations((payload) => {
        handleQuotationUpdate(payload)
      })
      channels.push(quotesChannel)

      // Admin: subscribe to pending approval payments
      const paymentsChannel = subscribeToPendingApprovalPayments((payload) => {
        handlePaymentUpdate(payload)
      })
      channels.push(paymentsChannel)
    } else {
      // Client: subscribe to user's quotations
      const quotesChannel = subscribeToQuotations(user.id, (payload) => {
        handleQuotationUpdate(payload)
      })
      channels.push(quotesChannel)
    }

    channelsRef.current = channels

    // Cleanup on unmount
    return () => {
      channels.forEach(channel => unsubscribe(channel))
      channelsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin()])

  // Handle real-time application updates
  function handleApplicationUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old
      
      // Only show notifications for status changes on UPDATE events
      if (eventType === 'UPDATE' && oldRecord && newRecord && oldRecord.status !== newRecord.status) {
        const appName = isAdmin() 
          ? `${newRecord.first_name || ''} ${newRecord.last_name || ''}`.trim() || 'An application'
          : 'Your application'
        
        // Show toast notification
        const statusMessages: Record<string, string> = {
          'approved': 'has been approved! 🎉',
          'rejected': 'has been rejected',
          'pending': 'is now pending review',
          'in_progress': 'is now in progress',
          'completed': 'has been completed'
        }
        
        const message = statusMessages[newRecord.status] || `status changed to ${newRecord.status}`
        showToast(`${appName} ${message}`, newRecord.status === 'approved' ? 'success' : 'info')
      }

      // Refresh dashboard data for any change
      fetchData()
    } catch (error) {
      console.error('Error handling application update:', error)
      // Still refresh data even if notification fails
      fetchData()
    }
  }

  // Handle real-time quotation updates
  function handleQuotationUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old
      
      // Only show notifications for status changes on UPDATE events
      if (eventType === 'UPDATE' && oldRecord && newRecord && oldRecord.status !== newRecord.status) {
        const quoteText = isAdmin() 
          ? `Quotation #${(newRecord.id || '').substring(0, 8)}`
          : 'Your quotation'
        
        // Show toast notification
        const statusMessages: Record<string, string> = {
          'paid': 'has been paid! ✅',
          'pending': 'is now pending',
          'approved': 'has been approved',
          'rejected': 'has been rejected'
        }
        
        const message = statusMessages[newRecord.status] || `status changed to ${newRecord.status}`
        showToast(`${quoteText} ${message}`, newRecord.status === 'paid' ? 'success' : 'info')
      }

      // Refresh dashboard data for any change
      fetchData()
    } catch (error) {
      console.error('Error handling quotation update:', error)
      // Still refresh data even if notification fails
      fetchData()
    }
  }

  // Handle real-time payment updates
  function handlePaymentUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord && newRecord.status === 'pending_approval') {
        // New payment awaiting approval - refresh pending payments
        if (isAdmin()) {
          applicationPaymentsAPI.getPendingApproval()
            .then((data) => {
              setPendingPayments((data || []).slice(0, 10))
            })
            .catch(() => {
              // Ignore errors
            })
        }
      } else if (eventType === 'UPDATE' && newRecord) {
        // Payment status changed
        if (oldRecord && oldRecord.status === 'pending_approval' && newRecord.status !== 'pending_approval') {
          // Payment was approved or rejected - remove from pending list
          setPendingPayments((prev) => prev.filter((p: any) => p.id !== newRecord.id))
        } else if (newRecord.status === 'pending_approval') {
          // Payment moved to pending approval - refresh list
          if (isAdmin()) {
            applicationPaymentsAPI.getPendingApproval()
              .then((data) => {
                setPendingPayments((data || []).slice(0, 10))
              })
              .catch(() => {
                // Ignore errors
              })
          }
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        // Payment deleted - remove from list
        setPendingPayments((prev) => prev.filter((p: any) => p.id !== oldRecord.id))
      }

      // Refresh dashboard stats (debounced to prevent excessive calls)
      debouncedFetchData()
    } catch (error) {
      console.error('Error handling payment update:', error)
      // Still refresh data even if update fails
      debouncedFetchData()
    }
  }

  // Debounced version of fetchData to prevent excessive API calls
  const debouncedFetchData = debounce(() => {
    fetchData()
  }, 500) // Wait 500ms before calling fetchData

  async function fetchData() {
    if (!user) return

    try {
      const promises: Promise<any>[] = [
        dashboardAPI.getStats(),
        applicationsAPI.getAll().catch(() => []),
        quotationsAPI.getAll().catch(() => []),
      ]
      
      // For admin, also fetch pending payments
      if (isAdmin()) {
        promises.push(applicationPaymentsAPI.getPendingApproval().catch(() => []))
      }
      
      const results = await Promise.all(promises)
      const [statsData, applications, , pendingPaymentsData] = results
      
      setStats(statsData)
      
      // Set pending payments for admin
      if (isAdmin()) {
        setPendingPayments((pendingPaymentsData || []).slice(0, 10)) // Limit to 10 for dashboard
      } else {
        setPendingPayments([])
      }

      // Build recent activity
      const activities: RecentActivity[] = []
      
      // Add recent applications
      if (Array.isArray(applications)) {
        const recentApps = isAdmin() 
          ? applications.slice(0, 5) 
          : applications.slice(0, 3)
        recentApps.forEach((app: any) => {
          const routeId = app.grit_app_id || app.id
          activities.push({
            id: app.id,
            type: 'application',
            title: isAdmin() 
              ? `${app.first_name} ${app.last_name} - ${app.email || 'N/A'}`
              : `${app.first_name} ${app.last_name}`,
            status: app.status,
            date: app.created_at,
            link: isAdmin() ? `/admin/applications/${routeId}/timeline` : `/applications/${routeId}`,
            service_type: app.service_type || 'NCLEX Processing',
            grit_app_id: app.grit_app_id,
          })
        })
      }

      // Sort by date and take top items (filter out quotations)
      const applicationActivities = activities.filter(a => a.type === 'application')
      applicationActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setRecentActivity(applicationActivities.slice(0, isAdmin() ? 10 : 5))

      // Build pending items for admin
      if (isAdmin()) {
        const pending: PendingItem[] = []
        
        // Get pending applications
        const pendingApplications = Array.isArray(applications) 
          ? applications.filter((app: any) => {
              const status = app.status?.toLowerCase()
              return status === 'pending'
            })
          : []
        
        // Check which pending applications are actually completed via timeline steps
        let completedAppIds = new Set<string>()
        if (pendingApplications.length > 0) {
          try {
            const appIdsToCheck = pendingApplications.map((app: any) => app.id)
            
            // Fetch timeline steps for all pending applications in parallel
            const timelineStepsPromises = appIdsToCheck.map((appId: string) =>
              timelineStepsAPI.getByApplication(appId).catch(() => [])
            )
            const timelineStepsResults = await Promise.all(timelineStepsPromises)
            
            // Check each application's timeline steps
            appIdsToCheck.forEach((appId: string, index: number) => {
              const steps = timelineStepsResults[index] || []
              // Check if application has completed nclex_exam or quick_results steps
              const hasCompletedExam = steps.some((step: any) => 
                (step.step_key === 'nclex_exam' || step.step_key === 'quick_results') && 
                step.status === 'completed'
              )
              if (hasCompletedExam) {
                completedAppIds.add(appId)
              }
            })
          } catch (error) {
            console.error('Error checking timeline steps for pending applications:', error)
          }
        }
        
        // Add pending applications (excluding those completed via timeline steps)
        pendingApplications
          .filter((app: any) => !completedAppIds.has(app.id))
          .slice(0, 5)
          .forEach((app: any) => {
            const routeId = app.grit_app_id || app.id
            pending.push({
              id: app.id,
              type: 'application',
              title: `${app.first_name} ${app.last_name}`,
              status: app.status,
              date: app.created_at,
              link: `/admin/applications/${routeId}/timeline`,
              priority: 'high',
              service_type: app.service_type || 'NCLEX Processing',
              grit_app_id: app.grit_app_id,
            })
          })

        // Quotations removed from pending items - they are managed separately

        // Sort by date
        pending.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setPendingItems(pending.slice(0, 10))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprovePayment(paymentId: string) {
    try {
      await applicationPaymentsAPI.approvePayment(paymentId)
      showToast('Payment approved successfully', 'success')
      // Refresh pending payments
      if (isAdmin()) {
        const pendingPaymentsData = await applicationPaymentsAPI.getPendingApproval().catch(() => [])
        setPendingPayments(pendingPaymentsData.slice(0, 10))
      }
      // Refresh dashboard data
      await fetchData()
    } catch (error: any) {
      showToast(error.message || 'Failed to approve payment', 'error')
    }
  }

  async function handleRejectPayment(paymentId: string) {
    try {
      await applicationPaymentsAPI.rejectPayment(paymentId)
      showToast('Payment rejected', 'success')
      // Refresh pending payments
      if (isAdmin()) {
        const pendingPaymentsData = await applicationPaymentsAPI.getPendingApproval().catch(() => [])
        setPendingPayments(pendingPaymentsData.slice(0, 10))
      }
      // Refresh dashboard data
      await fetchData()
    } catch (error: any) {
      showToast(error.message || 'Failed to reject payment', 'error')
    }
  }

  const [greeting, setGreeting] = useState<string>('Good morning')

  useEffect(() => {
    // Load greeting from settings
    greetingSettings.getGreeting().then(setGreeting).catch(() => {
      // Fallback to default if settings fail
      const hour = new Date().getHours()
      if (hour < 12) setGreeting('Good morning')
      else if (hour < 18) setGreeting('Good afternoon')
      else setGreeting('Good evening')
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
            <div className="mb-8">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-80 animate-pulse mb-2" />
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-96 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <CardSkeleton />
              <div className="lg:col-span-2">
                <CardSkeleton />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': // Legacy support
      case 'completed':
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  // Admin Dashboard
  if (isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
            {/* Welcome Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    {greeting}, {firstName || user?.first_name || 'Admin'} 👋
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    System overview and management dashboard
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300">Admin Panel</span>
                </div>
              </div>
            </div>

            {/* Main Stats Grid - 6 cards for admin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6 mb-8">
              {/* Total Clients */}
              <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Total Clients</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalClients || 0}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-purple-600 dark:text-purple-400">
                      <Users className="h-3 w-3" />
                      <span>Registered</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-400/20">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </Card>

              {/* Total Applications */}
              <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">Applications</p>
                    <p className="text-2xl font-bold text-primary-900 dark:text-primary-100">{stats.applications || 0}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-primary-600 dark:text-primary-400">
                      <FileText className="h-3 w-3" />
                      <span>All time</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-primary-500/10 dark:bg-primary-400/20">
                    <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
              </Card>

              {/* Pending Applications */}
              <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pendingApplications || stats.pending || 0}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                      <Clock className="h-3 w-3" />
                      <span>Needs review</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-yellow-500/10 dark:bg-yellow-400/20">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </Card>

              {/* Completed Applications */}
              <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Completed</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.completedApplications || stats.completed || 0}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      <span>Completed</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/10 dark:bg-green-400/20">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </Card>

              {/* Total Quotations */}
              <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Quotations</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.quotations || 0}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400">
                      <DollarSign className="h-3 w-3" />
                      <span>Total quotes</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-400/20">
                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </Card>

              {/* Revenue */}
              <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Revenue</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(stats.revenue || 0)}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      <span>Total paid</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/20">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6 mb-6">
              {/* Pending Items - Takes 1 column */}
              {pendingItems.length > 0 && (
                <Card className="lg:col-span-1 border-0 shadow-md">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pending Review</h2>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-500 text-white">
                      {pendingItems.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {pendingItems.map((item) => (
                      <Link
                        key={item.id}
                        to={item.link}
                        className="group block p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            item.type === 'application' 
                              ? 'bg-primary-100 dark:bg-primary-900/30' 
                              : 'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            {item.type === 'application' ? (
                              <FileText className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-yellow-700 dark:group-hover:text-yellow-400 transition-colors truncate">
                              {item.type === 'application' 
                                ? `${item.service_type || 'NCLEX Processing'} - ${item.grit_app_id || item.id}`
                                : item.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(item.date)}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link to="/admin/applications">
                      <Button variant="ghost" size="sm" className="w-full text-xs">
                        View All Pending
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}

              {/* Quick Actions - Takes 1 column */}
              <Card className={`border-0 shadow-md ${pendingItems.length > 0 ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                    <Zap className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
                </div>
                <div className="space-y-3">
                  <Link to="/admin/applications">
                    <div className="group p-4 rounded-xl border-2 border-transparent bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-500/10 dark:bg-primary-400/20 group-hover:bg-primary-500/20 transition-colors">
                          <ClipboardList className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            Manage Applications
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            Review and process applications
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                  <Link to="/admin/quotations">
                    <div className="group p-4 rounded-xl border-2 border-transparent bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-400/20 group-hover:bg-blue-500/20 transition-colors">
                          <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Manage Quotations
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            View and manage all quotations
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                  <Link to="/admin/clients">
                    <div className="group p-4 rounded-xl border-2 border-transparent bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-400/20 group-hover:bg-purple-500/20 transition-colors">
                          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            Manage Clients
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            View and manage client accounts
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                  <Link to="/admin/settings">
                    <div className="group p-4 rounded-xl border-2 border-transparent bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/20 dark:to-gray-700/10 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-500/10 dark:bg-gray-400/20 group-hover:bg-gray-500/20 transition-colors">
                          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                            System Settings
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            Configure system preferences
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                </div>
              </Card>

              {/* Pending Payment Approvals */}
              {pendingPayments.length > 0 && (
                <Card className="lg:col-span-1 border-0 shadow-md">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment Approvals</h2>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-500 text-white">
                      {pendingPayments.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pendingPayments.map((payment: any) => {
                      const app = payment.applications
                      return (
                        <div
                          key={payment.id}
                          className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {app?.first_name} {app?.last_name}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {app?.grit_app_id || app?.id}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {payment.payment_type === 'step1' ? 'Step 1' : 
                             payment.payment_type === 'step2' ? (app?.payment_type === 'retake' ? 'Retake' : 'Step 2') : 
                             'Full'} Payment
                          </div>
                          {payment.proof_of_payment_file_path && (
                            <div className="mb-2">
                              <a
                                href="#"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  try {
                                    const url = await getSignedFileUrl(payment.proof_of_payment_file_path)
                                    window.open(url, '_blank')
                                  } catch (error: any) {
                                    showToast(error.message || 'Failed to open proof of payment', 'error')
                                  }
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                View Proof of Payment
                              </a>
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprovePayment(payment.id)}
                              className="flex-1 text-xs"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectPayment(payment.id)}
                              className="flex-1 text-xs"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Recent Activity - Takes remaining columns */}
              <Card className={`border-0 shadow-md ${pendingItems.length > 0 && pendingPayments.length > 0 ? 'lg:col-span-1' : pendingItems.length > 0 || pendingPayments.length > 0 ? 'lg:col-span-2' : 'lg:col-span-2'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                      <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
                  </div>
                  <Link to="/admin/applications">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View all
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                      <Activity className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">No recent activity</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      System activity will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {recentActivity.map((activity) => (
                      <Link
                        key={activity.id}
                        to={activity.link}
                        className="group block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            activity.type === 'application' 
                              ? 'bg-primary-100 dark:bg-primary-900/30' 
                              : 'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            {activity.type === 'application' ? (
                              <FileText className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                                {activity.type === 'application' 
                                  ? `${activity.service_type || 'NCLEX Processing'} - ${activity.grit_app_id || activity.id}`
                                  : activity.title}
                              </p>
                              {activity.type === 'application' && (
                                <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getStatusColor(activity.status)}`}>
                                  {activity.status}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(activity.date)}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Regular User Dashboard (existing code)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const isAdminDashboard = isAdmin()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title={isAdminDashboard ? 'Admin Dashboard - GritSync | NCLEX Processing Agency' : 'Dashboard - My NCLEX Applications | GritSync'}
        description={isAdminDashboard ? 'Admin dashboard for managing NCLEX applications, clients, quotations, and payments. Comprehensive analytics and management tools.' : 'Your personal dashboard for managing NCLEX applications. View status, track progress, manage documents, and process payments all in one place.'}
        keywords={isAdminDashboard ? 'admin dashboard, NCLEX admin, application management' : 'dashboard, NCLEX dashboard, my applications, application management'}
        canonicalUrl={currentUrl}
        ogTitle={isAdminDashboard ? 'Admin Dashboard - GritSync' : 'Dashboard - My NCLEX Applications | GritSync'}
        ogDescription={isAdminDashboard ? 'Admin dashboard for managing NCLEX applications and clients' : 'Your personal dashboard for managing NCLEX applications'}
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        noindex={true}
      />
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              {greeting}, {firstName || user?.first_name || 'there'} 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back! Here's what's happening with your applications.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {/* Total Applications */}
            <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Total Applications</p>
                  <p className="text-3xl font-bold text-primary-900 dark:text-primary-100">{stats.applications}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-primary-600 dark:text-primary-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>All time</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-primary-500/10 dark:bg-primary-400/20">
                  <FileText className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
              </div>
            </Card>

            {/* Pending */}
            <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Pending</p>
                  <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pending || 0}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <Clock className="h-3 w-3" />
                    <span>In review</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10 dark:bg-yellow-400/20">
                  <ClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </Card>

            {/* Completed */}
            <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{stats.completedApplications || stats.completed || 0}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Completed</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 dark:bg-green-400/20">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>

            {/* Total Amount Paid */}
            <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Amount Paid</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(stats.revenue || 0)}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>All payments</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 dark:bg-blue-400/20">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Floating Warning Banner - Profile Completion & Required Documents */}
          {!isAdmin() && (profileCompletion < 100 || !documentsStatus.picture || !documentsStatus.diploma || !documentsStatus.passport) && (
            <div className="mb-6 sticky top-4 z-30">
              <div className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-xl shadow-2xl border-2 border-red-400 dark:border-red-600 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-white/20 dark:bg-gray-900/40 flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-sm md:text-base font-bold text-white">
                          ⚠️ Action Required: Complete Your Profile & Documents
                        </h3>
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Profile Completion */}
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-white/90" />
                            <span className="text-xs md:text-sm text-white/90">Profile:</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 md:w-24 h-2 bg-white/30 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all duration-500 rounded-full",
                                    profileCompletion >= 80
                                      ? "bg-green-300"
                                      : profileCompletion >= 60
                                      ? "bg-yellow-300"
                                      : "bg-red-300"
                                  )}
                                  style={{ width: `${profileCompletion}%` }}
                                />
                              </div>
                              <span className="text-xs md:text-sm font-bold text-white min-w-[2.5rem]">
                                {profileCompletion}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Documents Status */}
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-white/90" />
                            <span className="text-xs md:text-sm text-white/90">Docs:</span>
                            <div className="flex items-center gap-1">
                              {documentsStatus.picture ? (
                                <CheckCircle className="h-4 w-4 text-green-300" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-300" />
                              )}
                              {documentsStatus.diploma ? (
                                <CheckCircle className="h-4 w-4 text-green-300" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-300" />
                              )}
                              {documentsStatus.passport ? (
                                <CheckCircle className="h-4 w-4 text-green-300" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-300" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {profileCompletion < 100 && (
                      <Link to="/my-details">
                        <Button 
                          size="sm" 
                          className="bg-white text-red-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700 border-0 shadow-md text-xs md:text-sm font-semibold whitespace-nowrap"
                        >
                          <User className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          Complete Profile
                        </Button>
                      </Link>
                    )}
                    {(!documentsStatus.picture || !documentsStatus.diploma || !documentsStatus.passport) && (
                      <Link to="/documents">
                        <Button 
                          size="sm" 
                          className="bg-white text-red-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700 border-0 shadow-md text-xs md:text-sm font-semibold whitespace-nowrap"
                        >
                          <FileCheck className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          Upload Docs
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Quick Actions - Takes 1 column */}
            <Card className="lg:col-span-1 border-0 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <Activity className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
              </div>
              <div className="space-y-3">
                <Link to="/application/new">
                  <div className="group p-4 rounded-xl border-2 border-transparent bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-500/10 dark:bg-primary-400/20 group-hover:bg-primary-500/20 transition-colors">
                        <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          New Application
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          Submit NCLEX application
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              </div>
            </Card>

            {/* Recent Activity - Takes 2 columns */}
            <Card className="lg:col-span-2 border-0 shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
                </div>
                <Link to="/applications">
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
              {recentActivity.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <Activity className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">No recent activity</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Your recent applications and quotations will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((activity) => (
                    <Link
                      key={activity.id}
                      to={activity.link}
                      className="group block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          activity.type === 'application' 
                            ? 'bg-primary-100 dark:bg-primary-900/30' 
                            : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          {activity.type === 'application' ? (
                            <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                          ) : (
                            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                              {activity.type === 'application' 
                                ? `${activity.service_type || 'NCLEX Processing'} - ${activity.grit_app_id || activity.id}`
                                : activity.title}
                            </p>
                            {activity.type === 'application' && (
                              <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getStatusColor(activity.status)}`}>
                                {activity.status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(activity.date)}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
