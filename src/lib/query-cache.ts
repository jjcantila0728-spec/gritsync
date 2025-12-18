/**
 * Simple query result cache for frequently accessed data
 * Reduces redundant Supabase queries for data that doesn't change often
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  key: string
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 30 * 1000 // 30 seconds default
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every minute
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup()
      }, 60 * 1000)
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (entry.expiresAt <= now) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const expiresAt = Date.now() + ttl
    this.cache.set(key, { data, expiresAt, key })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key)
      }
    }
  }

  // Invalidate cache entries matching a pattern
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats (for debugging)
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

// Singleton instance
export const queryCache = new QueryCache()

/**
 * Cached query wrapper - wraps a query function with caching
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = queryCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Execute query
  const data = await queryFn()

  // Cache result
  queryCache.set(key, data, ttl)

  return data
}

/**
 * Cache key generators for common queries
 */
export const cacheKeys = {
  application: (id: string) => `app:${id}`,
  applicationTimeline: (id: string) => `app:${id}:timeline`,
  applicationPayments: (id: string) => `app:${id}:payments`,
  userDocuments: (userId: string) => `docs:${userId}`,
  userDetails: (userId: string) => `user:${userId}:details`,
  service: (name: string, state: string) => `service:${name}:${state}`,
  settings: () => 'settings:all',
}

/**
 * Invalidate cache for an application (when application is updated)
 */
export function invalidateApplicationCache(applicationId: string): void {
  queryCache.invalidatePattern(`app:${applicationId}`)
}

/**
 * Invalidate cache for a user (when user data is updated)
 */
export function invalidateUserCache(userId: string): void {
  queryCache.invalidatePattern(`(app|docs|user):${userId}`)
}







