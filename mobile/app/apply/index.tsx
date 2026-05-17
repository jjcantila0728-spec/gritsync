import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import { Stack, useRouter } from 'expo-router'
import { pickFile } from '@/lib/pickers'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/Button'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, palette, radius, spacing } from '@/theme'
import { api, errorMessage } from '@/lib/api'
import { dbFirst, dbList } from '@/lib/db'
import { storageAPI } from '@/lib/services'

interface UserDetailsRow {
  user_id: string
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  mobile_number?: string | null
  email?: string | null
  gender?: string | null
  marital_status?: string | null
  date_of_birth?: string | null
  birth_place?: string | null
  house_number?: string | null
  street_name?: string | null
  city?: string | null
  province?: string | null
  country?: string | null
  zipcode?: string | null
  elementary_school?: string | null
  elementary_city?: string | null
  elementary_province?: string | null
  elementary_country?: string | null
  high_school?: string | null
  high_school_city?: string | null
  high_school_province?: string | null
  high_school_country?: string | null
  nursing_school?: string | null
  nursing_school_city?: string | null
  nursing_school_province?: string | null
  nursing_school_country?: string | null
}

interface UserDocRow {
  id: string
  document_type?: string | null
  file_path?: string | null
  file_name?: string | null
}

interface FormState {
  // step 1 — personal
  first_name: string
  middle_name: string
  last_name: string
  gender: string
  marital_status: string
  date_of_birth: string
  birth_place: string
  // step 2 — address
  house_number: string
  street_name: string
  city: string
  province: string
  country: string
  zipcode: string
  // step 3 — elementary
  elementary_school: string
  elementary_city: string
  elementary_province: string
  elementary_country: string
  // step 4 — high school
  high_school: string
  high_school_city: string
  high_school_province: string
  high_school_country: string
  // step 5 — nursing
  nursing_school: string
  nursing_school_city: string
  nursing_school_province: string
  nursing_school_country: string
  // step 6 — documents (file_paths)
  picture_path: string
  diploma_path: string
  passport_path: string
  // step 7 — signature
  signature: string
  // step 8 — payment
  payment_type: 'full' | 'step1' | 'step2'
}

const STEPS = [
  'Personal',
  'Address',
  'Elementary',
  'High School',
  'Nursing School',
  'Documents',
  'Signature',
  'Payment',
] as const

