import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { appUrl } from '@/lib/routing'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Loading'
import { MobileBankingCheckoutForm } from '@/components/MobileBankingCheckoutForm'
import { Elements } from '@stripe/react-stripe-js'
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import {
  ArrowLeft, CreditCard, Clock, CheckCircle, Crown, Zap, Sparkles, Lock,
} from 'lucide-react'

function getToken() { return localStorage.getItem('gritsync_token') }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function uploadFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `payment-screenshots/${Date.now()}.${ext}`
  const form = new FormData()
  form.append('file', file)
  form.append('path', path)
  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data.path as string
}

const PLANS = [
  {
    key: 'premium' as const,
    label: 'Premium',
    price: 250,
    duration: '2 months',
    icon: Zap,
    color: 'blue',
    features: ['250 questions/day', 'All question types', 'NGN case studies', 'Full analytics'],
  },
  {
    key: 'vip' as const,
    label: 'VIP',
    price: 500,
    duration: '6 months',
    icon: Crown,
    color: 'amber',
    features: ['Unlimited access', 'All exam modes', 'NGN case studies', 'Priority support', 'Exam simulations'],
    badge: 'Best Value',
  },
]

function StripeCheckoutForm({
  plan,
  onSuccess,
  onError,
  processingPayment,
}: {
  plan: 'premium' | 'vip'
  onSuccess: () => void
  onError: (msg: string) => void
  processingPayment: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const isProcessing = processing || processingPayment

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      })
      if (error) {
        onError(error.message || 'Payment failed')
        return
      }
      if (paymentIntent?.status === 'succeeded') {
        await apiFetch('/api/questions/subscription/stripe-complete', {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId: paymentIntent.id, plan }),
        })
        onSuccess()
      } else {
        onError('Payment was not completed. Please try again.')
      }
    } catch (err: any) {
      onError(err.message || 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 text-base font-semibold"
      >
        <Lock className="h-4 w-4 mr-2" />
        {isProcessing ? 'Processing...' : `Pay ₱${plan === 'vip' ? '500' : '250'} Securely`}
      </Button>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" /> Secured by Stripe
      </p>
    </form>
  )
}

