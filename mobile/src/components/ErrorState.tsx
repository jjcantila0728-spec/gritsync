import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from './Button'
import { useTheme, palette, radius, spacing } from '@/theme'

/**
 * Friendly error / empty state with optional retry. Keeps screens from
 * showing blank cards when a fetch fails or a list is genuinely empty.
 */
export interface ErrorStateProps {
  variant?: 'empty' | 'error' | 'offline'
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  body?: string
  retryLabel?: string
  onRetry?: () => void
}

export function ErrorState({
  variant = 'empty',
  icon,
  title,
  body,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  const { colors } = useTheme()
  const tone =
    variant === 'offline'
      ? { bg: '#FEF3C7', border: '#FCD34D', fg: '#B45309', defaultIcon: 'cloud-offline-outline' as const }
      : variant === 'error'
      ? { bg: '#FEE2E2', border: '#FCA5A5', fg: palette.brand.red700, defaultIcon: 'alert-circle-outline' as const }
      : { bg: palette.brand.red50, border: palette.brand.red200, fg: palette.brand.red700, defaultIcon: 'leaf-outline' as const }
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <Ionicons name={icon ?? tone.defaultIcon} size={26} color={tone.fg} />
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
          {body}
        </Text>
      ) : null}
      {onRetry ? (
        <Button title={retryLabel ?? 'Try again'} onPress={onRetry} style={{ marginTop: spacing.sm, minWidth: 160 }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
})
