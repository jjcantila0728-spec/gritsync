import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useTheme, palette, radius, spacing } from '@/theme'
import {
  bankLabel,
  bankSummary,
  formatExamType,
  nclexAPI,
  type Bank,
  type HomeData,
} from '@/lib/nclex'
import { errorMessage } from '@/lib/api'

type Tab = 'statistics' | 'previous' | 'remediation'

const TABS: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'statistics', label: 'Statistics', icon: 'stats-chart-outline' },
  { key: 'previous', label: 'Previous tests', icon: 'time-outline' },
  { key: 'remediation', label: 'Remediation', icon: 'medical-outline' },
]

export default function QbankDetailScreen() {
  const params = useLocalSearchParams<{ bank: string }>()
  const bank = (params.bank ?? 'CLASSIC') as Bank
  const { colors } = useTheme()
  const router = useRouter()
  const [home, setHome] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [tab, setTab] = useState<Tab>('statistics')

  const load = useCallback(async () => {
    try {
      setHome(await nclexAPI.home())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const bankStats = useMemo(() => {
    const total = home?.stats.questionBanks.find((b) => b.bank === bank)?._count ?? 0
    const used = home?.stats.usedByBank?.[bank] ?? 0
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
    return { total, used, pct }
  }, [home, bank])

  const sessionsForBank = useMemo(
    () =>
      (home?.sessions ?? []).filter((s) => {
        // No bank stamp on sessions in /home payload — show all by default.
        // Filtering on bank can be added when the server enriches the row.
        void s
        return true
      }),
    [home],
  )

  async function startExam(examType: 'TUTORIAL' | 'READINESS_ASSESSMENT' | 'CAT') {
    setStarting(true)
    try {
      const { session } = await nclexAPI.startSession({ examType, bank })
      router.replace(`/review/exam/${session.id}`)
    } catch (e) {
      Alert.alert("Couldn't start exam", errorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: bankLabel(bank),
          headerShown: true,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View
              style={[
                styles.bankIcon,
                { backgroundColor: bank === 'NGN' ? '#EFF6FF' : palette.brand.red50 },
              ]}
            >
              <Ionicons
                name={bank === 'NGN' ? 'sparkles' : 'library'}
                size={26}
                color={bank === 'NGN' ? '#2563EB' : palette.brand.red600}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <CardTitle>{bankLabel(bank)}</CardTitle>
              <CardSubtitle>{bankSummary(bank)}</CardSubtitle>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                  {bankStats.used} / {bankStats.total}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>answered</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ color: palette.brand.red700, fontSize: 12, fontWeight: '800' }}>
                  {bankStats.pct}%
                </Text>
              </View>
              <View style={[styles.progressOuter, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.progressInner, { width: `${bankStats.pct}%` }]} />
              </View>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={starting ? 'Starting…' : 'Tutorial'}
            variant="secondary"
            onPress={() => startExam('TUTORIAL')}
            loading={starting}
            style={{ flex: 1 }}
          />
          <Button
            title="Readiness"
            onPress={() => startExam('READINESS_ASSESSMENT')}
            loading={starting}
            style={{ flex: 1 }}
          />
        </View>

        {/* Tab bar */}
        <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.tab,
                  active && { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name={t.icon} size={14} color={active ? colors.text : colors.textMuted} />
                <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {loading ? (
          <Card>
            <View style={{ alignItems: 'center', padding: spacing.xl }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          </Card>
        ) : tab === 'statistics' ? (
          <StatisticsTab home={home} bank={bank} bankStats={bankStats} />
        ) : tab === 'previous' ? (
          <PreviousTab sessions={sessionsForBank} />
        ) : (
          <RemediationTab home={home} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatisticsTab({ home, bankStats }: { home: HomeData | null; bank: Bank; bankStats: { total: number; used: number; pct: number } }) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <CardTitle>Peer averages</CardTitle>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile label="Readiness avg" value={home?.peerStats.avgRA != null ? `${home.peerStats.avgRA}%` : '—'} />
          <StatTile label="CAT avg" value={home?.peerStats.avgCAT != null ? `${home.peerStats.avgCAT}%` : '—'} />
        </View>
      </Card>
      <Card>
        <CardTitle>Coverage</CardTitle>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          You've answered {bankStats.used} of {bankStats.total} unique questions in this bank.
        </Text>
        {(home?.stats.byTopic ?? []).slice(0, 8).map((t) => (
          <View key={t.topic} style={{ paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                {t.topic}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {home?.stats.usedByTopic?.[t.topic] ?? 0} / {t.count}
              </Text>
            </View>
            <View style={{ height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 2, marginTop: 4 }}>
              <View
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round(((home?.stats.usedByTopic?.[t.topic] ?? 0) / Math.max(1, t.count)) * 100))}%`,
                  backgroundColor: palette.brand.red600,
                  borderRadius: 2,
                }}
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  )
}

function PreviousTab({ sessions }: { sessions: HomeData['sessions'] }) {
  const { colors } = useTheme()
  const router = useRouter()
  if (sessions.length === 0) {
    return (
      <Card>
        <CardTitle>No past tests</CardTitle>
        <CardSubtitle>Start a Tutorial or Readiness exam to see your history.</CardSubtitle>
      </Card>
    )
  }
  return (
    <Card>
      {sessions.map((s, i) => (
        <Pressable
          key={s.id}
          onPress={() => {
            if (s.status === 'COMPLETED') router.push(`/review/results/${s.id}`)
            else if (s.status === 'IN_PROGRESS') router.push(`/review/exam/${s.id}`)
          }}
          style={({ pressed }) => [
            styles.sessionRow,
            { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
              {formatExamType(s.examType)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {s.status === 'COMPLETED'
                ? `Score ${s.result?.percentCorrect ?? '—'}%`
                : s.status === 'IN_PROGRESS'
                ? `In progress · question ${(s.currentIndex ?? 0) + 1}`
                : 'Abandoned'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </Card>
  )
}

function RemediationTab({ home }: { home: HomeData | null }) {
  const { colors } = useTheme()
  const topics = home?.stats.byTopic ?? []
  if (topics.length === 0) {
    return (
      <Card>
        <CardTitle>Personalized remediation</CardTitle>
        <CardSubtitle>
          Answer more questions and we'll surface the topics that need the most attention.
        </CardSubtitle>
      </Card>
    )
  }
  return (
    <Card>
      <CardTitle>Top topics by volume</CardTitle>
      <CardSubtitle>Tap a topic to launch a targeted Tutorial.</CardSubtitle>
      {topics.slice(0, 10).map((t, i) => (
        <View
          key={t.topic}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            borderTopColor: colors.border,
            borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: palette.brand.red50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: palette.brand.red700, fontSize: 11, fontWeight: '800' }}>
              {t.count}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13, marginLeft: 10, flex: 1 }}>
            {t.topic}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {home?.stats.usedByTopic?.[t.topic] ?? 0} answered
          </Text>
        </View>
      ))}
    </Card>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderRadius: radius.md,
        borderColor: colors.border,
        padding: spacing.md,
        gap: 2,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressOuter: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressInner: {
    height: '100%',
    backgroundColor: palette.brand.red600,
    borderRadius: radius.full,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
})
