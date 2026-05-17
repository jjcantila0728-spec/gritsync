import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, radius, spacing } from '@/theme'
import { authAPI } from '@/lib/services'
import { errorMessage } from '@/lib/api'

export default function ProfileEditScreen() {
  const { user, refresh } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()

  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [middleName, setMiddleName] = useState(user?.middle_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [mobile, setMobile] = useState(user?.mobile ?? '')
  const [saving, setSaving] = useState(false)

  async function onSave() {
    setSaving(true)
    try {
      await authAPI.updateProfile({
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        mobile: mobile.trim(),
      })
      await refresh()
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen scroll padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Card>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Signed in as</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{user?.email}</Text>
            {user?.grit_id ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>GRIT ID: {user.grit_id}</Text>
            ) : null}
          </Card>

          <View style={{ gap: spacing.md }}>
            <Field label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" />
            <Field label="Middle name" value={middleName} onChange={setMiddleName} autoCapitalize="words" />
            <Field label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" />
            <Field
              label="Mobile"
              value={mobile}
              onChange={setMobile}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>

          <Button title="Save changes" onPress={onSave} loading={saving} />
          <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words'
}) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
})
