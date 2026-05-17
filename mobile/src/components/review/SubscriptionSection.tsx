import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useStripe } from '@stripe/stripe-react-native'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useTheme, palette, radius, spacing } from '@/theme'
import { errorMessage } from '@/lib/api'
import { nclexAPI, type NclexProfile, type SubscriptionPlan, type Tier } from '@/lib/nclex'
import { pickFile } from '@/lib/pickers'
import { storageAPI } from '@/lib/services'
import { useAuth } from '@/contexts/AuthContext'

type PayMethod = 'stripe' | 'gcash' | 'bdo'

/**
 * Subscription / upgrade flow.
 *
 * Three payment paths converge here:
 *
 *  - Stripe → uses `useStripe().initPaymentSheet` + `presentPaymentSheet`.
 *    The intent comes from POST /nclex/create-upgrade-intent { planId }.
 *    On success we hit /nclex/confirm-stripe-upgrade so the server can flip
 *    the user's tier.
 *
 *  - GCash → admin pre-configures a QR + a reference field. The user pays
 *    externally on their phone's GCash app, takes a screenshot, and uploads
 *    the screenshot as the receipt to /nclex/profile/upgrade-request.
 *
 *  - BDO → same idea but with bank details displayed instead of a QR.
 */
export function SubscriptionSection({
  profile,
  onUpdated,
}: {
  profile: NclexProfile | null
  onUpdated?: () => void
}) {
  const { colors } = useTheme()
  const { user } = useAuth()
  const stripe = useStripe()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [method, setMethod] = useState<PayMethod>('stripe')
  const [working, setWorking] = useState(false)
  const [reference, setReference] = useState('')
  const [receiptName, setReceiptName] = useState<string | null>(null)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  const load = useCallback(async () => {
    try {
      setPlans(await nclexAPI.plans())
    } catch {
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tier: Tier = profile?.tier ?? 'FREE'

  async function startStripePayment(plan: SubscriptionPlan) {
    if (!stripe) {
      Alert.alert('Stripe unavailable', 'Payment SDK is still initializing. Try again in a moment.')
      return
    }
    setWorking(true)
    try {
      const { clientSecret } = await nclexAPI.createUpgradeIntent(plan.id)
      const init = await stripe.initPaymentSheet({
        merchantDisplayName: 'GritSync',
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: false,
        appearance: {
          colors: { primary: palette.brand.red600 },
        },
        defaultBillingDetails: user?.email ? { email: user.email } : undefined,
      })
      if (init.error) throw new Error(init.error.message)

      const sheet = await stripe.presentPaymentSheet()
      if (sheet.error) {
        if (sheet.error.code !== 'Canceled') {
          throw new Error(sheet.error.message)
        }
        return
      }
      // Confirm server-side so the tier is flipped.
      const intentId = clientSecret.split('_secret_')[0]
      await nclexAPI.confirmStripeUpgrade({ intentId, planId: plan.id })
      Alert.alert('Payment successful', "You're now on the Premium plan.")
      onUpdated?.()
      setSelectedPlan(null)
    } catch (e) {
      Alert.alert('Payment failed', errorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  async function uploadReceipt() {
    setUploadingReceipt(true)
    try {
      const file = await pickFile({ imagesOnly: true })
      if (!file) return
      const safeName = (file.name || `receipt.jpg`).replace(/[^a-z0-9._-]+/gi, '_')
      const path = `${user?.id ?? 'anon'}/receipts/${Date.now()}_${safeName}`
      const uploaded = await storageAPI.upload({
        uri: file.uri,
        name: file.name || safeName,
        mimeType: file.mimeType,
        path,
      })
      setReceiptName(file.name || safeName)
      setReceiptPath(uploaded.path)
    } catch (e) {
      Alert.alert('Upload failed', errorMessage(e))
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function submitManualPayment(plan: SubscriptionPlan) {
    if (!reference.trim()) {
      Alert.alert('Reference required', 'Enter the reference number from your payment app or bank.')
      return
    }
    if (!receiptPath) {
      Alert.alert('Receipt required', 'Upload a screenshot of your payment receipt.')
      return
    }
    setWorking(true)
    try {
      const form = new FormData()
      form.append('planId', plan.id)
      form.append('method', method.toUpperCase())
      form.append('reference', reference.trim())
      form.append('receiptPath', receiptPath)
      await nclexAPI.submitUpgradeRequest(form)
      Alert.alert(
        'Request submitted',
        "We'll verify your payment shortly. You'll be notified when your account is upgraded.",
      )
      onUpdated?.()
      setSelectedPlan(null)
      setReference('')
      setReceiptName(null)
      setReceiptPath(null)
    } catch (e) {
      Alert.alert('Submission failed', errorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <View style={{ alignItems: 'center', padding: spacing.xl }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Card>
    )
  }

  // Plan selection screen
  if (!selectedPlan) {
    return (
      <View style={{ gap: spacing.md }}>
        <View
          style={[
            styles.tierBanner,
            {
              backgroundColor: tier === 'PREMIUM' ? '#F0FDF4' : palette.brand.red50,
              borderColor: tier === 'PREMIUM' ? '#86EFAC' : palette.brand.red200,
            },
          ]}
        >
          <Ionicons
            name={tier === 'PREMIUM' ? 'star' : 'star-outline'}
            size={22}
            color={tier === 'PREMIUM' ? '#15803D' : palette.brand.red600}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              You're on the {tier} plan
            </Text>
            {tier === 'FREE' ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Free includes 10 questions a day. Upgrade for unlimited access.
              </Text>
            ) : profile?.tierExpiresAt ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Premium active until {new Date(profile.tierExpiresAt).toLocaleDateString()}.
              </Text>
            ) : null}
          </View>
        </View>

        {plans.length === 0 ? (
          <Card>
            <CardTitle>No plans available</CardTitle>
            <CardSubtitle>
              Your admin hasn't published any subscription plans yet. Reach out to support.
            </CardSubtitle>
          </Card>
        ) : (
          plans.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelectedPlan(p)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <View
                style={[
                  styles.planCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  p.tier === 'PREMIUM' && { borderColor: palette.brand.red500 },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={[
                      styles.planIcon,
                      { backgroundColor: p.tier === 'PREMIUM' ? palette.brand.red600 : colors.surfaceMuted },
                    ]}
                  >
                    <Ionicons name="star" size={20} color={p.tier === 'PREMIUM' ? '#fff' : colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{p.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {p.durationDays} days · {p.tier}
                    </Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                    ${p.priceUsd}
                  </Text>
                </View>
                {p.features?.length ? (
                  <View style={{ gap: 4, marginTop: spacing.md }}>
                    {p.features.slice(0, 5).map((f, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Button
                  title={tier === 'PREMIUM' ? 'Switch to this plan' : 'Get this plan'}
                  onPress={() => setSelectedPlan(p)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            </Pressable>
          ))
        )}
      </View>
    )
  }

  // Payment-method screen for the selected plan
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>SELECTED PLAN</Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{selectedPlan.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              ${selectedPlan.priceUsd} · {selectedPlan.durationDays} days
            </Text>
          </View>
          <Pressable onPress={() => setSelectedPlan(null)} hitSlop={6}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Change</Text>
          </Pressable>
        </View>
      </Card>

      <View style={[styles.methodTabs, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        {(['stripe', 'gcash', 'bdo'] as PayMethod[]).map((m) => {
          const active = method === m
          return (
            <Pressable
              key={m}
              onPress={() => setMethod(m)}
              style={[
                styles.methodTab,
                active && { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>
                {m === 'stripe' ? 'Card · Stripe' : m === 'gcash' ? 'GCash' : 'BDO'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {method === 'stripe' ? (
        <Card>
          <CardTitle>Pay with card</CardTitle>
          <CardSubtitle>
            Secure payment via Stripe — Apple Pay, Google Pay, and any credit/debit card.
          </CardSubtitle>
          <Button
            title={working ? 'Opening payment sheet…' : `Pay $${selectedPlan.priceUsd}`}
            onPress={() => startStripePayment(selectedPlan)}
            loading={working}
          />
        </Card>
      ) : (
        <Card>
          <CardTitle>{method === 'gcash' ? 'Pay via GCash' : 'Pay via BDO bank transfer'}</CardTitle>
          <CardSubtitle>
            {method === 'gcash'
              ? `Scan the QR code with GCash and pay $${selectedPlan.priceUsd}. Then upload your receipt below.`
              : `Send $${selectedPlan.priceUsd} to the BDO account below. Then upload your deposit slip.`}
          </CardSubtitle>

          {method === 'gcash' ? (
            <View style={[styles.qrBox, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="qr-code" size={120} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
                Your admin will display the production QR here.
              </Text>
            </View>
          ) : (
            <View style={[styles.bdoBox, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <BdoRow label="Account name" value="GritSync Education Services" />
              <BdoRow label="Account #" value="0000-0000-0000" />
              <BdoRow label="Bank" value="BDO Unibank" />
              <BdoRow label="Branch" value="Makati Main" />
            </View>
          )}

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Reference number</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder={method === 'gcash' ? 'GCash reference no.' : 'Deposit slip reference'}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Receipt</Text>
            <Pressable
              onPress={uploadReceipt}
              disabled={uploadingReceipt}
              style={({ pressed }) => [
                styles.receiptBtn,
                {
                  backgroundColor: receiptPath ? '#F0FDF4' : colors.surface,
                  borderColor: receiptPath ? '#86EFAC' : colors.border,
                },
                uploadingReceipt && { opacity: 0.7 },
                pressed && { opacity: 0.85 },
              ]}
            >
              {uploadingReceipt ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <Ionicons
                    name={receiptPath ? 'checkmark-circle' : 'cloud-upload-outline'}
                    size={22}
                    color={receiptPath ? '#15803D' : palette.brand.red600}
                  />
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {receiptName ?? 'Tap to upload a screenshot'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Button
            title="Submit for review"
            onPress={() => submitManualPayment(selectedPlan)}
            loading={working}
          />
        </Card>
      )}
    </View>
  )
}

function BdoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} selectable>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  planCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  methodTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  bdoBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
})
