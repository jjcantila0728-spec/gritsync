import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { openUrl } from '@/lib/browser'
import { nclexAPI, type LiveSession } from '@/lib/nclex'

export function LiveSection() {
  const { colors } = useTheme()
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      setSessions(await nclexAPI.liveSessions())
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return (
      <Card>
        <View style={{ alignItems: 'center', padding: spacing.xl }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Card>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardTitle>No live sessions scheduled</CardTitle>
        <CardSubtitle>Your instructor hasn't scheduled any upcoming sessions yet.</CardSubtitle>
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
      {sessions.map((s) => {
        const start = new Date(s.starts_at).getTime()
        const durationMs = (s.duration_minutes ?? 60) * 60_000
        const end = start + durationMs
        const isLive = now >= start && now <= end
        const isPast = now > end
        const isFuture = now < start
        const diff = start - now

        return (
          <View
            key={s.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: isLive ? palette.brand.red500 : colors.border,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isLive ? palette.brand.red600 : palette.brand.red50 },
                ]}
              >
                <Ionicons name="radio" size={20} color={isLive ? '#fff' : palette.brand.red600} />
              </View>
              <View style={{ flex: 1 }}>
                {isLive ? (
                  <View style={[styles.liveBadge, { backgroundColor: palette.brand.red600 }]}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE NOW</Text>
                  </View>
                ) : null}
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={2}>
                  {s.title}
                </Text>
                {s.host ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>with {s.host}</Text>
                ) : null}
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  {new Date(s.starts_at).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                {s.description ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }} numberOfLines={3}>
                    {s.description}
                  </Text>
                ) : null}
                {isFuture ? (
                  <Text style={{ color: palette.brand.red700, fontSize: 11, fontWeight: '700', marginTop: 6 }}>
                    Starts in {fmtCountdown(diff)}
                  </Text>
                ) : null}
              </View>
            </View>
            {s.join_url && !isPast ? (
              <Pressable
                onPress={() => openUrl(s.join_url!)}
                style={({ pressed }) => [
                  styles.joinBtn,
                  { backgroundColor: isLive ? palette.brand.red600 : colors.surfaceMuted, borderColor: isLive ? palette.brand.red600 : colors.border },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="videocam" size={16} color={isLive ? '#fff' : colors.text} />
                <Text style={{ color: isLive ? '#fff' : colors.text, fontWeight: '800', fontSize: 13 }}>
                  {isLive ? 'Join now' : 'Join when live'}
                </Text>
              </Pressable>
            ) : isPast ? (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>Session ended</Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
