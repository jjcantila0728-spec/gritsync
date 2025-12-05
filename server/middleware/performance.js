// Performance Monitoring Middleware
// Tracks response times and provides metrics

import { logger } from '../utils/logger.js'

// Store performance metrics
const metrics = {
  requests: 0,
  totalResponseTime: 0,
  slowRequests: [],
  errors: 0,
  startTime: Date.now()
}

// Reset metrics periodically (every hour)
setInterval(() => {
  const avgResponseTime = metrics.requests > 0 
    ? Math.round(metrics.totalResponseTime / metrics.requests)
    : 0
  
  logger.info('Performance metrics', {
    requests: metrics.requests,
    averageResponseTime: `${avgResponseTime}ms`,
    errors: metrics.errors,
    slowRequests: metrics.slowRequests.length,
    uptime: `${Math.round((Date.now() - metrics.startTime) / 1000 / 60)} minutes`
  })
  
  // Reset metrics
  metrics.requests = 0
  metrics.totalResponseTime = 0
  metrics.slowRequests = []
  metrics.errors = 0
}, 60 * 60 * 1000) // Every hour

/**
 * Performance monitoring middleware
 * Tracks response times and identifies slow requests
 */
export function performanceMonitor(req, res, next) {
  const startTime = Date.now()
  
  // Track when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime
    metrics.requests++
    metrics.totalResponseTime += duration
    
    // Log slow requests (>1 second)
    if (duration > 1000) {
      metrics.slowRequests.push({
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      })
      
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      })
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.errors++
    }
    
    // Add performance header
    res.setHeader('X-Response-Time', `${duration}ms`)
  })
  
  next()
}

/**
 * Get current performance metrics
 */
export function getMetrics() {
  const avgResponseTime = metrics.requests > 0 
    ? Math.round(metrics.totalResponseTime / metrics.requests)
    : 0
  
  return {
    ...metrics,
    averageResponseTime: `${avgResponseTime}ms`,
    uptime: Date.now() - metrics.startTime
  }
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics() {
  metrics.requests = 0
  metrics.totalResponseTime = 0
  metrics.slowRequests = []
  metrics.errors = 0
  metrics.startTime = Date.now()
}
