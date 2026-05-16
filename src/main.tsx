import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { initSentry } from './lib/sentry'
import './index.css'

// Initialize error tracking before anything else so we catch errors that
// happen during boot. Silent no-op if VITE_SENTRY_DSN isn't set.
initSentry()

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

