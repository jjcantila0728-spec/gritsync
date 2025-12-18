/**
 * Email Analytics Tab Component
 * Displays comprehensive email analytics with charts and statistics
 */

import { useState, useEffect } from 'react'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react'
import { emailLogsAPI, EmailStats, EmailAnalytics } from '@/lib/email-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface EmailAnalyticsTabProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

const COLORS = ['#dc2626', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export function EmailAnalyticsTab({ showToast }: EmailAnalyticsTabProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [dailyData, setDailyData] = useState<any[]>([])
  const [typeData, setTypeData] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = subDays(new Date(), days)
      
      // Get overall stats
      const overallStats = await emailLogsAPI.getStats({
        startDate: startDate.toISOString(),
      })
      setStats(overallStats)

      // Get analytics data
      const analytics = await emailLogsAPI.getAnalytics(days)
      
      // Process daily data
      const dailyMap = new Map<string, { date: string; sent: number; delivered: number; failed: number }>()
      
      analytics.forEach(item => {
        const date = item.date
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, sent: 0, delivered: 0, failed: 0 })
        }
        const dayData = dailyMap.get(date)!
        dayData.sent += item.sent_count || 0
        dayData.delivered += item.delivered_count || 0
        dayData.failed += item.failed_count || 0
      })

      // Fill in missing dates
      const dailyArray: any[] = []
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - i - 1), 'yyyy-MM-dd')
        dailyArray.push(dailyMap.get(date) || { date, sent: 0, delivered: 0, failed: 0 })
      }
      setDailyData(dailyArray)

      // Process type data
      const typeMap = new Map<string, number>()
      analytics.forEach(item => {
        const type = item.email_type || 'unknown'
        typeMap.set(type, (typeMap.get(type) || 0) + (item.count || 0))
      })
      setTypeData(Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })))

      // Process status data
      const statusMap = new Map<string, number>()
      analytics.forEach(item => {
        const status = item.status || 'unknown'
        statusMap.set(status, (statusMap.get(status) || 0) + (item.count || 0))
      })
      setStatusData(Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })))

    } catch (error: any) {
      console.error('Error loading analytics:', error)
      showToast('Failed to load analytics. Email logs table may not exist yet.', 'error')
      // Set empty stats so the component still renders
      setStats({
        total: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        failureRate: 0,
        avgSendTime: 0,
      })
      setDailyData([])
      setTypeData([])
      setStatusData([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d')
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="py-12">
        <Loading text="Loading analytics..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email Analytics</h3>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={loadAnalytics}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div className="text-xs text-gray-500 dark:text-gray-400">Delivered</div>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stats.deliveryRate.toFixed(1)}% rate
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stats.failureRate.toFixed(1)}% rate
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg Time</div>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.avgSendTime.toFixed(1)}s
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div className="text-xs text-gray-500 dark:text-gray-400">Sent</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.sent}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-yellow-500" />
              <div className="text-xs text-gray-500 dark:text-gray-400">Pending</div>
            </div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Email Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Daily Email Trends
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                className="text-xs"
                stroke="#6b7280"
              />
              <YAxis className="text-xs" stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                labelFormatter={(label) => formatDate(label)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sent" 
                stroke="#dc2626" 
                strokeWidth={2}
                name="Sent"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="delivered" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Delivered"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="failed" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Failed"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Email Types Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Email Types Distribution
          </h4>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Status Distribution
          </h4>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="name" className="text-xs" stroke="#6b7280" />
                <YAxis className="text-xs" stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" fill="#dc2626" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Daily Volume Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Daily Email Volume
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                className="text-xs"
                stroke="#6b7280"
              />
              <YAxis className="text-xs" stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                labelFormatter={(label) => formatDate(label)}
              />
              <Legend />
              <Bar dataKey="sent" fill="#dc2626" name="Sent" radius={[8, 8, 0, 0]} />
              <Bar dataKey="delivered" fill="#10b981" name="Delivered" radius={[8, 8, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}



