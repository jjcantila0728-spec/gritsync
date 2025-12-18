import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { CardSkeleton } from '@/components/ui/Loading'
import { applicationPaymentsAPI, applicationsAPI, adminAPI, servicesAPI } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getSignedFileUrl } from '@/lib/api'
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  History,
  DollarSign,
  AlertCircle,
  FileText,
  Eye,
  XCircle,
  User,
  Mail,
  Shield,
  Image as ImageIcon,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Plus
} from 'lucide-react'

interface Payment {
  id: string
  application_id: string
  payment_type: 'step1' | 'step2' | 'full'
  amount: number
  status: 'pending' | 'pending_approval' | 'paid' | 'failed' | 'cancelled'
  transaction_id?: string
  stripe_payment_intent_id?: string
  payment_method?: string
  proof_of_payment_file_path?: string
  usd_to_php_rate?: number
  admin_note?: string
  created_at: string
  updated_at?: string
}

export function AdminApplicationPayments() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [loadingApplication, setLoadingApplication] = useState(true)
  const [application, setApplication] = useState<any>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [processingPaymentAction, setProcessingPaymentAction] = useState(false)
  const [viewingProof, setViewingProof] = useState<{ url: string; fileName: string } | null>(null)
  const [showProofModal, setShowProofModal] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCreatePaymentModal, setShowCreatePaymentModal] = useState(false)
  const [creatingPayment, setCreatingPayment] = useState(false)
  const [newPaymentType, setNewPaymentType] = useState<'step1' | 'step2' | 'full' | 'custom'>('step1')
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0)
  const [newPaymentDescription, setNewPaymentDescription] = useState<string>('')
  const [staggeredService, setStaggeredService] = useState<any>(null)
  const [fullService, setFullService] = useState<any>(null)
  const [retakeService, setRetakeService] = useState<any>(null)
  const [loadingServices, setLoadingServices] = useState(false)
  const [missingPayments, setMissingPayments] = useState<Array<{ type: 'step1' | 'step2' | 'full'; label: string; amount: number; reason: string }>>([])
  
  // Component for proof of payment thumbnail preview
  function ProofOfPaymentThumbnail({ filePath, onViewClick }: { filePath: string; onViewClick: () => void }) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    
    useEffect(() => {
      let isMounted = true
      let timeoutId: NodeJS.Timeout | null = null
      
      async function loadThumbnail() {
        if (!filePath) {
          setError(true)
          setErrorMessage('No file path provided')
          setLoading(false)
          return
        }
        
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('ProofOfPaymentThumbnail: Timeout loading thumbnail for:', filePath)
            setError(true)
            setErrorMessage('Loading timeout')
            setLoading(false)
          }
        }, 10000) // 10 second timeout
        
        try {
          // Log the original file path for debugging
          console.log('ProofOfPaymentThumbnail: Loading thumbnail for file path:', filePath)
          
          // Use the file path as-is (it should already be in the correct format from the database)
          // The path format is: {userId}/payments/{filename} or public/payments/{filename}
          const normalizedPath = filePath.trim()
          
          if (!normalizedPath) {
            throw new Error('Empty file path')
          }
          
          // Check if it's an image file (not PDF)
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(normalizedPath)
          
          if (isImage) {
            // Get signed URL for thumbnail - don't use silent mode so we can see errors
            try {
              console.log('ProofOfPaymentThumbnail: Getting signed URL for:', normalizedPath)
              const url = await getSignedFileUrl(normalizedPath, 3600, false)
              console.log('ProofOfPaymentThumbnail: Got signed URL:', url ? 'Success' : 'Failed', url?.substring(0, 50) + '...')
              
              if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
              }
              
              if (isMounted) {
                if (url && url.trim() !== '') {
                  setThumbnailUrl(url)
                  setError(false)
                  setErrorMessage(null)
                } else {
                  console.warn('ProofOfPaymentThumbnail: Failed to get signed URL for proof of payment:', normalizedPath)
                  setError(true)
                  setErrorMessage('Failed to generate access URL')
                }
              }
            } catch (urlError: any) {
              if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
              }
              console.error('ProofOfPaymentThumbnail: Error getting signed URL:', urlError, 'File path:', normalizedPath)
              if (isMounted) {
                setError(true)
                setErrorMessage(urlError?.message || 'Failed to load image')
              }
            }
          } else {
            // PDF or other file - no thumbnail
            console.log('ProofOfPaymentThumbnail: File is not an image, showing file icon:', normalizedPath)
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            setError(false) // Not an error, just not an image
            setErrorMessage(null)
          }
        } catch (err: any) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          console.error('ProofOfPaymentThumbnail: Error loading thumbnail:', err, 'File path:', filePath)
          if (isMounted) {
            setError(true)
            setErrorMessage(err?.message || 'Unknown error')
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }
      
      loadThumbnail()
      
      return () => {
        isMounted = false
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }, [filePath])
    
    return (
      <div className="space-y-3">
        {loading ? (
          <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-600">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : thumbnailUrl && !error ? (
          <div 
            className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 dark:border-gray-600"
            onClick={onViewClick}
            title="Click to view full size"
          >
            <img 
              src={thumbnailUrl} 
              alt="Proof of Payment" 
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
              onError={async (e) => {
                console.error('Image failed to load:', thumbnailUrl, 'File path:', filePath)
                // Try to fetch as blob to see if it's a CORS issue
                try {
                  const response = await fetch(thumbnailUrl, { mode: 'cors' })
                  if (!response.ok) {
                    console.error('Fetch failed with status:', response.status, response.statusText)
                    setError(true)
                    setErrorMessage(`Failed to load: ${response.status} ${response.statusText}`)
                  } else {
                    // If fetch works, try creating object URL
                    const blob = await response.blob()
                    const objectUrl = URL.createObjectURL(blob)
                    setThumbnailUrl(objectUrl)
                    setError(false)
                    setErrorMessage(null)
                  }
                } catch (fetchError: any) {
                  console.error('Fetch error:', fetchError)
                  setError(true)
                  setErrorMessage(fetchError?.message || 'Image failed to load. Check browser console for details.')
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center border border-gray-200 dark:border-gray-600 p-2">
            <FileText className="h-8 w-8 text-gray-400 mb-1" />
            {errorMessage && (
              <p className="text-xs text-red-500 dark:text-red-400 text-center mt-1">
                {errorMessage}
              </p>
            )}
            {!errorMessage && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                {/\.(pdf)$/i.test(filePath) ? 'PDF file' : 'File preview unavailable'}
              </p>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onViewClick}
          className="w-full flex items-center justify-center gap-2"
        >
          <Eye className="h-4 w-4" />
          View Proof
        </Button>
      </div>
    )
  }

  useEffect(() => {
    if (authLoading) return
    
    if (!user) {
      navigate('/login')
      return
    }

    if (id) {
      fetchApplication()
      loadPayments()
    }
  }, [id, user, authLoading, navigate])

  // Load services when application is available
  useEffect(() => {
    if (application) {
      loadServices()
    }
  }, [application])

  // Analyze missing payments when services and payments are loaded
  useEffect(() => {
    if (application && (staggeredService || fullService || retakeService) && payments.length >= 0) {
      analyzeMissingPayments()
    }
  }, [application, staggeredService, fullService, retakeService, payments])

  async function fetchApplication() {
    if (!id) return
    setLoadingApplication(true)
    try {
      const data = await applicationsAPI.getById(id)
      setApplication(data)
    } catch (error: any) {
      console.error('Error fetching application:', error)
      showToast(error.message || 'Failed to load application', 'error')
    } finally {
      setLoadingApplication(false)
    }
  }

  async function loadPayments() {
    if (!id) return
    setLoadingPayments(true)
    try {
      // Invalidate cache to ensure we get the latest payments
      try {
        const { invalidateApplicationCache } = await import('@/lib/query-cache')
        invalidateApplicationCache(id)
      } catch {
        // Cache module might not be available, continue anyway
      }
      
      const data = await applicationPaymentsAPI.getByApplication(id)
      // For payments without usd_to_php_rate but with PHP-convertible payment methods,
      // fetch the current rate (as fallback for old payments)
      const typedData = (data || []) as unknown as Payment[]
      const paymentsWithRates = await Promise.all(
        typedData.map(async (payment: Payment) => {
          if ((payment.payment_method === 'gcash' || payment.payment_method === 'mobile_banking') && !payment.usd_to_php_rate) {
            try {
              const rate = await adminAPI.getUsdToPhpRate()
              return { ...payment, usd_to_php_rate: rate }
            } catch (error) {
              // If rate fetch fails, return payment as-is
              return payment
            }
          }
          return payment
        })
      )
      setPayments(paymentsWithRates)
    } catch (error) {
      console.error('Error loading payments:', error)
      showToast('Failed to load payments', 'error')
    } finally {
      setLoadingPayments(false)
    }
  }

  async function loadServices() {
    if (!application) return
    
    try {
      setLoadingServices(true)
      const applicationType = application?.application_type || 'NCLEX'
      const isEAD = applicationType === 'EAD'
      const serviceName = isEAD ? 'EAD Processing' : 'NCLEX Processing'
      const serviceState = isEAD ? 'All States' : 'New York'
      
      // Fetch all services from admin settings (same source as /admin/settings/services)
      const allServices = await servicesAPI.getAll()
      
      if (!allServices || allServices.length === 0) {
        console.warn('No services found in admin settings')
        return
      }
      
      if (isEAD) {
        // Find EAD full payment service
        const service = allServices.find((s: any) => 
          s.service_name === serviceName && 
          s.state === serviceState && 
          s.payment_type === 'full'
        )
        if (service) {
          setFullService(service)
          setStaggeredService(null)
          setRetakeService(null)
        }
      } else {
        // Find NCLEX staggered service
        const staggered = allServices.find((s: any) => 
          s.service_name === serviceName && 
          s.state === serviceState && 
          s.payment_type === 'staggered'
        )
        if (staggered) {
          setStaggeredService(staggered)
        }
        
        // Find NCLEX full service
        const full = allServices.find((s: any) => 
          s.service_name === serviceName && 
          s.state === serviceState && 
          s.payment_type === 'full'
        )
        if (full) {
          setFullService(full)
        }
        
        // Load retake service (if application is retake)
        if (application?.payment_type === 'retake') {
          const retake = allServices.find((s: any) => 
            s.service_name === 'NCLEX Retake Processing' && 
            s.state === serviceState && 
            s.payment_type === 'staggered'
          )
          if (retake) {
            setRetakeService(retake)
          }
        }
      }
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setLoadingServices(false)
    }
  }

  // Analyze what payments are missing based on service and payment history
  function analyzeMissingPayments() {
    if (!application) {
      setMissingPayments([])
      return
    }

    // Don't analyze if services haven't loaded yet
    const applicationType = application?.application_type || 'NCLEX'
    const isEAD = applicationType === 'EAD'
    const isRetake = application?.payment_type === 'retake'
    
    if (isEAD && !fullService) {
      setMissingPayments([])
      return
    }
    if (isRetake && !retakeService) {
      setMissingPayments([])
      return
    }
    if (!isEAD && !isRetake && !staggeredService && !fullService) {
      setMissingPayments([])
      return
    }

    const missing: Array<{ type: 'step1' | 'step2' | 'full'; label: string; amount: number; reason: string }> = []

    // Get existing paid/pending payments
    const paidPayments = payments.filter(p => p.status === 'paid' || p.status === 'pending_approval' || p.status === 'pending')
    const hasStep1 = paidPayments.some(p => p.payment_type === 'step1')
    const hasStep2 = paidPayments.some(p => p.payment_type === 'step2')
    const hasFull = paidPayments.some(p => p.payment_type === 'full')

    if (isEAD) {
      // EAD only needs full payment
      if (!hasFull && fullService?.total_full) {
        missing.push({
          type: 'full',
          label: 'Full Payment',
          amount: fullService.total_full,
          reason: 'Required for EAD Processing'
        })
      }
    } else if (isRetake) {
      // Retake only needs step2 (as full payment)
      if (!hasStep2 && retakeService) {
        const amount = retakeService.total_step2 || retakeService.total_full || 0
        if (amount > 0) {
          missing.push({
            type: 'step2',
            label: 'Retake Payment',
            amount,
            reason: 'Required for NCLEX Retake Processing'
          })
        }
      }
    } else {
      // Regular NCLEX - check for staggered or full
      if (hasFull) {
        // Already has full payment, nothing missing
      } else if (hasStep1 && hasStep2) {
        // Both steps paid, nothing missing
      } else {
        // Check what's missing for staggered payment
        if (!hasStep1 && staggeredService?.total_step1) {
          missing.push({
            type: 'step1',
            label: 'Step 1 Payment',
            amount: staggeredService.total_step1,
            reason: 'First payment for staggered NCLEX Processing'
          })
        }
        if (!hasStep2 && staggeredService?.total_step2) {
          missing.push({
            type: 'step2',
            label: 'Step 2 Payment',
            amount: staggeredService.total_step2,
            reason: 'Second payment for staggered NCLEX Processing'
          })
        }
        // Also show full payment as an option if neither step is complete
        if (!hasStep1 && !hasStep2 && fullService?.total_full) {
          missing.push({
            type: 'full',
            label: 'Full Payment',
            amount: fullService.total_full,
            reason: 'Alternative to staggered payments'
          })
        }
      }
    }

    setMissingPayments(missing)
  }

  async function handleCreatePayment() {
    if (!id || !application) return
    
    setCreatingPayment(true)
    try {
      let amount = 0
      let paymentType: 'step1' | 'step2' | 'full' = 'step1'
      
      if (newPaymentType === 'custom') {
        // Custom payment - use full as the type but with custom amount
        paymentType = 'full'
        amount = newPaymentAmount
      } else if (newPaymentType === 'full') {
        paymentType = 'full'
        amount = fullService?.total_full || newPaymentAmount || 0
      } else if (newPaymentType === 'step1') {
        paymentType = 'step1'
        amount = staggeredService?.total_step1 || newPaymentAmount || 0
      } else if (newPaymentType === 'step2') {
        paymentType = 'step2'
        if (application?.payment_type === 'retake' && retakeService) {
          amount = retakeService.total_step2 || retakeService.total_full || newPaymentAmount || 0
        } else {
          amount = staggeredService?.total_step2 || newPaymentAmount || 0
        }
      }
      
      if (!amount || amount <= 0) {
        showToast('Please enter a valid payment amount', 'error')
        setCreatingPayment(false)
        return
      }
      
      await applicationPaymentsAPI.create(id, paymentType, amount)
      
      // If custom payment, add description to admin note (if API supports it in future)
      // For now, custom payments are stored as 'full' type
      
      showToast('Payment created successfully', 'success')
      setShowCreatePaymentModal(false)
      setNewPaymentType('step1')
      setNewPaymentAmount(0)
      setNewPaymentDescription('')
      await loadPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to create payment', 'error')
    } finally {
      setCreatingPayment(false)
    }
  }

  async function handleViewProof(filePath: string) {
    try {
      if (!filePath) {
        showToast('Proof of payment file path is missing', 'error')
        return
      }
      
      console.log('Loading proof of payment from path:', filePath)
      
      // Try to get signed URL - use longer expiration for admin viewing
      const url = await getSignedFileUrl(filePath, 7200) // 2 hours
      
      if (!url) {
        showToast('Failed to generate access URL for proof of payment', 'error')
        return
      }
      
      const fileName = filePath.split('/').pop() || 'Proof of Payment'
      setViewingProof({ url, fileName })
      setShowProofModal(true)
      setImageZoom(1)
      setImagePosition({ x: 0, y: 0 })
    } catch (error: any) {
      console.error('Error loading proof of payment:', error)
      const errorMessage = error?.message || error?.details || 'Failed to load proof of payment'
      showToast(`Error: ${errorMessage}. Please check if the file exists and you have permission to view it.`, 'error')
    }
  }

  async function handleDownloadProof() {
    if (!viewingProof) return
    
    try {
      const response = await fetch(viewingProof.url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = viewingProof.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      showToast('Proof of payment downloaded successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to download proof of payment', 'error')
    }
  }

  function handleZoomIn() {
    setImageZoom(prev => Math.min(prev + 0.25, 3))
  }

  function handleZoomOut() {
    setImageZoom(prev => Math.max(prev - 0.25, 0.5))
  }

  function handleResetZoom() {
    setImageZoom(1)
    setImagePosition({ x: 0, y: 0 })
  }

  function handleImageMouseDown(e: React.MouseEvent) {
    if (imageZoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y })
    }
  }

  function handleImageMouseMove(e: React.MouseEvent) {
    if (isDragging && imageZoom > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  function handleImageMouseUp() {
    setIsDragging(false)
  }

  async function handleApprovePayment(paymentId: string) {
    setProcessingPaymentAction(true)
    try {
      await applicationPaymentsAPI.approvePayment(paymentId)
      showToast('Payment approved successfully', 'success')
      await loadPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to approve payment', 'error')
    } finally {
      setProcessingPaymentAction(false)
    }
  }

  function handleRejectPaymentClick(paymentId: string) {
    setRejectingPaymentId(paymentId)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  async function handleRejectPayment() {
    if (!rejectingPaymentId) return

    setProcessingPaymentAction(true)
    try {
      await applicationPaymentsAPI.rejectPayment(rejectingPaymentId, rejectionReason.trim() || undefined)
      showToast('Payment rejected', 'success')
      setShowRejectModal(false)
      setRejectingPaymentId(null)
      setRejectionReason('')
      await loadPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to reject payment', 'error')
    } finally {
      setProcessingPaymentAction(false)
    }
  }

  async function handleDeletePayment() {
    if (!deletingPaymentId) return

    setProcessingPaymentAction(true)
    try {
      await applicationPaymentsAPI.delete(deletingPaymentId)
      showToast('Payment deleted successfully', 'success')
      setShowDeleteModal(false)
      setDeletingPaymentId(null)
      await loadPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to delete payment', 'error')
    } finally {
      setProcessingPaymentAction(false)
    }
  }

  if (authLoading || loadingApplication || loadingPayments) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse mb-2" />
            </div>
            <CardSkeleton />
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
          <main className="flex-1 p-4 md:p-8">
            <Card>
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                  Application Not Found
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  The application you are looking for does not exist or you do not have access to it.
                </p>
                <Button onClick={() => navigate('/admin/applications')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Applications
                </Button>
              </div>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  const pendingApprovalPayments = payments.filter(p => p.status === 'pending_approval')
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const otherPayments = payments.filter(p => p.status !== 'pending_approval' && p.status !== 'pending')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/applications/${application?.grit_app_id || id}/timeline`)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Application
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      Payment Review
                    </h1>
                  </div>
                  {application && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Application: {application.first_name} {application.last_name} ({id})
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Client Information Card */}
          <Card className="mb-6 p-6 border-l-4 border-l-blue-600">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Client Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Full Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {application.first_name} {application.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {application.email}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Application ID</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                  {application.grit_app_id || id || ''}
                </p>
              </div>
            </div>
          </Card>

          {/* Payments Needed Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Payments Needed
                </h2>
                {pendingPayments.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-500 text-white">
                    {pendingPayments.length}
                  </span>
                )}
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  analyzeMissingPayments()
                  setShowCreatePaymentModal(true)
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            </div>

            {pendingPayments.length > 0 ? (
              <Card className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
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
                      {pendingPayments.map((payment) => (
                        <tr key={payment.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                            {formatDate(payment.created_at)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                            {payment.payment_type === 'step1' ? 'Step 1' : 
                             payment.payment_type === 'step2' ? (application?.payment_type === 'retake' ? 'Retake' : 'Step 2') : 
                             'Full'}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const checkoutUrl = `${window.location.origin}/applications/${id}/checkout?payment_id=${payment.id}`
                                  navigator.clipboard.writeText(checkoutUrl).then(() => {
                                    showToast('Payment link copied!', 'success')
                                  })
                                }}
                                className="text-xs"
                              >
                                Copy Link
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeletingPaymentId(payment.id)
                                  setShowDeleteModal(true)
                                }}
                                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
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
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payments needed at this time.</p>
                  <p className="text-sm mt-2">Click "Add Payment" to create a new payment entry.</p>
                </div>
              </Card>
            )}
          </div>

          {/* Pending Approval Payments - Priority Section */}
          {pendingApprovalPayments.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Payments Pending Review
                </h2>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-500 text-white">
                  {pendingApprovalPayments.length}
                </span>
              </div>

              <div className="space-y-4">
                {pendingApprovalPayments.map((payment) => (
                  <Card key={payment.id} className="p-6 border-2 border-amber-200 dark:border-amber-800">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Payment Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {payment.payment_type === 'step1' ? 'Step 1 Payment' : 
                             payment.payment_type === 'step2' ? (application?.payment_type === 'retake' ? 'Retake Payment' : 'Step 2 Payment') : 
                             'Full Payment'}
                          </h3>
                          <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                            Awaiting Approval
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              {formatCurrency(payment.amount)}
                            </span>
                            {/* Show PHP conversion for GCash and BDO (mobile_banking) payments */}
                            {(payment.payment_method === 'gcash' || payment.payment_method === 'mobile_banking') && payment.usd_to_php_rate && (
                              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                                (₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(payment.amount * payment.usd_to_php_rate)} PHP @ ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(payment.usd_to_php_rate)}/USD)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">Payment Method:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                              {payment.payment_method || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">Submitted:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(payment.created_at)}
                            </span>
                          </div>
                          {payment.transaction_id && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600 dark:text-gray-400">Transaction ID:</span>
                              <span className="font-mono text-xs text-gray-900 dark:text-gray-100">
                                {payment.transaction_id}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Proof of Payment & Actions */}
                      <div className="lg:w-80 space-y-4">
                        {payment.proof_of_payment_file_path && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2 mb-3">
                              <ImageIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                Proof of Payment
                              </span>
                            </div>
                            <ProofOfPaymentThumbnail 
                              filePath={payment.proof_of_payment_file_path || ''}
                              onViewClick={() => handleViewProof(payment.proof_of_payment_file_path!)}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Button
                            variant="success"
                            onClick={() => handleApprovePayment(payment.id)}
                            disabled={processingPaymentAction}
                            className="w-full flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve Payment
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleRejectPaymentClick(payment.id)}
                            disabled={processingPaymentAction}
                            className="w-full flex items-center justify-center gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject Payment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Payment History - Show all payments (paid, pending_approval, failed) */}
          {otherPayments.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Payment History
                </h2>
              </div>

              <Card className="p-3 sm:p-6">
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Method</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Admin Note</th>
                        <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Proof of Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherPayments.map((payment) => {
                        // Extract admin note from transaction_id for backward compatibility (old format: "REJECTED: reason")
                        const adminNote = payment.admin_note || 
                          (payment.transaction_id?.startsWith('REJECTED: ') 
                            ? payment.transaction_id.replace('REJECTED: ', '') 
                            : null)
                        
                        return (
                          <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {formatDate(payment.created_at, true)}
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              {payment.payment_type === 'step1' ? 'Step 1' : 
                               payment.payment_type === 'step2' ? (application?.payment_type === 'retake' ? 'Retake' : 'Step 2') : 
                               'Full'}
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="py-3 px-2 sm:px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                payment.status === 'paid' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                  : payment.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                  : payment.status === 'pending_approval'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {payment.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                                {payment.status === 'pending' && <Clock className="h-3 w-3" />}
                                {payment.status === 'pending_approval' && <Clock className="h-3 w-3" />}
                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1).replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">
                              {payment.payment_method || 'N/A'}
                            </td>
                            <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                              {adminNote ? (
                                <span className="text-gray-900 dark:text-gray-100" title={adminNote}>
                                  {adminNote.length > 50 ? `${adminNote.substring(0, 50)}...` : adminNote}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-2 sm:px-4">
                              {payment.proof_of_payment_file_path ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewProof(payment.proof_of_payment_file_path!)}
                                  className="text-xs flex items-center gap-1"
                                >
                                  <ImageIcon className="h-3 w-3" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 italic text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Create Payment Modal */}
          <Modal
            isOpen={showCreatePaymentModal}
            onClose={() => {
              setShowCreatePaymentModal(false)
              setNewPaymentType('step1')
              setNewPaymentAmount(0)
              setNewPaymentDescription('')
            }}
            title="Create New Payment"
            size="md"
          >
            <div className="space-y-4">
              {/* Missing Payments Section */}
              {missingPayments.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Missing Payments Based on Service
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {missingPayments.map((missing, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        onClick={() => {
                          setNewPaymentType(missing.type)
                          setNewPaymentAmount(missing.amount)
                        }}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {missing.label}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {missing.reason}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(missing.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    Click on a missing payment to auto-fill the form, or create a custom payment below.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Type
                </label>
                <select
                  value={newPaymentType}
                  onChange={(e) => {
                    const value = e.target.value as 'step1' | 'step2' | 'full' | 'custom'
                    setNewPaymentType(value)
                    // Auto-set amount based on service pricing (unless custom)
                    if (value === 'custom') {
                      setNewPaymentAmount(0)
                    } else if (value === 'full' && fullService) {
                      setNewPaymentAmount(fullService.total_full || 0)
                    } else if (value === 'step1' && staggeredService) {
                      setNewPaymentAmount(staggeredService.total_step1 || 0)
                    } else if (value === 'step2') {
                      if (application?.payment_type === 'retake' && retakeService) {
                        setNewPaymentAmount(retakeService.total_step2 || retakeService.total_full || 0)
                      } else if (staggeredService) {
                        setNewPaymentAmount(staggeredService.total_step2 || 0)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="step1">Step 1 Payment</option>
                  <option value="step2">{application?.payment_type === 'retake' ? 'Retake Payment' : 'Step 2 Payment'}</option>
                  <option value="full">Full Payment</option>
                  <option value="custom">Custom Payment</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (USD) {newPaymentType === 'custom' && <span className="text-red-500">*</span>}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPaymentAmount || ''}
                  onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder={newPaymentType === 'custom' ? "Enter custom payment amount" : "Enter payment amount"}
                  className="w-full"
                  required={newPaymentType === 'custom'}
                />
                {newPaymentAmount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatCurrency(newPaymentAmount)}
                  </p>
                )}
                {newPaymentType === 'custom' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Custom payments allow you to create a payment with any amount not covered by standard service pricing.
                  </p>
                )}
              </div>

              {newPaymentType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <Input
                    type="text"
                    value={newPaymentDescription}
                    onChange={(e) => setNewPaymentDescription(e.target.value)}
                    placeholder="e.g., Additional fees, Late payment, etc."
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Add a note to describe what this custom payment is for.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreatePaymentModal(false)
                    setNewPaymentType('step1')
                    setNewPaymentAmount(0)
                    setNewPaymentDescription('')
                  }}
                  disabled={creatingPayment}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleCreatePayment}
                  disabled={creatingPayment || !newPaymentAmount || newPaymentAmount <= 0}
                >
                  {creatingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Payment'
                  )}
                </Button>
              </div>
            </div>
          </Modal>

          {pendingApprovalPayments.length === 0 && otherPayments.length === 0 && pendingPayments.length === 0 && (
            <Card className="p-6">
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No payments found for this application.
                </p>
              </div>
            </Card>
          )}

          {/* Proof of Payment Modal */}
          {showProofModal && viewingProof && (
            <Modal
              isOpen={showProofModal}
              onClose={() => {
                setShowProofModal(false)
                setViewingProof(null)
                setImageZoom(1)
                setImagePosition({ x: 0, y: 0 })
              }}
              title="Proof of Payment"
              size="xl"
            >
              <div className="space-y-4">
                {/* File Info and Controls */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {viewingProof.fileName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!viewingProof.fileName.match(/\.(pdf)$/i) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleZoomOut}
                          disabled={imageZoom <= 0.5}
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-center">
                          {Math.round(imageZoom * 100)}%
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleZoomIn}
                          disabled={imageZoom >= 3}
                          title="Zoom In"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetZoom}
                          disabled={imageZoom === 1}
                          title="Reset Zoom"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadProof}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                {/* Image/PDF Viewer */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div 
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto bg-white dark:bg-gray-900"
                    style={{ 
                      maxHeight: '70vh',
                      cursor: viewingProof.fileName.match(/\.(pdf)$/i) ? 'default' : (imageZoom > 1 ? 'grab' : 'default')
                    }}
                  >
                    {viewingProof.fileName.match(/\.(pdf)$/i) ? (
                      <iframe
                        src={viewingProof.url}
                        className="w-full"
                        style={{ minHeight: '70vh' }}
                        title="Proof of Payment"
                      />
                    ) : (
                      <div
                        className="relative overflow-auto flex items-start justify-center"
                        style={{ 
                          width: '100%',
                          height: '70vh',
                          cursor: isDragging ? 'grabbing' : (imageZoom > 1 ? 'grab' : 'default')
                        }}
                        onMouseDown={handleImageMouseDown}
                        onMouseMove={handleImageMouseMove}
                        onMouseUp={handleImageMouseUp}
                        onMouseLeave={handleImageMouseUp}
                      >
                        <img
                          src={viewingProof.url}
                          alt="Proof of Payment"
                          className="select-none"
                          crossOrigin="anonymous"
                          style={{
                            width: imageZoom === 1 ? '100%' : 'auto',
                            height: imageZoom === 1 ? 'auto' : 'auto',
                            maxWidth: imageZoom === 1 ? '100%' : 'none',
                            maxHeight: imageZoom === 1 ? '100%' : 'none',
                            objectFit: imageZoom === 1 ? 'contain' : 'none',
                            transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                            transformOrigin: 'top left',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          draggable={false}
                          onError={async (e) => {
                            console.error('Modal image failed to load:', viewingProof.url)
                            // Try to fetch as blob
                            try {
                              const response = await fetch(viewingProof.url, { 
                                mode: 'cors',
                                credentials: 'include'
                              })
                              if (response.ok) {
                                const blob = await response.blob()
                                const objectUrl = URL.createObjectURL(blob)
                                setViewingProof({ ...viewingProof, url: objectUrl })
                              } else {
                                console.error('Fetch failed:', response.status, response.statusText)
                              }
                            } catch (fetchError) {
                              console.error('Fetch error:', fetchError)
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions for images */}
                {!viewingProof.fileName.match(/\.(pdf)$/i) && imageZoom > 1 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      💡 Click and drag to pan around the zoomed image. Use zoom controls to adjust the view.
                    </p>
                  </div>
                )}
              </div>
            </Modal>
          )}

          {/* Reject Payment Modal */}
          {showRejectModal && (
            <Modal
              isOpen={showRejectModal}
              onClose={() => {
                setShowRejectModal(false)
                setRejectingPaymentId(null)
                setRejectionReason('')
              }}
              title="Reject Payment"
              size="md"
            >
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Are you sure you want to reject this payment? This action cannot be undone.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason for Rejection (Optional)
                  </label>
                  <Input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Providing a reason helps the client understand why the payment was rejected.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectModal(false)
                      setRejectingPaymentId(null)
                      setRejectionReason('')
                    }}
                    disabled={processingPaymentAction}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejectPayment}
                    disabled={processingPaymentAction}
                    className="flex items-center gap-2"
                  >
                    {processingPaymentAction ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Reject Payment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Delete Payment Modal */}
          {showDeleteModal && deletingPaymentId && (
            <Modal
              isOpen={showDeleteModal}
              onClose={() => {
                setShowDeleteModal(false)
                setDeletingPaymentId(null)
              }}
              title="Delete Payment"
              size="md"
            >
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                        Warning: This action cannot be undone
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Are you sure you want to delete this payment? This will permanently remove the payment record from the system.
                      </p>
                    </div>
                  </div>
                </div>

                {(() => {
                  const paymentToDelete = pendingPayments.find(p => p.id === deletingPaymentId)
                  if (paymentToDelete) {
                    return (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Payment Details:</p>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {paymentToDelete.payment_type === 'step1' ? 'Step 1' : 
                               paymentToDelete.payment_type === 'step2' ? (application?.payment_type === 'retake' ? 'Retake' : 'Step 2') : 
                               'Full'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {formatCurrency(paymentToDelete.amount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {paymentToDelete.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeletingPaymentId(null)
                    }}
                    disabled={processingPaymentAction}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeletePayment}
                    disabled={processingPaymentAction}
                    className="flex items-center gap-2"
                  >
                    {processingPaymentAction ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Delete Payment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  )
}

