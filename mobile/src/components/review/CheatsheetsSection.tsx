import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { openUrl } from '@/lib/browser'
import { api } from '@/lib/api'

interface Cheatsheet {
  id: string
  title: string
  url: string
  thumbnail_url?: string | null
  description?: string | null
  type?: 'pdf' | 'image' | string | null
}

/**
 * The server doesn't expose a dedicated cheatsheets list yet; we fall back to
 * `/api/nclex/site-settings` which the admin populates with a `cheatsheets`
 * array. Hand-off to the in-app browser for the actual viewing (PDFs open
 * inside SFSafariViewController / Chrome Custom Tabs).
 */
export function CheatsheetsSection() {
  const { colors } = useTheme()
  const [items, setItems] = useState<Cheatsheet[]>([])
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState<Cheatsheet | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/nclex/site-settings')
      const data: any = (res.data as any)?.data ?? {}
      const list: Cheatsheet[] = Array.isArray(data?.cheatsheets)
        ? data.cheatsheets
        : Array.isArray(data?.resources)
        ? data.resources
        : []
      setItems(list)
    } catch {
      setItems([])
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

  if (items.length === 0) {
    return (
      <Card>
        <CardTitle>No cheatsheets yet</CardTitle>
        <CardSubtitle>
          Your admin hasn't published any high-yield references. Check back soon.
        </CardSubtitle>
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
        {items.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              const isImage = c.type === 'image' || /\.(png|jpg|jpeg|webp|gif|heic)(\?|$)/i.test(c.url)
              if (isImage) setPreviewing(c)
              else openUrl(c.url)
            }}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.tileImage, { backgroundColor: colors.surfaceMuted }]}>
              {c.thumbnail_url ? (
                <Image source={{ uri: c.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Ionicons name="document-text" size={28} color={palette.brand.red600} />
              )}
            </View>
            <View style={{ padding: spacing.sm, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }} numberOfLines={2}>
                {c.title}
              </Text>
              {c.description ? (
                <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={2}>
                  {c.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <ImagePreview item={previewing} onClose={() => setPreviewing(null)} />
    </View>
  )
}

function ImagePreview({ item, onClose }: { item: Cheatsheet | null; onClose: () => void }) {
  return (
    <Modal visible={!!item} animationType="fade" transparent={false} onRequestClose={onClose}>
      {item ? (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.previewClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            pinchGestureEnabled
          >
            <Image source={{ uri: item.url }} style={styles.previewImage} resizeMode="contain" />
          </ScrollView>
        </View>
      ) : (
        <View />
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  tileImage: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
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
  previewImage: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
  },
})
