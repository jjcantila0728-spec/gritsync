import React, { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type Bank, type HomeData, type ExamType, type QuestionFormat } from '@/lib/nclex'
import { errorMessage } from '@/lib/api'

interface ExamOption {
  type: ExamType
  label: string
  meta: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  iconBg: string
  iconColor: string
  /** Returns null if accessible, or a reason string if locked. */
  locked: (ctx: { isPremium: boolean; hasExitAccess: boolean }) => string | null
}

const EXAM_OPTIONS: ExamOption[] = [
  {
    type: 'TUTORIAL',
    label: 'Practice Mode',
    meta: 'Custom Qs · Free',
    description: 'Fully customizable practice with topics, formats, and question count.',
    icon: 'play',
    iconBg: '#DCFCE7',
    iconColor: '#15803D',
    locked: () => null,
  },
  {
    type: 'READINESS_ASSESSMENT',
    label: 'Readiness Assessment',
    meta: '85 Qs · ~2 hrs',
    description: 'Official NCLEX-style 85-question readiness assessment with a scored result.',
    icon: 'flag',
    iconBg: '#DBEAFE',
    iconColor: '#1D4ED8',
    locked: ({ isPremium }) => (isPremium ? null : 'Premium only'),
  },
  {
    type: 'CAT',
    label: 'CAT Adaptive',
    meta: '85–150 Qs · Adaptive',
    description: 'Computerized adaptive test that adjusts difficulty based on your performance.',
    icon: 'pulse',
    iconBg: '#FAE8FF',
    iconColor: '#7C3AED',
    locked: ({ isPremium }) => (isPremium ? null : 'Premium only'),
  },
  {
    type: 'EXIT_EXAM',
    label: 'GritSync Exit Exam',
    meta: '150 Qs · 350 min',
    description: 'Comprehensive exit exam — proves you are exam-ready. Contact admin for access.',
    icon: 'trophy',
    iconBg: '#FEF3C7',
    iconColor: '#B45309',
    locked: ({ hasExitAccess }) => (hasExitAccess ? null : 'Access required'),
  },
]

const QUESTION_COUNT_OPTIONS = [10, 25, 40, 85] as const

