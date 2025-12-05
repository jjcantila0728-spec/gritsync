import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Loading, CardSkeleton } from '@/components/ui/Loading'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DocumentImagePreview } from '@/components/ui/DocumentImagePreview'
import { applicationsAPI, applicationPaymentsAPI, getFileUrl, getSignedFileUrl, timelineStepsAPI, processingAccountsAPI, userDocumentsAPI, servicesAPI } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import jsPDF from 'jspdf'
import { Elements } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'
import { StripePaymentForm } from '@/components/StripePaymentForm'
import { subscribeToApplicationUpdates, subscribeToApplicationTimelineSteps, subscribeToApplicationPayments, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Copy, 
  Check, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  FileText, 
  Image as ImageIcon,
  Eye,
  Download,
  GraduationCap,
  School,
  Building2,
  History,
  DollarSign,
  Info,
  Lock,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CreditCard,
  Receipt,
  FileIcon,
  X
} from 'lucide-react'

interface ApplicationData {
  id: string
  user_id?: string
  first_name: string
  middle_name: string
  last_name: string
  gender: string
  marital_status: string
  single_name?: string
  single_full_name?: string
  date_of_birth: string
  country_of_birth?: string
  place_of_birth?: string
  birth_place?: string
  email: string
  mobile_number: string
  mailing_address?: string
  house_number?: string
  street_name?: string
  city: string
  province: string
  country?: string
  zipcode: string
  // Elementary School
  elementary_school?: string
  elementary_city?: string
  elementary_province?: string
  elementary_country?: string
  elementary_years_attended?: string
  elementary_start_date?: string
  elementary_end_date?: string
  // High School
  high_school?: string
  high_school_city?: string
  high_school_province?: string
  high_school_country?: string
  high_school_years_attended?: string
  high_school_start_date?: string
  high_school_end_date?: string
  high_school_graduated?: string
  high_school_diploma_type?: string
  high_school_diploma_date?: string
  // Nursing School
  nursing_school?: string
  nursing_school_city?: string
  nursing_school_province?: string
  nursing_school_country?: string
  nursing_school_years_attended?: string
  nursing_school_start_date?: string
  nursing_school_end_date?: string
  nursing_school_major?: string
  nursing_school_diploma_date?: string
  // Documents
  picture_path: string
  diploma_path: string
  passport_path: string
  // Status
  status: string
  created_at: string
  updated_at?: string
  signature?: string
  payment_type?: string
  [key: string]: any
}

