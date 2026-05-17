import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type NclexProfile } from '@/lib/nclex'
import { openUrl } from '@/lib/browser'
import { API_BASE_URL } from '@/lib/api'

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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Subscription', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View
          style={[
            styles.banner,
            {
              backgroundColor: tier === 'PREMIUM' ? '#F0FDF4' : palette.brand.red50,
              borderColor: tier === 'PREMIUM' ? '#86EFAC' : palette.brand.red200,
            },
          ]}
        >
          <View
            style={[
              styles.bannerIcon,
              { backgroundColor: tier === 'PREMIUM' ? '#15803D' : palette.brand.red600 },
            ]}
          >
            <Ionicons name="star" size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
              YOUR PLAN
            </Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
              {tier === 'PREMIUM' ? 'Premium' : 'Free'}
            </Text>
            {tier === 'PREMIUM' && expires ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Active until {new Date(expires).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                {daysLeft !== null ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}
              </Text>
            ) : tier === 'FREE' ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Unlimited daily questions, all formats, and live lectures are Premium only.
              </Text>
            ) : null}
          </View>
        </View>

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
