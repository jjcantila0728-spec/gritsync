import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import { BrandMark, Wordmark } from '@/components/Brand'
import { useTheme, radius, spacing, palette } from '@/theme'
import { biometric } from '@/lib/biometric'
import { push } from '@/lib/push'
import { openUrl } from '@/lib/browser'
import { api, API_BASE_URL, errorMessage } from '@/lib/api'
import {
  applyUpdate,
  checkForUpdates,
  getUpdateMeta,
  subscribe as subscribeUpdates,
  type UpdateState,
} from '@/lib/updates'

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
  // State for the password-verify modal that gates biometric enablement.
  const [bioEnableOpen, setBioEnableOpen] = useState(false)
  const [bioPassword, setBioPassword] = useState('')
  const [bioVerifying, setBioVerifying] = useState(false)
  // OTA update state for the "Check for updates" row.
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  useEffect(() => subscribeUpdates(setUpdateState), [])

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

  /**
   * Hits POST /api/auth/test-push so the server fires an Expo push back to
   * this device. Useful for end-to-end smoke-testing without manually
   * crafting a notification through the Expo dashboard.
   */
  async function onTestPush() {
    try {
      const res = await api.post<{ ok: boolean; sent?: boolean; reason?: string }>('/auth/test-push', {})
      if (res.data?.sent) {
        Alert.alert(
          'Test sent',
          'Look out for a banner in a few seconds. If nothing appears, check notifications permission for GritSync in your phone Settings.',
        )
      } else {
        Alert.alert(
          'No push token yet',
          res.data?.reason ?? 'Toggle on Push notifications first to register this device.',
        )
      }
    } catch (e) {
      Alert.alert('Test push failed', errorMessage(e, 'Try again in a moment.'))
    }
  }

  /**
   * Manual "Check for updates" handler. Surfaces the four possible outcomes
   * via Alert so the user gets confirmation that something happened — the
   * silent cold-start probe has no feedback, which made it feel broken.
   */
  async function onCheckForUpdates() {
    try {
      const result = await checkForUpdates({ silent: false })
      if (result.status === 'disabled') {
        Alert.alert(
          'Updates unavailable',
          'You’re running a development build. Over-the-air updates only ship to release builds.',
        )
        return
      }
      if (result.status === 'up-to-date') {
        Alert.alert('You’re up to date', `Running GritSync v${version}.`)
        return
      }
      if (result.status === 'available') {
        Alert.alert(
          'Update downloaded',
          'A new version is ready. Restart now to use it, or wait until the next launch.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Restart now', onPress: () => { void applyUpdate() } },
          ],
        )
      }
    } catch (e) {
      Alert.alert('Update check failed', errorMessage(e, 'Please try again in a moment.'))
    }
  }

  async function toggleBiometric(next: boolean) {
    if (next) {
      if (!biometricAvailable) {
        Alert.alert(
          `${biometricLabel} unavailable`,
          biometricKind === 'none'
            ? 'Your device does not support biometric authentication, or none is enrolled (open phone Settings → Face ID & Passcode, or Fingerprint, to set one up).'
            : 'Set up a biometric in your phone Settings first, then come back.',
        )
        return
      }
      // Open the verify modal — we need the user's password to save their
      // credentials in SecureStore so we can replay them on the next launch.
      // Without this, biometric "sign-in" has nothing to sign in WITH.
      setBioPassword('')
      setBioEnableOpen(true)
    } else {
      await biometric.forget()
      setBiometricEnabled(false)
    }
  }

  /**
   * Verify the user's password against the auth/login endpoint, then save
   * (identifier, password) to SecureStore via biometric.rememberCredentials.
   * We don't touch the active session — we just confirm the password and
   * stash credentials for next-launch biometric replay.
   */
  async function confirmEnableBiometric() {
    if (!bioPassword) {
      Alert.alert('Password required', 'Type your account password to confirm.')
      return
    }
    if (!user?.email) {
      Alert.alert('Unexpected', 'Could not read your account identifier — sign out and back in, then try again.')
      return
    }
    setBioVerifying(true)
    try {
      // POST /auth/login as a verification probe. The server returns a new
      // session on success; we discard it (we already have a valid session)
      // and only use the 200 status as proof the password is correct.
      const res = await api.post<{ user: { id: string } }>('/auth/login', {
        email: user.email,
        password: bioPassword,
      })
      if (!res.data?.user?.id) throw new Error('Login verification failed')
      // Also prompt the actual biometric so the OS-level approval lands
      // BEFORE we write to SecureStore — that way the very next login
      // already works without a "first prompt feels weird" gap.
      const promptOk = await biometric.authenticate(
        `Confirm ${biometricLabel} to enable fast sign-in`,
      )
      if (!promptOk) {
        Alert.alert('Cancelled', `${biometricLabel} confirmation was dismissed.`)
        return
      }
      await biometric.rememberCredentials({
        identifier: user.email,
        password: bioPassword,
      })
      setBiometricEnabled(true)
      setBioEnableOpen(false)
      setBioPassword('')
      Alert.alert(
        `${biometricLabel} enabled`,
        `You can now sign in with ${biometricLabel} from the login screen on your next visit.`,
      )
    } catch (e) {
      Alert.alert('Could not enable', errorMessage(e, 'Wrong password or network error.'))
    } finally {
      setBioVerifying(false)
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
            icon="paper-plane-outline"
            label="Send test notification"
            onPress={onTestPush}
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
          <CardTitle>App updates</CardTitle>
          <UpdateRow
            checking={!!updateState?.checking}
            ready={!!updateState?.ready}
            lastCheckedAt={updateState?.lastCheckedAt ?? null}
            onCheck={onCheckForUpdates}
            onApply={() => { void applyUpdate() }}
          />
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

        <BuildFooter mode={mode} colors={colors} version={version} />
      </View>

      {/* Password verification modal for enabling biometric sign-in. */}
      <Modal
        visible={bioEnableOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!bioVerifying) {
            setBioEnableOpen(false)
            setBioPassword('')
          }
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.modalIcon, { backgroundColor: palette.brand.red50 }]}>
                <Ionicons
                  name={biometricKind === 'face' ? 'scan-outline' : 'finger-print-outline'}
                  size={28}
                  color={palette.brand.red600}
                />
              </View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                Enable {biometricLabel}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                Confirm your account password to enable {biometricLabel} sign-in. Your password is stored encrypted in your phone's secure enclave — never on our servers.
              </Text>
            </View>

            <View style={{ gap: 6, marginTop: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Password</Text>
              <PasswordInput
                value={bioPassword}
                onChangeText={setBioPassword}
                placeholder="Your account password"
                autoComplete="password"
                autoFocus
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setBioEnableOpen(false)
                  setBioPassword('')
                }}
                disabled={bioVerifying}
                style={{ flex: 1 }}
              />
              <Button
                title={bioVerifying ? 'Verifying…' : 'Enable'}
                onPress={confirmEnableBiometric}
                loading={bioVerifying}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

