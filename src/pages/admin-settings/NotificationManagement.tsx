import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { Bell, Search, Filter, CheckCircle, Send, Calendar, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { sendNotificationEmail } from '@/lib/email-service'
import { notificationsAPI } from '@/lib/api-client'

interface Notification {
  id: string
  user_id: string
  application_id: string | null
  type: 'timeline_update' | 'status_change' | 'payment' | 'general'
  title: string
  message: string
  read: boolean
  created_at: string
  user?: {
    email: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
  }
}

export function NotificationManagement() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRead, setFilterRead] = useState<string>('all')
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin()) return
    fetchNotifications()
  }, [isAdmin])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const data = await notificationsAPI.getAllAdmin()
      setNotifications((data || []) as Notification[])
    } catch (error: any) {
      console.error('Error fetching notifications:', error)
      showToast('Failed to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
      showToast('Notification marked as read', 'success')
    } catch (error: any) {
      showToast('Failed to update notification', 'error')
    }
  }

  const handleSendTestEmail = async (notification: Notification) => {
    if (!notification.user?.email) {
      showToast('User email not found', 'error')
      return
    }

    try {
      setSendingEmail(notification.id)
      
      const userName = notification.user.full_name || 
                      (notification.user.first_name && notification.user.last_name
                        ? `${notification.user.first_name} ${notification.user.last_name}`
                        : notification.user.first_name || 'User')

      await sendNotificationEmail(
        notification.user.email,
        notification.type,
        {
          userName,
          title: `[TEST] ${notification.title}`,
          message: notification.message,
          applicationId: notification.application_id || undefined,
        }
      )

      showToast('Test email sent successfully', 'success')
    } catch (error: any) {
      console.error('Error sending test email:', error)
      showToast('Failed to send test email', 'error')
    } finally {
      setSendingEmail(null)
    }
  }

  const filteredNotifications = notifications.filter(notif => {
    const matchesSearch = 
      notif.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || notif.type === filterType
    const matchesRead = 
      filterRead === 'all' || 
      (filterRead === 'read' && notif.read) ||
      (filterRead === 'unread' && !notif.read)

    return matchesSearch && matchesType && matchesRead
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'timeline_update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'status_change':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'payment':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'general':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'timeline_update':
        return '📋'
      case 'status_change':
        return '✅'
      case 'payment':
        return '💳'
      case 'general':
        return '📢'
      default:
        return '🔔'
    }
  }

  if (!isAdmin()) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 sm:pt-24 lg:ml-64">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Bell className="h-6 w-6" />
                Notification Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View and manage all system notifications
              </p>
            </div>

            <Card className="mb-6 p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">All Types</option>
                    <option value="timeline_update">Timeline Updates</option>
                    <option value="status_change">Status Changes</option>
                    <option value="payment">Payments</option>
                    <option value="general">General</option>
                  </select>
                  <select
                    value={filterRead}
                    onChange={(e) => setFilterRead(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">All Status</option>
                    <option value="read">Read</option>
                    <option value="unread">Unread</option>
                  </select>
                </div>
              </div>
            </Card>

            {loading ? (
              <Loading />
            ) : filteredNotifications.length === 0 ? (
              <Card className="p-8 text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No notifications found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || filterType !== 'all' || filterRead !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Notifications will appear here'}
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`p-4 ${!notification.read ? 'border-l-4 border-l-primary-500' : ''}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{getTypeIcon(notification.type)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(notification.type)}`}>
                            {notification.type.replace('_', ' ')}
                          </span>
                          {!notification.read && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                          {notification.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          {notification.user && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {notification.user.full_name || notification.user.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!notification.read && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Read
                          </Button>
                        )}
                        {notification.user?.email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendTestEmail(notification)}
                            disabled={sendingEmail === notification.id}
                          >
                            <Send className={`h-4 w-4 mr-1 ${sendingEmail === notification.id ? 'animate-pulse' : ''}`} />
                            {sendingEmail === notification.id ? 'Sending...' : 'Test Email'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
