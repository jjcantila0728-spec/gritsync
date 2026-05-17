import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI } from '@/lib/nclex'

interface VideoChapter {
  id: string
  title: string
  description?: string | null
  url: string
  thumbnail_url?: string | null
  duration?: number | null
}

export function VideosSection() {
  const { colors } = useTheme()
  const [videos, setVideos] = useState<VideoChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<VideoChapter | null>(null)

  const load = useCallback(async () => {
    try {
      const raw: any = await nclexAPI.videos()
      // Server returns whatever the admin configured — be tolerant. Try
      // common shapes: { videos: [...] }, { items: [...] }, or a top-level array.
      const list: VideoChapter[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.videos)
        ? raw.videos
        : Array.isArray(raw?.items)
        ? raw.items
        : []
      setVideos(list)
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
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

  if (videos.length === 0) {
    return (
      <Card>
        <CardTitle>No videos yet</CardTitle>
        <CardSubtitle>
          Your admin hasn't published any video lectures. Check back soon.
        </CardSubtitle>
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
      {videos.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => setPlaying(v)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            {v.thumbnail_url ? (
              <Image source={{ uri: v.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Ionicons name="play-circle" size={32} color={palette.brand.red600} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }} numberOfLines={2}>
              {v.title}
            </Text>
            {v.description ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                {v.description}
              </Text>
            ) : null}
            {v.duration ? (
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{fmtDuration(v.duration)}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}

      <VideoPlayer video={playing} onClose={() => setPlaying(null)} />
    </View>
  )
}

function VideoPlayer({ video, onClose }: { video: VideoChapter | null; onClose: () => void }) {
  const { colors } = useTheme()
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null)
  return (
    <Modal visible={!!video} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {video ? (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.playerClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Video
            source={{ uri: video.url }}
            style={{ flex: 1 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping={false}
            onPlaybackStatusUpdate={setStatus}
          />
          <View style={styles.playerInfo}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
              {video.title}
            </Text>
            {video.description ? (
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }} numberOfLines={2}>
                {video.description}
              </Text>
            ) : null}
          </View>
          {/* status is exposed so chapter-tracking can be wired later */}
          {void status}
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background }} />
      )}
    </Modal>
  )
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerClose: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  playerInfo: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    gap: 4,
  },
})
