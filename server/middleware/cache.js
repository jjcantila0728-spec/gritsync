/**
 * Caching middleware for HTTP responses
 * Provides cache headers for different types of content
 */

/**
 * Set cache headers for static assets (images, files, etc.)
 * @param {number} maxAge - Cache duration in seconds (default: 1 year for immutable assets)
 */
export function cacheStaticAssets(maxAge = 31536000) {
  return (req, res, next) => {
    // Set cache headers for static assets
    res.set({
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
      'Expires': new Date(Date.now() + maxAge * 1000).toUTCString()
    })
    next()
  }
}

/**
 * Set cache headers for API responses
 * @param {number} maxAge - Cache duration in seconds (default: 5 minutes)
 * @param {boolean} mustRevalidate - Whether to require revalidation (default: true)
 */
export function cacheAPIResponse(maxAge = 300, mustRevalidate = true) {
  return (req, res, next) => {
    const cacheControl = mustRevalidate
      ? `public, max-age=${maxAge}, must-revalidate`
      : `public, max-age=${maxAge}`
    
    res.set({
      'Cache-Control': cacheControl,
      'ETag': `"${Date.now()}"`, // Simple ETag based on timestamp
      'Last-Modified': new Date().toUTCString()
    })
    next()
  }
}

/**
 * Set cache headers for frequently accessed but changeable data
 * Uses shorter cache time with revalidation
 * @param {number} maxAge - Cache duration in seconds (default: 1 minute)
 */
export function cacheShortLived(maxAge = 60) {
  return (req, res, next) => {
    res.set({
      'Cache-Control': `public, max-age=${maxAge}, must-revalidate`,
      'ETag': `"${Date.now()}"`
    })
    next()
  }
}

/**
 * Set no-cache headers for sensitive or frequently changing data
 */
export function noCache() {
  return (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
    next()
  }
}

/**
 * Check if request has valid cache (ETag or If-Modified-Since)
 * Returns 304 Not Modified if cache is valid
 */
export function checkCache(req, res, next) {
  const ifNoneMatch = req.headers['if-none-match']
  const ifModifiedSince = req.headers['if-modified-since']
  
  // If client has matching ETag, return 304
  if (ifNoneMatch && res.get('ETag') === ifNoneMatch) {
    return res.status(304).end()
  }
  
  // If client has valid Last-Modified, return 304
  if (ifModifiedSince && res.get('Last-Modified')) {
    const clientTime = new Date(ifModifiedSince).getTime()
    const serverTime = new Date(res.get('Last-Modified')).getTime()
    if (clientTime >= serverTime) {
      return res.status(304).end()
    }
  }
  
  next()
}
