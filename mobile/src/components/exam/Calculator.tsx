import React, { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useExamTheme as useTheme, palette, radius, spacing } from '@/theme'

/**
 * Custom calculator keypad for the NCLEX exam runner.
 *
 * Intentionally minimal — basic arithmetic only, no scientific functions
 * (matches what the official NCLEX exam interface offers). State is held
 * locally; closing the modal does not reset the display so the user can
 * dismiss for a re-read of the stem and come back to it.
 */
export function Calculator({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme()
  const [display, setDisplay] = useState('0')
  const [accumulator, setAccumulator] = useState<number | null>(null)
  const [op, setOp] = useState<'+' | '-' | '×' | '÷' | null>(null)
  const [overwrite, setOverwrite] = useState(true)

  function digit(d: string) {
    if (overwrite) {
      setDisplay(d === '.' ? '0.' : d)
      setOverwrite(false)
      return
    }
    if (d === '.' && display.includes('.')) return
    if (display.length >= 16) return
    setDisplay(display === '0' && d !== '.' ? d : display + d)
  }

  function operate(next: '+' | '-' | '×' | '÷' | null) {
    const current = parseFloat(display)
    if (op !== null && accumulator !== null && !overwrite) {
      const result = compute(accumulator, current, op)
      setAccumulator(result)
      setDisplay(fmt(result))
    } else {
      setAccumulator(current)
    }
    setOp(next)
    setOverwrite(true)
  }

  function equals() {
    if (op === null || accumulator === null) return
    const result = compute(accumulator, parseFloat(display), op)
    setDisplay(fmt(result))
    setAccumulator(null)
    setOp(null)
    setOverwrite(true)
  }

  function clear() {
    setDisplay('0')
    setAccumulator(null)
    setOp(null)
    setOverwrite(true)
  }

  function backspace() {
    if (overwrite) return
    const next = display.slice(0, -1)
    setDisplay(next.length === 0 ? '0' : next)
  }

  function flip() {
    if (display === '0') return
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`)
  }

  function percent() {
    setDisplay(fmt(parseFloat(display) / 100))
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <Pressable onPress={(e) => e.stopPropagation()} style={[styles.body, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.header}>
            <Ionicons name="calculator" size={20} color={palette.brand.red600} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 }}>Calculator</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={[styles.display, { backgroundColor: colors.surfaceMuted }]}>
            {op !== null ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, alignSelf: 'flex-end' }}>
                {accumulator ?? ''} {op}
              </Text>
            ) : null}
            <Text
              style={{
                color: colors.text,
                fontSize: 40,
                fontWeight: '300',
                textAlign: 'right',
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {display}
            </Text>
          </View>

          <View style={styles.keys}>
            <Row>
              <Key label="C" tone="util" onPress={clear} />
              <Key label="±" tone="util" onPress={flip} />
              <Key label="%" tone="util" onPress={percent} />
              <Key label="÷" tone="op" onPress={() => operate('÷')} active={op === '÷'} />
            </Row>
            <Row>
              <Key label="7" onPress={() => digit('7')} />
              <Key label="8" onPress={() => digit('8')} />
              <Key label="9" onPress={() => digit('9')} />
              <Key label="×" tone="op" onPress={() => operate('×')} active={op === '×'} />
            </Row>
            <Row>
              <Key label="4" onPress={() => digit('4')} />
              <Key label="5" onPress={() => digit('5')} />
              <Key label="6" onPress={() => digit('6')} />
              <Key label="−" tone="op" onPress={() => operate('-')} active={op === '-'} />
            </Row>
            <Row>
              <Key label="1" onPress={() => digit('1')} />
              <Key label="2" onPress={() => digit('2')} />
              <Key label="3" onPress={() => digit('3')} />
              <Key label="+" tone="op" onPress={() => operate('+')} active={op === '+'} />
            </Row>
            <Row>
              <Key label="0" wide onPress={() => digit('0')} />
              <Key label="." onPress={() => digit('.')} />
              <Key label="⌫" tone="util" onPress={backspace} />
              <Key label="=" tone="primary" onPress={equals} />
            </Row>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>
}

function Key({
  label,
  onPress,
  tone = 'default',
  active = false,
  wide = false,
}: {
  label: string
  onPress: () => void
  tone?: 'default' | 'op' | 'util' | 'primary'
  active?: boolean
  wide?: boolean
}) {
  const { colors } = useTheme()
  // Pearson Vue look — calculator stays light regardless of system theme.
  const base = '#F3F4F6'
  const utility = '#E5E7EB'
  const opBg = active ? '#FFFFFF' : palette.brand.red600
  const opFg = active ? palette.brand.red600 : '#FFFFFF'
  let bg: string = base
  let fg: string = colors.text
  if (tone === 'op') { bg = opBg; fg = opFg }
  if (tone === 'primary') { bg = palette.brand.red700; fg = '#FFFFFF' }
  if (tone === 'util') { bg = utility; fg = colors.text }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        wide && { flex: 2 },
        { backgroundColor: bg },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={{ color: fg, fontSize: 22, fontWeight: tone === 'op' || tone === 'primary' ? '800' : '600' }}>
        {label}
      </Text>
    </Pressable>
  )
}

function compute(a: number, b: number, op: '+' | '-' | '×' | '÷'): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? NaN : a / b
  }
}

function fmt(n: number): string {
  if (!isFinite(n)) return 'Error'
  if (Number.isInteger(n)) return String(n)
  // Trim trailing zeros for display, cap precision to avoid float spam.
  return parseFloat(n.toFixed(10)).toString()
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  body: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  display: {
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 80,
    justifyContent: 'flex-end',
  },
  keys: {
    gap: 8,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
