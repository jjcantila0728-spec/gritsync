import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Elements } from '@stripe/react-stripe-js'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { quotationsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { stripePromise } from '@/lib/stripe'
import { StripePaymentForm } from '@/components/StripePaymentForm'
import { CreditCard, ArrowLeft } from 'lucide-react'

export function Payment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [quotation, setQuotation] = useState<{ id: string; amount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchQuotation()
    }
  }, [id])

  async function fetchQuotation() {
    try {
      const quote = await quotationsAPI.getById(id!)
      const typedQuote = quote as { id?: string; amount?: number } | null
      if (typedQuote && typedQuote.id && typedQuote.amount) {
        setQuotation({ id: typedQuote.id, amount: typedQuote.amount })
        // Create payment intent for quotation
        await createPaymentIntent(typedQuote.id, typedQuote.amount)
      }
    } catch (error: any) {
      console.error('Error fetching quotation:', error)
      showToast(error.message || 'Failed to load quotation', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createPaymentIntent(quotationId: string, amount: number) {
    try {
      const data = await quotationsAPI.createPaymentIntent(quotationId, amount)
      setClientSecret(data.client_secret)
      setPaymentIntentId(data.payment_intent_id)
    } catch (error: any) {
      console.error('Error creating payment intent:', error)
      showToast(error.message || 'Failed to initialize payment', 'error')
    }
  }

  async function handlePaymentSuccess(_paymentIntentId: string) {
    if (!quotation) return

    try {
      // Update quotation status to paid
      await quotationsAPI.updateStatus(quotation.id, 'paid')
      showToast('Payment completed successfully!', 'success')
      navigate('/quotations')
    } catch (error: any) {
      showToast(error.message || 'Payment succeeded but failed to update quotation', 'error')
    }
  }

  function handlePaymentError(error: string) {
    showToast(error, 'error')
  }

  if (loading || !quotation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading payment...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Payment
              </h1>
            </div>

            <Card className="max-w-2xl">
              <div className="text-center py-8">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-4">
                  <h2 className="text-xl font-semibold mb-2 text-yellow-800 dark:text-yellow-400">
                    Payment Processing Not Configured
                  </h2>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Stripe publishable key is not configured. Please add <code className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> to your <code className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">.env</code> file.
                  </p>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Amount: {formatCurrency(quotation.amount)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Please contact support to complete your payment.
                </p>
              </div>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Payment
              </h1>
            </div>

            <Card className="max-w-2xl">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Initializing payment...</p>
              </div>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Payment
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your payment securely using Stripe
            </p>
          </div>

          <Card className="max-w-2xl">
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <CreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Payment Details
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Quotation #{quotation.id}
                  </p>
                </div>
              </div>
            </div>

            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripePaymentForm
                amount={quotation.amount}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                paymentIntentId={paymentIntentId || undefined}
              />
            </Elements>
          </Card>
        </main>
      </div>
    </div>
  )
}

