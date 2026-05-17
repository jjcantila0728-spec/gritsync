import React, { useEffect, useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import { BrandMark, Wordmark } from '@/components/Brand'
import { useTheme, radius, spacing, palette } from '@/theme'
import { biometric } from '@/lib/biometric'
import { push } from '@/lib/push'
import { openUrl } from '@/lib/browser'
import { API_BASE_URL } from '@/lib/api'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const { themePreference, setThemePreference } = usePreferences()
  const { colors, mode } = useTheme()
  const router = useRouter()
  const version = Constants.expoConfig?.version ?? '1.0.0'

  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricKind, setBiometricKind] = useState<'face' | 'fingerprint' | 'iris' | 'none'>('none')
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  useEffect(() => {
    void (async () => {
      setBiometricAvailable(await biometric.isAvailable())
      setBiometricKind(await biometric.kind())
      setBiometricEnabled(await biometric.isEnabled())
      setPushEnabled(await push.isEnabled())
    })()
  }, [])

  const biometricLabel =
    biometricKind === 'face' ? 'Face ID' : biometricKind === 'fingerprint' ? 'Touch ID' : 'Biometric'

  function confirmSignOut() {
    Alert.alert('Sign out', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  async function togglePush(next: boolean) {
    if (next) {
      const token = await push.register()
      if (!token) {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications for GritSync in your phone Settings to receive updates.',
        )
        setPushEnabled(false)
        return
      }
      setPushEnabled(true)
    } else {
      await push.unregister()
      setPushEnabled(false)
    }
  }

  async function toggleBiometric(next: boolean) {
    if (next) {
      if (!biometricAvailable) {
        Alert.alert(
          `${biometricLabel} unavailable`,
          'Your device does not have biometric authentication enrolled.',
        )
        return
      }
      Alert.alert(
        `Enable ${biometricLabel}`,
        'Sign out first, then enable biometric login from the sign-in screen.',
      )
    } else {
      await biometric.forget()
      setBiometricEnabled(false)
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Settings</Text>
          <Text style={{ color: colors.textMuted }}>Your account & app preferences.</Text>
        </View>

        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="person" size={28} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <CardTitle>
                {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'GritSync user'}
              </CardTitle>
              <CardSubtitle>{user?.email}</CardSubtitle>
              {user?.grit_id ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>GRIT ID: {user.grit_id}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        <Card>
          <CardTitle>Account</CardTitle>
          <LinkRow icon="person-outline" label="Edit Profile" onPress={() => router.push('/profile-edit')} />
          <LinkRow
            icon="mail-outline"
            label="Emails"
            onPress={() => router.push('/emails')}
          />
          <LinkRow
            icon="chatbubbles-outline"
            label="Messages"
            onPress={() => router.push('/messages')}
          />
          <LinkRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/notifications')}
          />
          <LinkRow
            icon="lock-closed-outline"
            label="Password & Security"
            onPress={() => openUrl(`${API_BASE_URL}/client/account-settings`)}
          />
          <LinkRow
            icon="star-outline"
            label="Subscription"
            onPress={() => router.push('/subscription')}
          />
          <LinkRow
            icon="card-outline"
            label="Payments"
            onPress={() => openUrl(`${API_BASE_URL}/client/applications`)}
          />
        </Card>

        <Card>
          <CardTitle>Security</CardTitle>
          <SwitchRow
            icon="key-outline"
            label={`${biometricLabel} sign-in`}
            description={
              biometricEnabled
                ? 'Saved for fast sign-in. Toggle off to forget your credentials.'
                : 'Tap the toggle on the sign-in screen after signing in.'
            }
            value={biometricEnabled}
            onValueChange={toggleBiometric}
            disabled={!biometricAvailable}
          />
        </Card>

        <Card>
          <CardTitle>Notifications</CardTitle>
          <SwitchRow
            icon="notifications-outline"
            label="Push notifications"
            description="Status updates, new messages, and payment receipts."
            value={pushEnabled}
            onValueChange={togglePush}
          />
          <LinkRow
            icon="settings-outline"
            label="System notification settings"
            onPress={() => Linking.openSettings()}
          />
        </Card>

        <Card>
          <CardTitle>Appearance</CardTitle>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['system', 'light', 'dark'] as const).map((opt) => {
              const active = themePreference === opt
              return (
                <Pressable
                  key={opt}
                  onPress={() => setThemePreference(opt)}
                  style={({ pressed }) => [
                    styles.themeChip,
                    {
                      backgroundColor: active ? palette.brand.red600 : colors.surface,
                      borderColor: active ? palette.brand.red600 : colors.border,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons
                    name={opt === 'system' ? 'contrast-outline' : opt === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={16}
                    color={active ? '#fff' : colors.text}
                  />
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                      textTransform: 'capitalize',
                    }}
                  >
                    {opt}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Currently: {mode === 'dark' ? 'Dark' : 'Light'} mode
          </Text>
        </Card>

        <Card>
          <CardTitle>Support</CardTitle>
          <LinkRow
            icon="chatbubble-ellipses-outline"
            label="Contact Support"
            onPress={() => Linking.openURL('mailto:support@gritsync.com')}
          />
          <LinkRow
            icon="help-circle-outline"
            label="FAQs"
            onPress={() => openUrl('https://gritsync.com/faqs')}
          />
          <LinkRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => openUrl('https://gritsync.com/terms')}
          />
          <LinkRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => openUrl('https://gritsync.com/privacy')}
          />
        </Card>

        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />

        <View style={{ alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <BrandMark size={36} />
          <Wordmark size={16} mode={mode} />
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>Version {version}</Text>
        </View>
      </View>
    </Screen>
  )
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: any
  label: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

function SwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: any
  label: string
  description?: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.row, { borderTopColor: colors.border, alignItems: 'flex-start' }, disabled && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={20} color={colors.text} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
        {description ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{description}</Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
