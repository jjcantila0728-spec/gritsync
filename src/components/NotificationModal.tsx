import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  FileText,
  CreditCard,
  Clock,
  User,
  AlertCircle,
  Bell,
  X,
  Trash2,
  ChevronLeft,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NotificationItem {
  id: string
  type: 'document_reminder' | 'payment_reminder' | 'timeline_update' | 'profile_completion' | 'general'
  title: string
  message: string
  read: boolean
  created_at: string
  application_id?: string
  link?: string
}

interface NotificationModalProps {
  mode: 'single' | 'all'
  notification?: NotificationItem
  notifications?: NotificationItem[]
  unreadCount?: number
  onClose: () => void
  onDelete: (id: string) => void
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead?: () => void
  onClearAll?: () => void
}

function getNotificationIcon(type: string, size: 'sm' | 'lg' = 'sm') {
  const cls = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'
  switch (type) {
    case 'document_reminder':
      return <FileText className={cn(cls, 'text-blue-500')} />
    case 'payment_reminder':
      return <CreditCard className={cn(cls, 'text-green-500')} />
    case 'timeline_update':
      return <Clock className={cn(cls, 'text-purple-500')} />
    case 'profile_completion':
      return <User className={cn(cls, 'text-orange-500')} />
    default:
      return <AlertCircle className={cn(cls, 'text-gray-500')} />
  }
}

function getTypeBadgeColor(type: string) {
  switch (type) {
    case 'document_reminder': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'payment_reminder': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    case 'timeline_update': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    case 'profile_completion': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'document_reminder': return 'Document'
    case 'payment_reminder': return 'Payment'
    case 'timeline_update': return 'Timeline'
    case 'profile_completion': return 'Profile'
    default: return 'General'
  }
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'Recently'
  }
}

function formatFullDate(dateString: string) {
  try {
    return format(new Date(dateString), 'MMMM d, yyyy • h:mm a')
  } catch {
    return ''
  }
}

export function NotificationModal({
  mode,
  notification,
  notifications = [],
  unreadCount = 0,
  onClose,
  onDelete,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
}: NotificationModalProps) {
  const [selected, setSelected] = useState<NotificationItem | null>(
    mode === 'single' ? (notification ?? null) : null
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = 'unset' }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected && mode === 'all') {
          setSelected(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, mode, onClose])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDelete(id)
      if (selected?.id === id) {
        if (mode === 'single') {
          onClose()
        } else {
          setSelected(null)
        }
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.read) {
      onMarkAsRead(notif.id)
    }
    setSelected(notif)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose()
    }
  }

  const currentNotification = mode === 'single' ? notification : selected

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">

        {/* ── DETAIL VIEW (single notification) ── */}
        {currentNotification ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 flex-shrink-0">
              {mode === 'all' && (
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                  Notification Detail
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Type badge + read indicator */}
              <div className="flex items-center gap-2 mb-4">
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', getTypeBadgeColor(currentNotification.type))}>
                  {getTypeLabel(currentNotification.type)}
                </span>
                {!currentNotification.read && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                    Unread
                  </span>
                )}
                {currentNotification.read && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Read
                  </span>
                )}
              </div>

              {/* Icon + title */}
              <div className="flex items-start gap-4 mb-4">
                <div className={cn(
                  'p-3 rounded-xl flex-shrink-0',
                  !currentNotification.read
                    ? 'bg-primary-100 dark:bg-primary-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                )}>
                  {getNotificationIcon(currentNotification.type, 'lg')}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {currentNotification.title}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatFullDate(currentNotification.created_at)}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 mb-2">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {currentNotification.message}
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 flex-shrink-0">
              <button
                onClick={() => handleDelete(currentNotification.id)}
                disabled={deletingId === currentNotification.id}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingId === currentNotification.id ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={mode === 'all' ? () => setSelected(null) : onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          /* ── LIST VIEW (all notifications) ── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  All Notifications
                </h2>
                {unreadCount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {unreadCount} unread
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && onMarkAllAsRead && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && onClearAll && (
                  <button
                    onClick={onClearAll}
                    className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No notifications</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'flex items-start gap-3 px-5 py-4 cursor-pointer group transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50',
                        !notif.read && 'bg-primary-50/40 dark:bg-primary-900/10 border-l-4 border-l-primary-500'
                      )}
                      onClick={() => handleItemClick(notif)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            'text-sm text-gray-900 dark:text-gray-100 truncate',
                            !notif.read ? 'font-bold' : 'font-medium'
                          )}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                          {formatDate(notif.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(notif.id) }}
                        disabled={deletingId === notif.id}
                        className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors py-1"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
