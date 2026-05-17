import React, { useMemo, useState, useEffect } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useExamTheme as useTheme, palette, radius, spacing } from '@/theme'
import type { Question, QuestionFormat } from '@/lib/nclex'

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionRendererProps {
  question: Question
  value: any
  onChange: (next: any) => void
  feedback: boolean
  correctAnswer?: unknown
}

export function QuestionRenderer(props: QuestionRendererProps) {
  switch (props.question.format) {
    case 'MCQ':
      return <McqRenderer {...props} />
    case 'SATA':
      return <SataRenderer {...props} />
    case 'FILL_IN_BLANK':
      return <FillInBlankRenderer {...props} />
    case 'DROP_DOWN':
      return <DropdownRenderer {...props} />
    case 'MATRIX_MCQ':
    case 'MATRIX_SATA':
      return <MatrixRenderer {...props} />
    case 'BOW_TIE':
      return <BowTieRenderer {...props} />
    case 'HIGHLIGHT_TEXT':
      return <HighlightRenderer {...props} />
    case 'DRAG_DROP':
      return <DragDropRenderer {...props} />
    case 'ORDERED_RESPONSE':
      return <OrderedResponseRenderer {...props} />
    default:
      return <UnsupportedRenderer format={props.question.format} />
  }
}

/** Returns true if `value` is a meaningful response for the given format. */
export function hasAnswer(format: QuestionFormat, value: any): boolean {
  if (value == null) return false
  switch (format) {
    case 'MCQ':
    case 'DROP_DOWN':
      // For DROP_DOWN, value is an object map of blank→option; expect all filled
      return typeof value === 'string' ? value.length > 0 : Object.values(value).every(Boolean)
    case 'SATA':
      return Array.isArray(value) && value.length > 0
    case 'FILL_IN_BLANK':
      return typeof value === 'string' ? value.trim().length > 0 : Object.values(value as any).every((v: any) => String(v ?? '').trim().length > 0)
    case 'MATRIX_MCQ':
    case 'MATRIX_SATA':
      return value && typeof value === 'object' && Object.keys(value).length > 0
    case 'BOW_TIE':
      return value && typeof value === 'object' && Object.values(value).some(Boolean)
    case 'HIGHLIGHT_TEXT':
      return Array.isArray(value) && value.length > 0
    case 'DRAG_DROP':
      return value && typeof value === 'object' && Object.values(value).some(Boolean)
    case 'ORDERED_RESPONSE':
      return Array.isArray(value) && value.length > 0
    default:
      return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeOptions(raw: unknown): Array<{ id: string; text: string }> {
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

function correctSet(correct: unknown): Set<string> {
  const arr = Array.isArray(correct) ? correct : correct != null ? [correct] : []
  return new Set(arr.map((v) => String(v)))
}

// ─────────────────────────────────────────────────────────────────────────────
// MCQ
// ─────────────────────────────────────────────────────────────────────────────

function McqRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  const opts = useMemo(() => normalizeOptions(question.options), [question.options])
  const correct = feedback && correctAnswer != null ? String(correctAnswer) : null
  return (
    <View style={{ gap: spacing.sm }}>
      {opts.map((opt) => {
        const isSelected = String(value) === opt.id
        const isCorrect = correct === opt.id
        const isWrongPick = feedback && !isCorrect && isSelected
        const { bg, border, dot } = optionTone(colors, isSelected, isCorrect, isWrongPick, !!feedback)
        return (
          <Pressable
            key={opt.id}
            onPress={() => !feedback && onChange(opt.id)}
            disabled={feedback}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: bg, borderColor: border },
              pressed && !feedback && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.radio, { borderColor: dot }]}>
              {isSelected || (feedback && isCorrect) ? (
                <View style={[styles.radioDot, { backgroundColor: dot }]} />
              ) : null}
            </View>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1, lineHeight: 22 }}>{opt.text}</Text>
            {feedback && isCorrect ? <Ionicons name="checkmark" size={18} color="#15803D" /> : null}
            {isWrongPick ? <Ionicons name="close" size={18} color={palette.brand.red700} /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SATA (Select All That Apply)
// ─────────────────────────────────────────────────────────────────────────────

function SataRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  const opts = useMemo(() => normalizeOptions(question.options), [question.options])
  const selected: string[] = Array.isArray(value) ? value.map(String) : []
  const corrects = correctSet(correctAnswer)

  function toggle(id: string) {
    if (feedback) return
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id))
    else onChange([...selected, id])
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
        Select all that apply.
      </Text>
      {opts.map((opt) => {
        const isSelected = selected.includes(opt.id)
        const isCorrect = feedback && corrects.has(opt.id)
        const isWrongPick = feedback && !isCorrect && isSelected
        const { bg, border, dot } = optionTone(colors, isSelected, isCorrect, isWrongPick, !!feedback)
        return (
          <Pressable
            key={opt.id}
            onPress={() => toggle(opt.id)}
            disabled={feedback}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: bg, borderColor: border },
              pressed && !feedback && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.checkbox, { borderColor: dot, backgroundColor: isSelected || isCorrect ? dot : 'transparent' }]}>
              {isSelected || isCorrect ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1, lineHeight: 22 }}>{opt.text}</Text>
            {feedback && isCorrect && !isSelected ? (
              <Text style={{ color: '#15803D', fontSize: 10, fontWeight: '800' }}>MISSED</Text>
            ) : null}
            {isWrongPick ? <Ionicons name="close" size={18} color={palette.brand.red700} /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FILL_IN_BLANK
// ─────────────────────────────────────────────────────────────────────────────

function FillInBlankRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  // Format: question.stem contains "{{blank1}}" placeholders, options may
  // define expected number of blanks. We support either a single string
  // value, or an object map of blank-name → answer.
  const blanks = useMemo(() => {
    const matches = Array.from((question.stem ?? '').matchAll(/\{\{(\w+)\}\}/g))
    if (matches.length > 0) return matches.map((m) => m[1])
    return ['answer']
  }, [question.stem])

  const isMulti = blanks.length > 1
  const map: Record<string, string> =
    isMulti
      ? typeof value === 'object' && value != null
        ? value
        : Object.fromEntries(blanks.map((b) => [b, '']))
      : { [blanks[0]]: typeof value === 'string' ? value : '' }

  function update(key: string, next: string) {
    if (feedback) return
    if (isMulti) onChange({ ...map, [key]: next })
    else onChange(next)
  }

  const correctMap: Record<string, string> = useMemo(() => {
    if (!correctAnswer) return {}
    if (typeof correctAnswer === 'string') return { [blanks[0]]: correctAnswer }
    if (typeof correctAnswer === 'object') return correctAnswer as any
    return {}
  }, [correctAnswer, blanks])

  return (
    <View style={{ gap: spacing.md }}>
      {blanks.map((b) => {
        const userVal = String(map[b] ?? '')
        const correctVal = correctMap[b]
        const ok = feedback && correctVal && norm(userVal) === norm(correctVal)
        const wrong = feedback && correctVal && norm(userVal) !== norm(correctVal)
        return (
          <View key={b} style={{ gap: 6 }}>
            {isMulti ? (
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                {b}
              </Text>
            ) : null}
            <TextInput
              value={userVal}
              onChangeText={(t) => update(b, t)}
              editable={!feedback}
              placeholder="Type your answer"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: ok ? '#F0FDF4' : wrong ? '#FEF2F2' : colors.surface,
                  borderColor: ok ? '#86EFAC' : wrong ? '#FCA5A5' : colors.border,
                },
              ]}
            />
            {feedback && wrong ? (
              <Text style={{ color: '#15803D', fontSize: 12 }}>
                Correct answer: <Text style={{ fontWeight: '800' }}>{correctVal}</Text>
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// DROP_DOWN
// ─────────────────────────────────────────────────────────────────────────────

function DropdownRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  // Expected shape: question.options is a record { blank: [option, ...] }
  const dropdowns: Record<string, Array<{ id: string; text: string }>> = useMemo(() => {
    const raw = question.options
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const out: Record<string, Array<{ id: string; text: string }>> = {}
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        out[k] = normalizeOptions(v)
      }
      return out
    }
    return { answer: normalizeOptions(raw) }
  }, [question.options])

  const map: Record<string, string> = value && typeof value === 'object' ? value : {}
  const correctMap: Record<string, string> =
    correctAnswer && typeof correctAnswer === 'object' ? (correctAnswer as any) : {}

  function pick(key: string, id: string) {
    if (feedback) return
    onChange({ ...map, [key]: id })
  }

  return (
    <View style={{ gap: spacing.md }}>
      {Object.entries(dropdowns).map(([key, options]) => {
        const picked = map[key]
        const correct = correctMap[key]
        const isCorrect = feedback && correct && picked === correct
        const wrong = feedback && correct && picked !== correct
        return (
          <View key={key} style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
              {key}
            </Text>
            <View
              style={[
                styles.dropdownBox,
                {
                  borderColor: isCorrect ? '#86EFAC' : wrong ? '#FCA5A5' : colors.border,
                  backgroundColor: isCorrect ? '#F0FDF4' : wrong ? '#FEF2F2' : colors.surface,
                },
              ]}
            >
              {options.map((opt) => {
                const active = picked === opt.id
                const okOption = feedback && correct === opt.id
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => pick(key, opt.id)}
                    disabled={feedback}
                    style={({ pressed }) => [
                      styles.dropdownOpt,
                      {
                        backgroundColor: active || okOption ? palette.brand.red600 : 'transparent',
                      },
                      okOption && { backgroundColor: '#15803D' },
                      pressed && !feedback && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={{
                        color: active || okOption ? '#fff' : colors.text,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {opt.text}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MATRIX (MCQ + SATA)
// ─────────────────────────────────────────────────────────────────────────────

function MatrixRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  // Expected shape: { rows: [{id, text}], cols: [{id, text}] } either inside
  // question.options or question.metadata.
  const meta = (question.options ?? question.metadata ?? {}) as any
  const rows: Array<{ id: string; text: string }> = useMemo(
    () => normalizeOptions(meta.rows ?? []),
    [meta.rows],
  )
  const cols: Array<{ id: string; text: string }> = useMemo(
    () => normalizeOptions(meta.cols ?? meta.columns ?? []),
    [meta.cols, meta.columns],
  )
  const isMulti = question.format === 'MATRIX_SATA'
  const sel: Record<string, string | string[]> = value && typeof value === 'object' ? value : {}
  const correctMap: Record<string, string | string[]> =
    correctAnswer && typeof correctAnswer === 'object' ? (correctAnswer as any) : {}

  function pick(rowId: string, colId: string) {
    if (feedback) return
    if (isMulti) {
      const current = Array.isArray(sel[rowId]) ? (sel[rowId] as string[]) : []
      const next = current.includes(colId) ? current.filter((c) => c !== colId) : [...current, colId]
      onChange({ ...sel, [rowId]: next })
    } else {
      onChange({ ...sel, [rowId]: colId })
    }
  }

  function cellState(rowId: string, colId: string) {
    const picked = sel[rowId]
    const isSelected = Array.isArray(picked) ? picked.includes(colId) : picked === colId
    const correct = correctMap[rowId]
    const isCorrectCell = feedback && (Array.isArray(correct) ? correct.includes(colId) : correct === colId)
    const isWrongPick = feedback && isSelected && !isCorrectCell
    return { isSelected, isCorrectCell, isWrongPick }
  }

  if (rows.length === 0 || cols.length === 0) {
    return <UnsupportedRenderer format={question.format} reason="Matrix structure is missing rows or columns in this question." />
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ gap: 6 }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row' }}>
          <View style={[styles.matrixCell, styles.matrixHeader, { width: 140, backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }} />
          </View>
          {cols.map((c) => (
            <View key={c.id} style={[styles.matrixCell, styles.matrixHeader, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>
                {c.text}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row' }}>
            <View style={[styles.matrixCell, { width: 140, backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={3}>
                {r.text}
              </Text>
            </View>
            {cols.map((c) => {
              const { isSelected, isCorrectCell, isWrongPick } = cellState(r.id, c.id)
              const bg = isCorrectCell
                ? '#DCFCE7'
                : isWrongPick
                ? '#FEE2E2'
                : isSelected
                ? palette.brand.red50
                : colors.surface
              const border = isCorrectCell
                ? '#86EFAC'
                : isWrongPick
                ? '#FCA5A5'
                : isSelected
                ? palette.brand.red500
                : colors.border
              return (
                <Pressable
                  key={c.id}
                  onPress={() => pick(r.id, c.id)}
                  disabled={feedback}
                  style={({ pressed }) => [
                    styles.matrixCell,
                    { backgroundColor: bg, borderColor: border },
                    pressed && !feedback && { opacity: 0.85 },
                  ]}
                >
                  {isSelected ? (
                    <Ionicons name="checkmark" size={20} color={isCorrectCell ? '#15803D' : isWrongPick ? palette.brand.red700 : palette.brand.red600} />
                  ) : isCorrectCell ? (
                    <Ionicons name="ellipse-outline" size={16} color="#15803D" />
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BOW_TIE — left choices / center main / right choices, pick best from each side
// ─────────────────────────────────────────────────────────────────────────────

function BowTieRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  const meta = (question.options ?? {}) as any
  const left = useMemo(() => normalizeOptions(meta.left ?? meta.actions ?? meta.priorityActions ?? []), [meta])
  const center = useMemo(() => normalizeOptions(meta.center ?? meta.conditions ?? []), [meta])
  const right = useMemo(() => normalizeOptions(meta.right ?? meta.parameters ?? meta.monitoring ?? []), [meta])

  const sel: Record<string, string | string[]> = value && typeof value === 'object' ? value : {}
  const correctMap: Record<string, string | string[]> =
    correctAnswer && typeof correctAnswer === 'object' ? (correctAnswer as any) : {}

  function pick(zone: 'left' | 'center' | 'right', id: string) {
    if (feedback) return
    const current = sel[zone]
    if (zone === 'left' || zone === 'right') {
      // multi-select (typically 2 each)
      const arr = Array.isArray(current) ? current : []
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
      onChange({ ...sel, [zone]: next })
    } else {
      onChange({ ...sel, [zone]: id })
    }
  }

  function isSelected(zone: 'left' | 'center' | 'right', id: string): boolean {
    const v = sel[zone]
    return Array.isArray(v) ? v.includes(id) : v === id
  }

  function isCorrect(zone: 'left' | 'center' | 'right', id: string): boolean {
    if (!feedback) return false
    const v = correctMap[zone]
    return Array.isArray(v) ? v.includes(id) : v === id
  }

  if (left.length === 0 && center.length === 0 && right.length === 0) {
    return <UnsupportedRenderer format={question.format} reason="Bow-tie structure is missing left / center / right groups." />
  }

  return (
    <View style={{ gap: spacing.md }}>
      <BowTieZone label="Actions to take" options={left} zone="left" pick={pick} isSelected={isSelected} isCorrect={isCorrect} feedback={feedback} />
      <BowTieZone label="Condition" options={center} zone="center" pick={pick} isSelected={isSelected} isCorrect={isCorrect} feedback={feedback} />
      <BowTieZone label="Parameters to monitor" options={right} zone="right" pick={pick} isSelected={isSelected} isCorrect={isCorrect} feedback={feedback} />
    </View>
  )
}

function BowTieZone({
  label,
  options,
  zone,
  pick,
  isSelected,
  isCorrect,
  feedback,
}: {
  label: string
  options: Array<{ id: string; text: string }>
  zone: 'left' | 'center' | 'right'
  pick: (zone: 'left' | 'center' | 'right', id: string) => void
  isSelected: (zone: 'left' | 'center' | 'right', id: string) => boolean
  isCorrect: (zone: 'left' | 'center' | 'right', id: string) => boolean
  feedback: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
        {label}
      </Text>
      {options.map((opt) => {
        const sel = isSelected(zone, opt.id)
        const ok = isCorrect(zone, opt.id)
        const wrong = feedback && sel && !ok
        const { bg, border, dot } = optionTone(colors, sel, ok, wrong, feedback)
        return (
          <Pressable
            key={opt.id}
            onPress={() => pick(zone, opt.id)}
            disabled={feedback}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: bg, borderColor: border },
              pressed && !feedback && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.checkbox, { borderColor: dot, backgroundColor: sel || ok ? dot : 'transparent' }]}>
              {sel || ok ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{opt.text}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT_TEXT — tap a word/phrase to highlight it
// ─────────────────────────────────────────────────────────────────────────────

function HighlightRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  // Stem may be pre-tokenized in options.tokens, else split on whitespace.
  const tokens = useMemo<string[]>(() => {
    const raw = (question.options as any)?.tokens
    if (Array.isArray(raw)) return raw.map((t: any) => String(t))
    return (question.stem ?? '').split(/(\s+)/).filter((t) => t.trim().length > 0)
  }, [question.options, question.stem])

  const selected: string[] = Array.isArray(value) ? value.map(String) : []
  const corrects = correctSet(correctAnswer)

  function toggle(token: string) {
    if (feedback) return
    if (selected.includes(token)) onChange(selected.filter((t) => t !== token))
    else onChange([...selected, token])
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
        Tap each phrase that supports your answer.
      </Text>
      <View
        style={[
          styles.highlightBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 28 }}>
          {tokens.map((t, i) => {
            const isSelected = selected.includes(t)
            const isCorrect = feedback && corrects.has(t)
            const isWrong = feedback && isSelected && !isCorrect
            return (
              <Text
                key={`${t}-${i}`}
                onPress={() => toggle(t)}
                style={{
                  backgroundColor: isCorrect
                    ? '#BBF7D0'
                    : isWrong
                    ? '#FECACA'
                    : isSelected
                    ? '#FEF08A'
                    : 'transparent',
                  color: colors.text,
                }}
              >
                {t}{' '}
              </Text>
            )
          })}
        </Text>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAG_DROP — items dragged from a tray to a set of slots
// ─────────────────────────────────────────────────────────────────────────────

interface DragSlot {
  id: string
  label: string
}

function DragDropRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  const meta = (question.options ?? {}) as any
  const items = useMemo(() => normalizeOptions(meta.items ?? meta.choices ?? []), [meta])
  const slots: DragSlot[] = useMemo(() => {
    const raw = meta.slots ?? meta.targets ?? []
    return normalizeOptions(raw).map((s) => ({ id: s.id, label: s.text }))
  }, [meta])

  const assignment: Record<string, string> = value && typeof value === 'object' ? value : {}
  const correctMap: Record<string, string> =
    correctAnswer && typeof correctAnswer === 'object' ? (correctAnswer as any) : {}

  function place(slotId: string, itemId: string) {
    if (feedback) return
    // Remove this item from any other slot first.
    const next: Record<string, string> = {}
    for (const [s, i] of Object.entries(assignment)) {
      if (i !== itemId) next[s] = i
    }
    next[slotId] = itemId
    onChange(next)
  }

  function unplace(slotId: string) {
    if (feedback) return
    const next = { ...assignment }
    delete next[slotId]
    onChange(next)
  }

  const usedItemIds = new Set(Object.values(assignment))
  const trayItems = items.filter((i) => !usedItemIds.has(i.id))

  if (items.length === 0 || slots.length === 0) {
    return <UnsupportedRenderer format={question.format} reason="Drag-drop is missing items or slots." />
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
        Drag the cards on top into the slots below — or tap a card, then tap a slot.
      </Text>
      <View style={[styles.tray, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        {trayItems.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>All cards placed.</Text>
        ) : (
          trayItems.map((item) => (
            <DraggableCard key={item.id} item={item} onTap={() => null} slots={slots} onAssign={place} />
          ))
        )}
      </View>
      <View style={{ gap: 8 }}>
        {slots.map((slot) => {
          const itemId = assignment[slot.id]
          const item = items.find((i) => i.id === itemId)
          const correctItemId = correctMap[slot.id]
          const isCorrect = feedback && correctItemId === itemId
          const isWrong = feedback && correctItemId !== itemId
          const correctItem = correctItemId ? items.find((i) => i.id === correctItemId) : null
          return (
            <View key={slot.id} style={{ gap: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                {slot.label}
              </Text>
              <Pressable
                onPress={() => itemId && unplace(slot.id)}
                style={[
                  styles.slot,
                  {
                    backgroundColor: isCorrect ? '#F0FDF4' : isWrong ? '#FEF2F2' : colors.surface,
                    borderColor: isCorrect ? '#86EFAC' : isWrong ? '#FCA5A5' : item ? palette.brand.red500 : colors.border,
                    borderStyle: item ? 'solid' : 'dashed',
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
                  {item?.text ?? 'Drop here'}
                </Text>
                {item ? <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} /> : null}
              </Pressable>
              {isWrong && correctItem ? (
                <Text style={{ color: '#15803D', fontSize: 11 }}>
                  Correct: <Text style={{ fontWeight: '800' }}>{correctItem.text}</Text>
                </Text>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** Draggable card with PanGesture — drops the card onto the first slot whose
 *  vertical position is below the drop point. Falls back to a tap-then-tap
 *  fallback for simpler interaction. */
function DraggableCard({
  item,
  slots,
  onAssign,
}: {
  item: { id: string; text: string }
  slots: DragSlot[]
  onAssign: (slotId: string, itemId: string) => void
  onTap?: () => void
}) {
  const { colors } = useTheme()
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const scale = useSharedValue(1)
  const [picking, setPicking] = useState(false)

  const pan = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(1.05)
    })
    .onUpdate((e) => {
      tx.value = e.translationX
      ty.value = e.translationY
    })
    .onEnd(() => {
      scale.value = withSpring(1)
      tx.value = withSpring(0)
      ty.value = withSpring(0)
    })

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  // Tap fallback: tap card → pick a slot via Alert (avoids needing measured
  // layout to detect drop targets). On phones this is more reliable for
  // accessibility than precision drag.
  function onCardPress() {
    if (slots.length === 1) {
      onAssign(slots[0].id, item.id)
      return
    }
    setPicking(true)
  }

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View style={[style]}>
          <Pressable
            onPress={onCardPress}
            style={({ pressed }) => [
              styles.dragCard,
              { backgroundColor: '#fff', borderColor: palette.brand.red500 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="reorder-three-outline" size={16} color={palette.brand.red600} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{item.text}</Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
      {picking ? (
        <View style={[styles.pickerPopup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
            Place in
          </Text>
          {slots.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                onAssign(s.id, item.id)
                setPicking(false)
              }}
              style={({ pressed }) => [
                styles.pickerOpt,
                { backgroundColor: colors.surfaceMuted },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{s.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setPicking(false)} style={{ alignSelf: 'flex-end', padding: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERED_RESPONSE — reorder a list into the correct sequence
// ─────────────────────────────────────────────────────────────────────────────

function OrderedResponseRenderer({ question, value, onChange, feedback, correctAnswer }: QuestionRendererProps) {
  const { colors } = useTheme()
  const opts = useMemo(() => normalizeOptions(question.options), [question.options])
  const order: string[] =
    Array.isArray(value) && value.length === opts.length
      ? value.map(String)
      : opts.map((o) => o.id)

  // Sync default order to parent on first render if value is empty.
  useEffect(() => {
    if (!Array.isArray(value) || value.length !== opts.length) {
      onChange(order)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.length])

  function move(idx: number, delta: number) {
    if (feedback) return
    const next = [...order]
    const target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  const correctOrder: string[] = Array.isArray(correctAnswer) ? (correctAnswer as any).map(String) : []

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
        Put the steps in the correct order using the arrows.
      </Text>
      {order.map((id, i) => {
        const opt = opts.find((o) => o.id === id)
        if (!opt) return null
        const isCorrectPosition = feedback && correctOrder[i] === id
        const bg = isCorrectPosition ? '#F0FDF4' : feedback ? '#FEF2F2' : colors.surface
        const border = isCorrectPosition ? '#86EFAC' : feedback ? '#FCA5A5' : colors.border
        return (
          <View
            key={id}
            style={[
              styles.orderRow,
              { backgroundColor: bg, borderColor: border },
            ]}
          >
            <View style={[styles.orderBadge, { backgroundColor: palette.brand.red600 }]}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{opt.text}</Text>
            {!feedback ? (
              <View style={{ gap: 4 }}>
                <Pressable
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  hitSlop={6}
                  style={({ pressed }) => [styles.arrowBtn, i === 0 && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="chevron-up" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  hitSlop={6}
                  style={({ pressed }) => [styles.arrowBtn, i === order.length - 1 && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="chevron-down" size={18} color={colors.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Unsupported (fallback while a format is being implemented)
// ─────────────────────────────────────────────────────────────────────────────

function UnsupportedRenderer({ format, reason }: { format: string; reason?: string }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.unsupportedBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Ionicons name="construct-outline" size={18} color={colors.textMuted} />
      <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>
        {reason ?? `This question format (${format}) isn't supported yet on mobile.`}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tone helpers
// ─────────────────────────────────────────────────────────────────────────────

function optionTone(
  colors: ReturnType<typeof useTheme>['colors'],
  selected: boolean,
  correct: boolean | null,
  wrong: boolean | null,
  hasFeedback: boolean,
): { bg: string; border: string; dot: string } {
  if (hasFeedback && correct) return { bg: '#F0FDF4', border: '#86EFAC', dot: '#15803D' }
  if (wrong) return { bg: '#FEF2F2', border: '#FCA5A5', dot: palette.brand.red700 }
  if (selected) return { bg: palette.brand.red50, border: palette.brand.red500, dot: palette.brand.red600 }
  return { bg: colors.surface, border: colors.border, dot: colors.border }
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  dropdownBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dropdownOpt: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  matrixCell: {
    width: 80,
    minHeight: 56,
    padding: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixHeader: {
    minHeight: 48,
  },
  highlightBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dragCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  pickerPopup: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 6,
  },
  pickerOpt: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: 2,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtn: {
    padding: 2,
  },
  unsupportedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
})

// runOnJS placeholder kept to silence unused import warnings if formatters
// shift to UI-thread drop detection later.
void runOnJS
