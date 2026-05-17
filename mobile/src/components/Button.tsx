import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native'
import { palette, radius, spacing } from '@/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props {
  title: string
  onPress?: () => void
  loading?: boolean
  disabled?: boolean
  variant?: Variant
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].text.color as string} />
      ) : (
        <Text style={[styles.label, variantStyles[variant].text, textStyle]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
})

const variantStyles: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: palette.brand.red600 },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    container: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    text: { color: '#111827' },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: palette.brand.red600 },
  },
  danger: {
    container: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
    text: { color: palette.brand.red700 },
  },
}
