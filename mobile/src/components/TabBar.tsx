import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useTheme, palette, radius } from '@/theme'

interface TabSpec {
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  filledIcon: keyof typeof Ionicons.glyphMap
}

const TABS: TabSpec[] = [
  { name: 'home', label: 'Home', icon: 'home-outline', filledIcon: 'home' },
  { name: 'docs', label: 'Docs', icon: 'folder-outline', filledIcon: 'folder' },
  { name: 'timeline', label: 'Timeline', icon: 'time-outline', filledIcon: 'time' },
  { name: 'review', label: 'Review', icon: 'school-outline', filledIcon: 'school' },
  { name: 'settings', label: 'Settings', icon: 'settings-outline', filledIcon: 'settings' },
]

/**
 * Branded bottom tab bar with a spring-animated pill indicator that slides
 * to the active tab. Replaces the default expo-router/react-navigation bar
 * so we get filled icons, brand-red active state, and a more iOS-native feel.
 *
 * Layout: each tab is a flex:1 cell, and we render a 56-wide white pill
 * absolutely positioned inside the cell, translated horizontally by index.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, mode } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TABS.map((tab, i) => {
        const route = state.routes.find((r) => r.name === tab.name)
        if (!route) return null
        const focused = state.index === state.routes.findIndex((r) => r.name === tab.name)
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never)
          }
        }
        return (
          <TabButton
            key={tab.name}
            label={tab.label}
            icon={tab.icon}
            filledIcon={tab.filledIcon}
            focused={focused}
            onPress={onPress}
            mode={mode}
          />
        )
      })}
    </View>
  )
}

function TabButton({
  label,
  icon,
  filledIcon,
  focused,
  onPress,
  mode,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  filledIcon: keyof typeof Ionicons.glyphMap
  focused: boolean
  onPress: () => void
  mode: 'light' | 'dark'
}) {
  const { colors } = useTheme()
  const pillScale = useSharedValue(focused ? 1 : 0)
  const iconScale = useSharedValue(focused ? 1.06 : 1)

  React.useEffect(() => {
    pillScale.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 220 })
    iconScale.value = withSpring(focused ? 1.06 : 1, { damping: 18, stiffness: 220 })
  }, [focused, pillScale, iconScale])

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillScale.value,
    transform: [{ scale: 0.92 + pillScale.value * 0.08 }],
  }))
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }))

  const activeBg = mode === 'dark' ? 'rgba(248,113,113,0.18)' : 'rgba(220,38,38,0.12)'
  const activeText = focused ? colors.tabBarActive : colors.tabBarInactive

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      hitSlop={6}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: activeBg }, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Ionicons
            name={focused ? filledIcon : icon}
            size={focused ? 24 : 22}
            color={activeText}
          />
        </Animated.View>
      </View>
      <Text
        style={[
          styles.label,
          {
            color: activeText,
            fontWeight: focused ? '800' : '600',
          },
        ]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  iconWrap: {
    width: 56,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    width: 56,
    height: 32,
    borderRadius: radius.full,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
})
