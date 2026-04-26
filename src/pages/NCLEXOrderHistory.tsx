import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { useEffect, useRef, useState } from 'react'
import { ShoppingBag, Crown, Zap, CheckCircle, Clock, AlertCircle, Send, XCircle, RefreshCw, Image as ImageIcon, X } from 'lucide-react'

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

interface Submission {
  id: number
  plan: string
  payment_method: string
  payment_reference: string
  payment_amount: number
  notes: string
  status: 'pending' | 'approved' | 'rejected'
  review_notes: string
  created_at: string
  reviewed_at: string
}

export function NCLEXOrderHistory() {
  const [subscription, setSubscription] = useState<any>(null)
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [formPlan, setFormPlan] = useState<'premium' | 'vip'>('premium')
  const [formMethod, setFormMethod] = useState('GCash')
  const [formRef, setFormRef] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  const [formScreenshot, setFormScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = () => {
    setLoading(true)
    Promise.allSettled([
      fetch('/api/questions/subscription/me', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
      fetch('/api/questions/payment-info').then(r => r.json()),
      fetch('/api/questions/subscription/my-submissions', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
    ]).then(([sub, pay, subs]) => {
      if (sub.status === 'fulfilled') setSubscription(sub.value)
      if (pay.status === 'fulfilled') setPaymentInfo(pay.value)
      if (subs.status === 'fulfilled' && Array.isArray(subs.value)) setSubmissions(subs.value)
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  const plan = subscription?.plan || 'free'
  const expiresAt = subscription?.expires_at
  const isActive = subscription?.status === 'active' || plan === 'free'
  const hasPending = submissions.some(s => s.status === 'pending')

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormScreenshot(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setScreenshotPreview(url)
    } else {
      setScreenshotPreview(null)
    }
  }

  const clearScreenshot = () => {
    setFormScreenshot(null)
    setScreenshotPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const amount = formPlan === 'vip' ? 500 : 250
      let screenshotUrl: string | null = null
      if (formScreenshot) {
        screenshotUrl = await uploadFile(formScreenshot)
      }
      await apiFetch('/api/questions/subscription/submit-payment', {
        method: 'POST',
        body: JSON.stringify({
          plan: formPlan,
          payment_method: formMethod,
          payment_reference: formRef || null,
          payment_amount: amount,
          notes: formNotes || null,
          screenshot_url: screenshotUrl,
        }),
      })
      setFormSuccess(true)
      setShowForm(false)
      setFormRef('')
      setFormNotes('')
      setFormScreenshot(null)
      setScreenshotPreview(null)
      loadData()
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit payment')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingSubmission = submissions.find(s => s.status === 'pending')

  const statusBadge = (status: string) => {
    if (status === 'pending') return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <Clock className="h-3 w-3" /> Awaiting Approval
      </span>
    )
    if (status === 'approved') return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
        <CheckCircle className="h-3 w-3" /> Approved
      </span>
    )
    if (status === 'rejected') return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    )
    return null
  }

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#17c3b2]" /> Order History
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your NCLEX subscription and billing details</p>
        </div>

        {/* Current plan card */}
        <div className={`rounded-2xl border-2 p-6 ${
          plan === 'vip' ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' :
          plan === 'premium' ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10' :
          'border-gray-200 bg-white dark:bg-gray-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                plan === 'vip' ? 'bg-amber-100 dark:bg-amber-800' :
                plan === 'premium' ? 'bg-blue-100 dark:bg-blue-800' :
                'bg-gray-100 dark:bg-gray-800'
              }`}>
                {plan === 'vip' ? <Crown className="h-6 w-6 text-amber-500" /> :
                 plan === 'premium' ? <Zap className="h-6 w-6 text-blue-500" /> :
                 <ShoppingBag className="h-6 w-6 text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">
                  {plan === 'vip' ? 'VIP Plan' : plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isActive ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                      <AlertCircle className="h-3 w-3" /> Expired
                    </span>
                  )}
                  {expiresAt && (
                    <span className="text-xs text-gray-500">
                      · {isActive ? 'Expires' : 'Expired'} {new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Questions</p>
              <p className="font-bold text-gray-900 dark:text-white">{plan === 'free' ? '25/day' : 'Unlimited'}</p>
            </div>
          </div>
        </div>

        {/* Pending submission banner */}
        {pendingSubmission && (
          <div className="rounded-2xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-700 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">Payment submitted — awaiting admin approval</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                Your <strong className="capitalize">{pendingSubmission.plan}</strong> plan payment was submitted on {new Date(pendingSubmission.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Your plan will be activated within 24 hours.
              </p>
            </div>
          </div>
        )}

        {/* Success message */}
        {formSuccess && !pendingSubmission && (
          <div className="rounded-2xl border border-green-300 bg-green-50 dark:bg-green-900/10 p-4 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">Payment proof submitted successfully!</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Your plan will be activated within 24 hours after admin review.</p>
            </div>
          </div>
        )}

        {/* Submission history */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Payment History</h2>
            <button onClick={loadData} className="text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">Loading...</div>
          ) : submissions.length === 0 && plan === 'free' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <ShoppingBag className="h-10 w-10 opacity-30" />
              <p className="text-sm">No purchase history yet.</p>
              <p className="text-xs max-w-xs text-center">Upgrade to Premium or VIP to unlock full Q-Bank access.</p>
            </div>
          ) : submissions.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-5 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide hidden sm:table-cell">Method</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {s.plan === 'vip' ? <Crown className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-blue-500" />}
                        <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{s.plan} Plan</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {statusBadge(s.status)}
                        {s.status === 'rejected' && s.review_notes && (
                          <p className="text-xs text-red-500">{s.review_notes}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-xs text-gray-500">{s.payment_method || '—'}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </td>
                  </tr>
                ))}
                {plan !== 'free' && submissions.every(s => s.status !== 'approved') && (
                  <tr className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {plan === 'vip' ? <Crown className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-blue-500" />}
                        <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{plan} Plan</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Activated by admin
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500">
                        {expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : plan !== 'free' ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-5 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {plan === 'vip' ? <Crown className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-blue-500" />}
                      <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{plan} Plan</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">
                    {expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No expiry'}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <ShoppingBag className="h-10 w-10 opacity-30" />
              <p className="text-sm">No purchase history yet.</p>
            </div>
          )}
        </div>

        {/* How to pay + Submit form */}
        {paymentInfo && !hasPending && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">How to Upgrade</h2>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
              <li>Choose your plan: <strong>Premium (₱250 / 2 months)</strong> or <strong>VIP (₱500 / 6 months)</strong></li>
              <li>Send payment via GCash or Maya:</li>
            </ol>
            <div className="mt-3 ml-5 space-y-1">
              {paymentInfo.accounts?.map((a: any) => (
                <p key={a.method} className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {a.method}: <span className="font-black">{a.number}</span> ({a.name})
                </p>
              ))}
            </div>
            <ol className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside" start={3}>
              <li>Submit your payment proof below with your reference number</li>
              <li>Your plan will be activated within 24 hours</li>
            </ol>

            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#17c3b2] hover:bg-[#13a99a] text-white font-semibold py-3 text-sm transition-colors"
              >
                <Send className="h-4 w-4" />
                Submit Payment Proof
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-5">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Submit Payment Proof</h3>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Plan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'premium', label: 'Premium', desc: '₱250 / 2 months' },
                      { key: 'vip', label: 'VIP', desc: '₱500 / 6 months' },
                    ] as const).map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setFormPlan(p.key)}
                        className={`rounded-xl border-2 p-3 text-center transition-all ${formPlan === p.key ? 'border-[#17c3b2] bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                      >
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{p.label}</p>
                        <p className="text-xs text-gray-500">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                    <select
                      value={formMethod}
                      onChange={e => setFormMethod(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option>GCash</option>
                      <option>Maya</option>
                      <option>Bank Transfer</option>
                      <option>Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reference # (optional)</label>
                    <input
                      type="text"
                      value={formRef}
                      onChange={e => setFormRef(e.target.value)}
                      placeholder="GCash/Maya ref #"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Screenshot sent via Facebook Messenger"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Screenshot (optional)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  {!formScreenshot ? (
                    <label
                      htmlFor="screenshot-upload"
                      className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-4 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:border-[#17c3b2] hover:text-[#17c3b2] transition-colors"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Attach GCash / Maya screenshot
                    </label>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img
                        src={screenshotPreview!}
                        alt="Payment screenshot"
                        className="w-full max-h-48 object-contain bg-gray-50 dark:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={clearScreenshot}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-gray-500 px-2 py-1.5 truncate">{formScreenshot.name}</p>
                    </div>
                  )}
                </div>

                {formError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {formError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError('') }}
                    className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-[#17c3b2] hover:bg-[#13a99a] disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <><Send className="h-4 w-4" /> Submit</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Pending submission details card */}
        {pendingSubmission && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Payment Details Submitted</h2>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p>Plan: <strong className="capitalize">{pendingSubmission.plan}</strong></p>
              {pendingSubmission.payment_method && <p>Method: <strong>{pendingSubmission.payment_method}</strong></p>}
              {pendingSubmission.payment_reference && <p>Reference: <strong>{pendingSubmission.payment_reference}</strong></p>}
              {pendingSubmission.notes && <p>Notes: {pendingSubmission.notes}</p>}
            </div>
            <p className="mt-3 text-xs text-gray-400">Your plan will be activated once the admin reviews your submission. You will see the status update here.</p>
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}
