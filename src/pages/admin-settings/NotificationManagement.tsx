import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import { Bell, Search, Filter, Mail, CheckCircle, XCircle, Eye, Send, Calendar, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { sendNotificationEmail } from '@/lib/email-service'

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
  const { user, isAdmin } = useAuth()
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
      
      // Fetch notifications with user information
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          user:users!notifications_user_id_fkey (
            email,
            full_name,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Transform data to include user info
      const notificationsWithUser = (data || []).map((notif: any) => ({
        ...notif,
        user: Array.isArray(notif.user) ? notif.user[0] : notif.user,
      }))

      setNotifications(notificationsWithUser)
    } catch (error: any) {
      console.error('Error fetching notifications:', error)
      showToast('Failed to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

      if (error) throw error

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
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                Access denied. Admin privileges required.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <Loading text="Loading notifications..." />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Notification Management
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and monitor all system notifications
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <div className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notifications, users, emails..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="timeline_update">Timeline Updates</option>
                    <option value="status_change">Status Changes</option>
                    <option value="payment">Payments</option>
                    <option value="general">General</option>
                  </select>
                </div>

                {/* Read Status Filter */}
                <div>
                  <select
                    value={filterRead}
                    onChange={(e) => setFilterRead(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="read">Read</option>
                    <option value="unread">Unread</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Notifications List */}
          <Card>
            <div className="p-4">
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </div>

              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No notifications found
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-lg border ${
                        notif.read
                          ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          : 'bg-white dark:bg-gray-900 border-primary-200 dark:border-primary-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{getTypeIcon(notif.type)}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(notif.type)}`}>
                              {notif.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            {!notif.read && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                                New
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {notif.title}
                          </h3>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {notif.message}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            {notif.user && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>
                                  {notif.user.full_name || 
                                   (notif.user.first_name && notif.user.last_name
                                     ? `${notif.user.first_name} ${notif.user.last_name}`
                                     : notif.user.first_name || 'Unknown')}
                                </span>
                                {notif.user.email && (
                                  <span className="ml-1">({notif.user.email})</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(notif.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!notif.read && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsRead(notif.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Read
                            </Button>
                          )}
                          {notif.user?.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendTestEmail(notif)}
                              disabled={sendingEmail === notif.id}
                            >
                              {sendingEmail === notif.id ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-1" />
                                  Test Email
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </main>
      </div>
    </div>
  )
}