export function NCLEXCheckout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const initialPlan = (searchParams.get('plan') || 'premium') as 'premium' | 'vip'
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'vip'>(
    ['premium', 'vip'].includes(initialPlan) ? initialPlan : 'premium'
  )
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<any>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const info = await fetch('/api/questions/payment-info').then(r => r.json())
      setPaymentInfo(info)
      if (info.stripeEnabled && info.stripePublishableKey) {
        const { loadStripe } = await import('@stripe/stripe-js')
        setStripePromise(await loadStripe(info.stripePublishableKey))
      }
    } catch {
      // payment info unavailable — mobile banking still works
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!paymentInfo?.stripeEnabled || !stripePromise) return
    let cancelled = false
    setClientSecret(null)
    setLoadingIntent(true)

    apiFetch('/api/questions/subscription/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ plan: selectedPlan }),
    })
      .then(data => { if (!cancelled) setClientSecret(data.clientSecret) })
      .catch(() => { if (!cancelled) setClientSecret(null) })
      .finally(() => { if (!cancelled) setLoadingIntent(false) })

    return () => { cancelled = true }
  }, [selectedPlan, paymentInfo?.stripeEnabled, stripePromise])

  async function handlePaymentSuccess(
    paymentIntentId: string,
    paymentMethod?: 'card' | 'mobile_banking',
    details?: any,
    proofFile?: File
  ) {
    setProcessingPayment(true)
    try {
      if (paymentMethod === 'card') {
        await apiFetch('/api/questions/subscription/stripe-complete', {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId, plan: selectedPlan }),
        })
        showToast('Payment completed successfully!', 'success')
        navigate('/')
      } else {
        let screenshotUrl: string | null = null
        if (proofFile) screenshotUrl = await uploadFile(proofFile)

        await apiFetch('/api/questions/subscription/submit-payment', {
          method: 'POST',
          body: JSON.stringify({
            plan: selectedPlan,
            payment_method: details?.number || 'Mobile Banking',
            payment_reference: details?.reference || null,
            payment_amount: selectedPlan === 'vip' ? 500 : 250,
            notes: null,
            screenshot_url: screenshotUrl,
          }),
        })
        showToast('Mobile banking payment submitted! Your proof of payment has been uploaded. An admin will review and approve your payment.', 'success')
        navigate('/')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to complete payment. Please try again.', 'error')
    } finally {
      setProcessingPayment(false)
    }
  }

  function handlePaymentError(error: string) {
    showToast(error, 'error')
  }

  if (authLoading || loading) {
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <main className="flex-1 p-4 md:p-8">
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Please sign in to continue.</p>
              <Button onClick={() => { window.location.href = appUrl('/login') }} className="mt-4">
                Sign In
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  const plan = PLANS.find(p => p.key === selectedPlan)!

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
              onClick={() => navigate('/')}
              className="flex items-center gap-2 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                NCLEX Q-Bank Checkout
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Choose your plan and complete your payment to unlock full access.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card>
                <div className="space-y-4">
                  {/* Plan Selector */}
                  <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-3">
                      Choose Your Plan
                    </h2>
                    <div className="space-y-2.5">
                      {PLANS.map(p => {
                        const Icon = p.icon
                        const selected = selectedPlan === p.key
                        return (
                          <button
                            key={p.key}
                            onClick={() => setSelectedPlan(p.key)}
                            className={`w-full rounded-xl border-2 p-3.5 text-left transition-all relative overflow-hidden ${
                              selected
                                ? p.color === 'amber'
                                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                                  : 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            {p.badge && (
                              <span className="absolute top-0 right-0 text-[10px] font-black bg-amber-400 text-white px-2 py-0.5 rounded-bl-lg uppercase">
                                {p.badge}
                              </span>
                            )}
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                p.color === 'amber' ? 'bg-amber-100 dark:bg-amber-800' : 'bg-blue-100 dark:bg-blue-800'
                              }`}>
                                <Icon className={`h-4 w-4 ${p.color === 'amber' ? 'text-amber-500' : 'text-blue-500'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{p.label}</p>
                                  <p className="font-black text-sm text-gray-900 dark:text-gray-100">₱{p.price}</p>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.duration}</p>
                              </div>
                              {selected ? (
                                <CheckCircle className={`h-4 w-4 flex-shrink-0 ${p.color === 'amber' ? 'text-amber-500' : 'text-primary-500'}`} />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Applicant Details */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account Details</h3>
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Name</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* What you get */}
                  <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">What's Included</h3>
                    <div className="space-y-1">
                      {plan.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <Sparkles className="h-3 w-3 text-primary-500 flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-gray-100">Total Amount:</span>
                    <span className="text-green-600 dark:text-green-400">₱{plan.price}</span>
                  </div>

                  {/* Pay Later */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      onClick={() => navigate('/')}
                      disabled={processingPayment}
                      className="w-full flex items-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white border-gray-900 dark:border-gray-800"
                    >
                      <Clock className="h-4 w-4" />
                      Pay Later
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Payment Form */}
            <div className="lg:col-span-2">
              <Card>
                <div className="space-y-6">
                  <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Payment Details
                      </h2>
                    </div>
                  </div>

                  {clientSecret && stripePromise ? (
                    loadingIntent ? (
                      <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading payment form...</p>
                      </div>
                    ) : (
                      <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
                        <StripeCheckoutForm
                          plan={selectedPlan}
                          onSuccess={() => {
                            showToast('Payment completed successfully!', 'success')
                            navigate('/')
                          }}
                          onError={handlePaymentError}
                          processingPayment={processingPayment}
                        />
                      </Elements>
                    )
                  ) : (
                    <MobileBankingCheckoutForm
                      amount={plan.price}
                      phpAmount={plan.price}
                      applicationType="NCLEX"
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      processingPayment={processingPayment}
                    />
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
