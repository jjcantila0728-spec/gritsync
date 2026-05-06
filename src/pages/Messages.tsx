import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import { Send, MessageSquare, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'

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

export function Messages() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isFirstMessage = messages.length === 0

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await apiFetch('/api/messages')
      setMessages(data.data || [])

      // Mark messages as read
      await apiFetch('/api/messages/read', { method: 'PATCH', body: JSON.stringify({}) })

      // Update unread count in localStorage
      if (user?.id) {
        localStorage.setItem(`unreadMessagesCount_${user.id}`, JSON.stringify({ count: 0, timestamp: Date.now() }))
        window.dispatchEvent(new Event('messagesUpdated'))
      }
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load messages', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()

    pollRef.current = setInterval(() => loadMessages(true), 30000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const body = newMessage.trim()
    if (!body) return

    setSending(true)
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          body,
          subject: newSubject.trim() || undefined,
        }),
      })
      setNewMessage('')
      if (isFirstMessage) setNewSubject('')
      await loadMessages(true)
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

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id

  // Get the conversation subject from the first message
  const conversationSubject = messages.find((m) => m.subject)?.subject

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 gap-4">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Messages</h1>
                  {conversationSubject && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{conversationSubject}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => loadMessages()}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Thread container */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden min-h-0" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 260px)' }}>
              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loading text="Loading messages..." />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                    <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">No messages yet. Start the conversation below.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const mine = isMyMessage(msg)
                    const senderLabel = mine
                      ? 'You'
                      : msg.sender_role === 'admin'
                      ? `${msg.sender_first_name} ${msg.sender_last_name} (GritSync)`
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
                            'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words',
                            mine
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
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
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2">
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
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
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
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
