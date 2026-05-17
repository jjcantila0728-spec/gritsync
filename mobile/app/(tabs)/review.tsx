import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { useAuth } from '@/contexts/AuthContext'
import {
  bankLabel,
  bankSummary,
  formatExamType,
  nclexAPI,
  type Bank,
  type HomeData,
} from '@/lib/nclex'
import { VideosSection } from '@/components/review/VideosSection'
import { CheatsheetsSection } from '@/components/review/CheatsheetsSection'
import { LiveSection } from '@/components/review/LiveSection'
import { CalendarSection } from '@/components/review/CalendarSection'
import { TestimonialsSection } from '@/components/review/TestimonialsSection'
import { SubscriptionSection } from '@/components/review/SubscriptionSection'
import { StudySuggestions } from '@/components/review/StudySuggestions'
import { CreateTestModal } from '@/components/review/CreateTestModal'

type Section = 'qbanks' | 'videos' | 'cheatsheets' | 'live' | 'calendar' | 'testimonials' | 'subscription'

const SECTIONS: Array<{ key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'qbanks', label: 'Q-Banks', icon: 'library-outline' },
  { key: 'videos', label: 'Videos', icon: 'videocam-outline' },
  { key: 'live', label: 'Live', icon: 'radio-outline' },
  { key: 'cheatsheets', label: 'Cheatsheets', icon: 'document-text-outline' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  { key: 'testimonials', label: 'Stories', icon: 'heart-outline' },
  { key: 'subscription', label: 'Plans', icon: 'star-outline' },
]

