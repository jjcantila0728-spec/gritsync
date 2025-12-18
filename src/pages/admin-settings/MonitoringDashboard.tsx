/**
 * Admin Monitoring Dashboard
 * Displays real-time connection health, query performance, and system statistics
 */

import { useState } from 'react'
import { useMonitoring } from '@/hooks/useMonitoring'
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Loading } from '@/components/ui/Loading'
import { 
  Activity, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database,
  Zap,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function MonitoringDashboard() {
  const {
    connectionHealth,
    connectionStats,
    performanceStats,
    loading,
    error,
    lastUpdate,
    isHealthy,
    isDegraded,
    isUnhealthy,
    latency,
    refreshHealth,
    refreshStats,
    getHealthReport,
    getPerformanceSummary,
  } = useMonitoring({ autoCheck: true, checkInterval: 30000 })

  const { session, isValid: sessionValid, isExpired: sessionExpired } = useSession()
  const [showFullReport, setShowFullReport] = useState(false)
  const [reportText, setReportText] = useState<string>('')

  const handleGetFullReport = async () => {
    const report = await getHealthReport()
    if (report) {
      setReportText(report.summary)
      setShowFullReport(true)
    }
  }

  const getStatusColor = () => {
    if (isHealthy) return 'text-green-600 dark:text-green-400'
    if (isDegraded) return 'text-yellow-600 dark:text-yellow-400'
    if (isUnhealthy) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getStatusIcon = () => {
    if (isHealthy) return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    if (isDegraded) return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    if (isUnhealthy) return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
    return <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
  }

  const getStatusText = () => {
    if (isHealthy) return 'Healthy'
    if (isDegraded) return 'Degraded'
    if (isUnhealthy) return 'Unhealthy'
    return 'Unknown'
  }

  const successRate = connectionStats.successfulQueries + connectionStats.failedQueries > 0
    ? ((connectionStats.successfulQueries / (connectionStats.successfulQueries + connectionStats.failedQueries)) * 100).toFixed(1)
    : '0.0'

  const slowQueryRate = performanceStats.totalQueries > 0
    ? ((performanceStats.slowQueries / performanceStats.totalQueries) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="p-3 sm:p-4 md:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">System Monitoring</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time connection health and performance metrics
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshHealth}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetFullReport}
            className="w-full sm:w-auto"
          >
            Full Report
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Error: {error}</span>
          </div>
        </Card>
      )}

      {/* Connection Health Status */}
      <Card className="p-3 sm:p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="h-4 w-4" />
            Connection Health
          </h3>
          <div className={cn("flex items-center gap-2 font-medium", getStatusColor())}>
            {getStatusIcon()}
            {getStatusText()}
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : connectionHealth ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Latency</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {latency ? `${latency.toFixed(0)}ms` : 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Channels</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectionStats.activeChannels}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Check</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Never'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No connection data available</p>
        )}
      </Card>

      {/* Query Performance */}
      <Card className="p-3 sm:p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Query Performance
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshStats}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {performanceStats.totalQueries > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Queries</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {performanceStats.totalQueries}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {successRate}%
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {performanceStats.averageDuration.toFixed(0)}ms
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Slow Queries</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {performanceStats.slowQueries} ({slowQueryRate}%)
                </p>
              </div>
            </div>

            {performanceStats.verySlowQueries > 0 && (
              <div className="p-2.5 sm:p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">
                    {performanceStats.verySlowQueries} very slow query(ies) detected (&gt;3s)
                  </span>
                </div>
              </div>
            )}

            {/* Top Slow Operations */}
            {Object.keys(performanceStats.operations).length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Top Slow Operations
                </h4>
                <div className="space-y-2">
                  {Object.entries(performanceStats.operations)
                    .sort((a, b) => b[1].averageDuration - a[1].averageDuration)
                    .slice(0, 5)
                    .map(([operation, stats]) => (
                      <div
                        key={operation}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {operation}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {stats.count} queries, {stats.slowCount} slow
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {stats.averageDuration.toFixed(0)}ms
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            max: {stats.maxDuration.toFixed(0)}ms
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No query performance data available</p>
        )}
      </Card>

      {/* Session Status */}
      <Card className="p-3 sm:p-4 md:p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4" />
          Session Status
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Session Valid</span>
            <span className={cn(
              "text-sm font-medium",
              sessionValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {sessionValid ? 'Yes' : 'No'}
            </span>
          </div>
          {session && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">User ID</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {session.user?.id?.substring(0, 8)}...
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Expires</span>
                <span className={cn(
                  "text-sm font-medium",
                  sessionExpired ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
                )}>
                  {session.expires_at 
                    ? new Date(session.expires_at * 1000).toLocaleString()
                    : 'Unknown'}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Full Report Modal */}
      {showFullReport && (
        <Card className="p-3 sm:p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Full System Health Report
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullReport(false)}
            >
              Close
            </Button>
          </div>
          <pre className="text-xs font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-4 rounded overflow-auto max-h-96">
            {reportText || 'Loading report...'}
          </pre>
        </Card>
      )}
    </div>
  )
}


