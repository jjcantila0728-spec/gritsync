import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { palette, radius, spacing, useTheme } from '@/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md'

interface Props {
  title: string
  onPress?: () => void
  loading?: boolean
  disabled?: boolean
  variant?: Variant
  size?: Size
  /** Optional leading icon — keeps icon-label spacing consistent across screens. */
  icon?: keyof typeof Ionicons.glyphMap
  /** Override the announced label (defaults to `title`). */
  accessibilityLabel?: string
  /** Optional supplementary hint announced by screen readers. */
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  icon,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}: Props) {
  const { colors } = useTheme()
  const isDisabled = disabled || loading
  const v = themedVariant(variant, colors)
  const sizeStyle = size === 'sm' ? sizeStyles.sm : sizeStyles.md
  const textSize = size === 'sm' ? 14 : 16

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={isDisabled ? undefined : { color: v.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        v.container,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color as string} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Ionicons name={icon} size={textSize + 2} color={v.text.color as string} />
          ) : null}
          <Text style={[styles.label, { fontSize: textSize }, v.text, textStyle]}>{title}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})

const sizeStyles = StyleSheet.create({
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
})

interface VariantStyle {
  container: ViewStyle
  text: TextStyle
  ripple: string
}

// Variants are derived from the live palette so dark mode looks right
// without the previous `#F3F4F6 / #FEE2E2` hardcoded surfaces.
function themedVariant(variant: Variant, colors: ReturnType<typeof useTheme>['colors']): VariantStyle {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: palette.brand.red600 },
        text: { color: '#FFFFFF' },
        ripple: 'rgba(255,255,255,0.20)',
      }
    case 'secondary':
      return {
        container: {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
        },
        text: { color: colors.text },
        ripple: 'rgba(127,127,127,0.18)',
      }
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        },
        text: { color: colors.text },
        ripple: 'rgba(127,127,127,0.18)',
      }
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: colors.accent },
        ripple: 'rgba(127,127,127,0.18)',
      }
    case 'danger':
      return {
        container: {
          backgroundColor: colors.tones.danger.bg,
          borderWidth: 1,
          borderColor: colors.tones.danger.border,
        },
        text: { color: colors.tones.danger.fg },
        ripple: 'rgba(220,38,38,0.20)',
      }
  }
}
