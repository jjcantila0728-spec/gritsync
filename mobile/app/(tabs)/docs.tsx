import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, radius, spacing, palette } from '@/theme'
import { dbList } from '@/lib/db'
import { api, API_BASE_URL, errorMessage } from '@/lib/api'
import { storage, StorageKeys } from '@/lib/storage'
import { storageAPI } from '@/lib/services'
import { pickFile } from '@/lib/pickers'
import { openSignedDoc } from '@/lib/browser'
import { DocumentRow } from '@/lib/types'

interface RequiredDoc {
  id: string
  service_type?: string | null
  document_type: string
  name?: string | null
  accepted_formats?: string | null
  required?: boolean | null
  sort_order?: number | null
}

/**
 * The three top-level placeholder cards. These ALWAYS render — even before the
 * `service_required_documents` table is loaded — so the user immediately sees
 * what they need to upload.
 */
interface PrimarySlot {
  type: string
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  accepted: string
  imagesOnly?: boolean
  isPhoto?: boolean
}

const PRIMARY_SLOTS: PrimarySlot[] = [
  {
    type: 'picture',
    title: '2×2 Picture',
    description: 'Recent passport-style photo, white background, no glasses.',
    icon: 'person-outline',
    accepted: 'JPG · PNG · HEIC',
    imagesOnly: true,
    isPhoto: true,
  },
  {
    type: 'passport',
    title: 'Passport',
    description: 'Photo page only — full ID, signature, and expiry visible.',
    icon: 'airplane-outline',
    accepted: 'JPG · PNG · PDF',
  },
  {
    type: 'diploma',
    title: 'Nursing Diploma',
    description: 'Front side. PDF preferred; scans must be legible.',
    icon: 'school-outline',
    accepted: 'PDF · JPG · PNG',
  },
]

