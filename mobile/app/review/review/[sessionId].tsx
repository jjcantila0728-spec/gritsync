import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { errorMessage } from '@/lib/api'
import { nclexAPI, type SessionItem } from '@/lib/nclex'
import { QuestionRenderer } from '@/components/exam/QuestionRenderer'

type Filter = 'all' | 'correct' | 'incorrect'

export default function ReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [index, setIndex] = useState(0)
  const [rationaleOpen, setRationaleOpen] = useState(true)

  const load = useCallback(async () => {
    if (!sessionId) return
    try {
      const rows = await nclexAPI.reviewSession(sessionId)
      setItems(rows)
    } catch (e) {
      setError(errorMessage(e, "Couldn't load review"))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'correct') return items.filter((i) => i.isCorrect === true)
    return items.filter((i) => i.isCorrect === false)
  }, [items, filter])

  // Keep current index inside bounds when filter changes.
  useEffect(() => {
    if (index >= filtered.length) setIndex(0)
  }, [filtered.length, index])

  const item = filtered[index]
  const correctCount = items.filter((i) => i.isCorrect).length
  const totalAnswered = items.filter((i) => i.isCorrect != null).length
  const percent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={{ flex: 1, padding: spacing.lg }}>
          <Card>
            <CardTitle>{error ? 'Could not load review' : 'No answered items yet'}</CardTitle>
            <CardSubtitle>{error ?? 'Take an exam and submit answers to see your review here.'}</CardSubtitle>
          </Card>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Review</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {correctCount} correct · {percent}%
          </Text>
        </View>
      </View>

      {/* Filter row */}
      <View style={[styles.filters, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        {(['all', 'correct', 'incorrect'] as const).map((f) => {
          const active = filter === f
          const label = f === 'all' ? `All (${items.length})` : f === 'correct' ? `Correct (${correctCount})` : `Incorrect (${totalAnswered - correctCount})`
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                active && { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
        {item ? (
          <ItemView
            item={item}
            indexLabel={`${index + 1} of ${filtered.length}`}
            rationaleOpen={rationaleOpen}
            onToggleRationale={() => setRationaleOpen((v) => !v)}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            index === 0 && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>Prev</Text>
        </Pressable>
        <Pressable
          onPress={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
          disabled={index >= filtered.length - 1}
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: palette.brand.red600, borderColor: palette.brand.red600 },
            index >= filtered.length - 1 && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Next</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function ItemView({
  item,
  indexLabel,
  rationaleOpen,
  onToggleRationale,
}: {
  item: SessionItem
  indexLabel: string
  rationaleOpen: boolean
  onToggleRationale: () => void
}) {
  const { colors } = useTheme()
  const q = item.question
  if (!q) {
    return (
      <Card>
        <CardSubtitle>Question content missing for this item.</CardSubtitle>
      </Card>
    )
  }
  const correct = q.correctAnswer != null ? String(q.correctAnswer) : null
  const userResponse = item.response != null ? String(item.response) : null
  const opts = normalizeOptions(q.options)

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{indexLabel}</Text>
        <View
          style={[
            styles.resultPill,
            {
              backgroundColor: item.isCorrect ? '#DCFCE7' : '#FEE2E2',
              borderColor: item.isCorrect ? '#86EFAC' : '#FCA5A5',
            },
          ]}
        >
          <Ionicons
            name={item.isCorrect ? 'checkmark-circle' : 'close-circle'}
            size={12}
            color={item.isCorrect ? '#15803D' : palette.brand.red700}
          />
          <Text style={{ color: item.isCorrect ? '#15803D' : palette.brand.red700, fontWeight: '800', fontSize: 11 }}>
            {item.isCorrect ? 'Correct' : 'Incorrect'}
          </Text>
        </View>
        {q.topic ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>· {q.topic}</Text> : null}
      </View>

      {q.caseStudy ? (
        <View style={[styles.caseCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Text style={[styles.caseHeading, { color: colors.textMuted }]}>CASE STUDY</Text>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
            {q.caseStudy.title ?? 'Patient scenario'}
          </Text>
          {(q.caseStudy.tabs ?? []).map((tab, i) => (
            <View key={i} style={{ marginTop: 8 }}>
              {tab.label ? <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{tab.label}</Text> : null}
              <Text style={{ color: colors.text, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{tab.content}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>{q.stem}</Text>

      <QuestionRenderer
        question={q}
        value={item.response}
        onChange={() => null}
        feedback
        correctAnswer={q.correctAnswer}
      />
      {opts.length === 0 ? (
        <View style={[styles.altAnswerBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>YOUR ANSWER</Text>
          <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>{userResponse ?? '—'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 8 }}>CORRECT ANSWER</Text>
          <Text style={{ color: '#15803D', fontSize: 14, marginTop: 2 }}>{correct ?? '—'}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={onToggleRationale}
        style={({ pressed }) => [
          styles.rationaleHeader,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="bulb-outline" size={18} color={palette.brand.red600} />
        <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>
          Rationale
        </Text>
        <Ionicons name={rationaleOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {rationaleOpen ? (
        <View style={[styles.rationaleBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {q.rationale ? (
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{q.rationale}</Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>No rationale provided.</Text>
          )}
          {q.additionalInfo ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
              {q.additionalInfo}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function normalizeOptions(raw: unknown): Array<{ id: string; text: string }> {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((o, i) => {
      if (typeof o === 'string') return { id: String.fromCharCode(65 + i), text: o }
      if (o && typeof o === 'object') {
        const id = (o as any).id ?? (o as any).key ?? (o as any).value ?? String.fromCharCode(65 + i)
        const text = (o as any).text ?? (o as any).label ?? (o as any).content ?? String(id)
        return { id: String(id), text: String(text) }
      }
      return { id: String(i), text: String(o) }
    })
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([id, text]) => ({
      id,
      text: typeof text === 'string' ? text : JSON.stringify(text),
    }))
  }
  return []
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  filters: {
    flexDirection: 'row',
    padding: 4,
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  caseCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  caseHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  altAnswerBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rationaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  rationaleBody: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: -spacing.sm,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
