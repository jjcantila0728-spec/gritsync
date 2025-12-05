import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton } from '@/components/ui/Loading'
import { applicationPaymentsAPI, applicationsAPI, servicesAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { stripePromise } from '@/lib/stripe'
import { Elements } from '@stripe/react-stripe-js'
import { StripePaymentForm } from '@/components/StripePaymentForm'
import { ArrowLeft, CheckCircle, CreditCard, Receipt, Download, AlertCircle } from 'lucide-react'
import jsPDF from 'jspdf'

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

// Payment pricing will be loaded from admin quote service config

export function ApplicationPayment() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [application, setApplication] = useState<any>(null)
  const [paymentType, setPaymentType] = useState<'step1' | 'step2' | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [completedPayments, setCompletedPayments] = useState<string[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const hasProcessedTypeParam = useRef(false)
  const [staggeredService, setStaggeredService] = useState<any>(null)
  const [loadingServices, setLoadingServices] = useState(true)

  useEffect(() => {
    if (authLoading) return
    
    if (!user) {
      navigate('/login')
      return
    }

    if (applicationId) {
      fetchApplication()
      loadPayments()
      loadServices()
    } else {
      setError('Application ID is required')
      setLoading(false)
    }
  }, [applicationId, user, authLoading, navigate])

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

  // Calculate tax for a single item (12% tax rate)
  const calculateItemTax = (item: any): number => {
    const TAX_RATE = 0.12
    return item.taxable ? (item.amount || 0) * TAX_RATE : 0
  }

  // Calculate item total (amount + tax)
  const calculateItemTotal = (item: any): number => {
    return (item.amount || 0) + calculateItemTax(item)
  }

  // Check URL params for payment type and auto-create payment
  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam && applicationId && application && !loadingPayments && !hasProcessedTypeParam.current) {
      hasProcessedTypeParam.current = true
      // Use a small delay to ensure payments are loaded
      const timer = setTimeout(() => {
        handleAutoCreatePayment(typeParam as 'step1' | 'step2')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, applicationId, application, loadingPayments])

  async function fetchApplication() {
    if (!applicationId) return
    setLoading(true)
    setError(null)
    try {
      const data = await applicationsAPI.getById(applicationId)
      setApplication(data)
    } catch (error: any) {
      console.error('Error fetching application:', error)
      setError(error.message || 'Application not found')
      showToast(error.message || 'Failed to load application', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadPayments() {
    if (!applicationId) return
    setLoadingPayments(true)
    try {
      const payments = await applicationPaymentsAPI.getByApplication(applicationId)
      const paid = payments.filter((p: any) => p.status === 'paid')
      const pending = payments.filter((p: any) => p.status === 'pending')
      setCompletedPayments(paid.map((p: any) => p.payment_type))
      setPendingPayments(pending)
      
      // Check if there's a receipt for any payment
      for (const payment of paid) {
        try {
          const typedPayment = payment as { id?: string }
          if (typedPayment.id) {
            const receiptData = await applicationPaymentsAPI.getReceipt(typedPayment.id)
            setReceipt(receiptData)
            break
          }
        } catch (error) {
          // No receipt yet
        }
      }
    } catch (error: any) {
      console.error('Error loading payments:', error)
      // Don't show error toast here as it might be expected if no payments exist
    } finally {
      setLoadingPayments(false)
    }
  }

  async function handleAutoCreatePayment(type: 'step1' | 'step2') {
    // Check if payment already exists for this type
    const existingPayment = pendingPayments.find((p: any) => p.payment_type === type)
    if (existingPayment) {
      // Payment already exists, open Stripe modal
      handleCompletePayment(existingPayment)
      return
    }

    // Check if already paid
    if (completedPayments.includes(type)) {
      showToast(`Payment for ${type} is already completed`, 'info')
      return
    }

    // Create payment and open Stripe modal
    try {
      const amount = type === 'step1' 
        ? (staggeredService?.total_step1 || 0)
        : (staggeredService?.total_step2 || 0)

      if (!amount) {
        showToast('Service pricing not available. Please contact support.', 'error')
        return
      }

      const payment = await applicationPaymentsAPI.create(applicationId!, type, amount)
      setPaymentId(payment.id)
      setPaymentType(type)
      
      // Immediately open Stripe payment modal
      await handleCompletePayment(payment)
    } catch (error: any) {
      showToast(error.message || 'Failed to create payment', 'error')
    }
  }

  async function handleCreatePayment(type: 'step1' | 'step2') {
    if (!applicationId) return

    setLoading(true)
    try {
      const amount = type === 'step1' 
        ? (staggeredService?.total_step1 || 0)
        : (staggeredService?.total_step2 || 0)

      if (!amount) {
        showToast('Service pricing not available. Please contact support.', 'error')
        setLoading(false)
        return
      }

      const payment = await applicationPaymentsAPI.create(applicationId, type, amount)
      setPaymentId(payment.id)
      setPaymentType(type)
      showToast('Payment created. Please complete the payment.', 'success')
      // Reload payments to update UI
      await loadPayments()
    } catch (error: any) {
      showToast(error.message || 'Failed to create payment', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompletePayment(payment?: any, paymentMethod: 'card' | 'gcash' = 'card') {
    const targetPayment = payment || (paymentId ? { id: paymentId } : null)
    if (!targetPayment) {
      showToast('Payment information is missing. Please try again.', 'error')
      return
    }

    // For GCash, we don't need Stripe payment intent
    if (paymentMethod === 'gcash') {
      setPaymentId(targetPayment.id)
      setShowPaymentModal(true)
      // For GCash, we'll use a special client secret value
      setClientSecret('gcash')
      setPaymentIntentId(null)
      return
    }

    if (!stripePromise) {
      showToast('Stripe is not configured. Please contact support.', 'error')
      return
    }

    setPaymentId(targetPayment.id)
    setLoading(true)
    
    try {
      // Create payment intent
      const intentData = await applicationPaymentsAPI.createPaymentIntent(targetPayment.id)
      
      if (!intentData.clientSecret) {
        throw new Error('Payment intent creation failed: No client secret returned')
      }
      
      setClientSecret(intentData.clientSecret)
      setPaymentIntentId(intentData.paymentIntentId)
      setShowPaymentModal(true)
    } catch (error: any) {
      console.error('Payment intent creation error:', error)
      console.error('Error details:', {
        message: error.message,
        error: error.error,
        stack: error.stack
      })
      
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
      setLoading(false)
    }
  }

  async function handlePaymentSuccess(
    paymentIntentId: string, 
    paymentMethod?: 'card' | 'gcash' | 'mobile_banking', 
    gcashDetails?: { number: string; reference: string },
    proofOfPaymentFile?: File
  ) {
    if (!paymentId) return

    setLoading(true)
    try {
      // For manual GCash, paymentIntentId is the transaction reference
      const transactionId = paymentMethod === 'gcash' ? paymentIntentId : undefined
      const stripePaymentIntentId = (paymentMethod === 'card' && paymentIntentId) ? paymentIntentId : undefined
      
      const result = await applicationPaymentsAPI.complete(
        paymentId, 
        transactionId, 
        stripePaymentIntentId,
        (paymentMethod === 'card' ? 'stripe' : paymentMethod) || 'stripe',
        gcashDetails,
        proofOfPaymentFile
      )
      
      if (result && result.receipt) {
        setReceipt(result.receipt)
      }
      
      setPaymentId(null)
      setPaymentType(null)
      setClientSecret(null)
      setPaymentIntentId(null)
      setShowPaymentModal(false)
      if (result && result.payment) {
        const typedResult = result as { payment?: { payment_type?: string } }
        if (typedResult.payment?.payment_type) {
          setCompletedPayments([...completedPayments, typedResult.payment.payment_type])
        }
      }
      
      if (paymentMethod === 'gcash') {
        showToast('GCash payment submitted! Your payment will be verified manually. You will receive a confirmation once verified.', 'success')
      } else if (paymentMethod === 'mobile_banking') {
        showToast('Mobile banking payment submitted! Your proof of payment has been uploaded. An admin will review and approve your payment. You will receive a confirmation once approved.', 'success')
      } else {
        showToast('Payment completed successfully! Receipt generated.', 'success')
      }
      
      // Reload payments to update UI
      await loadPayments()
      // Remove type param from URL
      navigate(`/applications/${applicationId}/payment`, { replace: true })
    } catch (error: any) {
      showToast(error.message || 'Failed to complete payment', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleDownloadReceipt() {
    if (!receipt) return

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

  if (authLoading || loading) {
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

  if (error || !application) {
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
                  {error || 'The application you are looking for does not exist or you do not have access to it.'}
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
                  onClick={() => navigate(`/applications/${applicationId}/timeline`)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Payment Portal
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Application: {application.first_name} {application.last_name} ({applicationId})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {receipt && (
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Payment Completed
                  </h2>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDownloadReceipt}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Receipt
                </Button>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Receipt Number:</strong> {receipt.receipt_number}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  <strong>Amount:</strong> {formatCurrency(receipt.amount)}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  <strong>Date:</strong> {new Date(receipt.created_at).toLocaleDateString()}
                </p>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Payment
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Complete your payments in steps. Step 1 must be completed before Step 2.
            </p>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">STEP 1</h3>
                  {completedPayments.includes('step1') && (
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
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(staggeredService.total_step1 || 0)}
                      </span>
                    </div>
                    {!completedPayments.includes('step1') && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleCreatePayment('step1')}
                        disabled={loading || !!paymentId}
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
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">STEP 2</h3>
                  {completedPayments.includes('step2') && (
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
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(staggeredService.total_step2 || 0)}
                      </span>
                    </div>
                    {!completedPayments.includes('step2') && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleCreatePayment('step2')}
                        disabled={loading || !!paymentId || !completedPayments.includes('step1')}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Create Payment for {formatCurrency(staggeredService.total_step2 || 0)}
                      </Button>
                    )}
                    {!completedPayments.includes('step1') && (
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

            {paymentId && !showPaymentModal && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                  Payment created. Click below to complete the payment.
                </p>
                <Button
                  className="w-full"
                  onClick={() => handleCompletePayment()}
                  disabled={loading}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {loading ? 'Processing...' : 'Complete Payment'}
                </Button>
              </div>
            )}

            {/* Show pending payments */}
            {pendingPayments.length > 0 && !paymentId && (
              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Pending Payments
                </h3>
                {pendingPayments.map((payment: any) => (
                  <div key={payment.id} className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {payment.payment_type === 'step1' ? 'Step 1 Payment' : 'Step 2 Payment'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Amount: {formatCurrency(payment.amount)}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleCompletePayment(payment)}
                        disabled={loading}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Payment Modal */}
          {showPaymentModal && paymentId && (
            <Modal
              isOpen={showPaymentModal}
              onClose={() => {
                setShowPaymentModal(false)
                setClientSecret(null)
                setPaymentIntentId(null)
              }}
              title={`Complete Payment - ${paymentType === 'step1' ? formatCurrency(staggeredService?.total_step1 || 0) : formatCurrency(staggeredService?.total_step2 || 0)}`}
              size="lg"
            >
              {clientSecret === 'gcash' ? (
                // GCash payment form (no Stripe Elements needed)
                <StripePaymentForm
                  paymentIntentId={undefined}
                  amount={paymentType === 'step1' ? (staggeredService?.total_step1 || 0) : (staggeredService?.total_step2 || 0)}
                  onSuccess={(paymentIntentId: string, paymentMethod?: any, details?: any, proofFile?: File) => {
                    handlePaymentSuccess(paymentIntentId, paymentMethod, details, proofFile)
                  }}
                  onError={(error: string) => showToast(error, 'error')}
                />
              ) : clientSecret && stripePromise ? (
                // Stripe payment form
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripePaymentForm
                    paymentIntentId={paymentIntentId || undefined}
                    amount={paymentType === 'step1' ? (staggeredService?.total_step1 || 0) : (staggeredService?.total_step2 || 0)}
                    onSuccess={(paymentIntentId: string, paymentMethod?: any, details?: any, proofFile?: File) => {
                      handlePaymentSuccess(paymentIntentId, paymentMethod, details, proofFile)
                    }}
                    onError={(error: string) => showToast(error, 'error')}
                  />
                </Elements>
              ) : null}
            </Modal>
          )}
        </main>
      </div>
    </div>
  )
}

