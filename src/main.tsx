import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { initSentry } from './lib/sentry'
import './index.css'

// Initialize error tracking before anything else so we catch errors that
// happen during boot. Silent no-op if VITE_SENTRY_DSN isn't set.
initSentry()

// After a redeploy, old hashed chunks under /assets/ disappear and any
// open tab that lazy-loads one gets a 404 → SPA fallback → HTML, which
// the browser rejects with "Failed to load module script ... text/html".
// Vite emits `vite:preloadError` for the modulepreload path; dynamic
// imports surface as unhandledrejection. Either way, reload to fetch
// the new bundle. sessionStorage guard prevents reload loops if the
// failure is actually a persistent network issue.
if (typeof window !== 'undefined') {
  const reloadOnStaleChunk = (source: string) => {
    const key = 'gs:chunkReloadAt'
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 10_000) {
      console.warn(`[${source}] stale chunk reload skipped — already reloaded recently`)
      return
    }
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  }

  window.addEventListener('vite:preloadError', () => reloadOnStaleChunk('vite:preloadError'))

  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || '')
    if (
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /Failed to load module script/i.test(msg)
    ) {
      reloadOnStaleChunk('unhandledrejection')
    }
  })
}

// Register the self-unregistering service worker. Production serves
// /sw.js from public/; dev does not, so skip there to keep the console
// clean. We still want this to run in prod so users who carry the old
// caching worker pick up its eviction.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.warn('Service Worker registration failed:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

