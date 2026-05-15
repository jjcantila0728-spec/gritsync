import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import {
  Send, MessageSquare, RefreshCw, SquarePen, X, Search, ArrowLeft,
  Trash2, Pencil, Check, CheckCheck, Shield, Link2, Briefcase,
  Paperclip, Download, FileText, FileImage, FileVideo, FileAudio, FileArchive, Loader2,
  Megaphone, Users, Globe2,
} from 'lucide-react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { db } from '@/lib/api-client'

interface Attachment {
  path: string
  name: string
  type?: string | null
  size?: number | null
}

interface Conversation {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  is_active: boolean
  last_seen_at: string | null
  avatar_path?: string | null
  last_subject: string | null
  last_message: string
  last_attachments?: Attachment[] | null
  last_message_at: string
  last_sender_id: string
  unread_count: number | string
}

interface Message {
  id: string
  sender_id: string
  recipient_id: string | null
  subject: string | null
  body: string
  is_read: boolean
  read_at: string | null
  created_at: string
  edited_at: string | null
  attachments?: Attachment[] | null
  sender_first_name: string | null
  sender_last_name: string | null
  sender_role: string
  // client-side only
  pending?: boolean
  failed?: boolean
}

interface DirectoryUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  last_seen_at?: string | null
  avatar_path?: string | null
}

interface PartyInfo {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  is_active: boolean
  last_seen_at?: string | null
  avatar_path?: string | null
}

// A file that's currently being uploaded from the compose box, or has finished.
interface PendingUpload {
  localId: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'done' | 'error'
  path?: string
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
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

function displayName(p: { first_name?: string | null; last_name?: string | null; email?: string } | null | undefined): string {
  if (!p) return 'Unknown'
  const full = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  return full || p.email || 'Unknown'
}

function initials(p: { first_name?: string | null; last_name?: string | null; email?: string } | null | undefined): string {
  if (!p) return '?'
  const a = (p.first_name || '').trim()
  const b = (p.last_name || '').trim()
  if (a || b) return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() || a.charAt(0).toUpperCase()
  return (p.email || '?').charAt(0).toUpperCase()
}

// Deterministic avatar colour from a string id.
function avatarColor(id: string): string {
  const colors = [
    'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500', 'bg-violet-500',
    'bg-indigo-500', 'bg-blue-500', 'bg-sky-500', 'bg-cyan-500', 'bg-teal-500',
    'bg-emerald-500', 'bg-green-500', 'bg-lime-600', 'bg-amber-500', 'bg-orange-500',
  ]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return colors[h % colors.length]
}

const ONLINE_WINDOW_MS = 2 * 60 * 1000
function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  return !Number.isNaN(t) && Date.now() - t < ONLINE_WINDOW_MS
}
function presenceLabel(lastSeenAt: string | null | undefined): string | null {
  if (!lastSeenAt) return null
  if (isOnline(lastSeenAt)) return 'Active now'
  return `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`
}

// Build a same-origin URL for a stored file (avatar or message attachment).
function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const p = String(path).trim()
  if (!p) return null
  if (/^https?:\/\//i.test(p) || p.startsWith('/api/')) return p
  const token = getAuthToken()
  return `/api/storage/file?path=${encodeURIComponent(p.replace(/\\/g, '/'))}${token ? `&t=${encodeURIComponent(token)}` : ''}`
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i
const VIDEO_EXT_RE = /\.(mp4|mov|webm|mkv|avi|m4v)$/i
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|ogg|flac|aac)$/i
const ARCHIVE_EXT_RE = /\.(zip|rar|7z|tar|gz)$/i

function isImageAttachment(a: { name?: string; type?: string | null }): boolean {
  if (a.type && a.type.startsWith('image/') && !a.type.includes('svg')) return true
  // SVGs render fine in <img> too, but treat large ones cautiously; allow it.
  if (a.type && a.type === 'image/svg+xml') return true
  return IMAGE_EXT_RE.test(a.name || '')
}

function attachmentIcon(a: { name?: string; type?: string | null }) {
  const t = a.type || ''
  const n = a.name || ''
  if (t.startsWith('image/') || IMAGE_EXT_RE.test(n)) return FileImage
  if (t.startsWith('video/') || VIDEO_EXT_RE.test(n)) return FileVideo
  if (t.startsWith('audio/') || AUDIO_EXT_RE.test(n)) return FileAudio
  if (ARCHIVE_EXT_RE.test(n) || t.includes('zip') || t.includes('compressed')) return FileArchive
  return FileText
}

function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

function attachmentsPreviewLabel(atts?: Attachment[] | null): string {
  if (!atts || atts.length === 0) return ''
  if (atts.length === 1) return `📎 ${atts[0].name}`
  return `📎 ${atts.length} attachments`
}

const MAX_FILE_BYTES = 15 * 1024 * 1024 // matches the server's multer limit
const MAX_FILES_PER_MESSAGE = 10

