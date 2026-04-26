import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  Users, Crown, Zap, BookOpen, TrendingUp, Search,
  CheckCircle, XCircle, Clock, BarChart2,
  Edit2, RefreshCw, Bell, CreditCard,
} from 'lucide-react'

function getToken() {
  return localStorage.getItem('gritsync_token')
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

interface PaymentSubmission {
  id: number
  user_id: number
  email: string
  first_name?: string
  last_name?: string
  grit_id?: string
  plan: string
  amount: string
  payment_method: string
  reference_number: string
  notes?: string
  status: string
  submitted_at: string
  admin_notes?: string
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

function ReviewModal({ submission, onClose, onAction }: {
  submission: PaymentSubmission
  onClose: () => void
  onAction: (action: 'approve' | 'reject', adminNotes: string) => Promise<void>
}) {
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const handle = async (action: 'approve' | 'reject') => {
    setSaving(action)
    try {
      await onAction(action, adminNotes)
      onClose()
    } finally {
      setSaving(null)
    }
  }

  const userName = [submission.first_name, submission.last_name].filter(Boolean).join(' ') || submission.email.split('@')[0]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Review Payment</h3>
          <p className="text-sm text-gray-500 mt-0.5">Submission #{submission.id}</p>
        </div>

        <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">User</span>
            <div className="text-right">
              <p className="font-semibold text-gray-900 dark:text-white">{userName}</p>
              <p className="text-xs text-gray-400">{submission.email}</p>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Plan</span>
            <span className="font-semibold text-gray-900 dark:text-white capitalize">{submission.plan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount</span>
            <span className="font-semibold text-gray-900 dark:text-white">₱{parseFloat(submission.amount).toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Method</span>
            <span className="font-semibold text-gray-900 dark:text-white">{submission.payment_method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Reference #</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white">{submission.reference_number}</span>
          </div>
          {submission.notes && (
            <div>
              <span className="text-gray-500">User Notes</span>
              <p className="text-gray-800 dark:text-gray-200 mt-0.5 text-xs">{submission.notes}</p>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Submitted</span>
            <span className="text-gray-700 dark:text-gray-300">
              {new Date(submission.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Notes (optional)</label>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            rows={2}
            placeholder="Reason for approval/rejection or any notes..."
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <button
            onClick={() => handle('reject')}
            disabled={!!saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            {saving === 'reject' ? 'Rejecting...' : 'Reject'}
          </button>
          <button
            onClick={() => handle('approve')}
            disabled={!!saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            {saving === 'approve' ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

type TabId = 'users' | 'approvals'

export function AdminNCLEXSubscriptions() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('users')

  // Users tab state
  const [users, setUsers] = useState<UserRow[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [assignModal, setAssignModal] = useState<AssignModalState | null>(null)

  // Approvals tab state
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([])
  const [subLoading, setSubLoading] = useState(false)
  const [subFilter, setSubFilter] = useState('pending')
  const [reviewModal, setReviewModal] = useState<PaymentSubmission | null>(null)

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

  const loadSubmissions = useCallback(async () => {
    setSubLoading(true)
    try {
      const data = await apiFetch(`/api/questions/payment/submissions?status=${subFilter}`)
      setSubmissions(data)
    } catch (err: any) {
      showToast(err.message || 'Failed to load submissions', 'error')
    } finally {
      setSubLoading(false)
    }
  }, [subFilter, showToast])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSubmissions() }, [loadSubmissions])

  // Count pending for badge
  const pendingCount = submissions.filter(s => s.status === 'pending').length

  const handleAssign = async (userId: string, data: any) => {
    await apiFetch('/api/questions/subscription/admin/assign', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, ...data }),
    })
    showToast('Subscription assigned successfully!', 'success')
    load()
  }

  const handleReviewAction = async (submissionId: number, action: 'approve' | 'reject', adminNotes: string) => {
    await apiFetch(`/api/questions/payment/submissions/${submissionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, admin_notes: adminNotes }),
    })
    showToast(action === 'approve' ? 'Payment approved and plan activated!' : 'Submission rejected.', action === 'approve' ? 'success' : 'error')
    loadSubmissions()
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
            <Button onClick={() => { load(); loadSubmissions() }} variant="outline" size="sm" className="flex items-center gap-2">
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
                    <BookOpen className="h-5 w-5 text-gray-500" />
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
                    <p className="text-xs text-gray-500">Premium</p>
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
                    <p className="text-xs text-gray-500">VIP</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.questions_today}</p>
                    <p className="text-xs text-gray-500">Questions Today</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
            {([
              { id: 'users' as TabId, label: 'All Users', icon: <Users className="h-4 w-4" /> },
              { id: 'approvals' as TabId, label: 'Pending Approvals', icon: <Bell className="h-4 w-4" />, badge: submissions.filter(s => s.status === 'pending').length },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#17c3b2] text-[#17c3b2]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: All Users ── */}
          {activeTab === 'users' && (
            <>
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
            </>
          )}

          {/* ── Tab: Pending Approvals ── */}
          {activeTab === 'approvals' && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#17c3b2]" />
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Payment Submissions</span>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={subFilter}
                    onChange={e => setSubFilter(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                  </select>
                  <button onClick={loadSubmissions} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {subLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                  <Bell className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No {subFilter === 'all' ? '' : subFilter} submissions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">User</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Plan</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Amount</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden sm:table-cell">Reference</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Status</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3 uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {submissions.map(s => {
                        const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email.split('@')[0]
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
                              <p className="text-xs text-gray-400">{s.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[s.plan] || PLAN_COLORS.free}`}>
                                {s.plan === 'vip' ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                                {s.plan.charAt(0).toUpperCase() + s.plan.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                              ₱{parseFloat(s.amount).toFixed(0)}
                              <span className="text-xs text-gray-400 font-normal block">{s.payment_method}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                              {s.reference_number}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                              {new Date(s.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3">
                              {s.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border bg-yellow-100 text-yellow-800 border-yellow-300">
                                  <Clock className="h-3 w-3" /> Pending
                                </span>
                              )}
                              {s.status === 'approved' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border bg-green-100 text-green-800 border-green-300">
                                  <CheckCircle className="h-3 w-3" /> Approved
                                </span>
                              )}
                              {s.status === 'rejected' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border bg-red-100 text-red-800 border-red-300">
                                  <XCircle className="h-3 w-3" /> Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {s.status === 'pending' ? (
                                <Button
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setReviewModal(s)}
                                >
                                  Review
                                </Button>
                              ) : (
                                <button
                                  onClick={() => setReviewModal(s)}
                                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                  Details
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                    {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
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
      {reviewModal && (
        <ReviewModal
          submission={reviewModal}
          onClose={() => setReviewModal(null)}
          onAction={(action, notes) => handleReviewAction(reviewModal.id, action, notes)}
        />
      )}
    </div>
  )
}
