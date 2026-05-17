import React from 'react'
import { ScrollView, StyleProp, View, ViewStyle, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useTheme, spacing } from '@/theme'

interface Props {
  children: React.ReactNode
  scroll?: boolean
  padded?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  contentStyle,
}: Props) {
  const { colors, mode } = useTheme()
  const padding = padded ? { padding: spacing.lg } : undefined

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
  )

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {body}
    </SafeAreaView>
  )
}
