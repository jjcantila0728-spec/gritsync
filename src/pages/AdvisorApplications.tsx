import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { formatDate, getFullName, cn } from '@/lib/utils'
import {
  Briefcase, ClipboardList, RefreshCw, Search, MessageSquare, FileText, UserCheck, DollarSign, CheckCircle, Clock, AlertCircle, ExternalLink,
} from 'lucide-react'

interface AssignedApp {
  id: string
  grit_app_id: string | null
  application_type: string
  status: string
  total_amount: number | null
  paid_amount: number | null
  created_at: string
  updated_at: string
  submitted_at: string | null
  last_step_at: string | null
  total_steps: number
  completed_steps: number
  client: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
    grit_id: string | null
    avatar_path: string | null
    is_active: boolean
  }
}

function getAuthToken(): string | null {
  return localStorage.getItem('gritsync_token')
}
async function apiFetch(path: string) {
  const token = getAuthToken()
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

const money = (n: number | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`

const STATUS_META: Record<string, { label: string; chip: string; group: 'active' | 'done' | 'blocked' | 'pending' }> = {
  pending:     { label: 'Pending',     chip: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',           group: 'pending' },
  in_progress: { label: 'In progress', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',         group: 'active' },
  processing:  { label: 'Processing',  chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',         group: 'active' },
  submitted:   { label: 'Submitted',   chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', group: 'active' },
  approved:    { label: 'Approved',    chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',     group: 'done' },
  completed:   { label: 'Completed',   chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',     group: 'done' },
  rejected:    { label: 'Rejected',    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',             group: 'blocked' },
  on_hold:     { label: 'On hold',     chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',     group: 'blocked' },
}

function statusMeta(status: string) {
  return STATUS_META[status] || { label: status.replace(/_/g, ' '), chip: STATUS_META.pending.chip, group: 'pending' as const }
}

function ClientAvatar({ client }: { client: AssignedApp['client'] }) {
  const [imgErr, setImgErr] = useState(false)
  const name = getFullName(client.first_name, client.last_name, 'Client')
  const initials = name.split(/\s+/).map((n) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
  const token = getAuthToken()
  const url = client.avatar_path && !imgErr
    ? `/api/storage/file?path=${encodeURIComponent(client.avatar_path.replace(/\\/g, '/'))}${token ? `&t=${encodeURIComponent(token)}` : ''}`
    : null
  return url ? (
    <img src={url} alt={initials} onError={() => setImgErr(true)} className="w-9 h-9 rounded-full object-cover bg-gray-200 dark:bg-gray-700" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-violet-200 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 font-semibold text-xs flex items-center justify-center">
      {initials}
    </div>
  )
}

export function AdvisorApplications() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [apps, setApps] = useState<AssignedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'done' | 'blocked' | 'pending'>('all')

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const data = await apiFetch('/api/referrals/assigned/applications')
      setApps(data.data || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load assigned applications', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const s = { total: apps.length, active: 0, done: 0, blocked: 0, pending: 0, paidVolume: 0, totalVolume: 0, clients: new Set<string>() }
    for (const a of apps) {
      const g = statusMeta(a.status).group
      s[g]++
      s.paidVolume += a.paid_amount || 0
      s.totalVolume += a.total_amount || 0
      s.clients.add(a.client.id)
    }
    return { ...s, clientCount: s.clients.size }
  }, [apps])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter((a) => {
      if (statusFilter !== 'all' && statusMeta(a.status).group !== statusFilter) return false
      if (!q) return true
      const name = getFullName(a.client.first_name, a.client.last_name).toLowerCase()
      return (
        name.includes(q) ||
        (a.client.email || '').toLowerCase().includes(q) ||
        (a.client.grit_id || '').toLowerCase().includes(q) ||
        (a.grit_app_id || '').toLowerCase().includes(q) ||
        (a.application_type || '').toLowerCase().includes(q)
      )
    })
  }, [apps, search, statusFilter])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ClipboardList className="h-7 w-7 text-violet-500" /> Assigned Applications
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Every application across the clients assigned to you.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/advisor')}>
                <Briefcase className="h-4 w-4 mr-2" /> Back to panel
              </Button>
              <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} /> Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <StatCard icon={ClipboardList} label="Total applications" value={String(stats.total)} tint="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <StatCard icon={Clock} label="In progress" value={String(stats.active)} tint="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
            <StatCard icon={CheckCircle} label="Completed" value={String(stats.done)} tint="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" active={statusFilter === 'done'} onClick={() => setStatusFilter('done')} />
            <StatCard icon={AlertCircle} label="Blocked" value={String(stats.blocked)} tint="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" active={statusFilter === 'blocked'} onClick={() => setStatusFilter('blocked')} />
            <StatCard icon={DollarSign} label="Paid (sum)" value={money(stats.paidVolume)} tint="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
          </div>

          {/* Search */}
          <Card className="mb-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by client name, email, GRIT-ID, or application…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {statusFilter !== 'all' && (
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>Clear status filter</Button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {stats.total} application{stats.total === 1 ? '' : 's'} · across {stats.clientCount} client{stats.clientCount === 1 ? '' : 's'}.
            </p>
          </Card>

          {/* Table */}
          {loading ? (
            <Card><div className="py-12"><Loading text="Loading applications..." /></div></Card>
          ) : apps.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-1">No clients have been assigned to you yet.</p>
                <p className="text-xs">Share your referral link from the Advisor Panel — new sign-ups land here automatically.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/advisor')}>Go to Advisor Panel</Button>
              </div>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No applications match the current filters.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setSearch(''); setStatusFilter('all') }}>Clear filters</Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <th className="py-3 px-2 sm:px-4 min-w-[200px]">Client</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[160px]">Application</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[120px]">Status</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[160px]">Progress</th>
                      <th className="py-3 px-2 sm:px-4 text-right min-w-[120px]">Paid / Total</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[120px]">Updated</th>
                      <th className="py-3 px-2 sm:px-4 text-right min-w-[150px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const meta = statusMeta(a.status)
                      const pct = a.total_steps > 0 ? Math.round((a.completed_steps / a.total_steps) * 100) : 0
                      const fullName = getFullName(a.client.first_name, a.client.last_name, 'Unnamed client')
                      return (
                        <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="py-3 px-2 sm:px-4">
                            <div className="flex items-center gap-3">
                              <ClientAvatar client={a.client} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{fullName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                                  {a.client.grit_id ? <span className="font-mono">{a.client.grit_id}</span> : a.client.email}
                                  {a.client.is_active === false && <span className="ml-1 text-amber-600 dark:text-amber-400">· inactive</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 sm:px-4">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{a.application_type || 'Application'}</p>
                            {a.grit_app_id && <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">{a.grit_app_id}</p>}
                          </td>
                          <td className="py-3 px-2 sm:px-4">
                            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', meta.chip)}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-3 px-2 sm:px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden min-w-[80px]">
                                <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{a.completed_steps}/{a.total_steps}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right">
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{money(a.paid_amount)}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">of {money(a.total_amount)}</p>
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(a.updated_at || a.created_at)}</td>
                          <td className="py-3 px-2 sm:px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate('/messages', { state: { userId: a.client.id } })} title="Message client">
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => navigate(`/applications/${a.id}/timeline`)}
                                title="Open application timeline"
                              >
                                <FileText className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Timeline</span>
                                <ExternalLink className="h-3 w-3 ml-0.5 hidden sm:inline" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, tint, active, onClick,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tint: string; active?: boolean; onClick?: () => void }) {
  const clickable = !!onClick
  return (
    <Card
      className={cn('p-4 transition-colors', clickable && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60', active && 'ring-2 ring-primary-500')}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <div className={cn('p-2.5 rounded-lg', tint)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}
