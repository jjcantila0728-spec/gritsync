import React, { useState, useEffect } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useExamTheme as useTheme, palette, radius, spacing } from '@/theme'

export function NotesModal({
  visible,
  initialValue,
  onClose,
  onSave,
}: {
  visible: boolean
  initialValue: string
  onClose: () => void
  onSave: (next: string) => void
}) {
  const { colors } = useTheme()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue, visible])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
      >
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.body, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Ionicons name="create-outline" size={20} color={palette.brand.red600} />
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 }}>Notes</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Jot down anything to revisit during review…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onSave(value)
                onClose()
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: palette.brand.red600, borderColor: palette.brand.red600 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Save note</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  body: {
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 160,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
