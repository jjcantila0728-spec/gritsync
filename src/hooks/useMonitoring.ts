/**
 * React hook for Supabase connection and performance monitoring
 * Provides real-time monitoring data and health checks
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ConnectionHealth, ConnectionStats, PerformanceStats } from '@/lib/monitoring-utils'
import {
  checkConnectionHealth,
  getConnectionStats,
  getPerformanceStats,
  getPerformanceSummary,
  getSystemHealthReport,
} from '@/lib/monitoring-utils'

export interface MonitoringState {
  connectionHealth: ConnectionHealth | null
  connectionStats: ConnectionStats
  performanceStats: PerformanceStats
  loading: boolean
  error: string | null
  lastUpdate: Date | null
}

export interface UseMonitoringOptions {
  /** Enable automatic health checks (default: true) */
  autoCheck?: boolean
  /** Interval for automatic health checks in ms (default: 30000 = 30s) */
  checkInterval?: number
  /** Enable performance tracking (default: true) */
  trackPerformance?: boolean
}

/**
 * Hook for monitoring Supabase connection health and query performance
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { 
 *     connectionHealth, 
 *     performanceStats, 
 *     refreshHealth,
 *     isHealthy 
 *   } = useMonitoring({ autoCheck: true })
 * 
 *   return (
 *     <div>
 *       Status: {connectionHealth?.status}
 *       Latency: {connectionHealth?.latency}ms
 *     </div>
 *   )
 * }
 * ```
 */
export function useMonitoring(options: UseMonitoringOptions = {}) {
  const {
    autoCheck = true,
    checkInterval = 30000, // 30 seconds
    trackPerformance = true,
  } = options

  const [state, setState] = useState<MonitoringState>({
    connectionHealth: null,
    connectionStats: getConnectionStats(),
    performanceStats: getPerformanceStats(),
    loading: false,
    error: null,
    lastUpdate: null,
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const refreshHealth = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const health = await checkConnectionHealth()
      const stats = getConnectionStats()
      const perfStats = trackPerformance ? getPerformanceStats() : state.performanceStats

      setState({
        connectionHealth: health,
        connectionStats: stats,
        performanceStats: perfStats,
        loading: false,
        error: null,
        lastUpdate: new Date(),
      })
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to check connection health',
      }))
    }
  }, [trackPerformance, state.performanceStats])

  const refreshStats = useCallback(() => {
    const stats = getConnectionStats()
    const perfStats = trackPerformance ? getPerformanceStats() : state.performanceStats

    setState(prev => ({
      ...prev,
      connectionStats: stats,
      performanceStats: perfStats,
      lastUpdate: new Date(),
    }))
  }, [trackPerformance, state.performanceStats])

  const getHealthReport = useCallback(async () => {
    try {
      return await getSystemHealthReport()
    } catch (error: any) {
      console.error('Failed to get health report:', error)
      return null
    }
  }, [])

  // Auto-refresh health check
  useEffect(() => {
    if (autoCheck) {
      // Initial check
      refreshHealth()

      // Set up interval
      intervalRef.current = setInterval(() => {
        refreshHealth()
      }, checkInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [autoCheck, checkInterval, refreshHealth])

  // Auto-refresh stats (more frequent, no network call)
  useEffect(() => {
    if (trackPerformance) {
      const statsInterval = setInterval(() => {
        refreshStats()
      }, 5000) // Update stats every 5 seconds

      return () => {
        clearInterval(statsInterval)
      }
    }
  }, [trackPerformance, refreshStats])

  const isHealthy = state.connectionHealth?.status === 'healthy'
  const isDegraded = state.connectionHealth?.status === 'degraded'
  const isUnhealthy = state.connectionHealth?.status === 'unhealthy'

  return {
    // State
    connectionHealth: state.connectionHealth,
    connectionStats: state.connectionStats,
    performanceStats: state.performanceStats,
    loading: state.loading,
    error: state.error,
    lastUpdate: state.lastUpdate,

    // Computed
    isHealthy,
    isDegraded,
    isUnhealthy,
    latency: state.connectionHealth?.latency ?? null,

    // Actions
    refreshHealth,
    refreshStats,
    getHealthReport,
    getPerformanceSummary,
  }
}






