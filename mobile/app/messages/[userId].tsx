import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, palette, radius, spacing } from '@/theme'
import { messagesAPI, MessageRow } from '@/lib/services'
import { errorMessage } from '@/lib/api'

export default function MessageThreadScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { user } = useAuth()
  const { colors } = useTheme()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [other, setOther] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<MessageRow> | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const { messages: rows, user: u } = await messagesAPI.thread(userId)
      setMessages(rows)
      setOther(u)
      const unread = rows.filter((m) => !m.is_read && m.sender_id !== user?.id).map((m) => m.id)
      if (unread.length > 0) {
        try {
          await messagesAPI.markRead(unread)
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [userId, user?.id])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToEnd({ animated: false })
        } catch {
          // ignore
        }
      }, 50)
    }
  }, [messages.length])

  async function onSend() {
    const text = draft.trim()
    if (!text || !userId) return
    setSending(true)
    try {
      const created = await messagesAPI.send({ recipientId: userId, body: text })
      setMessages((cur) => [...cur, created])
      setDraft('')
    } catch (e) {
      Alert.alert('Could not send', errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  const title =
    other && (other.first_name || other.last_name)
      ? [other.first_name, other.last_name].filter(Boolean).join(' ')
      : other?.email || 'Conversation'

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ListEmptyComponent={
            loading ? (
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
                Loading…
              </Text>
            ) : (
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
                Say hello — your advisor will reply as soon as they can.
              </Text>
            )
          }
          renderItem={({ item }) => <Bubble msg={item} mine={item.sender_id === user?.id} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <View
          style={[
            styles.composer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Write a message"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
              },
            ]}
          />
          <Pressable
            onPress={onSend}
            disabled={sending || !draft.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: palette.brand.red600 },
              (sending || !draft.trim()) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Bubble({ msg, mine }: { msg: MessageRow; mine: boolean }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
      }}
    >
      <View
        style={{
          backgroundColor: mine ? palette.brand.red600 : colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.lg,
          borderBottomRightRadius: mine ? 4 : radius.lg,
          borderBottomLeftRadius: mine ? radius.lg : 4,
        }}
      >
        {msg.subject ? (
          <Text style={{ fontWeight: '800', marginBottom: 4, color: mine ? '#fff' : colors.text }}>
            {msg.subject}
          </Text>
        ) : null}
        <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15 }}>{msg.body ?? ''}</Text>
      </View>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          marginTop: 2,
          textAlign: mine ? 'right' : 'left',
        }}
      >
        {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
