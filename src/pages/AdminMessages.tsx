import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import { Send, MessageSquare, RefreshCw, User } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'

interface Conversation {
  client_id: string
  first_name: string
  last_name: string
  email: string
  last_subject: string | null
  last_message: string
  last_message_at: string
  last_sender_id: string
  unread_count: number
}

interface Message {
  id: string
  sender_id: string
  recipient_id: string | null
  subject: string | null
  body: string
  is_read: boolean
  created_at: string
  sender_first_name: string
  sender_last_name: string
  sender_role: string
}

function getAuthToken(): string | null {
  return localStorage.getItem('gritsync_token')
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAuthToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function AdminMessages() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [thread, setThread] = useState<Message[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isFirstMessage = thread.length === 0

  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoadingConvs(true)
      const data = await apiFetch('/api/messages')
      setConversations(data.data || [])
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load conversations', 'error')
    } finally {
      setLoadingConvs(false)
    }
  }

  const loadThread = async (clientId: string, silent = false) => {
    try {
      if (!silent) setLoadingThread(true)
      const data = await apiFetch(`/api/messages/${clientId}`)
      setThread(data.data || [])

      // Mark messages as read
      await apiFetch('/api/messages/read', {
        method: 'PATCH',
        body: JSON.stringify({ clientId }),
      })

      // Update conversation unread count locally
      setConversations((prev) =>
        prev.map((c) => (c.client_id === clientId ? { ...c, unread_count: 0 } : c))
      )

      // Update localStorage unread count
      if (user?.id) {
        const totalUnread = conversations
          .filter((c) => c.client_id !== clientId)
          .reduce((acc, c) => acc + Number(c.unread_count), 0)
        localStorage.setItem(`unreadMessagesCount_${user.id}`, JSON.stringify({ count: totalUnread, timestamp: Date.now() }))
        window.dispatchEvent(new Event('messagesUpdated'))
      }
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load thread', 'error')
    } finally {
      setLoadingThread(false)
    }
  }

  useEffect(() => {
    loadConversations()

    pollRef.current = setInterval(() => {
      loadConversations(true)
      if (selectedClientId) loadThread(selectedClientId, true)
    }, 30000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      setThread([])
      setNewSubject('')
      loadThread(selectedClientId)
    }
  }, [selectedClientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const handleSend = async () => {
    const body = newMessage.trim()
    if (!body || !selectedClientId) return

    setSending(true)
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          body,
          subject: newSubject.trim() || undefined,
          recipientId: selectedClientId,
        }),
      })
      setNewMessage('')
      if (isFirstMessage) setNewSubject('')
      await loadThread(selectedClientId, true)
      await loadConversations(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const selectedConversation = conversations.find((c) => c.client_id === selectedClientId)
  const conversationSubject = thread.find((m) => m.subject)?.subject || selectedConversation?.last_subject

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
            {/* Left panel: conversation list */}
            <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  <h1 className="text-base font-semibold text-gray-900 dark:text-white">Messages</h1>
                </div>
                <button
                  onClick={() => loadConversations()}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingConvs ? (
                  <div className="flex items-center justify-center h-40">
                    <Loading text="" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400 px-4 text-center">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No conversations yet.</p>
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const isSelected = conv.client_id === selectedClientId
                    const hasUnread = Number(conv.unread_count) > 0
                    return (
                      <button
                        key={conv.client_id}
                        onClick={() => setSelectedClientId(conv.client_id)}
                        className={cn(
                          'w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex gap-3',
                          isSelected && 'bg-primary-50 dark:bg-primary-900/20'
                        )}
                      >
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mt-0.5">
                          <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn('text-sm font-medium truncate text-gray-900 dark:text-white', hasUnread && 'font-semibold')}>
                              {conv.first_name} {conv.last_name}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                            </span>
                          </div>
                          {conv.last_subject && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate italic">{conv.last_subject}</p>
                          )}
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className={cn('text-xs truncate', hasUnread ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400')}>
                              {conv.last_message}
                            </p>
                            {hasUnread && (
                              <span className="flex-shrink-0 bg-primary-600 text-white text-xs font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                                {Number(conv.unread_count) > 99 ? '99+' : conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right panel: thread */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
              {!selectedClientId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              ) : (
                <>
                  {/* Thread header */}
                  <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedConversation?.first_name} {selectedConversation?.last_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedConversation?.email}
                        {conversationSubject && <span className="ml-2 italic">· {conversationSubject}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingThread ? (
                      <div className="flex items-center justify-center h-40">
                        <Loading text="Loading thread..." />
                      </div>
                    ) : thread.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                        <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No messages in this thread yet.</p>
                      </div>
                    ) : (
                      thread.map((msg) => {
                        const mine = msg.sender_id === user?.id
                        const senderLabel = mine
                          ? 'You'
                          : `${msg.sender_first_name} ${msg.sender_last_name}`

                        return (
                          <div
                            key={msg.id}
                            className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}
                          >
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-1">
                              {senderLabel} · {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                            </span>
                            {msg.subject && (
                              <span className={cn('text-xs font-semibold px-1', mine ? 'text-primary-300' : 'text-gray-600 dark:text-gray-300')}>
                                Re: {msg.subject}
                              </span>
                            )}
                            <div
                              className={cn(
                                'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words',
                                mine
                                  ? 'bg-primary-600 text-white rounded-br-sm'
                                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm border border-gray-200 dark:border-gray-700'
                              )}
                            >
                              {msg.body}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Compose box */}
                  <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2">
                    {isFirstMessage && (
                      <input
                        type="text"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder="Subject (optional)"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )}
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Reply… (Enter to send, Shift+Enter for new line)"
                        rows={2}
                        className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={handleSend}
                        disabled={sending || !newMessage.trim()}
                        className="flex-shrink-0 p-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                        title="Send"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