function sanitizeFileName(name: string): string {
  const base = (name || 'file').split(/[\\/]/).pop() || 'file'
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file'
}

function Avatar({
  id, name, size = 'md', subtle = false, online = false, avatarPath,
}: {
  id: string
  name: { first_name?: string | null; last_name?: string | null; email?: string }
  size?: 'sm' | 'md' | 'lg'
  subtle?: boolean
  online?: boolean
  avatarPath?: string | null
}) {
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => { setImgFailed(false) }, [avatarPath])
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-9 h-9 text-xs'
  const dot = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  const src = !imgFailed ? storageUrl(avatarPath) : null
  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={initials(name)}
          onError={() => setImgFailed(true)}
          className={cn('rounded-full object-cover bg-gray-200 dark:bg-gray-700', sz)}
        />
      ) : (
        <div className={cn('rounded-full flex items-center justify-center font-semibold text-white', sz, subtle ? 'bg-gray-300 dark:bg-gray-600' : avatarColor(id))}>
          {initials(name)}
        </div>
      )}
      {online && (
        <span className={cn('absolute bottom-0 right-0 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900', dot)} title="Active now" />
      )}
    </div>
  )
}

function MessageAttachment({ attachment, mine, pending }: { attachment: Attachment; mine: boolean; pending: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  const url = storageUrl(attachment.path)
  const showImage = isImageAttachment(attachment) && !!url && !imgErr
  if (showImage) {
    return (
      <a
        href={url!}
        target="_blank"
        rel="noopener noreferrer"
        title={attachment.name}
        className={cn(
          'block rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 max-w-[260px] sm:max-w-[280px] hover:opacity-95 transition-opacity',
          pending && 'opacity-70',
          mine ? 'rounded-br-sm' : 'rounded-bl-sm'
        )}
      >
        <img
          src={url!}
          alt={attachment.name}
          onError={() => setImgErr(true)}
          className="block w-full max-h-[280px] object-cover bg-gray-100 dark:bg-gray-800"
        />
      </a>
    )
  }
  const Icon = attachmentIcon(attachment)
  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      title={`${attachment.name}${attachment.size ? ` · ${formatBytes(attachment.size)}` : ''}`}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-2xl text-sm border w-full max-w-[260px] sm:max-w-[280px] transition-colors',
        pending && 'opacity-70',
        mine
          ? 'bg-primary-600/95 hover:bg-primary-600 text-white border-primary-500 rounded-br-sm'
          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 rounded-bl-sm'
      )}
    >
      <span className={cn('flex-shrink-0 rounded-lg p-1.5', mine ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700')}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0 overflow-hidden">
        <span className="block truncate font-medium">{attachment.name}</span>
        {attachment.size ? <span className={cn('block text-[11px]', mine ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>{formatBytes(attachment.size)}</span> : null}
      </span>
      <Download className={cn('h-4 w-4 flex-shrink-0', mine ? 'text-white/80' : 'text-gray-400')} />
    </a>
  )
}

const ROLE_BADGE_META: Record<string, { label: string; className: string; icon: typeof Shield }> = {
  admin: { label: 'Admin', className: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300', icon: Shield },
  affiliate: { label: 'Affiliate', className: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', icon: Link2 },
  advisor: { label: 'Advisor', className: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300', icon: Briefcase },
}

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_BADGE_META[role]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full text-[10px] font-semibold px-1.5 py-0.5 leading-none', meta.className)}>
      <Icon className="h-2.5 w-2.5" /> {meta.label}
    </span>
  )
}

function dateLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

export function Messages() {
  const { user } = useAuth()
  const { can } = usePermissions()
  const { showToast } = useToast()
  const location = useLocation()

  const canBroadcast = can('messages.broadcast')
  const canCreateGroup = can('messages.create_group')
  const canStartBulk = canBroadcast || canCreateGroup

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convFilter, setConvFilter] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    (location.state as { userId?: string; clientId?: string } | null)?.userId
      ?? (location.state as { userId?: string; clientId?: string } | null)?.clientId
      ?? null
  )
  const [pendingPartyInfo, setPendingPartyInfo] = useState<PartyInfo | null>(null)
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null)
  const [thread, setThread] = useState<Message[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Attachment compose state
  const [attachmentUploads, setAttachmentUploads] = useState<PendingUpload[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const composeRef = useRef<HTMLTextAreaElement>(null)
  const selectedUserIdRef = useRef<string | null>(selectedUserId)
  selectedUserIdRef.current = selectedUserId

  // New-conversation / user-directory state
  const [showSearch, setShowSearch] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<DirectoryUser[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Broadcast / group-message composer (admins or users granted the permission)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [bcMode, setBcMode] = useState<'broadcast' | 'group'>('broadcast')
  const [bcAudience, setBcAudience] = useState<'all' | 'clients' | 'affiliates' | 'advisors'>('all')
  const [bcBody, setBcBody] = useState('')
  const [bcSending, setBcSending] = useState(false)
  const [bcQuery, setBcQuery] = useState('')
  const [bcResults, setBcResults] = useState<DirectoryUser[]>([])
  const [bcSelected, setBcSelected] = useState<Record<string, DirectoryUser>>({})
  const [bcSearching, setBcSearching] = useState(false)
  const bcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const realThread = useMemo(() => thread.filter((m) => !m.pending && !m.failed), [thread])

  // ---- Loaders ------------------------------------------------------------
  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConvs(true)
      const data = await apiFetch('/api/messages/conversations')
      setConversations(data.data || [])
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load conversations', 'error')
    } finally {
      setLoadingConvs(false)
    }
  }, [showToast])

  const refreshUnreadBadge = useCallback((convs: Conversation[]) => {
    if (!user?.id) return
    const total = convs.reduce((acc, c) => acc + Number(c.unread_count || 0), 0)
    localStorage.setItem(`unreadMessagesCount_${user.id}`, JSON.stringify({ count: total, timestamp: Date.now() }))
    window.dispatchEvent(new Event('messagesUpdated'))
  }, [user?.id])

  const markThreadRead = useCallback(async (otherId: string) => {
    try {
      await apiFetch('/api/messages/read', { method: 'PATCH', body: JSON.stringify({ userId: otherId }) })
      setConversations((prev) => {
        const next = prev.map((c) => (c.user_id === otherId ? { ...c, unread_count: 0 } : c))
        refreshUnreadBadge(next)
        return next
      })
    } catch {
      /* best effort */
    }
  }, [refreshUnreadBadge])

  const loadThread = useCallback(async (otherId: string, silent = false) => {
    try {
      if (!silent) setLoadingThread(true)
      const data = await apiFetch(`/api/messages/thread/${encodeURIComponent(otherId)}`)
      const incoming: Message[] = data.data || []
      // keep any locally pending/failed messages that aren't reflected server-side yet
      setThread((prev) => {
        const pending = prev.filter((m) => m.pending || m.failed)
        return [...incoming, ...pending]
      })
      if (data.user) {
        setPartyInfo(data.user)
        setPendingPartyInfo(null)
      }
      const hasUnreadFromOther = incoming.some((m) => m.sender_id === otherId && !m.is_read)
      if (hasUnreadFromOther) await markThreadRead(otherId)
    } catch (err: any) {
      if (!silent) showToast(err.message || 'Failed to load conversation', 'error')
    } finally {
      setLoadingThread(false)
    }
  }, [markThreadRead, showToast])

  const loadPartyInfo = useCallback(async (otherId: string) => {
    try {
      const data = await apiFetch(`/api/db/users?id=${encodeURIComponent(otherId)}&select=first_name%2Clast_name%2Cemail%2Crole%2Cis_active%2Clast_seen_at%2Cavatar_path&limit=1`)
      const rows = Array.isArray(data) ? data : data.data
      const u = rows?.[0]
      if (u) {
        setPendingPartyInfo({
          id: otherId,
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          email: u.email || '',
          role: u.role || 'client',
          is_active: u.is_active !== false,
          last_seen_at: u.last_seen_at ?? null,
          avatar_path: u.avatar_path ?? null,
        })
      }
    } catch {
      /* best effort */
    }
  }, [])

  // ---- Effects ------------------------------------------------------------
  useEffect(() => {
    loadConversations()
    pollRef.current = setInterval(() => {
      loadConversations(true)
      const sel = selectedUserIdRef.current
      if (sel) loadThread(sel, true)
    }, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => {
      loadConversations(true)
      const sel = selectedUserIdRef.current
      if (sel) loadThread(sel, true)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadConversations, loadThread])

  // When the selected conversation changes, load its thread
  useEffect(() => {
    if (!selectedUserId) {
      setThread([])
      setPartyInfo(null)
      return
    }
    setThread([])
    setEditingId(null)
    setAttachmentUploads([])
    const conv = conversations.find((c) => c.user_id === selectedUserId)
    if (conv) {
      setPartyInfo({
        id: conv.user_id, first_name: conv.first_name, last_name: conv.last_name,
        email: conv.email, role: conv.role, is_active: conv.is_active, last_seen_at: conv.last_seen_at,
        avatar_path: conv.avatar_path ?? null,
      })
      setPendingPartyInfo(null)
    }
    loadThread(selectedUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  // If a selected user isn't in the conversation list and we don't know them, fetch basic info
  useEffect(() => {
    if (!selectedUserId || loadingConvs) return
    const inList = conversations.some((c) => c.user_id === selectedUserId)
    if (!inList && !partyInfo && !pendingPartyInfo) loadPartyInfo(selectedUserId)
  }, [conversations, loadingConvs, selectedUserId, partyInfo, pendingPartyInfo, loadPartyInfo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const runUserSearch = useCallback(async (q: string) => {
    setSearchingUsers(true)
    try {
      const data = await apiFetch(`/api/messages/users?q=${encodeURIComponent(q)}`)
      setUserResults(data.data || [])
    } catch {
      setUserResults([])
    } finally {
      setSearchingUsers(false)
    }
  }, [])

  // New-conversation search panel
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
      // pre-populate with the directory
      void runUserSearch('')
    } else {
      setUserQuery('')
      setUserResults([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch])

  useEffect(() => {
    if (!showSearch) return
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => { void runUserSearch(userQuery.trim()) }, 250)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery])

  useEffect(() => {
    if (!showSearch) return
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSearch])

  // ---- Actions ------------------------------------------------------------
  const handleStartConversation = (u: DirectoryUser) => {
    setShowSearch(false)
    setPendingPartyInfo({
      id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role, is_active: true, last_seen_at: u.last_seen_at ?? null, avatar_path: u.avatar_path ?? null,
    })
    setPartyInfo(null)
    setSelectedUserId(u.id)
    setTimeout(() => composeRef.current?.focus(), 100)
  }

  // ---- Broadcast / group message ------------------------------------------
  const openBroadcast = (mode: 'broadcast' | 'group') => {
    setBcMode(mode === 'group' && canCreateGroup ? 'group' : (canBroadcast ? 'broadcast' : 'group'))
    setBcAudience('all')
    setBcBody('')
    setBcQuery('')
    setBcResults([])
    setBcSelected({})
    setShowBroadcast(true)
  }
  const closeBroadcast = () => { if (!bcSending) setShowBroadcast(false) }

  // Live-search the directory while the group picker is open
  useEffect(() => {
    if (!showBroadcast || bcMode !== 'group') return
    if (bcDebounceRef.current) clearTimeout(bcDebounceRef.current)
    bcDebounceRef.current = setTimeout(async () => {
      setBcSearching(true)
      try {
        const data = await apiFetch(`/api/messages/users?q=${encodeURIComponent(bcQuery.trim())}`)
        setBcResults(data.data || [])
      } catch { setBcResults([]) } finally { setBcSearching(false) }
    }, 250)
    return () => { if (bcDebounceRef.current) clearTimeout(bcDebounceRef.current) }
  }, [showBroadcast, bcMode, bcQuery])

  const toggleBcRecipient = (u: DirectoryUser) => {
    setBcSelected((prev) => {
      const next = { ...prev }
      if (next[u.id]) delete next[u.id]
      else next[u.id] = u
      return next
    })
  }

  const bcSelectedList = useMemo(() => Object.values(bcSelected), [bcSelected])

  const handleSendBroadcast = async () => {
    const body = bcBody.trim()
    if (!body || bcSending) return
    if (bcMode === 'group' && bcSelectedList.length === 0) {
      showToast('Pick at least one recipient', 'error')
      return
    }
    setBcSending(true)
    try {
      const payload: Record<string, unknown> = { body }
      if (bcMode === 'group') payload.recipientIds = bcSelectedList.map((u) => u.id)
      else payload.audience = bcAudience
      const res = await apiFetch('/api/messages/broadcast', { method: 'POST', body: JSON.stringify(payload) })
      const count = res?.count ?? 0
      showToast(count > 0 ? `Message sent to ${count} ${count === 1 ? 'person' : 'people'}` : 'No recipients matched', count > 0 ? 'success' : 'info')
      setShowBroadcast(false)
      await loadConversations(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to send', 'error')
    } finally {
      setBcSending(false)
    }
  }

  // ---- Attachments --------------------------------------------------------
  const attachmentUploadsRef = useRef<PendingUpload[]>(attachmentUploads)
  attachmentUploadsRef.current = attachmentUploads

  const handleFilesSelected = useCallback((fileList: FileList | File[] | null) => {
    if (!fileList) return
    const files = Array.from(fileList)
    if (files.length === 0) return

    const slotsLeft = MAX_FILES_PER_MESSAGE - attachmentUploadsRef.current.length
    if (slotsLeft <= 0) {
      showToast(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message`, 'error')
      return
    }

    const queued: { entry: PendingUpload; file: File }[] = []
    for (const f of files.slice(0, slotsLeft)) {
      if (f.size > MAX_FILE_BYTES) {
        showToast(`"${f.name}" is too large (max ${formatBytes(MAX_FILE_BYTES)})`, 'error')
        continue
      }
      const localId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${queued.length}`
      queued.push({ entry: { localId, name: f.name, size: f.size, type: f.type || 'application/octet-stream', status: 'uploading' }, file: f })
    }
    if (files.length > slotsLeft) showToast(`Only the first ${slotsLeft} file(s) were added (limit ${MAX_FILES_PER_MESSAGE})`, 'info')
    if (queued.length === 0) return

    setAttachmentUploads((prev) => [...prev, ...queued.map((q) => q.entry)])

    for (const { entry, file } of queued) {
      const path = `messages/${user?.id || 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`
      db.storage.from('messages').upload(path, file, { upsert: true })
        .then(({ error }: { error: { message: string } | null }) => {
          setAttachmentUploads((cur) => cur.map((u) =>
            u.localId === entry.localId
              ? (error ? { ...u, status: 'error' as const } : { ...u, status: 'done' as const, path })
              : u
          ))
          if (error) showToast(`Failed to upload "${file.name}": ${error.message}`, 'error')
        })
        .catch((e: any) => {
          setAttachmentUploads((cur) => cur.map((u) => u.localId === entry.localId ? { ...u, status: 'error' as const } : u))
          showToast(`Failed to upload "${file.name}": ${e?.message || 'upload error'}`, 'error')
        })
    }
  }, [showToast, user?.id])

  const removeUpload = (localId: string) => {
    setAttachmentUploads((prev) => prev.filter((u) => u.localId !== localId))
  }

  const uploadingCount = attachmentUploads.filter((u) => u.status === 'uploading').length
  const readyAttachments: Attachment[] = attachmentUploads
    .filter((u) => u.status === 'done' && u.path)
    .map((u) => ({ path: u.path!, name: u.name, type: u.type, size: u.size }))
  const canSend = !sending && uploadingCount === 0 && (newMessage.trim().length > 0 || readyAttachments.length > 0)

  const handleSend = async () => {
    const body = newMessage.trim()
    const atts = readyAttachments
    if ((!body && atts.length === 0) || !selectedUserId || sending || uploadingCount > 0) return

    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId, sender_id: user!.id, recipient_id: selectedUserId,
      subject: null, body, is_read: false, read_at: null,
      created_at: new Date().toISOString(), edited_at: null,
      attachments: atts.length ? atts : null,
      sender_first_name: user?.first_name ?? null, sender_last_name: user?.last_name ?? null,
      sender_role: user?.role || 'client', pending: true,
    }
    setThread((prev) => [...prev, optimistic])
    setNewMessage('')
    setAttachmentUploads([])
    setSending(true)
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ body, recipientId: selectedUserId, attachments: atts }),
      })
      // Drop the optimistic placeholder — the real message comes back from loadThread.
      setThread((prev) => prev.filter((m) => m.id !== tempId))
      await loadThread(selectedUserId, true)
      await loadConversations(true)
    } catch (err: any) {
      setThread((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)))
      showToast(err.message || 'Failed to send message', 'error')
    } finally {
      setSending(false)
      setTimeout(() => composeRef.current?.focus(), 0)
    }
  }

  const handleRetry = async (msg: Message) => {
    setThread((prev) => prev.filter((m) => m.id !== msg.id))
    setNewMessage(msg.body)
    if (msg.attachments && msg.attachments.length) {
      setAttachmentUploads(msg.attachments.map((a) => ({
        localId: `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: a.name, size: a.size || 0, type: a.type || 'application/octet-stream',
        status: 'done' as const, path: a.path,
      })))
    }
    setTimeout(() => composeRef.current?.focus(), 0)
  }

  const handleDelete = async (msg: Message) => {
    if (msg.pending || msg.failed) { setThread((prev) => prev.filter((m) => m.id !== msg.id)); return }
    if (!window.confirm('Delete this message? This removes it for everyone in the conversation.')) return
    const prev = thread
    setThread((p) => p.filter((m) => m.id !== msg.id))
    try {
      await apiFetch(`/api/messages/${msg.id}`, { method: 'DELETE' })
      await loadConversations(true)
    } catch (err: any) {
      setThread(prev)
      showToast(err.message || 'Failed to delete message', 'error')
    }
  }

  const startEdit = (msg: Message) => { setEditingId(msg.id); setEditText(msg.body) }
  const cancelEdit = () => { setEditingId(null); setEditText('') }
  const saveEdit = async (msg: Message) => {
    const body = editText.trim()
    if (!body || body === msg.body) { cancelEdit(); return }
    const prev = thread
    setThread((p) => p.map((m) => (m.id === msg.id ? { ...m, body, edited_at: new Date().toISOString() } : m)))
    cancelEdit()
    try {
      await apiFetch(`/api/messages/${msg.id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
      await loadConversations(true)
    } catch (err: any) {
      setThread(prev)
      showToast(err.message || 'Failed to edit message', 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ---- Derived ------------------------------------------------------------
  const filteredConvs = useMemo(() => {
    const q = convFilter.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) =>
      displayName(c).toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    )
  }, [conversations, convFilter])

  const activeParty: PartyInfo | null = partyInfo || pendingPartyInfo
  const lastMineRealMsg = useMemo(() => {
    for (let i = realThread.length - 1; i >= 0; i--) if (realThread[i].sender_id === user?.id) return realThread[i]
    return null
  }, [realThread, user?.id])

  const totalUnread = conversations.reduce((acc, c) => acc + Number(c.unread_count || 0), 0)

  // ---- Render -------------------------------------------------------------
  return (
    // h-[100dvh] (dynamic viewport height) instead of min-h-screen so the page
    // shrinks to the visible area when the mobile keyboard opens — otherwise
    // the page header & thread header get pushed off the top while typing.
    // Every flex parent in the chain carries min-h-0 so the inner messages
    // list is the *only* thing that scrolls.
    <div className="h-[100dvh] bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left panel: conversation list */}
            <div
              className={cn(
                'w-full md:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-hidden',
                selectedUserId ? 'hidden md:flex' : 'flex'
              )}
            >
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  {totalUnread > 0 && (
                    <span className="bg-primary-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center flex-shrink-0">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canStartBulk && (
                    <button
                      onClick={() => openBroadcast(canBroadcast ? 'broadcast' : 'group')}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title={canBroadcast && canCreateGroup ? 'Broadcast or group message' : canBroadcast ? 'Broadcast a message' : 'New group message'}
                    >
                      <Megaphone className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowSearch((v) => !v)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      showSearch
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                    title="New message"
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

              {/* New-conversation search panel */}
              {showSearch && (
                <div ref={searchRef} className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">New Message</span>
                    <button onClick={() => setShowSearch(false)} className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Search people by name or email…"
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    {searchingUsers ? (
                      <div className="flex items-center justify-center py-4"><Loading text="" /></div>
                    ) : userResults.length > 0 ? (
                      userResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleStartConversation(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <Avatar id={u.id} name={u} size="sm" online={isOnline(u.last_seen_at)} avatarPath={u.avatar_path} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                              {displayName(u)} <RoleBadge role={u.role} />
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 px-2">
                        {userQuery.trim() ? 'No users found' : 'No other users available'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Filter existing conversations */}
              {!showSearch && conversations.length > 0 && (
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={convFilter}
                      onChange={(e) => setConvFilter(e.target.value)}
                      placeholder="Search conversations…"
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {loadingConvs ? (
                  <div className="flex items-center justify-center h-40"><Loading text="" /></div>
                ) : filteredConvs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400 px-4 text-center gap-2">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-sm">{conversations.length === 0 ? 'No conversations yet.' : 'No conversations match your search.'}</p>
                    {conversations.length === 0 && (
                      <button onClick={() => setShowSearch(true)} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                        <SquarePen className="h-3.5 w-3.5" /> Start a conversation
                      </button>
                    )}
                  </div>
                ) : (
                  filteredConvs.map((conv) => {
                    const isSelected = conv.user_id === selectedUserId
                    const hasUnread = Number(conv.unread_count || 0) > 0
                    const isMine = conv.last_sender_id === user?.id
                    const preview = (conv.last_message && conv.last_message.trim())
                      ? conv.last_message
                      : (attachmentsPreviewLabel(conv.last_attachments) || 'Sent a message')
                    return (
                      <button
                        key={conv.user_id}
                        onClick={() => { setSelectedUserId(conv.user_id); setConvFilter('') }}
                        className={cn(
                          'w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex gap-3',
                          isSelected && 'bg-primary-50 dark:bg-primary-900/20'
                        )}
                      >
                        <Avatar id={conv.user_id} name={conv} size="md" online={isOnline(conv.last_seen_at)} avatarPath={conv.avatar_path} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn('text-sm truncate text-gray-900 dark:text-white flex items-center gap-1.5', hasUnread ? 'font-semibold' : 'font-medium')}>
                              {displayName(conv)} <RoleBadge role={conv.role} />
                            </span>
                            <span className="text-[11px] text-gray-400 flex-shrink-0">
                              {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className={cn('text-xs truncate', hasUnread ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400')}>
                              {isMine && <span className="text-gray-400">You: </span>}{preview}
                            </p>
                            {hasUnread && (
                              <span className="flex-shrink-0 bg-primary-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
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
            <div className={cn('flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950', selectedUserId ? 'flex' : 'hidden md:flex')}>
              {!selectedUserId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">Select a conversation to view messages</p>
                  <button onClick={() => setShowSearch(true)} className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                    <SquarePen className="h-3.5 w-3.5" /> Start a new conversation
                  </button>
                </div>
              ) : (
                <>
                  {/* Thread header — fixed at the top of the chat pane */}
                  <div className="flex-shrink-0 px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3">
                    <button onClick={() => setSelectedUserId(null)} className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Back">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    {activeParty
                      ? <Avatar id={activeParty.id} name={activeParty} size="md" online={isOnline(activeParty.last_seen_at)} avatarPath={activeParty.avatar_path} />
                      : <Avatar id={selectedUserId} name={{ email: '?' }} size="md" subtle />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                        {displayName(activeParty)} {activeParty && <RoleBadge role={activeParty.role} />}
                        {activeParty && !activeParty.is_active && (
                          <span className="text-[10px] font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 leading-none">Inactive</span>
                        )}
                      </p>
                      <p className="text-xs truncate flex items-center gap-1">
                        {activeParty && isOnline(activeParty.last_seen_at) ? (
                          <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active now
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">
                            {presenceLabel(activeParty?.last_seen_at) || activeParty?.email}
                          </span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => loadThread(selectedUserId, false)} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="Refresh conversation">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Messages — the only scrollable region in the chat pane */}
                  <div
                    className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-1"
                    onDragOver={(e) => { e.preventDefault(); if (!dragActive) setDragActive(true) }}
                    onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget === e.target) setDragActive(false) }}
                    onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFilesSelected(e.dataTransfer?.files) }}
                  >
                    {dragActive && (
                      <div className="absolute inset-2 z-10 rounded-xl border-2 border-dashed border-primary-400 bg-primary-500/10 dark:bg-primary-500/15 flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300 font-medium text-sm">
                          <Paperclip className="h-5 w-5" /> Drop files to attach
                        </div>
                      </div>
                    )}
                    {loadingThread && thread.length === 0 ? (
                      <div className="flex items-center justify-center h-40"><Loading text="Loading conversation..." /></div>
                    ) : thread.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400 gap-2">
                        <MessageSquare className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No messages yet. Say hello below.</p>
                      </div>
                    ) : (
                      thread.map((msg, i) => {
                        const mine = msg.sender_id === user?.id
                        const prev = thread[i - 1]
                        const showDate = !prev || dateLabel(new Date(prev.created_at)) !== dateLabel(new Date(msg.created_at))
                        const senderLabel = mine ? 'You' : `${msg.sender_first_name || ''} ${msg.sender_last_name || ''}`.trim() || displayName(activeParty)
                        const isLastMine = mine && lastMineRealMsg?.id === msg.id
                        const editing = editingId === msg.id

                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center justify-center my-3">
                                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-0.5">
                                  {dateLabel(new Date(msg.created_at))}
                                </span>
                              </div>
                            )}
                            <div className={cn('group flex flex-col gap-0.5 py-1', mine ? 'items-end' : 'items-start')}>
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 px-1">
                                {senderLabel} · {format(new Date(msg.created_at), 'h:mm a')}
                                {msg.edited_at && <span className="italic"> · edited</span>}
                              </span>
                              <div className={cn('flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%]', mine ? 'flex-row-reverse' : 'flex-row')}>
                                {editing ? (
                                  <div className="flex flex-col gap-1.5 w-full min-w-[220px]">
                                    <textarea
                                      autoFocus
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg) }
                                        if (e.key === 'Escape') cancelEdit()
                                      }}
                                      rows={2}
                                      className="w-full resize-none rounded-lg border border-primary-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <div className="flex gap-2 justify-end text-xs">
                                      <button onClick={cancelEdit} className="px-2 py-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                                      <button onClick={() => saveEdit(msg)} className="px-2 py-1 rounded-md bg-primary-600 text-white hover:bg-primary-700">Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={cn('flex flex-col gap-1.5 min-w-0', mine ? 'items-end' : 'items-start')}>
                                    {msg.body && (
                                      <div
                                        className={cn(
                                          'px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
                                          mine
                                            ? msg.failed
                                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-br-sm border border-red-300 dark:border-red-800'
                                              : 'bg-primary-600 text-white rounded-br-sm'
                                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm border border-gray-200 dark:border-gray-700',
                                          msg.pending && 'opacity-70'
                                        )}
                                      >
                                        {msg.body}
                                      </div>
                                    )}
                                    {(msg.attachments || []).map((a, ai) => (
                                      <MessageAttachment key={`${msg.id}-att-${ai}`} attachment={a} mine={mine} pending={!!msg.pending} />
                                    ))}
                                  </div>
                                )}
                                {/* hover actions for my own messages */}
                                {mine && !editing && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!msg.pending && !msg.failed && (
                                      <button onClick={() => startEdit(msg)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800" title="Edit">
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button onClick={() => handleDelete(msg)} className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800" title="Delete">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {/* status line for my messages */}
                              {mine && !editing && (msg.failed || msg.pending || isLastMine) && (
                                <span className={cn('text-[10px] px-1 flex items-center gap-1', msg.is_read && !msg.pending && !msg.failed ? 'text-primary-500 dark:text-primary-400 font-medium' : 'text-gray-400 dark:text-gray-500')}>
                                  {msg.failed ? (
                                    <button onClick={() => handleRetry(msg)} className="text-red-500 hover:underline">Failed — tap to retry</button>
                                  ) : msg.pending ? (
                                    <>Sending…</>
                                  ) : msg.is_read ? (
                                    <><CheckCheck className="h-3 w-3" /> Seen{msg.read_at ? ` ${format(new Date(msg.read_at), 'h:mm a')}` : ''}</>
                                  ) : (
                                    <><Check className="h-3 w-3" /> Delivered</>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Compose box — pinned to the bottom, never scrolls */}
                  <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2">
                    {/* Pending attachment chips */}
                    {attachmentUploads.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachmentUploads.map((u) => {
                          const Icon = u.status === 'uploading' ? Loader2 : u.status === 'error' ? X : attachmentIcon(u)
                          return (
                            <div
                              key={u.localId}
                              className={cn(
                                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs max-w-[220px]',
                                u.status === 'error'
                                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                              )}
                              title={u.name}
                            >
                              <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', u.status === 'uploading' && 'animate-spin')} />
                              <span className="truncate">{u.name}</span>
                              <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{u.status === 'uploading' ? 'uploading…' : u.status === 'error' ? 'failed' : formatBytes(u.size)}</span>
                              <button onClick={() => removeUpload(u.localId)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Remove">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 items-end">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => { handleFilesSelected(e.target.files); e.currentTarget.value = '' }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={attachmentUploads.length >= MAX_FILES_PER_MESSAGE}
                        className="flex-shrink-0 p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Attach files (any type, up to 15 MB each)"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <textarea
                        ref={composeRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={(e) => {
                          const files = Array.from(e.clipboardData?.files || [])
                          if (files.length) { e.preventDefault(); handleFilesSelected(files) }
                        }}
                        placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
                        rows={2}
                        className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!canSend}
                        className="flex-shrink-0 p-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                        title={uploadingCount > 0 ? 'Waiting for uploads to finish…' : 'Send'}
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

      {/* Broadcast / group-message composer */}
      <Modal
        isOpen={showBroadcast}
        onClose={closeBroadcast}
        title={bcMode === 'group' ? 'New group message' : 'Broadcast a message'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Mode switch (only when the user can do both) */}
          {canBroadcast && canCreateGroup && (
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setBcMode('broadcast')}
                className={cn('px-3 py-1.5 flex items-center gap-1.5', bcMode === 'broadcast' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700')}
              >
                <Megaphone className="h-3.5 w-3.5" /> Broadcast
              </button>
              <button
                type="button"
                onClick={() => setBcMode('group')}
                className={cn('px-3 py-1.5 flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700', bcMode === 'group' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700')}
              >
                <Users className="h-3.5 w-3.5" /> Group
              </button>
            </div>
          )}

          {bcMode === 'broadcast' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Audience</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { id: 'all', label: 'Everyone', icon: Globe2 },
                  { id: 'clients', label: 'All clients', icon: Users },
                  { id: 'affiliates', label: 'All affiliates', icon: Link2 },
                  { id: 'advisors', label: 'All advisors', icon: Briefcase },
                ] as const).map((opt) => {
                  const Icon = opt.icon
                  const active = bcAudience === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBcAudience(opt.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                        active
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" /> {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Each recipient gets this as an individual message — they can reply to you privately.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Recipients {bcSelectedList.length > 0 && <span className="text-gray-400 font-normal">· {bcSelectedList.length} selected</span>}
              </label>
              {bcSelectedList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {bcSelectedList.map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs pl-1 pr-1.5 py-0.5">
                      <Avatar id={u.id} name={u} size="sm" avatarPath={u.avatar_path} />
                      <span className="font-medium">{displayName(u)}</span>
                      <button type="button" onClick={() => toggleBcRecipient(u)} className="hover:text-primary-900 dark:hover:text-primary-100"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={bcQuery}
                  onChange={(e) => setBcQuery(e.target.value)}
                  placeholder="Search people by name or email…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {bcSearching ? (
                  <div className="flex items-center justify-center py-4"><Loading text="" /></div>
                ) : bcResults.length > 0 ? (
                  bcResults.map((u) => {
                    const selected = !!bcSelected[u.id]
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleBcRecipient(u)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                      >
                        <Avatar id={u.id} name={u} size="sm" online={isOnline(u.last_seen_at)} avatarPath={u.avatar_path} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">{displayName(u)} <RoleBadge role={u.role} /></p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                        </div>
                        <span className={cn('h-4 w-4 rounded border flex items-center justify-center flex-shrink-0', selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-gray-600')}>
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 px-2">{bcQuery.trim() ? 'No users found' : 'No other users available'}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message <span className="text-red-500">*</span></label>
            <textarea
              value={bcBody}
              onChange={(e) => setBcBody(e.target.value)}
              rows={4}
              placeholder="Write your message…"
              className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeBroadcast} disabled={bcSending} className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">Cancel</button>
            <button
              type="button"
              onClick={handleSendBroadcast}
              disabled={bcSending || !bcBody.trim() || (bcMode === 'group' && bcSelectedList.length === 0)}
              className="px-4 py-2 rounded-lg text-sm bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {bcSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {bcSending
                ? 'Sending…'
                : bcMode === 'group'
                  ? (bcSelectedList.length === 0 ? 'Send group message' : `Send to ${bcSelectedList.length} ${bcSelectedList.length === 1 ? 'person' : 'people'}`)
                  : 'Send broadcast'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
