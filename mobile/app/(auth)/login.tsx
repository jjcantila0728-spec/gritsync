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

      const available = await biometric.isAvailable()
      const enabled = await biometric.isEnabled()
      const kind = await biometric.kind()
      setBiometricKind(kind)
      setBiometricSaved(available && enabled)

      // Auto-prompt biometric on screen open if we have remembered credentials.
      if (available && enabled) {
        const remembered = await biometric.getRemembered()
        if (remembered) {
          const ok = await biometric.authenticate(
            kind === 'face' ? 'Sign in with Face ID' : 'Sign in with biometrics',
          )
          if (ok) {
            await doSignIn(remembered.identifier, remembered.password, { silent: true })
          }
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Core sign-in. After a successful PASSWORD sign-in (not biometric replay),
   * if biometric hardware is available but credentials haven't been saved yet,
   * offer to enable it. Once saved, the device prompts Face ID automatically
   * next time and we no longer ask.
   */
  const doSignIn = useCallback(
    async (id: string, pw: string, opts: { silent?: boolean } = {}) => {
      setSubmitting(true)
      try {
        await signIn(id.trim(), pw)
        if (!opts.silent && (await biometric.isAvailable()) && !(await biometric.isEnabled())) {
          const label = (await biometric.kind()) === 'face' ? 'Face ID' : 'biometric sign-in'
          Alert.alert(
            `Enable ${label}?`,
            `Use ${label} to sign in to GritSync next time without entering your password.`,
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  await biometric.rememberCredentials({ identifier: id.trim(), password: pw })
                },
              },
            ],
          )
        }
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
        'Sign in once with your password to enable biometric login.',
      )
      return
    }
    await doSignIn(remembered.identifier, remembered.password, { silent: true })
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
