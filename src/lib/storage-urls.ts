// File-storage URL helpers, extracted from api-service.ts so that pages
// (Header / Dashboard / Documents / MyDetails / Email / Application Payments)
// can import `getSignedFileUrl` *without* pulling in the 5600-line god module.
//
// The setInterval cache cleanup below is a top-level side effect — Rollup
// can't tree-shake any file with one of those, which is exactly why
// api-service.ts wouldn't split. Isolating it here keeps the rest of
// api-service.ts tree-shakeable.

import { db } from './api-client'
import { imageUrlCache } from './image-cache'
import { normalizeError, logError } from './error-handler'

// ─── Public URL (no signing) ─────────────────────────────────────────────────
export function getFileUrl(filePath: string): string {
  const { data } = db.storage
    .from('documents')
    .getPublicUrl(filePath)
  return data.publicUrl
}

// ─── Signed-URL cache + cleanup ──────────────────────────────────────────────
// Get signed URL for private files (expires in 1 hour by default, cache longer).
// Optimized in-memory cache to minimize storage API calls.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const signedUrlInflight = new Map<string, Promise<string>>()
// Negative cache for files that don't exist (15 min to avoid repeat lookups).
const negativeCache = new Map<string, { expiresAt: number }>()
// Rate-limit listing calls to prevent server crashes on retry storms.
const fileListingCache = new Map<string, { files: any[] | null; expiresAt: number }>()
const FILE_LISTING_CACHE_TTL = 5 * 60 * 1000
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000
const CACHE_BUFFER_MS = 60_000
const NEGATIVE_CACHE_TTL = 15 * 60 * 1000

if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of signedUrlCache.entries()) {
      if (value.expiresAt <= now) signedUrlCache.delete(key)
    }
    for (const [key, value] of negativeCache.entries()) {
      if (value.expiresAt <= now) negativeCache.delete(key)
    }
    for (const [key, value] of fileListingCache.entries()) {
      if (value.expiresAt <= now) fileListingCache.delete(key)
    }
  }, CACHE_CLEANUP_INTERVAL)
}

/**
 * Clears all cached signed URLs for a given file path. Must be called after
 * uploading a new version or deleting a file so components re-fetch a fresh
 * URL instead of using the stale cached one.
 */
export function clearSignedUrlCacheForPath(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, '/')
  for (const key of signedUrlCache.keys()) {
    if (key.startsWith(normalizedPath + ':') || key === normalizedPath) {
      signedUrlCache.delete(key)
    }
  }
  negativeCache.delete(normalizedPath)
  for (const key of signedUrlInflight.keys()) {
    if (key.startsWith(normalizedPath + ':') || key === normalizedPath) {
      signedUrlInflight.delete(key)
    }
  }
  // Also remove from the image-cache singleton so DocumentImagePreview re-fetches.
  imageUrlCache.delete(normalizedPath)
}

