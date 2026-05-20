import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { palette } from '@/theme'
import { applyUpdate, subscribe, type UpdateState } from '@/lib/updates'

/**
 * Shows a pinned banner under the status bar when a freshly-fetched EAS
 * Update bundle is sitting in cache and the user has not yet applied it.
 *
 * Tapping the banner reloads the app process into the new bundle. We never
 * auto-reload mid-session — losing scroll position / form state on a silent
 * restart is hostile UX.
 *
 * Renders below the OfflineBanner (same `top` anchor, different `zIndex`)
 * so an offline user doesn't see a "Restart for update" prompt they can't
 * actually act on.
 */
export function UpdateBanner() {
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<UpdateState | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const unsub = subscribe(setState)
    return unsub
  }, [])

  if (!state?.ready) return null

  const onApply = async () => {
    setApplying(true)
    try {
      await applyUpdate()
    } catch {
      // If reload fails, fall back to leaving the banner up so the user can
      // try again. Don't surface another alert — the banner itself is feedback.
      setApplying(false)
    }
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <Pressable
        onPress={onApply}
        disabled={applying}
        accessibilityRole="button"
        accessibilityLabel="Restart to apply update"
        accessibilityHint="A new version is downloaded. Restart the app to start using it."
        style={({ pressed }) => [
          styles.pill,
          pressed && !applying && { opacity: 0.85 },
          applying && { opacity: 0.7 },
        ]}
      >
        {applying ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        )}
        <Text style={styles.text}>
          {applying ? 'Restarting…' : 'Update ready · Tap to restart'}
        </Text>
        {!applying ? <Ionicons name="refresh" size={14} color="#FFFFFF" /> : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    // Sit above OfflineBanner (zIndex 100) — if the update probe finished
    // before the user dropped offline, the update banner takes precedence.
    zIndex: 101,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.brand.red600,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
