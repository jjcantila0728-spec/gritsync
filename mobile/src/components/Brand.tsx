import React from 'react'
import { Image, ImageStyle, StyleProp, View, ViewStyle, Text, TextStyle } from 'react-native'
import { palette } from '@/theme'

const logo = require('../../assets/icon.png')

interface BrandMarkProps {
  size?: number
  style?: StyleProp<ImageStyle>
}

export function BrandMark({ size = 48, style }: BrandMarkProps) {
  return (
    <Image
      source={logo}
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
      resizeMode="contain"
    />
  )
}

interface WordmarkProps {
  size?: number
  mode?: 'light' | 'dark'
  style?: StyleProp<ViewStyle>
}

export function Wordmark({ size = 22, mode = 'light', style }: WordmarkProps) {
  const gritColor = mode === 'dark' ? '#FFFFFF' : '#000000'
  const syncColor = mode === 'dark' ? '#F87171' : palette.brand.red600
  const base: TextStyle = { fontSize: size, fontWeight: '800', letterSpacing: 0.5 }
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}>
      <Text style={[base, { color: gritColor }]}>Grit</Text>
      <Text style={[base, { color: syncColor }]}>Sync</Text>
    </View>
  )
}

export function BrandHeader({
  mode = 'light',
  subtitle,
}: {
  mode?: 'light' | 'dark'
  subtitle?: string
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <BrandMark size={36} />
      <View>
        <Wordmark size={20} mode={mode} />
        {subtitle ? (
          <Text style={{ fontSize: 11, color: mode === 'dark' ? '#9CA3AF' : '#6B7280' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
