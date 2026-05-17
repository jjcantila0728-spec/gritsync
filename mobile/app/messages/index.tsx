import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/ErrorState'
import { SkeletonRow } from '@/components/Skeleton'
import { useTheme, palette, radius, spacing } from '@/theme'
import { messagesAPI, type ConversationSummary } from '@/lib/services'
import { errorMessage } from '@/lib/api'

export default function MessagesIndex() {
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      setItems(await messagesAPI.conversations())
    } catch (e) {
      setError(errorMessage(e, "Couldn't load conversations"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totalUnread = useMemo(
    () => items.reduce((acc, c) => acc + Number(c.unread_count ?? 0), 0),
    [items],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase()
      return (
        name.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.last_message?.toLowerCase().includes(q) ||
        c.last_subject?.toLowerCase().includes(q)
      )
    })
  }, [items, search])

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
          title="Messages"
          subtitle={
            totalUnread > 0
              ? `${totalUnread} unread · Conversations with advisors and admins`
              : 'Conversations with your GritSync advisors and admins'
          }
          icon="chatbubbles"
        />

        {/* Search */}
        {items.length > 0 ? (
          <View
            style={[
              styles.search,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or message"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.text, paddingVertical: 8 }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <ErrorState
            variant="error"
            title="Couldn't load conversations"
            body={error}
            onRetry={() => {
              setLoading(true)
              void load()
            }}
          />
        ) : items.length === 0 ? (
          <ErrorState
            variant="empty"
            icon="chatbubble-ellipses-outline"
            title="No conversations yet"
            body="Your advisor will start a conversation once your application is in progress. You'll get a push notification when they message you."
          />
        ) : filtered.length === 0 ? (
          <ErrorState
            variant="empty"
            icon="search-outline"
            title="No matches"
            body={`No conversations matching "${search.trim()}".`}
            retryLabel="Clear search"
            onRetry={() => setSearch('')}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((c) => (
              <ConversationRow
                key={c.user_id}
                c={c}
                onPress={() => router.push(`/messages/${c.user_id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  )
}

function ConversationRow({ c, onPress }: { c: ConversationSummary; onPress: () => void }) {
  const { colors } = useTheme()
  const unread = Number(c.unread_count ?? 0) > 0
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'GritSync'
  const initials = ((c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')).toUpperCase() || (c.email?.[0]?.toUpperCase() ?? 'G')
  const role = (c.role ?? '').replace(/^./, (s) => s.toUpperCase())
  const fromMe = c.last_sender_id != null && c.last_sender_id !== c.user_id

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
          styles.avatar,
          {
            backgroundColor: unread ? palette.brand.red100 : colors.surfaceMuted,
            borderColor: unread ? palette.brand.red500 : colors.border,
          },
        ]}
      >
        <Text style={{ color: palette.brand.red700, fontWeight: '800', fontSize: 15 }}>
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {name}
          </Text>
          {role ? (
            <View
              style={[
                styles.roleChip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>{role}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
          {fromMe ? 'You: ' : ''}
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
        ) : (
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        )}
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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
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
