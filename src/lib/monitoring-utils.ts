/**
 * Monitoring utilities - convenience exports for all monitoring functions
 * Provides a single import point for monitoring and diagnostics
 */

export {
  checkConnectionHealth,
  getConnectionStats,
  getLastHealthCheck,
  resetConnectionStats,
  trackSuccessfulQuery,
  trackFailedQuery,
  trackChannelSubscribed,
  trackChannelUnsubscribed,
  getConnectionSummary,
  type ConnectionHealth,
  type ConnectionStats,
} from './connection-monitor'

export {
  trackQueryPerformance,
  getPerformanceStats,
  getSlowQueries,
  getRecentQueries,
  clearPerformanceLog,
  getPerformanceSummary,
  trackQuery,
  type QueryPerformanceEntry,
  type PerformanceStats,
} from './query-performance'

/**
 * Get comprehensive system health report
 * Combines connection health and query performance data
 */
export async function getSystemHealthReport(): Promise<{
  connection: any
  performance: any
  summary: string
}> {
  const { checkConnectionHealth, getConnectionStats, getConnectionSummary } = await import('./connection-monitor')
  const { getPerformanceStats, getPerformanceSummary } = await import('./query-performance')

  const connectionHealth = await checkConnectionHealth()
  const connectionStats = getConnectionStats()
  const performanceStats = getPerformanceStats()

  const summary = `
System Health Report
====================

${getConnectionSummary()}

${getPerformanceSummary()}

Overall Status: ${connectionHealth.status === 'healthy' ? '✅ Healthy' : connectionHealth.status === 'degraded' ? '⚠️ Degraded' : '❌ Unhealthy'}
`

  return {
    connection: {
      health: connectionHealth,
      stats: connectionStats,
    },
    performance: performanceStats,
    summary,
  }
}

/**
 * Log system health report to console
 * Useful for debugging and monitoring
 */
export async function logSystemHealthReport(): Promise<void> {
  const report = await getSystemHealthReport()
  console.log(report.summary)
}






