import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { NewClientButton } from '@/components/NewClientButton'
import { appUrl } from '@/lib/routing'
import { pushCurrentSession } from '@/lib/impersonation'
import { formatDate, getFullName, cn } from '@/lib/utils'
import {
  Users, Search, RefreshCw, MessageSquare, FileText, LogIn, UserCheck, UserX,
  Link2 as LinkIcon, CheckCircle, ExternalLink,
} from 'lucide-react'

interface AssignedClient {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  grit_id: string | null
  is_active: boolean
  created_at: string
  application_count: number
  via_referral: boolean
}

interface AppRow {
  id: string
  grit_app_id: string | null
  application_type: string
  status: string
  total_amount: number | null
  paid_amount: number | null
  created_at: string
  updated_at: string
  total_steps: number
  completed_steps: number
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

function ClientAvatar({ id, first_name, last_name }: { id: string; first_name: string | null; last_name: string | null }) {
  const initials = `${(first_name || '').charAt(0)}${(last_name || '').charAt(0)}`.toUpperCase() || (first_name || last_name || '?').charAt(0).toUpperCase()
  // Deterministic color from id
  const palette = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (
    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold', palette[h % palette.length])}>
      {initials}
    </div>
  )
}

export function AdvisorClientList() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [clients, setClients] = useState<AssignedClient[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'via_referral'>('all')
  const [loggingInAs, setLoggingInAs] = useState<string | null>(null)

  // "View applications" modal
  const [openClient, setOpenClient] = useState<AssignedClient | null>(null)
  const [clientApps, setClientApps] = useState<AppRow[]>([])
  const [loadingApps, setLoadingApps] = useState(false)

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const d = await apiFetch('/api/referrals/me')
      setClients(d?.assigned || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load clients', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    let active = 0, inactive = 0, viaReferral = 0
    for (const c of clients) {
      if (c.is_active === false) inactive++; else active++
      if (c.via_referral) viaReferral++
    }
    return { total: clients.length, active, inactive, viaReferral }
  }, [clients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (statusFilter === 'active' && c.is_active === false) return false
      if (statusFilter === 'inactive' && c.is_active !== false) return false
      if (statusFilter === 'via_referral' && !c.via_referral) return false
      if (!q) return true
      const name = getFullName(c.first_name, c.last_name).toLowerCase()
      return name.includes(q) || (c.email || '').toLowerCase().includes(q) || (c.grit_id || '').toLowerCase().includes(q)
    })
  }, [clients, search, statusFilter])

  const openClientApps = async (c: AssignedClient) => {
    setOpenClient(c)
    setClientApps([])
    setLoadingApps(true)
    try {
      const d = await apiFetch(`/api/referrals/assigned/${encodeURIComponent(c.id)}/applications`)
      setClientApps(d.data || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load applications', 'error')
    } finally {
      setLoadingApps(false)
    }
  }

  const loginAsClient = async (c: AssignedClient) => {
    setLoggingInAs(c.id)
    try {
      const advisorToken = localStorage.getItem('gritsync_token')
      if (!advisorToken) throw new Error('No active session. Please log in again.')
      const res = await fetch('/api/auth/admin-login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${advisorToken}` },
        body: JSON.stringify({ userId: c.id }),
      })
      const d = await res.json()
      if (!res.ok || !d.access_token) throw new Error(d.error || 'Failed to start client session')
      pushCurrentSession()
      localStorage.setItem('gritsync_token', d.access_token)
      localStorage.setItem('gritsync_refresh_token', d.refresh_token || '')
      localStorage.setItem('gritsync_user', JSON.stringify(d.user))
      showToast(`Signed in as ${d.user?.first_name || 'client'}`, 'success')
      window.location.href = appUrl('/dashboard')
    } catch (err: any) {
      showToast(err.message || 'Failed to sign in as client', 'error')
    } finally {
      setLoggingInAs(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users className="h-7 w-7 text-violet-500" /> Clients
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Manage every client assigned to you.</p>
            </div>
            <div className="flex gap-2">
              <NewClientButton onCreated={() => load(true)} accent="violet" />
              <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} /> Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard icon={Users} label="Total" value={String(stats.total)} tint="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <StatCard icon={UserCheck} label="Active" value={String(stats.active)} tint="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
            <StatCard icon={UserX} label="Inactive" value={String(stats.inactive)} tint="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" active={statusFilter === 'inactive'} onClick={() => setStatusFilter('inactive')} />
            <StatCard icon={LinkIcon} label="Via your link" value={String(stats.viaReferral)} tint="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" active={statusFilter === 'via_referral'} onClick={() => setStatusFilter('via_referral')} />
          </div>

          {/* Search */}
          <Card className="mb-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search clients by name, email, or GRIT-ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {(statusFilter !== 'all' || search) && (
                <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setSearch('') }}>Clear filters</Button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {stats.total} client{stats.total === 1 ? '' : 's'}.
            </p>
          </Card>

          {/* Table */}
          {loading ? (
            <Card><div className="py-12"><Loading text="Loading clients..." /></div></Card>
          ) : clients.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-1">No clients are assigned to you yet.</p>
                <p className="text-xs">Use <strong>New Client</strong> above to add one, or share your referral link from the Dashboard.</p>
              </div>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No clients match your filters.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <th className="py-3 px-2 sm:px-4 min-w-[220px]">Client</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[140px]">GRIT-ID</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[100px]">Applications</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[110px]">Source</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[110px]">Joined</th>
                      <th className="py-3 px-2 sm:px-4 min-w-[100px]">Status</th>
                      <th className="py-3 px-2 sm:px-4 text-right min-w-[230px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3 px-2 sm:px-4">
                          <div className="flex items-center gap-3">
                            <ClientAvatar id={c.id} first_name={c.first_name} last_name={c.last_name} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{getFullName(c.first_name, c.last_name, 'No name')}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-sm">
                          {c.grit_id ? <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300">{c.grit_id}</span> : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{c.application_count}</span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-sm">
                          {c.via_referral
                            ? <span className="text-xs font-medium rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5">Your link</span>
                            : <span className="text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5">Assigned</span>}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                        <td className="py-3 px-2 sm:px-4">
                          {c.is_active === false
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5"><UserX className="h-3 w-3" /> Inactive</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5"><CheckCircle className="h-3 w-3" /> Active</span>}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => openClientApps(c)} title="View applications">
                              <FileText className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Applications</span>
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate('/messages', { state: { userId: c.id } })} title="Message client">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs whitespace-nowrap bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white border-0"
                              disabled={loggingInAs === c.id || c.is_active === false}
                              onClick={() => loginAsClient(c)}
                              title={c.is_active === false ? 'Inactive accounts cannot be signed into' : `Sign in as ${getFullName(c.first_name, c.last_name)}`}
                            >
                              <LogIn className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">{loggingInAs === c.id ? 'Signing in…' : 'Login as'}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>
      </div>

      {/* Applications modal */}
      <Modal
        isOpen={!!openClient}
        onClose={() => { setOpenClient(null); setClientApps([]) }}
        title={openClient ? `${getFullName(openClient.first_name, openClient.last_name)} — Applications` : ''}
        size="lg"
      >
        {loadingApps ? (
          <div className="flex items-center justify-center py-10"><Loading text="Loading applications..." /></div>
        ) : clientApps.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">This client has no applications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientApps.map((a) => {
              const pct = a.total_steps > 0 ? Math.round((a.completed_steps / a.total_steps) * 100) : 0
              return (
                <div key={a.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                        {a.application_type || 'Application'} {a.grit_app_id ? <span className="font-mono text-xs text-gray-500">· {a.grit_app_id}</span> : null}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Created {formatDate(a.created_at)} · Updated {formatDate(a.updated_at)}</p>
                    </div>
                    <span className="text-xs font-medium rounded-full px-2 py-0.5 capitalize whitespace-nowrap bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {String(a.status).replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{a.completed_steps}/{a.total_steps} steps</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Total {money(a.total_amount)} · Paid {money(a.paid_amount)}
                    </div>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/applications/${a.id}/timeline`)}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Open timeline
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
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
