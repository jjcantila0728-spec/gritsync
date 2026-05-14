import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  Users, Crown, Zap, BookOpen, TrendingUp, Search,
  CheckCircle, XCircle, BarChart2,
  Edit2, RefreshCw, Image as ImageIcon,
} from 'lucide-react'

function getToken() {
  return localStorage.getItem('gritsync_token')
}

function screenshotViewUrl(path: string): string {
  return `/api/storage/file?path=${encodeURIComponent(path)}&t=${getToken()}`
}

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

const PLAN_LABELS: Record<string, string> = { free: 'Free', premium: 'Premium', vip: 'VIP' }
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  premium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  vip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
}

interface UserRow {
  id: string
  email: string
  first_name?: string
  last_name?: string
  grit_id?: string
  plan?: string
  status?: string
  expires_at?: string
  subscribed_at?: string
  questions_today: number
  questions_total: number
}

interface Analytics {
  summary: {
    free_users: number
    premium_users: number
    vip_users: number
    questions_today: number
  }
  daily_usage: { usage_date: string; total: number }[]
}

interface AssignModalState {
  open: boolean
  userId: string
  userName: string
  currentPlan: string
}

interface PendingSubmission {
  id: number
  user_id: number
  plan: string
  payment_method: string
  payment_reference: string
  payment_amount: number
  notes: string
  status: string
  created_at: string
  user_email: string
  first_name?: string
  last_name?: string
  grit_id?: string
  screenshot_url?: string | null
}

interface ReviewModalState {
  open: boolean
  submission: PendingSubmission
  action: 'approve' | 'reject'
}

