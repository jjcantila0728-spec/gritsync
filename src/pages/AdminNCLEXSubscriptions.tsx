import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  Users, Crown, Zap, BookOpen, TrendingUp, Search,
  CheckCircle, XCircle, Clock, Calendar, BarChart2,
  Plus, Edit2, Trash2, RefreshCw, AlertCircle,
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

export function AdminNCLEXSubscriptions() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [assignModal, setAssignModal] = useState<AssignModalState | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

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

  useEffect(() => {
    load()
  }, [load])

  const handleAssign = async (userId: string, data: any) => {
    await apiFetch('/api/questions/subscription/admin/assign', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, ...data }),
    })
    showToast('Subscription assigned successfully!', 'success')
    load()
  }

  const handleCancel = async (subscriptionId: string, userName: string) => {
    if (!confirm(`Cancel subscription for ${userName}? They'll revert to the Free plan.`)) return
    setCancelling(subscriptionId)
    try {
      await apiFetch('/api/questions/subscription/admin/cancel', {
        method: 'POST',
        body: JSON.stringify({ subscription_id: subscriptionId }),
      })
      showToast('Subscription cancelled.', 'success')
      load()
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel', 'error')
    } finally {
      setCancelling(null)
    }
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage user subscription plans and usage</p>
            </div>
            <Button onClick={load} variant="outline" size="sm" className="flex items-center gap-2">
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

          {/* User Table */}
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
                      const isActive = plan !== 'free' && u.status === 'active'
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
        </main>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <AssignModal
          state={assignModal}
          onClose={() => setAssignModal(null)}
          onSave={(data) => handleAssign(assignModal.userId, data)}
        />
      )}
    </div>
  )
}
