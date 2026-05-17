import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type Bank, type HomeData } from '@/lib/nclex'
import { errorMessage } from '@/lib/api'

/**
 * "Practice your weak spots" card.
 *
 * Heuristic, not LLM-based:
 *   For each topic in the bank, compute `(answered / total)` — the lower
 *   the fraction, the more unexplored that topic is. We also weight by
 *   topic volume so high-coverage areas (e.g. Safety & Infection Control)
 *   surface even when the user has answered some questions there.
 *
 * Clicking a suggestion starts a TUTORIAL session filtered to that topic.
 * This is the same endpoint the rest of the app uses — no new backend.
 */
export function StudySuggestions({ home }: { home: HomeData | null }) {
  const { colors } = useTheme()
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)

  const suggestions = useMemo(() => rankTopics(home), [home])

  if (!home || suggestions.length === 0) return null

  async function startTopicTutorial(topic: string) {
    setStarting(topic)
    try {
      const { session } = await nclexAPI.startSession({
        examType: 'TUTORIAL',
        questionCount: 10,
        topics: [topic],
        bank: 'CLASSIC' as Bank,
      })
      router.push(`/review/exam/${session.id}` as any)
    } catch (e) {
      Alert.alert("Couldn't start tutorial", errorMessage(e))
    } finally {
      setStarting(null)
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="bulb" size={18} color={palette.brand.red600} />
        <CardTitle>Suggested for you</CardTitle>
      </View>
      <CardSubtitle>Topics you've practiced least. Tap to start a 10-question tutorial.</CardSubtitle>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {suggestions.map((s, i) => {
          const isStarting = starting === s.topic
          return (
            <Pressable
              key={s.topic}
              onPress={() => startTopicTutorial(s.topic)}
              disabled={isStarting}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isStarting && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={[styles.rank, { backgroundColor: palette.brand.red50 }]}>
                <Text style={{ color: palette.brand.red700, fontSize: 12, fontWeight: '800' }}>
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                  {s.topic}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {s.answered} / {s.total} answered · {Math.round(s.coverage * 100)}% covered
                </Text>
                <View style={{ height: 3, backgroundColor: colors.surfaceMuted, borderRadius: 2, marginTop: 4 }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(s.coverage * 100))}%`,
                      backgroundColor:
                        s.coverage < 0.2 ? palette.brand.red600 : s.coverage < 0.5 ? '#F59E0B' : '#15803D',
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
              {isStarting ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <View style={[styles.cta, { backgroundColor: palette.brand.red600 }]}>
                  <Ionicons name="play" size={14} color="#fff" />
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

interface Ranked {
  topic: string
  total: number
  answered: number
  /** 0..1 ratio of (answered / total). Lower = recommend first. */
  coverage: number
}

function rankTopics(home: HomeData | null): Ranked[] {
  if (!home) return []
  const byTopic = home.stats.byTopic ?? []
  const usedByTopic = home.stats.usedByTopic ?? {}
  if (byTopic.length === 0) return []

  // Only consider topics with at least 5 available questions — otherwise a
  // tiny-but-untouched topic dominates and isn't actionable.
  const eligible = byTopic.filter((t) => t.count >= 5 && t.topic && t.topic !== 'General')

  const ranked: Ranked[] = eligible.map((t) => {
    const answered = usedByTopic[t.topic] ?? 0
    const coverage = answered / t.count
    return { topic: t.topic, total: t.count, answered, coverage }
  })

  // Sort by lowest coverage first, breaking ties by larger topic volume
  // (more impact to practice a bigger weak topic).
  ranked.sort((a, b) => {
    if (a.coverage !== b.coverage) return a.coverage - b.coverage
    return b.total - a.total
  })

  return ranked.slice(0, 3)
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
