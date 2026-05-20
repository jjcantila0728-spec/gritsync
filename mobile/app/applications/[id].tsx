import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { StatusPill } from '@/components/StatusPill'
import { useTheme, radius, spacing, palette } from '@/theme'
import { dbFirst, dbList } from '@/lib/db'
import { Application } from '@/lib/types'
import { ApplicationPayment, TimelineStepRow } from '@/lib/services'
import { API_BASE_URL } from '@/lib/api'
import { openUrl } from '@/lib/browser'
import { addStepsToCalendar } from '@/lib/calendar'

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()
  const [app, setApp] = useState<Application | null>(null)
  const [steps, setSteps] = useState<TimelineStepRow[]>([])
  const [payments, setPayments] = useState<ApplicationPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [a, s, p] = await Promise.all([
      dbFirst<Application>('applications', { filter: { id } }),
      dbList<TimelineStepRow>('application_timeline_steps', {
        filter: { application_id: id },
        order: 'created_at.asc',
        limit: 200,
      }),
      dbList<ApplicationPayment>('application_payments', {
        filter: { application_id: id },
        order: 'created_at.desc',
        limit: 50,
      }),
    ])
    setApp(a)
    setSteps(s)
    setPayments(p)
  }, [id])

  useEffect(() => {
    void (async () => {
      try {
        await load()
      } finally {
        setLoading(false)
      }
    })()
  }, [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const progress = useMemo(() => {
    if (steps.length === 0) return 0
    const done = steps.filter((s) => s.is_completed || s.status === 'completed').length
    return Math.round((done / steps.length) * 100)
  }, [steps])

  const balance = useMemo(() => {
    const total = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
    const paid = payments
      .filter((p) => p.status === 'paid' || p.status === 'completed')
      .reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
    return { total, paid, due: Math.max(total - paid, 0) }
  }, [payments])

  if (loading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Application' }} />
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </Screen>
    )
  }

  if (!app) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Application' }} />
        <Card>
          <CardTitle>Application not found</CardTitle>
          <CardSubtitle>This application may have been removed or moved.</CardSubtitle>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen
        options={{
          title: (app.service_type ?? 'Application').toUpperCase(),
        }}
      />
      <View style={{ gap: spacing.lg }}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <CardTitle>
                {(app.service_type ?? 'Application').toUpperCase()}
                {app.service_subtype ? ` — ${app.service_subtype}` : ''}
              </CardTitle>
              <CardSubtitle>{app.current_stage ?? app.status ?? 'In progress'}</CardSubtitle>
            </View>
            <StatusPill status={app.status} />
          </View>
          <View style={[styles.progressOuter, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.progressInner, { width: `${progress}%` }]} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {progress}% complete · {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </Text>
        </Card>

        <Card>
          <CardTitle>Payments</CardTitle>
          <View style={styles.payRow}>
            <PayStat label="Total" value={formatMoney(balance.total)} />
            <PayStat label="Paid" value={formatMoney(balance.paid)} tone="success" />
            <PayStat label="Due" value={formatMoney(balance.due)} tone={balance.due > 0 ? 'danger' : undefined} />
          </View>
          {payments.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No payments yet for this application.</Text>
          ) : (
            payments.slice(0, 5).map((p) => (
              <View key={p.id} style={[styles.payItem, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                    {p.description ?? 'Application fee'}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {p.paid_at ? `Paid ${formatDate(p.paid_at)}` : p.status ?? 'pending'}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {formatMoney(Number(p.amount ?? 0))}
                </Text>
              </View>
            ))
          )}
          {balance.due > 0 ? (
            <Button
              title={`Pay balance — ${formatMoney(balance.due)}`}
              onPress={() => openUrl(`${API_BASE_URL}/client/applications/${app.id}/payments`)}
            />
          ) : null}
        </Card>

        <Card>
          <CardTitle>Timeline</CardTitle>
          {steps.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              No timeline steps yet — your advisor will populate this soon.
            </Text>
          ) : (
            steps.map((s, i) => <StepRow key={s.id} step={s} isLast={i === steps.length - 1} />)
          )}
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => addStepsToCalendar(steps, app.service_type ?? 'Application')}
            style={({ pressed }) => [
              styles.actionTile,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>
              Add to Calendar
            </Text>
          </Pressable>
          <Pressable
            onPress={() => shareApplication(app)}
            style={({ pressed }) => [
              styles.actionTile,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="share-outline" size={20} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>
              Share Status
            </Text>
          </Pressable>
          <Pressable
            onPress={() => openUrl(`${API_BASE_URL}/client/applications/${app.id}/details`)}
            style={({ pressed }) => [
              styles.actionTile,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="open-outline" size={20} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>
              Open in Browser
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}

function StepRow({ step, isLast }: { step: TimelineStepRow; isLast: boolean }) {
  const { colors } = useTheme()
  const done = step.is_completed || step.status === 'completed' || step.step_status === 'completed'
  const inProgress = !done && (step.status === 'in_progress' || step.step_status === 'in_progress')
  const dotColor = done ? '#16A34A' : inProgress ? palette.brand.red600 : colors.border
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: done ? '#16A34A' : inProgress ? palette.brand.red600 : colors.surface,
              borderColor: dotColor,
            },
          ]}
        >
          {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
        </View>
        {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
          {step.title ?? step.name ?? 'Step'}
        </Text>
        {step.description ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {step.description}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function PayStat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const { colors } = useTheme()
  const color =
    tone === 'success' ? '#15803D' : tone === 'danger' ? palette.brand.red700 : colors.text
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{value}</Text>
    </View>
  )
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

const styles = StyleSheet.create({
  progressOuter: { height: 8, borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.sm },
  progressInner: { height: '100%', backgroundColor: palette.brand.red600, borderRadius: radius.full },
  payRow: { flexDirection: 'row', gap: spacing.lg, marginVertical: spacing.sm },
  payItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
})

async function shareApplication(app: Application) {
  try {
    const title = `My GritSync ${(app.service_type ?? 'application').toUpperCase()} application`
    const message = `${title}\nStatus: ${app.status ?? 'pending'}\n${app.current_stage ? `Stage: ${app.current_stage}\n` : ''}Application ID: ${app.id}`
    await Share.share({ message })
  } catch {
    // share was dismissed
  }
}
