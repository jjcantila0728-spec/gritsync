import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { formatDate, getFullName, cn } from '@/lib/utils'
import { Link2, Copy, Users, CheckCircle, DollarSign, TrendingUp, RefreshCw, ShieldAlert, MessageSquare, Info, X } from 'lucide-react'

interface ReferredUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  grit_id: string | null
  is_active: boolean
  created_at: string
  application_count: number
  paid_total: number
  converted: boolean
  bonus_earned: number
}

interface ReferralData {
  role: string
  referralCode: string | null
  bonusPercent: number
  stats: { totalReferred: number; totalConverted: number; totalPaidVolume: number; totalEarnings: number; assignedClients: number }
  referred: ReferredUser[]
  assigned: any[]
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

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

export function AffiliatePanel() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showBonusNote, setShowBonusNote] = useState(true)

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      const d = await apiFetch('/api/referrals/me')
      setData(d)
    } catch (err: any) {
      showToast(err.message || 'Failed to load referral data', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const referralLink = data?.referralCode
    ? `${window.location.origin}/register?ref=${data.referralCode}`
    : null

  const copy = async (text: string, label = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(label, 'success')
    } catch {
      showToast('Could not copy — please copy manually', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex"><Sidebar /><main className="flex-1 p-4 md:p-8"><Loading text="Loading affiliate panel..." /></main></div>
      </div>
    )
  }

  const isAffiliate = data?.role === 'affiliate'
  const isPartner = data?.role === 'affiliate' || data?.role === 'advisor'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          {/* Hero — mirrors AdvisorPanel: icon + one-line description, stacks below sm. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Link2 className="h-7 w-7 text-amber-500" /> Welcome back, {user?.first_name || 'there'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Share your link and earn <span className="font-semibold text-amber-700 dark:text-amber-300">{data?.bonusPercent ?? 10}%</span> of every payment from clients you refer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} /> Refresh
              </Button>
            </div>
          </div>

          {!isPartner && (
            <Card className="mb-6 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-start gap-3 p-1">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  Your account isn't an affiliate yet. Ask a GritSync admin to enable the affiliate role for <span className="font-semibold">{getFullName(user?.first_name, user?.last_name)}</span>. You can still preview this panel below.
                </div>
              </div>
            </Card>
          )}

          {/* Referral link */}
          <Card className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary-500" /> Your referral link
            </h2>
            {referralLink ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    readOnly
                    value={referralLink}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-800 dark:text-gray-200"
                  />
                  <Button size="sm" onClick={() => copy(referralLink, 'Referral link copied')} className="flex items-center gap-2 whitespace-nowrap">
                    <Copy className="h-4 w-4" /> Copy link
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Referral code: <button onClick={() => copy(data!.referralCode!, 'Code copied')} className="font-mono font-semibold text-gray-700 dark:text-gray-200 hover:underline">{data!.referralCode}</button>
                  {' · '}Anyone who registers through this link is credited to you.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Your referral link will appear here once an admin enables your {isAffiliate ? 'affiliate' : 'partner'} role.</p>
            )}
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Users} label="Referred users" value={String(data?.stats.totalReferred ?? 0)} accent="blue" />
            <StatCard icon={CheckCircle} label="Converted (paid)" value={String(data?.stats.totalConverted ?? 0)} accent="green" />
            <StatCard icon={TrendingUp} label="Referred volume" value={money(data?.stats.totalPaidVolume ?? 0)} accent="violet" />
            <StatCard icon={DollarSign} label={`Earnings (${data?.bonusPercent ?? 10}%)`} value={money(data?.stats.totalEarnings ?? 0)} accent="amber" />
          </div>

          {/* Bonus-calculation note — dismissible, sits above the table. */}
          {showBonusNote && (
            <Card className="mb-4 border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10">
              <div className="flex items-start gap-3 p-1">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" />
                <p className="flex-1 text-xs text-blue-800 dark:text-blue-200">
                  &quot;Converted&quot; means the referred client has made at least one payment. Bonuses are calculated at {data?.bonusPercent ?? 10}% of their total payments and are subject to verification by GritSync.
                </p>
                <button
                  onClick={() => setShowBonusNote(false)}
                  aria-label="Dismiss note"
                  className="flex-shrink-0 -m-1 p-1.5 rounded-md text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Card>
          )}

          {/* Referred users table */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-500" /> People you referred
            </h2>
            {(!data || data.referred.length === 0) ? (
              <EmptyState
                icon={Users}
                title="No referrals yet"
                description="Share your link to get started."
                className="py-10"
              />
            ) : (
              <>
              {/* Mobile: stacked cards (same data as the table below md). */}
              <div className="md:hidden space-y-3">
                {data.referred.map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{getFullName(r.first_name, r.last_name, 'No name')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Joined {formatDate(r.created_at)} · {r.application_count} app{r.application_count === 1 ? '' : 's'}</p>
                      </div>
                      {r.converted
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 flex-shrink-0"><CheckCircle className="h-3 w-3" /> Converted</span>
                        : <span className="text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:border-gray-600 px-2 py-0.5 flex-shrink-0">Pending</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Paid <span className="text-gray-900 dark:text-gray-100 tabular-nums">{money(r.paid_total)}</span>
                        {' · '}Bonus <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{money(r.bonus_earned)}</span>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs h-9" onClick={() => navigate('/messages', { state: { userId: r.id } })} aria-label="Message" title="Message">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table — hidden below md (use the card list above). */}
              <div className="hidden md:block overflow-x-auto -mx-6 px-6">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <th className="py-3 px-2 sm:px-4">Name</th>
                      <th className="py-3 px-2 sm:px-4">Email</th>
                      <th className="py-3 px-2 sm:px-4">Joined</th>
                      <th className="py-3 px-2 sm:px-4">Apps</th>
                      <th className="py-3 px-2 sm:px-4 text-right">Paid</th>
                      <th className="py-3 px-2 sm:px-4 text-right">Your bonus</th>
                      <th className="py-3 px-2 sm:px-4">Status</th>
                      <th className="py-3 px-2 sm:px-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referred.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-900 dark:text-gray-100">{getFullName(r.first_name, r.last_name, 'No name')}</td>
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{r.email}</td>
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.created_at)}</td>
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-600 dark:text-gray-400">{r.application_count}</td>
                        <td className="py-3 px-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 text-right">{money(r.paid_total)}</td>
                        <td className="py-3 px-2 sm:px-4 text-sm font-semibold text-amber-600 dark:text-amber-400 text-right">{money(r.bonus_earned)}</td>
                        <td className="py-3 px-2 sm:px-4">
                          {r.converted
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 px-2 py-0.5"><CheckCircle className="h-3 w-3" /> Converted</span>
                            : <span className="text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:border-gray-600 px-2 py-0.5">Pending</span>}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate('/messages', { state: { userId: r.id } })} title="Message">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </Card>
        </main>
      </div>
    </div>
  )
}
