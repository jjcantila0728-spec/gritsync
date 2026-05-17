import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/ErrorState'
import { SkeletonCard } from '@/components/Skeleton'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type Order } from '@/lib/nclex'
import { errorMessage } from '@/lib/api'

export default function OrderHistoryScreen() {
  const { colors } = useTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setOrders(await nclexAPI.orderHistory())
    } catch (e) {
      setError(errorMessage(e, "Couldn't load orders"))
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Order history', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="Order history"
          subtitle="Every subscription payment, in chronological order."
          icon="receipt"
        />

        {loading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </View>
        ) : error ? (
          <ErrorState
            variant="error"
            title="Couldn't load orders"
            body={error}
            onRetry={() => {
              setLoading(true)
              void load()
            }}
          />
        ) : orders.length === 0 ? (
          <ErrorState
            variant="empty"
            icon="receipt-outline"
            title="No orders yet"
            body="When you upgrade to Premium, the receipt appears here. Stripe payments record instantly; GCash and BDO show as Pending until your advisor confirms."
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {orders.map((o, idx) => (
              <OrderRow
                key={o.id}
                order={o}
                isFirst={idx === 0}
                isLast={idx === orders.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function OrderRow({
  order,
  isFirst,
  isLast,
}: {
  order: Order
  isFirst: boolean
  isLast: boolean
}) {
  const { colors } = useTheme()
  const tone = statusTone(order.status)
  const methodLabel =
    order.method === 'stripe' ? 'Card · Stripe' :
    order.method === 'gcash' ? 'GCash' :
    order.method === 'bdo' ? 'BDO bank transfer' :
    order.method.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase())

  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {/* Timeline rail */}
      <View style={{ alignItems: 'center', width: 28 }}>
        <View style={{ width: 2, height: isFirst ? 0 : 12, backgroundColor: colors.border }} />
        <View style={[styles.dot, { backgroundColor: tone.fg, borderColor: tone.fg }]}>
          <Ionicons name={iconForMethod(order.method)} size={11} color="#FFFFFF" />
        </View>
        {!isLast ? <View style={{ width: 2, flex: 1, backgroundColor: colors.border }} /> : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
              {order.tier === 'PREMIUM' ? 'Premium plan' : String(order.tier)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{methodLabel}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text style={{ color: tone.fg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
              {prettyStatus(order.status)}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md, gap: 4 }}>
          <DetailRow label="Reference" value={order.reference} mono />
          {order.date ? (
            <DetailRow
              label="Date"
              value={new Date(order.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            />
          ) : null}
          {order.expiresAt ? (
            <DetailRow
              label="Expires"
              value={new Date(order.expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            />
          ) : null}
          {typeof order.amount === 'number' ? (
            <DetailRow
              label="Amount"
              value={`${(order.currency ?? 'USD').toUpperCase()} ${order.amount.toFixed(2)}`}
            />
          ) : null}
        </View>
      </View>
    </View>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 12,
          fontWeight: '600',
          maxWidth: '70%',
          textAlign: 'right',
          ...(mono ? { fontVariant: ['tabular-nums'] as any } : {}),
        }}
        numberOfLines={1}
        selectable
      >
        {value}
      </Text>
    </View>
  )
}

function iconForMethod(method: string): keyof typeof Ionicons.glyphMap {
  if (method === 'stripe') return 'card-outline'
  if (method === 'gcash') return 'wallet-outline'
  if (method === 'bdo') return 'business-outline'
  return 'receipt-outline'
}

function prettyStatus(status: string): string {
  if (status === 'pending_admin_review') return 'Pending'
  return status.replace(/_/g, ' ')
}

function statusTone(status: string): { bg: string; border: string; fg: string } {
  switch (status) {
    case 'completed':
      return { bg: '#DCFCE7', border: '#86EFAC', fg: '#15803D' }
    case 'pending_admin_review':
      return { bg: '#FEF3C7', border: '#FCD34D', fg: '#B45309' }
    case 'failed':
      return { bg: '#FEE2E2', border: '#FCA5A5', fg: palette.brand.red700 }
    default:
      return { bg: '#F3F4F6', border: '#E5E7EB', fg: '#374151' }
  }
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
})
