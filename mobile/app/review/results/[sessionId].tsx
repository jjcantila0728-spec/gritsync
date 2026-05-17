import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useTheme, palette, radius, spacing } from '@/theme'
import { errorMessage } from '@/lib/api'
import {
  formatExamType,
  nclexAPI,
  readinessLabel,
  readinessTone,
  type Result,
  type Session,
} from '@/lib/nclex'

export default function ResultsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { colors } = useTheme()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!sessionId) return
      try {
        const data = await nclexAPI.getSession(sessionId)
        if (cancelled) return
        setSession(data.session)
      } catch (e) {
        if (cancelled) return
        setError(errorMessage(e, "Couldn't load results"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const result: Result | null = session?.result ?? null
  const tone = readinessTone(result?.readiness)

  const percent = useMemo(() => {
    if (result?.percentCorrect != null) return Math.round(result.percentCorrect)
    if (result?.correctCount != null && result?.totalItems) {
      return Math.round((result.correctCount / result.totalItems) * 100)
    }
    return null
  }, [result])

  const categories = useMemo(() => {
    if (!result?.categoryBreakdown) return []
    return Object.entries(result.categoryBreakdown).map(([topic, v]) => ({
      topic,
      ...v,
    }))
  }, [result?.categoryBreakdown])

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Results' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Results' }} />
        <View style={{ flex: 1, padding: spacing.lg }}>
          <Card>
            <CardTitle>Couldn't load results</CardTitle>
            <CardSubtitle>{error ?? 'This session may have been removed.'}</CardSubtitle>
          </Card>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.brand.red700 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <LinearGradient
          colors={[palette.brand.red700, palette.brand.red600]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.eyebrow}>{formatExamType(session.examType).toUpperCase()}</Text>
          <Text style={styles.heroTitle}>Results</Text>
          {result?.readiness ? (
            <View style={[styles.readinessChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text style={{ color: tone.fg, fontWeight: '800', fontSize: 13 }}>
                {readinessLabel(result.readiness)}
              </Text>
            </View>
          ) : null}
          <View style={styles.heroDonutRow}>
            <DonutChart percent={percent ?? 0} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bigStat}>{percent != null ? `${percent}%` : '—'}</Text>
              <Text style={styles.bigStatLabel}>
                {result?.correctCount ?? 0} of {result?.totalItems ?? 0} correct
              </Text>
              {result?.stopReason ? (
                <Text style={styles.heroSub}>
                  {stopReasonLabel(result.stopReason)}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.lg }}>
          <Card>
            <CardTitle>Snapshot</CardTitle>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Stat label="Items" value={String(result?.totalItems ?? 0)} />
              <Stat label="Correct" value={String(result?.correctCount ?? 0)} />
              {result?.finalTheta != null ? (
                <Stat label="Theta" value={result.finalTheta.toFixed(2)} />
              ) : null}
              {result?.standardError != null ? (
                <Stat label="SE" value={result.standardError.toFixed(2)} />
              ) : null}
              {result?.durationSeconds != null ? (
                <Stat label="Time" value={fmtDuration(result.durationSeconds)} />
              ) : null}
            </View>
          </Card>

          {categories.length > 0 ? (
            <Card>
              <CardTitle>Category breakdown</CardTitle>
              <CardSubtitle>How you performed across topics covered in this exam.</CardSubtitle>
              {categories.map((c, i) => (
                <View
                  key={c.topic}
                  style={{
                    paddingVertical: 8,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                      {c.topic}
                    </Text>
                    <Text
                      style={{
                        color: c.pct >= 70 ? '#15803D' : c.pct >= 50 ? '#B45309' : palette.brand.red700,
                        fontWeight: '800',
                        fontSize: 12,
                      }}
                    >
                      {Math.round(c.pct)}%
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {c.correct} / {c.total}
                  </Text>
                  <View style={{ height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 2, marginTop: 4 }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, c.pct)}%`,
                        backgroundColor:
                          c.pct >= 70 ? '#15803D' : c.pct >= 50 ? '#B45309' : palette.brand.red600,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Review answers"
              onPress={() => router.push(`/review/review/${sessionId}`)}
              style={{ flex: 1 }}
            />
            <Button
              title="Done"
              variant="secondary"
              onPress={() => router.replace('/(tabs)/review')}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        minWidth: '30%',
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
        gap: 2,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  )
}

/** Lightweight donut without an SVG dep — uses concentric rotated views. */
function DonutChart({ percent }: { percent: number }) {
  const size = 96
  const ring = 12
  const ringColor = '#FFFFFF'
  const trackColor = 'rgba(255,255,255,0.25)'
  const clamped = Math.max(0, Math.min(100, percent))

  // We split the ring into two 180° halves and rotate them to render the fill.
  // The first half is always drawn from 0–180°; the second half is conditionally
  // visible when the percent crosses 50%.
  const firstRotate = clamped <= 50 ? clamped * 3.6 : 180
  const secondRotate = clamped > 50 ? (clamped - 50) * 3.6 : 0
  const secondVisible = clamped > 50

  return (
    <View style={[styles.donut, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.donutTrack, { width: size, height: size, borderWidth: ring, borderColor: trackColor, borderRadius: size / 2 }]} />
      {/* First half */}
      <View
        style={[
          styles.donutHalf,
          { width: size, height: size },
          { transform: [{ rotate: `${firstRotate}deg` }] },
        ]}
      >
        <View
          style={[
            styles.donutQuadrant,
            {
              width: size / 2,
              height: size,
              borderTopLeftRadius: size / 2,
              borderBottomLeftRadius: size / 2,
              borderWidth: ring,
              borderRightWidth: 0,
              borderColor: ringColor,
            },
          ]}
        />
      </View>
      {secondVisible ? (
        <View
          style={[
            styles.donutHalf,
            { width: size, height: size },
            { transform: [{ rotate: `${180 + secondRotate}deg` }] },
          ]}
        >
          <View
            style={[
              styles.donutQuadrant,
              {
                width: size / 2,
                height: size,
                borderTopLeftRadius: size / 2,
                borderBottomLeftRadius: size / 2,
                borderWidth: ring,
                borderRightWidth: 0,
                borderColor: ringColor,
              },
            ]}
          />
        </View>
      ) : null}
      <View style={styles.donutCenter}>
        <Ionicons name="ribbon" size={26} color="#FFFFFF" />
      </View>
    </View>
  )
}

function stopReasonLabel(r: string): string {
  switch (r) {
    case 'SE_THRESHOLD':
      return 'Stopped — confidence reached (SE < 0.4)'
    case 'MAX_ITEMS':
      return 'Stopped — reached the 150-item maximum'
    case 'MIN_ITEMS':
      return 'Stopped — reached the minimum item count'
    default:
      return r
  }
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: spacing.md,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  readinessChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroDonutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  bigStat: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  bigStatLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 4,
  },
  donut: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  donutTrack: {
    position: 'absolute',
  },
  donutHalf: {
    position: 'absolute',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  donutQuadrant: {
    backgroundColor: 'transparent',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