export function CreateTestModal({
  visible,
  onClose,
  home,
}: {
  visible: boolean
  onClose: () => void
  home: HomeData | null
}) {
  const { colors } = useTheme()
  const router = useRouter()

  const isPremium = home?.profile?.tier === 'PREMIUM'
  const hasExitAccess = !!home?.exitAccess
  const topicStats = home?.stats?.byTopic ?? []
  const formatStats = home?.stats?.byFormat ?? []

  // Step state.
  const [step, setStep] = useState<1 | 2>(1)
  const [examType, setExamType] = useState<ExamType | null>(null)
  const [bank, setBank] = useState<Bank>('CLASSIC')
  const [topics, setTopics] = useState<string[]>([])
  const [formats, setFormats] = useState<string[]>([])
  const [count, setCount] = useState<number>(10)
  const [starting, setStarting] = useState(false)

  const isTutorial = examType === 'TUTORIAL'
  const selectedOption = EXAM_OPTIONS.find((o) => o.type === examType) ?? null

  // Reset wizard whenever the modal opens fresh.
  React.useEffect(() => {
    if (visible) {
      setStep(1)
      setExamType(null)
      setBank('CLASSIC')
      setTopics([])
      setFormats([])
      setCount(10)
    }
  }, [visible])

  function pickExamType(opt: ExamOption) {
    const reason = opt.locked({ isPremium, hasExitAccess })
    if (reason) {
      Alert.alert(
        opt.label,
        opt.type === 'EXIT_EXAM'
          ? 'Exit Exam access is granted by your GritSync advisor. Reach out via Messages to request.'
          : 'Upgrade to Premium to unlock this exam mode.',
      )
      return
    }
    setExamType(opt.type)
    setStep(2)
  }

  function toggleTopic(topic: string) {
    setTopics((cur) => (cur.includes(topic) ? cur.filter((t) => t !== topic) : [...cur, topic]))
  }

  function toggleFormat(fmt: string) {
    setFormats((cur) => (cur.includes(fmt) ? cur.filter((f) => f !== fmt) : [...cur, fmt]))
  }

  async function start() {
    if (!examType) return
    setStarting(true)
    try {
      const { session } = await nclexAPI.startSession({
        examType,
        bank,
        ...(isTutorial
          ? {
              questionCount: count,
              topics: topics.length ? topics : undefined,
              formats: formats.length ? (formats as QuestionFormat[]) : undefined,
            }
          : {}),
      })
      onClose()
      router.push(`/review/exam/${session.id}` as any)
    } catch (e) {
      Alert.alert("Couldn't start test", errorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {step === 2 ? (
            <Pressable onPress={() => setStep(1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
            {step === 1 ? 'Create Test' : selectedOption?.label ?? 'Configure'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 ? (
              <Step1
                options={EXAM_OPTIONS}
                onPick={pickExamType}
                isPremium={isPremium}
                hasExitAccess={hasExitAccess}
              />
            ) : (
              <Step2
                examType={examType!}
                bank={bank}
                onBankChange={setBank}
                topics={topics}
                onToggleTopic={toggleTopic}
                topicStats={topicStats}
                formats={formats}
                onToggleFormat={toggleFormat}
                formatStats={formatStats}
                count={count}
                onCountChange={setCount}
                isTutorial={isTutorial}
              />
            )}
          </ScrollView>

          {step === 2 ? (
            <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <Pressable
                onPress={start}
                disabled={starting}
                style={({ pressed }) => [
                  styles.startBtn,
                  { backgroundColor: palette.brand.red600 },
                  starting && { opacity: 0.6 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                  {starting ? 'Starting…' : 'Start test'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function Step1({
  options,
  onPick,
  isPremium,
  hasExitAccess,
}: {
  options: ExamOption[]
  onPick: (o: ExamOption) => void
  isPremium: boolean
  hasExitAccess: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.textMuted }}>
        Pick a test mode. Tutorial is fully customizable — Readiness, CAT, and Exit exams follow
        NCLEX-style timing and item counts.
      </Text>
      {options.map((opt) => {
        const lockReason = opt.locked({ isPremium, hasExitAccess })
        const locked = !!lockReason
        return (
          <Pressable
            key={opt.type}
            onPress={() => onPick(opt)}
            style={({ pressed }) => [
              styles.examCard,
              { backgroundColor: colors.surface, borderColor: locked ? colors.border : colors.border },
              pressed && { opacity: 0.85 },
              locked && { opacity: 0.6 },
            ]}
          >
            <View style={[styles.examIconWrap, { backgroundColor: opt.iconBg }]}>
              <Ionicons name={opt.icon} size={22} color={opt.iconColor} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{opt.label}</Text>
                {locked ? (
                  <View style={styles.lockChip}>
                    <Ionicons name="lock-closed" size={10} color={palette.brand.red700} />
                    <Text style={{ color: palette.brand.red700, fontSize: 10, fontWeight: '800' }}>
                      {lockReason}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{opt.meta}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                {opt.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )
      })}
    </View>
  )
}

function Step2({
  examType,
  bank,
  onBankChange,
  topics,
  onToggleTopic,
  topicStats,
  formats,
  onToggleFormat,
  formatStats,
  count,
  onCountChange,
  isTutorial,
}: {
  examType: ExamType
  bank: Bank
  onBankChange: (b: Bank) => void
  topics: string[]
  onToggleTopic: (t: string) => void
  topicStats: Array<{ topic: string; count: number }>
  formats: string[]
  onToggleFormat: (f: string) => void
  formatStats: Array<{ format: string; count: number }>
  count: number
  onCountChange: (n: number) => void
  isTutorial: boolean
}) {
  const { colors } = useTheme()
  const usableTopics = useMemo(() => topicStats.filter((t) => t.count > 0), [topicStats])
  const usableFormats = useMemo(() => formatStats.filter((f) => f.count > 0), [formatStats])
  const [customCount, setCustomCount] = useState('')

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionLabel}>QUESTION BANK</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['CLASSIC', 'NGN'] as const).map((b) => {
            const active = bank === b
            return (
              <Pressable
                key={b}
                onPress={() => onBankChange(b)}
                style={[
                  styles.bankChip,
                  {
                    backgroundColor: active ? palette.brand.red600 : colors.surface,
                    borderColor: active ? palette.brand.red600 : colors.border,
                  },
                ]}
              >
                <Text style={{ color: active ? '#FFF' : colors.text, fontWeight: '800', fontSize: 13 }}>
                  {b === 'NGN' ? 'NGN (Next Gen)' : 'Classic'}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {bank === 'NGN'
            ? 'NGN — all 10 Next Generation NCLEX item types (Bow Tie, Drag & Drop, Matrix, etc.)'
            : 'Classic — single-answer MCQ + SATA items, like the NCLEX of the past decade.'}
        </Text>
      </View>

      {isTutorial ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>QUESTION COUNT</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {QUESTION_COUNT_OPTIONS.map((n) => {
                const active = count === n && !customCount
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      onCountChange(n)
                      setCustomCount('')
                    }}
                    style={[
                      styles.countChip,
                      {
                        backgroundColor: active ? palette.brand.red600 : colors.surface,
                        borderColor: active ? palette.brand.red600 : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#FFF' : colors.text, fontWeight: '700' }}>{n}</Text>
                  </Pressable>
                )
              })}
              <View
                style={[
                  styles.customCountWrap,
                  { backgroundColor: colors.surface, borderColor: customCount ? palette.brand.red600 : colors.border },
                ]}
              >
                <TextInput
                  value={customCount}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/\D/g, '').slice(0, 3)
                    setCustomCount(cleaned)
                    const n = parseInt(cleaned, 10)
                    if (!isNaN(n)) onCountChange(Math.min(Math.max(n, 1), 200))
                  }}
                  keyboardType="number-pad"
                  placeholder="Custom"
                  placeholderTextColor={colors.textMuted}
                  style={{ color: colors.text, fontSize: 13, fontWeight: '700', minWidth: 64, textAlign: 'center', paddingVertical: 0 }}
                />
              </View>
            </View>
          </View>

          {usableTopics.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sectionLabel}>
                  TOPICS{topics.length > 0 ? ` · ${topics.length} SELECTED` : ' · ALL'}
                </Text>
                {topics.length > 0 ? (
                  <Pressable onPress={() => topics.forEach(onToggleTopic)} hitSlop={6}>
                    <Text style={{ color: palette.brand.red600, fontSize: 11, fontWeight: '700' }}>
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {usableTopics.map((t) => {
                  const active = topics.includes(t.topic)
                  return (
                    <Pressable
                      key={t.topic}
                      onPress={() => onToggleTopic(t.topic)}
                      style={[
                        styles.topicChip,
                        {
                          backgroundColor: active ? palette.brand.red50 : colors.surface,
                          borderColor: active ? palette.brand.red500 : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? palette.brand.red700 : colors.text,
                          fontSize: 12,
                          fontWeight: active ? '800' : '600',
                        }}
                      >
                        {t.topic} · {t.count}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                {topics.length === 0
                  ? 'No topics selected — questions can come from any topic.'
                  : `Restricted to ${topics.length} topic${topics.length === 1 ? '' : 's'}.`}
              </Text>
            </View>
          ) : null}

          {usableFormats.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionLabel}>FORMATS (optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {usableFormats.map((f) => {
                  const active = formats.includes(f.format)
                  return (
                    <Pressable
                      key={f.format}
                      onPress={() => onToggleFormat(f.format)}
                      style={[
                        styles.topicChip,
                        {
                          backgroundColor: active ? '#FAE8FF' : colors.surface,
                          borderColor: active ? '#A855F7' : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#6B21A8' : colors.text,
                          fontSize: 11,
                          fontWeight: active ? '800' : '600',
                        }}
                      >
                        {prettyFormat(f.format)} · {f.count}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={[styles.examInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={palette.brand.red600} />
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 }}>
            {examType === 'CAT'
              ? 'CAT runs 85–150 adaptive items. Length depends on how confidently the algorithm can decide your readiness.'
              : examType === 'READINESS_ASSESSMENT'
              ? '85 scored questions across all NCLEX content areas. Take it in one sitting; ~2 hours.'
              : '150 questions, 350-minute timer. Treat it like the real exam — find a quiet space and don\'t pause.'}
          </Text>
        </View>
      )}
    </View>
  )
}

function prettyFormat(f: string): string {
  switch (f) {
    case 'MCQ':
      return 'Multiple Choice'
    case 'SATA':
      return 'Select All That Apply'
    case 'FILL_IN_BLANK':
      return 'Fill in the Blank'
    case 'DROP_DOWN':
      return 'Drop Down'
    case 'MATRIX_MCQ':
      return 'Matrix · MCQ'
    case 'MATRIX_SATA':
      return 'Matrix · SATA'
    case 'BOW_TIE':
      return 'Bow Tie'
    case 'HIGHLIGHT_TEXT':
      return 'Highlight Text'
    case 'DRAG_DROP':
      return 'Drag & Drop'
    case 'ORDERED_RESPONSE':
      return 'Ordered Response'
    default:
      return f
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  examIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.brand.red50,
    borderColor: palette.brand.red200,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#6B7280',
  },
  bankChip: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  countChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
  },
  customCountWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  examInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
})