export function ApplicationDetail() {
  const { id, tab = 'timeline' } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [updating, setUpdating] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [_imageErrors, _setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [processingPayments, setProcessingPayments] = useState(false)
  const [receipts, setReceipts] = useState<{ [paymentId: string]: any }>({})
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [viewingReceipt, setViewingReceipt] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [processingAccounts, setProcessingAccounts] = useState<any[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)
  const [accountForm, setAccountForm] = useState({ 
    account_type: 'gmail', 
    name: '',
    link: '',
    email: '', 
    password: '',
    security_question_1: '',
    security_question_2: '',
    security_question_3: '',
    status: 'active'
  })
  const [isUserForm, setIsUserForm] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [timelineSteps, setTimelineSteps] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [staggeredService, setStaggeredService] = useState<any>(null)
  const [loadingServices, setLoadingServices] = useState(true)
  const [viewingFile, setViewingFile] = useState<{ url: string, fileName: string, isImage: boolean } | null>(null)
  const [latestDocuments, setLatestDocuments] = useState<{
    picture?: { file_path: string; file_name: string }
    diploma?: { file_path: string; file_name: string }
    passport?: { file_path: string; file_name: string }
  }>({})
  const [mandatoryCourseFiles, setMandatoryCourseFiles] = useState<any[]>([])
  const [uploadingCourseFile, setUploadingCourseFile] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'file' | 'account', id: string, name?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pictureUrl, setPictureUrl] = useState<string | null>(null)
  const [pictureError, setPictureError] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timelineChannelRef = useRef<RealtimeChannel | null>(null)
  const paymentsChannelRef = useRef<RealtimeChannel | null>(null)

  // Payment pricing will be loaded from admin quote service config

  // Component for PDF preview (shows PDF in iframe)
  const DocumentPDFPreview = ({ filePath, alt, className }: { filePath: string, alt: string, className?: string }) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
      if (!filePath) {
        setError(true)
        return
      }

      // Handle legacy HTTP URLs
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        setPdfUrl(filePath)
        return
      }

      // For Supabase Storage, get signed URL
      getSignedFileUrl(filePath, 3600)
        .then(url => {
          setPdfUrl(url)
        })
        .catch(() => {
          setError(true)
        })
    }, [filePath])

    if (error) {
      return (
        <div className={`${className} flex items-center justify-center bg-red-50 dark:bg-red-900/20`}>
          <FileText className="h-12 w-12 text-red-400" />
        </div>
      )
    }

    if (!pdfUrl) {
      return (
        <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      )
    }

    return (
      <iframe
        src={`${pdfUrl}#page=1&zoom=50`}
        className={className}
        title={alt}
        onError={() => setError(true)}
      />
    )
  }

  // Removed unused AuthenticatedImage and _handleDownload functions

  const handleViewFile = async (filePath: string, filename: string) => {
    try {
      // Get signed URL for Supabase Storage
      const signedUrl = await getSignedUrlFromPath(filePath)
      
      // Check if file is an image based on extension
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
      const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
      const isImage = imageExtensions.includes(fileExtension)
      
      setViewingFile({
        url: signedUrl,
        fileName: filename,
        isImage
      })
    } catch (error) {
      console.error('Error viewing file:', error)
      showToast('Failed to open file', 'error')
    }
  }

  useEffect(() => {
    if (id) {
      fetchApplication()
      loadServices()
    }
  }, [id])

  // Set up real-time subscriptions for application updates
  useEffect(() => {
    if (!id || !application) return

    // Subscribe to this specific application's updates
    const appChannel = subscribeToApplicationUpdates(id, (payload) => {
      handleApplicationRealtimeUpdate(payload)
    })
    channelRef.current = appChannel

    // Subscribe to timeline steps updates
    const timelineChannel = subscribeToApplicationTimelineSteps(id, (payload) => {
      handleTimelineStepRealtimeUpdate(payload)
    })
    timelineChannelRef.current = timelineChannel

    // Subscribe to payments updates
    const paymentsChannel = subscribeToApplicationPayments(id, (payload) => {
      handlePaymentRealtimeUpdate(payload)
    })
    paymentsChannelRef.current = paymentsChannel

    // Cleanup on unmount or when id changes
    return () => {
      if (channelRef.current) {
        unsubscribe(channelRef.current)
        channelRef.current = null
      }
      if (timelineChannelRef.current) {
        unsubscribe(timelineChannelRef.current)
        timelineChannelRef.current = null
      }
      if (paymentsChannelRef.current) {
        unsubscribe(paymentsChannelRef.current)
        paymentsChannelRef.current = null
      }
    }
  }, [id, application?.id])

  // Handle real-time application updates
  function handleApplicationRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'UPDATE' && newRecord && newRecord.id === id) {
        // Update application state with new data
        setApplication((prev) => {
          if (!prev) return prev
          return { ...prev, ...newRecord }
        })

        // Update status if it changed
        if (oldRecord && oldRecord.status !== newRecord.status) {
          setStatus(newRecord.status)
          
          // Show notification for status changes
          const statusMessages: Record<string, string> = {
            'approved': 'Application has been approved! 🎉',
            'rejected': 'Application has been rejected',
            'pending': 'Application is now pending review',
            'in_progress': 'Application is now in progress',
            'completed': 'Application has been completed'
          }
          
          const message = statusMessages[newRecord.status] || `Application status changed to ${newRecord.status}`
          showToast(message, newRecord.status === 'approved' || newRecord.status === 'completed' ? 'success' : 'info')
          
          // Refresh timeline if status changed
          if (application?.id) {
            fetchTimelineSteps()
          }
        }

        // Refresh payments if payment-related fields changed
        if (oldRecord && (
          oldRecord.payment_type !== newRecord.payment_type ||
          oldRecord.status !== newRecord.status
        )) {
          if (application?.id) {
            fetchPayments()
          }
        }
      }
    } catch (error) {
      console.error('Error handling real-time application update:', error)
    }
  }

  // Handle real-time timeline step updates
  function handleTimelineStepRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord) {
        // New timeline step added - refresh timeline
        fetchTimelineSteps()
      } else if (eventType === 'UPDATE' && newRecord) {
        // Timeline step updated - update in place
        setTimelineSteps((prev) => {
          const index = prev.findIndex((s) => s.id === newRecord.id)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = { ...updated[index], ...newRecord }
            return updated
          } else {
            // Step not in list, might be new - refresh to be safe
            fetchTimelineSteps()
            return prev
          }
        })
      } else if (eventType === 'DELETE' && oldRecord) {
        // Timeline step deleted - remove from list
        setTimelineSteps((prev) => prev.filter((s) => s.id !== oldRecord.id))
      }
    } catch (error) {
      console.error('Error handling real-time timeline step update:', error)
      // Fallback to full refresh on error
      fetchTimelineSteps()
    }
  }

  // Handle real-time payment updates
  function handlePaymentRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord) {
        // New payment added - refresh payments
        fetchPayments()
      } else if (eventType === 'UPDATE' && newRecord) {
        // Payment updated - update in place or refresh
        setPayments((prev) => {
          const index = prev.findIndex((p) => p.id === newRecord.id)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = { ...updated[index], ...newRecord }
            return updated
          } else {
            // Payment not in list, might be new - refresh to be safe
            fetchPayments()
            return prev
          }
        })

        // Show notification for status changes
        if (oldRecord && oldRecord.status !== newRecord.status) {
          if (newRecord.status === 'paid') {
            showToast('Payment has been approved! ✅', 'success')
          } else if (newRecord.status === 'failed') {
            showToast('Payment has been rejected', 'error')
          }
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        // Payment deleted - remove from list
        setPayments((prev) => prev.filter((p) => p.id !== oldRecord.id))
      }
    } catch (error) {
      console.error('Error handling real-time payment update:', error)
      // Fallback to full refresh on error
      fetchPayments()
    }
  }

  // Load services from admin quote service config
  async function loadServices() {
    try {
      setLoadingServices(true)
      // Fetch staggered payment service for NCLEX Processing in New York
      const service = await servicesAPI.getByServiceStateAndPaymentType('NCLEX Processing', 'New York', 'staggered')
      if (service) {
        setStaggeredService(service)
      }
    } catch (error) {
      console.error('Error loading services:', error)
      // Fallback to hardcoded config if service fetch fails
    } finally {
      setLoadingServices(false)
    }
  }

  async function fetchApplication() {
    try {
      const data = await applicationsAPI.getById(id!)
      if (!data || typeof data !== 'object' || 'error' in data) {
        throw new Error('Failed to fetch application')
      }
      setApplication(data as ApplicationData)
      // Initialize status from application data - this ensures it's always synced with the database
      const appStatus = (data as ApplicationData).status || 'initiated'
      setStatus(appStatus)
      
      // Fetch latest documents from user_documents table for the application owner
      // This ensures applications always show the most recent documents from Documents page
      try {
        const appData = data as ApplicationData
        const applicationUserId = appData.user_id
        
        if (applicationUserId) {
          // Fetch documents for the application owner (not the current logged-in user)
          const docs = await userDocumentsAPI.getByUserId(applicationUserId)
          console.log('ApplicationDetail: Fetched documents for user:', applicationUserId, docs)
          const docsMap: any = {}
          const courseFiles: any[] = []
          const pictureDocs: any[] = [] // Collect all picture documents first
          
          docs.forEach((doc: any) => {
            if (doc.document_type === 'picture' || doc.document_type === 'diploma' || doc.document_type === 'passport') {
              // For picture type, collect all picture documents first, then filter
              if (doc.document_type === 'picture') {
                pictureDocs.push(doc)
                return // Don't set yet, we'll process all picture docs together
              }
              
              console.log(`ApplicationDetail: Found ${doc.document_type} document:`, {
                file_path: doc.file_path,
                file_name: doc.file_name
              })
              docsMap[doc.document_type] = {
                file_path: doc.file_path,
                file_name: doc.file_name,
              }
            } else if (doc.document_type?.startsWith('mandatory_course')) {
              courseFiles.push(doc)
            }
          })
          
          // Process picture documents: filter out avatars and find the 2x2 picture
          if (pictureDocs.length > 0) {
            // Filter out avatars - only get actual 2x2 picture documents
            const nonAvatarPictures = pictureDocs.filter(doc => {
              const fileName = doc.file_name?.toLowerCase() || ''
              const filePath = doc.file_path?.toLowerCase() || ''
              // Exclude avatars
              if (fileName.includes('avatar') || filePath.includes('avatar')) {
                return false
              }
              // Include files that are clearly 2x2 pictures:
              // - Start with "2x2picture" or "picture_"
              // - Or contain "picture" in the name (but not "avatar")
              return fileName.startsWith('2x2picture') || 
                     fileName.startsWith('picture_') || 
                     filePath.includes('/picture_') ||
                     (fileName.includes('picture') && !fileName.includes('avatar'))
            })
            
            if (nonAvatarPictures.length > 0) {
              // Prefer files that start with '2x2picture' or 'picture_'
              const preferredPicture = nonAvatarPictures.find(doc => {
                const fileName = doc.file_name?.toLowerCase() || ''
                return fileName.startsWith('2x2picture') || fileName.startsWith('picture_')
              }) || nonAvatarPictures[0] // Fall back to first non-avatar if no preferred found
              
              console.log(`ApplicationDetail: Selected 2x2 picture document:`, {
                file_path: preferredPicture.file_path,
                file_name: preferredPicture.file_name
              })
              docsMap['picture'] = {
                file_path: preferredPicture.file_path,
                file_name: preferredPicture.file_name,
              }
            } else {
              console.warn('ApplicationDetail: No valid 2x2 picture document found (only avatars available)')
            }
          }
          
          console.log('ApplicationDetail: Documents map:', docsMap)
          setLatestDocuments(docsMap)
          setMandatoryCourseFiles(courseFiles)
        } else {
          // Fallback: if no user_id, try current user's documents (for backward compatibility)
          const docs = await userDocumentsAPI.getAll()
          const docsMap: any = {}
          const courseFiles: any[] = []
          
          docs.forEach((doc: any) => {
            if (doc.document_type === 'picture' || doc.document_type === 'diploma' || doc.document_type === 'passport') {
              // For picture type, only use documents that are 2x2 pictures (not avatars)
              if (doc.document_type === 'picture') {
                const fileName = doc.file_name?.toLowerCase() || ''
                const filePath = doc.file_path?.toLowerCase() || ''
                // Skip avatars - only use files that start with '2x2picture' or 'picture_'
                if (fileName.includes('avatar') || filePath.includes('avatar')) {
                  return // Skip avatar files
                }
                // Only set if it's a valid 2x2 picture (starts with 2x2picture or picture_)
                if (fileName.startsWith('2x2picture') || fileName.startsWith('picture_') || filePath.includes('/picture_')) {
                  docsMap[doc.document_type] = {
                    file_path: doc.file_path,
                    file_name: doc.file_name,
                  }
                }
                return
              }
              
              docsMap[doc.document_type] = {
                file_path: doc.file_path,
                file_name: doc.file_name,
              }
            } else if (doc.document_type?.startsWith('mandatory_course')) {
              courseFiles.push(doc)
            }
          })
          
          setLatestDocuments(docsMap)
          setMandatoryCourseFiles(courseFiles)
        }
      } catch (error) {
        // If we can't fetch latest documents, latestDocuments will remain empty
        // and we'll fall back to application.picture_path, etc.
      }
      
      // Note: Status check happens in fetchTimelineSteps to avoid infinite loops
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  // Helper function to check exam results and update status
  async function checkAndUpdateStatusFromExamResults(app: any, steps: any[]) {
    try {
      // Check if exam results exist in timeline steps
      const quickResultsStep = steps.find((step: any) => step?.step_key === 'quick_results')
      
      // Handle data that might be stored as JSON string or object
      let quickResultsData = quickResultsStep?.data
      if (typeof quickResultsData === 'string') {
        try {
          quickResultsData = JSON.parse(quickResultsData)
        } catch (e) {
          quickResultsData = null
        }
      }
      const hasResult = !!(quickResultsData?.result)
      
      // Check if status should be updated
      const shouldUpdate = hasResult && 
        app.status !== 'completed' && 
        app.status !== 'rejected' &&
        (app.status === 'pending' || app.status === 'initiated' || app.status === 'in-progress')
      
      if (shouldUpdate) {
        await applicationsAPI.updateStatus(app.id, 'completed')
        // Update local state directly to avoid infinite loop
        setApplication({ ...app, status: 'completed' as any })
        setStatus('completed')
      }
    } catch {
      // Silently handle errors
    }
  }

  async function fetchPayments() {
    if (!application?.id) return
    setLoadingPayments(true)
    try {
      const data = await applicationPaymentsAPI.getByApplication(application.id)
      setPayments(data || [])
      
      // Load receipts for paid payments
      const paidPayments: any[] = (data || []).filter((p: any) => p && p.status === 'paid' && p.id)
      const receiptsMap: { [paymentId: string]: any } = {}
      
      for (const payment of paidPayments) {
        try {
          const receipt = await applicationPaymentsAPI.getReceipt(payment.id)
          receiptsMap[payment.id] = receipt
        } catch {
          // Receipt might not exist yet
        }
      }
      
      setReceipts(receiptsMap)
    } catch (error) {
      console.error('Error fetching payments:', error)
      setPayments([])
    } finally {
      setLoadingPayments(false)
    }
  }

  // Calculate tax for a single item (12% tax rate)
  const calculateItemTax = (item: any): number => {
    const TAX_RATE = 0.12
    return item.taxable ? (item.amount || 0) * TAX_RATE : 0
  }

  // Calculate item total (amount + tax)
  const calculateItemTotal = (item: any): number => {
    return (item.amount || 0) + calculateItemTax(item)
  }

  async function handleCreatePayment(type: 'step1' | 'step2') {
    if (!application?.id) return

    setProcessingPayments(true)
    try {
      const amount = type === 'step1' 
        ? (staggeredService?.total_step1 || 0)
        : (staggeredService?.total_step2 || 0)

      if (!amount) {
        showToast('Service pricing not available. Please contact support.', 'error')
        setProcessingPayments(false)
        return
      }

      await applicationPaymentsAPI.create(application.id, type, amount)
      showToast('Payment created successfully', 'success')
      await fetchPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to create payment', 'error')
    } finally {
      setProcessingPayments(false)
    }
  }

  async function handleCompletePayment(payment: any) {
    if (!stripePromise) {
      showToast('Stripe is not configured. Please contact support.', 'error')
      return
    }

    if (!payment || !payment.id) {
      showToast('Payment information is missing. Please try again.', 'error')
      return
    }

    setSelectedPayment(payment)
    setProcessingPayments(true)
    
    try {
      // Create payment intent
      const intentData = await applicationPaymentsAPI.createPaymentIntent(payment.id)
      
      if (!intentData.clientSecret) {
        throw new Error('Payment intent creation failed: No client secret returned')
      }
      
      setClientSecret(intentData.clientSecret)
      setPaymentIntentId(intentData.paymentIntentId)
      setShowPaymentModal(true)
    } catch (error: any) {
      let errorMessage = 'Failed to initialize payment. '
      
      if (error.message) {
        errorMessage = error.message
      } else if (error.error?.message) {
        errorMessage = error.error.message
      } else {
        errorMessage += 'Please try again or contact support.'
      }
      
      showToast(errorMessage, 'error')
    } finally {
      setProcessingPayments(false)
    }
  }

  async function handlePaymentSuccess(
    paymentIntentId: string, 
    paymentMethod?: 'card' | 'gcash' | 'mobile_banking',
    gcashDetails?: { number: string; reference: string },
    proofOfPaymentFile?: File
  ) {
    if (!selectedPayment) return

    setProcessingPayments(true)
    try {
      // Map payment method to API format
      let apiPaymentMethod: 'stripe' | 'gcash' | 'mobile_banking' = 'stripe'
      if (paymentMethod === 'gcash') {
        apiPaymentMethod = 'gcash'
      } else if (paymentMethod === 'mobile_banking') {
        apiPaymentMethod = 'mobile_banking'
      }

      // For mobile banking, use the paymentIntentId as a placeholder
      const stripePaymentIntentId = (paymentMethod === 'card' && paymentIntentId) ? paymentIntentId : undefined

      await applicationPaymentsAPI.complete(
        selectedPayment.id, 
        undefined, 
        stripePaymentIntentId,
        apiPaymentMethod,
        gcashDetails,
        proofOfPaymentFile
      )
      
      // Fetch receipt separately if payment is completed
      try {
        const receipt = await applicationPaymentsAPI.getReceipt(selectedPayment.id)
        setReceipts({ ...receipts, [selectedPayment.id]: receipt })
      } catch {
        // Receipt might not be generated yet, that's okay
      }
      
      if (paymentMethod === 'gcash') {
        showToast('GCash payment submitted! Your payment will be verified manually. You will receive a confirmation once verified.', 'success')
      } else if (paymentMethod === 'mobile_banking') {
        showToast('Mobile banking payment submitted! Your proof of payment has been uploaded. An admin will review and approve your payment. You will receive a confirmation once approved.', 'success')
      } else {
        showToast('Payment completed successfully! Receipt generated.', 'success')
      }
      
      setShowPaymentModal(false)
      setSelectedPayment(null)
      setClientSecret(null)
      setPaymentIntentId(null)
      await fetchPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to complete payment', 'error')
    } finally {
      setProcessingPayments(false)
    }
  }

  async function handleViewReceipt(paymentId: string) {
    try {
      if (receipts[paymentId]) {
        setViewingReceipt(receipts[paymentId])
        setShowReceiptModal(true)
        return
      }
      
      const receipt = await applicationPaymentsAPI.getReceipt(paymentId)
      setReceipts({ ...receipts, [paymentId]: receipt })
      setViewingReceipt(receipt)
      setShowReceiptModal(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to load receipt', 'error')
    }
  }

  function handleDownloadReceipt(receipt: any) {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - (margin * 2)
      let yPos = margin

      // Colors
      const primaryColor: [number, number, number] = [220, 38, 38] // Red #dc2626
      const lightGray: [number, number, number] = [243, 244, 246] // Gray-100
      const textGray: [number, number, number] = [107, 114, 128] // Gray-500
      const textDark: [number, number, number] = [17, 24, 39] // Gray-900

      // Header with gradient effect (simulated with rectangle)
      doc.setFillColor(...primaryColor)
      doc.rect(0, 0, pageWidth, 50, 'F')
      
      // Company name
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.text('GRITSYNC', pageWidth / 2, 25, { align: 'center' })
      
      // Tagline
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.text('Business Consultancy Services', pageWidth / 2, 35, { align: 'center' })

      yPos = 70

      // Receipt title
      doc.setTextColor(...textDark)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('PAYMENT RECEIPT', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // Receipt number and date box
      doc.setFillColor(...lightGray)
      doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F')
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...textGray)
      doc.text('Receipt Number:', margin + 10, yPos + 8)
      doc.text('Date:', margin + 10, yPos + 18)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...textDark)
      doc.text(`#${receipt.receipt_number}`, margin + 60, yPos + 8)
      
      const receiptDate = new Date(receipt.created_at)
      const formattedDate = receiptDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      doc.text(formattedDate, margin + 60, yPos + 18)

      yPos += 35

      // Payment details section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...textDark)
      doc.text('Payment Details', margin, yPos)
      yPos += 8

      // Payment type
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...textGray)
      const paymentTypeLabel = receipt.payment_type === 'step1' ? 'Step 1 Payment' : 
                               receipt.payment_type === 'step2' ? 'Step 2 Payment' : 
                               'Full Payment'
      doc.text(`Payment Type: ${paymentTypeLabel}`, margin, yPos)
      yPos += 10

      // Items section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...textDark)
      doc.text('Items', margin, yPos)
      yPos += 8

      // Table header
      doc.setFillColor(...lightGray)
      doc.roundedRect(margin, yPos - 5, contentWidth, 10, 2, 2, 'F')
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...textDark)
      doc.text('Description', margin + 5, yPos + 2)
      doc.text('Amount', pageWidth - margin - 5, yPos + 2, { align: 'right' })
      yPos += 8

      // Items list
      doc.setFont('helvetica', 'normal')
      receipt.items.forEach((item: any, index: number) => {
        if (yPos > pageHeight - 60) {
          doc.addPage()
          yPos = margin + 20
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(255, 255, 255)
        } else {
          doc.setFillColor(249, 250, 251) // Gray-50
        }
        doc.roundedRect(margin, yPos - 3, contentWidth, 10, 1, 1, 'F')

        doc.setFontSize(10)
        doc.setTextColor(...textDark)
        
        // Truncate long item names
        const maxWidth = contentWidth - 80
        let itemName = item.name
        const textWidth = doc.getTextWidth(itemName)
        if (textWidth > maxWidth) {
          // Truncate and add ellipsis
          while (doc.getTextWidth(itemName + '...') > maxWidth && itemName.length > 0) {
            itemName = itemName.slice(0, -1)
          }
          itemName += '...'
        }
        
        doc.text(itemName, margin + 5, yPos + 3)
        doc.text(formatCurrency(item.amount), pageWidth - margin - 5, yPos + 3, { align: 'right' })
        yPos += 10
      })

      yPos += 5

      // Total section
      if (yPos > pageHeight - 50) {
        doc.addPage()
        yPos = margin + 20
      }

      // Total box with accent color
      doc.setFillColor(...primaryColor)
      doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F')
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('Total Amount', margin + 10, yPos + 8)
      doc.text(formatCurrency(receipt.amount), pageWidth - margin - 10, yPos + 8, { align: 'right' })

      yPos += 35

      // Footer
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = margin
      }

      // Thank you message
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...textDark)
      doc.text('Thank you for your payment!', pageWidth / 2, yPos, { align: 'center' })
      yPos += 8

      // Footer line
      doc.setDrawColor(...primaryColor)
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 10

      // Company info footer
      doc.setFontSize(9)
      doc.setTextColor(...textGray)
      doc.text('GritSync - NCLEX Application Services', pageWidth / 2, yPos, { align: 'center' })
      yPos += 5
      doc.text('This is an official receipt for your records.', pageWidth / 2, yPos, { align: 'center' })

      // Save PDF
      doc.save(`receipt-${receipt.receipt_number}.pdf`)
      showToast('Receipt downloaded successfully', 'success')
    } catch (error) {
      console.error('Error generating PDF:', error)
      showToast('Failed to generate PDF receipt', 'error')
    }
  }

  useEffect(() => {
    if (id) {
      fetchApplication()
    }
  }, [id])

  // Fetch related data after application is loaded
  useEffect(() => {
    if (application?.id) {
      fetchPayments()
      fetchTimelineSteps()
    }
  }, [application?.id])

  // Refresh payments when payments tab is opened
  useEffect(() => {
    if (tab === 'payments' && application?.id && !loadingPayments) {
      fetchPayments()
    }
  }, [tab])

  // Refresh documents when documents tab is opened
  useEffect(() => {
    if (tab === 'documents' && application?.user_id) {
      // Refresh latest documents
      const refreshDocuments = async () => {
        try {
          const docs = await userDocumentsAPI.getByUserId(application.user_id!)
          const docsMap: any = {}
          const courseFiles: any[] = []
          
          docs.forEach((doc: any) => {
            if (doc.document_type === 'picture' || doc.document_type === 'diploma' || doc.document_type === 'passport') {
              docsMap[doc.document_type] = {
                file_path: doc.file_path,
                file_name: doc.file_name,
              }
            } else if (doc.document_type?.startsWith('mandatory_course')) {
              courseFiles.push(doc)
            }
          })
          
          setLatestDocuments(docsMap)
          setMandatoryCourseFiles(courseFiles)
        } catch {
          // Could not refresh documents
        }
      }
      refreshDocuments()
    }
  }, [tab, application?.user_id])

  // Fetch 2x2 picture URL
  useEffect(() => {
    const fetchPictureUrl = async () => {
      setPictureError(false)
      setPictureUrl(null)
      
      const picturePath = latestDocuments.picture?.file_path || application?.picture_path
      if (!picturePath) return
      
      // Skip if path contains avatar
      if (picturePath.toLowerCase().includes('avatar')) return
      
      try {
        let normalizedPath = picturePath.replace(/\\/g, '/')
        
        // Add userId prefix if needed
        if (application?.user_id && !normalizedPath.startsWith(application.user_id + '/')) {
          if (!normalizedPath.includes('/')) {
            normalizedPath = `${application.user_id}/${normalizedPath}`
          } else {
            const filename = normalizedPath.split('/').pop()
            if (filename) {
              normalizedPath = `${application.user_id}/${filename}`
            }
          }
        }
        
        const url = await getSignedFileUrl(normalizedPath, 3600)
        setPictureUrl(url)
      } catch (error) {
        console.error('Error fetching picture URL:', error)
        setPictureError(true)
      }
    }
    
    fetchPictureUrl()
  }, [latestDocuments.picture?.file_path, application?.picture_path, application?.user_id])

  // Refresh processing accounts when processing-accounts tab is opened
  useEffect(() => {
    if (tab === 'processing-accounts' && id && !loadingAccounts) {
      fetchProcessingAccounts()
    }
  }, [tab])

  // Fetch processing accounts when id is available (can be GRIT APP ID or UUID)
  useEffect(() => {
    if (id) {
      fetchProcessingAccounts()
    }
  }, [id])

  async function fetchTimelineSteps() {
    if (!application?.id) return
    setLoadingTimeline(true)
    try {
      const steps = await timelineStepsAPI.getByApplication(application.id)
      setTimelineSteps(steps || [])
      
      // Check if exam results exist and update status to completed if needed (trigger-based update)
      // This handles cases where exam results were added before status was updated
      if (application?.id) {
        // Use the helper function to check and update status
        // Pass the fetched steps array directly to avoid state timing issues
        const stepsArray = Array.isArray(steps) ? steps : []
        await checkAndUpdateStatusFromExamResults(application, stepsArray)
      }
    } catch (error: any) {
      console.error('Error fetching timeline steps:', error)
      setTimelineSteps([])
    } finally {
      setLoadingTimeline(false)
    }
  }

  async function updateTimelineStep(stepKey: string, status: 'pending' | 'completed', data?: any) {
    if (!application?.id) return
    try {
      // Save timeline step to database
      await timelineStepsAPI.update(application.id, stepKey, status, data)
      
      // Refresh timeline steps to get latest data
      await fetchTimelineSteps()
      
      // Recalculate and update application status based on timeline changes
      // Wait a bit for state to update after fetchTimelineSteps
      setTimeout(async () => {
        try {
          // Re-fetch timeline steps to ensure we have the latest data
          const steps = await timelineStepsAPI.getByApplication(application.id)
          setTimelineSteps(steps || [])
          // Status is fetched from Supabase, not auto-calculated
          // Refresh application data to get latest status from database
          await fetchApplication()
        } catch (error: any) {
          console.error('Error refreshing timeline and application data:', error)
        }
      }, 500)
      
      // Only show generic success message if not handling exam result (which has its own message)
      if (stepKey !== 'quick_results' || !data?.result) {
        showToast('Timeline step updated successfully', 'success')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to update timeline step', 'error')
    }
  }

  function getStepStatus(stepKey: string): 'pending' | 'completed' {
    const step = timelineSteps.find(s => s.step_key === stepKey)
    return step?.status || 'pending'
  }

  function getStepData(stepKey: string): any {
    const step = timelineSteps.find(s => s.step_key === stepKey)
    return step?.data || null
  }

  // Calculate completion percentage based on timeline steps (matching tracking calculation)
  function calculateCompletionPercentage(): number {
    if (!application) {
      return 0
    }

    // Create a map of step statuses (matching tracking logic)
    const stepStatusMap: { [key: string]: any } = {}
    timelineSteps.forEach((step: any) => {
      stepStatusMap[step.step_key] = step
    })

    // Define all main steps and their sub-steps (matching server/routes/applications.js)
    const allStepsWithSubSteps = [
      {
        mainKey: 'app_submission',
        mainName: 'Application Submission',
        subSteps: [
          { key: 'app_created', checkFn: () => {
            const step = stepStatusMap['app_created']
            return (step && step.status === 'completed') || !!application.created_at
          }},
          { key: 'documents_submitted', checkFn: () => {
            const step = stepStatusMap['documents_submitted']
            return (step && step.status === 'completed') || !!(application.picture_path && application.diploma_path && application.passport_path)
          }},
          { key: 'app_paid', checkFn: () => {
            const step = stepStatusMap['app_paid']
            return (step && step.status === 'completed') || payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step1')
          }},
        ]
      },
      {
        mainKey: 'credentialing',
        mainName: 'Credentialing',
        subSteps: [
          { key: 'letter_generated', checkFn: () => {
            const step = stepStatusMap['letter_generated']
            return step && step.status === 'completed'
          }},
          { key: 'letter_submitted', checkFn: () => {
            const step = stepStatusMap['letter_submitted']
            return step && step.status === 'completed'
          }},
          { key: 'official_docs_submitted', checkFn: () => {
            const step = stepStatusMap['official_docs_submitted']
            return step && step.status === 'completed'
          }},
        ]
      },
      {
        mainKey: 'bon_application',
        mainName: 'BON Application',
        subSteps: [
          { key: 'mandatory_courses', checkFn: () => {
            const step = stepStatusMap['mandatory_courses']
            return step && step.status === 'completed'
          }},
          { key: 'form1_submitted', checkFn: () => {
            const step = stepStatusMap['form1_submitted']
            return step && step.status === 'completed'
          }},
          { key: 'app_step2_paid', checkFn: () => {
            const step = stepStatusMap['app_step2_paid']
            return (step && step.status === 'completed') || payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step2')
          }},
        ]
      },
      {
        mainKey: 'nclex_eligibility',
        mainName: 'NCLEX Eligibility',
        subSteps: [
          { key: 'nclex_eligibility_approved', checkFn: () => {
            const step = stepStatusMap['nclex_eligibility_approved']
            return step && step.status === 'completed'
          }},
        ]
      },
      {
        mainKey: 'pearson_vue',
        mainName: 'Pearson VUE Application',
        subSteps: [
          { key: 'pearson_account_created', checkFn: () => {
            const step = stepStatusMap['pearson_account_created']
            return (step && step.status === 'completed') || processingAccounts.some((acc: any) => acc.account_type === 'pearson_vue')
          }},
          { key: 'att_requested', checkFn: () => {
            const step = stepStatusMap['att_requested']
            return step && step.status === 'completed'
          }},
        ]
      },
      {
        mainKey: 'att',
        mainName: 'ATT',
        subSteps: [
          { key: 'att_received', checkFn: () => {
            const step = stepStatusMap['att_received']
            if (!step || !step.data) {
              return step && step.status === 'completed'
            }
            const data = typeof step.data === 'string' ? JSON.parse(step.data) : step.data
            const hasCodeAndExpiry = !!(data.code || data.att_code) && !!(data.expiry_date || data.att_expiry_date)
            return hasCodeAndExpiry || (step.status === 'completed')
          }},
        ]
      },
      {
        mainKey: 'nclex_exam',
        mainName: 'NCLEX Exam',
        subSteps: [
          { key: 'exam_date_booked', checkFn: () => {
            const step = stepStatusMap['exam_date_booked']
            if (!step || !step.data) {
              return step && step.status === 'completed'
            }
            const data = typeof step.data === 'string' ? JSON.parse(step.data) : step.data
            const hasAllDetails = !!(data.date || step.date) && !!(data.exam_time || data.time) && !!(data.exam_location || data.location)
            return hasAllDetails || (step.status === 'completed')
          }},
        ]
      },
      {
        mainKey: 'quick_results',
        mainName: 'Quick Results',
        subSteps: []
      }
    ]

    // Helper function to check if a main step is completed (matching tracking logic)
    const isMainStepCompleted = (mainStepKey: string, subSteps: any[]): boolean => {
      const mainStepData = stepStatusMap[mainStepKey]
      
      // If main step is explicitly marked as completed, return true
      if (mainStepData && mainStepData.status === 'completed') {
        return true
      }
      
      // Otherwise, check if all sub-steps are completed
      const allSubStepsCompleted = subSteps.every(subStep => subStep.checkFn())
      return allSubStepsCompleted
    }

    // Count completed items (main steps + sub-steps) - matching server logic
    let totalItems = 0
    let completedItems = 0

    for (const mainStep of allStepsWithSubSteps) {
      // Check main step - use isMainStepCompleted to check if all sub-steps are done OR main step is marked completed
      totalItems++
      if (isMainStepCompleted(mainStep.mainKey, mainStep.subSteps)) {
        completedItems++
      }

      // Check sub-steps
      for (const subStep of mainStep.subSteps) {
        totalItems++
        if (subStep.checkFn()) {
          completedItems++
        }
      }
    }

    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  }

  async function fetchProcessingAccounts() {
    // Use the id from URL (could be GRIT APP ID or UUID) - the API handles both
    if (!id) return
    setLoadingAccounts(true)
    try {
      const accounts = await processingAccountsAPI.getByApplication(id)
      setProcessingAccounts(accounts || [])
    } catch (error: any) {
      showToast(error.message || 'Failed to load processing accounts', 'error')
      setProcessingAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  async function handleSaveAccount() {
    if (!application?.id) {
      showToast('Application ID is required', 'error')
      return
    }

    // Validate based on account type
    if (accountForm.account_type === 'custom') {
      if (!accountForm.name || !accountForm.email || !accountForm.password) {
        showToast('Please fill in Name, Email/Username, and Password', 'error')
        return
      }
    } else {
      if (!accountForm.email || !accountForm.password) {
        showToast('Please fill in all required fields', 'error')
        return
      }
    }

    setSavingAccount(true)
    try {
      if (!application?.id) {
        throw new Error('Application ID is required')
      }

      // For editing, preserve the original account type
      // For creating, non-admin users can only create custom accounts
      const accountType = editingAccount 
        ? accountForm.account_type  // When editing, keep the original type
        : (!isAdmin() ? 'custom' : accountForm.account_type)  // When creating, non-admins can only create custom
      
      // Check if client is editing a Gmail account (clients can only update status and password)
      const isClientEditingGmail = editingAccount && accountType === 'gmail' && !isAdmin()
      
      const accountData: any = {
        account_type: accountType,
        email: accountForm.email,
        password: accountForm.password,
        status: accountForm.status || 'inactive'
      }

      // For clients editing Gmail accounts, only send status and password
      if (isClientEditingGmail) {
        const clientAccountData: any = {
          status: accountForm.status || 'inactive',
          password: accountForm.password
        }
        await processingAccountsAPI.update(editingAccount.id, clientAccountData)
      } else {
        // Add name and link for custom accounts
        if (accountType === 'custom') {
          accountData.name = accountForm.name
          accountData.link = accountForm.link || null
        }

        // Only include security questions for pearson_vue accounts
        if (accountType === 'pearson_vue') {
          accountData.security_question_1 = accountForm.security_question_1 || null
          accountData.security_question_2 = accountForm.security_question_2 || null
          accountData.security_question_3 = accountForm.security_question_3 || null
        }

        if (editingAccount) {
          await processingAccountsAPI.update(editingAccount.id, accountData)
        } else {
          await processingAccountsAPI.create(application.id, accountData)
        }
      }

      showToast(editingAccount ? 'Account updated successfully' : 'Account added successfully', 'success')
      setShowAccountModal(false)
      setEditingAccount(null)
      setIsUserForm(false)
      setAccountForm({ 
        account_type: 'gmail', 
        name: '',
        link: '',
        email: '', 
        password: '',
        security_question_1: '',
        security_question_2: '',
        security_question_3: '',
        status: 'active'
      })
      fetchProcessingAccounts()
    } catch (error: any) {
      showToast(error.message || 'Failed to save account', 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  function handleDeleteAccount(accountId: string) {
    const account = processingAccounts.find((acc: any) => acc.id === accountId)
    if (!account) return
    
    setDeleteConfirm({
      type: 'account',
      id: accountId,
      name: account.name || account.email
    })
  }

  const openAccountModal = (account?: any) => {
    if (account) {
      setEditingAccount(account)
      setAccountForm({
        account_type: account.account_type,
        name: account.name || '',
        link: account.link || '',
        email: account.email,
        password: account.password,
        security_question_1: account.security_question_1 || '',
        security_question_2: account.security_question_2 || '',
        security_question_3: account.security_question_3 || '',
        status: account.status || 'inactive'
      })
    } else {
      setEditingAccount(null)
      if (isUserForm) {
        setAccountForm({ 
          account_type: 'custom', 
          name: '',
          link: '',
          email: '', 
          password: '',
          security_question_1: '',
          security_question_2: '',
          security_question_3: '',
          status: 'active'
        })
      } else {
        setAccountForm({ 
          account_type: 'gmail', 
          name: '',
          link: '',
          email: '', 
          password: '',
          security_question_1: '',
          security_question_2: '',
          security_question_3: '',
          status: 'active'
        })
      }
    }
    setShowAccountModal(true)
  }

  async function updateStatus() {
    if (!application?.id) return
    setUpdating(true)

    try {
      // Save status to database (admin manual update)
      const newStatus = status as 'initiated' | 'in-progress' | 'rejected' | 'completed' | 'pending' | 'approved'
      await applicationsAPI.updateStatus(application.id, newStatus)
      // Refresh application data from Supabase to get the updated status
      await fetchApplication()
      // Update local status state to match
      setStatus(newStatus)
      showToast('Application status updated and saved to database!', 'success')
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update status'
      showToast(errorMessage, 'error')
    } finally {
      setUpdating(false)
    }
  }

  // Removed unused getFileUrlFromPath function

  // Async function to get signed URL for private files
  const getSignedUrlFromPath = async (path: string | null | undefined): Promise<string> => {
    if (!path || path.trim() === '') return ''
    try {
      // If path already contains http, return as is (legacy URLs)
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path
      }
      // For Supabase Storage private files, get signed URL
      return await getSignedFileUrl(path, 3600) // 1 hour expiry
    } catch (error) {
      console.error('Error getting signed URL:', error)
      // Fallback to public URL
      return getFileUrl(path)
    }
  }


  // Format status for consistent display (title case)
  const formatStatusDisplay = (status: string): string => {
    return status
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Calculate status based on timeline progress
  const calculateStatus = (): 'initiated' | 'in-progress' | 'rejected' | 'completed' | 'pending' | 'approved' => {
    // FIRST: Check the database status - this is the source of truth
    // Normalize status to lowercase for case-insensitive comparison
    const dbStatus = application?.status ? String(application.status).toLowerCase().trim() : null
    
    // If database status is explicitly completed or approved, return completed
    if (dbStatus === 'completed' || dbStatus === 'approved') {
      return 'completed'
    }
    
    // If status is manually set to rejected by admin, keep it
    if (dbStatus === 'rejected') {
      return 'rejected'
    }
    
    // Check if exam result has been declared (quick_results step with result data)
    const quickResultsData = getStepData('quick_results')
    const hasResult = !!(quickResultsData?.result)
    if (hasResult) {
      return 'completed'
    }
    
    // Check if quick_results step is marked as completed (even without result data)
    const quickResultsStep = getStepStatus('quick_results')
    if (quickResultsStep === 'completed') {
      return 'completed'
    }
    
    // Check if Application Submission is completed
    const appCreated = getStepStatus('app_created') === 'completed' || !!application?.created_at
    const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application?.picture_path && application?.diploma_path && application?.passport_path)
    const appPaid = getStepStatus('app_paid') === 'completed' || payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step1')
    const appSubmissionCompleted = appCreated && docsSubmitted && appPaid
    
    if (!appSubmissionCompleted) {
      return 'initiated'
    }
    
    return 'in-progress'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'initiated':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'approved': // Legacy support
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'pending': // Legacy support
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case 'initiated':
        return <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      case 'approved': // Legacy support
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'pending': // Legacy support
        return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      default:
        return <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
    }
  }


  const copyToClipboard = async (text: string, type: string = 'text') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'id') {
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } else {
        setCopiedEmail(true)
        setTimeout(() => setCopiedEmail(false), 2000)
      }
      showToast(`${type === 'id' ? 'Application ID' : 'Email'} copied to clipboard!`, 'success')
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error')
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
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <p>Application not found</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1 p-4 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/applications')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Application Details
            </h1>
          </div>

          {/* Application Header Card */}
          <Card className="mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {staggeredService?.service_name || 'NCLEX Processing'}, {staggeredService?.state || 'New York'}
                  </h2>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(calculateStatus() || application?.status || status)}`}>
                    {getStatusIcon(calculateStatus() || application?.status || status)}
                    {formatStatusDisplay(calculateStatus() || application?.status || status)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-mono">{application.grit_app_id || application.id}</span>
                    <button
                      onClick={() => copyToClipboard(application.grit_app_id || application.id, 'id')}
                      className="ml-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy GRIT APP ID"
                    >
                      {copiedId ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {application.created_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Created: {formatDate(application.created_at)}</span>
                    </div>
                  )}
                  {application.updated_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Updated: {formatDate(application.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                {/* Completion Percentage */}
                <div className="text-right">
                  {(() => {
                    const percentage = calculateCompletionPercentage()
                    let colorClass = ''
                    if (percentage === 100) {
                      colorClass = 'text-green-600 dark:text-green-400'
                    } else if (percentage >= 76) {
                      colorClass = 'text-blue-600 dark:text-blue-400'
                    } else if (percentage >= 51) {
                      colorClass = 'text-yellow-600 dark:text-yellow-400'
                    } else if (percentage >= 26) {
                      colorClass = 'text-orange-600 dark:text-orange-400'
                    } else {
                      colorClass = 'text-red-600 dark:text-red-400'
                    }
                    return (
                      <>
                        <div className={`text-3xl font-bold ${colorClass} mb-1`}>
                          {percentage}%
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Complete
                        </div>
                      </>
                    )
                  })()}
                </div>
                {/* Admin Status Update */}
                {isAdmin() && (
                  <div className="flex items-end gap-3">
                    <Select
                      label="Status"
                      value={application.status || status}
                      onChange={(e) => setStatus(e.target.value)}
                      options={[
                        { value: 'pending', label: 'Pending' },
                        { value: 'initiated', label: 'Initiated' },
                        { value: 'in-progress', label: 'In Progress' },
                        { value: 'approved', label: 'Approved' },
                        { value: 'rejected', label: 'Rejected' },
                        { value: 'completed', label: 'Completed' },
                      ]}
                    />
                    <Button onClick={updateStatus} disabled={updating}>
                      {updating ? 'Updating...' : 'Update Status'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            </Card>

          <div className="w-full">
            {/* Tab Headers */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
              <nav className="flex space-x-1" aria-label="Tabs">
                {[
                  { id: 'timeline', label: 'Timeline', icon: History },
                  { id: 'details', label: 'Application Details', icon: Info },
                  { id: 'documents', label: 'Documents', icon: FileText },
                  { id: 'processing-accounts', label: 'Processing Accounts', icon: Lock },
                  { id: 'payments', label: 'Payment History', icon: DollarSign },
                ].map((tabItem) => {
                  const Icon = tabItem.icon
                  const isActive = tab === tabItem.id
                  const basePath = isAdmin() ? '/admin/applications' : '/applications'
                  const tabPath = tabItem.id === 'payments' && isAdmin() 
                    ? `${basePath}/${application?.grit_app_id || id}/payments`
                    : `${basePath}/${application?.grit_app_id || id}/${tabItem.id}`
                  return (
                    <Link
                      key={tabItem.id}
                      to={tabPath}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        isActive
                          ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {tabItem.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {tab === 'timeline' && (
                <div className="space-y-6">
                  {loadingTimeline ? (
                    <Card>
                      <Loading />
                    </Card>
                  ) : (
                    <Card>
                      <div className="space-y-8">
                        {/* Step 1: Application Submission */}
                        <TimelineStep
                          stepNumber={1}
                          title="Application Submission"
                          isCompleted={(() => {
                            const appCreated = getStepStatus('app_created') === 'completed' || !!application.created_at
                            const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path && application.diploma_path && application.passport_path)
                            const appPaid = payments.some(p => p.status === 'paid' && p.payment_type === 'step1') || getStepStatus('app_paid') === 'completed'
                            return appCreated && docsSubmitted && appPaid
                          })()}
                          application={application}
                          payments={payments}
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('app_submission', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Check if all sub-steps are completed
                            setTimeout(async () => {
                              const appCreated = getStepStatus('app_created') === 'completed' || !!application.created_at
                              const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path && application.diploma_path && application.passport_path)
                              const appPaid = payments.some(p => p.status === 'paid' && (p.payment_type === 'step1' || p.payment_type === 'full')) || getStepStatus('app_paid') === 'completed'
                              
                              if (appCreated && docsSubmitted && appPaid) {
                                await updateTimelineStep('app_submission', 'completed', data)
                              } else {
                                await updateTimelineStep('app_submission', 'pending', {})
                              }
                            }, 100)
                          }}
                          subSteps={[
                            {
                              key: 'app_created',
                              label: 'Application created',
                              completed: getStepStatus('app_created') === 'completed' || !!application.created_at,
                              date: getStepData('app_created')?.date || application.created_at,
                              data: getStepData('app_created')
                            },
                            {
                              key: 'documents_submitted',
                              label: 'Required documents submitted',
                              completed: getStepStatus('documents_submitted') === 'completed' || !!(application.picture_path && application.diploma_path && application.passport_path),
                              date: getStepData('documents_submitted')?.date || application.created_at,
                              data: getStepData('documents_submitted')
                            },
                            {
                              key: 'app_paid',
                              label: 'Application Step 1 payment paid',
                              completed: payments.some(p => p.status === 'paid' && (p.payment_type === 'step1' || p.payment_type === 'full')) || getStepStatus('app_paid') === 'completed',
                              date: payments.find(p => p.status === 'paid' && (p.payment_type === 'step1' || p.payment_type === 'full'))?.paid_at || getStepData('app_paid')?.date,
                              data: (() => {
                                const paidStep1 = payments.find(p => p.status === 'paid' && p.payment_type === 'step1')
                                const paidFull = payments.find(p => p.status === 'paid' && p.payment_type === 'full')
                                const payment = paidStep1 || paidFull
                                const timelineData = getStepData('app_paid')
                                if (payment) {
                                  // Calculate total from all paid payments
                                  const totalPaid = payments
                                    .filter(p => p.status === 'paid')
                                    .reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0)
                                  return { 
                                    amount: payment.amount,
                                    total_amount_paid: totalPaid,
                                    ...timelineData
                                  }
                                }
                                return timelineData
                              })()
                            }
                          ]}
                        />

                        {/* Step 2: Credentialing */}
                        <TimelineStep
                          stepNumber={2}
                          title="Credentialing"
                          isCompleted={
                            getStepStatus('credentialing') === 'completed' ||
                            (getStepStatus('letter_generated') === 'completed' &&
                             getStepStatus('letter_submitted') === 'completed' &&
                             getStepStatus('official_docs_submitted') === 'completed')
                          }
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('credentialing', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Check if all sub-steps are completed
                            setTimeout(async () => {
                              const letterGenerated = getStepStatus('letter_generated') === 'completed'
                              const letterSubmitted = getStepStatus('letter_submitted') === 'completed'
                              const officialDocsSubmitted = getStepStatus('official_docs_submitted') === 'completed'
                              
                              if (letterGenerated && letterSubmitted && officialDocsSubmitted) {
                                await updateTimelineStep('credentialing', 'completed', data)
                              } else {
                                await updateTimelineStep('credentialing', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          showGenerateLetter={true}
                          subSteps={[
                            {
                              key: 'letter_generated',
                              label: 'Generated letter for school',
                              completed: getStepStatus('letter_generated') === 'completed',
                              date: getStepData('letter_generated')?.date,
                              data: getStepData('letter_generated')
                            },
                            {
                              key: 'letter_submitted',
                              label: 'Letter for school submitted',
                              completed: getStepStatus('letter_submitted') === 'completed',
                              date: getStepData('letter_submitted')?.date,
                              data: getStepData('letter_submitted')
                            },
                            {
                              key: 'official_docs_submitted',
                              label: 'Official Documents Sent by School to NY BON',
                              completed: getStepStatus('official_docs_submitted') === 'completed',
                              date: getStepData('official_docs_submitted')?.date,
                              data: getStepData('official_docs_submitted')
                            }
                          ]}
                        />

                        {/* Step 3: BON Application */}
                        <TimelineStep
                          stepNumber={3}
                          title="BON (Board of Nursing) Application"
                          isCompleted={(() => {
                            const mandatoryCourses = getStepStatus('mandatory_courses') === 'completed'
                            const form1Submitted = getStepStatus('form1_submitted') === 'completed'
                            const appStep2Paid = payments.some(p => p.status === 'paid' && (p.payment_type === 'step2' || p.payment_type === 'full')) || getStepStatus('app_step2_paid') === 'completed'
                            return mandatoryCourses && form1Submitted && appStep2Paid
                          })()}
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('bon_application', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Check if all sub-steps are completed
                            setTimeout(async () => {
                              const mandatoryCourses = getStepStatus('mandatory_courses') === 'completed'
                              const form1Submitted = getStepStatus('form1_submitted') === 'completed'
                              const appStep2Paid = payments.some(p => p.status === 'paid' && (p.payment_type === 'step2' || p.payment_type === 'full')) || getStepStatus('app_step2_paid') === 'completed'
                              
                              if (mandatoryCourses && form1Submitted && appStep2Paid) {
                                await updateTimelineStep('bon_application', 'completed', data)
                              } else {
                                await updateTimelineStep('bon_application', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          payments={payments}
                          subSteps={[
                            {
                              key: 'mandatory_courses',
                              label: 'Mandatory Courses Done',
                              completed: getStepStatus('mandatory_courses') === 'completed',
                              date: getStepData('mandatory_courses')?.date,
                              data: getStepData('mandatory_courses')
                            },
                            {
                              key: 'form1_submitted',
                              label: 'Form 1 Application form submitted',
                              completed: getStepStatus('form1_submitted') === 'completed',
                              date: getStepData('form1_submitted')?.date,
                              data: getStepData('form1_submitted')
                            },
                            {
                              key: 'app_step2_paid',
                              label: 'Application Step 2 payment paid',
                              completed: payments.some(p => p.status === 'paid' && (p.payment_type === 'step2' || p.payment_type === 'full')) || getStepStatus('app_step2_paid') === 'completed',
                              date: payments.find(p => p.status === 'paid' && (p.payment_type === 'step2' || p.payment_type === 'full'))?.paid_at || getStepData('app_step2_paid')?.date,
                              data: (() => {
                                const paidStep2 = payments.find(p => p.status === 'paid' && p.payment_type === 'step2')
                                const paidFull = payments.find(p => p.status === 'paid' && p.payment_type === 'full')
                                const timelineData = getStepData('app_step2_paid')
                                const payment = paidStep2 || paidFull
                                if (payment) {
                                  // Calculate total from all paid payments
                                  const totalPaid = payments
                                    .filter(p => p.status === 'paid')
                                    .reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0)
                                  return { 
                                    amount: payment.amount,
                                    total_amount_paid: totalPaid,
                                    ...timelineData
                                  }
                                }
                                return timelineData
                              })()
                            }
                          ]}
                        />

                        {/* Step 4: NCLEX Eligibility */}
                        <TimelineStep
                          stepNumber={4}
                          title="NCLEX Eligibility"
                          isCompleted={getStepStatus('nclex_eligibility_approved') === 'completed'}
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('nclex_eligibility', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Update parent step based on sub-step status
                            setTimeout(async () => {
                              const nclexEligibilityApproved = getStepStatus('nclex_eligibility_approved') === 'completed'
                              
                              if (nclexEligibilityApproved) {
                                await updateTimelineStep('nclex_eligibility', 'completed', data)
                              } else {
                                await updateTimelineStep('nclex_eligibility', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          subSteps={[
                            {
                              key: 'nclex_eligibility_approved',
                              label: 'NCLEX eligibility has been approved',
                              completed: getStepStatus('nclex_eligibility_approved') === 'completed',
                              date: getStepData('nclex_eligibility_approved')?.date,
                              data: getStepData('nclex_eligibility_approved')
                            }
                          ]}
                        />

                        {/* Step 5: Pearson VUE Application */}
                        <TimelineStep
                          stepNumber={5}
                          title="Pearson VUE Application"
                          isCompleted={(() => {
                            const pearsonAccountCreated = getStepStatus('pearson_account_created') === 'completed' || processingAccounts.some(acc => acc.account_type === 'pearson_vue')
                            const attRequested = getStepStatus('att_requested') === 'completed'
                            return pearsonAccountCreated && attRequested
                          })()}
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('pearson_vue', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Check if all sub-steps are completed
                            setTimeout(async () => {
                              const pearsonAccountCreated = getStepStatus('pearson_account_created') === 'completed' || processingAccounts.some(acc => acc.account_type === 'pearson_vue')
                              const attRequested = getStepStatus('att_requested') === 'completed'
                              
                              if (pearsonAccountCreated && attRequested) {
                                await updateTimelineStep('pearson_vue', 'completed', data)
                              } else {
                                await updateTimelineStep('pearson_vue', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          subSteps={[
                            {
                              key: 'pearson_account_created',
                              label: 'Pearson Vue Account Created',
                              completed: getStepStatus('pearson_account_created') === 'completed' || processingAccounts.some(acc => acc.account_type === 'pearson_vue'),
                              date: getStepData('pearson_account_created')?.date || processingAccounts.find(acc => acc.account_type === 'pearson_vue')?.created_at,
                              data: getStepData('pearson_account_created')
                            },
                            {
                              key: 'att_requested',
                              label: 'Request ATT submitted',
                              completed: getStepStatus('att_requested') === 'completed',
                              date: getStepData('att_requested')?.date,
                              data: getStepData('att_requested')
                            }
                          ]}
                        />

                        {/* Step 6: ATT */}
                        <TimelineStep
                          stepNumber={6}
                          title="ATT (Authorization to Test)"
                          isCompleted={(() => {
                            const attData = getStepData('att_received')
                            const hasAttCode = !!(attData?.code || attData?.att_code)
                            const hasExpiryDate = !!(attData?.expiry_date || attData?.att_expiry_date)
                            return hasAttCode && hasExpiryDate
                          })()}
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('att', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Update parent step based on sub-step data (ATT code and expiry date)
                            setTimeout(async () => {
                              const attData = getStepData('att_received')
                              const hasAttCode = !!(attData?.code || attData?.att_code)
                              const hasExpiryDate = !!(attData?.expiry_date || attData?.att_expiry_date)
                              
                              if (hasAttCode && hasExpiryDate) {
                                await updateTimelineStep('att_received', 'completed', attData)
                                await updateTimelineStep('att', 'completed', data)
                              } else {
                                await updateTimelineStep('att', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          attCode={getStepData('att_received')?.code || getStepData('att')?.code}
                          subSteps={[
                            {
                              key: 'att_received',
                              label: 'ATT has been Received',
                              completed: (() => {
                                const attData = getStepData('att_received')
                                const hasAttCode = !!(attData?.code || attData?.att_code)
                                const hasExpiryDate = !!(attData?.expiry_date || attData?.att_expiry_date)
                                return hasAttCode && hasExpiryDate
                              })(),
                              date: getStepData('att_received')?.date,
                              data: getStepData('att_received')
                            }
                          ]}
                        />

                        {/* Step 7: NCLEX Exam Date */}
                        <TimelineStep
                          stepNumber={7}
                          title="NCLEX Exam"
                          isCompleted={(() => {
                            const examData = getStepData('exam_date_booked')
                            const hasExamDate = !!(examData?.date || examData?.exam_date)
                            const hasExamTime = !!(examData?.time || examData?.exam_time)
                            const hasLocation = !!(examData?.location || examData?.exam_location)
                            return hasExamDate && hasExamTime && hasLocation
                          })()}
                          isAdmin={isAdmin()}
                          onUpdateStep={(status, data) => updateTimelineStep('nclex_exam', status as 'completed' | 'pending', data)}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Update parent step based on sub-step data (exam date, time, and location)
                            setTimeout(async () => {
                              const examData = getStepData('exam_date_booked')
                              const hasExamDate = !!(examData?.date || examData?.exam_date)
                              const hasExamTime = !!(examData?.time || examData?.exam_time)
                              const hasLocation = !!(examData?.location || examData?.exam_location)
                              
                              if (hasExamDate && hasExamTime && hasLocation) {
                                await updateTimelineStep('exam_date_booked', 'completed', examData)
                                await updateTimelineStep('nclex_exam', 'completed', data)
                              } else {
                                await updateTimelineStep('nclex_exam', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          subSteps={[
                            {
                              key: 'exam_date_booked',
                              label: 'Final Exam Date has been booked',
                              completed: (() => {
                                const examData = getStepData('exam_date_booked')
                                const hasExamDate = !!(examData?.date || examData?.exam_date)
                                const hasExamTime = !!(examData?.time || examData?.exam_time)
                                const hasLocation = !!(examData?.location || examData?.exam_location)
                                return hasExamDate && hasExamTime && hasLocation
                              })(),
                              date: getStepData('exam_date_booked')?.date,
                              data: getStepData('exam_date_booked')
                            }
                          ]}
                          examDate={getStepData('nclex_exam')?.date}
                          examLocation={getStepData('nclex_exam')?.location}
                          examTime={getStepData('nclex_exam')?.time}
                        />

                        {/* Step 8: Quick Results */}
                        <TimelineStep
                          stepNumber={8}
                          title="Quick Results"
                          isCompleted={(() => {
                            const quickResultsData = getStepData('quick_results')
                            const hasResult = !!(quickResultsData?.result)
                            return hasResult
                          })()}
                          isAdmin={isAdmin()}
                          onUpdateStep={async (status, data) => {
                            await updateTimelineStep('quick_results', status as 'completed' | 'pending', data)
                            // Auto-update application status to completed when exam result is declared (trigger-based update)
                            if (data?.result && application?.id) {
                              try {
                                await applicationsAPI.updateStatus(application.id, 'completed')
                                // Refresh application data from Supabase to get the updated status
                                await fetchApplication()
                                const resultText = data.result === 'pass' ? 'Passed' : data.result === 'failed' ? 'Failed' : data.result
                                showToast(`Exam result saved: ${resultText}. Application status updated to Completed.`, 'success')
                                // Refresh timeline to show updated status
                                setTimeout(() => {
                                  fetchTimelineSteps()
                                }, 500)
                              } catch (error: any) {
                                console.error('Error auto-updating status:', error)
                                showToast('Exam result saved, but failed to update application status. Please refresh the page.', 'error')
                              }
                            } else {
                              showToast('Exam result saved successfully', 'success')
                            }
                          }}
                          onUpdateSubStep={async (stepKey, status, data) => {
                            await updateTimelineStep(stepKey, status as 'completed' | 'pending', data)
                            // Check if result has been declared
                            setTimeout(async () => {
                              const quickResultsData = getStepData('quick_results')
                              const hasResult = !!(quickResultsData?.result)
                              
                              if (hasResult) {
                                await updateTimelineStep('quick_results', 'completed', data)
                                // Auto-update application status to completed when exam result is declared (trigger-based update)
                                if (application?.id) {
                                  try {
                                    await applicationsAPI.updateStatus(application.id, 'completed')
                                    // Refresh application data from Supabase to get the updated status
                                    await fetchApplication()
                                    const resultText = quickResultsData.result === 'pass' ? 'Passed' : quickResultsData.result === 'failed' ? 'Failed' : quickResultsData.result
                                    showToast(`Exam result saved: ${resultText}. Application status updated to Completed.`, 'success')
                                    // Refresh timeline to show updated status
                                    setTimeout(() => {
                                      fetchTimelineSteps()
                                    }, 500)
                                  } catch (error: any) {
                                    console.error('Error auto-updating status:', error)
                                    showToast('Exam result saved, but failed to update application status. Please refresh the page.', 'error')
                                  }
                                }
                              } else {
                                await updateTimelineStep('quick_results', 'pending', {})
                              }
                            }, 100)
                          }}
                          application={application}
                          payments={payments}
                          subSteps={[
                            {
                              key: 'quick_result_paid',
                              label: 'Quick Result request has been paid',
                              completed: payments.some(p => p.status === 'paid' && p.payment_type === 'quick_results') || getStepStatus('quick_result_paid') === 'completed' || !!(getStepData('quick_results')?.result),
                              date: payments.find(p => p.status === 'paid' && p.payment_type === 'quick_results')?.paid_at || getStepData('quick_result_paid')?.date,
                              data: payments.find(p => p.status === 'paid' && p.payment_type === 'quick_results') ? { amount: payments.find(p => p.status === 'paid' && p.payment_type === 'quick_results')?.amount } : getStepData('quick_result_paid')
                            },
                            {
                              key: 'exam_result',
                              label: 'Exam Result',
                              completed: (() => {
                                const quickResultsData = getStepData('quick_results')
                                return !!(quickResultsData?.result)
                              })(),
                              date: getStepData('quick_results')?.result_date,
                              data: getStepData('quick_results')
                            }
                          ]}
                          result={getStepData('quick_results')?.result}
                        />
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {tab === 'details' && (
                <div className="space-y-6">
                    <Card title={
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <span>Personal Information</span>
                      </div>
                    }>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    First Name
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.first_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Middle Name
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.middle_name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Last Name
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.last_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gender</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 capitalize">{application.gender}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Marital Status</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 capitalize">{application.marital_status}</p>
                </div>
                {application.marital_status === 'married' && (application.single_name || application.single_full_name) && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Single Name</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.single_full_name || application.single_name}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date of Birth
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatDate(application.date_of_birth)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Country of Birth
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.country_of_birth}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Place of Birth
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.place_of_birth || application.birth_place || 'N/A'}</p>
                </div>
              </div>
            </Card>

            <Card title={
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span>Contact Information</span>
              </div>
            }>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.email}</p>
                    <button
                      onClick={() => copyToClipboard(application.email, 'email')}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy Email"
                    >
                      {copiedEmail ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Mobile Number
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.mobile_number}</p>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Mailing Address
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {application.mailing_address || 
                     (application.house_number && application.street_name 
                       ? `${application.house_number} ${application.street_name}` 
                       : 'N/A')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">City</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.city}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Province</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.province}</p>
                </div>
                {application.country && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Country</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.country}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Zipcode</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.zipcode}</p>
                </div>
              </div>
            </Card>

            {/* Education Section */}
            {(application.elementary_school || application.high_school || application.nursing_school) && (
              <Card title={
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <span>Education</span>
                </div>
              }>
                <div className="space-y-6">
                  {/* Elementary School */}
                  {application.elementary_school && (
                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-4">
                        <School className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Elementary School</h4>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">School Name</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_school}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">City</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_city || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Province</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_province || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Country</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_country || 'N/A'}</p>
                        </div>
                        {application.elementary_years_attended && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Years Attended</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_years_attended}</p>
                          </div>
                        )}
                        {application.elementary_start_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Start Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_start_date}</p>
                          </div>
                        )}
                        {application.elementary_end_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              End Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.elementary_end_date}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* High School */}
                  {application.high_school && (
                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-4">
                        <School className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">High School</h4>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">School Name</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">City</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_city || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Province</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_province || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Country</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_country || 'N/A'}</p>
                        </div>
                        {application.high_school_years_attended && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Years Attended</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_years_attended}</p>
                          </div>
                        )}
                        {application.high_school_start_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Start Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_start_date}</p>
                          </div>
                        )}
                        {application.high_school_end_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              End Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_end_date}</p>
                          </div>
                        )}
                        {application.high_school_graduated && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Graduated</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 capitalize">{application.high_school_graduated}</p>
                          </div>
                        )}
                        {application.high_school_diploma_type && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Diploma Type</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_diploma_type}</p>
                          </div>
                        )}
                        {application.high_school_diploma_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Diploma Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.high_school_diploma_date}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nursing School */}
                  {application.nursing_school && (
                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nursing School</h4>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">School Name</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">City</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_city || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Province</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_province || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Country</p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_country || 'N/A'}</p>
                        </div>
                        {application.nursing_school_years_attended && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Years Attended</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_years_attended}</p>
                          </div>
                        )}
                        {application.nursing_school_start_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Start Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_start_date}</p>
                          </div>
                        )}
                        {application.nursing_school_end_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              End Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_end_date}</p>
                          </div>
                        )}
                        {application.nursing_school_major && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Major</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_major}</p>
                          </div>
                        )}
                        {application.nursing_school_diploma_date && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Diploma Date
                            </p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{application.nursing_school_diploma_date}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

                  </div>
              )}

              {tab === 'documents' && (
                <div className="space-y-6">
                    <Card title={
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <span>Required Documents</span>
                      </div>
                    }>
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* 2x2 Picture */}
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            2x2 Picture
                          </p>
                          {(() => {
                            // Use latest document from Documents page, fallback to stored path
                            let picturePath: string | null = latestDocuments.picture?.file_path || application.picture_path || null
                            const pictureName = latestDocuments.picture?.file_name || (application.picture_path?.split(/[/\\]/).pop() || 'picture.jpg')
                            
                            // Skip if path contains avatar
                            if (picturePath && picturePath.toLowerCase().includes('avatar')) {
                              picturePath = null
                            }
                            
                            // Normalize path and ensure it has userId prefix for Supabase Storage
                            if (picturePath) {
                              picturePath = picturePath.replace(/\\/g, '/')
                              
                              // Add userId prefix if needed (for legacy paths)
                              if (application.user_id && !picturePath.startsWith(application.user_id + '/')) {
                                if (!picturePath.includes('/')) {
                                  picturePath = `${application.user_id}/${picturePath}`
                                } else {
                                  const filename = picturePath.split('/').pop()
                                  if (filename) {
                                    picturePath = `${application.user_id}/${filename}`
                                  }
                                }
                              }
                            }
                            
                            return picturePath ? (
                              <>
                                <div className="relative group">
                                  <div 
                                    className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
                                    onClick={() => {
                                      handleViewFile(picturePath, pictureName)
                                    }}
                                  >
                                    {pictureError || !pictureUrl ? (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="h-16 w-16 text-gray-400" />
                                      </div>
                                    ) : (
                                      <img
                                        src={pictureUrl}
                                        alt="2x2 Picture"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        onError={() => setPictureError(true)}
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                            <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Not available</p>
                            </div>
                          )
                          })()}
                        </div>

                        {/* Nursing Diploma */}
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Nursing Diploma
                          </p>
                          {(() => {
                            // Use latest document from Documents page, fallback to stored path
                            let diplomaPath = latestDocuments.diploma?.file_path || application.diploma_path
                            const diplomaName = latestDocuments.diploma?.file_name || (application.diploma_path?.split(/[/\\]/).pop() || 'diploma.pdf')
                            
                            // Normalize path and ensure it has userId prefix for Supabase Storage
                            if (diplomaPath) {
                              diplomaPath = diplomaPath.replace(/\\/g, '/')
                              const isFromUserDocuments = !!latestDocuments.diploma?.file_path
                              
                              if (!isFromUserDocuments && application.user_id) {
                                if (!diplomaPath.startsWith(application.user_id + '/')) {
                                  if (!diplomaPath.includes('/')) {
                                    diplomaPath = `${application.user_id}/${diplomaPath}`
                                  } else {
                                    const filename = diplomaPath.split('/').pop()
                                    if (filename) {
                                      diplomaPath = `${application.user_id}/${filename}`
                                    }
                                  }
                                }
                              }
                            }
                            
                            return diplomaPath ? (
                              <>
                                <div className="relative group">
                                  <div 
                                    className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
                                    onClick={() => {
                                      handleViewFile(diplomaPath, diplomaName)
                                    }}
                                  >
                                    {(() => {
                                      const isImage = diplomaName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                                      return isImage ? (
                                        <DocumentImagePreview
                                          filePath={diplomaPath}
                                          alt="Nursing Diploma"
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <FileText className="h-12 w-12 text-gray-400" />
                                        </div>
                                      )
                                    })()}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Not available</p>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Passport */}
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Passport
                          </p>
                          {(() => {
                            // Use latest document from Documents page, fallback to stored path
                            let passportPath = latestDocuments.passport?.file_path || application.passport_path
                            const passportName = latestDocuments.passport?.file_name || (application.passport_path?.split(/[/\\]/).pop() || 'passport.pdf')
                            
                            // Normalize path and ensure it has userId prefix for Supabase Storage
                            if (passportPath) {
                              passportPath = passportPath.replace(/\\/g, '/')
                              const isFromUserDocuments = !!latestDocuments.passport?.file_path
                              
                              if (!isFromUserDocuments && application.user_id) {
                                if (!passportPath.startsWith(application.user_id + '/')) {
                                  if (!passportPath.includes('/')) {
                                    passportPath = `${application.user_id}/${passportPath}`
                                  } else {
                                    const filename = passportPath.split('/').pop()
                                    if (filename) {
                                      passportPath = `${application.user_id}/${filename}`
                                    }
                                  }
                                }
                              }
                            }
                            
                            return passportPath ? (
                              <>
                                <div className="relative group">
                                  <div 
                                    className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
                                    onClick={() => {
                                      handleViewFile(passportPath, passportName)
                                    }}
                                  >
                                    {(() => {
                                      const isImage = passportName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                                      return isImage ? (
                                        <DocumentImagePreview
                                          filePath={passportPath}
                                          alt="Passport"
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <FileText className="h-12 w-12 text-gray-400" />
                                        </div>
                                      )
                                    })()}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Not available</p>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </Card>

                    {/* Mandatory Courses Files */}
                    {application?.user_id && (
                      <Card title={
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <span>Mandatory Courses Files</span>
                        </div>
                      }>
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Infection Control and Barrier Precautions */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Infection Control and Barrier Precautions
                              </p>
                              {isAdmin() && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0]
                                    if (!file || !application?.user_id) return

                                    setUploadingCourseFile(true)
                                    try {
                                      // Auto-rename file: "Infection Control and Barrier Precautions" + first_name + last_name + extension
                                      const firstName = application.first_name || ''
                                      const lastName = application.last_name || ''
                                      const fileExtension = file.name.split('.').pop() || ''
                                      const sanitizedName = `${firstName}_${lastName}`.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_')
                                      const newFileName = `Infection_Control_and_Barrier_Precautions_${sanitizedName}.${fileExtension}`
                                      
                                      // Create a new File object with the renamed file
                                      const renamedFile = new File([file], newFileName, { type: file.type })
                                      
                                      await userDocumentsAPI.uploadForUser(
                                        application.user_id,
                                        'mandatory_course_infection_control',
                                        renamedFile
                                      )
                                      
                                      showToast('Course file uploaded successfully', 'success')
                                      
                                      // Refresh documents
                                      const docs = await userDocumentsAPI.getByUserId(application.user_id)
                                      const courseFiles: any[] = []
                                      docs.forEach((doc: any) => {
                                        if (doc.document_type?.startsWith('mandatory_course')) {
                                          courseFiles.push(doc)
                                        }
                                      })
                                      setMandatoryCourseFiles(courseFiles)
                                    } catch (error: any) {
                                      showToast(error.message || 'Failed to upload file', 'error')
                                    } finally {
                                      setUploadingCourseFile(false)
                                    }
                                  }
                                  input.click()
                                }}
                                  disabled={uploadingCourseFile || !!mandatoryCourseFiles.find((f: any) => f.document_type === 'mandatory_course_infection_control')}
                                  className={mandatoryCourseFiles.find((f: any) => f.document_type === 'mandatory_course_infection_control') ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  {uploadingCourseFile ? 'Uploading...' : 'Upload'}
                                </Button>
                              )}
                            </div>
                            {(() => {
                              const courseFile = mandatoryCourseFiles.find(
                                (f: any) => f.document_type === 'mandatory_course_infection_control'
                              )
                              
                              if (!courseFile) {
                                return (
                                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                                    <div className="text-center">
                                      <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                      <p className="text-sm text-gray-500 dark:text-gray-400">No file uploaded</p>
                                    </div>
                                  </div>
                                )
                              }
                              
                              const isImage = courseFile.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                              const fileName = courseFile.file_name || 'course_file'
                              
                              return (
                                <div className="space-y-2">
                                  <div
                                    className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer group relative"
                                    onClick={async () => {
                                      try {
                                        const signedUrl = await getSignedFileUrl(courseFile.file_path, 3600)
                                        const isImageFile = fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                                        setViewingFile({
                                          url: signedUrl,
                                          fileName: fileName,
                                          isImage: !!isImageFile
                                        })
                                      } catch (error) {
                                        showToast('Failed to load file', 'error')
                                      }
                                    }}
                                  >
                                    {isImage ? (
                                      <DocumentImagePreview
                                        filePath={courseFile.file_path}
                                        alt={fileName}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                    ) : fileName?.toLowerCase().endsWith('.pdf') ? (
                                      <DocumentPDFPreview
                                        filePath={courseFile.file_path}
                                        alt={fileName}
                                        className="w-full h-full border-0"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="h-12 w-12 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {isAdmin() && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setDeleteConfirm({
                                            type: 'file',
                                            id: courseFile.id,
                                            name: fileName
                                          })
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        title="Delete file"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={fileName}>
                                    {fileName}
                                  </div>
                                  {courseFile.uploaded_at && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500">
                                      Uploaded: {new Date(courseFile.uploaded_at).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>

                          {/* Child Abuse: New York Mandated Reporter Training */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Child Abuse: New York Mandated Reporter Training
                              </p>
                              {isAdmin() && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0]
                                    if (!file || !application?.user_id) return

                                    setUploadingCourseFile(true)
                                    try {
                                      // Auto-rename file: "Child Abuse New York Mandated Reporter Training" + first_name + last_name + extension
                                      const firstName = application.first_name || ''
                                      const lastName = application.last_name || ''
                                      const fileExtension = file.name.split('.').pop() || ''
                                      const sanitizedName = `${firstName}_${lastName}`.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_')
                                      const newFileName = `Child_Abuse_New_York_Mandated_Reporter_Training_${sanitizedName}.${fileExtension}`
                                      
                                      // Create a new File object with the renamed file
                                      const renamedFile = new File([file], newFileName, { type: file.type })
                                      
                                      await userDocumentsAPI.uploadForUser(
                                        application.user_id,
                                        'mandatory_course_child_abuse',
                                        renamedFile
                                      )
                                      
                                      showToast('Course file uploaded successfully', 'success')
                                      
                                      // Refresh documents
                                      const docs = await userDocumentsAPI.getByUserId(application.user_id)
                                      const courseFiles: any[] = []
                                      docs.forEach((doc: any) => {
                                        if (doc.document_type?.startsWith('mandatory_course')) {
                                          courseFiles.push(doc)
                                        }
                                      })
                                      setMandatoryCourseFiles(courseFiles)
                                    } catch (error: any) {
                                      showToast(error.message || 'Failed to upload file', 'error')
                                    } finally {
                                      setUploadingCourseFile(false)
                                    }
                                  }
                                  input.click()
                                }}
                                  disabled={uploadingCourseFile || !!mandatoryCourseFiles.find((f: any) => f.document_type === 'mandatory_course_child_abuse')}
                                  className={mandatoryCourseFiles.find((f: any) => f.document_type === 'mandatory_course_child_abuse') ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  {uploadingCourseFile ? 'Uploading...' : 'Upload'}
                                </Button>
                              )}
                            </div>
                            {(() => {
                              const courseFile = mandatoryCourseFiles.find(
                                (f: any) => f.document_type === 'mandatory_course_child_abuse'
                              )
                              
                              if (!courseFile) {
                                return (
                                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                                    <div className="text-center">
                                      <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                      <p className="text-sm text-gray-500 dark:text-gray-400">No file uploaded</p>
                                    </div>
                                  </div>
                                )
                              }
                              
                              const isImage = courseFile.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                              const fileName = courseFile.file_name || 'course_file'
                              
                              return (
                                <div className="space-y-2">
                                  <div
                                    className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer group relative"
                                    onClick={async () => {
                                      try {
                                        const signedUrl = await getSignedFileUrl(courseFile.file_path, 3600)
                                        const isImageFile = fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                                        setViewingFile({
                                          url: signedUrl,
                                          fileName: fileName,
                                          isImage: !!isImageFile
                                        })
                                      } catch (error) {
                                        showToast('Failed to load file', 'error')
                                      }
                                    }}
                                  >
                                    {isImage ? (
                                      <DocumentImagePreview
                                        filePath={courseFile.file_path}
                                        alt={fileName}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                    ) : fileName?.toLowerCase().endsWith('.pdf') ? (
                                      <DocumentPDFPreview
                                        filePath={courseFile.file_path}
                                        alt={fileName}
                                        className="w-full h-full border-0"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="h-12 w-12 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {isAdmin() && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setDeleteConfirm({
                                            type: 'file',
                                            id: courseFile.id,
                                            name: fileName
                                          })
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        title="Delete file"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={fileName}>
                                    {fileName}
                                  </div>
                                  {courseFile.uploaded_at && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500">
                                      Uploaded: {new Date(courseFile.uploaded_at).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
              )}

              {tab === 'processing-accounts' && (
                <div className="space-y-6">
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Processing Accounts</h3>
                        <div className="flex gap-2">
                          {!isAdmin() && (
                            <Button onClick={() => {
                              setIsUserForm(true)
                              openAccountModal()
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Account
                            </Button>
                          )}
                          {isAdmin() && (
                            <Button onClick={() => {
                              setIsUserForm(false)
                              openAccountModal()
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Account
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                    {loadingAccounts ? (
                      <Card>
                        <Loading />
                      </Card>
                    ) : processingAccounts.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-4">
                        {processingAccounts.map((account) => (
                          <Card key={account.id}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    account.account_type === 'gmail'
                                      ? 'bg-blue-100 dark:bg-blue-900/30'
                                      : account.account_type === 'pearson_vue'
                                      ? 'bg-purple-100 dark:bg-purple-900/30'
                                      : 'bg-green-100 dark:bg-green-900/30'
                                  }`}>
                                    <Mail className={`h-5 w-5 ${
                                      account.account_type === 'gmail'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : account.account_type === 'pearson_vue'
                                        ? 'text-purple-600 dark:text-purple-400'
                                        : 'text-green-600 dark:text-green-400'
                                    }`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                                        {account.account_type === 'gmail' 
                                          ? 'Gmail Account' 
                                          : account.account_type === 'pearson_vue' 
                                          ? 'Pearson Vue Account'
                                          : account.name || 'Custom Account'}
                                      </h4>
                                      {(account.account_type === 'gmail' || account.account_type === 'pearson_vue') && (
                                        <a
                                          href={
                                            account.account_type === 'gmail'
                                              ? 'https://mail.google.com/mail/u/0/#inbox'
                                              : 'https://wsr.pearsonvue.com/testtaker/signin/SignInPage.htm?clientCode=NCLEXTESTING'
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                          title={
                                            account.account_type === 'gmail'
                                              ? 'Open Gmail'
                                              : 'Open Pearson Vue'
                                          }
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                      {account.account_type === 'custom' && account.link && (
                                        <a
                                          href={account.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                          title="Open Link"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                        account.status === 'active'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                      }`}>
                                        {account.status === 'active' ? (
                                          <CheckCircle className="h-3 w-3" />
                                        ) : (
                                          <XCircle className="h-3 w-3" />
                                        )}
                                        {account.status === 'active' ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Added {account.created_at ? formatDate(account.created_at) : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-3 mt-4">
                                  <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.email}</p>
                                      <button
                                        onClick={() => copyToClipboard(account.email, 'email')}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                        title="Copy Email"
                                      >
                                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Password</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{account.password}</p>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(account.password)
                                            showToast('Password copied to clipboard!', 'success')
                                          } catch (error) {
                                            showToast('Failed to copy password', 'error')
                                          }
                                        }}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                        title="Copy Password"
                                      >
                                        <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  {account.account_type === 'pearson_vue' && (
                                    <>
                                      {account.security_question_1 && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Security Question 1</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{account.security_question_1}</p>
                                            <button
                                              onClick={() => copyToClipboard(account.security_question_1, 'security question 1')}
                                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                              title="Copy Security Question 1"
                                            >
                                              <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {account.security_question_2 && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Security Question 2</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{account.security_question_2}</p>
                                            <button
                                              onClick={() => copyToClipboard(account.security_question_2, 'security question 2')}
                                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                              title="Copy Security Question 2"
                                            >
                                              <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {account.security_question_3 && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Security Question 3</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{account.security_question_3}</p>
                                            <button
                                              onClick={() => copyToClipboard(account.security_question_3, 'security question 3')}
                                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                              title="Copy Security Question 3"
                                            >
                                              <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsUserForm(account.account_type === 'custom')
                                      openAccountModal(account)
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                  {(isAdmin() || (account.account_type === 'custom' && account.created_by === user?.id)) && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteAccount(account.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <div className="py-8 text-center">
                          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 dark:text-gray-400">No processing accounts available for this application.</p>
                        </div>
                      </Card>
                    )}
                  </div>
              )}

              {tab === 'payments' && (
                <div className="space-y-6">
                  {loadingPayments ? (
                    <Card>
                      <Loading />
                    </Card>
                  ) : (
                    <>
                      {(() => {
                        const pendingPayments = payments.filter((p: any) => p.status === 'pending')
                        const paidPayments = payments.filter((p: any) => p.status === 'paid')
                        const completedPaymentTypes = paidPayments.map((p: any) => p.payment_type)

                        return (
                          <>
                            {/* Pending Payments Section */}
                            <div className="mb-8">
                              <div className="flex items-center gap-2 mb-4">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                  Payments Needed
                                </h2>
                              </div>

                              {pendingPayments.length > 0 ? (
                                <div className="space-y-4">
                                  {pendingPayments.map((payment: any) => (
                                    <Card key={payment.id} className="p-6">
                                      <div className="flex items-start justify-between mb-4">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                              {payment.payment_type === 'step1' ? 'Step 1 Payment' : 
                                               payment.payment_type === 'step2' ? 'Step 2 Payment' : 
                                               'Full Payment'}
                                            </h3>
                                          </div>
                                          <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Payment ID: {payment.id}
                                          </p>
                                          <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Created: {formatDate(payment.created_at)}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                            {formatCurrency(payment.amount)}
                                          </p>
                                          <Button
                                            onClick={() => handleCompletePayment(payment)}
                                            disabled={processingPayments}
                                            className="flex items-center gap-2"
                                          >
                                            <CreditCard className="h-4 w-4" />
                                            Complete Payment
                                          </Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <Card className="p-6">
                                  <div className="text-center py-8">
                                    <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">
                                      No pending payments. All payments are up to date.
                                    </p>
                                  </div>
                                </Card>
                              )}

                              {/* Available Payments to Create */}
                              {pendingPayments.length === 0 && (
                                <Card className="mt-6 p-6">
                                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                                    Create New Payment
                                  </h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                    Complete your payments in steps. Step 1 must be completed before Step 2.
                                  </p>

                                  <div className="space-y-4">
                                    {/* Step 1 */}
                                    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">STEP 1</h4>
                                        {completedPaymentTypes.includes('step1') && (
                                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        )}
                                      </div>
                                      {loadingServices ? (
                                        <div className="text-center py-4">
                                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading pricing...</p>
                                        </div>
                                      ) : staggeredService ? (
                                        <>
                                          <div className="space-y-2 mb-4">
                                            {staggeredService.line_items
                                              ?.filter((item: any) => item.step === 1 || !item.step)
                                              .map((item: any, idx: number) => {
                                                const itemTax = calculateItemTax(item)
                                                const itemTotal = calculateItemTotal(item)
                                                return (
                                                  <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-sm">
                                                      <span className="text-gray-700 dark:text-gray-300">
                                                        {item.description}
                                                        {item.taxable && (
                                                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                                        )}
                                                      </span>
                                                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                        {formatCurrency(item.amount)}
                                                      </span>
                                                    </div>
                                                    {item.taxable && itemTax > 0 && (
                                                      <div className="flex justify-between text-xs pl-4 text-gray-600 dark:text-gray-400">
                                                        <span>Tax (12%):</span>
                                                        <span>{formatCurrency(itemTax)}</span>
                                                      </div>
                                                    )}
                                                    {item.taxable && (
                                                      <div className="flex justify-between text-sm pl-4 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                                                        <span>Subtotal:</span>
                                                        <span>{formatCurrency(itemTotal)}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                          </div>
                                          <div className="space-y-2 mb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex justify-between text-sm">
                                              <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                {formatCurrency((staggeredService.total_step1 || 0) - (staggeredService.tax_step1 || 0))}
                                              </span>
                                            </div>
                                            {staggeredService.tax_step1 && staggeredService.tax_step1 > 0 && (
                                              <div className="flex justify-between text-sm">
                                                <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                                                <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                  {formatCurrency(staggeredService.tax_step1)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mb-4">
                                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                              {formatCurrency(staggeredService.total_step1 || 0)}
                                            </span>
                                          </div>
                                          {!completedPaymentTypes.includes('step1') && (
                                            <Button
                                              className="w-full"
                                              onClick={() => handleCreatePayment('step1')}
                                              disabled={processingPayments}
                                            >
                                              <CreditCard className="h-4 w-4 mr-2" />
                                              Create Payment for {formatCurrency(staggeredService.total_step1 || 0)}
                                            </Button>
                                          )}
                                        </>
                                      ) : (
                                        <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                                          <p>Service pricing not available. Please contact support.</p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Step 2 */}
                                    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">STEP 2</h4>
                                        {completedPaymentTypes.includes('step2') && (
                                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        )}
                                      </div>
                                      {loadingServices ? (
                                        <div className="text-center py-4">
                                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading pricing...</p>
                                        </div>
                                      ) : staggeredService ? (
                                        <>
                                          <div className="space-y-2 mb-4">
                                            {staggeredService.line_items
                                              ?.filter((item: any) => item.step === 2)
                                              .map((item: any, idx: number) => {
                                                const itemTax = calculateItemTax(item)
                                                const itemTotal = calculateItemTotal(item)
                                                return (
                                                  <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-sm">
                                                      <span className="text-gray-700 dark:text-gray-300">
                                                        {item.description}
                                                        {item.taxable && (
                                                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                                        )}
                                                      </span>
                                                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                        {formatCurrency(item.amount)}
                                                      </span>
                                                    </div>
                                                    {item.taxable && itemTax > 0 && (
                                                      <div className="flex justify-between text-xs pl-4 text-gray-600 dark:text-gray-400">
                                                        <span>Tax (12%):</span>
                                                        <span>{formatCurrency(itemTax)}</span>
                                                      </div>
                                                    )}
                                                    {item.taxable && (
                                                      <div className="flex justify-between text-sm pl-4 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                                                        <span>Subtotal:</span>
                                                        <span>{formatCurrency(itemTotal)}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                          </div>
                                          <div className="space-y-2 mb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex justify-between text-sm">
                                              <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                {formatCurrency((staggeredService.total_step2 || 0) - (staggeredService.tax_step2 || 0))}
                                              </span>
                                            </div>
                                            {staggeredService.tax_step2 && staggeredService.tax_step2 > 0 && (
                                              <div className="flex justify-between text-sm">
                                                <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                                                <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                  {formatCurrency(staggeredService.tax_step2)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 mb-4">
                                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                              {formatCurrency(staggeredService.total_step2 || 0)}
                                            </span>
                                          </div>
                                          {!completedPaymentTypes.includes('step2') && (
                                            <Button
                                              className="w-full"
                                              onClick={() => handleCreatePayment('step2')}
                                              disabled={processingPayments || !completedPaymentTypes.includes('step1')}
                                            >
                                              <CreditCard className="h-4 w-4 mr-2" />
                                              Create Payment for {formatCurrency(staggeredService.total_step2 || 0)}
                                            </Button>
                                          )}
                                          {!completedPaymentTypes.includes('step1') && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                                              Complete Step 1 first
                                            </p>
                                          )}
                                        </>
                                      ) : (
                                        <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                                          <p>Service pricing not available. Please contact support.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Card>
                              )}
                            </div>

                            {/* Paid Payments Section */}
                            <div className="mb-8">
                              <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                  Paid Payments
                                </h2>
                              </div>

                              {paidPayments.length > 0 ? (
                                <div className="space-y-4">
                                  {paidPayments.map((payment: any) => (
                                    <Card key={payment.id} className="p-6">
                                      <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                              {payment.payment_type === 'step1' ? 'Step 1 Payment' : 
                                               payment.payment_type === 'step2' ? 'Step 2 Payment' : 
                                               'Full Payment'}
                                            </h3>
                                          </div>
                                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                            <p>Payment ID: {payment.id}</p>
                                            {payment.transaction_id && (
                                              <p>Transaction ID: <span className="font-mono">{payment.transaction_id}</span></p>
                                            )}
                                            <p>Paid: {formatDate(payment.updated_at || payment.created_at)}</p>
                                            {payment.payment_method && (
                                              <p>Method: {payment.payment_method}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                                            {formatCurrency(payment.amount)}
                                          </p>
                                          {receipts[payment.id] && (
                                            <div className="flex gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewReceipt(payment.id)}
                                                className="flex items-center gap-2"
                                              >
                                                <Eye className="h-4 w-4" />
                                                View Receipt
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownloadReceipt(receipts[payment.id])}
                                                className="flex items-center gap-2"
                                              >
                                                <Download className="h-4 w-4" />
                                                Download
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <Card className="p-6">
                                  <div className="text-center py-8">
                                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">
                                      No paid payments yet.
                                    </p>
                                  </div>
                                </Card>
                              )}
                            </div>

                            {/* Payment History Section */}
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                  Payment History
                                </h2>
                              </div>

                              {payments.length > 0 ? (
                                <Card className="p-6">
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {payments.map((payment: any) => (
                                          <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                              {formatDate(payment.created_at)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                                              {payment.payment_type === 'step1' ? 'Step 1' : 
                                               payment.payment_type === 'step2' ? 'Step 2' : 
                                               'Full'}
                                            </td>
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {formatCurrency(payment.amount)}
                                            </td>
                                            <td className="py-3 px-4">
                                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                payment.status === 'paid' 
                                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                                  : payment.status === 'pending'
                                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                              }`}>
                                                {payment.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                                                {payment.status === 'pending' && <Clock className="h-3 w-3" />}
                                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                              </span>
                                            </td>
                                            <td className="py-3 px-4">
                                              <div className="flex items-center gap-2">
                                                {payment.status === 'pending' && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleCompletePayment(payment)}
                                                    disabled={processingPayments}
                                                    className="text-xs"
                                                  >
                                                    Complete
                                                  </Button>
                                                )}
                                                {payment.status === 'paid' && receipts[payment.id] && (
                                                  <>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleViewReceipt(payment.id)}
                                                      className="text-xs flex items-center gap-1"
                                                    >
                                                      <Eye className="h-3 w-3" />
                                                      Receipt
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleDownloadReceipt(receipts[payment.id])}
                                                      className="text-xs flex items-center gap-1"
                                                    >
                                                      <Download className="h-3 w-3" />
                                                    </Button>
                                                  </>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </Card>
                              ) : (
                                <Card className="p-6">
                                  <div className="text-center py-8">
                                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">
                                      No payment history available.
                                    </p>
                                  </div>
                                </Card>
                              )}
                            </div>
                          </>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Processing Account Modal */}
          <Modal
            isOpen={showAccountModal}
            onClose={() => {
              setShowAccountModal(false)
              setEditingAccount(null)
              setIsUserForm(false)
              setAccountForm({ 
                account_type: 'gmail', 
                name: '',
                link: '',
                email: '', 
                password: '',
                security_question_1: '',
                security_question_2: '',
                security_question_3: '',
                status: 'inactive'
              })
            }}
            title={editingAccount ? 'Edit Processing Account' : 'Add Processing Account'}
            size="md"
          >
            <div className="space-y-4">
              {accountForm.account_type === 'custom' ? (
                // Custom account form
                <>
                  <Input
                    label="Name"
                    type="text"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    placeholder="Enter account name"
                    required
                  />
                  <Input
                    label="Link"
                    type="url"
                    value={accountForm.link}
                    onChange={(e) => setAccountForm({ ...accountForm, link: e.target.value })}
                    placeholder="https://example.com"
                  />
                  <Input
                    label="Email/Username"
                    type="text"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                    placeholder="Enter email or username"
                    required
                  />
                  <Input
                    label="Password"
                    type="text"
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    placeholder="Enter password"
                    required
                  />
                </>
              ) : (
                // Gmail/Pearson Vue account form
                <>
                  {isAdmin() && !editingAccount && (
                    <Select
                      label="Account Type"
                      value={accountForm.account_type}
                      onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                      options={[
                        { value: 'gmail', label: 'Gmail Account' },
                        { value: 'pearson_vue', label: 'Pearson Vue Account' },
                      ]}
                      required
                    />
                  )}
                  {editingAccount && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Account Type
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                        {accountForm.account_type === 'gmail' ? 'Gmail Account' : 'Pearson Vue Account'}
                      </p>
                    </div>
                  )}
                  <Input
                    label="Email"
                    type="email"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                    placeholder="account@example.com"
                    required
                    disabled={editingAccount && accountForm.account_type === 'gmail' && !isAdmin()}
                    title={editingAccount && accountForm.account_type === 'gmail' && !isAdmin() ? 'Email cannot be changed' : ''}
                  />
                  <Input
                    label="Password"
                    type="text"
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    placeholder="Enter password"
                    required
                  />
                  {accountForm.account_type === 'pearson_vue' && (
                    <div className="space-y-4 pt-2">
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Security Questions</h4>
                        <Input
                          label="Security Question 1"
                          type="text"
                          value={accountForm.security_question_1}
                          onChange={(e) => setAccountForm({ ...accountForm, security_question_1: e.target.value })}
                          placeholder="Enter security question 1"
                        />
                        <Input
                          label="Security Question 2"
                          type="text"
                          value={accountForm.security_question_2}
                          onChange={(e) => setAccountForm({ ...accountForm, security_question_2: e.target.value })}
                          placeholder="Enter security question 2"
                        />
                        <Input
                          label="Security Question 3"
                          type="text"
                          value={accountForm.security_question_3}
                          onChange={(e) => setAccountForm({ ...accountForm, security_question_3: e.target.value })}
                          placeholder="Enter security question 3"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <Select
                label="Status"
                value={accountForm.status || 'active'}
                onChange={(e) => setAccountForm({ ...accountForm, status: e.target.value })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                required
              />
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSaveAccount}
                  disabled={
                    savingAccount || 
                    (accountForm.account_type === 'custom' 
                      ? (!accountForm.name || !accountForm.email || !accountForm.password)
                      : (!accountForm.email || !accountForm.password))
                  }
                  className="flex-1"
                >
                  {savingAccount ? 'Saving...' : editingAccount ? 'Update Account' : 'Add Account'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAccountModal(false)
                    setEditingAccount(null)
                    setIsUserForm(false)
                    setAccountForm({ 
                      account_type: 'gmail', 
                      name: '',
                      link: '',
                      email: '', 
                      password: '',
                      security_question_1: '',
                      security_question_2: '',
                      security_question_3: '',
                      status: 'active'
                    })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>

          {/* Stripe Payment Modal */}
          {showPaymentModal && selectedPayment && clientSecret && stripePromise && (
            <Modal
              isOpen={showPaymentModal}
              onClose={() => {
                setShowPaymentModal(false)
                setSelectedPayment(null)
                setClientSecret(null)
                setPaymentIntentId(null)
              }}
              title={`Complete Payment - ${formatCurrency(selectedPayment.amount)}`}
            >
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripePaymentForm
                  paymentIntentId={paymentIntentId || undefined}
                  amount={selectedPayment.amount}
                  onSuccess={(paymentIntentId: string, paymentMethod?: 'card' | 'gcash' | 'mobile_banking', ...args: any[]) => {
                    // StripePaymentForm may pass gcashDetails as third argument and proofFile as fourth
                    const gcashDetails = args[0] as { number: string; reference: string } | undefined
                    const proofFile = args[1] as File | undefined
                    handlePaymentSuccess(paymentIntentId, paymentMethod, gcashDetails, proofFile)
                  }}
                  onError={(error: string) => showToast(error, 'error')}
                />
              </Elements>
            </Modal>
          )}

          {/* Receipt Modal */}
          {showReceiptModal && viewingReceipt && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Receipt {viewingReceipt.receipt_number}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReceipt(viewingReceipt)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowReceiptModal(false)
                        setViewingReceipt(null)
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                      <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">GritSync</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receipt #{viewingReceipt.receipt_number}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Date: {new Date(viewingReceipt.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-3 mb-4">
                      {viewingReceipt.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-4 border-t-2 border-gray-900 dark:border-gray-100">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(viewingReceipt.amount)}</span>
                    </div>
                  </div>
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                    <p>Thank you for your payment!</p>
                    <p className="mt-1">GritSync - NCLEX Application Services</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => !deleting && setDeleteConfirm(null)}
        title="Confirm Delete"
        size="md"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {deleteConfirm.type === 'file' 
                    ? 'Delete File' 
                    : 'Delete Account'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {deleteConfirm.type === 'file'
                    ? `Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`
                    : `Are you sure you want to delete this account? This action cannot be undone.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  if (!deleteConfirm) return
                  
                  setDeleting(true)
                  try {
                    if (deleteConfirm.type === 'file') {
                      await userDocumentsAPI.delete(deleteConfirm.id)
                      
                      // Optimistically remove from state immediately
                      setMandatoryCourseFiles((prev) => 
                        prev.filter((f: any) => f.id !== deleteConfirm.id)
                      )
                      
                      showToast('File deleted successfully', 'success')
                    } else if (deleteConfirm.type === 'account') {
                      await processingAccountsAPI.delete(deleteConfirm.id)
                      showToast('Account deleted successfully', 'success')
                      
                      // Refresh accounts
                      if (application?.id) {
                        const accounts = await processingAccountsAPI.getByApplication(application.id)
                        setProcessingAccounts(accounts)
                      }
                    }
                    setDeleteConfirm(null)
                  } catch (error: any) {
                    showToast(error.message || 'Failed to delete', 'error')
                  } finally {
                    setDeleting(false)
                  }
                }}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* File View Modal */}
      <Modal
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        title={viewingFile?.fileName}
        size="xl"
      >
        {viewingFile && (
          <div className="space-y-4 -mx-4 -mt-4">
            {viewingFile.isImage ? (
              <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4">
                <img
                  src={viewingFile.url}
                  alt={viewingFile.fileName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={() => {
                    showToast('Failed to load image', 'error')
                  }}
                />
              </div>
            ) : viewingFile.fileName?.toLowerCase().endsWith('.pdf') ? (
              <div className="w-full bg-gray-100 dark:bg-gray-900 p-4">
                <iframe
                  src={viewingFile.url}
                  className="w-full h-[70vh] border-0 rounded-lg"
                  title={viewingFile.fileName}
                  onError={() => {
                    showToast('Failed to load PDF', 'error')
                  }}
                />
                <div className="mt-2 text-center">
                  <a
                    href={viewingFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-2 text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 bg-gray-50 dark:bg-gray-900">
                <FileIcon className="h-24 w-24 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type</p>
                <a
                  href={viewingFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Open in new tab
                </a>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 px-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!viewingFile) return
                  try {
                    const response = await fetch(viewingFile.url)
                    if (!response.ok) throw new Error('Failed to download file')
                    
                    const blob = await response.blob()
                    const downloadUrl = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = downloadUrl
                    link.download = viewingFile.fileName
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(downloadUrl)
                    showToast('File downloaded successfully', 'success')
                  } catch (error) {
                    showToast('Failed to download file', 'error')
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="default"
                onClick={() => setViewingFile(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


// Timeline Step Component
interface TimelineStepProps {
  stepNumber: number
  title: string
  isCompleted: boolean
  isAdmin: boolean
  onUpdateStep: (status: string, data?: any) => void
  onUpdateSubStep?: (stepKey: string, status: 'pending' | 'completed', data?: any) => void
  subSteps: Array<{
    key: string
    label: string
    completed: boolean
    date?: string
    data?: any
  }>
  application?: any
  payments?: any[]
  _payments?: any[]
  attCode?: string
  examDate?: string
  examLocation?: string
  examTime?: string
  result?: 'pass' | 'failed'
  showGenerateLetter?: boolean
}

function TimelineStep({ 
  stepNumber, 
  title, 
  isCompleted, 
  isAdmin, 
  onUpdateStep, 
  onUpdateSubStep,
  subSteps,
  application,
  attCode,
  examDate,
  examLocation,
  examTime,
  result,
  showGenerateLetter = false
}: TimelineStepProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [attCodeValue, setAttCodeValue] = useState<string>('')
  const [attExpiryDate, setAttExpiryDate] = useState<string>('')
  const [savingAttNotes, setSavingAttNotes] = useState(false)
  const [examDateValue, setExamDateValue] = useState<string>('')
  const [examTimeValue, setExamTimeValue] = useState<string>('')
  const [examLocationValue, setExamLocationValue] = useState<string>('')
  const [savingExamDetails, setSavingExamDetails] = useState(false)
  const [examResult, setExamResult] = useState<string>(result || '')
  const [savingResult, setSavingResult] = useState(false)
  const [form1RefNumber, setForm1RefNumber] = useState<string>('')
  const [form1Date, setForm1Date] = useState<string>('')
  const [savingForm1, setSavingForm1] = useState(false)

  // Initialize ATT code and expiry date from sub-step data
  useEffect(() => {
    const attReceivedStep = subSteps.find(step => step.key === 'att_received')
    if (attReceivedStep?.data) {
      if (attReceivedStep.data.code || attReceivedStep.data.att_code) {
        setAttCodeValue(attReceivedStep.data.code || attReceivedStep.data.att_code || '')
      } else if (attCode) {
        // Use prop value if available
        setAttCodeValue(attCode)
      }
      if (attReceivedStep.data.expiry_date || attReceivedStep.data.att_expiry_date) {
        const expiryDate = attReceivedStep.data.expiry_date || attReceivedStep.data.att_expiry_date
        setAttExpiryDate(expiryDate ? expiryDate.split('T')[0] : '')
      }
    } else if (attCode) {
      // Use prop value if no sub-step data
      setAttCodeValue(attCode)
    }
  }, [subSteps, attCode])

  // Initialize exam date, time, and location from sub-step data
  useEffect(() => {
    const examDateBookedStep = subSteps.find(step => step.key === 'exam_date_booked')
    if (examDateBookedStep?.data) {
      if (examDateBookedStep.data.date) {
        setExamDateValue(examDateBookedStep.data.date.split('T')[0])
      } else if (examDate) {
        setExamDateValue(examDate.split('T')[0])
      }
      if (examDateBookedStep.data.time) {
        setExamTimeValue(examDateBookedStep.data.time)
      } else if (examTime) {
        setExamTimeValue(examTime)
      }
      if (examDateBookedStep.data.location) {
        setExamLocationValue(examDateBookedStep.data.location)
      } else if (examLocation) {
        setExamLocationValue(examLocation)
      }
    } else {
      if (examDate) setExamDateValue(examDate.split('T')[0])
      if (examTime) setExamTimeValue(examTime)
      if (examLocation) setExamLocationValue(examLocation)
    }
  }, [subSteps, examDate, examTime, examLocation])

  // Initialize exam result
  useEffect(() => {
    if (result) {
      setExamResult(result)
    }
  }, [result])

  // Initialize Form 1 data from sub-step data
  useEffect(() => {
    const form1Step = subSteps.find(step => step.key === 'form1_submitted')
    if (form1Step?.data) {
      if (form1Step.data.reference_number || form1Step.data.ref_number) {
        setForm1RefNumber(form1Step.data.reference_number || form1Step.data.ref_number || '')
      }
      if (form1Step.date) {
        setForm1Date(form1Step.date.split('T')[0])
      }
    } else if (form1Step?.date) {
      setForm1Date(form1Step.date.split('T')[0])
    }
  }, [subSteps])

  const handleSubStepToggle = async (subStepKey: string, currentStatus: boolean) => {
    if (onUpdateSubStep && application?.id) {
      const newStatus = currentStatus ? 'pending' : 'completed'
      // Set time to noon to avoid timezone issues
      const dateObj = new Date()
      dateObj.setHours(12, 0, 0, 0)
      await onUpdateSubStep(subStepKey, newStatus, { 
        date: dateObj.toISOString()
      })
    }
  }

  return (
    <div className="relative mb-6">
      {/* Timeline connector line */}
      <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-transparent dark:from-gray-700 dark:via-gray-600"></div>
      
      {/* Main step card */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm transition-all duration-300 ${
          isCompleted 
          ? 'border-green-200 dark:border-green-800/50 shadow-green-50 dark:shadow-green-900/10' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
      }`}>
        {/* Step number badge */}
        <div className="absolute -left-3 top-6 z-10">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800 transition-all duration-300 ${
            isCompleted 
              ? 'bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700' 
              : 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700'
        }`}>
          {isCompleted ? (
              <CheckCircle className="h-6 w-6 text-white" />
          ) : (
              <span className="text-white font-bold text-sm">{stepNumber}</span>
          )}
        </div>
      </div>

        <div className="p-6 pl-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
                <h3 className={`text-xl font-bold ${
                  isCompleted 
                    ? 'text-gray-900 dark:text-gray-100' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
              {stepNumber}. {title}
            </h3>
            {isCompleted && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-100 to-green-50 text-green-700 dark:from-green-900/30 dark:to-green-800/20 dark:text-green-400 border border-green-200 dark:border-green-800">
                    ✓ Completed
              </span>
            )}
          </div>

              {/* Note for Quick Results step */}
              {stepNumber === 8 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 italic">
                    Note: Quick Results is available 72 Business Hrs after taking the exam
              </p>
            </div>
          )}

              {/* Special fields for specific steps */}
              {stepNumber === 6 && attCode && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    ATT Code
                  </p>
                  <p className="text-base font-mono font-bold text-blue-700 dark:text-blue-300">
                    {attCode}
                  </p>
            </div>
          )}


          {isExpanded && (
            <div className="mt-6 space-y-3">
              {subSteps.map((subStep, _index) => (
                <div 
                  key={subStep.key} 
                  className={`group relative flex items-start gap-4 p-4 rounded-lg border transition-all duration-200 ${
                    subStep.completed 
                      ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50' 
                      : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {/* Sub-step indicator */}
                  <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                    subStep.completed 
                      ? 'bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 shadow-sm' 
                      : 'bg-gray-300 dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-700'
                  }`}>
                    {subStep.completed ? (
                      <CheckCircle className="h-4 w-4 text-white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-300"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                        <p className={`text-sm font-medium ${
                      subStep.completed 
                        ? 'text-gray-900 dark:text-gray-100' 
                            : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {subStep.label}
                        </p>
                        {(subStep.key === 'app_paid' || subStep.key === 'app_step2_paid') && subStep.data?.amount && (
                          <div className="mt-1 space-y-0.5">
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                              Payment: {formatCurrency(subStep.data.amount)}
                            </p>
                            {subStep.data?.total_amount_paid && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Total Paid: {formatCurrency(subStep.data.total_amount_paid)}
                              </p>
                            )}
                          </div>
                        )}
                        {subStep.date && 
                         subStep.key !== 'official_docs_submitted' && 
                         subStep.key !== 'letter_submitted' && 
                         subStep.key !== 'mandatory_courses' &&
                         subStep.key !== 'form1_submitted' &&
                         subStep.key !== 'nclex_eligibility_approved' &&
                         subStep.key !== 'pearson_account_created' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                        {formatDate(subStep.date)}
                      </p>
                    )}
                  </div>
                      <div className="flex items-center gap-2">
                        {/* Generate Letter button for letter_generated */}
                        {subStep.key === 'letter_generated' && showGenerateLetter && (
                  <Button
                            onClick={async () => {
                      if (!application) return
                      
                              try {
                      // Get current date
                      const currentDate = new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })

                      // Get client full name
                      const clientFullName = `${application.first_name}${application.middle_name ? ` ${application.middle_name}` : ''} ${application.last_name}`.trim()

                      // Get nursing school info
                      const schoolName = application.nursing_school || 'Nursing School'
                      const schoolCity = application.nursing_school_city || ''
                      const schoolProvince = application.nursing_school_province || ''
                      const schoolCountry = application.nursing_school_country || ''

                      // Create letter HTML for printing/PDF
                      const letterHTML = `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>Official Letter - ${clientFullName}</title>
                            <meta charset="UTF-8">
                            <style>
                              * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                              }
                              @page {
                                size: letter;
                                margin: 0;
                              }
                              @media screen {
                                body {
                                  display: flex;
                                  justify-content: center;
                                  align-items: center;
                                  min-height: 100vh;
                                  background: white;
                                  padding: 20px;
                                }
                                .letter-container {
                                  background: white;
                                  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                                  width: 8.5in;
                                  min-height: 11in;
                                  margin: 0 auto;
                                }
                              }
                              @media print {
                                body {
                                  margin: 0;
                                  padding: 0;
                                  background: white;
                                }
                                .letter-container {
                                  width: 100%;
                                  box-shadow: none;
                                }
                                .print-button {
                                  display: none;
                                }
                                .letter-header-gradient {
                                  background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%) !important;
                                  -webkit-print-color-adjust: exact;
                                  print-color-adjust: exact;
                                }
                                .letter-footer-gradient {
                                  background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%) !important;
                                  -webkit-print-color-adjust: exact;
                                  print-color-adjust: exact;
                                }
                              }
                              body {
                                font-family: 'Times New Roman', serif;
                                font-size: 12pt;
                                line-height: 1.6;
                                color: #000;
                              }
                              .letter-container {
                                width: 8.5in;
                                min-height: 11in;
                                padding: 0;
                                margin: 0 auto;
                                background: white;
                                display: flex;
                                flex-direction: column;
                              }
                              .print-button {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                padding: 12px 24px;
                                background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                                z-index: 1000;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                              }
                              .print-button:hover {
                                background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
                                transform: translateY(-1px);
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              }
                              .letter-header-gradient {
                                background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%);
                                padding: 0.6em 1in;
                                color: white;
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                border-bottom: 2px solid rgba(255,255,255,0.2);
                              }
                              .letter-header-left {
                                display: flex;
                                align-items: center;
                                gap: 0.8em;
                              }
                              .letter-logo {
                                width: 50px;
                                height: 50px;
                                object-fit: contain;
                                background: white;
                                padding: 6px;
                                border-radius: 6px;
                              }
                              .letter-company-info {
                                display: flex;
                                flex-direction: column;
                              }
                              .letter-company-name {
                                font-size: 20pt;
                                font-weight: bold;
                                margin-bottom: 0;
                                letter-spacing: 1px;
                                line-height: 1;
                              }
                              .letter-company-tagline {
                                font-size: 9pt;
                                opacity: 0.9;
                                font-style: italic;
                                margin-top: 0;
                                line-height: 1.1;
                              }
                              .letter-content-wrapper {
                                padding: 0.6in 1in;
                                flex: 1;
                                display: flex;
                                flex-direction: column;
                                justify-content: center;
                              }
                              .letter-recipient {
                                margin-bottom: 1em;
                                margin-top: 0.3em;
                                line-height: 1.4;
                              }
                              .letter-date {
                                margin-bottom: 0.8em;
                                text-align: right;
                              }
                              .letter-salutation {
                                margin-bottom: 0.6em;
                              }
                              .letter-body {
                                text-align: justify;
                                margin-bottom: 0.8em;
                                line-height: 1.4;
                                font-size: 11pt;
                              }
                              .letter-body p {
                                margin-bottom: 0.5em;
                                text-indent: 0;
                              }
                              .letter-list {
                                margin: 0.5em 0 0.5em 2em;
                                line-height: 1.5;
                              }
                              .letter-email-info {
                                margin: 0.8em 0 0.8em 3em;
                                line-height: 1.4;
                                font-family: 'Courier New', monospace;
                                font-size: 9pt;
                              }
                              .letter-closing {
                                margin-top: 1em;
                              }
                              .letter-signature {
                                margin-top: 1.2em;
                                line-height: 1.4;
                              }
                              .letter-signature-name {
                                font-weight: bold;
                                margin-bottom: 0.2em;
                              }
                              .letter-on-behalf {
                                margin-top: 1em;
                                padding-top: 0.8em;
                                border-top: 1px solid #ddd;
                                line-height: 1.4;
                              }
                              .letter-on-behalf-title {
                                font-weight: bold;
                                margin-bottom: 0.2em;
                              }
                              .letter-footer-gradient {
                                background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%);
                                padding: 0.5em 1in;
                                color: white;
                                font-size: 8pt;
                                text-align: center;
                                border-top: 2px solid rgba(255,255,255,0.2);
                                margin-top: auto;
                              }
                              .letter-footer-content {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                gap: 0.5em;
                                flex-wrap: wrap;
                              }
                              .letter-footer-separator {
                                margin: 0 0.3em;
                              }
                            </style>
                          </head>
                          <body>
                            <button class="print-button" onclick="window.print()">Download as PDF</button>
                            
                            <div class="letter-container">
                              <!-- Official Header -->
                              <div class="letter-header-gradient">
                                <div class="letter-header-left">
                                  <img src="${window.location.origin}/gritsync_logo.png" alt="GritSync Logo" class="letter-logo" onerror="this.style.display='none'">
                                  <div class="letter-company-info">
                                    <div class="letter-company-name">GRITSYNC</div>
                                    <div class="letter-company-tagline">Business Consultancy Services</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div class="letter-content-wrapper">
                                <!-- Recipient Address -->
                                <div class="letter-recipient">
                                  <div>${schoolName}</div>
                                  <div>${schoolCity}${schoolCity && schoolProvince ? ', ' : ''}${schoolProvince}</div>
                                  <div>${schoolCountry}</div>
                                </div>
                                
                                <!-- Date -->
                                <div class="letter-date">
                                  ${currentDate}
                                </div>
                                
                                <!-- Salutation -->
                                <div class="letter-salutation">
                                  Dear Sir/Madam:
                                </div>
                                
                                <!-- Body -->
                                <div class="letter-body">
                                  <p>
                                    Greetings from GritSync Business Consultancy Services.
                                  </p>
                                  
                                  <p>
                                    We are writing on behalf of our client, <strong>${clientFullName}</strong>, who is currently applying for the NCLEX-RN under the New York Board of Nursing. To facilitate this application, we kindly request an official copy of the following documents:
                                  </p>
                                  
                                  <div class="letter-list">
                                    A. FORM 2F (Form Attached)<br>
                                    B. Transcript of Records<br>
                                    C. Related Learning Experience
                                  </div>
                                  
                                  <p>
                                    Please scan and send these documents via EMAIL using your OFFICIAL EMAIL address (e.g., universityregistrar@school.edu.ph).
                                  </p>
                                  
                                  <div class="letter-email-info">
                                    TO: DPLSEduc@nysed.gov ; OPUNIT4@nysed.gov<br>
                                    BCC: ${application.email} ; office@gritsync.com
                                  </div>
                                  
                                  <p>
                                    Your prompt attention to this request is greatly appreciated as it will significantly aid in the timely processing of our client's application.
                                  </p>
                                  
                                  <p>
                                    Thank you for your kind consideration and cooperation.
                                  </p>
                                </div>
                                
                                <!-- Closing -->
                                <div class="letter-closing">
                                  Sincerely,
                                </div>
                                
                                <!-- Signature Block -->
                                <div class="letter-signature">
                                  <div class="letter-signature-name">JJ Cantila, BSN, CADRN, USRN</div>
                                  <div>Program Advisor, GritSync</div>
                                  <div>office@gritsync.com</div>
                                  <div>+1509 270 3437</div>
                                </div>
                                
                                <!-- On Behalf Of -->
                                <div class="letter-on-behalf">
                                  <div class="letter-on-behalf-title">On behalf of:</div>
                                  <div>${clientFullName}</div>
                                  <div>${application.email}</div>
                                  <div>${application.mobile_number}</div>
                                </div>
                              </div>
                              
                              <!-- Official Footer -->
                              <div class="letter-footer-gradient">
                                <div class="letter-footer-content">
                                  <span>GritSync</span>
                                  <span class="letter-footer-separator">/</span>
                                  <span>office@gritsync.com</span>
                                  <span class="letter-footer-separator">/</span>
                                  <span>+1509 270 3437</span>
                                  <span class="letter-footer-separator">/</span>
                                  <span>NCLEX Application Processing</span>
                                </div>
                              </div>
                            </div>
                          </body>
                        </html>
                      `

                      // Open new tab with letter
                      const printWindow = window.open('', '_blank')
                      if (printWindow) {
                        printWindow.document.write(letterHTML)
                        printWindow.document.close()
                                  
                                  // Mark letter_generated step as completed
                                  if (onUpdateSubStep && application?.id) {
                                    try {
                                      await onUpdateSubStep('letter_generated', 'completed', {
                                        date: new Date().toISOString(),
                                        generated_at: new Date().toISOString()
                                      })
                                    } catch (error) {
                                      console.error('Error updating timeline step:', error)
                                    }
                                  }
                                } else {
                                  alert('Please allow pop-ups for this site to generate the letter.')
                                }
                              } catch (error) {
                                console.error('Error generating letter:', error)
                                alert('An error occurred while generating the letter. Please try again.')
                              }
                            }}
                    size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:border-yellow-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Letter for school
                  </Button>
                        )}
                        {/* Date picker for app_created */}
                        {subStep.key === 'app_created' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Created</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('app_created', 'completed', {
                                      date: dateObj.toISOString(),
                                      created_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating app created date:', error)
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('app_created', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when application was created"
                            />
                          </div>
                        )}
                        {/* Date picker for documents_submitted */}
                        {subStep.key === 'documents_submitted' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Documents Submitted</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('documents_submitted', 'completed', {
                                      date: dateObj.toISOString(),
                                      submitted_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating documents submitted date:', error)
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('documents_submitted', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when required documents were submitted"
                            />
                          </div>
                        )}
                        {/* Date picker for letter_submitted */}
                        {subStep.key === 'letter_submitted' && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Request Letter Submitted</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('letter_submitted', 'completed', {
                                      date: dateObj.toISOString(),
                                      submitted_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating letter submitted date:', error)
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  // If date is cleared, mark as pending
                                  await onUpdateSubStep('letter_submitted', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when letter was submitted to school"
                            />
                          </div>
                        )}
                        {/* Date picker for mandatory_courses */}
                        {subStep.key === 'mandatory_courses' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Completed</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('mandatory_courses', 'completed', {
                                      date: dateObj.toISOString(),
                                      completed_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating mandatory courses date:', error)
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('mandatory_courses', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when mandatory courses were completed"
                            />
                          </div>
                        )}
                        {/* Form 1 Application Reference Number and Date */}
                        {subStep.key === 'form1_submitted' && isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Application Reference Number</label>
                              <Input
                                type="text"
                                value={form1RefNumber}
                                onChange={(e) => setForm1RefNumber(e.target.value)}
                                placeholder="Enter reference number..."
                                className="w-48 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Submitted</label>
                              <Input
                                type="date"
                                value={form1Date}
                                onChange={(e) => setForm1Date(e.target.value)}
                                placeholder="Select date"
                                className="w-40 text-xs"
                                title="Select date when Form 1 was submitted"
                              />
                            </div>
                  <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingForm1(true)
                                try {
                                  const saveData: any = {}
                                  if (form1Date) {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(form1Date)
                                    dateObj.setHours(12, 0, 0, 0)
                                    saveData.date = dateObj.toISOString()
                                    saveData.submitted_date = dateObj.toISOString()
                                  }
                                  if (form1RefNumber) {
                                    saveData.reference_number = form1RefNumber
                                    saveData.ref_number = form1RefNumber
                                  }
                                  await onUpdateSubStep('form1_submitted', (form1Date || form1RefNumber) ? 'completed' : 'pending', saveData)
                                } catch (error) {
                                  console.error('Error saving Form 1 data:', error)
                                } finally {
                                  setSavingForm1(false)
                                }
                              }}
                              disabled={savingForm1}
                    size="sm"
                              className="mt-5"
                  >
                              {savingForm1 ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              )}
                        {/* Date picker for nclex_eligibility_approved */}
                        {subStep.key === 'nclex_eligibility_approved' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date of Approval</label>
                      <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('nclex_eligibility_approved', 'completed', {
                                      date: dateObj.toISOString(),
                                      approved_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating NCLEX eligibility approved date:', error)
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('nclex_eligibility_approved', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when NCLEX eligibility was approved"
                            />
                          </div>
                        )}
                        {/* Date picker for pearson_account_created */}
                        {subStep.key === 'pearson_account_created' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Account Created</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('pearson_account_created', 'completed', {
                                      date: dateObj.toISOString(),
                                      created_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating Pearson account created date:', error)
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('pearson_account_created', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when Pearson VUE account was created"
                            />
                    </div>
                  )}
                        {/* Date picker for att_requested */}
                        {subStep.key === 'att_requested' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date ATT Request Submitted</label>
                        <Input
                          type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('att_requested', 'completed', {
                                      date: dateObj.toISOString(),
                                      submitted_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating ATT request submitted date:', error)
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('att_requested', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when ATT request was submitted"
                            />
                          </div>
                        )}
                        {/* Date picker for official_docs_submitted */}
                        {subStep.key === 'official_docs_submitted' && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Official Docs Sent</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('official_docs_submitted', 'completed', {
                                      date: dateObj.toISOString(),
                                      sent_to_bon_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    console.error('Error updating official documents date:', error)
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  // If date is cleared, mark as pending
                                  await onUpdateSubStep('official_docs_submitted', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when documents were sent to BON"
                            />
                      </div>
                        )}
                        {/* ATT Code and Expiry Date for ATT received */}
                        {subStep.key === 'att_received' && isAdmin && (
                      <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">ATT Code</label>
                        <Input
                          type="text"
                                value={attCodeValue}
                                onChange={(e) => setAttCodeValue(e.target.value)}
                                placeholder="Enter ATT code..."
                                className="w-40 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Expiry Date</label>
                              <Input
                                type="date"
                                value={attExpiryDate}
                                onChange={(e) => setAttExpiryDate(e.target.value)}
                                placeholder="Select expiry date"
                                className="w-40 text-xs"
                              />
                            </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingAttNotes(true)
                                try {
                                  // Create date at noon local time to avoid timezone issues
                                  let expiryDateISO = null
                                  if (attExpiryDate) {
                                    const dateObj = new Date(attExpiryDate)
                                    dateObj.setHours(12, 0, 0, 0)
                                    expiryDateISO = dateObj.toISOString()
                                  }
                                  // Mark as completed if both ATT code and expiry date are provided
                                  const isCompleted = !!(attCodeValue && attExpiryDate)
                                  
                                  await onUpdateSubStep('att_received', isCompleted ? 'completed' : 'pending', {
                                    code: attCodeValue,
                                    att_code: attCodeValue,
                                    expiry_date: expiryDateISO,
                                    att_expiry_date: expiryDateISO,
                                    ...(subStep.date ? { date: subStep.date } : {})
                                  })
                                } catch (error) {
                                  console.error('Error saving ATT code and expiry date:', error)
                                } finally {
                                  setSavingAttNotes(false)
                                }
                              }}
                              disabled={savingAttNotes}
                              size="sm"
                              className="mt-5"
                            >
                              {savingAttNotes ? 'Saving...' : 'Save'}
                          </Button>
                      </div>
                        )}
                        {/* Exam Date, Time, and Location for exam_date_booked */}
                        {subStep.key === 'exam_date_booked' && isAdmin && (
                      <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Exam Date</label>
                              <Input
                                type="date"
                                value={examDateValue}
                                onChange={(e) => setExamDateValue(e.target.value)}
                                placeholder="Select exam date"
                                className="w-40 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Exam Time</label>
                        <Input
                          type="time"
                                value={examTimeValue}
                                onChange={(e) => setExamTimeValue(e.target.value)}
                                placeholder="Select exam time"
                                className="w-40 text-xs"
                              />
                      </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Location</label>
                              <Select
                                value={examLocationValue}
                                onChange={(e) => setExamLocationValue(e.target.value)}
                                className="w-40 text-xs"
                                options={[
                                  { value: '', label: 'Select location' },
                                  { value: 'Alabang', label: 'Alabang' },
                                  { value: 'Makati', label: 'Makati' }
                                ]}
                              />
                    </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingExamDetails(true)
                                try {
                                  // Create date at noon local time to avoid timezone issues
                                  let examDateISO = null
                                  if (examDateValue) {
                                    const dateObj = new Date(examDateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    examDateISO = dateObj.toISOString()
                                  }
                                  // Mark as completed if all three fields (date, time, location) are provided
                                  const isCompleted = !!(examDateValue && examTimeValue && examLocationValue)
                                  
                                  await onUpdateSubStep('exam_date_booked', isCompleted ? 'completed' : 'pending', {
                                    date: examDateISO,
                                    time: examTimeValue || null,
                                    location: examLocationValue || null,
                                    exam_date: examDateISO,
                                    exam_time: examTimeValue || null,
                                    exam_location: examLocationValue || null
                                  })
                                } catch (error) {
                                  console.error('Error saving exam details:', error)
                                } finally {
                                  setSavingExamDetails(false)
                                }
                              }}
                              disabled={savingExamDetails}
                              size="sm"
                              className="mt-5"
                            >
                              {savingExamDetails ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        )}
                        {/* Exam Result dropdown for exam_result sub-step */}
                        {subStep.key === 'exam_result' && isAdmin && (
                    <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                      <Select
                                value={examResult}
                                onChange={(e) => setExamResult(e.target.value)}
                        options={[
                                  { value: '', label: 'Select result' },
                                  { value: 'pass', label: 'Passed' },
                          { value: 'failed', label: 'Failed' }
                        ]}
                                className="w-40 text-xs"
                              />
                            </div>
                            {examResult && (
                              <Button
                                onClick={async () => {
                                  if (!onUpdateStep) {
                                    console.error('onUpdateStep is not available')
                                    return
                                  }
                                  if (!application?.id) {
                                    console.error('Application ID is not available')
                                    return
                                  }
                                  setSavingResult(true)
                                  try {
                                    const status = examResult === 'pass' ? 'completed' : 'pending'
                                    const saveData = {
                                      result: examResult,
                                      result_date: new Date().toISOString()
                                    }
                                    await onUpdateStep(status, saveData)
                                    // Success message is handled in onUpdateStep
                                  } catch (error: any) {
                                    console.error('Error saving exam result:', error)
                                    // Error message is handled in onUpdateStep
                                  } finally {
                                    setSavingResult(false)
                                  }
                                }}
                                disabled={savingResult || !examResult}
                                size="sm"
                              >
                                {savingResult ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                    </div>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleSubStepToggle(subStep.key, subStep.completed)}
                            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
                          >
                            {subStep.completed ? 'Mark pending' : 'Mark complete'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Show formatted date below for sub-steps with date pickers */}
                    {subStep.key === 'letter_submitted' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'mandatory_courses' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Completed: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'form1_submitted' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'nclex_eligibility_approved' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Approved: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'pearson_account_created' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'official_docs_submitted' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted: {formatDate(subStep.date)}
                      </p>
                    )}
                    
                    {/* Display all admin changes in bullet form */}
                    {subStep.data && Object.keys(subStep.data).length > 0 && (() => {
                      // Helper to format date from ISO string to match date picker format
                      // This extracts the date part (YYYY-MM-DD) and formats it without timezone conversion
                      const formatDateFromISO = (isoString: string): string => {
                        if (!isoString) return ''
                        // Extract date part (YYYY-MM-DD) from ISO string
                        const datePart = isoString.split('T')[0]
                        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                          // Fallback to regular formatDate if format is unexpected
                          return formatDate(isoString)
                        }
                        const [year, month, day] = datePart.split('-')
                        // Format directly from the date parts to avoid timezone conversion
                        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
                        const monthName = monthNames[parseInt(month) - 1]
                        const dayNum = parseInt(day)
                        return `${monthName} ${dayNum}, ${year}`
                      }
                      
                      // Helper to check if dates are the same (to avoid duplicates)
                      const datesEqual = (date1: string, date2: string) => {
                        if (!date1 || !date2) return false
                        // Compare just the date part (YYYY-MM-DD)
                        const date1Part = date1.split('T')[0]
                        const date2Part = date2.split('T')[0]
                        return date1Part === date2Part
                      }
                      
                      // Collect all items to display
                      const items: Array<{ label: string; value: string }> = []
                      
                      // Show the date that matches what's in the date picker first
                      // The date picker shows subStep.date which is subStep.data.date
                      if (subStep.date && subStep.data && subStep.data.date) {
                        // Match the date picker's label based on the step key
                        if (subStep.key === 'app_created') {
                          items.push({ label: 'Date Created', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'documents_submitted') {
                          items.push({ label: 'Date Documents Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'letter_submitted') {
                          items.push({ label: 'Date Request Letter Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'mandatory_courses') {
                          items.push({ label: 'Date Completed', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'form1_submitted') {
                          items.push({ label: 'Date Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'nclex_eligibility_approved') {
                          items.push({ label: 'Date of Approval', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'pearson_account_created') {
                          items.push({ label: 'Date Account Created', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'att_requested') {
                          items.push({ label: 'Date ATT Request Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'official_docs_submitted') {
                          items.push({ label: 'Date Official Docs Sent', value: formatDateFromISO(subStep.date) })
                        }
                      }
                      
                      // Show other specific dates only if they're different from the main date
                      if (subStep.data.submitted_date && subStep.key === 'letter_submitted' && !datesEqual(subStep.data.submitted_date, subStep.date || '')) {
                        items.push({ label: 'Submitted Date', value: formatDateFromISO(subStep.data.submitted_date) })
                      }
                      
                      if (subStep.data.completed_date && subStep.key === 'mandatory_courses' && !datesEqual(subStep.data.completed_date, subStep.date || '')) {
                        items.push({ label: 'Completed Date', value: formatDateFromISO(subStep.data.completed_date) })
                      }
                      
                      if (subStep.data.approved_date && subStep.key === 'nclex_eligibility_approved' && !datesEqual(subStep.data.approved_date, subStep.date || '')) {
                        items.push({ label: 'Approved Date', value: formatDateFromISO(subStep.data.approved_date) })
                      }
                      
                      if (subStep.data.created_date && subStep.key === 'pearson_account_created' && !datesEqual(subStep.data.created_date, subStep.date || '')) {
                        items.push({ label: 'Created Date', value: formatDateFromISO(subStep.data.created_date) })
                      }
                      if (subStep.data.submitted_date && subStep.key === 'att_requested' && !datesEqual(subStep.data.submitted_date, subStep.date || '')) {
                        items.push({ label: 'Submitted Date', value: formatDateFromISO(subStep.data.submitted_date) })
                      }
                      
                      if (subStep.data.sent_to_bon_date && subStep.key === 'official_docs_submitted' && !datesEqual(subStep.data.sent_to_bon_date, subStep.date || '')) {
                        items.push({ label: 'Sent to BON Date', value: formatDateFromISO(subStep.data.sent_to_bon_date) })
                      }
                      
                      if (subStep.data.generated_at && subStep.key === 'letter_generated' && !datesEqual(subStep.data.generated_at, subStep.date || '')) {
                        items.push({ label: 'Generated At', value: formatDateFromISO(subStep.data.generated_at) })
                      }
                      
                      // Reference number
                      if (subStep.data.reference_number) {
                        items.push({ label: 'Reference Number', value: subStep.data.reference_number })
                      } else if (subStep.data.ref_number) {
                        items.push({ label: 'Reference Number', value: subStep.data.ref_number })
                      }
                      
                      // ATT Code
                      if (subStep.data.code) {
                        items.push({ label: 'ATT Code', value: subStep.data.code })
                      } else if (subStep.data.att_code) {
                        items.push({ label: 'ATT Code', value: subStep.data.att_code })
                      }
                      
                      // Expiry Date
                      if (subStep.data.expiry_date) {
                        items.push({ label: 'Expiry Date', value: formatDateFromISO(subStep.data.expiry_date) })
                      } else if (subStep.data.att_expiry_date) {
                        items.push({ label: 'Expiry Date', value: formatDateFromISO(subStep.data.att_expiry_date) })
                      }
                      
                      // Exam details
                      if (subStep.data.exam_date) {
                        items.push({ label: 'Exam Date', value: formatDateFromISO(subStep.data.exam_date) })
                      } else if (subStep.data.date && subStep.key === 'exam_date_booked') {
                        items.push({ label: 'Exam Date', value: formatDateFromISO(subStep.data.date) })
                      }
                      
                      if (subStep.data.exam_time) {
                        items.push({ label: 'Exam Time', value: subStep.data.exam_time })
                      } else if (subStep.data.time) {
                        items.push({ label: 'Exam Time', value: subStep.data.time })
                      }
                      
                      if (subStep.data.exam_location) {
                        items.push({ label: 'Location', value: subStep.data.exam_location })
                      } else if (subStep.data.location) {
                        items.push({ label: 'Location', value: subStep.data.location })
                      }
                      
                      // Result
                      if (subStep.data.result) {
                        const resultText = subStep.data.result === 'pass' ? 'Passed' : subStep.data.result === 'failed' ? 'Failed' : subStep.data.result
                        items.push({ label: 'Result', value: resultText })
                      }
                      
                      if (subStep.data.result_date) {
                        items.push({ label: 'Result Date', value: formatDateFromISO(subStep.data.result_date) })
                      }
                      
                      // Amount
                      if (subStep.data.amount) {
                        items.push({ label: 'Amount', value: formatCurrency(subStep.data.amount) })
                      }
                      
                      // Only show if there are items to display
                      if (items.length === 0) return null
                      
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Admin Updates:</p>
                          <ul className="space-y-1.5">
                            {items.map((item, idx) => (
                              <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                                <span><strong>{item.label}:</strong> {item.value}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}

              {/* Exam Result Messages for Step 8 */}
              {stepNumber === 8 && examResult && (
                <div className="mt-4">
                  {examResult === 'pass' && (
                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-2 border-green-200 dark:border-green-800 rounded-xl shadow-lg">
                      <p className="text-xl text-green-800 dark:text-green-300 font-bold mb-3 flex items-center gap-2">
                        🎉 Congratulations from GritSync! 🎉
                      </p>
                      <p className="text-base text-green-700 dark:text-green-400 leading-relaxed mb-3">
                        Dear {application?.first_name || 'Valued Client'},
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed mb-2">
                        We at GritSync are absolutely thrilled to celebrate this incredible achievement with you! Passing the NCLEX exam is a monumental milestone that reflects your unwavering dedication, perseverance, and commitment to your nursing career.
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed mb-2">
                        Your journey with us has been remarkable, and we are honored to have been part of this significant moment in your professional life. This success is not just a test result—it's a testament to your hard work, resilience, and the bright future ahead of you as a licensed nurse.
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                        From all of us at GritSync, congratulations on this outstanding accomplishment! We're excited to see where your nursing career takes you next. You've earned this success, and we couldn't be prouder!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed mt-3 font-semibold">
                        Warm regards,<br />
                        The GritSync Team
                      </p>
                    </div>
                  )}
                  {examResult === 'failed' && (
                    <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl shadow-lg">
                      <p className="text-xl text-orange-800 dark:text-orange-300 font-bold mb-3 flex items-center gap-2">
                        💪 Keep Going - A Message from GritSync
                      </p>
                      <p className="text-base text-orange-700 dark:text-orange-400 leading-relaxed mb-3">
                        Dear {application?.first_name || 'Valued Client'},
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mb-2">
                        We know this result wasn't what you hoped for, and we want you to know that the entire GritSync team is here to support you. This moment does not define your journey—it's simply a stepping stone on your path to success.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mb-2">
                        Many of the most successful nurses we've worked with have faced this challenge. What sets them apart is their determination to learn, grow, and try again. You've already shown incredible strength by getting this far, and we believe in your ability to overcome this obstacle.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mb-2">
                        At GritSync, we're committed to helping you succeed. Take this time to review your preparation, identify areas for improvement, and know that we're here to support you every step of the way in your next attempt.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed">
                        Remember: setbacks are setups for comebacks. Your nursing career is still ahead of you, and we're confident that with continued dedication and our support, you will achieve your goal.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mt-3 font-semibold">
                        We believe in you,<br />
                        The GritSync Team
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions for Step 2 */}
              {stepNumber === 2 && showGenerateLetter && (
                <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">Instructions</h4>
                  </div>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 dark:text-gray-300 ml-2">
                    <li className="leading-relaxed">Download letter for school and FORM 2F</li>
                    <li className="leading-relaxed">Fill up 1-7 section in form2f</li>
                    <li className="leading-relaxed">Go to your school's registrar and submit both forms</li>
                    <li className="leading-relaxed">Don't forget to bring about 1,500php for school fees</li>
                    <li className="leading-relaxed">Reiterate to submit all documents via email based on what stated on the letter for school</li>
                  </ol>
                </div>
              )}

              {/* Download Form 2F Button for Step 2 */}
              {stepNumber === 2 && showGenerateLetter && (
                <div className="mt-4 flex gap-2 flex-wrap">
                    <Button
                    onClick={() => {
                      window.open('https://www.op.nysed.gov/sites/op/files/2023-03/nurse2f.pdf', '_blank')
                    }}
                    variant="outline"
                      size="sm"
                    >
                    <Download className="h-4 w-4 mr-2" />
                    DOWNLOAD FORM 2F
                    </Button>
                </div>
              )}

            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

