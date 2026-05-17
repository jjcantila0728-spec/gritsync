import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, spacing, radius, palette } from '@/theme'
import { dbList } from '@/lib/db'
import { Application } from '@/lib/types'
import { messagesAPI, notificationsAPI } from '@/lib/services'

export default function HomeScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const [rows, mUnread, notifs] = await Promise.all([
        dbList<Application>('applications', {
          filter: { user_id: user.id },
          order: 'created_at.desc',
          limit: 20,
        }),
        messagesAPI.unreadCount().catch(() => 0),
        notificationsAPI.list(user.id, 50).catch(() => []),
      ])
      setApps(rows)
      setUnreadMessages(mUnread)
      setUnreadNotifs(notifs.filter((n) => !n.is_read).length)
    } catch {
      // surfaced by interceptor / refresh button
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const active = apps.filter((a) => a.status !== 'completed' && a.status !== 'cancelled').length
  const completed = apps.filter((a) => a.status === 'completed').length

  const featured = useMemo(() => apps[0] ?? null, [apps])
  const greeting = useMemo(() => greetingFor(new Date()), [])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.brand.red700 }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={[palette.brand.red600]}
            progressBackgroundColor={palette.brand.red50}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[palette.brand.red700, palette.brand.red600, palette.brand.red500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>{greeting}</Text>
              <Text style={styles.heroName}>
                {user?.first_name ? `${user.first_name}` : 'Welcome'}
              </Text>
              {user?.grit_id ? (
                <View style={styles.idChip}>
                  <Ionicons name="shield-checkmark-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.idChipText}>{user.grit_id}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeroIconBtn
                icon="notifications-outline"
                badge={unreadNotifs}
                onPress={() => router.push('/notifications')}
              />
              <HeroIconBtn
                icon="chatbubbles-outline"
                badge={unreadMessages}
                onPress={() => router.push('/messages')}
              />
            </View>
          </View>

          <View style={styles.heroStats}>
            <HeroStat label="Active" value={loading ? '—' : String(active)} />
            <View style={styles.heroDivider} />
            <HeroStat label="Completed" value={loading ? '—' : String(completed)} />
            <View style={styles.heroDivider} />
            <HeroStat label="Total" value={loading ? '—' : String(apps.length)} />
          </View>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.xl }}>
          {/* Active application spotlight */}
          {featured ? (
            <Pressable
              onPress={() => router.push(`/applications/${featured.id}`)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <View
                style={[
                  styles.spotlight,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.eyebrow, { color: palette.brand.red600 }]}>ACTIVE APPLICATION</Text>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
                    {labelForApp(featured)}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
                    {featured.current_stage ?? featured.status ?? 'In progress'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <StatusPill status={featured.status} />
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      Tap for full timeline →
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: palette.brand.red50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="arrow-forward" size={20} color={palette.brand.red600} />
                </View>
              </View>
            </Pressable>
          ) : null}

          {/* Quick actions grid */}
          <View>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Quick actions</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              <QuickAction
                icon="add-circle"
                label="Apply"
                tint={palette.brand.red600}
                bg={palette.brand.red50}
                onPress={() => router.push('/apply')}
              />
              <QuickAction
                icon="folder"
                label="Documents"
                tint="#7C3AED"
                bg="#F5F3FF"
                onPress={() => router.push('/(tabs)/docs')}
              />
              <QuickAction
                icon="mail"
                label="Emails"
                tint="#2563EB"
                bg="#EFF6FF"
                onPress={() => router.push('/emails')}
              />
              <QuickAction
                icon="school"
                label="Review"
                tint="#059669"
                bg="#ECFDF5"
                onPress={() => router.push('/(tabs)/review')}
              />
            </View>
          </View>

          {/* Applications list */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <CardTitle>Your applications</CardTitle>
              {apps.length > 4 ? (
                <Pressable onPress={() => router.push('/(tabs)/timeline')} hitSlop={6}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>See all</Text>
                </Pressable>
              ) : null}
            </View>
            <CardSubtitle>Latest activity across your NCLEX journey</CardSubtitle>
            {loading ? (
              <Text style={{ color: colors.textMuted }}>Loading…</Text>
            ) : apps.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: palette.brand.red50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="briefcase-outline" size={28} color={palette.brand.red600} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '700' }}>No applications yet</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                  Tap Apply to start your first NCLEX application.
                </Text>
                <Pressable
                  onPress={() => router.push('/apply')}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: palette.brand.red600,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: radius.full,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Start application</Text>
                </Pressable>
              </View>
            ) : (
              apps.slice(0, 4).map((a, i) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/applications/${a.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600' }}>
                      {labelForApp(a)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {a.current_stage ?? a.status ?? 'In progress'}
                    </Text>
                  </View>
                  <StatusPill status={a.status} />
                </Pressable>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function greetingFor(d: Date): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function labelForApp(a: Application): string {
  const sub = a.service_subtype ? ` — ${a.service_subtype}` : ''
  return `${(a.service_type ?? 'Application').toUpperCase()}${sub}`
}

function HeroIconBtn({
  icon,
  badge,
  onPress,
}: {
  icon: any
  badge: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon} size={20} color="#FFFFFF" />
      {badge > 0 ? (
        <View style={styles.heroBadge}>
          <Text style={{ color: palette.brand.red700, fontSize: 10, fontWeight: '800' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  )
}

function StatusPill({ status }: { status?: string }) {
  const text = (status ?? 'pending').replace(/_/g, ' ')
  const tone = pillTone(status)
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={{ color: tone.fg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {text}
      </Text>
    </View>
  )
}

function pillTone(status?: string) {
  switch (status) {
    case 'completed':
      return { bg: '#DCFCE7', border: '#86EFAC', fg: '#15803D' }
    case 'in-progress':
    case 'in_progress':
      return { bg: '#DBEAFE', border: '#93C5FD', fg: '#1D4ED8' }
    case 'rejected':
    case 'cancelled':
      return { bg: '#FEE2E2', border: '#FCA5A5', fg: palette.brand.red700 }
    default:
      return { bg: '#FEF3C7', border: '#FCD34D', fg: '#B45309' }
  }
}

function QuickAction({
  icon,
  label,
  tint,
  bg,
  onPress,
}: {
  icon: any
  label: string
  tint: string
  bg: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroGreeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 8,
  },
  idChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  spotlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quick: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
})
