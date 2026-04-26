import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import {
  Crown, Zap, CreditCard, Smartphone, CheckCircle, ArrowLeft,
  Copy, Upload, X, AlertCircle, Lock, Sparkles,
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

// ── Stripe Inner Form ─────────────────────────────────────────────────────────
function StripeCheckoutForm({
  plan, onSuccess, onError,
}: {
  plan: 'premium' | 'vip'
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

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
        // Notify backend to activate subscription
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
      {processing && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Processing your payment...</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3.5 rounded-xl bg-[#0d2137] hover:bg-[#163352] text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <Lock className="h-4 w-4" />
        {processing ? 'Processing...' : `Pay ₱${plan === 'vip' ? '500' : '250'} Securely`}
      </button>
      <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" /> Secured by Stripe
      </p>
    </form>
  )
}

// ── Mobile Banking Form ───────────────────────────────────────────────────────
function MobileBankingForm({
  plan, accounts, onSuccess, onError,
}: {
  plan: 'premium' | 'vip'
  accounts: any[]
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [selectedAccount, setSelectedAccount] = useState<any>(accounts[0] || null)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setScreenshot(file)
    if (file) setPreview(URL.createObjectURL(file))
    else setPreview(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount) return
    setSubmitting(true)
    try {
      let screenshotUrl: string | null = null
      if (screenshot) screenshotUrl = await uploadFile(screenshot)

      await apiFetch('/api/questions/subscription/submit-payment', {
        method: 'POST',
        body: JSON.stringify({
          plan,
          payment_method: selectedAccount.name,
          payment_reference: reference || null,
          payment_amount: plan === 'vip' ? 500 : 250,
          notes: notes || null,
          screenshot_url: screenshotUrl,
        }),
      })
      onSuccess()
    } catch (err: any) {
      onError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bank account selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
          Pay To
        </label>
        <div className="space-y-2">
          {accounts.map(acc => (
            <button
              key={acc.id || acc.name}
              type="button"
              onClick={() => setSelectedAccount(acc)}
              className={`w-full rounded-xl border-2 p-3.5 text-left transition-all flex items-center justify-between gap-3 ${
                selectedAccount?.id === acc.id || selectedAccount?.name === acc.name
                  ? 'border-[#17c3b2] bg-[#17c3b2]/5'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white">{acc.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{acc.accountName}</p>
                <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{acc.accountNumber}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); copyToClipboard(acc.accountNumber, acc.id || acc.name) }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600"
                  title="Copy account number"
                >
                  {copied === (acc.id || acc.name) ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                {selectedAccount?.id === acc.id || selectedAccount?.name === acc.name ? (
                  <CheckCircle className="h-4 w-4 text-[#17c3b2]" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount reminder */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3.5">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Send exactly <span className="text-lg">₱{plan === 'vip' ? '500' : '250'}</span> to the account above
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          Your plan will be activated within 24 hours after admin review.
        </p>
      </div>

      {/* Reference number */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
          Reference / Transaction Number
        </label>
        <input
          type="text"
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder="e.g. 123456789012"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#17c3b2] focus:border-transparent"
        />
      </div>

      {/* Screenshot upload */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
          Payment Screenshot <span className="text-gray-400 font-normal normal-case">(recommended)</span>
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="mb-screenshot"
        />
        {!screenshot ? (
          <label
            htmlFor="mb-screenshot"
            className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl px-3 py-6 text-sm text-gray-500 cursor-pointer hover:border-[#17c3b2] hover:text-[#17c3b2] hover:bg-[#17c3b2]/5 transition-colors"
          >
            <Upload className="h-5 w-5" />
            <span>Upload GCash / Maya receipt</span>
            <span className="text-xs text-gray-400">PNG, JPG up to 10MB</span>
          </label>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <img src={preview!} alt="Receipt" className="w-full max-h-48 object-contain bg-gray-50 dark:bg-gray-800" />
            <button
              type="button"
              onClick={() => { setScreenshot(null); setPreview(null) }}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-xs text-gray-500 px-3 py-2 truncate">{screenshot.name}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
          Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any additional info for the admin..."
          className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-[#17c3b2] focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 rounded-xl bg-[#17c3b2] hover:bg-[#14a99a] text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-[#17c3b2]/20"
      >
        {submitting ? 'Submitting...' : 'Submit Payment Proof'}
      </button>
    </form>
  )
}

// ── Main Checkout Page ────────────────────────────────────────────────────────
export function NCLEXCheckout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const initialPlan = (searchParams.get('plan') || 'premium') as 'premium' | 'vip'
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'vip'>(
    ['premium', 'vip'].includes(initialPlan) ? initialPlan : 'premium'
  )
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobile'>('mobile')
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<any>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [payInfo, sub] = await Promise.allSettled([
        fetch('/api/questions/payment-info').then(r => r.json()),
        fetch('/api/questions/subscription/me', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
      ])
      if (payInfo.status === 'fulfilled') {
        const info = payInfo.value
        setPaymentInfo(info)
        if (info.stripeEnabled && info.stripePublishableKey) {
          const { loadStripe: ls } = await import('@stripe/stripe-js')
          setStripePromise(await ls(info.stripePublishableKey))
          setPaymentMethod('card')
        } else {
          setPaymentMethod('mobile')
        }
      }
      if (sub.status === 'fulfilled') setSubscription(sub.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Create/refresh payment intent when card tab is selected or plan changes
  useEffect(() => {
    if (paymentMethod !== 'card' || !paymentInfo?.stripeEnabled) return
    let cancelled = false
    setClientSecret(null)
    setIntentError(null)
    setLoadingIntent(true)

    apiFetch('/api/questions/subscription/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ plan: selectedPlan }),
    })
      .then(data => { if (!cancelled) setClientSecret(data.clientSecret) })
      .catch(err => { if (!cancelled) setIntentError(err.message) })
      .finally(() => { if (!cancelled) setLoadingIntent(false) })

    return () => { cancelled = true }
  }, [paymentMethod, selectedPlan, paymentInfo?.stripeEnabled])

  if (!user) {
    return (
      <NCLEXLayout subscription={subscription}>
        <div className="p-8 text-center text-gray-500">Please sign in to continue.</div>
      </NCLEXLayout>
    )
  }

  const plan = PLANS.find(p => p.key === selectedPlan)!
  const mobileBankingAccounts = paymentInfo?.mobileBankingAccounts || []

  if (success) {
    return (
      <NCLEXLayout subscription={subscription}>
        <div className="p-5 lg:p-7 max-w-lg mx-auto">
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              {paymentMethod === 'card' ? 'Payment Successful!' : 'Proof Submitted!'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {paymentMethod === 'card'
                ? `Your ${plan.label} subscription is now active. Enjoy ${plan.duration} of full access!`
                : 'Your payment proof has been submitted. An admin will review and activate your plan within 24 hours.'}
            </p>
            <button
              onClick={() => navigate('/nclex-review')}
              className="w-full py-3 rounded-xl bg-[#17c3b2] text-white font-bold text-sm hover:bg-[#14a99a] transition-colors"
            >
              Go to Q-Bank
            </button>
          </div>
        </div>
      </NCLEXLayout>
    )
  }

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            to="/nclex-review"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Checkout</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: Plan & Order Summary ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Plan picker */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Choose Your Plan</h2>
              <div className="space-y-2.5">
                {PLANS.map(p => {
                  const Icon = p.icon
                  const selected = selectedPlan === p.key
                  return (
                    <button
                      key={p.key}
                      onClick={() => setSelectedPlan(p.key)}
                      className={`w-full rounded-xl border-2 p-4 text-left transition-all relative overflow-hidden ${
                        selected
                          ? p.color === 'amber'
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                            : 'border-[#17c3b2] bg-[#17c3b2]/5'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {p.badge && (
                        <span className="absolute top-0 right-0 text-[10px] font-black bg-amber-400 text-white px-2 py-0.5 rounded-bl-lg uppercase">
                          {p.badge}
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          p.color === 'amber' ? 'bg-amber-100 dark:bg-amber-800' : 'bg-blue-100 dark:bg-blue-800'
                        }`}>
                          <Icon className={`h-5 w-5 ${p.color === 'amber' ? 'text-amber-500' : 'text-blue-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-900 dark:text-white">{p.label}</p>
                            <p className="font-black text-gray-900 dark:text-white">₱{p.price}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{p.duration}</p>
                        </div>
                        {selected ? (
                          <CheckCircle className={`h-4 w-4 flex-shrink-0 ${p.color === 'amber' ? 'text-amber-500' : 'text-[#17c3b2]'}`} />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Order Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">NCLEX Q-Bank — {plan.label}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{plan.duration}</span>
                </div>
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                    <Sparkles className="h-3 w-3 text-[#17c3b2] flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#17c3b2]">₱{plan.price}</p>
                  <p className="text-xs text-gray-400">/{plan.duration}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Payment Form ──────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {/* Payment method tabs */}
              <div className="border-b border-gray-100 dark:border-gray-800">
                <div className="flex">
                  {paymentInfo?.stripeEnabled && (
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
                        paymentMethod === 'card'
                          ? 'border-[#17c3b2] text-[#17c3b2]'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      Card
                    </button>
                  )}
                  {paymentInfo?.mobileBankingEnabled !== false && mobileBankingAccounts.length > 0 && (
                    <button
                      onClick={() => setPaymentMethod('mobile')}
                      className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
                        paymentMethod === 'mobile'
                          ? 'border-[#17c3b2] text-[#17c3b2]'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      Mobile Banking
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading payment options...</div>
                ) : formError ? (
                  <>
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                    </div>
                    <button onClick={() => setFormError(null)} className="text-xs text-gray-500 underline">Try again</button>
                  </>
                ) : paymentMethod === 'card' ? (
                  loadingIntent ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Preparing secure payment form...</div>
                  ) : intentError ? (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 p-4">
                      <p className="text-sm text-red-600">{intentError}</p>
                    </div>
                  ) : clientSecret && stripePromise ? (
                    <Elements
                      key={`${clientSecret}-${selectedPlan}`}
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: { colorPrimary: '#17c3b2', borderRadius: '12px' },
                        },
                      }}
                    >
                      <StripeCheckoutForm
                        plan={selectedPlan}
                        onSuccess={() => setSuccess(true)}
                        onError={msg => setFormError(msg)}
                      />
                    </Elements>
                  ) : (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Stripe not configured</div>
                  )
                ) : mobileBankingAccounts.length > 0 ? (
                  <MobileBankingForm
                    key={selectedPlan}
                    plan={selectedPlan}
                    accounts={mobileBankingAccounts}
                    onSuccess={() => setSuccess(true)}
                    onError={msg => setFormError(msg)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <Smartphone className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No payment methods configured.</p>
                    <p className="text-xs">Please contact an admin to set up payment options.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </NCLEXLayout>
  )
}
