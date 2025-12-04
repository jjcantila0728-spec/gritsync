import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Loading, CardSkeleton } from '@/components/ui/Loading'
import { applicationPaymentsAPI, applicationsAPI, servicesAPI } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getSignedFileUrl } from '@/lib/supabase-api'
import { stripePromise } from '@/lib/stripe'
import { Elements } from '@stripe/react-stripe-js'
import { StripePaymentForm } from '@/components/StripePaymentForm'
import jsPDF from 'jspdf'
import { subscribeToApplicationPayments, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  Receipt, 
  Download, 
  History,
  DollarSign,
  AlertCircle,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon
} from 'lucide-react'

interface PaymentItem {
  name: string
  amount: number
}

interface Receipt {
  id: string
  receipt_number: string
  amount: number
  payment_type: string
  items: PaymentItem[]
  created_at: string
}

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
  admin_note?: string
  created_at: string
  updated_at?: string
}

// Payment pricing will be loaded from admin quote service config

export function ApplicationPayments() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [loadingApplication, setLoadingApplication] = useState(true)
  const [application, setApplication] = useState<any>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [receipts, setReceipts] = useState<{ [paymentId: string]: Receipt }>({})
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [staggeredService, setStaggeredService] = useState<any>(null)
  const [fullService, setFullService] = useState<any>(null)
  const [retakeService, setRetakeService] = useState<any>(null)
  const [loadingServices, setLoadingServices] = useState(true)
  const [expandedStep, setExpandedStep] = useState<'step1' | 'step2' | 'full' | 'retake' | null>(null)
  const [viewingProof, setViewingProof] = useState<{ url: string; fileName: string } | null>(null)
  const [showProofModal, setShowProofModal] = useState(false)
  const [processingPaymentType, setProcessingPaymentType] = useState<'step1' | 'step2' | 'full' | 'retake' | null>(null)
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
            updated[index] = { ...updated[index], ...newRecord }
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
            // Refresh payments to get receipt
            loadPayments()
          } else if (newRecord.status === 'failed') {
            showToast('Payment has been rejected', 'error')
          } else if (newRecord.status === 'pending_approval') {
            showToast('Payment submitted for approval', 'info')
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

  // Load services after application is loaded and payments are loaded
  useEffect(() => {
    if (application && payments.length >= 0) { // payments.length >= 0 means payments have been loaded (even if empty)
      loadServices()
    }
  }, [application, payments])

  // Load services from admin quote service config
  async function loadServices() {
    if (!application) {
      return
    }
    
    try {
      setLoadingServices(true)
      // Determine payment type from application
      const dbPaymentType = application?.payment_type
      
      // Check if there are existing payments - if there are step1/step2 payments, 
      // it means the user intended staggered payment, so override the database value
      const hasStaggeredPayments = payments.some(p => p.payment_type === 'step1' || p.payment_type === 'step2')
      const hasFullPayment = payments.some(p => p.payment_type === 'full')
      const hasNoPayments = payments.length === 0
      
      // Handle retake payment type - retake only needs Step 2 as full payment
      if (dbPaymentType === 'retake') {
        // For retake, load the service and use Step 2 items as full payment
        // Try to get retake service, or fallback to staggered service (which has step2)
        const services = await servicesAPI.getAllByServiceAndState('NCLEX Processing', 'New York')
        const retakeServiceData = services.find((s: any) => s.payment_type === 'retake') || 
                                 services.find((s: any) => s.payment_type === 'staggered')
        
        if (retakeServiceData) {
          setRetakeService(retakeServiceData)
          setFullService(null)
          setStaggeredService(null)
        } else {
          showToast('Retake payment service not configured. Please contact support.', 'error')
        }
        return
      }
      
      // If there are staggered payments but DB says 'full', use staggered
      // If there are full payments, use full
      // If DB says 'full' but there are no payments yet, default to staggered (likely a data entry error)
      // Otherwise, use DB value or default to staggered
      let paymentType = dbPaymentType || 'staggered'
      
      if (hasStaggeredPayments && !hasFullPayment) {
        paymentType = 'staggered'
      } else if (hasFullPayment && !hasStaggeredPayments) {
        paymentType = 'full'
      } else if (hasNoPayments && dbPaymentType === 'full') {
        // TEMPORARY FIX: If DB says 'full' but no payments exist yet, default to staggered
        // This handles cases where the database value was incorrectly set
        paymentType = 'staggered'
      }
      
      if (paymentType === 'full') {
        // Load full payment service
        const service = await servicesAPI.getByServiceStateAndPaymentType('NCLEX Processing', 'New York', 'full')
        if (service) {
          setFullService(service)
          setStaggeredService(null) // Clear staggered service
          setRetakeService(null) // Clear retake service
        }
      } else {
        // Load staggered payment service (default for 'staggered', null, or undefined)
        const service = await servicesAPI.getByServiceStateAndPaymentType('NCLEX Processing', 'New York', 'staggered')
        if (service) {
          setStaggeredService(service)
          setFullService(null) // Clear full service
          setRetakeService(null) // Clear retake service
        }
      }
    } catch (error) {
      // Fallback to hardcoded config if service fetch fails
    } finally {
      setLoadingServices(false)
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
      setPayments(data || [])
      
      // Load receipts for paid payments
      const paidPayments = (data || []).filter((p: Payment) => p.status === 'paid')
      const receiptsMap: { [paymentId: string]: Receipt } = {}
      
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
      console.error('Error loading payments:', error)
      showToast('Failed to load payments', 'error')
    } finally {
      setLoadingPayments(false)
    }
  }

  async function handleCreatePayment(type: 'step1' | 'step2' | 'full') {
    if (!id) return

    setLoading(true)
    try {
      let amount = 0
      if (type === 'full') {
        amount = fullService?.total_full || 0
      } else if (type === 'step1') {
        amount = staggeredService?.total_step1 || 0
      } else {
        amount = staggeredService?.total_step2 || 0
      }

      if (!amount) {
        showToast('Service pricing not available. Please contact support.', 'error')
        setLoading(false)
        return
      }

      await applicationPaymentsAPI.create(id, type, amount)
      showToast('Payment created successfully', 'success')
      await loadPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to create payment', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handlePayNow(type: 'step1' | 'step2' | 'full' | 'retake') {
    if (!id) return
    if (!stripePromise) {
      showToast('Stripe is not configured. Please contact support.', 'error')
      return
    }

    setProcessingPaymentType(type)
    setLoading(true)
    try {
      // Step 1: Calculate amount
      let amount = 0
      if (type === 'full') {
        amount = fullService?.total_full || 0
      } else if (type === 'retake') {
        // For retake, use Step 2 total from retake service
        // If retake service has step2, use that; otherwise use total_full or calculate from line_items
        if (!retakeService) {
          showToast('Retake payment service not loaded. Please refresh the page.', 'error')
          setLoading(false)
          setProcessingPaymentType(null)
          return
        }
        
        if (retakeService.total_step2) {
          amount = retakeService.total_step2
        } else if (retakeService.total_full) {
          amount = retakeService.total_full
        } else if (retakeService.line_items) {
          // Calculate from Step 2 line items if totals are not available
          const step2Items = retakeService.line_items.filter((item: any) => item.step === 2 || !item.step)
          amount = step2Items.reduce((sum: number, item: any) => {
            const itemTotal = (item.amount || 0) + (item.taxable ? (item.amount || 0) * 0.12 : 0)
            return sum + itemTotal
          }, 0)
        } else {
          amount = 0
        }
      } else if (type === 'step1') {
        amount = staggeredService?.total_step1 || 0
      } else {
        amount = staggeredService?.total_step2 || 0
      }

      if (!amount) {
        showToast('Service pricing not available. Please contact support.', 'error')
        setLoading(false)
        setProcessingPaymentType(null)
        return
      }

      // Step 2: Create payment record
      // For retake, use 'step2' as payment_type since it's Step 2 items as full payment
      const paymentTypeForAPI = type === 'retake' ? 'step2' : type
      const payment = await applicationPaymentsAPI.create(id, paymentTypeForAPI, amount)
      
      // Step 3: Create payment intent and open modal
      const intentData = await applicationPaymentsAPI.createPaymentIntent(payment.id)
      
      if (!intentData.clientSecret) {
        throw new Error('Payment intent creation failed: No client secret returned')
      }

      setSelectedPayment(payment)
      setClientSecret(intentData.clientSecret)
      setPaymentIntentId(intentData.paymentIntentId)
      setShowPaymentModal(true)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to initialize payment. Please try again or contact support if the problem persists.'
      showToast(errorMessage, 'error')
      // Reload payments in case payment was created but intent failed
      await loadPayments()
    } finally {
      setLoading(false)
      setProcessingPaymentType(null)
    }
  }

  async function handleCompletePayment(payment: Payment) {
    if (!stripePromise) {
      showToast('Stripe is not configured. Please contact support.', 'error')
      return
    }

    if (!payment || !payment.id) {
      showToast('Payment information is missing. Please try again.', 'error')
      return
    }

    setSelectedPayment(payment)
    setLoading(true)
    
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
        errorMessage += 'Please try again or contact support if the problem persists.'
      }
      
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handlePaymentSuccess(
    paymentIntentId: string, 
    paymentMethod?: 'card' | 'gcash' | 'mobile_banking', 
    gcashDetails?: { number: string; reference: string },
    proofOfPaymentFile?: File
  ) {
    if (!selectedPayment) return

    setLoading(true)
    try {
      const result = await applicationPaymentsAPI.complete(
        selectedPayment.id, 
        undefined, 
        paymentMethod === 'gcash' || paymentMethod === 'mobile_banking' ? undefined : paymentIntentId,
        paymentMethod || 'stripe',
        gcashDetails,
        proofOfPaymentFile
      )
      
      if (result.receipt) {
        setReceipts({ ...receipts, [selectedPayment.id]: result.receipt })
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
      await loadPayments()
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to complete payment. Please try again or contact support if the problem persists.'
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleViewProof(filePath: string) {
    try {
      const url = await getSignedFileUrl(filePath, 3600)
      const fileName = filePath.split('/').pop() || 'Proof of Payment'
      setViewingProof({ url, fileName })
      setShowProofModal(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to load proof of payment', 'error')
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

  function handleDownloadReceipt(receipt: Receipt) {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - (margin * 2)
      let yPos = margin

      // Colors
      const primaryColor = [220, 38, 38] // Red #dc2626
      const lightGray = [243, 244, 246] // Gray-100
      const textGray = [107, 114, 128] // Gray-500
      const textDark = [17, 24, 39] // Gray-900

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
                               receipt.payment_type === 'step2' ? (application?.payment_type === 'retake' ? 'Retake Payment' : 'Step 2 Payment') : 
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
      receipt.items.forEach((item, index) => {
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

  const pendingPayments = payments.filter(p => p.status === 'pending')
  const pendingApprovalPayments = payments.filter(p => p.status === 'pending_approval')
  const paidPayments = payments.filter(p => p.status === 'paid')
  const completedPaymentTypes = paidPayments.map(p => p.payment_type)
  
  // Check if there's a pending approval payment for each type
  const hasPendingApprovalStep1 = pendingApprovalPayments.some(p => p.payment_type === 'step1')
  const hasPendingApprovalStep2 = pendingApprovalPayments.some(p => p.payment_type === 'step2')

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
                <Button onClick={() => navigate('/applications')}>
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
                  onClick={() => navigate(`/applications/${application?.grit_app_id || id}/timeline`)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Application
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Payments
                  </h1>
                  {application && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Application: {application.first_name} {application.last_name} ({id})
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                {pendingPayments.map((payment) => (
                  <Card key={payment.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {payment.status === 'pending_approval' ? (
                            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          )}
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {payment.payment_type === 'step1' ? 'Step 1 Payment' : 
                             payment.payment_type === 'step2' ? (application?.payment_type === 'retake' ? 'Retake Payment' : 'Step 2 Payment') : 
                             'Full Payment'}
                          </h3>
                          {payment.status === 'pending_approval' && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                              Awaiting Approval
                            </span>
                          )}
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
                        {payment.status === 'pending_approval' ? (
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            Awaiting admin approval
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleCompletePayment(payment)}
                            disabled={loading}
                            className="flex items-center gap-2"
                          >
                            <CreditCard className="h-4 w-4" />
                            Complete Payment
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}

            {/* Available Payments to Create - Compact Expandable Cards */}
            {pendingPayments.length === 0 && (staggeredService || fullService || retakeService) && !loadingServices && (
              <div className="space-y-3 mt-4">
                
                {/* Retake Payment Option - Step 2 as Full Payment */}
                {application?.payment_type === 'retake' && retakeService && !completedPaymentTypes.includes('step2') && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Card className="border-2 border-gray-200 dark:border-gray-700 flex-1">
                      <div 
                        className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setExpandedStep(expandedStep === 'retake' ? null : 'retake')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">R</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Retake Payment</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {payments.some(p => p.payment_type === 'step2' && p.status === 'pending_approval')
                                  ? 'Awaiting admin approval' 
                                  : `Total: ${formatCurrency(retakeService?.total_step2 || retakeService?.total_full || 0)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {payments.some(p => p.payment_type === 'step2' && p.status === 'pending_approval') ? (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                Pending Approval
                              </span>
                            ) : (
                              <>
                                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(retakeService?.total_step2 || retakeService?.total_full || 0)}
                                </span>
                                {expandedStep === 'retake' ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {expandedStep === 'retake' && !payments.some(p => p.payment_type === 'step2' && p.status === 'pending_approval') && (
                        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                          <div className="space-y-1.5 mb-3">
                            {/* Show Step 2 items from retake service */}
                            {(retakeService?.line_items?.filter((item: any) => item.step === 2) || retakeService?.line_items || []).map((item: any, idx: number) => {
                              const itemTax = calculateItemTax(item)
                              const itemTotal = calculateItemTotal(item)
                              return (
                                <div key={idx} className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {item.description}
                                      {item.taxable && (
                                        <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                      )}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                      {formatCurrency(item.amount)}
                                    </span>
                                  </div>
                                  {item.taxable && itemTax > 0 && (
                                    <div className="flex justify-between text-xs pl-3 text-gray-600 dark:text-gray-400">
                                      <span>Tax (12%):</span>
                                      <span>{formatCurrency(itemTax)}</span>
                                    </div>
                                  )}
                                  {item.taxable && (
                                    <div className="flex justify-between text-xs pl-3 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                      <span>Subtotal:</span>
                                      <span>{formatCurrency(itemTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {formatCurrency((retakeService?.total_step2 || retakeService?.total_full || 0) - (retakeService?.tax_step2 || retakeService?.tax_amount || 0))}
                              </span>
                            </div>
                            {(retakeService?.tax_step2 || retakeService?.tax_amount) && (retakeService?.tax_step2 || retakeService?.tax_amount) > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                                <span className="text-gray-900 dark:text-gray-100 font-medium">
                                  {formatCurrency(retakeService?.tax_step2 || retakeService?.tax_amount)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mb-3">
                            <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total</span>
                            <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                              {formatCurrency(retakeService?.total_step2 || retakeService?.total_full || 0)}
                            </span>
                          </div>
                        </div>
                      )}
                    </Card>
                    
                    {/* Pay Now Box */}
                    {!payments.some(p => p.payment_type === 'step2' && p.status === 'pending_approval') && (
                      <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 flex-shrink-0 w-full sm:w-48">
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                          <div className="text-center mb-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Retake Payment</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {formatCurrency(retakeService?.total_step2 || retakeService?.total_full || 0)}
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePayNow('retake')
                            }}
                            disabled={loading}
                            size="sm"
                          >
                            {loading && processingPaymentType === 'retake' ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-1.5" />
                                Pay Now
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* Full Payment Option - Only show if payment_type is explicitly 'full' */}
                {application?.payment_type === 'full' && fullService && !completedPaymentTypes.includes('full') && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Card className="border-2 border-gray-200 dark:border-gray-700 flex-1">
                      <div 
                        className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setExpandedStep(expandedStep === 'full' ? null : 'full')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">$</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Full Payment</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {payments.some(p => p.payment_type === 'full' && p.status === 'pending_approval')
                                  ? 'Awaiting admin approval' 
                                  : `Total: ${formatCurrency(fullService.total_full || 0)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {payments.some(p => p.payment_type === 'full' && p.status === 'pending_approval') ? (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                Pending Approval
                              </span>
                            ) : (
                              <>
                                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(fullService.total_full || 0)}
                                </span>
                                {expandedStep === 'full' ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {expandedStep === 'full' && !payments.some(p => p.payment_type === 'full' && p.status === 'pending_approval') && (
                        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="space-y-1.5 mb-3">
                          {fullService.line_items?.map((item: any, idx: number) => {
                            const itemTax = calculateItemTax(item)
                            const itemTotal = calculateItemTotal(item)
                            return (
                              <div key={idx} className="space-y-0.5">
                                <div className="flex justify-between text-xs">
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
                                  <div className="flex justify-between text-xs pl-3 text-gray-600 dark:text-gray-400">
                                    <span>Tax (12%):</span>
                                    <span>{formatCurrency(itemTax)}</span>
                                  </div>
                                )}
                                {item.taxable && (
                                  <div className="flex justify-between text-xs pl-3 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(itemTotal)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {formatCurrency((fullService.total_full || 0) - (fullService.tax_amount || 0))}
                            </span>
                          </div>
                          {fullService.tax_amount && fullService.tax_amount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {formatCurrency(fullService.tax_amount)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mb-3">
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total</span>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(fullService.total_full || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                    </Card>
                    
                        {/* Pay Now Box */}
                        {!payments.some(p => p.payment_type === 'full' && p.status === 'pending_approval') && (
                      <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 flex-shrink-0 w-full sm:w-48">
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                          <div className="text-center mb-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Full Payment</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {formatCurrency(fullService.total_full || 0)}
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePayNow('full')
                            }}
                            disabled={loading}
                            size="sm"
                          >
                            {loading && processingPaymentType === 'full' ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-1.5" />
                                Pay Now
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* Staggered Payment Options */}
                {application?.payment_type !== 'full' && staggeredService && (
                  <>
                    {/* Step 1 Payment */}
                    {!completedPaymentTypes.includes('step1') && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Card className="border-2 border-gray-200 dark:border-gray-700 flex-1">
                          <div 
                            className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setExpandedStep(expandedStep === 'step1' ? null : 'step1')}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Step 1 Payment</h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {hasPendingApprovalStep1 
                                      ? 'Awaiting admin approval' 
                                      : `Total: ${formatCurrency(staggeredService.total_step1 || 0)}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasPendingApprovalStep1 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                    Pending Approval
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                                      {formatCurrency(staggeredService.total_step1 || 0)}
                                    </span>
                                    {expandedStep === 'step1' ? (
                                      <ChevronUp className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {expandedStep === 'step1' && !hasPendingApprovalStep1 && (
                            <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="space-y-1.5 mb-3">
                          {staggeredService.line_items
                            ?.filter((item: any) => item.step === 1 || !item.step)
                            .map((item: any, idx: number) => {
                              const itemTax = calculateItemTax(item)
                              const itemTotal = calculateItemTotal(item)
                              return (
                                <div key={idx} className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {item.description}
                                      {item.taxable && (
                                        <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                      )}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                      {formatCurrency(item.amount)}
                                    </span>
                                  </div>
                                  {item.taxable && itemTax > 0 && (
                                    <div className="flex justify-between text-xs pl-3 text-gray-600 dark:text-gray-400">
                                      <span>Tax (12%):</span>
                                      <span>{formatCurrency(itemTax)}</span>
                                    </div>
                                  )}
                                  {item.taxable && (
                                    <div className="flex justify-between text-xs pl-3 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                      <span>Subtotal:</span>
                                      <span>{formatCurrency(itemTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                        <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {formatCurrency((staggeredService.total_step1 || 0) - (staggeredService.tax_step1 || 0))}
                            </span>
                          </div>
                          {staggeredService.tax_step1 && staggeredService.tax_step1 > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {formatCurrency(staggeredService.tax_step1)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mb-3">
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total</span>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(staggeredService.total_step1 || 0)}
                          </span>
                        </div>
                            </div>
                          )}
                        </Card>
                        
                        {/* Pay Now Box */}
                        {!hasPendingApprovalStep1 && (
                          <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 flex-shrink-0 w-full sm:w-48">
                            <div className="p-4 flex flex-col items-center justify-center h-full">
                              <div className="text-center mb-3">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Step 1 Payment</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(staggeredService.total_step1 || 0)}
                                </p>
                              </div>
                              <Button
                                className="w-full"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handlePayNow('step1')
                                }}
                                disabled={loading}
                                size="sm"
                              >
                                {loading && processingPaymentType === 'step1' ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="h-4 w-4 mr-1.5" />
                                    Pay Now
                                  </>
                                )}
                              </Button>
                            </div>
                          </Card>
                        )}
                      </div>
                    )}

                {/* Step 2 Payment */}
                {!completedPaymentTypes.includes('step2') && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Card className={`border-2 flex-1 ${completedPaymentTypes.includes('step1') ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-60'}`}>
                      <div 
                        className={`p-3 ${completedPaymentTypes.includes('step1') ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors' : 'cursor-not-allowed'}`}
                        onClick={() => completedPaymentTypes.includes('step1') && setExpandedStep(expandedStep === 'step2' ? null : 'step2')}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                              completedPaymentTypes.includes('step1') 
                                ? 'bg-green-100 dark:bg-green-900/30' 
                                : 'bg-gray-100 dark:bg-gray-800'
                            }`}>
                              <span className={`text-xs font-bold ${
                                completedPaymentTypes.includes('step1')
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}>2</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm font-semibold ${completedPaymentTypes.includes('step1') ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                                Step 2 Payment
                              </h4>
                              <p className={`text-xs ${completedPaymentTypes.includes('step1') ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {hasPendingApprovalStep2 
                                  ? 'Awaiting admin approval' 
                                  : completedPaymentTypes.includes('step1')
                                  ? `Total: ${formatCurrency(staggeredService.total_step2 || 0)}`
                                  : 'Complete Step 1 first'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasPendingApprovalStep2 ? (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                Pending Approval
                              </span>
                            ) : completedPaymentTypes.includes('step1') ? (
                              <>
                                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(staggeredService.total_step2 || 0)}
                                </span>
                                {expandedStep === 'step2' ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">Locked</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {expandedStep === 'step2' && !hasPendingApprovalStep2 && completedPaymentTypes.includes('step1') && (
                        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="space-y-1.5 mb-3">
                          {staggeredService.line_items
                            ?.filter((item: any) => item.step === 2)
                            .map((item: any, idx: number) => {
                              const itemTax = calculateItemTax(item)
                              const itemTotal = calculateItemTotal(item)
                              return (
                                <div key={idx} className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {item.description}
                                      {item.taxable && (
                                        <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                      )}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                      {formatCurrency(item.amount)}
                                    </span>
                                  </div>
                                  {item.taxable && itemTax > 0 && (
                                    <div className="flex justify-between text-xs pl-3 text-gray-600 dark:text-gray-400">
                                      <span>Tax (12%):</span>
                                      <span>{formatCurrency(itemTax)}</span>
                                    </div>
                                  )}
                                  {item.taxable && (
                                    <div className="flex justify-between text-xs pl-3 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                      <span>Subtotal:</span>
                                      <span>{formatCurrency(itemTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                        <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {formatCurrency((staggeredService.total_step2 || 0) - (staggeredService.tax_step2 || 0))}
                            </span>
                          </div>
                          {staggeredService.tax_step2 && staggeredService.tax_step2 > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-700 dark:text-gray-300">Total Tax</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {formatCurrency(staggeredService.tax_step2)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mb-3">
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total</span>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatCurrency(staggeredService.total_step2 || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                    </Card>
                    
                    {/* Pay Now Box */}
                    {!hasPendingApprovalStep2 && completedPaymentTypes.includes('step1') && (
                      <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 flex-shrink-0 w-full sm:w-48">
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                          <div className="text-center mb-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Step 2 Payment</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {formatCurrency(staggeredService.total_step2 || 0)}
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePayNow('step2')
                            }}
                            disabled={loading}
                            size="sm"
                          >
                            {loading && processingPaymentType === 'step2' ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-1.5" />
                                Pay Now
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>
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
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Method</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Admin Note</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Proof of Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => {
                        // Extract admin note from transaction_id for backward compatibility (old format: "REJECTED: reason")
                        const adminNote = payment.admin_note || 
                          (payment.transaction_id?.startsWith('REJECTED: ') 
                            ? payment.transaction_id.replace('REJECTED: ', '') 
                            : null)
                        
                        return (
                          <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(payment.created_at, true)}
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
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 capitalize">
                              {payment.payment_method || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                              {adminNote ? (
                                <span className="text-gray-900 dark:text-gray-100" title={adminNote}>
                                  {adminNote.length > 50 ? `${adminNote.substring(0, 50)}...` : adminNote}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
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
              size="lg"
            >
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripePaymentForm
                  paymentIntentId={paymentIntentId || undefined}
                  amount={selectedPayment.amount}
                  onSuccess={(paymentIntentId: string, paymentMethod?: any, details?: any, proofFile?: File) => {
                    handlePaymentSuccess(paymentIntentId, paymentMethod, details, proofFile)
                  }}
                  onError={(error: string) => showToast(error, 'error')}
                />
              </Elements>
            </Modal>
          )}

          {/* Proof of Payment Modal */}
          {showProofModal && viewingProof && (
            <Modal
              isOpen={showProofModal}
              onClose={() => {
                setShowProofModal(false)
                setViewingProof(null)
              }}
              title="Proof of Payment"
              size="xl"
            >
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {viewingProof.fileName}
                  </p>
                </div>

                {/* Image/PDF Viewer */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div 
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto bg-white dark:bg-gray-900"
                    style={{ maxHeight: '70vh' }}
                  >
                    {viewingProof.fileName.match(/\.(pdf)$/i) ? (
                      <iframe
                        src={viewingProof.url}
                        className="w-full"
                        style={{ minHeight: '70vh' }}
                        title="Proof of Payment"
                      />
                    ) : (
                      <img
                        src={viewingProof.url}
                        alt="Proof of Payment"
                        className="w-full h-auto max-h-[70vh] object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
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
                      {viewingReceipt.items.map((item, idx) => (
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
    </div>
  )
}


