import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { NewClientButton } from '@/components/NewClientButton'
import { formatDate, getFullName, cn } from '@/lib/utils'
import {
  Briefcase, Link2, Copy, Users, CheckCircle, DollarSign, TrendingUp, RefreshCw,
  ShieldAlert, MessageSquare, FileText, UserCheck, ExternalLink, AlertTriangle,
  ArrowRight, Clock, ClipboardList, Mail, ChevronRight, Sparkles,
} from 'lucide-react'

interface ReferredUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  grit_id: string | null
  is_active: boolean
  created_at: string
  application_count: number
  paid_total: number
  converted: boolean
  bonus_earned: number
}

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

interface ReferralData {
  role: string
  referralCode: string | null
  bonusPercent: number
  stats: { totalReferred: number; totalConverted: number; totalPaidVolume: number; totalEarnings: number; assignedClients: number }
  referred: ReferredUser[]
  assigned: AssignedClient[]
}

interface ClientApp {
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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const TERMINAL_STATUSES = new Set(['completed', 'approved', 'rejected'])
const STALE_DAYS = 14

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function ClientAvatar({ id, first_name, last_name, size = 'md' }: { id: string; first_name: string | null; last_name: string | null; size?: 'sm' | 'md' }) {
  const initials = `${(first_name || '').charAt(0)}${(last_name || '').charAt(0)}`.toUpperCase() || (first_name || last_name || '?').charAt(0).toUpperCase()
  const palette = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const dims = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0', dims, palette[h % palette.length])}>
      {initials}
    </div>
  )
}