export async function getSignedFileUrl(
  filePath: string,
  expiresIn: number = 3600,
  silent: boolean = false,
): Promise<string> {
  if (!filePath || filePath.trim() === '') {
    if (!silent) {
      logError(normalizeError(new Error('File path is required'), { operation: 'getSignedFileUrl', filePath }), { operation: 'getSignedFileUrl' })
    }
    throw normalizeError(new Error('File path is required'), { operation: 'getSignedFileUrl', filePath })
  }

  const normalizedPath = filePath.replace(/\\/g, '/')
  const cacheKey = `${normalizedPath}:${expiresIn}`
  const now = Date.now()

  const cached = signedUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > now + CACHE_BUFFER_MS) {
    return cached.url
  }

  const isAvatar = normalizedPath.includes('avatar') || normalizedPath.includes('picture')
  const shouldBeSilent = silent || isAvatar

  const negativeCached = negativeCache.get(normalizedPath)
  if (negativeCached && negativeCached.expiresAt > now) {
    if (shouldBeSilent) return null as any
    throw new Error(`File not found in storage: ${normalizedPath}`)
  }

  const inflight = signedUrlInflight.get(cacheKey)
  if (inflight) return inflight

  const promise = (async (): Promise<string> => {
    if (shouldBeSilent) {
      const nc = negativeCache.get(normalizedPath)
      if (nc && nc.expiresAt > now) return null as any
    }

    const { data, error } = await db.storage
      .from('documents')
      .createSignedUrl(normalizedPath, expiresIn)

    if (error) {
      if (shouldBeSilent && (error.message?.includes('not found') || error.message?.includes('Object not found') || (error as any).statusCode === 400)) {
        negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
        return null as any
      }
      if (error.message?.includes('not found') || error.message?.includes('Object not found')) {
        const pathParts = normalizedPath.split('/')
        const fileName = pathParts[pathParts.length - 1]
        const directory = pathParts.slice(0, -1).join('/')

        let alternativePath: string | null = null

        // Case 1: path contains a timestamp suffix — try without timestamp + 2x2picture variations.
        if (normalizedPath.match(/_\d{13}\./)) {
          const match = fileName.match(/^(.+?)_\d+\.(.+)$/)
          if (match) {
            const [, docType, ext] = match
            const pathWithoutTimestamp = directory ? `${directory}/${docType}.${ext}` : `${docType}.${ext}`

            if (docType.toLowerCase() === 'picture') {
              const extVariations = [ext, ext.toLowerCase(), ext.toUpperCase()]
              for (const extVar of extVariations) {
                const altPath = directory ? `${directory}/2x2picture.${extVar}` : `2x2picture.${extVar}`
                const altNc = negativeCache.get(altPath)
                if (!altNc || altNc.expiresAt <= now) {
                  try {
                    const { data: altData, error: altError } = await db.storage
                      .from('documents')
                      .createSignedUrl(altPath, expiresIn)
                    if (!altError && altData?.signedUrl) {
                      signedUrlCache.set(cacheKey, { url: altData.signedUrl, expiresAt: now + expiresIn * 1000 })
                      return altData.signedUrl
                    }
                  } catch { /* continue */ }
                }
              }
            }

            alternativePath = pathWithoutTimestamp
          }
        }
        // Case 2: no timestamp — try variations + list directory.
        else {
          const baseNameMatch = fileName.match(/^(.+?)\.(.+)$/)
          if (baseNameMatch) {
            const [, baseName, ext] = baseNameMatch
            const extVariations = [ext, ext.toLowerCase(), ext.toUpperCase()]

            if (baseName.toLowerCase() === 'picture') {
              for (const extVar of extVariations) {
                const altPath = directory ? `${directory}/2x2picture.${extVar}` : `2x2picture.${extVar}`
                const altNc = negativeCache.get(altPath)
                if (!altNc || altNc.expiresAt <= now) {
                  try {
                    const { data: altData, error: altError } = await db.storage
                      .from('documents')
                      .createSignedUrl(altPath, expiresIn)
                    if (!altError && altData?.signedUrl) {
                      signedUrlCache.set(cacheKey, { url: altData.signedUrl, expiresAt: now + expiresIn * 1000 })
                      return altData.signedUrl
                    }
                  } catch { /* continue */ }
                }
              }
            } else if (baseName.toLowerCase() === '2x2picture') {
              for (const extVar of extVariations) {
                const altPath = directory ? `${directory}/picture.${extVar}` : `picture.${extVar}`
                const altNc = negativeCache.get(altPath)
                if (!altNc || altNc.expiresAt <= now) {
                  try {
                    const { data: altData, error: altError } = await db.storage
                      .from('documents')
                      .createSignedUrl(altPath, expiresIn)
                    if (!altError && altData?.signedUrl) {
                      signedUrlCache.set(cacheKey, { url: altData.signedUrl, expiresAt: now + expiresIn * 1000 })
                      return altData.signedUrl
                    }
                  } catch { /* continue */ }
                }
              }
            }
          }

          try {
            const cachedListing = fileListingCache.get(directory || '')
            let files: any[] | null = null

            if (cachedListing && cachedListing.expiresAt > now) {
              files = cachedListing.files
            } else {
              const { data: listData, error: listError } = await db.storage
                .from('documents')
                .list(directory || '', { limit: 100 })
              if (!listError && listData) {
                files = listData
                fileListingCache.set(directory || '', { files: listData, expiresAt: now + FILE_LISTING_CACHE_TTL })
              }
            }

            if (files && files.length > 0 && baseNameMatch) {
              const [, baseName, ext] = baseNameMatch
              const escExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const timestampPattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d+\\.${escExt}$`, 'i')
              let matchingFile = files.find(f => timestampPattern.test(f.name))

              if (!matchingFile && baseName.toLowerCase() === 'picture') {
                const pattern2x2 = new RegExp(`^2x2picture(_\\d+)?\\.${escExt}$`, 'i')
                matchingFile = files.find(f => pattern2x2.test(f.name))
              }
              if (!matchingFile && baseName.toLowerCase() === '2x2picture') {
                const patternPic = new RegExp(`^picture(_\\d+)?\\.${escExt}$`, 'i')
                matchingFile = files.find(f => patternPic.test(f.name))
              }

              if (matchingFile) {
                alternativePath = directory ? `${directory}/${matchingFile.name}` : matchingFile.name
              }
            }
          } catch { /* listing failure is non-fatal */ }
        }

        if (alternativePath) {
          const altNc = negativeCache.get(alternativePath)
          if (altNc && altNc.expiresAt > now) {
            alternativePath = null
          } else {
            const { data: fallbackData, error: fallbackError } = await db.storage
              .from('documents')
              .createSignedUrl(alternativePath, expiresIn)
            if (!fallbackError && fallbackData?.signedUrl) {
              signedUrlCache.set(cacheKey, { url: fallbackData.signedUrl, expiresAt: now + expiresIn * 1000 })
              return fallbackData.signedUrl
            }
            alternativePath = null
          }
        }

        // Last-ditch directory listing for picture/2x2picture variants.
        if (!alternativePath && fileName.toLowerCase().includes('picture')) {
          try {
            const cachedListing = fileListingCache.get(directory || '')
            let files: any[] | null = null

            if (cachedListing && cachedListing.expiresAt > now) {
              files = cachedListing.files
            } else {
              const { data: listData, error: listError } = await db.storage
                .from('documents')
                .list(directory || '', { limit: 100 })
              if (!listError && listData) {
                files = listData
                fileListingCache.set(directory || '', { files: listData, expiresAt: now + FILE_LISTING_CACHE_TTL })
              }
            }

            if (files && files.length > 0) {
              const originalFileName = normalizedPath.split('/').pop() || ''
              const baseNameMatch = originalFileName.match(/^(.+?)(?:_\d+)?\.(.+)$/)
              if (baseNameMatch) {
                const [, baseName, ext] = baseNameMatch
                if (baseName.toLowerCase() === 'picture') {
                  const escExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  const pattern2x2 = new RegExp(`^2x2picture(_\\d+)?\\.${escExt}$`, 'i')
                  let matchingFile = files.find(f => pattern2x2.test(f.name))
                  if (!matchingFile) {
                    matchingFile = files.find(f => f.name.toLowerCase().startsWith('2x2picture'))
                  }
                  if (matchingFile) {
                    alternativePath = directory ? `${directory}/${matchingFile.name}` : matchingFile.name
                  }
                }
              }
            }
          } catch { /* listing failure is non-fatal */ }
        }

        if (alternativePath) {
          const { data: fallbackData, error: fallbackError } = await db.storage
            .from('documents')
            .createSignedUrl(alternativePath, expiresIn)
          if (!fallbackError && fallbackData?.signedUrl) {
            signedUrlCache.set(cacheKey, { url: fallbackData.signedUrl, expiresAt: now + expiresIn * 1000 })
            return fallbackData.signedUrl
          }
        }

        negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
        if (alternativePath) {
          negativeCache.set(alternativePath, { expiresAt: now + NEGATIVE_CACHE_TTL })
        }

        throw new Error(`File not found in storage: ${normalizedPath}`)
      }

      throw new Error(error.message || 'Failed to get signed URL')
    }

    if (!data?.signedUrl) {
      negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
      throw new Error('No signed URL returned')
    }

    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: now + expiresIn * 1000 })
    negativeCache.delete(normalizedPath)
    return data.signedUrl
  })()

  signedUrlInflight.set(cacheKey, promise)
  try {
    return await promise
  } catch (error) {
    if (shouldBeSilent) {
      negativeCache.set(normalizedPath, { expiresAt: now + NEGATIVE_CACHE_TTL })
      return null as any
    }
    throw error
  } finally {
    signedUrlInflight.delete(cacheKey)
  }
}
