import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { useEffect, useState } from 'react'
import {
  ShoppingBag, Crown, Zap, CheckCircle, Clock, AlertCircle,
  Send, RefreshCw, XCircle, Info,
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

const STATUS_CFG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  pending: {
    cls: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: <Clock className="h-3.5 w-3.5" />,
    label: 'Under Review',
  },
  approved: {
    cls: 'bg-green-100 text-green-800 border-green-300',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    label: 'Approved',
  },
  rejected: {
    cls: 'bg-red-100 text-red-800 border-red-300',
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'Rejected',
  },
}

export function NCLEXOrderHistory() {
  const [subscription, setSubscription] = useState<any>(null)
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [formPlan, setFormPlan] = useState('premium')
  const [formMethod, setFormMethod] = useState('GCash')
  const [formRef, setFormRef] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const planAmount = formPlan === 'vip' ? 500 : 250

  const loadData = async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      fetch('/api/questions/subscription/me', { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
      fetch('/api/questions/payment-info').then(r => r.json()),
      apiFetch('/api/questions/payment/my-submissions'),
    ])
    if (results[0].status === 'fulfilled') setSubscription(results[0].value)
    if (results[1].status === 'fulfilled') setPaymentInfo(results[1].value)
    if (results[2].status === 'fulfilled') setSubmissions(results[2].value)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const plan = subscription?.plan || 'free'
  const expiresAt = subscription?.expires_at
  const isActive = subscription?.status === 'active' || plan === 'free'
  const hasPending = submissions.some(s => s.status === 'pending')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.trim()) { setFormError('Reference number is required'); return }
    setSubmitting(true)
    setFormError(null)
    setFormSuccess(null)
    try {
      const res = await apiFetch('/api/questions/payment/submit', {
        method: 'POST',
        body: JSON.stringify({
          plan: formPlan,
          amount: planAmount,
          payment_method: formMethod,
          reference_number: formRef.trim(),
          notes: formNotes.trim() || undefined,
        }),
      })
      setFormSuccess(res.message || 'Submitted! Admin will review within 24 hours.')
      setFormRef('')
      setFormNotes('')
      loadData()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
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

        {/* Payment History */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Payment History</h2>
            <button onClick={loadData} className="text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
          ) : plan === 'free' && submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <ShoppingBag className="h-10 w-10 opacity-30" />
              <p className="text-sm">No purchase history yet.</p>
              <p className="text-xs max-w-xs text-center">Upgrade to Premium or VIP to unlock full Q-Bank access.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-5 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-left text-gray-500 uppercase tracking-wide">Ref #</th>
                </tr>
              </thead>
              <tbody>
                {plan !== 'free' && (
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
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No expiry'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Activated by admin
                      </span>
                    </td>
                  </tr>
                )}
                {submissions.map(s => {
                  const cfg = STATUS_CFG[s.status] || STATUS_CFG.pending
                  return (
                    <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {s.plan === 'vip' ? <Crown className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-blue-500" />}
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{s.plan} Plan</p>
                            <p className="text-xs text-gray-400">₱{parseFloat(s.amount).toFixed(0)} via {s.payment_method}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${cfg.cls}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {s.admin_notes && (
                          <p className="text-xs text-gray-500 mt-1 max-w-[180px]">{s.admin_notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {new Date(s.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-gray-700 dark:text-gray-300">{s.reference_number}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Payment Submission Form */}
        {paymentInfo && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                {plan === 'free' ? 'Upgrade Your Plan' : 'Submit New Payment'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Send payment via GCash or Maya, then submit your reference number below.
              </p>
            </div>

            {/* Payment accounts */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex flex-wrap gap-3">
                {paymentInfo.accounts?.map((a: any) => (
                  <div key={a.method} className="flex-1 min-w-[180px] rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-0.5">{a.method}</p>
                    <p className="font-black text-gray-900 dark:text-white text-lg tracking-wide">{a.number}</p>
                    <p className="text-xs text-gray-500">{a.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Info notice */}
            <div className="mx-5 mt-3 mb-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-semibold">How it works:</p>
                <ol className="mt-1 space-y-0.5 list-decimal list-inside">
                  <li>Choose your plan and send the exact amount via GCash or Maya</li>
                  <li>Enter the GCash/Maya reference number below and click Submit</li>
                  <li>An admin will verify and activate your plan within 24 hours</li>
                </ol>
              </div>
            </div>

            {/* Submit form */}
            {hasPending ? (
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <Clock className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm text-yellow-800 font-medium">
                    You have a payment under review. Please wait for admin confirmation before submitting another.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Plan</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'premium', label: 'Premium', desc: '₱250 · 2 months' },
                        { key: 'vip', label: 'VIP', desc: '₱500 · 6 months' },
                      ].map(p => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setFormPlan(p.key)}
                          className={`rounded-xl border-2 p-2.5 text-center transition-all ${
                            formPlan === p.key
                              ? 'border-[#17c3b2] bg-[#17c3b2]/10 dark:bg-[#17c3b2]/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-bold text-xs text-gray-900 dark:text-white">{p.label}</p>
                          <p className="text-[10px] text-gray-500">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Payment Method</label>
                    <select
                      value={formMethod}
                      onChange={e => setFormMethod(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option>GCash</option>
                      <option>Maya</option>
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Amount: <span className="font-bold text-gray-700 dark:text-gray-300">₱{planAmount}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {formMethod} Reference Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formRef}
                    onChange={e => setFormRef(e.target.value)}
                    placeholder="e.g. 1234567890"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    rows={2}
                    placeholder="Any additional info for the admin..."
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{formError}</p>
                  </div>
                )}
                {formSuccess && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700">{formSuccess}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !formRef.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#17c3b2] hover:bg-[#14a99a] disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}