export default function DocsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const [required, setRequired] = useState<RequiredDoc[]>([])
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const [req, mine] = await Promise.all([
        dbList<RequiredDoc>('service_required_documents', {
          order: 'sort_order.asc',
          limit: 200,
        }),
        dbList<DocumentRow>('user_documents', {
          filter: { user_id: user.id },
          order: 'created_at.desc',
          limit: 200,
        }),
      ])
      setRequired(req)
      setDocs(mine)
    } catch {
      // ignore — empty state will handle
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  // Newest doc per type wins (docs are ordered created_at.desc).
  const docByType = useMemo(() => {
    const map = new Map<string, DocumentRow>()
    for (const d of docs) {
      if (!d.document_type) continue
      if (!map.has(d.document_type)) map.set(d.document_type, d)
    }
    return map
  }, [docs])

  const primaryTypes = useMemo(() => new Set(PRIMARY_SLOTS.map((s) => s.type)), [])

  /** Other required docs from the DB that aren't in our primary three. */
  const secondaryRequired = useMemo(
    () => required.filter((r) => !primaryTypes.has(r.document_type)),
    [required, primaryTypes],
  )

  const additional = useMemo(
    () =>
      docs.filter(
        (d) =>
          !d.document_type ||
          primaryTypes.has(d.document_type) === false &&
            !required.some((r) => r.document_type === d.document_type),
      ),
    [docs, required, primaryTypes],
  )

  const filledPrimary = PRIMARY_SLOTS.filter((s) => docByType.has(s.type)).length

  async function uploadFor(docType: string, opts: { imagesOnly?: boolean } = {}) {
    if (!user?.id) return
    try {
      const file = await pickFile({ imagesOnly: opts.imagesOnly })
      if (!file) return

      setUploadingType(docType)
      const safeName = (file.name || `${docType}.bin`).replace(/[^a-z0-9._-]+/gi, '_')
      const storagePath = `${user.id}/${docType}/${Date.now()}_${safeName}`

      const uploaded = await storageAPI.upload({
        uri: file.uri,
        name: file.name || safeName,
        mimeType: file.mimeType,
        path: storagePath,
      })

      await api.post('/db/user_documents', {
        user_id: user.id,
        document_type: docType,
        filename: file.name || safeName,
        file_name: file.name || safeName,
        file_path: uploaded.path,
        file_size: file.size ?? null,
      })

      await load()
    } catch (e: any) {
      Alert.alert('Upload failed', errorMessage(e))
    } finally {
      setUploadingType(null)
    }
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      <View style={{ gap: spacing.lg }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Documents</Text>
          <Text style={{ color: colors.textMuted }}>
            Upload your three required documents below. Take a photo or pick from your files.
          </Text>
        </View>

        <ProgressPill filled={filledPrimary} total={PRIMARY_SLOTS.length} />

        {/* PRIMARY CARDS — always visible, ready to upload */}
        <View style={{ gap: spacing.md }}>
          {PRIMARY_SLOTS.map((slot) => (
            <PrimaryCard
              key={slot.type}
              slot={slot}
              doc={docByType.get(slot.type) ?? null}
              uploading={uploadingType === slot.type}
              onUpload={() => uploadFor(slot.type, { imagesOnly: slot.imagesOnly })}
            />
          ))}
        </View>

        {/* SECONDARY required docs from server (if any) */}
        {!loading && secondaryRequired.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[styles.groupHeading, { color: colors.text }]}>Other required documents</Text>
            <Card>
              {secondaryRequired.map((r, idx) => (
                <SecondaryRow
                  key={r.id}
                  req={r}
                  uploaded={docByType.get(r.document_type) ?? null}
                  uploading={uploadingType === r.document_type}
                  onUpload={() => uploadFor(r.document_type)}
                  isLast={idx === secondaryRequired.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {/* Additional / free-form uploads */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.groupHeading, { color: colors.text }]}>Additional files</Text>
            <Pressable
              onPress={() => uploadFor('additional')}
              disabled={uploadingType === 'additional'}
              style={({ pressed }) => [
                styles.uploadBtn,
                uploadingType === 'additional' && { opacity: 0.6 },
                pressed && { opacity: 0.85 },
              ]}
            >
              {uploadingType === 'additional' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Upload</Text>
                </>
              )}
            </Pressable>
          </View>
          {additional.length === 0 ? (
            <Card>
              <Text style={{ color: colors.textMuted }}>
                Anything you upload that isn't in the required list lives here.
              </Text>
            </Card>
          ) : (
            <Card>
              {additional.map((d, i) => (
                <UploadedRow doc={d} key={d.id} isLast={i === additional.length - 1} />
              ))}
            </Card>
          )}
        </View>
      </View>
    </Screen>
  )
}

function ProgressPill({ filled, total }: { filled: number; total: number }) {
  const { colors } = useTheme()
  const done = filled === total
  return (
    <View
      style={[
        styles.progressPill,
        {
          backgroundColor: done ? '#DCFCE7' : palette.brand.red50,
          borderColor: done ? '#86EFAC' : palette.brand.red200,
        },
      ]}
    >
      <Ionicons
        name={done ? 'checkmark-done-circle' : 'time-outline'}
        size={18}
        color={done ? '#15803D' : palette.brand.red700}
      />
      <Text
        style={{
          flex: 1,
          color: done ? '#15803D' : palette.brand.red700,
          fontWeight: '700',
          fontSize: 13,
        }}
      >
        {done
          ? 'All required documents uploaded'
          : `${filled} of ${total} required documents uploaded`}
      </Text>
    </View>
  )
}

function PrimaryCard({
  slot,
  doc,
  uploading,
  onUpload,
}: {
  slot: PrimarySlot
  doc: DocumentRow | null
  uploading: boolean
  onUpload: () => void
}) {
  const { colors } = useTheme()
  const filled = !!doc
  const [thumbUri, setThumbUri] = useState<string | null>(null)

  // For uploaded selfies, build an authenticated <Image> URL once.
  useEffect(() => {
    let cancelled = false
    if (!filled || !slot.isPhoto || !doc?.file_path) {
      setThumbUri(null)
      return
    }
    void (async () => {
      const token = await storage.get(StorageKeys.accessToken)
      if (cancelled) return
      setThumbUri(
        `${API_BASE_URL}/api/storage/file?path=${encodeURIComponent(doc.file_path!)}&t=${encodeURIComponent(token ?? '')}`,
      )
    })()
    return () => {
      cancelled = true
    }
  }, [filled, slot.isPhoto, doc?.file_path])

  return (
    <View
      style={[
        styles.primaryCard,
        {
          backgroundColor: colors.surface,
          borderColor: filled ? '#86EFAC' : colors.border,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View
          style={[
            styles.placeholderBox,
            {
              backgroundColor: filled ? '#F0FDF4' : colors.surfaceMuted,
              borderColor: filled ? '#86EFAC' : colors.border,
              borderStyle: filled ? 'solid' : 'dashed',
            },
          ]}
        >
          {filled && thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMode="cover" />
          ) : filled ? (
            <Ionicons name="checkmark-circle" size={40} color="#15803D" />
          ) : (
            <Ionicons name={slot.icon} size={40} color={palette.brand.red500} />
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{slot.title}</Text>
            {filled ? (
              <View style={styles.filledBadge}>
                <Text style={{ color: '#15803D', fontSize: 10, fontWeight: '800' }}>UPLOADED</Text>
              </View>
            ) : (
              <Text style={{ color: palette.brand.red600, fontWeight: '800' }}>*</Text>
            )}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{slot.description}</Text>
          {filled ? (
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {doc?.file_name ?? doc?.filename ?? 'Uploaded file'}
              {doc?.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
            </Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>Accepts {slot.accepted}</Text>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        {filled ? (
          <Pressable
            onPress={() => doc && openSignedDoc(doc.file_path!)}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="eye-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>View</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: filled ? colors.surfaceMuted : palette.brand.red600, borderColor: filled ? colors.border : palette.brand.red600 },
            uploading && { opacity: 0.7 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={filled ? colors.text : '#fff'} size="small" />
          ) : (
            <>
              <Ionicons
                name={filled ? 'refresh-outline' : 'cloud-upload-outline'}
                size={16}
                color={filled ? colors.text : '#fff'}
              />
              <Text style={{ color: filled ? colors.text : '#fff', fontWeight: '700', fontSize: 13 }}>
                {filled ? 'Replace' : 'Upload'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function SecondaryRow({
  req,
  uploaded,
  uploading,
  onUpload,
  isLast,
}: {
  req: RequiredDoc
  uploaded: DocumentRow | null
  uploading: boolean
  onUpload: () => void
  isLast: boolean
}) {
  const { colors } = useTheme()
  const filled = !!uploaded
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <View
        style={[
          styles.docIcon,
          {
            backgroundColor: filled ? '#DCFCE7' : colors.surfaceMuted,
            borderColor: filled ? '#86EFAC' : colors.border,
          },
        ]}
      >
        <Ionicons
          name={filled ? 'checkmark-circle' : 'document-outline'}
          size={22}
          color={filled ? '#15803D' : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
          {req.name ?? humanType(req.document_type)}
          {req.required ? <Text style={{ color: palette.brand.red600 }}> *</Text> : null}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          {filled
            ? `${uploaded?.file_name ?? uploaded?.filename ?? 'Uploaded'}`
            : req.accepted_formats
            ? `Accepts: ${req.accepted_formats}`
            : 'Not uploaded yet'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {filled ? (
          <Pressable
            onPress={() => uploaded && openSignedDoc(uploaded.file_path!)}
            hitSlop={6}
            style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="eye-outline" size={18} color={colors.accent} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: filled ? colors.surfaceMuted : palette.brand.red600, borderColor: filled ? colors.border : palette.brand.red600 },
            uploading && { opacity: 0.6 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={filled ? colors.text : '#fff'} size="small" />
          ) : (
            <Text style={{ color: filled ? colors.text : '#fff', fontWeight: '700', fontSize: 12 }}>
              {filled ? 'Replace' : 'Upload'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function UploadedRow({ doc, isLast }: { doc: DocumentRow; isLast: boolean }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={() => doc.file_path && openSignedDoc(doc.file_path)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.docIcon, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Ionicons name="document-outline" size={22} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
          {doc.file_name || doc.filename || 'Untitled'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {humanType(doc.document_type)}
          {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

function humanType(t?: string | null): string {
  if (!t) return 'General'
  return t
    .replace(/^additional_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase())
}

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const styles = StyleSheet.create({
  groupHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  primaryCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  placeholderBox: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  filledBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.brand.red600,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
})
