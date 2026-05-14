import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { CardSkeleton } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { SEO } from '@/components/SEO'
import { FileText, ClipboardList, DollarSign, CheckCircle, ArrowRight, TrendingUp, Clock, Activity, Users, AlertCircle, XCircle, Settings, BarChart3, Zap, FileCheck, User, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { dashboardAPI, applicationsAPI, quotationsAPI, userDetailsAPI, userDocumentsAPI, applicationPaymentsAPI, timelineStepsAPI } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getSignedFileUrl } from '@/lib/api-service'
import { formatDate, formatCurrency, cn, debounce } from '@/lib/utils'
import { ActivityFeed } from '@/components/ActivityFeed'
import { subscribeToAdminDashboard, subscribeToClientDashboard, unsubscribe as unsubscribeOptimized } from '@/lib/realtime-optimized'
import type { RealtimeChannel } from '@db/db-js'
import { greetingSettings } from '@/lib/settings'

interface RecentActivity {
  id: string
  type: 'application' | 'quotation'
  title: string
  status: string
  date: string
  link: string
  service_type?: string
  application_type?: 'NCLEX' | 'EAD'
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
  application_type?: 'NCLEX' | 'EAD'
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
    nclexApplications: 0,
    eadApplications: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clientTodos, setClientTodos] = useState<Array<{
    id: string
    title: string
    description: string
    href: string
    priority: 'urgent' | 'normal'
    kind: 'payment' | 'timeline'
  }>>([])
  // Once a client has any in-progress NCLEX application, the onboarding
  // checklist (email verified, profile %, document uploads) is no longer
  // useful — the To-Do list takes over that card slot.
  const [hasActiveApplication, setHasActiveApplication] = useState(false)
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

  // Welcome banner for newly registered accounts
  // State initializer only READS (does not clear) so StrictMode double-invocation gets the same value
  const [newAccountInfo, setNewAccountInfo] = useState<{ grit_id: string; gritsync_email: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem('gritsync_new_account')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })
  // Clear sessionStorage in an effect (runs after both StrictMode effect cycles)
  useEffect(() => {
    sessionStorage.removeItem('gritsync_new_account')
  }, [])

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
      'nursingSchoolYearsAttended', 'nursingSchoolStartDate', 'nursingSchoolEndDate'
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
              nursingSchoolEndDate: typedDetails.nursing_school_end_date
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

  // Set up real-time subscriptions for application status changes (optimized)
  useEffect(() => {
    if (!user) return

    const channels: RealtimeChannel[] = []

    // Use optimized combined subscriptions (reduces connection overhead)
    if (isAdmin()) {
      // Admin: single channel for applications, quotations, and payments
      const dashboardChannel = subscribeToAdminDashboard({
        onApplicationUpdate: handleApplicationUpdate,
        onQuotationUpdate: handleQuotationUpdate,
        onPaymentUpdate: handlePaymentUpdate,
      })
      channels.push(dashboardChannel)
    } else {
      // Client: single channel for applications and quotations
      const dashboardChannel = subscribeToClientDashboard(user.id, {
        onApplicationUpdate: handleApplicationUpdate,
        onQuotationUpdate: handleQuotationUpdate,
      })
      channels.push(dashboardChannel)
    }

    channelsRef.current = channels

    // Cleanup on unmount
    return () => {
      channels.forEach(channel => unsubscribeOptimized(channel))
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
      
      // Calculate NCLEX and EAD application counts
      const nclexCount = Array.isArray(applications) 
        ? applications.filter((app: any) => (app.application_type || 'NCLEX') === 'NCLEX').length 
        : 0
      const eadCount = Array.isArray(applications) 
        ? applications.filter((app: any) => app.application_type === 'EAD').length 
        : 0
      
      setStats({
        ...statsData,
        nclexApplications: nclexCount,
        eadApplications: eadCount,
      })
      
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
          const appType = app.application_type || 'NCLEX'
          activities.push({
            id: app.id,
            type: 'application',
            title: isAdmin() 
              ? `${app.first_name} ${app.last_name} - ${app.email || 'N/A'}`
              : `${app.first_name} ${app.last_name}`,
            status: app.status,
            date: app.created_at,
            link: isAdmin() ? `/admin/applications/${routeId}/timeline` : `/applications/${routeId}`,
            service_type: app.service_type || (appType === 'EAD' ? 'EAD Application' : 'NCLEX Processing'),
            application_type: appType,
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
        const completedAppIds = new Set<string>()
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
            const appType = app.application_type || 'NCLEX'
            pending.push({
              id: app.id,
              type: 'application',
              title: `${app.first_name} ${app.last_name}`,
              status: app.status,
              date: app.created_at,
              link: `/admin/applications/${routeId}/timeline`,
              priority: 'high',
              service_type: app.service_type || (appType === 'EAD' ? 'EAD Application' : 'NCLEX Processing'),
              application_type: appType,
              grit_app_id: app.grit_app_id,
            })
          })

        // Quotations removed from pending items - they are managed separately

        // Sort by date
        pending.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setPendingItems(pending.slice(0, 10))
      }

      // Client todo-list: surface the next concrete actions for each
      // in-progress NCLEX application — pending payments and incomplete
      // client-driven timeline steps. Admins skip this; their pending list
      // already covers admin actions.
      if (!isAdmin() && Array.isArray(applications)) {
        const activeApps = applications.filter(
          (app: any) => app.application_type !== 'EAD' &&
            app.status !== 'completed' && app.status !== 'rejected' && app.status !== 'cancelled'
        )
        setHasActiveApplication(activeApps.length > 0)
        if (activeApps.length > 0) {
          const todos: typeof clientTodos = []
          // Fetch timeline + payments for each active application in parallel.
          await Promise.all(activeApps.map(async (app: any) => {
            const trackId = app.grit_app_id || app.id
            const baseLink = `/applications/${trackId}/timeline`
            const [steps, payments] = await Promise.all([
              timelineStepsAPI.getByApplication(app.id).catch(() => []),
              applicationPaymentsAPI.getByApplication(app.id).catch(() => []),
            ])
            const stepMap = new Map<string, any>(
              (steps as any[]).map((s) => [s.step_key, s])
            )
            const isDone = (k: string) => stepMap.get(k)?.status === 'completed'

            // Pending payments — show one entry per unpaid step.
            for (const p of payments as any[]) {
              if (p.status === 'pending') {
                const label =
                  p.payment_type === 'step1' ? 'Pay application — Step 1'
                  : p.payment_type === 'step2' ? 'Pay application — Step 2'
                  : 'Complete payment'
                todos.push({
                  id: `${app.id}:pay:${p.id}`,
                  title: label,
                  description: `Application ${trackId}${p.amount ? ` · $${Number(p.amount).toFixed(2)}` : ''}`,
                  href: `/applications/${trackId}/payments`,
                  priority: 'urgent',
                  kind: 'payment',
                })
              } else if (p.status === 'pending_approval') {
                todos.push({
                  id: `${app.id}:pay:${p.id}:review`,
                  title: 'Payment is under review',
                  description: `Application ${trackId} — we'll notify you once it's verified.`,
                  href: `/applications/${trackId}/payments`,
                  priority: 'normal',
                  kind: 'payment',
                })
              }
            }

            // Client-actionable timeline steps in canonical order. Everything
            // else on the timeline (mandatory courses, Form 1, ATT, exam booking)
            // is informational/admin-driven for the client and is NOT surfaced
            // here. Order matches the timeline UI so the list reads top→bottom.
            const TIMELINE_ACTIONS: Array<{ key: string; title: string; description: string }> = [
              { key: 'letter_generated',        title: 'Generate letter for school',            description: 'Open the timeline and click "Generate Letter for school".' },
              { key: 'form_2f_downloaded',      title: 'Download Form 2F',                       description: 'Pre-filled with your information — download from the timeline.' },
              { key: 'letter_submitted',        title: 'Letter for school submitted',            description: 'Mark this step complete on the timeline and enter the date you submitted the letter.' },
              { key: 'official_docs_submitted', title: 'Official Documents Sent by School to NY BON', description: 'Mark this step complete on the timeline and enter the date your school sent the documents.' },
            ]
            const remaining = TIMELINE_ACTIONS.filter((a) => !isDone(a.key))
            for (const action of remaining) {
              todos.push({
                id: `${app.id}:step:${action.key}`,
                title: action.title,
                description: `Application ${trackId} — ${action.description}`,
                href: baseLink,
                priority: 'normal',
                kind: 'timeline',
              })
            }
          }))
          // Urgent items first, then preserve order.
          todos.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'urgent' ? -1 : 1))
          setClientTodos(todos)
        } else {
          setClientTodos([])
        }
      } else if (isAdmin()) {
        // Admins never see the client onboarding/to-do hub.
        setHasActiveApplication(false)
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
                    <div className="flex items-center gap-2 mt-2 text-xs text-primary-600 dark:text-primary-400">
                      <span>NCLEX: {stats.nclexApplications || 0}</span>
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
                  <Link to="/admin/users">
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
                                  ? `${activity.service_type || (activity.application_type === 'EAD' ? 'EAD Application' : 'NCLEX Processing')} - ${activity.grit_app_id || activity.id}`
                                  : activity.title}
                              </p>
                              {activity.type === 'application' && (
                                <>
                                  {activity.application_type && (
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${
                                      activity.application_type === 'EAD'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                      {activity.application_type}
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getStatusColor(activity.status)}`}>
                                    {activity.status}
                                  </span>
                                </>
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

  // Client Dashboard
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  const docsUploaded = [documentsStatus.picture, documentsStatus.diploma, documentsStatus.passport].filter(Boolean).length
  const allDocsUploaded = docsUploaded === 3
  const profileComplete = profileCompletion === 100
  const onboardingDone = profileComplete && allDocsUploaded

  const onboardingSteps = [
    {
      id: 'email',
      label: 'Email Verified',
      done: true,
      link: null,
      description: 'Your account is active',
    },
    {
      id: 'profile',
      label: 'Personal Details',
      done: profileComplete,
      link: '/my-details',
      description: profileComplete ? `${profileCompletion}% — Complete!` : `${profileCompletion}% complete`,
      progress: profileCompletion,
    },
    {
      id: 'photo',
      label: '2x2 ID Photo',
      done: documentsStatus.picture,
      link: '/documents',
      description: documentsStatus.picture ? 'Uploaded' : 'Required',
    },
    {
      id: 'diploma',
      label: 'Nursing Diploma / TOR',
      done: documentsStatus.diploma,
      link: '/documents',
      description: documentsStatus.diploma ? 'Uploaded' : 'Required',
    },
    {
      id: 'passport',
      label: 'Passport (Data Page)',
      done: documentsStatus.passport,
      link: '/documents',
      description: documentsStatus.passport ? 'Uploaded' : 'Required',
    },
  ]

  const onboardingProgress = Math.round((onboardingSteps.filter(s => s.done).length / onboardingSteps.length) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Dashboard - My NCLEX Applications | GritSync"
        description="Your personal dashboard for managing NCLEX applications. View status, track progress, manage documents, and process payments all in one place."
        keywords="dashboard, NCLEX dashboard, my applications, application management"
        canonicalUrl={currentUrl}
        ogTitle="Dashboard - My NCLEX Applications | GritSync"
        ogDescription="Your personal dashboard for managing NCLEX applications"
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        noindex={true}
      />
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">

          {/* Hero Greeting */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-1 uppercase tracking-wide">
                {greeting}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
                {firstName || user?.first_name || 'there'} 👋
              </h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm md:text-base">
                {onboardingDone
                  ? 'Your profile is complete — your NCLEX journey is in good hands.'
                  : 'Complete the steps below to start your NCLEX application processing.'}
              </p>
            </div>
            {stats.applications > 0 && (
              <Link to="/tracking">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors cursor-pointer">
                  <Activity className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300">Track My Applications</span>
                  <ArrowRight className="h-4 w-4 text-primary-500" />
                </div>
              </Link>
            )}
          </div>

          {/* New account welcome banner */}
          {newAccountInfo && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 relative">
              <button
                onClick={() => setNewAccountInfo(null)}
                className="absolute top-3 right-3 text-green-500 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                aria-label="Dismiss"
              >
                <XCircle className="h-5 w-5" />
              </button>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-800 dark:text-green-200 mb-2">Account created successfully! Save your login details.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white/60 dark:bg-green-900/30 rounded-lg px-4 py-2">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-0.5">Your GRIT ID</p>
                      <p className="font-mono font-bold text-green-900 dark:text-green-100">{newAccountInfo.grit_id}</p>
                    </div>
                    <div className="bg-white/60 dark:bg-green-900/30 rounded-lg px-4 py-2">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-0.5">Your GritSync Email</p>
                      <p className="font-medium text-green-900 dark:text-green-100 break-all text-sm">{newAccountInfo.gritsync_email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main grid: Onboarding Hub + Stats */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">

            {/* Onboarding / Readiness Hub
                Once the client has an active application the onboarding
                checklist is suppressed — the To-Do list (rendered further
                below in this same Card) becomes the primary content. */}
            <Card className="lg:col-span-1 border-0 shadow-md">
              {!hasActiveApplication && (
              <>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-2 rounded-lg",
                    onboardingDone
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-amber-100 dark:bg-amber-900/30"
                  )}>
                    {onboardingDone
                      ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      : <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {onboardingDone ? 'Ready to Apply!' : 'Getting Started'}
                  </h2>
                </div>
                <span className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded-full",
                  onboardingDone
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                )}>
                  {onboardingProgress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      onboardingDone
                        ? "bg-green-500"
                        : onboardingProgress >= 60
                        ? "bg-amber-400"
                        : "bg-red-400"
                    )}
                    style={{ width: `${onboardingProgress}%` }}
                  />
                </div>
              </div>

              {/* Steps list */}
              <div className="space-y-1.5">
                {onboardingSteps.map((step) => {
                  const inner = (
                    <>
                      <div className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                        step.done
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-gray-100 dark:bg-gray-800"
                      )}>
                        {step.done
                          ? <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          : <XCircle className="h-4 w-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium leading-tight",
                          step.done
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-900 dark:text-gray-100"
                        )}>
                          {step.label}
                        </p>
                        {step.id === 'profile' && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  profileCompletion === 100 ? "bg-green-500" : "bg-primary-500"
                                )}
                                style={{ width: `${profileCompletion}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{profileCompletion}%</span>
                          </div>
                        )}
                        {step.id !== 'profile' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{step.description}</p>
                        )}
                      </div>
                      {step.link && (
                        <ArrowRight className={cn(
                          "h-4 w-4 flex-shrink-0 transition-colors",
                          step.done
                            ? "text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400"
                            : "text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                        )} />
                      )}
                    </>
                  )
                  return step.link ? (
                    <Link
                      key={step.id}
                      to={step.link}
                      className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={step.id} className="flex items-center gap-3 p-2.5 rounded-lg">
                      {inner}
                    </div>
                  )
                })}
              </div>

              {/* Action buttons */}
              {!onboardingDone && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                  {!profileComplete && (
                    <Link to="/my-details">
                      <Button size="sm" className="w-full text-xs font-semibold">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        Complete My Details
                      </Button>
                    </Link>
                  )}
                  {!allDocsUploaded && (
                    <Link to="/documents">
                      <Button size="sm" variant="outline" className="w-full text-xs font-semibold">
                        <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                        Upload Documents ({docsUploaded}/3)
                      </Button>
                    </Link>
                  )}
                </div>
              )}
              {onboardingDone && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Link to="/application/new">
                    <Button size="sm" className="w-full text-xs font-semibold bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                      Apply for NCLEX Processing
                    </Button>
                  </Link>
                </div>
              )}
              </>
              )}

              {/* Todo List — when the client has an active application this
                  becomes the primary content of the card (the onboarding
                  checklist above is suppressed). Otherwise it's gated on
                  onboardingDone, same as before. */}
              {(hasActiveApplication || (onboardingDone && clientTodos.length > 0)) && (
                <div className={cn(hasActiveApplication ? '' : 'mt-5 pt-4 border-t border-gray-100 dark:border-gray-700')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('rounded-lg', hasActiveApplication ? 'p-2 bg-primary-100 dark:bg-primary-900/30' : 'p-1.5 bg-primary-100 dark:bg-primary-900/30')}>
                        <ClipboardList className={cn(hasActiveApplication ? 'h-5 w-5 text-primary-600 dark:text-primary-400' : 'h-3.5 w-3.5 text-primary-600 dark:text-primary-400')} />
                      </div>
                      <h3 className={cn('font-semibold text-gray-900 dark:text-gray-100', hasActiveApplication ? 'text-base' : 'text-sm')}>Your To-Do List</h3>
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {clientTodos.length} {clientTodos.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {hasActiveApplication && clientTodos.length === 0 && (
                    <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-900/10 text-center">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-green-800 dark:text-green-300">All caught up!</p>
                      <p className="text-[11px] text-green-700/80 dark:text-green-400/80 mt-0.5">
                        Nothing's waiting on you right now. We'll let you know when the next step is ready.
                      </p>
                    </div>
                  )}
                  {clientTodos.length > 0 && (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {clientTodos.map((t) => (
                      <li key={t.id}>
                        <Link
                          to={t.href}
                          className={cn(
                            'flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors group',
                            t.priority === 'urgent'
                              ? 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                          )}
                        >
                          <div className={cn(
                            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
                            t.priority === 'urgent'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : 'bg-amber-100 dark:bg-amber-900/30'
                          )}>
                            {t.kind === 'payment' ? (
                              <CreditCard className={cn('h-3 w-3', t.priority === 'urgent' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} />
                            ) : (
                              <ClipboardList className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-xs font-semibold leading-tight',
                              t.priority === 'urgent' ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'
                            )}>
                              {t.title}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                              {t.description}
                            </p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 mt-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              )}
            </Card>

            {/* Right side: Stats + Quick Actions */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10 p-4">
                  <p className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">Applications</p>
                  <p className="text-2xl font-bold text-primary-900 dark:text-primary-100">{stats.applications}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-primary-600 dark:text-primary-400">
                    <FileText className="h-3 w-3" />
                    <span>NCLEX: {stats.nclexApplications || 0}</span>
                  </div>
                </Card>
                <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 p-4">
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">In Progress</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pending || 0}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                    <Clock className="h-3 w-3" />
                    <span>Being processed</span>
                  </div>
                </Card>
                <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 p-4">
                  <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.completedApplications || stats.completed || 0}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Licensed</span>
                  </div>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="border-0 shadow-md flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                    <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'My Details', icon: User, href: '/my-details', color: 'primary', description: 'Update personal info' },
                    { label: 'Documents', icon: FileCheck, href: '/documents', color: 'purple', description: 'Upload & manage docs', badge: 3 - docsUploaded },
                    { label: 'Applications', icon: ClipboardList, href: '/tracking', color: 'blue', description: 'Track your applications', badge: stats.pending || 0 },
                    { label: 'Account', icon: Settings, href: '/account-settings', color: 'gray', description: 'Manage account' },
                  ].map(({ label, icon: Icon, href, color, description, badge }) => (
                    <Link key={label} to={href}>
                      <div className={cn(
                        "group flex flex-col items-center text-center p-3 rounded-xl border-2 border-transparent transition-all duration-200 hover:shadow-md cursor-pointer",
                        color === 'primary' && "bg-primary-50 dark:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-100/70",
                        color === 'purple' && "bg-purple-50 dark:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-100/70",
                        color === 'blue' && "bg-blue-50 dark:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-100/70",
                        color === 'gray' && "bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100/70",
                      )}>
                        <div className="relative mb-2">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            color === 'primary' && "bg-primary-100 dark:bg-primary-900/40 group-hover:bg-primary-200",
                            color === 'purple' && "bg-purple-100 dark:bg-purple-900/40 group-hover:bg-purple-200",
                            color === 'blue' && "bg-blue-100 dark:bg-blue-900/40 group-hover:bg-blue-200",
                            color === 'gray' && "bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-300",
                          )}>
                            <Icon className={cn(
                              "h-5 w-5",
                              color === 'primary' && "text-primary-600 dark:text-primary-400",
                              color === 'purple' && "text-purple-600 dark:text-purple-400",
                              color === 'blue' && "text-blue-600 dark:text-blue-400",
                              color === 'gray' && "text-gray-600 dark:text-gray-400",
                            )} />
                          </div>
                          {badge && badge > 0 ? (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">{label}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Recent Activity */}
          <ActivityFeed
            activities={recentActivity.map(activity => ({
              id: activity.id,
              type: activity.type === 'application' ? 'application' : 'payment',
              title: activity.type === 'application'
                ? `${activity.service_type || 'NCLEX Processing'} - ${activity.grit_app_id || activity.id}`
                : activity.title,
              description: activity.type === 'application'
                ? `Status: ${activity.status}`
                : activity.title,
              status: activity.status,
              date: activity.date,
              link: activity.link,
            }))}
            maxItems={5}
            onRefresh={() => {
              if (user) fetchData()
            }}
          />

        </main>
      </div>
    </div>
  )
}