export function AdvisorPanel() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<ReferralData | null>(null)
  const [apps, setApps] = useState<ClientApp[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const meRes = await apiFetch('/api/referrals/me')
      setData(meRes)
      if (meRes?.role === 'advisor') {
        try {
          const appsRes = await apiFetch('/api/referrals/assigned/applications')
          setApps(appsRes?.data || [])
        } catch {
          setApps([])
        }
      } else {
        setApps([])
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load advisor data', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeApps = useMemo(() => apps.filter((a) => !TERMINAL_STATUSES.has(a.status)).length, [apps])
  const recentApps = useMemo(
    () => [...apps]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6),
    [apps]
  )
  const needsAttention = useMemo(() => {
    const candidates = apps
      .filter((a) => !TERMINAL_STATUSES.has(a.status))
      .map((a) => ({
        app: a,
        stale: daysSince(a.last_step_at || a.updated_at),
      }))
      .filter((x) => x.stale >= STALE_DAYS || x.app.status === 'pending')
      .sort((a, b) => b.stale - a.stale)
    return candidates.slice(0, 5)
  }, [apps])

  const referralLink = data?.referralCode ? `${window.location.origin}/register?ref=${data.referralCode}` : null
  const copy = async (text: string, label = 'Copied') => {
    try { await navigator.clipboard.writeText(text); showToast(label, 'success') }
    catch { showToast('Could not copy — please copy manually', 'error') }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex"><Sidebar /><main className="flex-1 p-4 md:p-8"><Loading text="Loading advisor dashboard..." /></main></div>
      </div>
    )
  }

  const isAdvisor = data?.role === 'advisor'
  const firstName = user?.first_name || 'there'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          {/* Hero */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Briefcase className="h-7 w-7 text-violet-500" /> Welcome back, {firstName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {isAdvisor
                  ? <>Here&apos;s what&apos;s happening across your clients today. You earn <span className="font-semibold text-violet-700 dark:text-violet-300">{data?.bonusPercent ?? 10}%</span> on every referral that pays.</>
                  : <>Refer clients to GritSync and earn <span className="font-semibold text-violet-700 dark:text-violet-300">{data?.bonusPercent ?? 10}%</span> on every payment they make.</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdvisor && <NewClientButton onCreated={() => load(true)} accent="violet" />}
              <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} /> Refresh
              </Button>
            </div>
          </div>

          {!isAdvisor && (
            <Card className="mb-6 border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
              <div className="flex items-start gap-3 p-1">
                <ShieldAlert className="h-5 w-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-violet-800 dark:text-violet-200">
                  Your account isn&apos;t an advisor yet. Ask a GritSync admin to enable the advisor role for{' '}
                  <span className="font-semibold">{getFullName(user?.first_name, user?.last_name)}</span>. Clients who register with your link will then be assigned to you automatically.
                </div>
              </div>
            </Card>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard
              icon={UserCheck}
              label="Assigned clients"
              value={String(data?.stats.assignedClients ?? 0)}
              tint="violet"
              onClick={isAdvisor ? () => navigate('/advisor/clients') : undefined}
              hint={isAdvisor ? 'Manage clients' : undefined}
            />
            <KpiCard
              icon={ClipboardList}
              label="Active applications"
              value={String(activeApps)}
              tint="blue"
              onClick={isAdvisor ? () => navigate('/advisor/applications') : undefined}
              hint={isAdvisor ? `${apps.length} total` : undefined}
            />
            <KpiCard
              icon={TrendingUp}
              label="Referred volume"
              value={money(data?.stats.totalPaidVolume ?? 0)}
              tint="amber"
              hint={`${data?.stats.totalConverted ?? 0} converted`}
            />
            <KpiCard
              icon={DollarSign}
              label={`Your earnings (${data?.bonusPercent ?? 10}%)`}
              value={money(data?.stats.totalEarnings ?? 0)}
              tint="emerald"
              hint={`${data?.stats.totalReferred ?? 0} referred`}
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT — work areas */}
            <div className="lg:col-span-2 space-y-6">
              {isAdvisor && (
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs attention
                    </h2>
                    {needsAttention.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {needsAttention.length} flagged
                      </span>
                    )}
                  </div>
                  {needsAttention.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <CheckCircle className="h-9 w-9 mx-auto mb-2 text-emerald-500 opacity-70" />
                      <p className="text-sm">
                        {apps.length === 0
                          ? 'No applications yet — add a client or share your link to get started.'
                          : 'Everything looks current. No stalled or pending applications.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {needsAttention.map(({ app, stale }) => (
                        <AppRow
                          key={app.id}
                          app={app}
                          onOpen={() => navigate(`/applications/${app.id}/timeline`)}
                          right={
                            <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              {Number.isFinite(stale) ? `${stale}d stale` : 'pending'}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {isAdvisor && (
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-500" /> Recent applications
                    </h2>
                    <button
                      onClick={() => navigate('/advisor/applications')}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
                    >
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  {recentApps.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <FileText className="h-9 w-9 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No applications across your clients yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {recentApps.map((app) => (
                        <AppRow
                          key={app.id}
                          app={app}
                          onOpen={() => navigate(`/applications/${app.id}/timeline`)}
                          showProgress
                        />
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* People referred — only show if any */}
              {data && data.referred.length > 0 && (
                <Card>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary-500" /> People you referred
                  </h2>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                          <th className="py-2 px-2 sm:px-3">Name</th>
                          <th className="py-2 px-2 sm:px-3">Joined</th>
                          <th className="py-2 px-2 sm:px-3 text-right">Paid</th>
                          <th className="py-2 px-2 sm:px-3 text-right">Your bonus</th>
                          <th className="py-2 px-2 sm:px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.referred.slice(0, 8).map((r) => (
                          <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="py-2.5 px-2 sm:px-3 text-sm text-gray-900 dark:text-gray-100">{getFullName(r.first_name, r.last_name, 'No name')}</td>
                            <td className="py-2.5 px-2 sm:px-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.created_at)}</td>
                            <td className="py-2.5 px-2 sm:px-3 text-sm text-gray-700 dark:text-gray-300 text-right">{money(r.paid_total)}</td>
                            <td className="py-2.5 px-2 sm:px-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 text-right">{money(r.bonus_earned)}</td>
                            <td className="py-2.5 px-2 sm:px-3">
                              {r.converted
                                ? <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5"><CheckCircle className="h-3 w-3" /> Converted</span>
                                : <span className="text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5">Pending</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.referred.length > 8 && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Showing 8 of {data.referred.length}.
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* RIGHT — referral + quick links */}
            <div className="space-y-6">
              {/* Referral link */}
              <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/20 dark:to-gray-800 border-violet-200 dark:border-violet-900/40">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-violet-500" /> Your referral link
                </h2>
                {referralLink ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={referralLink}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <Button size="sm" onClick={() => copy(referralLink, 'Referral link copied')} className="flex items-center gap-1 whitespace-nowrap bg-violet-600 hover:bg-violet-700 text-white">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Code:{' '}
                      <button
                        onClick={() => copy(data!.referralCode!, 'Code copied')}
                        className="font-mono font-semibold text-gray-700 dark:text-gray-200 hover:underline"
                      >
                        {data!.referralCode}
                      </button>
                      {' · '}New sign-ups via this link are assigned to you.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your referral link will appear here once an admin enables your advisor role.
                  </p>
                )}
              </Card>

              {/* Earnings summary */}
              <Card>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" /> Earnings summary
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total earned</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{money(data?.stats.totalEarnings ?? 0)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Referred</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data?.stats.totalReferred ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Converted</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data?.stats.totalConverted ?? 0}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Quick links */}
              {isAdvisor && (
                <Card>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Jump to</h2>
                  <div className="space-y-1">
                    <QuickLink icon={Users} label="Clients" hint={`${data?.stats.assignedClients ?? 0} assigned`} onClick={() => navigate('/advisor/clients')} />
                    <QuickLink icon={ClipboardList} label="Applications" hint={`${activeApps} active`} onClick={() => navigate('/advisor/applications')} />
                    <QuickLink icon={MessageSquare} label="Messages" onClick={() => navigate('/advisor/messages')} />
                    <QuickLink icon={Mail} label="Emails" onClick={() => navigate('/advisor/emails')} />
                  </div>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function AppRow({
  app, onOpen, right, showProgress,
}: {
  app: ClientApp
  onOpen: () => void
  right?: React.ReactNode
  showProgress?: boolean
}) {
  const pct = app.total_steps > 0 ? Math.round((app.completed_steps / app.total_steps) * 100) : 0
  return (
    <div className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
      <ClientAvatar id={app.client.id} first_name={app.client.first_name} last_name={app.client.last_name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {getFullName(app.client.first_name, app.client.last_name, 'No name')}
          </p>
          <span className={cn('text-[10px] font-medium rounded-full px-1.5 py-0.5 capitalize whitespace-nowrap', STATUS_STYLES[app.status] || STATUS_STYLES.pending)}>
            {String(app.status).replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
            {app.application_type || 'Application'}
            {app.grit_app_id ? <span className="font-mono"> · {app.grit_app_id}</span> : null}
          </p>
        </div>
        {showProgress && app.total_steps > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{app.completed_steps}/{app.total_steps}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {right}
        <Button size="sm" variant="outline" className="text-xs" onClick={onOpen} title="Open timeline">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function QuickLink({ icon: Icon, label, hint, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left group"
    >
      <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-violet-500" />
    </button>
  )
}

function KpiCard({
  icon: Icon, label, value, tint, hint, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tint: 'violet' | 'blue' | 'amber' | 'emerald'
  hint?: string
  onClick?: () => void
}) {
  const tintMap: Record<string, string> = {
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  }
  const clickable = !!onClick
  return (
    <Card
      className={cn('p-4 transition-all', clickable && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5')}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {hint && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate">{hint}</p>}
        </div>
        <div className={cn('p-2 rounded-lg flex-shrink-0', tintMap[tint])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  )
}
