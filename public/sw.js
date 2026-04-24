// Service Worker for caching static assets and pages
// Bump version when deploying to force cache invalidation
const CACHE_VERSION = 'v4'
const CACHE_NAME = `gritsync-${CACHE_VERSION}`
const STATIC_CACHE_NAME = `gritsync-static-${CACHE_VERSION}`
const IMAGE_CACHE_NAME = `gritsync-images-${CACHE_VERSION}`

// Assets to pre-cache on install (keep minimal)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Failed to cache some static assets:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event - delete ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== IMAGE_CACHE_NAME
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Fetch event - selectively cache only safe resources
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept non-GET requests — let them go straight to network
  if (request.method !== 'GET') {
    return
  }

  // Never cache API calls — they must always hit the network for fresh data
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Never cache JS/CSS bundles — Vite content-hashes them; let the HTTP cache
  // handle them. SW caching causes stale bundles to be served after redeployment.
  if (url.pathname.startsWith('/assets/')) {
    return
  }

  // Skip cross-origin requests (except images and fonts from same domain)
  if (
    url.origin !== location.origin &&
    !url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i)
  ) {
    return
  }

  event.respondWith(
    (async () => {
      const isImage = url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|avif)$/i)
      const isFont = url.pathname.match(/\.(woff|woff2|ttf|eot|otf)$/i)

      const cacheName = isImage
        ? IMAGE_CACHE_NAME
        : STATIC_CACHE_NAME

      // For images and fonts: cache-first (they rarely change)
      if (isImage || isFont) {
        const cachedResponse = await caches.match(request, { cacheName })
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', request.url)
          return cachedResponse
        }
      }

      // Network-first for everything else (navigation, etc.)
      try {
        const networkResponse = await fetch(request)

        // Only cache images and fonts
        if (networkResponse.ok && (isImage || isFont)) {
          const cache = await caches.open(cacheName)
          cache.put(request, networkResponse.clone())
          console.log('[Service Worker] Cached image/font:', request.url)
        }

        return networkResponse
      } catch (error) {
        console.error('[Service Worker] Fetch failed:', error)

        // For navigation requests, fall back to cached index.html
        if (request.mode === 'navigate') {
          const cachedIndex = await caches.match('/index.html', {
            cacheName: STATIC_CACHE_NAME,
          })
          if (cachedIndex) {
            return cachedIndex
          }
        }

        throw error
      }
    })()
  )
})

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing all caches...')
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    }).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true })
      }
    })
  }
})

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const title = data.title || 'GritSync'
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/gritsync_logo.png',
      badge: '/gritsync_logo.png',
      tag: data.tag || 'default',
      data: data.data || {}
    }
    event.waitUntil(
      self.registration.showNotification(title, options)
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})