/**
 * Manual OTA update row. Three visual states:
 *   - idle / up-to-date  → label "Check for updates", chevron
 *   - checking           → spinner, "Checking…"
 *   - update ready       → highlighted "Restart to install" with refresh icon
 */
function UpdateRow({
  checking,
  ready,
  lastCheckedAt,
  onCheck,
  onApply,
}: {
  checking: boolean
  ready: boolean
  lastCheckedAt: number | null
  onCheck: () => void
  onApply: () => void
}) {
  const { colors } = useTheme()
  const label = ready ? 'Restart to install update' : checking ? 'Checking…' : 'Check for updates'
  const helper = ready
    ? 'A new version is downloaded.'
    : lastCheckedAt
    ? `Last checked ${relativeTime(lastCheckedAt)}`
    : 'Tap to look for a newer version.'
  const onPress = ready ? onApply : checking ? undefined : onCheck
  return (
    <Pressable
      onPress={onPress}
      disabled={checking}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: checking }}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: colors.border, alignItems: 'flex-start' },
        pressed && !checking && { opacity: 0.7 },
      ]}
    >
      <Ionicons
        name={ready ? 'sparkles' : 'refresh-outline'}
        size={20}
        color={ready ? palette.brand.red600 : colors.text}
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: ready ? palette.brand.red600 : colors.text, fontSize: 15, fontWeight: ready ? '700' : '400' }}>
          {label}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{helper}</Text>
      </View>
      {checking ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  )
}

/**
 * Build footer with version, current EAS channel, and a short bundle id.
 * Surfaces the info support needs to triage "but it works for me" reports.
 */
function BuildFooter({
  mode,
  colors,
  version,
}: {
  mode: 'light' | 'dark'
  colors: ReturnType<typeof useTheme>['colors']
  version: string
}) {
  const meta = getUpdateMeta()
  const short = meta.updateId ? meta.updateId.slice(0, 8) : meta.isEmbeddedLaunch ? 'embedded' : '—'
  const channel = meta.channel ?? 'dev'
  return (
    <View style={{ alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
      <BrandMark size={36} />
      <Wordmark size={16} mode={mode} />
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
        v{version} · {channel} · {short}
      </Text>
    </View>
  )
}

function relativeTime(t: number): string {
  const diff = Date.now() - t
  if (diff < 60_000) return 'just now'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
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
  modalOverlay: {
    flex: 1,
    // backgroundColor is supplied inline from the theme so dark mode darkens
    // appropriately. Don't add a fallback here — that would compose two layers.
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 12,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
