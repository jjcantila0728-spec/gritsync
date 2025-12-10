import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { stripePromise } from '@/lib/stripe'
import { donationsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, Lock, ArrowLeft, Loader2, CheckCircle, Heart, Shield, Zap, Sparkles } from 'lucide-react'

// Payment Form Component
function DonationPaymentForm({ 
  donationId, 
  amount,
  clientSecret
}: { 
  donationId: string
  amount: number
  clientSecret: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Confirm payment using the existing client secret
      const { error: confirmError, paymentIntent: confirmedPayment } = await stripe.confirmPayment({
        elements,
        clientSecret: clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/donate/success?donation_id=${donationId}`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed. Please try again.')
        setLoading(false)
        return
      }

      if (confirmedPayment?.status === 'succeeded') {
        // Update donation status
        try {
          await donationsAPI.updateStatus(donationId, 'completed')
        } catch (updateError) {
          console.error('Error updating donation status:', updateError)
          // Don't fail the payment if status update fails
        }

        // Redirect to success page
        navigate(`/donate/success?donation_id=${donationId}&session_id=${confirmedPayment.id}`)
      } else {
        setError('Payment was not completed. Please try again.')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'An error occurred during payment. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Card Section */}
      <div className="p-4 sm:p-6 border border-primary-200 dark:border-primary-800 rounded-xl bg-gradient-to-br from-white to-primary-50/30 dark:from-gray-800 dark:to-primary-900/20 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg w-fit">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Card Details</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Enter your payment information</p>
          </div>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: {
              billingDetails: {
                email: 'never', // Don't collect email - we already have it
                phone: 'never', // Don't collect phone
                address: 'never', // Don't collect address
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="space-y-3">
        <Button 
          type="submit" 
          className="w-full relative overflow-hidden group" 
          size="lg"
          disabled={loading || !stripe || !elements}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                <span className="text-sm sm:text-base">Processing Payment...</span>
              </>
            ) : (
              <>
                <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-semibold text-sm sm:text-base">Complete Donation</span>
                <span className="ml-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-white/20 rounded-full font-bold text-xs sm:text-sm">
                  {formatCurrency(amount)}
                </span>
              </>
            )}
          </div>
        </Button>

        {/* Trust Indicators */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
            <span>SSL Secured</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 dark:text-primary-400" />
            <span>Encrypted by Stripe</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
            <span>Instant Processing</span>
          </div>
        </div>
      </div>
    </form>
  )
}

// Main Checkout Page Component
export function DonateCheckout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [donationId, setDonationId] = useState<string | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    const id = searchParams.get('donation_id')
    const amountParam = searchParams.get('amount')

    if (!id || !amountParam) {
      showToast('Invalid donation session. Please start over.', 'error')
      navigate('/donate')
      return
    }

    const donationAmount = parseFloat(amountParam)
    if (isNaN(donationAmount) || donationAmount <= 0) {
      showToast('Invalid donation amount. Please start over.', 'error')
      navigate('/donate')
      return
    }

    setDonationId(id)
    setAmount(donationAmount)

    // Create payment intent directly (no need to fetch donation - works for anonymous users)
    const createPaymentIntent = async () => {
      try {
        // Create payment intent - this works for anonymous users
        const paymentIntent = await donationsAPI.createPaymentIntent(id, donationAmount)
        if (paymentIntent.client_secret) {
          setClientSecret(paymentIntent.client_secret)
        } else {
          throw new Error('Failed to create payment intent')
        }
      } catch (error: any) {
        console.error('Error creating payment intent:', error)
        showToast(error.message || 'Failed to initialize payment. Please try again.', 'error')
        navigate('/donate')
      } finally {
        setLoading(false)
      }
    }

    createPaymentIntent()
  }, [searchParams, navigate, showToast])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600 dark:text-primary-400" />
            <p className="text-gray-600 dark:text-gray-400">Loading checkout...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!donationId || !clientSecret || !stripePromise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-6 text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">
              Unable to initialize payment. Please try again.
            </p>
            <Button onClick={() => navigate('/donate')}>
              Back to Donate
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/donate')}
            className="mb-6 flex items-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Donate
          </Button>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Left Column - Donation Summary */}
            <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-2 lg:order-1">
              {/* Donation Amount Card */}
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20 border-primary-200 dark:border-primary-800">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-primary-600 rounded-full mb-3 sm:mb-4 shadow-lg">
                    <Heart className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">Your Donation</p>
                  <div className="text-3xl sm:text-4xl font-bold text-primary-700 dark:text-primary-300 mb-2">
                    {formatCurrency(amount)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">One-time donation</p>
                </div>
              </Card>

              {/* Impact Message */}
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/40 rounded-lg flex-shrink-0">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-xs sm:text-sm">
                      Making a Difference
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Your donation helps nurses achieve their USRN dreams. Every contribution makes a real impact.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Security Badge */}
              <Card className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Secure Payment</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Protected by Stripe</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column - Payment Form */}
            <div className="lg:col-span-2 order-1 lg:order-2">
              <Card className="p-4 sm:p-6 lg:p-8 shadow-xl border-2 border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg w-fit">
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Complete Your Donation
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Secure payment - No billing address required
                      </p>
                    </div>
                  </div>
                </div>

                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#2563eb',
                        colorBackground: '#ffffff',
                        colorText: '#1f2937',
                        colorDanger: '#ef4444',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        spacingUnit: '4px',
                        borderRadius: '12px',
                      },
                    },
                  }}
                >
                  <DonationPaymentForm 
                    donationId={donationId}
                    amount={amount}
                    clientSecret={clientSecret}
                  />
                </Elements>
              </Card>

              {/* Additional Trust Indicators */}
              <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                  <span>No hidden fees</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                  <span>Instant confirmation</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                  <span>Tax-deductible</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

