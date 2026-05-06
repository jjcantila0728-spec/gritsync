/**
 * Subdomain-aware routing utility for GritSync.
 *
 * Production domains:
 *   gritsync.com         → landing (public marketing site)
 *   app.gritsync.com     → portal (client + admin)
 *   review.gritsync.com  → NCLEX review platform
 *
 * Development (Replit): everything on one origin, differentiated by path prefix:
 *   /            → landing
 *   /app/...     → portal
 *   /review/...  → NCLEX review
 */

const PROD_DOMAIN = 'gritsync.com'
const APP_SUBDOMAIN = 'app'
const REVIEW_SUBDOMAIN = 'review'

export type SubdomainContext = 'landing' | 'app' | 'review'

function getHostname(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hostname
}

function getPathname(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname
}

/** Is this a production-like deployment (real gritsync.com domain)? */
export function isProduction(): boolean {
  const hostname = getHostname()
  return hostname === PROD_DOMAIN || hostname.endsWith(`.${PROD_DOMAIN}`)
}

/**
 * Detect which subdomain context is currently active.
 * - Production: based on hostname subdomain
 * - Development: based on path prefix (/app/... or /review/...)
 */
export function getSubdomainContext(): SubdomainContext {
  if (isProduction()) {
    const hostname = getHostname()
    if (hostname === `${APP_SUBDOMAIN}.${PROD_DOMAIN}`) return 'app'
    if (hostname === `${REVIEW_SUBDOMAIN}.${PROD_DOMAIN}`) return 'review'
    return 'landing'
  }

  // Dev: path-prefix based routing
  const pathname = getPathname()
  if (pathname.startsWith('/app')) return 'app'
  if (pathname.startsWith('/review')) return 'review'
  return 'landing'
}

/**
 * React Router basename for the current context.
 * In dev: '/app' or '/review' or ''
 * In prod: '' (subdomains handle the split, no basename needed)
 */
export function getBasename(): string {
  if (isProduction()) return ''
  const context = getSubdomainContext()
  if (context === 'app') return '/app'
  if (context === 'review') return '/review'
  return ''
}

// ---------------------------------------------------------------------------
// Cross-subdomain navigation helpers
// Call these when you need to redirect a user to a different subdomain.
// ---------------------------------------------------------------------------

function buildOrigin(subdomain: string | null): string {
  if (isProduction()) {
    const base = `${window.location.protocol}//${subdomain ? `${subdomain}.` : ''}${PROD_DOMAIN}`
    return base
  }
  // Dev: same origin, different path prefix
  return window.location.origin
}

/** Full URL for a path on the landing site (gritsync.com) */
export function landingUrl(path: string = '/'): string {
  if (isProduction()) {
    return `${buildOrigin(null)}${path}`
  }
  // Dev: strip /app or /review prefix, stay on same origin
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${clean}`
}

/** Full URL for a path on the portal (app.gritsync.com) */
export function appUrl(path: string = '/'): string {
  if (isProduction()) {
    return `${buildOrigin(APP_SUBDOMAIN)}${path}`
  }
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}/app${clean}`
}

/** Full URL for a path on the review platform (review.gritsync.com) */
export function reviewUrl(path: string = '/'): string {
  if (isProduction()) {
    return `${buildOrigin(REVIEW_SUBDOMAIN)}${path}`
  }
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}/review${clean}`
}

/**
 * Navigate to a different subdomain (or same-subdomain path).
 * Uses window.location.href for cross-subdomain jumps in production.
 * In dev, it navigates using the path prefix approach.
 */
export function navigateTo(url: string) {
  window.location.href = url
}
