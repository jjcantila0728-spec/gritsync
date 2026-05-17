import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme, palette, radius, spacing } from '@/theme'
import { errorMessage } from '@/lib/api'
import { formatExamType, nclexAPI, type Feedback, type Question, type Session } from '@/lib/nclex'
import { QuestionRenderer, hasAnswer } from '@/components/exam/QuestionRenderer'
import { Calculator } from '@/components/exam/Calculator'
import { NotesModal } from '@/components/exam/NotesModal'
import { QuestionListSheet } from '@/components/exam/QuestionListSheet'

/**
 * Exam runner — Phase 2 (all 10 formats + calculator + notes + marks + list).
 *
 * State per item is kept locally because the server's /answer endpoint is
 * write-once: it returns feedback and advances. We store user marks/notes
 * client-side under the question id so they survive navigation within a
 * session. (Persisting to the server can be added later.)
 */
export default function ExamRunner() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const router = useRouter()
  const { colors } = useTheme()

  const [session, setSession] = useState<Session | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<any>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef<number>(Date.now())

  // Per-session, per-question scratch state.
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [answered, setAnswered] = useState<Set<number>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})

  // UI toggles.
  const [calcOpen, setCalcOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId) return
    try {
      const data = await nclexAPI.getSession(sessionId)
      setSession(data.session)
      setQuestion(data.currentQuestion)
      setIndex(data.currentIndex ?? 0)
      // Pre-populate answered set from items, if any.
      if (data.session.items?.length) {
        const set = new Set<number>()
        for (const it of data.session.items) {
          if (it.answeredAt) set.add(it.itemIndex)
        }
        setAnswered(set)
      }
      startedAt.current = Date.now()
    } catch (e) {
      Alert.alert("Couldn't load session", errorMessage(e), [
        { text: 'Back', onPress: () => router.back() },
      ])
    } finally {
      setLoading(false)
    }
  }, [sessionId, router])

  useEffect(() => {
    void load()
  }, [load])

  // Reset per-question state on question change.
  useEffect(() => {
    setAnswer(null)
    setFeedback(null)
    startedAt.current = Date.now()
    setElapsed(0)
  }, [question?.id])

  // Tick the per-question timer.
  useEffect(() => {
    if (feedback) return
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 500)
    return () => clearInterval(t)
  }, [feedback, question?.id])

  const total = session?.questionPool?.length ?? null
  const progress = total ? (index + 1) / total : 0
  const isLast = total ? index + 1 >= total : false
  const canSubmit = !!question && !feedback && !submitting && hasAnswer(question.format, answer)

  const listItems = useMemo(() => {
    if (!total) return []
    return Array.from({ length: total }, (_, i) => ({
      index: i,
      status: i === index ? 'current' : (answered.has(i) ? 'answered' : (flagged.has(i) ? 'flagged' : 'unanswered')) as 'current' | 'answered' | 'flagged' | 'unanswered',
    }))
  }, [total, index, answered, flagged])

  async function submitAnswer() {
    if (!session || !question || !canSubmit) return
    setSubmitting(true)
    try {
      const fb = await nclexAPI.answer(session.id, question.id, answer, elapsed)
      setFeedback(fb)
      setAnswered((prev) => new Set(prev).add(index))
      if (session.examType !== 'TUTORIAL') {
        setTimeout(() => void advance(fb), 350)
      }
    } catch (e) {
      Alert.alert("Couldn't submit answer", errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function advance(fb: Feedback | null = feedback) {
    if (!session) return
    if (fb?.shouldStop || fb?.result) {
      router.replace(`/review/results/${session.id}`)
      return
    }
    if (fb?.nextQuestion) {
      setQuestion(fb.nextQuestion)
      setIndex((i) => i + 1)
      return
    }
    if (isLast) {
      const data = await nclexAPI.getSession(session.id).catch(() => null)
      if (data?.session.result || data?.session.status === 'COMPLETED') {
        router.replace(`/review/results/${session.id}`)
        return
      }
    }
    const next = await nclexAPI.getSession(session.id).catch(() => null)
    if (next) {
      setSession(next.session)
      setQuestion(next.currentQuestion)
      setIndex(next.currentIndex ?? index + 1)
    }
  }

  async function abandon() {
    Alert.alert('End exam?', 'Your progress is saved, but this session will be marked abandoned.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End exam',
        style: 'destructive',
        onPress: async () => {
          try {
            await nclexAPI.abandonSession(sessionId!)
          } catch {
            // ignore
          }
          router.back()
        },
      },
    ])
  }

  function toggleFlag() {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (loading || !session || !question) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  const isFlagged = flagged.has(index)
  const noteForQ = notes[question.id] ?? ''

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ExamTopBar
        examType={formatExamType(session.examType)}
        index={index}
        total={total}
        progress={progress}
        elapsed={elapsed}
        onClose={abandon}
      />

      <ToolBar
        isFlagged={isFlagged}
        hasNote={noteForQ.trim().length > 0}
        onCalc={() => setCalcOpen(true)}
        onList={() => setListOpen(true)}
        onFlag={toggleFlag}
        onNotes={() => setNotesOpen(true)}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 140 }}>
        {question.caseStudy ? (
          <View style={[styles.caseCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.caseHeading, { color: colors.textMuted }]}>CASE STUDY</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
              {question.caseStudy.title ?? 'Patient scenario'}
            </Text>
            {(question.caseStudy.tabs ?? []).map((tab, i) => (
              <View key={i} style={{ marginTop: 8 }}>
                {tab.label ? (
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{tab.label}</Text>
                ) : null}
                <Text style={{ color: colors.text, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                  {tab.content}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.formatPill, { backgroundColor: palette.brand.red50, borderColor: palette.brand.red200 }]}>
            <Text style={{ color: palette.brand.red700, fontSize: 10, fontWeight: '800' }}>
              {question.format}
            </Text>
          </View>
          {question.topic ? (
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {question.topic}
            </Text>
          ) : null}
        </View>

        <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
          {question.stem}
        </Text>

        <QuestionRenderer
          question={question}
          value={answer}
          onChange={setAnswer}
          feedback={!!feedback}
          correctAnswer={feedback ? question.correctAnswer : undefined}
        />

        {feedback ? (
          <View
            style={[
              styles.feedbackBox,
              {
                backgroundColor: feedback.isCorrect ? '#F0FDF4' : '#FEF2F2',
                borderColor: feedback.isCorrect ? '#86EFAC' : '#FCA5A5',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={feedback.isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={feedback.isCorrect ? '#15803D' : palette.brand.red700}
              />
              <Text style={{ color: feedback.isCorrect ? '#15803D' : palette.brand.red700, fontWeight: '800' }}>
                {feedback.isCorrect ? 'Correct' : 'Incorrect'}
              </Text>
              {feedback.peerCorrectPct != null ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  · {feedback.peerCorrectPct}% of peers got this right
                </Text>
              ) : null}
            </View>
            {feedback.rationale ? (
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                {feedback.rationale}
              </Text>
            ) : null}
            {feedback.additionalInfo ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
                {feedback.additionalInfo}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <BottomActionBar
        canSubmit={canSubmit}
        showSubmit={!feedback}
        showNext={!!feedback}
        submitting={submitting}
        onSubmit={submitAnswer}
        onNext={() => void advance(feedback)}
        isLast={isLast}
      />

      <Calculator visible={calcOpen} onClose={() => setCalcOpen(false)} />
      <NotesModal
        visible={notesOpen}
        initialValue={noteForQ}
        onClose={() => setNotesOpen(false)}
        onSave={(v) => setNotes((prev) => ({ ...prev, [question.id]: v }))}
      />
      <QuestionListSheet
        visible={listOpen}
        items={listItems}
        currentIndex={index}
        flagged={flagged}
        answered={answered}
        onClose={() => setListOpen(false)}
        onJump={(i) => {
          // Jumping in a non-CAT exam: server doesn't expose a "jump" endpoint;
          // for now we just log intent. CAT can't be jumped at all.
          if (i === index) return
          Alert.alert('Jump not yet supported', 'The exam advances forward only. Use this list to check what you have flagged or answered.')
        }}
      />
    </SafeAreaView>
  )
}

function ExamTopBar({
  examType,
  index,
  total,
  progress,
  elapsed,
  onClose,
}: {
  examType: string
  index: number
  total: number | null
  progress: number
  elapsed: number
  onClose: () => void
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable onPress={onClose} hitSlop={10}>
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1, marginHorizontal: spacing.md, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{examType}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {index + 1}
            {total ? ` / ${total}` : ''}
          </Text>
        </View>
        <View style={[styles.progressOuter, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.progressInner, { width: `${Math.max(2, progress * 100)}%` }]} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] }}>
          {fmtTime(elapsed)}
        </Text>
      </View>
    </View>
  )
}

function ToolBar({
  isFlagged,
  hasNote,
  onCalc,
  onList,
  onFlag,
  onNotes,
}: {
  isFlagged: boolean
  hasNote: boolean
  onCalc: () => void
  onList: () => void
  onFlag: () => void
  onNotes: () => void
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.toolBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ToolBtn icon="calculator-outline" label="Calculator" onPress={onCalc} />
      <ToolBtn
        icon={isFlagged ? 'flag' : 'flag-outline'}
        label={isFlagged ? 'Flagged' : 'Flag'}
        onPress={onFlag}
        active={isFlagged}
      />
      <ToolBtn icon="list-outline" label="Items" onPress={onList} />
      <ToolBtn
        icon={hasNote ? 'document-text' : 'document-text-outline'}
        label="Notes"
        onPress={onNotes}
        active={hasNote}
      />
    </View>
  )
}

function ToolBtn({ icon, label, onPress, active }: { icon: any; label: string; onPress: () => void; active?: boolean }) {
  const { colors } = useTheme()
  const fg = active ? palette.brand.red600 : colors.text
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolBtn,
        { backgroundColor: active ? palette.brand.red50 : 'transparent' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={18} color={fg} />
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  )
}

function BottomActionBar({
  canSubmit,
  showSubmit,
  showNext,
  submitting,
  onSubmit,
  onNext,
  isLast,
}: {
  canSubmit: boolean
  showSubmit: boolean
  showNext: boolean
  submitting: boolean
  onSubmit: () => void
  onNext: () => void
  isLast: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {showSubmit ? (
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.bottomBtn,
            { backgroundColor: palette.brand.red600, borderColor: palette.brand.red600 },
            !canSubmit && { opacity: 0.5 },
            pressed && canSubmit && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800' }}>Submit answer</Text>
          )}
        </Pressable>
      ) : null}
      {showNext ? (
        <Pressable
          onPress={onNext}
          style={({ pressed }) => [
            styles.bottomBtn,
            { backgroundColor: palette.brand.red600, borderColor: palette.brand.red600 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {isLast ? 'See results' : 'Next question'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  )
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  progressOuter: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressInner: {
    height: '100%',
    backgroundColor: palette.brand.red600,
    borderRadius: 2,
  },
  toolBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toolBtn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.sm,
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
  formatPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  feedbackBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
