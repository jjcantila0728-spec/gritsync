// Self-unregistering service worker.
// This replaces a previously deployed caching worker that caused
// "TypeError: Failed to fetch" errors. On activate it removes itself
// from every browser that has it installed, then claims all open clients
// so the eviction takes effect without requiring a page reload.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.claim()
    })
  )
})
