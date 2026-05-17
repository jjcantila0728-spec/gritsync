import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useExamTheme as useTheme, palette, radius, spacing } from '@/theme'

export interface QuestionListItem {
  index: number
  status: 'unanswered' | 'answered' | 'flagged' | 'current'
}

export function QuestionListSheet({
  visible,
  items,
  currentIndex,
  flagged,
  answered,
  onClose,
  onJump,
}: {
  visible: boolean
  items: QuestionListItem[]
  currentIndex: number
  flagged: Set<number>
  answered: Set<number>
  onClose: () => void
  onJump: (i: number) => void
}) {
  const { colors } = useTheme()
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.body, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Ionicons name="list" size={20} color={palette.brand.red600} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 }}>Question list</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.legend}>
            <Legend dot={palette.brand.red600} label="Current" />
            <Legend dot="#15803D" label="Answered" outline />
            <Legend dot="#F59E0B" label="Flagged" />
            <Legend dot={colors.border} label="Unanswered" />
          </View>

          <ScrollView contentContainerStyle={styles.grid}>
            {items.map((it) => {
              const isCurrent = it.index === currentIndex
              const isFlagged = flagged.has(it.index)
              const isAnswered = answered.has(it.index)
              let bg = colors.surface
              let border = colors.border
              let fg = colors.text
              if (isCurrent) {
                bg = palette.brand.red600
                border = palette.brand.red600
                fg = '#fff'
              } else if (isAnswered) {
                bg = '#F0FDF4'
                border = '#86EFAC'
                fg = '#15803D'
              } else if (isFlagged) {
                bg = '#FEF3C7'
                border = '#FCD34D'
                fg = '#92400E'
              }
              return (
                <Pressable
                  key={it.index}
                  onPress={() => {
                    onJump(it.index)
                    onClose()
                  }}
                  style={({ pressed }) => [
                    styles.cell,
                    { backgroundColor: bg, borderColor: border },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={{ color: fg, fontWeight: '800', fontSize: 13 }}>
                    {it.index + 1}
                  </Text>
                  {isFlagged ? (
                    <Ionicons name="flag" size={9} color="#F59E0B" style={{ position: 'absolute', top: 4, right: 4 }} />
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function Legend({ dot, label, outline }: { dot: string; label: string; outline?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: outline ? '#F0FDF4' : dot,
          borderWidth: outline ? 1 : 0,
          borderColor: dot,
        }}
      />
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  body: {
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: spacing.lg,
  },
  cell: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
