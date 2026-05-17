import React, { useEffect } from 'react'
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { radius, useTheme } from '@/theme'

/**
 * Subtle pulsing placeholder block for loading states. Replaces the flat
 * "Loading…" text that we had previously — gives users a sense of structure
 * even before data arrives.
 *
 * Usage:
 *   <Skeleton height={20} width="60%" />
 *   <SkeletonRow />          // pre-baked row with avatar + 2 lines
 *   <SkeletonCard />         // pre-baked card-sized block
 */
interface SkeletonProps {
  width?: number | string
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ width = '100%', height = 14, radius: r = 6, style }: SkeletonProps) {
  const { colors, mode } = useTheme()
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
  }, [opacity])

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: r,
          backgroundColor: mode === 'dark' ? '#1F2937' : '#E5E7EB',
        },
        animStyle,
        style,
      ]}
    />
  )
}

/** Pre-baked row: 36×36 circle + two stacked lines. */
export function SkeletonRow() {
  const { colors } = useTheme()
  return (
    <View
      style={[
        rowStyles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Skeleton width={36} height={36} radius={18} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={12} />
      </View>
    </View>
  )
}

/** Pre-baked card-sized placeholder for hero / summary sections. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        cardStyles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Skeleton width="55%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={`${Math.max(50, 95 - i * 8)}%`}
          height={12}
          style={{ marginTop: 8 }}
        />
      ))}
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
})

const cardStyles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
})
