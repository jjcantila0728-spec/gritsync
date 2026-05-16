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

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key)
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize + 10)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
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
  getStats(): { totalEntries: number; validEntries: number; expiredEntries: number } {
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

  // Fetch from network with error handling
  let response: Response
  try {
    response = await fetch(url, options)
  } catch (error: any) {
    // Import error handler dynamically to avoid circular dependencies
    const { normalizeError } = await import('./error-handler')
    throw normalizeError(error, { url, method: options?.method || 'GET' })
  }

  if (!response.ok) {
    // Import error handler dynamically to avoid circular dependencies
    const { normalizeError } = await import('./error-handler')
    const error = new Error(`HTTP error! status: ${response.status}`)
    throw normalizeError(error, { 
      url, 
      method: options?.method || 'GET',
      status: response.status,
      statusText: response.statusText 
    })
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

// ─── Generic request cache + React hook ──────────────────────────────────────
// `cachedFetch` above is bolted to the raw `fetch` API, which means it can't
// wrap our axios-based `nclexApi.foo()` / `applicationsAPI.bar()` calls. The
// helpers below take an arbitrary fetcher function instead so any async API
// (axios, supabase-style db client, future SDKs) can opt in with one line.
//
// API:
//   cachedRequest<T>(key, fetcher, opts)               — Promise<T>
//   useCachedQuery<T>(key, fetcher, opts)              — React hook
//   invalidate(pattern: string | RegExp)               — drop matching entries
//   clearAllCache()                                    — wipe everything (sign-out)
//
// Cache hits return synchronously on mount, so navigating back to a recently
// visited page paints instantly. Concurrent calls for the same key share one
// in-flight promise — three components mounting at the same time issue one
// network request, not three.

import { useEffect, useRef, useState } from 'react'

interface RequestEntry<T> {
  value: T
  expiresAt: number
}

const requestCache = new Map<string, RequestEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_REQUEST_TTL_MS = 30_000 // 30 s — "feels fresh" baseline

export interface CachedRequestOpts {
  /** Override the TTL in milliseconds (default 30 s). */
  ttl?: number
  /** Force re-fetch even if a cached entry exists. */
  force?: boolean
}

export async function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CachedRequestOpts = {},
): Promise<T> {
  const ttl = opts.ttl ?? DEFAULT_REQUEST_TTL_MS
  const now = Date.now()

  if (!opts.force) {
    const hit = requestCache.get(key) as RequestEntry<T> | undefined
    if (hit && hit.expiresAt > now) return hit.value
  }

  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing && !opts.force) return existing

  const promise = (async () => {
    try {
      const value = await fetcher()
      requestCache.set(key, { value, expiresAt: Date.now() + ttl })
      return value
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

/**
 * Drop request-cache entries whose key matches `pattern`. Strings match by
 * prefix; regex matches by `.test()`. Call after a mutation so the next
 * read fetches fresh data.
 */
export function invalidate(pattern: string | RegExp): number {
  let removed = 0
  for (const key of [...requestCache.keys()]) {
    if (typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key)) {
      requestCache.delete(key)
      removed++
    }
  }
  for (const key of [...inflight.keys()]) {
    if (typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key)) {
      inflight.delete(key)
    }
  }
  return removed
}

/** Wipe everything. Use on sign-out so the next session starts cold. */
export function clearAllCache(): void {
  requestCache.clear()
  inflight.clear()
  apiCache.clear()
}

/** Fire-and-forget prefetch (e.g. on hover or route-prefetch). */
export function prefetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: CachedRequestOpts,
): void {
  cachedRequest(key, fetcher, opts).catch(() => { /* swallow */ })
}

interface UseCachedQueryOpts<T> {
  ttl?: number
  /** Extra deps that should retrigger the fetch when they change. */
  deps?: ReadonlyArray<unknown>
  /** Skip the fetch entirely while this is false (e.g. waiting for auth). */
  enabled?: boolean
  /** Initial value rendered before the first fetch resolves. */
  initialData?: T
}

interface UseCachedQueryResult<T> {
  data: T | undefined
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * React hook variant of `cachedRequest`. The first render returns cached
 * data synchronously if it exists, so revisiting a recently-loaded page
 * paints instantly while a background re-fetch (if the TTL has expired)
 * runs in parallel.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: UseCachedQueryOpts<T> = {},
): UseCachedQueryResult<T> {
  const { ttl, deps = [], enabled = true, initialData } = opts

  const initialFromCache = key
    ? ((requestCache.get(key) as RequestEntry<T> | undefined)?.value ?? undefined)
    : undefined

  const [data, setData] = useState<T | undefined>(initialFromCache ?? initialData)
  const [loading, setLoading] = useState<boolean>(enabled && initialFromCache === undefined)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = async (force = false) => {
    if (!key || !enabled) return
    setError(null)
    if (initialFromCache === undefined && !force) setLoading(true)
    try {
      const value = await cachedRequest(key, () => fetcherRef.current(), { ttl, force })
      setData(value)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void run() }, [key, enabled, ...deps])

  return { data, loading, error, refetch: () => run(true) }
}
