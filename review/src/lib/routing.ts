// Minimal routing helpers for the standalone review subapp. Mirrors the
// public surface of the main app's src/lib/routing.ts so files copied from
// the main app keep building here.

const PROD_DOMAIN = 'gritsync.com'

function isProduction(): boolean {
  const h = typeof window !== 'undefined' ? window.location.hostname : ''
  return h === PROD_DOMAIN || h.endsWith(`.${PROD_DOMAIN}`)
}

/** Full URL for a path on the portal (app.gritsync.com). */
export function appUrl(path: string = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (isProduction()) {
    const proto = window.location.protocol
    return `${proto}//app.${PROD_DOMAIN}${clean}`
  }
  // Dev: same origin, /app prefix.
  if (typeof window === 'undefined') return clean
  return `${window.location.origin}/app${clean}`
}

/** Full URL for a path on the landing site. */
export function landingUrl(path: string = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (isProduction()) {
    const proto = window.location.protocol
    return `${proto}//${PROD_DOMAIN}${clean}`
  }
  if (typeof window === 'undefined') return clean
  return `${window.location.origin}${clean}`
}
