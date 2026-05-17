import React, { useState } from 'react'
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

type Step = 'email' | 'otp' | 'reset' | 'done'

export default function ForgotPasswordScreen() {
  const { colors, mode } = useTheme()
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function sendReset() {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter the email on your GritSync account.')
      return
    }
    setSubmitting(true)
    try {
      await authAPI.requestPasswordReset(email.trim().toLowerCase())
      setStep('otp')
    } catch (e) {
      Alert.alert('Could not send code', errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyOtp() {
    if (otp.trim().length < 4) {
      Alert.alert('Code required', 'Enter the code from your email.')
      return
    }
    setSubmitting(true)
    try {
      const { reset_token } = await authAPI.verifyResetOtp(email.trim().toLowerCase(), otp.trim())
      setResetToken(reset_token)
      setStep('reset')
    } catch (e) {
      Alert.alert('Verification failed', errorMessage(e, 'That code did not work.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitNewPassword() {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter your new password.')
      return
    }
    setSubmitting(true)
    try {
      await authAPI.resetPassword(resetToken, newPassword)
      setStep('done')
    } catch (e) {
      Alert.alert('Reset failed', errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen scroll padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl }}>
            <BrandMark size={72} />
            <Wordmark size={24} mode={mode} />
          </View>

          {step === 'email' ? (
            <>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Reset password</Text>
              <Text style={{ color: colors.textMuted }}>
                Enter your account email and we'll send you a 6-digit code to reset your password.
              </Text>
              <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Button title="Send reset code" onPress={sendReset} loading={submitting} />
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
                Check your email
              </Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                Enter the 6-digit code we sent to{' '}
                <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text>.
              </Text>
              <TextInput
                value={otp}
                onChangeText={(s) => setOtp(s.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.otp,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              />
              <Button title="Verify code" onPress={verifyOtp} loading={submitting} />
              <Pressable
                onPress={() => setStep('email')}
                style={({ pressed }) => [{ alignSelf: 'center' }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ color: colors.textMuted }}>Use a different email</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'reset' ? (
            <>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Set a new password</Text>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>New password</Text>
                <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Confirm password</Text>
                <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" />
                {confirmPassword && confirmPassword !== newPassword ? (
                  <Text style={{ color: palette.brand.red600, fontSize: 12 }}>Passwords do not match.</Text>
                ) : null}
              </View>
              <Button title="Update password" onPress={submitNewPassword} loading={submitting} />
            </>
          ) : null}

          {step === 'done' ? (
            <>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
                Password updated
              </Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                You can now sign in with your new password.
              </Text>
              <Button title="Back to sign in" onPress={() => router.replace('/(auth)/login')} />
            </>
          ) : null}

          <Pressable
            onPress={() => router.back()}
            style={{ alignSelf: 'center', paddingVertical: spacing.sm }}
          >
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Back to sign in</Text>
          </Pressable>
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
