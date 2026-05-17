import React from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import { radius, spacing, useTheme } from '@/theme'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function Card({ children, style }: CardProps) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function CardTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme()
  return (
    <Text style={[styles.title, { color: colors.text }, style]}>{children}</Text>
  )
}

export function CardSubtitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme()
  return (
    <Text style={[styles.subtitle, { color: colors.textMuted }, style]}>{children}</Text>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
})
