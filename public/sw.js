// Service Worker for caching static assets and pages
const CACHE_NAME = 'gritsync-v1'
const STATIC_CACHE_NAME = 'gritsync-static-v1'
const IMAGE_CACHE_NAME = 'gritsync-images-v1'

// Assets to cache on install
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

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip cross-origin requests (except images and fonts)
  if (url.origin !== location.origin && 
      !url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i)) {
    return
  }

  event.respondWith(
    (async () => {
      // Check if it's an image or font
      const isImage = url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|avif)$/i)
      const isFont = url.pathname.match(/\.(woff|woff2|ttf|eot|otf)$/i)
      const isStaticAsset = url.pathname.match(/\.(js|css|json)$/i) || 
                           url.pathname.startsWith('/assets/')

      // Determine which cache to use
      let cacheName = CACHE_NAME
      if (isImage) {
        cacheName = IMAGE_CACHE_NAME
      } else if (isStaticAsset || isFont) {
        cacheName = STATIC_CACHE_NAME
      }

      // Try cache first
      const cachedResponse = await caches.match(request, { cacheName })
      if (cachedResponse) {
        console.log('[Service Worker] Serving from cache:', request.url)
        return cachedResponse
      }

      // Fetch from network
      try {
        const networkResponse = await fetch(request)
        
        // Cache successful responses
        if (networkResponse.ok) {
          const cache = await caches.open(cacheName)
          // Clone the response because it can only be consumed once
          cache.put(request, networkResponse.clone())
          console.log('[Service Worker] Cached:', request.url)
        }
        
        return networkResponse
      } catch (error) {
        console.error('[Service Worker] Fetch failed:', error)
        
        // For navigation requests, return cached index.html
        if (request.mode === 'navigate') {
          const cachedIndex = await caches.match('/index.html', { cacheName: STATIC_CACHE_NAME })
          if (cachedIndex) {
            return cachedIndex
          }
        }
        
        throw error
      }
    })()
  )
})

// Message event - handle cache clearing
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing all caches...')
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      )
    }).then(() => {
      event.ports[0].postMessage({ success: true })
    })
  }
})

