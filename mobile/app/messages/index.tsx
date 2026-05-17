import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, radius, spacing, palette } from '@/theme'
import { messagesAPI, ConversationSummary } from '@/lib/services'

export default function MessagesIndex() {
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await messagesAPI.conversations()
      setItems(rows)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      <View style={{ gap: spacing.md }}>
        <Text style={{ color: colors.textMuted }}>
          Conversations with your GritSync advisors and admins.
        </Text>

        {loading ? (
          <Card><Text style={{ color: colors.textMuted }}>Loading…</Text></Card>
        ) : items.length === 0 ? (
          <Card>
            <CardTitle>No conversations yet</CardTitle>
            <CardSubtitle>
              Your advisor will start a conversation once your application is in progress.
            </CardSubtitle>
          </Card>
        ) : (
          items.map((c) => <ConversationRow key={c.user_id} c={c} onPress={() => router.push(`/messages/${c.user_id}`)} />)
        )}
      </View>
    </Screen>
  )
}

function ConversationRow({ c, onPress }: { c: ConversationSummary; onPress: () => void }) {
  const { colors } = useTheme()
  const unread = Number(c.unread_count ?? 0) > 0
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'GritSync'
  const role = (c.role ?? '').replace(/^./, (s) => s.toUpperCase())

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: unread ? palette.brand.red50 : colors.surfaceMuted,
            borderColor: unread ? palette.brand.red500 : colors.border,
          },
        ]}
      >
        <Text style={{ color: palette.brand.red700, fontWeight: '800', fontSize: 16 }}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {name}
          </Text>
          {role ? (
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: radius.full,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>{role}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
          {c.last_message ?? c.last_subject ?? 'No messages yet'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {c.last_message_at ? formatRelative(c.last_message_at) : ''}
        </Text>
        {unread ? (
          <View style={styles.unreadDot}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
              {String(c.unread_count)}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!isFinite(t)) return iso
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    backgroundColor: palette.brand.red600,
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
