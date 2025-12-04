import { useState, useEffect } from 'react'
import { Server, Activity, CheckCircle, Clock, AlertCircle, Users, FileText, DollarSign, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adminAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

export function SystemSettings() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalApplications: 0,
    revenue: 0,
    totalQuotations: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    rejectedApplications: 0,
    pendingQuotations: 0,
    paidQuotations: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const statsData = await adminAPI.getStats().catch(() => ({ 
        totalUsers: 0, 
        totalApplications: 0, 
        revenue: 0, 
        totalQuotations: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0,
        pendingQuotations: 0,
        paidQuotations: 0,
      }))
      
      setStats({
        totalUsers: statsData.totalClients || statsData.totalUsers || 0,
        totalApplications: statsData.totalApplications || 0,
        revenue: statsData.revenue || 0,
        totalQuotations: statsData.totalQuotations || 0,
        pendingApplications: statsData.pendingApplications || statsData.pending || 0,
        approvedApplications: statsData.approvedApplications || statsData.approved || 0,
        rejectedApplications: statsData.rejectedApplications || 0,
        pendingQuotations: statsData.pendingQuotations || 0,
        paidQuotations: statsData.paidQuotations || 0,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportSettings = async () => {
    try {
      const settingsData = await adminAPI.getSettings()
      const exportData = {
        ...settingsData,
        stripeSecretKey: settingsData.stripeSecretKey?.startsWith('***') ? '[MASKED]' : '[REDACTED]',
        stripeWebhookSecret: settingsData.stripeWebhookSecret?.startsWith('***') ? '[MASKED]' : '[REDACTED]',
        exportedAt: new Date().toISOString(),
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gritsync-settings-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting settings:', error)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            System Information & Statistics
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportSettings}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Settings
          </Button>
          <Button
            variant="outline"
            onClick={fetchStats}
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* System Info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-xs text-gray-600 dark:text-gray-400">Database Type</span>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">Supabase (PostgreSQL)</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-xs text-gray-600 dark:text-gray-400">Status</span>
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Connected
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-xs text-gray-600 dark:text-gray-400">Environment</span>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-xs text-gray-600 dark:text-gray-400">Version</span>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">1.0.0</p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Users</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.totalUsers}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Applications</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.totalApplications}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Revenue</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.revenue)}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Pending</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.pendingApplications}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Approved</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.approvedApplications}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Rejected</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.rejectedApplications}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Quotations</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.totalQuotations}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Paid</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.paidQuotations}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

