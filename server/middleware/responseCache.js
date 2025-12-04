/**
 * In-memory response cache for API endpoints
 * Caches GET responses with configurable TTL
 */

const cache = new Map()

/**
 * Response cache middleware
 * @param {Object} options - Cache options
 * @param {number} options.ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @param {Function} options.keyGenerator - Function to generate cache key from request (default: uses URL + query)
 * @param {Function} options.shouldCache - Function to determine if response should be cached (default: only GET requests)
 */
export function responseCache(options = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = (req) => {
      // Generate cache key from method, path, and query params
      const queryString = Object.keys(req.query)
        .sort()
        .map(key => `${key}=${req.query[key]}`)
        .join('&')
      return `${req.method}:${req.path}${queryString ? `?${queryString}` : ''}`
    },
    shouldCache = (req, res) => {
      // Only cache GET requests with 2xx status codes
      return req.method === 'GET' && res.statusCode >= 200 && res.statusCode < 300
    }
  } = options

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const cacheKey = keyGenerator(req)
    const cached = cache.get(cacheKey)

    // Check if cached entry exists and is not expired
    if (cached && Date.now() < cached.expiresAt) {
      // Set cache headers
      res.set({
        'X-Cache': 'HIT',
        'Cache-Control': `public, max-age=${Math.floor((cached.expiresAt - Date.now()) / 1000)}`
      })
      return res.json(cached.data)
    }

    // Store original json method
    const originalJson = res.json.bind(res)

    // Override json method to cache response
    res.json = function(data) {
      // Only cache if shouldCache returns true
      if (shouldCache(req, res)) {
        cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + (ttl * 1000),
          createdAt: Date.now()
        })
      }

      // Set cache headers
      res.set('X-Cache', 'MISS')
      
      // Call original json method
      return originalJson(data)
    }

    next()
  }
}

/**
 * Clear cache for a specific key or all cache
 * @param {string} key - Cache key to clear (optional, clears all if not provided)
 */
export function clearCache(key = null) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(cache.entries())
  const now = Date.now()
  
  return {
    totalEntries: entries.length,
    validEntries: entries.filter(([_, value]) => now < value.expiresAt).length,
    expiredEntries: entries.filter(([_, value]) => now >= value.expiresAt).length,
    memoryUsage: JSON.stringify(entries).length // Rough estimate
  }
}

/**
 * Clean up expired cache entries
 * Should be called periodically
 */
export function cleanupCache() {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, value] of cache.entries()) {
    if (now >= value.expiresAt) {
      cache.delete(key)
      cleaned++
    }
  }
  
  return cleaned
}

// Run cleanup every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000)
