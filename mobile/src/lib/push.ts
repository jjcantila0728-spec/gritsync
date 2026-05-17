import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { api } from './api'
import { storage } from './storage'

const ENABLED_KEY = 'gritsync.push.enabled'
const TOKEN_KEY = 'gritsync.push.token'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Map a push-notification data payload to an in-app route.
 *
 * Server-side, server/lib/notify.ts builds the data block as:
 *   { type, link, notificationId, ...callerData }
 *
 * We use `type` + any structured ids in callerData to pick the right
 * route; `link` is the fallback for cases where the server only knows
 * the destination URL.
 */
export function deepLinkFromPushData(
  data: Record<string, unknown> | undefined | null,
): string | null {
  if (!data) return null
  const type = String(data.type ?? '').toLowerCase()
  const applicationId = data.applicationId ?? data.application_id
  const userId = data.userId ?? data.user_id ?? data.senderId ?? data.sender_id
  const sessionId = data.sessionId ?? data.session_id
  const link = typeof data.link === 'string' ? data.link : null

  switch (type) {
    case 'application':
    case 'payment':
      if (typeof applicationId === 'string') return `/applications/${applicationId}`
      return null
    case 'message':
      if (typeof userId === 'string') return `/messages/${userId}`
      return '/messages'
    case 'notification':
    case 'announcement':
      return '/notifications'
    case 'document':
      return '/(tabs)/docs'
    case 'nclex':
    case 'review': {
      if (typeof sessionId === 'string') return `/review/exam/${sessionId}`
      return '/(tabs)/review'
    }
    default:
      // Fall through to link if it looks like an in-app route.
      if (link && link.startsWith('/')) return link
      return null
  }
}

export const push = {
  async isEnabled(): Promise<boolean> {
    return (await storage.get(ENABLED_KEY)) === '1'
  },

  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) await storage.set(ENABLED_KEY, '1')
    else await storage.remove(ENABLED_KEY)
  },

  async permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    const { status } = await Notifications.getPermissionsAsync()
    return status as any
  },

  /**
   * Ask for the OS permission and (on grant) register an Expo push token,
   * sending it to the backend so it can target this device.
   *
   * Returns the token string on success, null otherwise. Safe to call from a
   * Settings toggle — handles every failure mode (simulator, denied, etc.).
   */
  async register(): Promise<string | null> {
    try {
      // Android-only: notification channel is required for any push to render.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'GritSync',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#DC2626',
          vibrationPattern: [0, 250, 250, 250],
        })
      }

      const existing = await Notifications.getPermissionsAsync()
      let status = existing.status
      if (status !== 'granted') {
        const asked = await Notifications.requestPermissionsAsync()
        status = asked.status
      }
      if (status !== 'granted') return null

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
      const tokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      )
      const token = tokenResult?.data
      if (!token) return null

      await storage.set(TOKEN_KEY, token)
      await this.setEnabled(true)

      // Persist on the backend. Failure is non-fatal — we still keep the local
      // copy so the next app open can retry.
      try {
        await api.put('/auth/update', { push_token: token })
      } catch {
        // ignore
      }
      return token
    } catch {
      return null
    }
  },

  async unregister(): Promise<void> {
    await storage.remove(TOKEN_KEY)
    await this.setEnabled(false)
    try {
      await api.put('/auth/update', { push_token: null })
    } catch {
      // ignore
    }
  },

  async getCachedToken(): Promise<string | null> {
    return storage.get(TOKEN_KEY)
  },

  /** Show a local notification immediately — useful for testing. */
  async showLocal(title: string, body: string) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    })
  },

  /** Reset the app-icon badge to zero. */
  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0)
    } catch {
      // ignore
    }
  },

  async setBadge(count: number) {
    try {
      await Notifications.setBadgeCountAsync(Math.max(0, count))
    } catch {
      // ignore
    }
  },
}
