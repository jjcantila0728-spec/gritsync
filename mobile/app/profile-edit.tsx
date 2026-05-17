import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, palette, radius, spacing } from '@/theme'
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

  const initials = (user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')

  // Track whether anything actually changed so the Save button can disable
  // itself — avoids accidental saves and a redundant network round-trip.
  const dirty =
    firstName.trim() !== (user?.first_name ?? '') ||
    middleName.trim() !== (user?.middle_name ?? '') ||
    lastName.trim() !== (user?.last_name ?? '') ||
    mobile.trim() !== (user?.mobile ?? '')

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
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero with avatar */}
          <LinearGradient
            colors={[palette.brand.red700, palette.brand.red600, palette.brand.red500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials.toUpperCase() || 'GS'}</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'GritSync user'}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {user?.email}
            </Text>
            {user?.grit_id ? (
              <View style={styles.idChip}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#FFFFFF" />
                <Text style={styles.idChipText}>{user.grit_id}</Text>
              </View>
            ) : null}
          </LinearGradient>

          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg }}>
            {/* Name section */}
            <SectionCard title="Your name" icon="person-outline">
              <FieldRow
                label="First name"
                value={firstName}
                onChange={setFirstName}
                icon="person-outline"
                autoCapitalize="words"
              />
              <FieldRow
                label="Middle name"
                value={middleName}
                onChange={setMiddleName}
                icon="contract-outline"
                placeholder="Optional"
                autoCapitalize="words"
              />
              <FieldRow
                label="Last name"
                value={lastName}
                onChange={setLastName}
                icon="people-outline"
                autoCapitalize="words"
              />
            </SectionCard>

            {/* Contact section */}
            <SectionCard title="Contact" icon="call-outline">
              <FieldRow
                label="Mobile"
                value={mobile}
                onChange={setMobile}
                icon="phone-portrait-outline"
                keyboardType="phone-pad"
                placeholder="+1 555 555 0123"
              />
              <View
                style={[
                  styles.readonly,
                  { borderTopColor: colors.border, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    EMAIL
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
                    {user?.email}
                  </Text>
                </View>
                <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
              </View>
            </SectionCard>

            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.md }}>
              Email and GRIT ID can't be changed here. Contact your GritSync advisor for help with those.
            </Text>
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.btn,
              styles.btnGhost,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={!dirty || saving}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              (!dirty || saving) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name={saving ? 'sync' : 'checkmark'} size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View>
      <View style={styles.sectionLabel}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
          {title.toUpperCase()}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

function FieldRow({
  label,
  value,
  onChange,
  icon,
  keyboardType,
  autoCapitalize,
  placeholder,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  icon: keyof typeof Ionicons.glyphMap
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words'
  placeholder?: string
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.fieldRow, { borderTopColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginTop: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 }}>
          {label.toUpperCase()}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={{
            color: colors.text,
            fontSize: 16,
            paddingVertical: 6,
            paddingTop: 2,
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  idChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 2,
    backgroundColor: palette.brand.red600,
  },
})
