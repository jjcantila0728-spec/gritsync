import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { palette, radius, spacing, useTheme } from '@/theme'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optional icon shown in a circle on the right (e.g. profile picture). */
  icon?: keyof typeof Ionicons.glyphMap
  /** Optional action shown as a pill button. */
  action?: {
    label: string
    onPress: () => void
    icon?: keyof typeof Ionicons.glyphMap
  }
  /** Use the brand red gradient instead of a flat surface header. */
  variant?: 'flat' | 'brand'
}

/**
 * Consistent page-top hero used by every Settings sub-page (profile-edit,
 * notifications, emails, subscription, etc.). Bridges the gap between the
 * stack header (system back arrow) and the screen body — gives each page a
 * recognizable identity without needing a different layout per screen.
 *
 * `variant='brand'` paints a red gradient and inverts text — use for screens
 * that benefit from a marketing-heavy header (subscription).
 * `variant='flat'` (default) sits on the surface — quieter, used for
 * functional screens (profile-edit, notifications, messages).
 */
export function PageHeader({ title, subtitle, icon, action, variant = 'flat' }: PageHeaderProps) {
  const { colors } = useTheme()
  const brand = variant === 'brand'

  const titleColor = brand ? '#FFFFFF' : colors.text
  const subColor = brand ? 'rgba(255,255,255,0.85)' : colors.textMuted

  const inner = (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {action ? (
          <Pressable
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: brand ? 'rgba(255,255,255,0.18)' : palette.brand.red50,
                borderColor: brand ? 'transparent' : palette.brand.red200,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            {action.icon ? (
              <Ionicons
                name={action.icon}
                size={14}
                color={brand ? '#FFFFFF' : palette.brand.red700}
              />
            ) : null}
            <Text
              style={{
                color: brand ? '#FFFFFF' : palette.brand.red700,
                fontWeight: '700',
                fontSize: 12,
                letterSpacing: 0.3,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {icon ? (
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: brand ? 'rgba(255,255,255,0.18)' : palette.brand.red50,
              borderColor: brand ? 'transparent' : palette.brand.red200,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={28}
            color={brand ? '#FFFFFF' : palette.brand.red600}
          />
        </View>
      ) : null}
    </View>
  )

  if (brand) {
    return (
      <LinearGradient
        colors={[palette.brand.red700, palette.brand.red600, palette.brand.red500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.wrap, styles.brand]}
      >
        {inner}
      </LinearGradient>
    )
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {inner}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  brand: {
    borderWidth: 0,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: 6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
})
