// Self-unregistering service worker.
// This replaces a previously deployed caching worker that caused
// "TypeError: Failed to fetch" errors. On activate it removes itself
// from every browser that has it installed, then claims all open clients
// so the eviction takes effect without requiring a page reload.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Claim open clients FIRST — once unregister() runs, this worker is no
    // longer the active worker and claim() throws InvalidStateError.
    try { await self.clients.claim() } catch {}
    // Then remove ourselves so future page loads run without a service worker.
    await self.registration.unregister()
  })())
})
