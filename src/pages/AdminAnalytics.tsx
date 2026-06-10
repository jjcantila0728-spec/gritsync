/**
 * Admin Analytics Dashboard
 * Comprehensive analytics and reporting dashboard
 */

import { useState, useEffect, useMemo, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { StatCard } from '@/components/ui/StatCard'
import { SEO } from '@/components/SEO'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart,
  LineChart,
  PieChart,
  Pie,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
} from 'recharts'
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react'
import { analyticsAPI, ApplicationAnalytics, FinancialAnalytics, UserAnalytics, DocumentAnalytics } from '@/lib/analytics-api'
import { format, subDays, parseISO } from 'date-fns'

// Single semantic chart palette used by every chart on this page.
// Order is intentional: brand primary (red) first, then blue, emerald,
// amber, violet, cyan, rose, gray for additional series/segments.
const CHART_PALETTE = [
  '#dc2626', // primary red (matches tailwind primary-600)
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#6b7280', // gray
]

// Local wrapper so every chart shares the same padding, border, title and
// subtitle treatment. `primary` bumps the title size for the lead chart.
function ChartCard({
  title,
  subtitle,
  icon: Icon,
  primary = false,
  className,
  children,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  primary?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6',
        className
      )}
    >
      <div className="mb-4">
        <h3
          className={cn(
            'font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2',
            primary ? 'text-lg' : 'text-base'
          )}
        >
          {Icon && <Icon className={cn(primary ? 'h-5 w-5' : 'h-4 w-4', 'text-primary-500')} />}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function AdminAnalytics() {
  const { isAdmin } = useAuth()
  const { theme } = useTheme()
  const { showToast } = useToast()

  // Recharts tooltips can't use Tailwind's dark: variants, so derive concrete
  // colors from ThemeContext (which toggles the `dark` class on <html>).
  const isDark = theme === 'dark'
  const tooltipProps = {
    contentStyle: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff', // gray-800 / white
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, // gray-700 / gray-200
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    labelStyle: { color: isDark ? '#f9fafb' : '#111827', fontWeight: 600 }, // gray-50 / gray-900
    itemStyle: { color: isDark ? '#d1d5db' : '#4b5563' }, // gray-300 / gray-600
  }

  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(30) // days
  const [applicationData, setApplicationData] = useState<ApplicationAnalytics | null>(null)
  const [financialData, setFinancialData] = useState<FinancialAnalytics | null>(null)
  const [userData, setUserData] = useState<UserAnalytics | null>(null)
  const [documentData, setDocumentData] = useState<DocumentAnalytics | null>(null)

  useEffect(() => {
    if (isAdmin()) {
      loadAllAnalytics()
    }
  }, [isAdmin, dateRange])

  const loadAllAnalytics = async () => {
    setLoading(true)
    try {
      const startDate = subDays(new Date(), dateRange).toISOString()
      const endDate = new Date().toISOString()

      const [appData, finData, usrData, docData] = await Promise.all([
        analyticsAPI.getApplicationAnalytics({ startDate, endDate }),
        analyticsAPI.getFinancialAnalytics({ startDate, endDate }),
        analyticsAPI.getUserAnalytics({ startDate, endDate }),
        analyticsAPI.getDocumentAnalytics({ startDate, endDate }),
      ])

      setApplicationData(appData)
      setFinancialData(finData)
      setUserData(usrData)
      setDocumentData(docData)
    } catch (error: any) {
      console.error('Error loading analytics:', error)
      showToast('Failed to load analytics data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applicationChartData = useMemo(() => {
    if (!applicationData?.daily_trends) return []
    return applicationData.daily_trends.map(item => ({
      date: format(parseISO(item.date), 'MMM d'),
      Applications: item.count,
    }))
  }, [applicationData])

  const applicationStatusData = useMemo(() => {
    if (!applicationData?.by_status) return []
    return Object.entries(applicationData.by_status).map(([name, value]) => ({ name, value }))
  }, [applicationData])

  const financialChartData = useMemo(() => {
    if (!financialData?.daily_revenue) return []
    return financialData.daily_revenue.map(item => ({
      date: format(parseISO(item.date), 'MMM d'),
      Revenue: item.revenue,
      Transactions: item.transactions,
    }))
  }, [financialData])

  const paymentTypeData = useMemo(() => {
    if (!financialData?.by_payment_type) return []
    return Object.entries(financialData.by_payment_type).map(([name, data]) => ({
      name,
      value: data.total,
      count: data.count,
    }))
  }, [financialData])

  const userChartData = useMemo(() => {
    if (!userData?.new_users_daily) return []
    return userData.new_users_daily.map(item => ({
      date: format(parseISO(item.date), 'MMM d'),
      'New Users': item.count,
    }))
  }, [userData])

  const documentStatusData = useMemo(() => {
    if (!documentData?.by_status) return []
    return Object.entries(documentData.by_status).map(([name, value]) => ({ name, value }))
  }, [documentData])

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          You do not have permission to view this page.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SEO
        title="Analytics Dashboard - GritSync Admin"
        description="Comprehensive analytics and reporting dashboard for GritSync"
      />

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BarChart3 className="h-8 w-8" />
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Comprehensive insights into your business operations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={365}>Last Year</option>
              </select>
              <button
                onClick={loadAllAnalytics}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12">
            <Loading text="Loading analytics..." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Applications"
                value={applicationData?.total || 0}
                icon={FileText}
                accent="primary"
                sub={`Approval rate ${applicationData?.approval_rate || 0}%`}
              />
              <StatCard
                label="Total Revenue"
                value={`$${(financialData?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={DollarSign}
                accent="green"
                sub={`${financialData?.total_transactions || 0} transactions`}
              />
              <StatCard
                label="Total Users"
                value={userData?.total_users || 0}
                icon={Users}
                accent="violet"
                sub={`${userData?.active_users || 0} active`}
              />
              <StatCard
                label="Total Documents"
                value={documentData?.total_documents || 0}
                icon={FileText}
                accent="amber"
                sub={`Approval rate ${documentData?.approval_rate || 0}%`}
              />
            </div>

            {/* Primary chart — full width for visual primacy */}
            <ChartCard
              title="Application Trends"
              subtitle={`Daily applications over the last ${dateRange} days`}
              icon={TrendingUp}
              primary
            >
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={applicationChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDark ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} />
                  <Tooltip {...tooltipProps} />
                  <Area type="monotone" dataKey="Applications" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.25} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Secondary charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Application Status Distribution */}
              <ChartCard title="Application Status" subtitle="Distribution by current status" icon={PieChartIcon}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={applicationStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill={CHART_PALETTE[0]}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {applicationStatusData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Revenue Trends */}
              <ChartCard title="Revenue Trends" subtitle="Daily revenue and transaction counts" icon={DollarSign}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={financialChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis dataKey="date" stroke={isDark ? '#9ca3af' : '#6b7280'} />
                    <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} />
                    <Tooltip {...tooltipProps} />
                    <Legend />
                    <Line type="monotone" dataKey="Revenue" stroke={CHART_PALETTE[2]} strokeWidth={2} />
                    <Line type="monotone" dataKey="Transactions" stroke={CHART_PALETTE[1]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Payment Types */}
              <ChartCard title="Revenue by Payment Type" subtitle="Totals per payment type" icon={BarChart3}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={paymentTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis dataKey="name" stroke={isDark ? '#9ca3af' : '#6b7280'} />
                    <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="value" fill={CHART_PALETTE[0]}>
                      {paymentTypeData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* User Growth */}
              <ChartCard title="User Growth" subtitle="New user signups per day" icon={Users}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={userChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis dataKey="date" stroke={isDark ? '#9ca3af' : '#6b7280'} />
                    <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} />
                    <Tooltip {...tooltipProps} />
                    <Area type="monotone" dataKey="New Users" stroke={CHART_PALETTE[4]} fill={CHART_PALETTE[4]} fillOpacity={0.25} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Document Status */}
              <ChartCard title="Document Status" subtitle="Distribution by review status" icon={FileText}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={documentStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill={CHART_PALETTE[0]}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {documentStatusData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Application Processing</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg Processing Time</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {applicationData?.avg_processing_days?.toFixed(1) || 0} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rejection Rate</span>
                    <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {applicationData?.rejection_rate || 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Financial Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg Transaction</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      ${(financialData?.avg_transaction_value || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Outstanding</span>
                    <span className="font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                      ${(financialData?.outstanding_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Document Processing</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg Processing Time</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {documentData?.avg_processing_days?.toFixed(1) || 0} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rejection Rate</span>
                    <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {documentData?.rejection_rate || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



