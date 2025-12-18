/**
 * Query performance monitoring utility
 * Tracks query execution times and identifies slow queries
 */

export interface QueryPerformanceEntry {
  operation: string
  duration: number
  timestamp: Date
  success: boolean
  error?: string
  context?: Record<string, any>
}

// Store recent query performance data (last 100 queries)
const performanceLog: QueryPerformanceEntry[] = []
const MAX_LOG_SIZE = 100

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  FAST: 100,      // < 100ms is considered fast
  ACCEPTABLE: 500, // < 500ms is acceptable
  SLOW: 1000,     // > 1000ms is slow
  VERY_SLOW: 3000 // > 3000ms is very slow
}

/**
 * Track a query performance entry
 */
export function trackQueryPerformance(
  operation: string,
  duration: number,
  success: boolean,
  error?: string,
  context?: Record<string, any>
): void {
  const entry: QueryPerformanceEntry = {
    operation,
    duration,
    timestamp: new Date(),
    success,
    error,
    context,
  }

  // Add to log
  performanceLog.push(entry)

  // Keep only the last MAX_LOG_SIZE entries
  if (performanceLog.length > MAX_LOG_SIZE) {
    performanceLog.shift()
  }

  // Log warnings for slow queries
  if (duration > PERFORMANCE_THRESHOLDS.VERY_SLOW) {
    console.error(`⚠️ VERY SLOW QUERY (${duration.toFixed(0)}ms): ${operation}`, context)
  } else if (duration > PERFORMANCE_THRESHOLDS.SLOW) {
    console.warn(`⚠️ SLOW QUERY (${duration.toFixed(0)}ms): ${operation}`, context)
  }
}

/**
 * Get performance statistics
 */
export interface PerformanceStats {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  slowQueries: number // > 1000ms
  verySlowQueries: number // > 3000ms
  operations: Record<string, {
    count: number
    averageDuration: number
    maxDuration: number
    slowCount: number
  }>
}

export function getPerformanceStats(): PerformanceStats {
  if (performanceLog.length === 0) {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      slowQueries: 0,
      verySlowQueries: 0,
      operations: {},
    }
  }

  const successful = performanceLog.filter(q => q.success)
  const failed = performanceLog.filter(q => !q.success)
  const slow = performanceLog.filter(q => q.duration > PERFORMANCE_THRESHOLDS.SLOW)
  const verySlow = performanceLog.filter(q => q.duration > PERFORMANCE_THRESHOLDS.VERY_SLOW)

  const durations = performanceLog.map(q => q.duration)
  const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length

  // Group by operation
  const operations: Record<string, {
    count: number
    totalDuration: number
    maxDuration: number
    slowCount: number
  }> = {}

  performanceLog.forEach(entry => {
    if (!operations[entry.operation]) {
      operations[entry.operation] = {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        slowCount: 0,
      }
    }

    const op = operations[entry.operation]
    op.count++
    op.totalDuration += entry.duration
    op.maxDuration = Math.max(op.maxDuration, entry.duration)
    if (entry.duration > PERFORMANCE_THRESHOLDS.SLOW) {
      op.slowCount++
    }
  })

  // Convert to final format
  const operationStats: Record<string, {
    count: number
    averageDuration: number
    maxDuration: number
    slowCount: number
  }> = {}

  Object.entries(operations).forEach(([op, stats]) => {
    operationStats[op] = {
      count: stats.count,
      averageDuration: stats.totalDuration / stats.count,
      maxDuration: stats.maxDuration,
      slowCount: stats.slowCount,
    }
  })

  return {
    totalQueries: performanceLog.length,
    successfulQueries: successful.length,
    failedQueries: failed.length,
    averageDuration,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    slowQueries: slow.length,
    verySlowQueries: verySlow.length,
    operations: operationStats,
  }
}

/**
 * Get slow queries (above threshold)
 */
export function getSlowQueries(thresholdMs: number = PERFORMANCE_THRESHOLDS.SLOW): QueryPerformanceEntry[] {
  return performanceLog.filter(q => q.duration > thresholdMs)
}

/**
 * Get recent queries
 */
export function getRecentQueries(limit: number = 20): QueryPerformanceEntry[] {
  return performanceLog.slice(-limit).reverse()
}

/**
 * Clear performance log
 */
export function clearPerformanceLog(): void {
  performanceLog.length = 0
}

/**
 * Get performance summary as string (for logging)
 */
export function getPerformanceSummary(): string {
  const stats = getPerformanceStats()

  if (stats.totalQueries === 0) {
    return 'No query performance data available'
  }

  const successRate = ((stats.successfulQueries / stats.totalQueries) * 100).toFixed(1)
  const slowQueryRate = ((stats.slowQueries / stats.totalQueries) * 100).toFixed(1)

  let summary = `Query Performance Summary:
  Total Queries: ${stats.totalQueries}
  Success Rate: ${successRate}% (${stats.successfulQueries} success, ${stats.failedQueries} failed)
  Average Duration: ${stats.averageDuration.toFixed(0)}ms
  Min/Max: ${stats.minDuration.toFixed(0)}ms / ${stats.maxDuration.toFixed(0)}ms
  Slow Queries (>1s): ${stats.slowQueries} (${slowQueryRate}%)
  Very Slow Queries (>3s): ${stats.verySlowQueries}`

  // Add top 5 slowest operations
  const sortedOps = Object.entries(stats.operations)
    .sort((a, b) => b[1].averageDuration - a[1].averageDuration)
    .slice(0, 5)

  if (sortedOps.length > 0) {
    summary += '\n\nTop 5 Slowest Operations:'
    sortedOps.forEach(([op, opStats], index) => {
      summary += `\n  ${index + 1}. ${op}: ${opStats.averageDuration.toFixed(0)}ms avg (${opStats.count} queries, ${opStats.slowCount} slow)`
    })
  }

  return summary
}

/**
 * Wrap a query function with performance tracking
 */
export async function trackQuery<T>(
  operation: string,
  queryFn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const startTime = performance.now()
  let success = true
  let error: string | undefined

  try {
    const result = await queryFn()
    return result
  } catch (err: any) {
    success = false
    error = err?.message || 'Unknown error'
    throw err
  } finally {
    const duration = performance.now() - startTime
    trackQueryPerformance(operation, duration, success, error, context)
  }
}






