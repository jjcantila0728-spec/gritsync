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
import {
  convertFromDatabaseFormat,
  convertToDatabaseFormat,
  convertToMMYYYY,
  convertMMYYYYToDatabase,
  formatMMDDYYYY,
  formatMMYYYY,
  isValidMMDDYYYY,
  isValidMMYYYY,
} from '@/lib/dateFormatters'

interface UserDetailsRow {
  user_id: string
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  mobile_number?: string | null
  email?: string | null
  gender?: string | null
  marital_status?: string | null
  single_full_name?: string | null
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
  elementary_years_attended?: string | number | null
  elementary_start_date?: string | null
  elementary_end_date?: string | null
  high_school?: string | null
  high_school_city?: string | null
  high_school_province?: string | null
  high_school_country?: string | null
  high_school_years_attended?: string | number | null
  high_school_start_date?: string | null
  high_school_end_date?: string | null
  nursing_school?: string | null
  nursing_school_city?: string | null
  nursing_school_province?: string | null
  nursing_school_country?: string | null
  nursing_school_years_attended?: string | number | null
  nursing_school_start_date?: string | null
  nursing_school_end_date?: string | null
}

interface EmailAddressRow {
  email_address: string | null
  is_primary?: boolean | null
  address_type?: string | null
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
  /** Maiden / single name — shown only when marital_status != 'Single'. */
  single_full_name: string
  mobile_number: string
  email: string
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
  elementary_years_attended: string
  elementary_start_date: string
  elementary_end_date: string
  // step 4 — high school
  high_school: string
  high_school_city: string
  high_school_province: string
  high_school_country: string
  high_school_years_attended: string
  high_school_start_date: string
  high_school_end_date: string
  // step 5 — nursing
  nursing_school: string
  nursing_school_city: string
  nursing_school_province: string
  nursing_school_country: string
  nursing_school_years_attended: string
  nursing_school_start_date: string
  nursing_school_end_date: string
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
  /** True once we pre-filled at least one field from saved user_details —
   *  drives the "Auto-filled from saved details" banner shown to the user. */
  const [autoFilled, setAutoFilled] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      // Three parallel fetches — same shape as the web's loadSavedDetails():
      //   1. user_details      → the canonical profile row
      //   2. user_documents    → uploaded pictures/diploma/passport
      //   3. email_addresses   → user's GritSync business email (when issued)
      const [details, mine, emailRows] = await Promise.all([
        dbFirst<UserDetailsRow>('user_details', { filter: { user_id: user.id } }),
        dbList<UserDocRow>('user_documents', {
          filter: { user_id: user.id },
          order: 'created_at.desc',
          limit: 200,
        }),
        dbList<EmailAddressRow>('email_addresses', {
          filter: { user_id: user.id, address_type: 'client' },
          limit: 5,
        }).catch(() => [] as EmailAddressRow[]),
      ])
      setDocs(mine)

      const primaryEmail =
        emailRows.find((r) => r.is_primary)?.email_address ??
        emailRows[0]?.email_address ??
        user.gritsync_email ??
        user.email ??
        ''

      const hasSavedData = Boolean(
        details &&
          (details.gender ||
            details.date_of_birth ||
            details.elementary_school ||
            details.high_school ||
            details.nursing_school ||
            details.city),
      )