function AssignModal({
  state, onClose, onSave,
}: {
  state: AssignModalState
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [plan, setPlan] = useState(state.currentPlan === 'free' || !state.currentPlan ? 'premium' : state.currentPlan)
  const [paymentAmount, setPaymentAmount] = useState(plan === 'vip' ? '500' : '250')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('GCash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPaymentAmount(plan === 'vip' ? '500' : plan === 'free' ? '0' : '250')
  }, [plan])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ plan, payment_amount: Number(paymentAmount), payment_reference: paymentRef, payment_method: paymentMethod, notes })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assign Subscription</h3>
          <p className="text-sm text-gray-500 mt-1">User: <span className="font-medium">{state.userName}</span></p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'free', label: 'Free', desc: '25 q/day' },
                { key: 'premium', label: 'Premium', desc: '₱250 / 2mo' },
                { key: 'vip', label: 'VIP', desc: '₱500 / 6mo' },
              ].map(p => (
                <button key={p.key} onClick={() => setPlan(p.key)}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${plan === p.key ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{p.label}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {plan !== 'free' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (PHP)</label>
                  <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <option>GCash</option>
                    <option>Maya</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Reference / GCash Ref #</label>
                <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Optional"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">Assign Plan</Button>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({
  state, onClose, onDone,
}: {
  state: ReviewModalState
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [reviewNotes, setReviewNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { submission, action } = state
  const userName = [submission.first_name, submission.last_name].filter(Boolean).join(' ') || submission.user_email.split('@')[0]

  const handleAction = async () => {
    setSaving(true)
    try {
      const endpoint = action === 'approve' ? '/api/questions/subscription/admin/approve' : '/api/questions/subscription/admin/reject'
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ submission_id: submission.id, review_notes: reviewNotes || null }),
      })
      showToast(action === 'approve' ? 'Submission approved and plan activated!' : 'Submission rejected.', 'success')
      onDone()
      onClose()
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {action === 'approve' ? 'Approve Payment' : 'Reject Payment'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">User: <span className="font-medium">{userName}</span></p>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Plan requested</span>
            <span className="font-semibold capitalize text-gray-900 dark:text-white">{submission.plan}</span>
          </div>
          {submission.payment_method && (
            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span className="font-medium text-gray-900 dark:text-white">{submission.payment_method}</span>
            </div>
          )}
          {submission.payment_amount && (
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium text-gray-900 dark:text-white">₱{submission.payment_amount}</span>
            </div>
          )}
          {submission.payment_reference && (
            <div className="flex justify-between">
              <span className="text-gray-500">Reference #</span>
              <span className="font-medium text-gray-900 dark:text-white">{submission.payment_reference}</span>
            </div>
          )}
          {submission.notes && (
            <div className="flex flex-col gap-1">
              <span className="text-gray-500">Notes</span>
              <span className="text-gray-700 dark:text-gray-300 text-xs">{submission.notes}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Submitted</span>
            <span className="text-gray-700 dark:text-gray-300">{new Date(submission.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          {submission.screenshot_url && (
            <div className="flex flex-col gap-1.5">
              <span className="text-gray-500">Screenshot</span>
              <a
                href={screenshotViewUrl(submission.screenshot_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={screenshotViewUrl(submission.screenshot_url)}
                  alt="Payment screenshot"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 object-contain max-h-48 bg-white dark:bg-gray-900 hover:opacity-90 transition-opacity cursor-pointer"
                />
              </a>
            </div>
          )}
        </div>

        {action === 'approve' && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 text-xs text-green-700 dark:text-green-400">
            Approving will immediately activate the <strong className="capitalize">{submission.plan}</strong> plan for this user.
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {action === 'reject' ? 'Reason for rejection (shown to user)' : 'Notes (optional)'}
          </label>
          <textarea
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            rows={2}
            placeholder={action === 'reject' ? 'e.g. Invalid reference number' : 'Optional admin notes...'}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleAction}
            loading={saving}
            className={`flex-1 ${action === 'reject' ? 'bg-red-600 hover:bg-red-700 border-red-600' : ''}`}
          >
            {action === 'approve' ? 'Approve & Activate' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AdminNCLEXSubscriptions() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'users' | 'pending'>('users')
  const [users, setUsers] = useState<UserRow[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [assignModal, setAssignModal] = useState<AssignModalState | null>(null)
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [usersData, analyticsData] = await Promise.all([
        apiFetch('/api/questions/subscription/admin/users'),
        apiFetch('/api/questions/subscription/admin/analytics'),
      ])
      setUsers(usersData)
      setAnalytics(analyticsData)
    } catch (err: any) {
      showToast(err.message || 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const loadPending = useCallback(async () => {
    setPendingLoading(true)
    try {
      const data = await apiFetch('/api/questions/subscription/admin/pending-approvals')
      setPendingSubmissions(data)
    } catch (err: any) {
      showToast(err.message || 'Failed to load pending', 'error')
    } finally {
      setPendingLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
    loadPending()
  }, [load, loadPending])

  const handleAssign = async (userId: string, data: any) => {
    await apiFetch('/api/questions/subscription/admin/assign', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, ...data }),
    })
    showToast('Subscription assigned successfully!', 'success')
    load()
  }

  const filtered = users.filter(u => {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
    const matchSearch = search === '' || name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) || (u.grit_id || '').toLowerCase().includes(search.toLowerCase())
    const matchPlan = planFilter === 'all' || (u.plan || 'free') === planFilter
    return matchSearch && matchPlan
  })

  const summary = analytics?.summary

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NCLEX Subscriptions</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage user subscription plans and payment approvals</p>
            </div>
            <Button onClick={() => { load(); loadPending() }} variant="outline" size="sm" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.free_users}</p>
                    <p className="text-xs text-gray-500">Free Users</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.premium_users}</p>
                    <p className="text-xs text-gray-500">Premium Users</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.vip_users}</p>
                    <p className="text-xs text-gray-500">VIP Users</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.questions_today}</p>
                    <p className="text-xs text-gray-500">Questions Today</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Daily Usage Trend */}
          {analytics?.daily_usage && analytics.daily_usage.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary-500" />
                Daily Question Usage (Last 30 Days)
              </h3>
              <div className="flex items-end gap-1 h-24">
                {analytics.daily_usage.slice(0, 30).reverse().map((d) => {
                  const maxVal = Math.max(...analytics.daily_usage.map(x => Number(x.total)), 1)
                  const height = Math.max(4, Math.round((Number(d.total) / maxVal) * 96))
                  return (
                    <div key={d.usage_date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {new Date(d.usage_date).toLocaleDateString()}: {d.total} questions
                      </div>
                      <div className="w-full bg-primary-200 dark:bg-primary-800 rounded-sm transition-all" style={{ height: `${height}px` }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              All Users
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Pending Approvals
              {pendingSubmissions.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white">
                  {pendingSubmissions.length}
                </span>
              )}
            </button>
          </div>

          {/* Pending Approvals Tab */}
          {activeTab === 'pending' && (
            <Card className="overflow-hidden">
              {pendingLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                  <CheckCircle className="h-8 w-8" />
                  <p className="text-sm">No pending payment submissions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">User</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Plan</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden sm:table-cell">Payment</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pendingSubmissions.map(s => {
                        const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.user_email.split('@')[0]
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
                                <p className="text-xs text-gray-400">{s.user_email}</p>
                                {s.grit_id && <p className="text-xs text-gray-400">{s.grit_id}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[s.plan]}`}>
                                {s.plan === 'vip' ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                                {PLAN_LABELS[s.plan]}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                                {s.payment_method && <p>{s.payment_method}{s.payment_amount ? ` · ₱${s.payment_amount}` : ''}</p>}
                                {s.payment_reference && <p className="text-gray-400">Ref: {s.payment_reference}</p>}
                                {s.notes && <p className="text-gray-400 truncate max-w-xs">{s.notes}</p>}
                                {s.screenshot_url && (
                                  <a
                                    href={screenshotViewUrl(s.screenshot_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#17c3b2] hover:underline font-medium"
                                  >
                                    <ImageIcon className="h-3 w-3" />
                                    View Screenshot
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-xs text-gray-500">
                                {new Date(s.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 border-green-600"
                                  onClick={() => setReviewModal({ open: true, submission: s, action: 'approve' })}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center gap-1 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => setReviewModal({ open: true, submission: s, action: 'reject' })}
                                >
                                  <XCircle className="h-3 w-3" />
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                    {pendingSubmissions.length} pending {pendingSubmissions.length === 1 ? 'submission' : 'submissions'}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* All Users Tab */}
          {activeTab === 'users' && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or Grit ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="vip">VIP</option>
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <Users className="h-8 w-8 mb-2" />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">User</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Plan</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden md:table-cell">Expires</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden sm:table-cell">Today</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden lg:table-cell">Total</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filtered.map(u => {
                        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email.split('@')[0]
                        const plan = u.plan || 'free'
                        const isExpired = u.expires_at && new Date(u.expires_at) < new Date()

                        return (
                          <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
                                <p className="text-xs text-gray-400">{u.email}</p>
                                {u.grit_id && <p className="text-xs text-gray-400">{u.grit_id}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[plan]}`}>
                                  {plan === 'vip' ? <Crown className="h-3 w-3" /> : plan === 'premium' ? <Zap className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                                  {PLAN_LABELS[plan]}
                                </span>
                                {isExpired && <span className="text-xs text-red-500">Expired</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {u.expires_at ? (
                                <span className={`text-xs ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                                  {new Date(u.expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{u.questions_today}</span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{u.questions_total}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center gap-1 text-xs"
                                  onClick={() => setAssignModal({
                                    open: true,
                                    userId: u.id,
                                    userName: name,
                                    currentPlan: plan,
                                  })}>
                                  <Edit2 className="h-3 w-3" />
                                  Assign
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                    Showing {filtered.length} of {users.length} users
                  </div>
                </div>
              )}
            </Card>
          )}
        </main>
      </div>

      {/* Modals */}
      {assignModal && (
        <AssignModal
          state={assignModal}
          onClose={() => setAssignModal(null)}
          onSave={(data) => handleAssign(assignModal.userId, data)}
        />
      )}

      {/* Review Modal */}
      {reviewModal && (
        <ReviewModal
          state={reviewModal}
          onClose={() => setReviewModal(null)}
          onDone={() => { loadPending(); load() }}
        />
      )}
    </div>
  )
}
