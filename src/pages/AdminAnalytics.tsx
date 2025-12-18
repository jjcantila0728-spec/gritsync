/**
 * Admin Analytics Dashboard
 * Comprehensive analytics and reporting dashboard
 */

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { SEO } from '@/components/SEO'
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
  Calendar,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { analyticsAPI, ApplicationAnalytics, FinancialAnalytics, UserAnalytics, DocumentAnalytics } from '@/lib/analytics-api'
import { format, subDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919', '#00D4FF', '#FF6B9D']

export function AdminAnalytics() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()

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
              {/* Applications */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Applications</span>
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{applicationData?.total || 0}</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Approval Rate:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {applicationData?.approval_rate || 0}%
                  </span>
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</span>
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  ${(financialData?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {financialData?.total_transactions || 0}
                  </span>
                </div>
              </div>

              {/* Users */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</span>
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{userData?.total_users || 0}</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Active:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {userData?.active_users || 0}
                  </span>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Documents</span>
                  <FileText className="h-5 w-5 text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{documentData?.total_documents || 0}</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Approval Rate:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {documentData?.approval_rate || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Application Trends */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary-500" />
                  Application Trends
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={applicationChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis dataKey="date" stroke="#6b7280" className="dark:stroke-gray-400" />
                    <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Area type="monotone" dataKey="Applications" stroke="#0088FE" fill="#0088FE" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Application Status Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary-500" />
                  Application Status
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={applicationStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {applicationStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Trends */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Revenue Trends
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={financialChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis dataKey="date" stroke="#6b7280" className="dark:stroke-gray-400" />
                    <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="Revenue" stroke="#00C49F" strokeWidth={2} />
                    <Line type="monotone" dataKey="Transactions" stroke="#0088FE" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Payment Types */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary-500" />
                  Revenue by Payment Type
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={paymentTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis dataKey="name" stroke="#6b7280" className="dark:stroke-gray-400" />
                    <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Bar dataKey="value" fill="#8884d8">
                      {paymentTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* User Growth */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  User Growth
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={userChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis dataKey="date" stroke="#6b7280" className="dark:stroke-gray-400" />
                    <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Area type="monotone" dataKey="New Users" stroke="#AF19FF" fill="#AF19FF" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Document Status */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  Document Status
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={documentStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {documentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Application Processing</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg Processing Time</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {applicationData?.avg_processing_days?.toFixed(1) || 0} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rejection Rate</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
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
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      ${(financialData?.avg_transaction_value || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Outstanding</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
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
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {documentData?.avg_processing_days?.toFixed(1) || 0} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rejection Rate</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
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



