/**
 * PWA install hook — exposes the browser's `beforeinstallprompt` event so a
 * page (currently /download) can offer an "Install Web App" button.
 *
 * The previous floating popup was removed; the install affordance now lives
 * only on the Download page so it doesn't follow the user around the site.
 */

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PWAInstallState {
  canInstall: boolean
  isInstalled: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(display-mode: standalone)').matches
    ) {
      setIsInstalled(true)
      return
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('pwa-installed') === 'true') {
      setIsInstalled(true)
      return
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      try {
        localStorage.setItem('pwa-installed', 'true')
      } catch {}
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        try {
          localStorage.setItem('pwa-installed', 'true')
        } catch {}
      }
      setDeferredPrompt(null)
      return outcome
    } catch (err) {
      console.error('PWA install failed:', err)
      setDeferredPrompt(null)
      return 'unavailable'
    }
  }

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    install,
  }
}
