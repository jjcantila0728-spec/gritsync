import React, { useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { Button } from '@/components/Button'
import { BrandMark, Wordmark } from '@/components/Brand'
import { useTheme, palette, radius, spacing } from '@/theme'
import { storage } from '@/lib/storage'

interface Slide {
  icon: keyof typeof Ionicons.glyphMap
  eyebrow: string
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: 'briefcase-outline',
    eyebrow: 'TRACK YOUR APPLICATION',
    title: 'Every milestone, in one place',
    body: 'Real-time status updates, payment receipts, and timeline check-ins from your GritSync advisor — straight to your home screen.',
  },
  {
    icon: 'document-attach-outline',
    eyebrow: 'UPLOAD WITH YOUR CAMERA',
    title: 'Snap a doc in two taps',
    body: 'Passport, diploma, and selfie — capture or pick from your library. We auto-format and securely encrypt everything.',
  },
  {
    icon: 'school-outline',
    eyebrow: 'NCLEX REVIEW ON THE GO',
    title: 'Full Q-Banks, calculator, notes',
    body: 'Classic + NGN questions in all 10 official formats, plus videos, live lectures, and a built-in exam timer.',
  },
  {
    icon: 'chatbubbles-outline',
    eyebrow: 'STAY IN TOUCH',
    title: 'Messages, emails, and pushes',
    body: 'Chat with your advisor, manage your gritsync.com inbox, and never miss a status change — all from one app.',
  },
]

const { width: SCREEN_W } = Dimensions.get('window')
const ONBOARDED_KEY = 'gritsync.onboarded'

export default function OnboardingScreen() {
  const { colors, mode } = useTheme()
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList<Slide>>(null)

  async function finish() {
    await storage.set(ONBOARDED_KEY, '1').catch(() => {})
    router.replace('/(auth)/login')
  }

  function next() {
    if (index >= SLIDES.length - 1) {
      void finish()
      return
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true })
  }

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index)
  }).current

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.brand.red700 }}>
      <LinearGradient
        colors={[palette.brand.red700, palette.brand.red600, palette.brand.red500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.headerRow}>
        <BrandMark size={32} />
        <Wordmark size={16} mode={mode} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={finish} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13 }}>
            Skip
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => <SlideCard slide={item} />}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Dot key={i} active={i === index} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          {index > 0 ? (
            <Pressable
              onPress={() => listRef.current?.scrollToIndex({ index: index - 1, animated: true })}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={next}
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: '#FFFFFF' },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={{ color: palette.brand.red700, fontWeight: '800', fontSize: 15 }}>
              {index === SLIDES.length - 1 ? 'Get started' : 'Next'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={palette.brand.red700}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

function SlideCard({ slide }: { slide: Slide }) {
  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <View style={styles.slideIconWrap}>
        <Ionicons name={slide.icon} size={64} color="#FFFFFF" />
      </View>
      <Text style={styles.slideEyebrow}>{slide.eyebrow}</Text>
      <Text style={styles.slideTitle}>{slide.title}</Text>
      <Text style={styles.slideBody}>{slide.body}</Text>
    </View>
  )
}

function Dot({ active }: { active: boolean }) {
  const w = useSharedValue(active ? 24 : 8)
  React.useEffect(() => {
    w.value = withSpring(active ? 24 : 8, { damping: 16, stiffness: 200 })
  }, [active, w])
  const style = useAnimatedStyle(() => ({ width: w.value }))
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.35)' },
        style,
      ]}
    />
  )
}

/** Check whether the user has already seen the onboarding tour. */
export async function hasSeenOnboarding(): Promise<boolean> {
  return (await storage.get(ONBOARDED_KEY).catch(() => null)) === '1'
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: 6,
  },
  slide: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.md,
  },
  slideIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  slideEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  slideTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  slideBody: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

void Button
