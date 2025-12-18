/**
 * Request deduplication utility
 * Prevents duplicate simultaneous API calls with the same parameters
 * Useful for preventing race conditions and reducing unnecessary API calls
 */

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>()
  private readonly REQUEST_TIMEOUT = 30000 // 30 seconds max wait time

  /**
   * Generate a cache key from request parameters
   */
  private generateKey(prefix: string, params: any): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort())
    return `${prefix}:${sortedParams}`
  }

  /**
   * Deduplicate a request - if a request with the same key is already in flight,
   * return the existing promise instead of making a new request
   */
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.REQUEST_TIMEOUT
  ): Promise<T> {
    const now = Date.now()

    // Check if there's an existing pending request
    const existing = this.pendingRequests.get(key)
    if (existing) {
      // Check if request is still valid (not expired)
      if (now - existing.timestamp < ttl) {
        return existing.promise
      } else {
        // Request expired, remove it
        this.pendingRequests.delete(key)
      }
    }

    // Create new request
    const promise = (async () => {
      try {
        const result = await requestFn()
        return result
      } finally {
        // Clean up after request completes
        this.pendingRequests.delete(key)
      }
    })()

    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: now,
    })

    return promise
  }

  /**
   * Clear a specific pending request
   */
  clear(key: string): void {
    this.pendingRequests.delete(key)
  }

  /**
   * Clear all pending requests
   */
  clearAll(): void {
    this.pendingRequests.clear()
  }

  /**
   * Get count of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size
  }

  /**
   * Cleanup expired requests
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.pendingRequests.delete(key)
      }
    }
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator()

// Cleanup expired requests every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    requestDeduplicator.cleanup()
  }, 60 * 1000)
}

/**
 * Deduplicate a Supabase query
 * Prevents duplicate queries with the same parameters
 */
export async function deduplicateQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return requestDeduplicator.deduplicate(key, queryFn, ttl)
}

/**
 * Generate a query key from parameters
 */
export function generateQueryKey(prefix: string, params: Record<string, any>): string {
  return requestDeduplicator['generateKey'](prefix, params)
}







