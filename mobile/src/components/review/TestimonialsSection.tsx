import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type Testimonial } from '@/lib/nclex'

export function TestimonialsSection() {
  const { colors } = useTheme()
  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setItems(await nclexAPI.approvedTestimonials())
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
        <CardTitle>No testimonials yet</CardTitle>
        <CardSubtitle>Be the first to share your NCLEX story after you pass.</CardSubtitle>
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
      {items.map((t) => (
        <View key={t.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={styles.avatar}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                {(t.user_name ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                {t.user_name ?? 'GritSync graduate'}
              </Text>
              {t.rating ? (
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= (t.rating ?? 0) ? 'star' : 'star-outline'}
                      size={12}
                      color={n <= (t.rating ?? 0) ? '#F59E0B' : colors.border}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          {t.body ? (
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, marginTop: spacing.sm }}>
              "{t.body}"
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.brand.red600,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
