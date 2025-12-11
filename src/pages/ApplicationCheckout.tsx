import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Loading'
import { applicationPaymentsAPI, applicationsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { stripePromise } from '@/lib/stripe'
import { Elements } from '@stripe/react-stripe-js'
import { StripePaymentForm } from '@/components/StripePaymentForm'
import { ArrowLeft, CreditCard, Clock, Info, CheckCircle, Loader2 } from 'lucide-react'

export function ApplicationCheckout() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState<any>(null)
  const [payment, setPayment] = useState<any>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)

  useEffect(() => {
    // Allow public access - no authentication required for checkout
    const paymentId = searchParams.get('payment_id')
    if (!id || !paymentId) {
      showToast('Invalid checkout session. Please start over.', 'error')
      return
    }

    loadCheckoutData(paymentId)
  }, [id, searchParams, showToast])

  async function loadCheckoutData(paymentId: string) {
    if (!id) return

    setLoading(true)
    try {
      // Load application
      const appData = await applicationsAPI.getById(id)
      setApplication(appData)

      // Load payment
      const payments = await applicationPaymentsAPI.getByApplication(id)
      const targetPayment = payments.find((p: any) => p.id === paymentId)
      
      if (!targetPayment) {
        throw new Error('Payment not found')
      }

      setPayment(targetPayment)

      // Create payment intent using create-application-payment-intent
      const intentData = await applicationPaymentsAPI.createPaymentIntent(paymentId)
      
      if (!intentData.clientSecret) {
        throw new Error('Payment intent creation failed: No client secret returned')
      }

      setClientSecret(intentData.clientSecret)
      setPaymentIntentId(intentData.paymentIntentId)
    } catch (error: any) {
      console.error('Error loading checkout data:', error)
      showToast(error.message || 'Failed to load checkout. Please try again.', 'error')
      navigate(`/applications/${id}/payments`)
    } finally {
      setLoading(false)
    }
  }

  function handlePayLater() {
    navigate(`/applications/${id}/payments`)
  }

  async function handlePaymentSuccess(
    paymentIntentId: string,
    paymentMethod?: 'card' | 'gcash' | 'mobile_banking',
    details?: any,
    proofFile?: File
  ) {
    if (!payment) return

    setProcessingPayment(true)
    try {
      const result = await applicationPaymentsAPI.complete(
        payment.id,
        undefined,
        paymentMethod === 'card' ? paymentIntentId : undefined,
        (paymentMethod === 'card' ? 'stripe' : paymentMethod) || 'stripe',
        details,
        proofFile
      )

      if (paymentMethod === 'mobile_banking') {
        showToast('Mobile banking payment submitted! Your proof of payment has been uploaded. An admin will review and approve your payment.', 'success')
      } else if (paymentMethod === 'card') {
        showToast('Payment completed successfully!', 'success')
      }

      navigate(`/applications/${id}/payments`)
    } catch (error: any) {
      showToast(error.message || 'Failed to complete payment. Please try again.', 'error')
    } finally {
      setProcessingPayment(false)
    }
  }

  function handlePaymentError(error: string) {
    showToast(error, 'error')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        {user && <Header />}
        <div className="flex">
          {user && <Sidebar />}
          <main className="flex-1 p-4 md:p-8">
            <CardSkeleton />
          </main>
        </div>
      </div>
    )
  }

  if (!application || !payment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        {user && <Header />}
        <div className="flex">
          {user && <Sidebar />}
          <main className="flex-1 p-4 md:p-8">
            <Card>
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">Unable to load checkout. Please try again.</p>
                {user && (
                  <Button onClick={() => navigate(`/applications/${id}/payments`)} className="mt-4">
                    Go to Payments
                  </Button>
                )}
              </div>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {user && <Header />}
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6">
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/applications/${id}/payments`)}
                className="flex items-center gap-2 mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                GritSync Application Checkout
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Complete your payment to finalize your application submission.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Summary */}
            <div className="lg:col-span-1">
              <Card>
                <div className="space-y-4">
                  <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Application Submitted
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Application ID: <span className="font-mono font-semibold">{application.grit_app_id || application.id}</span>
                    </p>
                  </div>

                  {/* Client Details */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Applicant Details</h3>
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Full Name</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {application.first_name} {application.middle_name ? application.middle_name + ' ' : ''}{application.last_name}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{application.email}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Mobile Number</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{application.mobile_number}</span>
                      </div>
                      {application.province && (
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">State</span>
                          <span className="text-sm text-gray-900 dark:text-gray-100">{application.province}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Service Details</h3>
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Availed Service</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          NCLEX-RN Processing
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Payment Plan</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {payment.payment_type === 'full' ? 'Full Payment' : 
                           payment.payment_type === 'step1' ? 'Staggered Payment (Step 1 of 2)' :
                           payment.payment_type === 'step2' ? 'Staggered Payment (Step 2 of 2)' :
                           'Standard Payment'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">State</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {/* TODO: Add nclex_state field to applications table for target US state */}
                          New York
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Payment Type:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {payment.payment_type === 'full' ? 'Full Payment' : 
                         payment.payment_type === 'step1' ? 'Staggered Payment (Step 1)' :
                         payment.payment_type === 'step2' ? 'Staggered Payment (Step 2)' :
                         'Payment'}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-900 dark:text-gray-100">Total Amount:</span>
                      <span className="text-green-600 dark:text-green-400">
                        {formatCurrency(payment.amount || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Only show Pay Later button for authenticated users */}
                  {user && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        onClick={handlePayLater}
                        disabled={processingPayment}
                        className="w-full flex items-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white border-gray-900 dark:border-gray-800"
                      >
                        <Clock className="h-4 w-4" />
                        Pay Later
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Payment Form */}
            <div className="lg:col-span-2">
              <Card>
                {clientSecret && stripePromise ? (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          Payment Details
                        </h2>
                      </div>
                    </div>

                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <StripePaymentForm
                        amount={payment.amount || 0}
                        serviceFeeAmount={payment.service_fee_amount}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        paymentIntentId={paymentIntentId || undefined}
                      />
                    </Elements>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Initializing payment...</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
