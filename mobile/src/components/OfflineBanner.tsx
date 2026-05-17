import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { palette, spacing } from '@/theme'

/**
 * Compact "You're offline" banner pinned just below the status bar.
 *
 * Listens to NetInfo on mount and shows itself whenever the device loses
 * connectivity. Hidden by default — most users will never see it.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // `state.isInternetReachable` is null while NetInfo is still measuring;
      // we treat that as "online" to avoid flashing on cold start.
      const reachable = state.isInternetReachable !== false && state.isConnected !== false
      setOffline(!reachable)
    })
    return () => unsub()
  }, [])

  if (!offline) return null
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + 4 }]}
    >
      <View style={styles.pill}>
        <Ionicons name="cloud-offline" size={14} color="#FFFFFF" />
        <Text style={styles.text}>You're offline · Some features may be unavailable</Text>
      </View>
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
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.brand.red700,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  },
})

// spacing kept imported for callers that want consistent layout next to banner
void spacing
