import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { 
  FileText, 
  CreditCard, 
  Clock, 
  User,
  CheckCircle,
  AlertCircle,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: 'document_reminder' | 'payment_reminder' | 'timeline_update' | 'profile_completion' | 'general'
  title: string
  message: string
  read: boolean
  created_at: string
  application_id?: string
  link?: string
}

interface NotificationDropdownProps {
  notifications: Notification[]
  loading: boolean
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export function NotificationDropdown({
  notifications,
  loading,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationDropdownProps) {
  const navigate = useNavigate()

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'document_reminder':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'payment_reminder':
        return <CreditCard className="h-5 w-5 text-green-500" />
      case 'timeline_update':
        return <Clock className="h-5 w-5 text-purple-500" />
      case 'profile_completion':
        return <User className="h-5 w-5 text-orange-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }

    // Navigate to the appropriate page
    if (notification.link) {
      navigate(notification.link)
      onClose()
    } else if (notification.application_id) {
      navigate(`/applications/${notification.application_id}/timeline`)
      onClose()
    } else {
      // Default navigation based on type
      switch (notification.type) {
        case 'document_reminder':
          navigate('/documents')
          break
        case 'payment_reminder':
          if (notification.application_id) {
            navigate(`/applications/${notification.application_id}/timeline`)
          }
          break
        case 'profile_completion':
          navigate('/my-details')
          break
        case 'timeline_update':
          if (notification.application_id) {
            navigate(`/applications/${notification.application_id}/timeline`)
          }
          break
        default:
          break
      }
      onClose()
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] max-w-[calc(100vw-2rem)] sm:max-w-none rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-2xl z-50 max-h-[600px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              Loading notifications...
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
              <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              No notifications
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              You're all caught up!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer group",
                  !notification.read && "bg-primary-50/30 dark:bg-primary-900/10 border-l-4 border-l-primary-500"
                )}
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2",
                        !notification.read && "font-bold"
                      )}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="flex-shrink-0 h-2.5 w-2.5 bg-red-500 rounded-full mt-1 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                        {formatDate(notification.created_at)}
                      </p>
                      {!notification.read && (
                        <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                          • NEW
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - View All Link (optional) */}
      {notifications.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => {
              navigate('/notifications')
              onClose()
            }}
            className="w-full text-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors py-1"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  )
}

