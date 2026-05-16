// Sentry initialization for the frontend.
//
// Activates only when VITE_SENTRY_DSN is set on the build, so local dev and
// CI builds without a DSN configured stay silent. In production, set the env
// var on Vercel (Project Settings → Environment Variables) and redeploy.
//
// What gets reported:
//   - Uncaught exceptions in React render / lifecycle (via the ErrorBoundary
//     integration that calls captureReactError on error)
//   - Uncaught promise rejections
//   - The user's id / role attached as Sentry user context once auth resolves
//
// What does NOT get reported (intentional):
//   - 401 responses (they're the "session expired, please log in" path —
//     not bugs, and they create noise)
//   - Network errors during the initial-load notifications poll (the poll
//     retries every 15 s anyway; logged to console.warn, not Sentry)

import * as Sentry from '@sentry/react'

const DSN = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined
const ENVIRONMENT = (import.meta as any).env?.VITE_VERCEL_ENV || ((import.meta as any).env?.PROD ? 'production' : 'development')
const RELEASE = (import.meta as any).env?.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined

let initialized = false

export function initSentry(): void {
  if (initialized) return
  if (!DSN) {
    // No DSN configured — skip silently. This is the dev / preview path.
    return
  }
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    // Capture 100% of errors. Cheap on a small product like this.
    sampleRate: 1.0,
    // Performance traces — keep low to stay within the free tier.
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.05 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Drop known-uninteresting noise.
    beforeSend(event, hint) {
      const err = hint.originalException as { response?: { status?: number }; message?: string } | undefined
      // 401s are the "session expired, please log in" path, not bugs.
      if (err?.response?.status === 401) return null
      // Network/timeout errors during background polls are expected.
      const msg = err?.message || ''
      if (/Failed to fetch|NetworkError|net::ERR_/i.test(msg)) return null
      // Service worker chunk-load failures are handled by the in-app banner.
      if (/Failed to fetch dynamically imported module/i.test(msg)) return null
      return event
    },
  })
  initialized = true
}

/** Attach the current user's id + role to all subsequent events. Call this
 *  once auth resolves so error reports can be traced back to a specific user. */
export function setSentryUser(user: { id: string; email?: string; role?: string } | null): void {
  if (!initialized) return
  if (!user) {
    Sentry.setUser(null)
    return
  }
  Sentry.setUser({
    id: user.id,
    email: user.email,
    segment: user.role,
  })
}

/** Manual capture for cases where the error boundary won't catch (e.g. async
 *  handlers, fetch callbacks). */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export { Sentry }
