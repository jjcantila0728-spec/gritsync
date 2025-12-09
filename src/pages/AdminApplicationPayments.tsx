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
import { applicationPaymentsAPI, applicationsAPI, adminAPI } from '@/lib/api'
import { subscribeToApplicationPayments, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getSignedFileUrl } from '@/lib/supabase-api'
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
  Maximize2
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
  const paymentsChannelRef = useRef<RealtimeChannel | null>(null)

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

  // Set up real-time subscription for payment updates
  useEffect(() => {
    if (!id) return

    const paymentsChannel = subscribeToApplicationPayments(id, (payload) => {
      handlePaymentRealtimeUpdate(payload)
    })
    paymentsChannelRef.current = paymentsChannel

    // Cleanup on unmount
    return () => {
      if (paymentsChannelRef.current) {
        unsubscribe(paymentsChannelRef.current)
        paymentsChannelRef.current = null
      }
    }
  }, [id])

  // Handle real-time payment updates
  function handlePaymentRealtimeUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord) {
        // New payment added - refresh payments
        loadPayments()
      } else if (eventType === 'UPDATE' && newRecord) {
        // Payment updated - update in place or refresh
        setPayments((prev) => {
          const index = prev.findIndex((p) => p.id === newRecord.id)
          if (index >= 0) {
            const updated = [...prev]
            // Update payment with new data, preserving existing rate if not provided
            const existingPayment = prev[index]
            updated[index] = {
              ...existingPayment,
              ...newRecord,
              // Preserve usd_to_php_rate if not in new record
              usd_to_php_rate: newRecord.usd_to_php_rate || existingPayment.usd_to_php_rate
            }
            return updated
          } else {
            // Payment not in list, might be new - refresh to be safe
            loadPayments()
            return prev
          }
        })

        // Show notification for status changes
        if (oldRecord && oldRecord.status !== newRecord.status) {
          if (newRecord.status === 'paid') {
            showToast('Payment has been approved! ✅', 'success')
          } else if (newRecord.status === 'failed') {
            showToast('Payment has been rejected', 'error')
          } else if (newRecord.status === 'pending_approval') {
            showToast('New payment awaiting approval', 'info')
          }
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        // Payment deleted - remove from list
        setPayments((prev) => prev.filter((p) => p.id !== oldRecord.id))
      }
    } catch (error) {
      console.error('Error handling real-time payment update:', error)
      // Fallback to full refresh on error
      loadPayments()
    }
  }

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

  async function handleViewProof(filePath: string) {
    try {
      const url = await getSignedFileUrl(filePath, 3600)
      const fileName = filePath.split('/').pop() || 'Proof of Payment'
      setViewingProof({ url, fileName })
      setShowProofModal(true)
      setImageZoom(1)
      setImagePosition({ x: 0, y: 0 })
    } catch (error: any) {
      showToast(error.message || 'Failed to load proof of payment', 'error')
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
  const otherPayments = payments.filter(p => p.status !== 'pending_approval')

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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewProof(payment.proof_of_payment_file_path!)}
                              className="w-full flex items-center justify-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Proof
                            </Button>
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

          {/* All Other Payments */}
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

          {pendingApprovalPayments.length === 0 && otherPayments.length === 0 && (
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
                        className="relative overflow-auto"
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
                          style={{
                            transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                            transformOrigin: 'top left',
                            maxWidth: 'none',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                          }}
                          draggable={false}
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
        </main>
      </div>
    </div>
  )
}

