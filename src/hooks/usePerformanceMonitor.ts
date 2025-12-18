/**
 * Performance monitoring hook
 * Tracks page load times, API call performance, and user interactions
 */

import { useEffect, useRef } from 'react'

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  type: 'navigation' | 'api' | 'render' | 'user'
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private readonly MAX_METRICS = 100 // Keep last 100 metrics

  /**
   * Record a performance metric
   */
  record(name: string, value: number, type: PerformanceMetric['type'] = 'api'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type,
    }

    this.metrics.push(metric)

    // Keep only last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift()
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${value.toFixed(2)}ms (${type})`)
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Get metrics by type
   */
  getMetricsByType(type: PerformanceMetric['type']): PerformanceMetric[] {
    return this.metrics.filter(m => m.type === type)
  }

  /**
   * Get average time for a metric name
   */
  getAverage(name: string): number {
    const matching = this.metrics.filter(m => m.name === name)
    if (matching.length === 0) return 0
    const sum = matching.reduce((acc, m) => acc + m.value, 0)
    return sum / matching.length
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalMetrics: number
    byType: Record<string, number>
    averages: Record<string, number>
  } {
    const byType: Record<string, number> = {}
    const averages: Record<string, number> = {}
    const metricNames = new Set<string>()

    this.metrics.forEach(metric => {
      byType[metric.type] = (byType[metric.type] || 0) + 1
      metricNames.add(metric.name)
    })

    metricNames.forEach(name => {
      averages[name] = this.getAverage(name)
    })

    return {
      totalMetrics: this.metrics.length,
      byType,
      averages,
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const renderStartRef = useRef<number>(0)
  const mountTimeRef = useRef<number>(0)

  // Track component mount time
  useEffect(() => {
    mountTimeRef.current = performance.now()
    performanceMonitor.record(`${componentName}:mount`, 0, 'render')

    return () => {
      const unmountTime = performance.now() - mountTimeRef.current
      performanceMonitor.record(`${componentName}:unmount`, unmountTime, 'render')
    }
  }, [componentName])

  // Track render time
  useEffect(() => {
    renderStartRef.current = performance.now()

    return () => {
      const renderTime = performance.now() - renderStartRef.current
      if (renderTime > 0) {
        performanceMonitor.record(`${componentName}:render`, renderTime, 'render')
      }
    }
  })

  /**
   * Track API call performance
   */
  const trackAPI = (apiName: string, startTime: number) => {
    const duration = performance.now() - startTime
    performanceMonitor.record(apiName, duration, 'api')
  }

  /**
   * Track user interaction
   */
  const trackInteraction = (action: string, duration: number) => {
    performanceMonitor.record(action, duration, 'user')
  }

  return {
    trackAPI,
    trackInteraction,
  }
}

/**
 * Measure async function performance
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    performanceMonitor.record(name, duration, 'api')
    return result
  } catch (error) {
    const duration = performance.now() - start
    performanceMonitor.record(`${name}:error`, duration, 'api')
    throw error
  }
}

/**
 * Get Web Vitals metrics
 */
export function getWebVitals(): {
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
} {
  if (typeof window === 'undefined' || !('performance' in window)) {
    return {}
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  if (!navigation) return {}

  return {
    ttfb: navigation.responseStart - navigation.requestStart,
    fcp: navigation.domContentLoadedEventEnd - navigation.fetchStart,
    lcp: 0, // Would need PerformanceObserver for LCP
    fid: 0, // Would need PerformanceObserver for FID
    cls: 0, // Would need PerformanceObserver for CLS
  }
}