export default function ReviewHub() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [section, setSection] = useState<Section>('qbanks')
  const [createTestOpen, setCreateTestOpen] = useState(false)
  const [home, setHome] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await nclexAPI.home()
      setHome(data)
    } catch {
      // surfaced by 401 interceptor; empty state shows otherwise
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const examDate = home?.profile?.examDate
  const daysToExam = useMemo(() => {
    if (!examDate) return null
    const ms = new Date(examDate).getTime() - Date.now()
    if (!isFinite(ms)) return null
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  }, [examDate])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.brand.red700 }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        <LinearGradient
          colors={[palette.brand.red700, palette.brand.red600, palette.brand.red500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.eyebrow}>NCLEX REVIEW</Text>
              <Text style={styles.heroTitle}>
                {user?.first_name ? `Hi, ${user.first_name}` : 'Get ready to pass'}
              </Text>
              <View style={styles.tierRow}>
                <View style={styles.tierChip}>
                  <Ionicons name="star" size={11} color="#FFFFFF" />
                  <Text style={styles.tierChipText}>
                    {home?.profile?.tier ?? 'FREE'}
                  </Text>
                </View>
                {daysToExam !== null ? (
                  <View style={styles.tierChip}>
                    <Ionicons name="calendar" size={11} color="#FFFFFF" />
                    <Text style={styles.tierChipText}>
                      {daysToExam} {daysToExam === 1 ? 'day' : 'days'} to exam
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="school" size={28} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.heroStats}>
            <HeroStat
              label="Today"
              value={loading ? '—' : String(home?.questionsToday ?? 0)}
              suffix="qs"
            />
            <View style={styles.heroDivider} />
            <HeroStat
              label="Sessions"
              value={loading ? '—' : String(home?.stats.totalSessions ?? 0)}
            />
            <View style={styles.heroDivider} />
            <HeroStat
              label="Avg RA"
              value={loading ? '—' : (home?.peerStats.avgRA != null ? `${home.peerStats.avgRA}%` : '—')}
            />
          </View>
        </LinearGradient>

        {/* Section chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ marginTop: -spacing.lg, zIndex: 2 }}
        >
          {SECTIONS.map((s) => {
            const active = section === s.key
            return (
              <Pressable
                key={s.key}
                onPress={() => setSection(s.key)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: active ? palette.brand.red600 : colors.surface,
                    borderColor: active ? palette.brand.red600 : colors.border,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name={s.icon} size={14} color={active ? '#FFFFFF' : colors.text} />
                <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: '700', fontSize: 13 }}>
                  {s.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {loading ? (
            <Card>
              <View style={{ alignItems: 'center', padding: spacing.xl }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            </Card>
          ) : section === 'qbanks' ? (
            <>
              <CreateTestCta onPress={() => setCreateTestOpen(true)} />
              <StudySuggestions home={home} />
              <QbanksSection home={home} onStart={(bank) => router.push(`/review/qbanks/${bank}` as any)} />
            </>
          ) : section === 'videos' ? (
            <VideosSection />
          ) : section === 'live' ? (
            <LiveSection />
          ) : section === 'cheatsheets' ? (
            <CheatsheetsSection />
          ) : section === 'calendar' ? (
            <CalendarSection />
          ) : section === 'testimonials' ? (
            <TestimonialsSection />
          ) : (
            <SubscriptionSection profile={home?.profile ?? null} onUpdated={() => void load()} />
          )}
        </View>
      </ScrollView>

      <CreateTestModal
        visible={createTestOpen}
        onClose={() => setCreateTestOpen(false)}
        home={home}
      />
    </SafeAreaView>
  )
}

function CreateTestCta({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        ctaStyles.wrap,
        pressed && { opacity: 0.9 },
      ]}
    >
      <LinearGradient
        colors={[palette.brand.red700, palette.brand.red600, palette.brand.red500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={ctaStyles.gradient}
      >
        <View style={ctaStyles.iconCircle}>
          <Ionicons name="add" size={24} color={palette.brand.red700} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ctaStyles.eyebrow}>CREATE TEST</Text>
          <Text style={ctaStyles.title}>Custom practice or full exam</Text>
          <Text style={ctaStyles.sub}>
            Pick a mode, bank, topics, and length — start a session in seconds.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
      </LinearGradient>
    </Pressable>
  )
}

function QbanksSection({
  home,
  onStart,
}: {
  home: HomeData | null
  onStart: (bank: Bank) => void
}) {
  const { colors } = useTheme()
  const banks = home?.stats.questionBanks ?? []
  const usedByBank = home?.stats.usedByBank ?? {}
  const sessions = home?.sessions ?? []

  if (banks.length === 0) {
    return (
      <Card>
        <CardTitle>No Q-Banks yet</CardTitle>
        <CardSubtitle>
          Your admin hasn't activated any question banks. Check back soon.
        </CardSubtitle>
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.md }}>
        {banks.map((b) => {
          const used = usedByBank[b.bank] ?? 0
          const pct = b._count > 0 ? Math.min(100, Math.round((used / b._count) * 100)) : 0
          return (
            <Pressable
              key={b.bank}
              onPress={() => onStart(b.bank)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <View
                style={[
                  styles.bankCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={[
                      styles.bankIcon,
                      { backgroundColor: b.bank === 'NGN' ? '#EFF6FF' : palette.brand.red50 },
                    ]}
                  >
                    <Ionicons
                      name={b.bank === 'NGN' ? 'sparkles' : 'library'}
                      size={22}
                      color={b.bank === 'NGN' ? '#2563EB' : palette.brand.red600}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                      {bankLabel(b.bank)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                      {bankSummary(b.bank)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
                <View style={{ marginTop: spacing.md, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                      {used} / {b._count} answered
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800' }}>
                      {pct}%
                    </Text>
                  </View>
                  <View style={[styles.progressOuter, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.progressInner, { width: `${pct}%` }]} />
                  </View>
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>

      <Card>
        <CardTitle>Recent sessions</CardTitle>
        {sessions.length === 0 ? (
          <CardSubtitle>You haven't started any exams yet. Tap a Q-Bank above to begin.</CardSubtitle>
        ) : (
          sessions.slice(0, 5).map((s, i) => (
            <SessionRow key={s.id} session={s} index={i} />
          ))
        )}
      </Card>
    </View>
  )
}

function SessionRow({ session, index }: { session: HomeData['sessions'][number]; index: number }) {
  const { colors } = useTheme()
  const router = useRouter()
  const isDone = session.status === 'COMPLETED'
  const action = isDone ? `/review/results/${session.id}` : `/review/exam/${session.id}`
  return (
    <Pressable
      onPress={() => router.push(action as any)}
      style={({ pressed }) => [
        styles.sessionRow,
        { borderTopColor: colors.border, borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
          {formatExamType(session.examType)}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {isDone
            ? `Completed · ${session.correctCount ?? 0} correct`
            : `In progress · question ${(session.currentIndex ?? 0) + 1}`}
        </Text>
      </View>
      <View style={[styles.statusPill, statusTone(session.status)]}>
        <Text style={{ color: statusTone(session.status).color, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
          {session.status === 'IN_PROGRESS' ? 'Resume' : isDone ? 'View' : 'Closed'}
        </Text>
      </View>
    </Pressable>
  )
}

function statusTone(status: string): { backgroundColor: string; borderColor: string; color: string; borderWidth: number; paddingHorizontal: number; paddingVertical: number; borderRadius: number } {
  const base = { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }
  switch (status) {
    case 'COMPLETED':
      return { ...base, backgroundColor: '#DCFCE7', borderColor: '#86EFAC', color: '#15803D' }
    case 'IN_PROGRESS':
      return { ...base, backgroundColor: palette.brand.red50, borderColor: palette.brand.red500, color: palette.brand.red700 }
    default:
      return { ...base, backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', color: '#6B7280' }
  }
}

function HeroStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={styles.heroStatValue}>
        {value}
        {suffix ? <Text style={styles.heroStatSuffix}> {suffix}</Text> : null}
      </Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  )
}

function ComingSoonCard({ icon, title, copy }: { icon: any; title: string; copy: string }) {
  const { colors } = useTheme()
  return (
    <Card>
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
          <Ionicons name={icon} size={28} color={palette.brand.red600} />
        </View>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13 }}>{copy}</Text>
      </View>
    </Card>
  )
}

const ctaStyles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  sub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
})

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.md,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tierChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
  heroStatSuffix: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chipsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  bankCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  bankIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressOuter: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressInner: {
    height: '100%',
    backgroundColor: palette.brand.red600,
    borderRadius: radius.full,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  statusPill: {
    minWidth: 64,
    alignItems: 'center',
  },
})
