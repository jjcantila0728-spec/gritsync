/**
 * PWA Update Notification Component
 * Notifies users when a new version of the app is available
 */

import { useState, useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)

        // Check for updates every hour
        const checkForUpdates = () => {
          reg.update()
        }

        // Check immediately
        checkForUpdates()

        // Check periodically
        const interval = setInterval(checkForUpdates, 60 * 60 * 1000) // 1 hour

        // Listen for service worker updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                setShowUpdate(true)
              }
            })
          }
        })

        return () => clearInterval(interval)
      })
    }
  }, [])

  const handleUpdate = () => {
    if (!registration || !registration.waiting) return

    // Tell the service worker to skip waiting and activate
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })

    // Reload the page
    window.location.reload()
  }

  const handleDismiss = () => {
    setShowUpdate(false)
    // Don't show again for this session
    sessionStorage.setItem('pwa-update-dismissed', 'true')
  }

  // Check if update was dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa-update-dismissed')
    if (dismissed === 'true') {
      setShowUpdate(false)
    }
  }, [])

  if (!showUpdate || !registration) {
    return null
  }

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-top-5 duration-300">
      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Update Available
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              A new version of GritSync is available. Update now to get the latest features and improvements.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleUpdate}
                size="sm"
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Update Now
              </Button>
              <button
                onClick={handleDismiss}
                className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



