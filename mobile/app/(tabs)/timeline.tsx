import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, radius, spacing, palette } from '@/theme'
import { dbList } from '@/lib/db'
import { Application } from '@/lib/types'

interface TimelineStep {
  id: string
  application_id: string
  title?: string
  name?: string
  description?: string
  status?: string
  step_status?: string
  is_completed?: boolean
  completed_at?: string | null
  due_date?: string | null
  created_at?: string
  step_order?: number
  ordinal?: number
}

export default function TimelineScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [apps, setApps] = useState<Application[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [steps, setSteps] = useState<TimelineStep[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadApps = useCallback(async () => {
    if (!user?.id) return
    const rows = await dbList<Application>('applications', {
      filter: { user_id: user.id },
      order: 'created_at.desc',
      limit: 20,
    })
    setApps(rows)
    if (rows.length > 0 && !activeId) setActiveId(rows[0].id)
  }, [user?.id, activeId])

  const loadSteps = useCallback(async (appId: string) => {
    const rows = await dbList<TimelineStep>('application_timeline_steps', {
      filter: { application_id: appId },
      order: 'created_at.asc',
      limit: 200,
    })
    setSteps(rows)
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadApps()
      if (activeId) await loadSteps(activeId)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [activeId, loadApps, loadSteps])

  useEffect(() => {
    void (async () => {
      try {
        await loadApps()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadApps])

  useEffect(() => {
    if (!activeId) return
    void loadSteps(activeId)
  }, [activeId, loadSteps])

  const active = useMemo(() => apps.find((a) => a.id === activeId) ?? null, [apps, activeId])
  const progress = useMemo(() => {
    if (steps.length === 0) return 0
    const done = steps.filter((s) => s.is_completed || s.status === 'completed').length
    return Math.round((done / steps.length) * 100)
  }, [steps])

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: spacing.lg }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Timeline</Text>
          <Text style={{ color: colors.textMuted }}>Track every milestone of your application.</Text>
        </View>

        {loading ? (
          <Card><Text style={{ color: colors.textMuted }}>Loading…</Text></Card>
        ) : apps.length === 0 ? (
          <Card>
            <CardTitle>No active application</CardTitle>
            <CardSubtitle>Start an application from the GritSync portal to see its timeline here.</CardSubtitle>
          </Card>
        ) : (
          <>
            {apps.length > 1 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {apps.map((a) => {
                  const isActive = a.id === activeId
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setActiveId(a.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? palette.brand.red600 : colors.surface,
                          borderColor: isActive ? palette.brand.red600 : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isActive ? '#fff' : colors.text,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                      >
                        {(a.service_type ?? 'App').toUpperCase()}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {active ? (
              <Pressable
                onPress={() => router.push(`/applications/${active.id}`)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <CardTitle>
                        {(active.service_type ?? 'Application').toUpperCase()}
                        {active.service_subtype ? ` — ${active.service_subtype}` : ''}
                      </CardTitle>
                      <CardSubtitle>
                        {active.current_stage ?? active.status ?? 'In progress'} · {progress}% complete
                      </CardSubtitle>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                  <View style={[styles.progressOuter, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.progressInner, { width: `${progress}%` }]} />
                  </View>
                </Card>
              </Pressable>
            ) : null}

            <View style={{ gap: spacing.md }}>
              {steps.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.textMuted }}>
                    No timeline steps yet — your advisor will populate this soon.
                  </Text>
                </Card>
              ) : (
                steps.map((s, i) => (
                  <StepRow key={s.id} step={s} isLast={i === steps.length - 1} />
                ))
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  )
}

function StepRow({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
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
            { backgroundColor: done ? '#16A34A' : inProgress ? palette.brand.red600 : colors.surface, borderColor: dotColor },
          ]}
        >
          {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          {step.title ?? step.name ?? 'Step'}
        </Text>
        {step.description ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{step.description}</Text>
        ) : null}
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
          {done && step.completed_at
            ? `Completed ${formatDate(step.completed_at)}`
            : step.due_date
            ? `Due ${formatDate(step.due_date)}`
            : inProgress
            ? 'In progress'
            : 'Pending'}
        </Text>
      </View>
    </View>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  progressOuter: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressInner: {
    height: '100%',
    backgroundColor: palette.brand.red600,
    borderRadius: radius.full,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
