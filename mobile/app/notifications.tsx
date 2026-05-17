import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/ErrorState'
import { SkeletonRow } from '@/components/Skeleton'
import { useTheme, palette, radius, spacing } from '@/theme'
import { useAuth } from '@/contexts/AuthContext'
import { notificationsAPI, type NotificationRow } from '@/lib/services'
import { errorMessage } from '@/lib/api'
import { openUrl } from '@/lib/browser'
import { deepLinkFromPushData } from '@/lib/push'

export default function NotificationsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setError(null)
    try {
      const rows = await notificationsAPI.list(user.id)
      setItems(rows)
    } catch (e) {
      setError(errorMessage(e, "Couldn't load notifications"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const unread = items.filter((n) => !n.is_read).length

  const grouped = useMemo(() => groupByDate(items), [items])

  /**
   * Routing strategy for taps:
   *   1. If the notification has a structured `data` payload (from push),
   *      use the same deep-link resolver as push taps.
   *   2. Otherwise, if `link`/`url` is in-app (starts with `/`), router.push.
   *   3. Otherwise, if `link`/`url` is a web URL, open in-app browser.
   *   4. As a last resort, show the message body in an alert.
   */
  async function onItemPress(n: NotificationRow) {
    if (!n.is_read) {
      try {
        await notificationsAPI.markRead(n.id)
        setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      } catch {
        // optimistic ui — server failure is non-fatal
      }
    }
    const route = deepLinkFromPushData({ ...(n as any).data, type: n.type, link: n.link ?? n.url })
    if (route) {
      router.push(route as any)
      return
    }
    const url = n.link || n.url
    if (url && url.startsWith('http')) {
      await openUrl(url)
      return
    }
    Alert.alert(n.title || 'Notification', n.message || n.body || '')
  }

  async function onMarkAll() {
    if (!user?.id || unread === 0) return
    // Optimistic — flip everything to read first, roll back on error.
    const prev = items
    setItems((cur) => cur.map((x) => ({ ...x, is_read: true })))
    try {
      await notificationsAPI.markAllRead(user.id)
    } catch (e) {
      setItems(prev)
      Alert.alert('Could not mark all as read', errorMessage(e))
    }
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      <View style={{ gap: spacing.lg }}>
        <PageHeader
          title={unread > 0 ? `${unread} unread` : 'All caught up'}
          subtitle={
            unread > 0
              ? 'Updates from your GritSync team. Tap any item to view details.'
              : "You've reviewed everything. We'll let you know when something changes."
          }
          icon={unread > 0 ? 'notifications' : 'checkmark-done-circle'}
          action={
            unread > 0
              ? { label: 'Mark all read', onPress: onMarkAll, icon: 'checkmark-done' }
              : undefined
          }
        />

        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <ErrorState
            variant="error"
            title="Couldn't load notifications"
            body={error}
            retryLabel="Try again"
            onRetry={() => {
              setLoading(true)
              void load()
            }}
          />
        ) : items.length === 0 ? (
          <ErrorState
            variant="empty"
            icon="notifications-off-outline"
            title="No notifications yet"
            body="Status updates, payment receipts, and advisor notes will show up here as soon as something changes."
            retryLabel="Go home"
            onRetry={() => router.replace('/(tabs)/home')}
          />
        ) : (
          grouped.map((group) => (
            <View key={group.label} style={{ gap: spacing.sm }}>
              <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.label}</Text>
              <View style={{ gap: spacing.sm }}>
                {group.items.map((n) => (
                  <NotificationRowView key={n.id} row={n} onPress={() => onItemPress(n)} />
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  )
}

function NotificationRowView({ row, onPress }: { row: NotificationRow; onPress: () => void }) {
  const { colors } = useTheme()
  const unread = !row.is_read
  const tone = iconToneFor(row.type)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: unread ? palette.brand.red50 : colors.surface,
          borderColor: unread ? palette.brand.red100 : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: unread ? tone.bgActive : colors.surfaceMuted,
            borderColor: unread ? tone.borderActive : colors.border,
          },
        ]}
      >
        <Ionicons
          name={iconFor(row.type)}
          size={18}
          color={unread ? tone.fgActive : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {row.title ?? 'Notification'}
        </Text>
        {row.message || row.body ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {row.message ?? row.body}
          </Text>
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {row.created_at ? formatRelative(row.created_at) : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        {unread ? (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.brand.red600 }} />
        ) : null}
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  )
}

function iconFor(type?: string | null): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'payment':
      return 'card-outline'
    case 'document':
      return 'document-text-outline'
    case 'application':
      return 'briefcase-outline'
    case 'message':
      return 'chatbubble-outline'
    case 'system':
      return 'megaphone-outline'
    case 'announcement':
      return 'megaphone-outline'
    case 'nclex':
    case 'review':
      return 'school-outline'
    default:
      return 'notifications-outline'
  }
}

function iconToneFor(type?: string | null): {
  bgActive: string
  borderActive: string
  fgActive: string
} {
  // Each notification type gets a subtle accent. Falls back to brand red.
  switch (type) {
    case 'payment':
      return { bgActive: '#DCFCE7', borderActive: '#86EFAC', fgActive: '#15803D' }
    case 'document':
      return { bgActive: '#DBEAFE', borderActive: '#93C5FD', fgActive: '#1D4ED8' }
    case 'message':
      return { bgActive: '#FAE8FF', borderActive: '#E9D5FF', fgActive: '#7C3AED' }
    case 'application':
    default:
      return {
        bgActive: palette.brand.red100,
        borderActive: palette.brand.red500,
        fgActive: palette.brand.red700,
      }
  }
}

function groupByDate(items: NotificationRow[]): Array<{ label: string; items: NotificationRow[] }> {
  const today: NotificationRow[] = []
  const yesterday: NotificationRow[] = []
  const thisWeek: NotificationRow[] = []
  const earlier: NotificationRow[] = []

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86400_000
  const startOfWeek = startOfToday - 6 * 86400_000

  for (const n of items) {
    const t = n.created_at ? new Date(n.created_at).getTime() : 0
    if (!isFinite(t) || t === 0) {
      earlier.push(n)
      continue
    }
    if (t >= startOfToday) today.push(n)
    else if (t >= startOfYesterday) yesterday.push(n)
    else if (t >= startOfWeek) thisWeek.push(n)
    else earlier.push(n)
  }

  const groups: Array<{ label: string; items: NotificationRow[] }> = []
  if (today.length) groups.push({ label: 'Today', items: today })
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday })
  if (thisWeek.length) groups.push({ label: 'This week', items: thisWeek })
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier })
  return groups
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!isFinite(t)) return iso
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
})
