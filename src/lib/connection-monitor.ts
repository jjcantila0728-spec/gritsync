/**
 * Connection monitoring utility for Supabase
 * Tracks connection health and provides diagnostics
 */

import { db } from './api-client'

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
 * Check connection health by performing a lightweight query
 * 
 * @param timeoutMs - Maximum time to wait for response (default: 5000ms)
 * @returns ConnectionHealth status
 */
export async function checkConnectionHealth(timeoutMs: number = 5000): Promise<ConnectionHealth> {
  const startTime = performance.now()
  
  try {
    // Perform a lightweight query to check connection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const { error } = await db
      .from('users')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal)

    clearTimeout(timeoutId)
    
    const latency = performance.now() - startTime

    if (error) {
      connectionStats.connectionErrors++
      connectionStats.failedQueries++
      
      const status: ConnectionHealth = {
        status: 'unhealthy',
        latency,
        lastCheck: new Date(),
        error: error.message,
      }
      
      lastHealthCheck = status
      return status
    }

    connectionStats.successfulQueries++
    connectionStats.lastConnectionTime = new Date()

    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    // Consider degraded if latency is high
    if (latency > 1000) {
      healthStatus = 'degraded'
    }
    
    // Consider unhealthy if latency is very high
    if (latency > 3000) {
      healthStatus = 'unhealthy'
    }

    const status: ConnectionHealth = {
      status: healthStatus,
      latency,
      lastCheck: new Date(),
      error: null,
    }

    lastHealthCheck = status
    return status
  } catch (error: any) {
    connectionStats.connectionErrors++
    connectionStats.failedQueries++
    
    const latency = performance.now() - startTime
    const errorMessage = error?.message || 'Unknown connection error'

    const status: ConnectionHealth = {
      status: 'unhealthy',
      latency,
      lastCheck: new Date(),
      error: errorMessage,
    }

    lastHealthCheck = status
    return status
  }
}

/**
 * Get current connection statistics
 */
export function getConnectionStats(): ConnectionStats {
  return { ...connectionStats }
}

/**
 * Get last health check result
 */
export function getLastHealthCheck(): ConnectionHealth | null {
  return lastHealthCheck ? { ...lastHealthCheck } : null
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
  lastHealthCheck = null
}

/**
 * Track successful query
 */
export function trackSuccessfulQuery(): void {
  connectionStats.successfulQueries++
  connectionStats.lastConnectionTime = new Date()
}

/**
 * Track failed query
 */
export function trackFailedQuery(): void {
  connectionStats.failedQueries++
  connectionStats.connectionErrors++
}

/**
 * Track channel subscription
 */
export function trackChannelSubscribed(): void {
  connectionStats.activeChannels++
}

/**
 * Track channel unsubscription
 */
export function trackChannelUnsubscribed(): void {
  connectionStats.activeChannels = Math.max(0, connectionStats.activeChannels - 1)
}

/**
 * Get connection health summary for logging/monitoring
 */
export function getConnectionSummary(): string {
  const stats = getConnectionStats()
  const health = getLastHealthCheck()
  
  const totalQueries = stats.successfulQueries + stats.failedQueries
  const successRate = totalQueries > 0 
    ? ((stats.successfulQueries / totalQueries) * 100).toFixed(1)
    : '0.0'

  return `Connection Summary:
  Status: ${health?.status || 'unknown'}
  Latency: ${health?.latency?.toFixed(0) || 'N/A'}ms
  Active Channels: ${stats.activeChannels}
  Queries: ${stats.successfulQueries} success, ${stats.failedQueries} failed (${successRate}% success rate)
  Last Connection: ${stats.lastConnectionTime?.toISOString() || 'Never'}`
}






