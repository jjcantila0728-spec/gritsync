import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { BrandMark, Wordmark } from './Brand'
import { spacing } from '@/theme'

interface SplashProps {
  message?: string
  /** When true, fades the splash out after mount (use on top of loaded content). */
  fadingOut?: boolean
}

/**
 * Branded full-screen loading state. Two animated layers:
 *
 * - The GritSync icon "breathes": a soft scale + opacity loop. This is the
 *   primary anchor a user fixates on, so the motion has to feel calm — fast
 *   pulses read as a system alert, not a load screen.
 * - The wordmark fades up into place once, then sits still. Continuous text
 *   motion would be distracting on retries.
 *
 * Background uses a vertical brand-red gradient — visible on cold start and
 * over the auth flow, and meets the brand color theme of #DC2626.
 */
export function Splash({ message = 'Loading GritSync…', fadingOut = false }: SplashProps) {
  const scale = useSharedValue(1)
  const glow = useSharedValue(0.6)
  const wordOpacity = useSharedValue(0)
  const wordTranslate = useSharedValue(8)
  const containerOpacity = useSharedValue(1)
  const dot1 = useSharedValue(0)
  const dot2 = useSharedValue(0)
  const dot3 = useSharedValue(0)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
    wordOpacity.value = withDelay(220, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }))
    wordTranslate.value = withDelay(220, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }))

    // Cascading dots — the "we're working" indicator under the wordmark.
    const dotLoop = (sv: typeof dot1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 360, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 360, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      )
    }
    dotLoop(dot1, 0)
    dotLoop(dot2, 160)
    dotLoop(dot3, 320)
  }, [scale, glow, wordOpacity, wordTranslate, dot1, dot2, dot3])

  useEffect(() => {
    if (fadingOut) {
      containerOpacity.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) })
    }
  }, [fadingOut, containerOpacity])

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }))
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: scale.value * 1.25 }],
  }))
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordTranslate.value }],
  }))
  const dotStyle = (sv: typeof dot1) =>
    useAnimatedStyle(() => ({ opacity: 0.35 + sv.value * 0.65, transform: [{ scale: 0.7 + sv.value * 0.35 }] }))

  return (
    <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
      <LinearGradient
        colors={['#B91C1C', '#DC2626', '#EF4444']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={markStyle}>
            <BrandMark size={104} />
          </Animated.View>
        </View>
        <Animated.View style={[{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }, wordStyle]}>
          <Wordmark size={28} mode="dark" />
          <Text style={styles.tagline}>NCLEX Processing · simplified</Text>
        </Animated.View>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, dotStyle(dot1)]} />
          <Animated.View style={[styles.dot, dotStyle(dot2)]} />
          <Animated.View style={[styles.dot, dotStyle(dot3)]} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  message: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: spacing.md,
  },
})
