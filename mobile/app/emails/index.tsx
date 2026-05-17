import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/ErrorState'
import { SkeletonRow } from '@/components/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, radius, spacing, palette } from '@/theme'
import { emailsAPI, EmailLogRow } from '@/lib/services'
import { errorMessage } from '@/lib/api'

type Tab = 'inbox' | 'sent'

export default function EmailsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const [tab, setTab] = useState<Tab>('inbox')
  const [inbox, setInbox] = useState<EmailLogRow[]>([])
  const [sent, setSent] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [viewing, setViewing] = useState<EmailLogRow | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const [inboxRows, sentRows] = await Promise.all([
        emailsAPI.myReceived(50, 0),
        user.gritsync_email ? emailsAPI.sent(user.gritsync_email, 50) : Promise.resolve([]),
      ])
      setInbox(inboxRows)
      setSent(sentRows)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, user?.gritsync_email])

  useEffect(() => {
    void load()
  }, [load])

  const items = tab === 'inbox' ? inbox : sent
  const businessEmail = user?.gritsync_email

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      <View style={{ gap: spacing.lg }}>
        <PageHeader
          title="Emails"
          subtitle={
            businessEmail
              ? `Sending from ${businessEmail}`
              : "Your GritSync business email isn't set up yet — contact your advisor."
          }
          icon="mail"
          action={{ label: 'Compose', icon: 'create-outline', onPress: () => setComposeOpen(true) }}
        />

        <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <TabBtn label={`Inbox${inbox.length ? ` (${inbox.length})` : ''}`} active={tab === 'inbox'} onPress={() => setTab('inbox')} />
          <TabBtn label={`Sent${sent.length ? ` (${sent.length})` : ''}`} active={tab === 'sent'} onPress={() => setTab('sent')} />
        </View>

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : items.length === 0 ? (
          <ErrorState
            variant="empty"
            icon={tab === 'inbox' ? 'mail-open-outline' : 'paper-plane-outline'}
            title={tab === 'inbox' ? 'Inbox empty' : 'Nothing sent yet'}
            body={
              tab === 'inbox'
                ? 'Receipts, advisor notes, and system emails will appear here as they arrive.'
                : "When you send an email from your business address, you'll see it here."
            }
            retryLabel="Compose new"
            onRetry={() => setComposeOpen(true)}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {items.map((m) => <EmailListRow key={m.id} m={m} onPress={() => setViewing(m)} />)}
          </View>
        )}
      </View>

      <ComposeModal
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        from={businessEmail ?? 'no-reply@gritsync.com'}
        onSent={() => {
          setComposeOpen(false)
          void load()
        }}
      />
      <EmailViewer email={viewing} onClose={() => setViewing(null)} />
    </Screen>
  )
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabBtn,
        active && { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  )
}

function EmailListRow({ m, onPress }: { m: EmailLogRow; onPress: () => void }) {
  const { colors } = useTheme()
  const preview = stripHtml(m.body_text ?? m.body_html ?? '').slice(0, 100)
  const isClientEmail = !!m.sender_name && !m.sender_name.toLowerCase().includes('gritsync')
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: isClientEmail ? '#FEE2E2' : colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Ionicons name="mail-outline" size={20} color={palette.brand.red700} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>
            {m.sender_name || m.sender_email || 'GritSync'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {m.created_at ? formatRelative(m.created_at) : ''}
          </Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
          {m.subject ?? '(no subject)'}
        </Text>
        {preview ? (
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

function ComposeModal({
  visible,
  onClose,
  from,
  onSent,
}: {
  visible: boolean
  onClose: () => void
  from: string
  onSent: () => void
}) {
  const { colors } = useTheme()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      Alert.alert('Missing info', 'Add a recipient, subject, and message body.')
      return
    }
    setSending(true)
    try {
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">${escape(body).replace(/\n/g, '<br/>')}</div>`
      await emailsAPI.send({
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: subject.trim(),
        html,
        text: body,
        from,
      })
      setTo('')
      setSubject('')
      setBody('')
      onSent()
    } catch (e) {
      Alert.alert('Could not send', errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>New message</Text>
          <Pressable onPress={send} disabled={sending} hitSlop={10}>
            <Text style={{ color: palette.brand.red600, fontWeight: '800' }}>
              {sending ? 'Sending…' : 'Send'}
            </Text>
          </Pressable>
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={[styles.composeRow, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, width: 60 }}>From</Text>
            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
              {from}
            </Text>
          </View>
          <View style={[styles.composeRow, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, width: 60 }}>To</Text>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="recipient@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ flex: 1, color: colors.text, paddingVertical: 8 }}
            />
          </View>
          <View style={[styles.composeRow, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, width: 60 }}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.text, paddingVertical: 8 }}
            />
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write your message…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={{
              color: colors.text,
              minHeight: 240,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              fontSize: 15,
              backgroundColor: colors.surface,
            }}
          />
        </View>
      </View>
    </Modal>
  )
}

function EmailViewer({ email, onClose }: { email: EmailLogRow | null; onClose: () => void }) {
  const { colors } = useTheme()
  if (!email) return null
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Close</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Message</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
            {email.subject ?? '(no subject)'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            From: {email.sender_name || email.sender_email}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {email.created_at ? new Date(email.created_at).toLocaleString() : ''}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
            {stripHtml(email.body_text || email.body_html || '(no content)')}
          </Text>
        </View>
      </View>
    </Modal>
  )
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!isFinite(t)) return iso
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

const styles = StyleSheet.create({
  composeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.brand.red600,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
})
