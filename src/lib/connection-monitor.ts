/**
 * Connection monitoring utility
 * Tracks connection health and provides diagnostics
 * NOTE: This feature is currently stubbed pending full migration
 */

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number | null
  lastCheck: Date
  error: string | null
}

export interface ConnectionStats {
  activeChannels: number
  lastConnectionTime: Date | null
  connectionErrors: number
  successfulQueries: number
  failedQueries: number
}

// Internal tracking
let connectionStats: ConnectionStats = {
  activeChannels: 0,
  lastConnectionTime: null,
  connectionErrors: 0,
  successfulQueries: 0,
  failedQueries: 0,
}

let lastHealthCheck: ConnectionHealth | null = null

/**
 * Check connection health (stubbed)
 */
export async function checkConnectionHealth(_timeoutMs: number = 5000): Promise<ConnectionHealth> {
  const health: ConnectionHealth = {
    status: 'healthy',
    latency: 50,
    lastCheck: new Date(),
    error: null,
  }
  lastHealthCheck = health
  connectionStats.lastConnectionTime = new Date()
  connectionStats.successfulQueries++
  return health
}

/**
 * Get the last cached health check result
 */
export function getLastHealthCheck(): ConnectionHealth | null {
  return lastHealthCheck
}

/**
 * Get current connection statistics
 */
export function getConnectionStats(): ConnectionStats {
  return { ...connectionStats }
}

/**
 * Reset connection statistics
 */
export function resetConnectionStats(): void {
  connectionStats = {
    activeChannels: 0,
    lastConnectionTime: null,
    connectionErrors: 0,
    successfulQueries: 0,
    failedQueries: 0,
  }
}

/**
 * Track a successful query
 */
export function trackSuccessfulQuery(): void {
  connectionStats.successfulQueries++
}

/**
 * Track a failed query
 */
export function trackFailedQuery(): void {
  connectionStats.failedQueries++
  connectionStats.connectionErrors++
}

/**
 * Track channel subscribed
 */
export function trackChannelSubscribed(): void {
  connectionStats.activeChannels++
}

/**
 * Track channel unsubscribed
 */
export function trackChannelUnsubscribed(): void {
  connectionStats.activeChannels = Math.max(0, connectionStats.activeChannels - 1)
}

/**
 * Get a connection health summary string
 */
export function getConnectionSummary(): string {
  const stats = getConnectionStats()
  const health = getLastHealthCheck()
  
  return `Connection Health: ${health?.status || 'unknown'}
Latency: ${health?.latency ? `${health.latency.toFixed(0)}ms` : 'N/A'}
Last Check: ${health?.lastCheck?.toISOString() || 'Never'}
Total Queries: ${stats.successfulQueries + stats.failedQueries}
Success Rate: ${stats.successfulQueries + stats.failedQueries > 0 
  ? ((stats.successfulQueries / (stats.successfulQueries + stats.failedQueries)) * 100).toFixed(1) 
  : 'N/A'}%`
}