      setForm((cur) => ({
        ...cur,
        // Personal — names always pull from users table first (source of truth),
        // fall back to user_details for the optional middle_name.
        first_name: user.first_name ?? details?.first_name ?? '',
        middle_name: details?.middle_name ?? user.middle_name ?? '',
        last_name: user.last_name ?? details?.last_name ?? '',
        single_full_name: details?.single_full_name ?? '',
        mobile_number: details?.mobile_number ?? user.mobile ?? '',
        email: primaryEmail,
        gender: details?.gender ?? '',
        marital_status: details?.marital_status ?? '',
        date_of_birth: convertFromDatabaseFormat(details?.date_of_birth ?? ''),
        birth_place: details?.birth_place ?? '',
        // Address
        house_number: details?.house_number ?? '',
        street_name: details?.street_name ?? '',
        city: details?.city ?? '',
        province: details?.province ?? '',
        country: details?.country ?? '',
        zipcode: details?.zipcode ?? '',
        // Elementary
        elementary_school: details?.elementary_school ?? '',
        elementary_city: details?.elementary_city ?? '',
        elementary_province: details?.elementary_province ?? '',
        elementary_country: details?.elementary_country ?? '',
        elementary_years_attended:
          details?.elementary_years_attended != null ? String(details.elementary_years_attended) : '',
        elementary_start_date: convertToMMYYYY(details?.elementary_start_date ?? ''),
        elementary_end_date: convertToMMYYYY(details?.elementary_end_date ?? ''),
        // High School
        high_school: details?.high_school ?? '',
        high_school_city: details?.high_school_city ?? '',
        high_school_province: details?.high_school_province ?? '',
        high_school_country: details?.high_school_country ?? '',
        high_school_years_attended:
          details?.high_school_years_attended != null ? String(details.high_school_years_attended) : '',
        high_school_start_date: convertToMMYYYY(details?.high_school_start_date ?? ''),
        high_school_end_date: convertToMMYYYY(details?.high_school_end_date ?? ''),
        // Nursing School
        nursing_school: details?.nursing_school ?? '',
        nursing_school_city: details?.nursing_school_city ?? '',
        nursing_school_province: details?.nursing_school_province ?? '',
        nursing_school_country: details?.nursing_school_country ?? '',
        nursing_school_years_attended:
          details?.nursing_school_years_attended != null ? String(details.nursing_school_years_attended) : '',
        nursing_school_start_date: convertToMMYYYY(details?.nursing_school_start_date ?? ''),
        nursing_school_end_date: convertToMMYYYY(details?.nursing_school_end_date ?? ''),
        // Documents
        picture_path: findExisting(mine, 'picture'),
        diploma_path: findExisting(mine, 'diploma'),
        passport_path: findExisting(mine, 'passport'),
      }))
      setAutoFilled(hasSavedData)
    } catch {
      // ignore — empty form is the worst case
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
        if (!form.date_of_birth.trim() || !isValidMMDDYYYY(form.date_of_birth)) {
          return 'Enter your date of birth as MM/DD/YYYY.'
        }
        if (!form.birth_place.trim()) return 'Enter your place of birth.'
        return null
      case 1:
        if (!form.city.trim() || !form.country.trim()) return 'Enter your city and country.'
        return null
      case 2:
        if (!form.elementary_school.trim()) return 'Enter your elementary school.'
        if (form.elementary_start_date && !isValidMMYYYY(form.elementary_start_date)) {
          return 'Elementary start date must be MM/YYYY.'
        }
        if (form.elementary_end_date && !isValidMMYYYY(form.elementary_end_date)) {
          return 'Elementary end date must be MM/YYYY.'
        }
        return null
      case 3:
        if (!form.high_school.trim()) return 'Enter your high school.'
        if (form.high_school_start_date && !isValidMMYYYY(form.high_school_start_date)) {
          return 'High school start date must be MM/YYYY.'
        }
        if (form.high_school_end_date && !isValidMMYYYY(form.high_school_end_date)) {
          return 'High school end date must be MM/YYYY.'
        }
        return null
      case 4:
        if (!form.nursing_school.trim()) return 'Enter your nursing school.'
        if (form.nursing_school_start_date && !isValidMMYYYY(form.nursing_school_start_date)) {
          return 'Nursing school start date must be MM/YYYY.'
        }
        if (form.nursing_school_end_date && !isValidMMYYYY(form.nursing_school_end_date)) {
          return 'Nursing school end date must be MM/YYYY.'
        }
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
      // 1. upsert user_details. Dates round-trip MM/DD/YYYY ↔ YYYY-MM-DD for
      //    Postgres DATE columns; school start/end use MM/YYYY ↔ YYYY-MM-01.
      //    Empty strings become null so existing rows aren't overwritten with
      //    blanks when a returning user submits a follow-up application.
      const yearsToInt = (s: string): number | null => {
        const n = parseInt(s, 10)
        return isFinite(n) && n > 0 ? n : null
      }
      const orNull = (s: string) => (s && s.trim() ? s.trim() : null)

      await api.post('/db/user_details', {
        _onConflict: 'user_id',
        user_id: user.id,
        first_name: form.first_name,
        middle_name: orNull(form.middle_name),
        last_name: form.last_name,
        single_full_name: orNull(form.single_full_name),
        mobile_number: orNull(form.mobile_number),
        email: orNull(form.email),
        gender: form.gender,
        marital_status: form.marital_status,
        date_of_birth: convertToDatabaseFormat(form.date_of_birth) || null,
        birth_place: orNull(form.birth_place),
        house_number: orNull(form.house_number),
        street_name: orNull(form.street_name),
        city: orNull(form.city),
        province: orNull(form.province),
        country: orNull(form.country),
        zipcode: orNull(form.zipcode),
        elementary_school: orNull(form.elementary_school),
        elementary_city: orNull(form.elementary_city),
        elementary_province: orNull(form.elementary_province),
        elementary_country: orNull(form.elementary_country),
        elementary_years_attended: yearsToInt(form.elementary_years_attended),
        elementary_start_date: convertMMYYYYToDatabase(form.elementary_start_date) || null,
        elementary_end_date: convertMMYYYYToDatabase(form.elementary_end_date) || null,
        high_school: orNull(form.high_school),
        high_school_city: orNull(form.high_school_city),
        high_school_province: orNull(form.high_school_province),
        high_school_country: orNull(form.high_school_country),
        high_school_years_attended: yearsToInt(form.high_school_years_attended),
        high_school_start_date: convertMMYYYYToDatabase(form.high_school_start_date) || null,
        high_school_end_date: convertMMYYYYToDatabase(form.high_school_end_date) || null,
        nursing_school: orNull(form.nursing_school),
        nursing_school_city: orNull(form.nursing_school_city),
        nursing_school_province: orNull(form.nursing_school_province),
        nursing_school_country: orNull(form.nursing_school_country),
        nursing_school_years_attended: yearsToInt(form.nursing_school_years_attended),
        nursing_school_start_date: convertMMYYYYToDatabase(form.nursing_school_start_date) || null,
        nursing_school_end_date: convertMMYYYYToDatabase(form.nursing_school_end_date) || null,
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
          {autoFilled ? (
            <View style={[styles.autoFilledBanner, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#15803D" />
              <Text style={{ flex: 1, color: '#15803D', fontWeight: '700', fontSize: 13 }}>
                Auto-filled from your saved profile. Review and tweak anything below.
              </Text>
            </View>
          ) : null}

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
              <Row>
                <FieldInput
                  label="Mobile"
                  value={form.mobile_number}
                  onChange={(v) => set('mobile_number', v)}
                  keyboardType="phone-pad"
                  flex
                />
                <FieldInput
                  label="Email"
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  flex
                />
              </Row>
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
              {form.marital_status && form.marital_status !== 'Single' ? (
                <FieldInput
                  label="Maiden / single name (for retaker matching)"
                  value={form.single_full_name}
                  onChange={(v) => set('single_full_name', v)}
                />
              ) : null}
              <FieldInput
                label="Date of birth (MM/DD/YYYY)"
                value={form.date_of_birth}
                onChange={(v) => set('date_of_birth', formatMMDDYYYY(v))}
                keyboardType="number-pad"
                placeholder="MM/DD/YYYY"
              />
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
              <Row>
                <FieldInput
                  label="Years attended"
                  value={form.elementary_years_attended}
                  onChange={(v) => set('elementary_years_attended', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="e.g. 6"
                  flex
                />
              </Row>
              <Row>
                <FieldInput
                  label="Started (MM/YYYY)"
                  value={form.elementary_start_date}
                  onChange={(v) => set('elementary_start_date', formatMMYYYY(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YYYY"
                  flex
                />
                <FieldInput
                  label="Finished (MM/YYYY)"
                  value={form.elementary_end_date}
                  onChange={(v) => set('elementary_end_date', formatMMYYYY(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YYYY"
                  flex
                />
              </Row>
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
              <Row>
                <FieldInput
                  label="Years attended"
                  value={form.high_school_years_attended}
                  onChange={(v) => set('high_school_years_attended', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="e.g. 4"
                  flex
                />
              </Row>
              <Row>
                <FieldInput
                  label="Started (MM/YYYY)"
                  value={form.high_school_start_date}
                  onChange={(v) => set('high_school_start_date', formatMMYYYY(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YYYY"
                  flex
                />
                <FieldInput
                  label="Finished (MM/YYYY)"
                  value={form.high_school_end_date}
                  onChange={(v) => set('high_school_end_date', formatMMYYYY(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YYYY"
                  flex
                />
              </Row>
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
              <Row>
                <FieldInput
                  label="Years attended"
                  value={form.nursing_school_years_attended}
                  onChange={(v) => set('nursing_school_years_attended', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="e.g. 4"
                  flex
                />
              </Row>
              <Row>
                <FieldInput
                  label="Started (MM/YYYY)"
                  value={form.nursing_school_start_date}
                  onChange={(v) => set('nursing_school_start_date', formatMMYYYY(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YYYY"
                  flex
                />
                <FieldInput
                  label="Finished (MM/YYYY)"
                  value={form.nursing_school_end_date}
                  onChange={(v) => set('nursing_school_end_date', formatMMYYYY(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YYYY"
                  flex
                />
              </Row>
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
  single_full_name: '',
  mobile_number: '',
  email: '',
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
  elementary_years_attended: '',
  elementary_start_date: '',
  elementary_end_date: '',
  high_school: '',
  high_school_city: '',
  high_school_province: '',
  high_school_country: '',
  high_school_years_attended: '',
  high_school_start_date: '',
  high_school_end_date: '',
  nursing_school: '',
  nursing_school_city: '',
  nursing_school_province: '',
  nursing_school_country: '',
  nursing_school_years_attended: '',
  nursing_school_start_date: '',
  nursing_school_end_date: '',
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
  keyboardType,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  flex?: boolean
  autoCapitalize?: 'none' | 'words' | 'sentences'
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'numeric'
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
        keyboardType={keyboardType ?? 'default'}
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
  autoFilledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
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
