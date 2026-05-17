import React, { useState } from 'react'
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, radius } from '@/theme'

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  value: string
  onChangeText: (s: string) => void
}

export function PasswordInput({ value, onChangeText, style, ...rest }: Props) {
  const { colors } = useTheme()
  const [visible, setVisible] = useState(false)
  return (
    <View
      style={[
        styles.wrap,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[styles.input, { color: colors.text }, style]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.6 }]}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
})
