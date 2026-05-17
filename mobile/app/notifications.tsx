import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useTheme, radius, spacing, palette } from '@/theme'
import { useAuth } from '@/contexts/AuthContext'
import { notificationsAPI, NotificationRow } from '@/lib/services'
import { errorMessage } from '@/lib/api'

export default function NotificationsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const rows = await notificationsAPI.list(user.id)
      setItems(rows)
    } catch {
      // ignore — empty state will show
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const unread = items.filter((n) => !n.is_read).length

  async function onItemPress(n: NotificationRow) {
    if (!n.is_read) {
      try {
        await notificationsAPI.markRead(n.id)
        setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      } catch {
        // ignore
      }
    }
    const url = n.link || n.url
    if (url) {
      try {
        await Linking.openURL(url)
      } catch {
        // ignore
      }
    } else {
      Alert.alert(n.title || 'Notification', n.message || n.body || '')
    }
  }

  async function onMarkAll() {
    if (!user?.id || unread === 0) return
    try {
      await notificationsAPI.markAllRead(user.id)
      setItems((cur) => cur.map((x) => ({ ...x, is_read: true })))
    } catch (e) {
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
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </Text>
            <Text style={{ color: colors.textMuted }}>Updates from your GritSync team.</Text>
          </View>
          {unread > 0 ? (
            <Pressable onPress={onMarkAll} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <Card><Text style={{ color: colors.textMuted }}>Loading…</Text></Card>
        ) : items.length === 0 ? (
          <Card>
            <CardTitle>No notifications</CardTitle>
            <CardSubtitle>You'll see status updates, payment receipts, and advisor notes here.</CardSubtitle>
            <Button title="Go home" variant="secondary" onPress={() => router.replace('/(tabs)/home')} />
          </Card>
        ) : (
          items.map((n) => <NotificationRowView key={n.id} row={n} onPress={() => onItemPress(n)} />)
        )}
      </View>
    </Screen>
  )
}

function NotificationRowView({ row, onPress }: { row: NotificationRow; onPress: () => void }) {
  const { colors } = useTheme()
  const unread = !row.is_read
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
            backgroundColor: unread ? palette.brand.red100 : colors.surfaceMuted,
            borderColor: unread ? palette.brand.red500 : colors.border,
          },
        ]}
      >
        <Ionicons name={iconFor(row.type)} size={18} color={unread ? palette.brand.red700 : colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {row.title ?? 'Notification'}
        </Text>
        {row.message || row.body ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>
            {row.message ?? row.body}
          </Text>
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{row.created_at ? formatRelative(row.created_at) : ''}</Text>
      </View>
      {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.brand.red600 }} /> : null}
    </Pressable>
  )
}

function iconFor(type?: string | null): any {
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
    default:
      return 'notifications-outline'
  }
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
  return new Date(iso).toLocaleDateString()
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
})