export default function ApplyWizard() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [docs, setDocs] = useState<UserDocRow[]>([])
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const [details, mine] = await Promise.all([
        dbFirst<UserDetailsRow>('user_details', { filter: { user_id: user.id } }),
        dbList<UserDocRow>('user_documents', {
          filter: { user_id: user.id },
          order: 'created_at.desc',
          limit: 200,
        }),
      ])
      setDocs(mine)
      setForm((cur) => ({
        ...cur,
        first_name: details?.first_name ?? user.first_name ?? '',
        middle_name: details?.middle_name ?? user.middle_name ?? '',
        last_name: details?.last_name ?? user.last_name ?? '',
        gender: details?.gender ?? '',
        marital_status: details?.marital_status ?? '',
        date_of_birth: details?.date_of_birth ?? '',
        birth_place: details?.birth_place ?? '',
        house_number: details?.house_number ?? '',
        street_name: details?.street_name ?? '',
        city: details?.city ?? '',
        province: details?.province ?? '',
        country: details?.country ?? '',
        zipcode: details?.zipcode ?? '',
        elementary_school: details?.elementary_school ?? '',
        elementary_city: details?.elementary_city ?? '',
        elementary_province: details?.elementary_province ?? '',
        elementary_country: details?.elementary_country ?? '',
        high_school: details?.high_school ?? '',
        high_school_city: details?.high_school_city ?? '',
        high_school_province: details?.high_school_province ?? '',
        high_school_country: details?.high_school_country ?? '',
        nursing_school: details?.nursing_school ?? '',
        nursing_school_city: details?.nursing_school_city ?? '',
        nursing_school_province: details?.nursing_school_province ?? '',
        nursing_school_country: details?.nursing_school_country ?? '',
        picture_path: findExisting(mine, 'picture'),
        diploma_path: findExisting(mine, 'diploma'),
        passport_path: findExisting(mine, 'passport'),
      }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const fullName = useMemo(
    () => [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ').trim(),
    [form.first_name, form.middle_name, form.last_name],
  )

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((cur) => ({ ...cur, [key]: value }))
  }

  function validateStep(): string | null {
    switch (step) {
      case 0:
        if (!form.first_name.trim() || !form.last_name.trim()) return 'Enter your first and last name.'
        if (!form.gender) return 'Select a gender.'
        if (!form.marital_status) return 'Select your marital status.'
        if (!form.date_of_birth.trim()) return 'Enter your date of birth (MM/DD/YYYY).'
        if (!form.birth_place.trim()) return 'Enter your place of birth.'
        return null
      case 1:
        if (!form.city.trim() || !form.country.trim()) return 'Enter your city and country.'
        return null
      case 2:
        if (!form.elementary_school.trim()) return 'Enter your elementary school.'
        return null
      case 3:
        if (!form.high_school.trim()) return 'Enter your high school.'
        return null
      case 4:
        if (!form.nursing_school.trim()) return 'Enter your nursing school.'
        return null
      case 5:
        if (!form.picture_path) return 'Upload your picture (2x2 or selfie).'
        if (!form.diploma_path) return 'Upload your nursing diploma.'
        if (!form.passport_path) return 'Upload your passport.'
        return null
      case 6:
        if (form.signature.trim().toLowerCase() !== fullName.toLowerCase()) {
          return 'Sign by typing your full name exactly.'
        }
        return null
      case 7:
        if (!form.payment_type) return 'Choose a payment option.'
        return null
      default:
        return null
    }
  }

  function next() {
    const err = validateStep()
    if (err) {
      Alert.alert('Almost there', err)
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function prev() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function pickDoc(documentType: 'picture' | 'diploma' | 'passport') {
    if (!user?.id) return
    try {
      const file = await pickFile({ imagesOnly: documentType === 'picture' })
      if (!file) return
      setUploadingDocKey(documentType)
      const safeName = (file.name || `${documentType}.bin`).replace(/[^a-z0-9._-]+/gi, '_')
      const path = `${user.id}/${documentType}/${Date.now()}_${safeName}`
      const uploaded = await storageAPI.upload({
        uri: file.uri,
        name: file.name || safeName,
        mimeType: file.mimeType,
        path,
      })
      await api.post('/db/user_documents', {
        user_id: user.id,
        document_type: documentType,
        filename: file.name || safeName,
        file_name: file.name || safeName,
        file_path: uploaded.path,
        file_size: file.size ?? null,
      })
      if (documentType === 'picture') set('picture_path', uploaded.path)
      if (documentType === 'diploma') set('diploma_path', uploaded.path)
      if (documentType === 'passport') set('passport_path', uploaded.path)
      // refresh local doc cache
      const fresh = await dbList<UserDocRow>('user_documents', {
        filter: { user_id: user.id },
        order: 'created_at.desc',
        limit: 200,
      })
      setDocs(fresh)
    } catch (e) {
      Alert.alert('Upload failed', errorMessage(e))
    } finally {
      setUploadingDocKey(null)
    }
  }

  async function submit() {
    const err = validateStep()
    if (err) {
      Alert.alert('Cannot submit', err)
      return
    }
    if (!user?.id) return
    setSubmitting(true)
    try {
      // 1. upsert user_details
      await api.post('/db/user_details', {
        _onConflict: 'user_id',
        user_id: user.id,
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        gender: form.gender,
        marital_status: form.marital_status,
        date_of_birth: form.date_of_birth,
        birth_place: form.birth_place,
        house_number: form.house_number,
        street_name: form.street_name,
        city: form.city,
        province: form.province,
        country: form.country,
        zipcode: form.zipcode,
        elementary_school: form.elementary_school,
        elementary_city: form.elementary_city,
        elementary_province: form.elementary_province,
        elementary_country: form.elementary_country,
        high_school: form.high_school,
        high_school_city: form.high_school_city,
        high_school_province: form.high_school_province,
        high_school_country: form.high_school_country,
        nursing_school: form.nursing_school,
        nursing_school_city: form.nursing_school_city,
        nursing_school_province: form.nursing_school_province,
        nursing_school_country: form.nursing_school_country,
      })

      // 2. create application
      const appRes = await api.post('/db/applications', {
        user_id: user.id,
        service_type: 'NCLEX',
        service_subtype: 'Processing',
        status: 'pending',
        signature: form.signature,
        picture_path: form.picture_path,
        diploma_path: form.diploma_path,
        passport_path: form.passport_path,
      })
      const applicationId = (appRes.data as any)?.data?.id ?? (appRes.data as any)?.id
      if (!applicationId) throw new Error('Could not create application')

      Alert.alert(
        'Application submitted',
        'Your advisor will review it shortly and reach out for next steps.',
        [{ text: 'View timeline', onPress: () => router.replace(`/applications/${applicationId}`) }],
      )
    } catch (e) {
      Alert.alert('Could not submit application', errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'New Application' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'New NCLEX Application', headerShown: true }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Stepper current={step} total={STEPS.length} label={STEPS[step]} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          {step === 0 ? (
            <Step
              title="Personal information"
              subtitle="We pre-fill this from your profile when available."
            >
              <Row>
                <FieldInput label="First name" value={form.first_name} onChange={(v) => set('first_name', v)} flex />
                <FieldInput label="Middle name" value={form.middle_name} onChange={(v) => set('middle_name', v)} flex />
              </Row>
              <FieldInput label="Last name" value={form.last_name} onChange={(v) => set('last_name', v)} />
              <FieldSelect
                label="Gender"
                value={form.gender}
                options={['Male', 'Female', 'Other']}
                onChange={(v) => set('gender', v)}
              />
              <FieldSelect
                label="Marital status"
                value={form.marital_status}
                options={['Single', 'Married', 'Divorced', 'Widowed']}
                onChange={(v) => set('marital_status', v)}
              />
              <FieldInput label="Date of birth (MM/DD/YYYY)" value={form.date_of_birth} onChange={(v) => set('date_of_birth', v)} />
              <FieldInput label="Place of birth" value={form.birth_place} onChange={(v) => set('birth_place', v)} />
            </Step>
          ) : null}

          {step === 1 ? (
            <Step title="Address" subtitle="Where you currently live.">
              <Row>
                <FieldInput label="House #" value={form.house_number} onChange={(v) => set('house_number', v)} flex />
                <FieldInput label="Street" value={form.street_name} onChange={(v) => set('street_name', v)} flex />
              </Row>
              <Row>
                <FieldInput label="City" value={form.city} onChange={(v) => set('city', v)} flex />
                <FieldInput label="Province / State" value={form.province} onChange={(v) => set('province', v)} flex />
              </Row>
              <Row>
                <FieldInput label="Country" value={form.country} onChange={(v) => set('country', v)} flex />
                <FieldInput label="ZIP / Postal" value={form.zipcode} onChange={(v) => set('zipcode', v)} flex />
              </Row>
            </Step>
          ) : null}

          {step === 2 ? (
            <Step title="Elementary school" subtitle="Where you completed primary school.">
              <FieldInput label="School name" value={form.elementary_school} onChange={(v) => set('elementary_school', v)} />
              <Row>
                <FieldInput label="City" value={form.elementary_city} onChange={(v) => set('elementary_city', v)} flex />
                <FieldInput label="Province" value={form.elementary_province} onChange={(v) => set('elementary_province', v)} flex />
              </Row>
              <FieldInput label="Country" value={form.elementary_country} onChange={(v) => set('elementary_country', v)} />
            </Step>
          ) : null}

          {step === 3 ? (
            <Step title="High school" subtitle="Where you completed secondary school.">
              <FieldInput label="School name" value={form.high_school} onChange={(v) => set('high_school', v)} />
              <Row>
                <FieldInput label="City" value={form.high_school_city} onChange={(v) => set('high_school_city', v)} flex />
                <FieldInput label="Province" value={form.high_school_province} onChange={(v) => set('high_school_province', v)} flex />
              </Row>
              <FieldInput label="Country" value={form.high_school_country} onChange={(v) => set('high_school_country', v)} />
            </Step>
          ) : null}

          {step === 4 ? (
            <Step title="Nursing school" subtitle="Your nursing degree institution.">
              <FieldInput label="School name" value={form.nursing_school} onChange={(v) => set('nursing_school', v)} />
              <Row>
                <FieldInput label="City" value={form.nursing_school_city} onChange={(v) => set('nursing_school_city', v)} flex />
                <FieldInput label="Province" value={form.nursing_school_province} onChange={(v) => set('nursing_school_province', v)} flex />
              </Row>
              <FieldInput label="Country" value={form.nursing_school_country} onChange={(v) => set('nursing_school_country', v)} />
            </Step>
          ) : null}

          {step === 5 ? (
            <Step
              title="Required documents"
              subtitle="Picture, diploma, and passport are required to proceed."
            >
              <DocSlot
                label="Your picture (2x2 or selfie)"
                filePath={form.picture_path}
                uploading={uploadingDocKey === 'picture'}
                onUpload={() => pickDoc('picture')}
              />
              <DocSlot
                label="Nursing diploma"
                filePath={form.diploma_path}
                uploading={uploadingDocKey === 'diploma'}
                onUpload={() => pickDoc('diploma')}
              />
              <DocSlot
                label="Passport"
                filePath={form.passport_path}
                uploading={uploadingDocKey === 'passport'}
                onUpload={() => pickDoc('passport')}
              />
            </Step>
          ) : null}

          {step === 6 ? (
            <Step
              title="Review & signature"
              subtitle="I certify that the information above is true and complete."
            >
              <Card>
                <CardTitle>Signing as</CardTitle>
                <Text style={{ color: colors.text, fontSize: 16 }}>{fullName || '—'}</Text>
              </Card>
              <FieldInput
                label="Type your full name exactly to sign"
                value={form.signature}
                onChange={(v) => set('signature', v)}
                placeholder={fullName}
                autoCapitalize="words"
              />
              {form.signature && form.signature.toLowerCase() !== fullName.toLowerCase() ? (
                <Text style={{ color: palette.brand.red600, fontSize: 12 }}>
                  Signature must exactly match your name.
                </Text>
              ) : null}
            </Step>
          ) : null}

          {step === 7 ? (
            <Step title="Payment option" subtitle="Choose how you'd like to pay.">
              <PaymentOption
                value="full"
                selected={form.payment_type === 'full'}
                title="Pay in full"
                description="One-time payment. Recommended for fastest processing."
                onPress={() => set('payment_type', 'full')}
              />
              <PaymentOption
                value="step1"
                selected={form.payment_type === 'step1'}
                title="Step 1 — Initial payment"
                description="Start with a partial payment now; the rest before NCLEX exam scheduling."
                onPress={() => set('payment_type', 'step1')}
              />
              <PaymentOption
                value="step2"
                selected={form.payment_type === 'step2'}
                title="Step 2 — Retaker"
                description="For applicants who have taken NCLEX before."
                onPress={() => set('payment_type', 'step2')}
              />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                You'll be redirected to your application timeline after submitting. Payment is handled
                on the secure web portal.
              </Text>
            </Step>
          ) : null}
        </ScrollView>

        <View style={[styles.navBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {step > 0 ? (
            <Button title="Back" variant="secondary" onPress={prev} style={{ flex: 1 }} />
          ) : (
            <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          )}
          {step < STEPS.length - 1 ? (
            <Button title="Continue" onPress={next} style={{ flex: 2 }} />
          ) : (
            <Button title="Submit application" onPress={submit} loading={submitting} style={{ flex: 2 }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const initialForm: FormState = {
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: '',
  marital_status: '',
  date_of_birth: '',
  birth_place: '',
  house_number: '',
  street_name: '',
  city: '',
  province: '',
  country: '',
  zipcode: '',
  elementary_school: '',
  elementary_city: '',
  elementary_province: '',
  elementary_country: '',
  high_school: '',
  high_school_city: '',
  high_school_province: '',
  high_school_country: '',
  nursing_school: '',
  nursing_school_city: '',
  nursing_school_province: '',
  nursing_school_country: '',
  picture_path: '',
  diploma_path: '',
  passport_path: '',
  signature: '',
  payment_type: 'full',
}

function findExisting(rows: UserDocRow[], type: string): string {
  const m = rows.find((r) => r.document_type === type)
  return m?.file_path ?? ''
}

function Stepper({ current, total, label }: { current: number; total: number; label: string }) {
  const { colors } = useTheme()
  const pct = ((current + 1) / total) * 100
  return (
    <View style={{ gap: 6, paddingVertical: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
          STEP {current + 1} OF {total}
        </Text>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{label.toUpperCase()}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: palette.brand.red600 }} />
      </View>
    </View>
  )
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.sm }}>{children}</View>
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  flex,
  autoCapitalize,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  flex?: boolean
  autoCapitalize?: 'none' | 'words' | 'sentences'
}) {
  const { colors } = useTheme()
  return (
    <View style={[{ gap: 6 }, flex && { flex: 1 }]}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
    </View>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((opt) => {
          const selected = value === opt
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? palette.brand.red600 : colors.surface,
                  borderColor: selected ? palette.brand.red600 : colors.border,
                },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                {opt}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function DocSlot({
  label,
  filePath,
  uploading,
  onUpload,
}: {
  label: string
  filePath: string
  uploading: boolean
  onUpload: () => void
}) {
  const { colors } = useTheme()
  const filled = !!filePath
  return (
    <Pressable
      onPress={onUpload}
      disabled={uploading}
      style={({ pressed }) => [
        styles.slot,
        {
          backgroundColor: filled ? '#DCFCE7' : colors.surface,
          borderColor: filled ? '#86EFAC' : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={filled ? 'checkmark-circle' : 'cloud-upload-outline'}
        size={26}
        color={filled ? '#15803D' : palette.brand.red600}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {filled ? 'Uploaded — tap to replace' : 'Tap to upload'}
        </Text>
      </View>
      {uploading ? <ActivityIndicator color={colors.accent} /> : null}
    </Pressable>
  )
}

function PaymentOption({
  selected,
  title,
  description,
  onPress,
}: {
  value: 'full' | 'step1' | 'step2'
  selected: boolean
  title: string
  description: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.payOpt,
        {
          backgroundColor: selected ? palette.brand.red50 : colors.surface,
          borderColor: selected ? palette.brand.red500 : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? palette.brand.red600 : colors.border,
          },
        ]}
      >
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{description}</Text>
      </View>
    </Pressable>
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  payOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.brand.red600,
  },
  navBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
  },
})
