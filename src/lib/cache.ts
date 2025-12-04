/**
 * Client-side API response cache
 * Provides in-memory caching for API responses with TTL support
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>()
  private maxSize = 100 // Maximum number of cache entries

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    // Clean up if cache is too large
    if (this.cache.size >= this.maxSize) {
      this.cleanup()
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    })
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize + 10)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }

    return cleaned
  }

  /**
   * Generate cache key from URL and options
   */
  generateKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET'
    const body = options?.body ? JSON.stringify(options.body) : ''
    const headers = options?.headers 
      ? Object.entries(options.headers)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v}`)
          .join(',')
      : ''
    
    return `${method}:${url}:${body}:${headers}`
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.entries())
    const now = Date.now()
    
    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([_, value]) => now < value.expiresAt).length,
      expiredEntries: entries.filter(([_, value]) => now >= value.expiresAt).length
    }
  }
}

// Singleton instance
export const apiCache = new APICache()

// Cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.cleanup()
  }, 5 * 60 * 1000)
}

/**
 * Cached fetch wrapper
 * Automatically caches GET requests and returns cached data when available
 */
export async function cachedFetch<T = any>(
  url: string,
  options?: RequestInit,
  cacheOptions?: {
    ttl?: number // Time to live in milliseconds
    useCache?: boolean // Whether to use cache (default: true for GET requests)
    forceRefresh?: boolean // Force refresh even if cache exists
  }
): Promise<T> {
  const {
    ttl = 300000, // 5 minutes default
    useCache = options?.method === undefined || options.method === 'GET',
    forceRefresh = false
  } = cacheOptions || {}

  const cacheKey = apiCache.generateKey(url, options)

  // Try to get from cache first (if not forcing refresh)
  if (useCache && !forceRefresh) {
    const cached = apiCache.get<T>(cacheKey)
    if (cached !== null) {
      return cached
    }
  }

  // Fetch from network
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  // Cache successful GET responses
  if (useCache && (options?.method === undefined || options.method === 'GET')) {
    apiCache.set(cacheKey, data, ttl)
  }

  return data as T
}

/**
 * Clear cache for a specific URL pattern
 */
export function clearCacheForUrl(urlPattern: string | RegExp): number {
  let cleared = 0
  const pattern = typeof urlPattern === 'string' 
    ? new RegExp(urlPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    : urlPattern

  for (const [key] of apiCache['cache'].entries()) {
    if (pattern.test(key)) {
      apiCache.delete(key)
      cleared++
    }
  }

  return cleared
}
