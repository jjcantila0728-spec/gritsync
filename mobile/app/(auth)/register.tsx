import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { BrandMark, Wordmark } from '@/components/Brand'
import { PasswordInput } from '@/components/PasswordInput'
import { useTheme, radius, spacing, palette } from '@/theme'
import { authAPI } from '@/lib/services'
import { errorMessage } from '@/lib/api'
import { storage, StorageKeys } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'

const PASSWORD_RULES = [
  { test: (s: string) => s.length >= 8, label: 'At least 8 characters' },
  { test: (s: string) => /[A-Z]/.test(s), label: 'One uppercase letter' },
  { test: (s: string) => /[0-9]/.test(s), label: 'One number' },
  { test: (s: string) => /[^A-Za-z0-9]/.test(s), label: 'One symbol' },
]

export default function RegisterScreen() {
  const { colors, mode } = useTheme()
  const router = useRouter()
  const { refresh } = useAuth()

  const [step, setStep] = useState<'form' | 'otp'>('form')

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Step 2 fields
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 'otp') return
    setSecondsLeft(60)
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [step])

  function validateForm(): string | null {
    if (!firstName.trim() || !lastName.trim()) return 'First and last name are required.'
    if (!email.trim()) return 'Email is required.'
    if (!mobile.trim()) return 'Mobile number is required.'
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(password)) return `Password: ${rule.label.toLowerCase()}`
    }
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  async function onSignUp() {
    const error = validateForm()
    if (error) {
      Alert.alert('Please check your details', error)
      return
    }
    setSubmitting(true)
    try {
      await authAPI.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        personalEmail: email.trim().toLowerCase(),
        password,
      })
      setStep('otp')
    } catch (e) {
      Alert.alert('Could not create account', errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function onVerifyOtp() {
    if (!otp.trim()) {
      Alert.alert('Code required', 'Enter the 6-digit code from your email.')
      return
    }
    setVerifying(true)
    try {
      const { session, user } = await authAPI.verifyOtp(email.trim().toLowerCase(), otp.trim())
      await storage.set(StorageKeys.accessToken, session.access_token)
      await storage.set(StorageKeys.refreshToken, session.refresh_token)
      await storage.set(StorageKeys.user, JSON.stringify(user))
      await refresh()
      router.replace('/(tabs)/home')
    } catch (e) {
      Alert.alert('Verification failed', errorMessage(e, 'That code did not work.'))
    } finally {
      setVerifying(false)
    }
  }

  async function onResendOtp() {
    try {
      await authAPI.resendVerification(email.trim().toLowerCase())
      setSecondsLeft(60)
      Alert.alert('Code resent', 'Check your email for a new verification code.')
    } catch (e) {
      Alert.alert('Could not resend', errorMessage(e))
    }
  }

  if (step === 'otp') {
    return (
      <Screen scroll padded={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl }}>
              <BrandMark size={72} />
              <Wordmark size={24} mode={mode} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
              Check your email
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              We sent a 6-digit code to{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text>. Enter it below to
              activate your account.
            </Text>
            <TextInput
              value={otp}
              onChangeText={(s) => setOtp(s.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              maxLength={6}
              style={[
                styles.otp,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            />
            <Button title="Verify & sign in" onPress={onVerifyOtp} loading={verifying} />
            <Pressable
              onPress={onResendOtp}
              disabled={secondsLeft > 0}
              style={({ pressed }) => [{ alignSelf: 'center' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: secondsLeft > 0 ? colors.textMuted : colors.accent, fontWeight: '600' }}>
                {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStep('form')}
              style={({ pressed }) => [{ alignSelf: 'center' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Use a different email</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    )
  }

  return (
    <Screen scroll padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
            <BrandMark size={64} />
            <Wordmark size={22} mode={mode} />
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Create your account</Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Field flex label="First name" value={firstName} onChange={setFirstName} autoCapitalize="words" />
              <Field flex label="Last name" value={lastName} onChange={setLastName} autoCapitalize="words" />
            </View>
            <Field label="Mobile number" value={mobile} onChange={setMobile} keyboardType="phone-pad" />
            <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Password</Text>
              <PasswordInput value={password} onChangeText={setPassword} placeholder="••••••••" />
              <View style={{ gap: 2, marginTop: 4 }}>
                {PASSWORD_RULES.map((r) => {
                  const ok = r.test(password)
                  return (
                    <Text
                      key={r.label}
                      style={{
                        color: ok ? '#15803D' : colors.textMuted,
                        fontSize: 12,
                      }}
                    >
                      {ok ? '✓' : '·'} {r.label}
                    </Text>
                  )
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Confirm password</Text>
              <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" />
              {confirmPassword && confirmPassword !== password ? (
                <Text style={{ color: palette.brand.red600, fontSize: 12 }}>Passwords do not match.</Text>
              ) : null}
            </View>

            <Button title="Create account" onPress={onSignUp} loading={submitting} />

            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              style={({ pressed }) => [{ alignSelf: 'center', paddingVertical: spacing.sm }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Already have an account?{' '}
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
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
  flex,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words'
  flex?: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={[{ gap: 6 }, flex && { flex: 1 }]}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        placeholderTextColor={colors.textMuted}
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
  otp: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
  },
})
