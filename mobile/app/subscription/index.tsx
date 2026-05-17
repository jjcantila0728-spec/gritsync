import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { SkeletonCard } from '@/components/Skeleton'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type NclexProfile } from '@/lib/nclex'
import { openUrl } from '@/lib/browser'
import { API_BASE_URL } from '@/lib/api'
import { LinearGradient } from 'expo-linear-gradient'

/**
 * Subscription management — accessible from Settings (and from the
 * subscription card on the review hub).
 *
 * Shows:
 *   - current tier badge + expiry countdown
 *   - "Renew / upgrade" CTA → routes back to the review hub subscription tab
 *   - "View order history" → /subscription/orders
 *   - "Manage in browser" → web portal for the legacy cancel/refund flow
 *
 * Cancelation isn't exposed via the existing /nclex/* API yet, so for
 * now we deep-link to the web portal — which already supports it.
 */
export default function SubscriptionManagement() {
  const { colors } = useTheme()
  const router = useRouter()
  const [profile, setProfile] = useState<NclexProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setProfile(await nclexAPI.profile())
    } catch {
      // 401 will sign out via interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tier = profile?.tier ?? 'FREE'
  const expires = profile?.tierExpiresAt
  const daysLeft = (() => {
    if (!expires) return null
    const diff = new Date(expires).getTime() - Date.now()
    if (!isFinite(diff)) return null
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })()

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Subscription' }} />
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </View>
      </SafeAreaView>
    )
  }

  const isPremium = tier === 'PREMIUM'

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Subscription', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={
            isPremium
              ? ['#15803D', '#16A34A', '#22C55E']
              : [palette.brand.red700, palette.brand.red600, palette.brand.red500]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerIcon}>
            <Ionicons name={isPremium ? 'star' : 'rocket-outline'} size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.bannerEyebrow}>YOUR PLAN</Text>
          <Text style={styles.bannerTitle}>{isPremium ? 'Premium' : 'Free'}</Text>
          {isPremium && expires ? (
            <View style={styles.bannerInfoCol}>
              <Text style={styles.bannerSub}>
                Active until {new Date(expires).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
              {daysLeft !== null ? (
                <View style={styles.bannerChip}>
                  <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.bannerChipText}>
                    {daysLeft} day{daysLeft === 1 ? '' : 's'} left
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.bannerSub}>
              Unlimited daily questions, all NGN formats, and live lectures are Premium-only.
            </Text>
          )}
        </LinearGradient>

        <Card>
          <CardTitle>{tier === 'PREMIUM' ? 'What you get' : "What you'll unlock"}</CardTitle>
          <FeatureRow icon="infinite-outline" title="Unlimited daily questions" />
          <FeatureRow icon="sparkles-outline" title="All NGN question formats" />
          <FeatureRow icon="videocam-outline" title="Full video library" />
          <FeatureRow icon="radio-outline" title="Live lectures + recordings" />
          <FeatureRow icon="document-text-outline" title="High-yield cheatsheets" />
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button
            title={tier === 'PREMIUM' ? 'Renew or change plan' : 'Upgrade to Premium'}
            onPress={() => router.push('/(tabs)/review')}
          />
          <Button
            title="Order history"
            variant="secondary"
            onPress={() => router.push('/subscription/orders')}
          />
          <Button
            title="Manage in browser"
            variant="ghost"
            onPress={() => openUrl(`${API_BASE_URL}/client/account-settings`)}
          />
        </View>

        <Card>
          <CardTitle>Need help?</CardTitle>
          <CardSubtitle>
            Cancelations, refunds, and billing questions are handled by your GritSync advisor.
            Tap below to start a conversation.
          </CardSubtitle>
          <Button
            title="Message support"
            variant="secondary"
            onPress={() => router.push('/messages')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

function FeatureRow({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}>
      <Ionicons name={icon} size={18} color={palette.brand.red600} />
      <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{title}</Text>
      <Ionicons name="checkmark-circle" size={16} color="#15803D" />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  bannerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bannerEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: 4,
  },
  bannerInfoCol: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  bannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bannerChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
})
