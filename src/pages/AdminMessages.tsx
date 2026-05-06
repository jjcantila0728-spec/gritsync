import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import { Send, MessageSquare, RefreshCw, User, SquarePen, X, Search } from 'lucide-react'
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

interface ClientResult {
  id: string
  first_name: string
  last_name: string
  email: string
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
  const location = useLocation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    (location.state as { clientId?: string } | null)?.clientId ?? null
  )
  const [pendingClientInfo, setPendingClientInfo] = useState<{ first_name: string; last_name: string; email: string } | null>(null)
  const [thread, setThread] = useState<Message[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // New conversation / client search state
  const [showSearch, setShowSearch] = useState(false)
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientResult[]>([])
  const [searchingClients, setSearchingClients] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const loadClientInfo = async (clientId: string) => {
    try {
      const data = await apiFetch(`/api/db/users?id=${encodeURIComponent(clientId)}&select=first_name%2Clast_name%2Cemail&limit=1`)
      const rows = Array.isArray(data) ? data : data.data
      const u = rows?.[0]
      if (u) {
        setPendingClientInfo({
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          email: u.email || '',
        })
      }
    } catch {
      // Best-effort — silently ignore
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
      // Only clear pendingClientInfo if this client is already in the conversation list
      // (we have their info from there). If they're not in the list, keep any info
      // that was just set by handleSelectNewClient so the header doesn't flicker.
      const alreadyInList = conversations.some((c) => c.client_id === selectedClientId)
      if (alreadyInList) setPendingClientInfo(null)
      loadThread(selectedClientId)
    }
  }, [selectedClientId])

  // When conversations load, if the selected client isn't in the list, fetch their basic info
  useEffect(() => {
    if (!selectedClientId || loadingConvs) return
    const inList = conversations.some((c) => c.client_id === selectedClientId)
    if (!inList && !pendingClientInfo) {
      loadClientInfo(selectedClientId)
    }
  }, [conversations, loadingConvs, selectedClientId, pendingClientInfo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  // Focus search input when panel opens
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setClientQuery('')
      setClientResults([])
    }
  }, [showSearch])

  // Debounced client search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!clientQuery.trim()) {
      setClientResults([])
      return
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchingClients(true)
      try {
        const data = await apiFetch(`/api/messages/clients?q=${encodeURIComponent(clientQuery.trim())}`)
        setClientResults(data.data || [])
      } catch {
        setClientResults([])
      } finally {
        setSearchingClients(false)
      }
    }, 300)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [clientQuery])

  // Close search panel when clicking outside
  useEffect(() => {
    if (!showSearch) return
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSearch])

  const handleSelectNewClient = (client: ClientResult) => {
    setShowSearch(false)
    setPendingClientInfo({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
    })
    setSelectedClientId(client.id)
  }

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
  const displayClient = selectedConversation
    ? { first_name: selectedConversation.first_name, last_name: selectedConversation.last_name, email: selectedConversation.email }
    : pendingClientInfo

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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowSearch((v) => !v)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      showSearch
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                    title="New conversation"
                  >
                    <SquarePen className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => loadConversations()}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Client search panel */}
              {showSearch && (
                <div ref={searchRef} className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">New Conversation</span>
                    <button
                      onClick={() => setShowSearch(false)}
                      className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Search results */}
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    {searchingClients ? (
                      <div className="flex items-center justify-center py-4">
                        <Loading text="" />
                      </div>
                    ) : clientQuery.trim() && clientResults.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 px-2">No clients found</p>
                    ) : clientResults.length > 0 ? (
                      clientResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectNewClient(c)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {c.first_name} {c.last_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.email}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 px-2">Type to search clients</p>
                    )}
                  </div>
                </div>
              )}

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
                  <button
                    onClick={() => setShowSearch(true)}
                    className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <SquarePen className="h-3.5 w-3.5" />
                    Start a new conversation
                  </button>
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
                        {displayClient ? `${displayClient.first_name} ${displayClient.last_name}`.trim() || 'Client' : 'Client'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {displayClient?.email}
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
                        <p className="text-sm">No messages yet. Send the first message below.</p>
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
