// Compression Middleware for Production
// Compresses responses to reduce bandwidth and improve performance

import compression from 'compression'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Compression middleware configuration
 * Only enabled in production for better performance
 */
export const compressionMiddleware = compression({
  // Only compress responses above this threshold (1KB)
  threshold: 1024,
  
  // Compression level (0-9, higher = better compression but slower)
  level: isProduction ? 6 : 1,
  
  // Filter function to determine which responses to compress
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false
    }
    
    // Use compression for all text-based content
    return compression.filter(req, res)
  }
})
