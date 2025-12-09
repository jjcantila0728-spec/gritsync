/**
 * Image and Document URL Cache
 * Caches signed URLs from Supabase Storage to reduce API calls
 * and improve performance
 */

interface CachedUrl {
  url: string
  expiresAt: number
  createdAt: number
}

class ImageUrlCache {
  private cache = new Map<string, CachedUrl>()
  private maxSize = 500 // Maximum number of cached URLs
  private defaultTTL = 3600000 // 1 hour in milliseconds (signed URLs typically expire in 1 hour)

  /**
   * Get cached URL if available and not expired
   */
  get(filePath: string): string | null {
    const entry = this.cache.get(filePath)
    
    if (!entry) {
      return null
    }

    // Check if expired (with 5 minute buffer before actual expiration)
    const bufferTime = 5 * 60 * 1000 // 5 minutes
    if (Date.now() >= entry.expiresAt - bufferTime) {
      this.cache.delete(filePath)
      return null
    }

    return entry.url
  }

  /**
   * Set cached URL
   */
  set(filePath: string, url: string, ttl: number = this.defaultTTL): void {
    // Clean up if cache is too large
    if (this.cache.size >= this.maxSize) {
      this.cleanup()
    }

    this.cache.set(filePath, {
      url,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    })
  }

  /**
   * Delete cached URL
   */
  delete(filePath: string): void {
    this.cache.delete(filePath)
  }

  /**
   * Clear all cached URLs
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const bufferTime = 5 * 60 * 1000 // 5 minutes buffer

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt - bufferTime) {
        this.cache.delete(key)
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize + 50)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; validEntries: number; expiredEntries: number } {
    const entries = Array.from(this.cache.entries())
    const now = Date.now()
    const bufferTime = 5 * 60 * 1000
    
    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([_, value]) => now < value.expiresAt - bufferTime).length,
      expiredEntries: entries.filter(([_, value]) => now >= value.expiresAt - bufferTime).length
    }
  }
}

// Singleton instance
export const imageUrlCache = new ImageUrlCache()

// Cleanup expired entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    imageUrlCache.cleanup()
  }, 10 * 60 * 1000)
}

/**
 * Get cached or fetch new signed URL for a file
 */
export async function getCachedSignedUrl(
  filePath: string,
  fetchFn: (filePath: string) => Promise<string>,
  ttl?: number
): Promise<string> {
  // Check cache first
  const cached = imageUrlCache.get(filePath)
  if (cached) {
    return cached
  }

  // Fetch new URL
  const url = await fetchFn(filePath)
  
  // Cache it
  imageUrlCache.set(filePath, url, ttl)
  
  return url
}

/**
 * Preload and cache multiple image URLs
 */
export async function preloadImages(
  filePaths: string[],
  fetchFn: (filePath: string) => Promise<string>
): Promise<void> {
  const promises = filePaths.map(filePath => 
    getCachedSignedUrl(filePath, fetchFn).catch(err => {
      console.warn(`Failed to preload image: ${filePath}`, err)
      return null
    })
  )
  
  await Promise.all(promises)
}

