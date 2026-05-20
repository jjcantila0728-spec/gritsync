import React, { useCallback, useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { BrandMark, Wordmark } from '@/components/Brand'
import { PasswordInput } from '@/components/PasswordInput'
import { useAuth, errorMessage } from '@/contexts/AuthContext'
import { useTheme, spacing, radius, palette } from '@/theme'
import { biometric } from '@/lib/biometric'
import { storage, StorageKeys } from '@/lib/storage'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const { colors, mode } = useTheme()
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [biometricKind, setBiometricKind] = useState<'face' | 'fingerprint' | 'iris' | 'none'>('none')
  const [biometricSaved, setBiometricSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      // Pre-fill last-used identifier so the user only types a password.
      const lastIdentifier = await storage.get(StorageKeys.lastIdentifier)
      if (lastIdentifier) setIdentifier(lastIdentifier)

      // Probe biometric capability — we only use it to decide whether to
      // SHOW the "Sign in with Face ID" button. We never auto-prompt; the
      // user explicitly opts in by tapping that button or enabling it in
      // Settings → Security. This keeps Android devices without Face ID
      // (or any user who'd rather type their password) on the happy path.
      const available = await biometric.isAvailable()
      const enabled = await biometric.isEnabled()
      const kind = await biometric.kind()
      setBiometricKind(kind)
      setBiometricSaved(available && enabled)
    })()
  }, [])

  /**
   * Sign-in handler. After success, control flows to the router which
   * navigates to /home — no biometric prompt, no extra alerts. Users who
   * want fast subsequent logins can enable biometric from
   * Settings → Security → Biometric sign-in.
   */
  const doSignIn = useCallback(
    async (id: string, pw: string) => {
      setSubmitting(true)
      try {
        await signIn(id.trim(), pw)
      } catch (e) {
        Alert.alert('Login failed', errorMessage(e, 'Invalid login credentials.'))
      } finally {
        setSubmitting(false)
      }
    },
    [signIn],
  )

  async function onSubmit() {
    if (!identifier.trim() || !password) {
      Alert.alert('Missing info', 'Please enter your email/mobile/GRIT ID and password.')
      return
    }
    await doSignIn(identifier, password)
  }

  async function onBiometricPress() {
    const kind = biometricKind === 'face' ? 'Face ID' : 'biometrics'
    const ok = await biometric.authenticate(`Sign in with ${kind}`)
    if (!ok) return
    const remembered = await biometric.getRemembered()
    if (!remembered) {
      Alert.alert(
        `${kind} not set up`,
        'Open Settings → Security on the next screen to enable biometric sign-in.',
      )
      return
    }
    await doSignIn(remembered.identifier, remembered.password)
  }

  const biometricLabel =
    biometricKind === 'face' ? 'Face ID' : biometricKind === 'fingerprint' ? 'Touch ID' : 'Biometric'
  const biometricIcon = biometricKind === 'face' ? 'scan-outline' : 'finger-print-outline'

  return (
    <Screen scroll padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl }}>
            <BrandMark size={84} />
            <Wordmark size={28} mode={mode} />
            <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 14 }}>
              Sign in to your GritSync client account
            </Text>
          </View>

          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.text }]}>Email, Mobile, or GRIT ID</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                autoComplete="password"
              />
            </View>

            <Button title="Sign In" onPress={onSubmit} loading={submitting} />

            {biometricSaved && biometricKind !== 'none' ? (
              <Pressable
                onPress={onBiometricPress}
                style={({ pressed }) => [
                  styles.bioBtn,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name={biometricIcon} size={22} color={palette.brand.red600} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  Sign in with {biometricLabel}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'center', paddingVertical: spacing.sm }}
            >
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Forgot password?</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              New to GritSync?{' '}
              <Text
                onPress={() => router.push('/(auth)/register')}
                style={{ color: colors.accent, fontWeight: '600' }}
              >
                Create an account
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
