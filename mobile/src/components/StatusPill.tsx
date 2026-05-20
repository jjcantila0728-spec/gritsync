import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radius, useTheme } from '@/theme'

/**
 * Shared status pill used by the home tab, the applications detail screen,
 * and the timeline. Previously each screen reimplemented a `pillTone` switch
 * with hardcoded hex values that didn't respect dark mode — this centralizes
 * the mapping and pulls colors from the active theme's `tones.*`.
 *
 * The `status` prop accepts the raw value from the database (`pending`,
 * `in_progress`, `in-progress`, `completed`, `rejected`, `cancelled`, …) and
 * the rendered label is the un-snake-cased version uppercased.
 */
export interface StatusPillProps {
  status?: string | null
  /** Optional custom label override (e.g. for legacy strings). */
  label?: string
  size?: 'sm' | 'md'
}

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

function toneFor(status?: string | null): Tone {
  const s = (status ?? '').toLowerCase()
  if (s === 'completed' || s === 'paid' || s === 'approved' || s === 'available') return 'success'
  if (s === 'in-progress' || s === 'in_progress' || s === 'publishing' || s === 'queued' || s === 'scheduled') return 'info'
  if (s === 'rejected' || s === 'cancelled' || s === 'failed') return 'danger'
  if (s === '' || s === 'draft' || s === 'archived') return 'neutral'
  // Default (pending, partial, review, …) — yellow warning tone.
  return 'warning'
}

export function StatusPill({ status, label, size = 'sm' }: StatusPillProps) {
  const { colors } = useTheme()
  const tone = colors.tones[toneFor(status)]
  const text = (label ?? status ?? 'pending').toString().replace(/_/g, ' ')
  const padV = size === 'md' ? 6 : 4
  const padH = size === 'md' ? 12 : 10
  const fontSize = size === 'md' ? 11 : 10
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: tone.bg, borderColor: tone.border, paddingVertical: padV, paddingHorizontal: padH },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${text}`}
    >
      <Text
        style={{
          color: tone.fg,
          fontSize,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
})
