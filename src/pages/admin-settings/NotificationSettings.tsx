import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Bell, Save, Mail, Settings as SettingsIcon, Send, Plus, Edit2, Trash2, Power, PowerOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { useSettings } from './useSettings'
import { sendTestEmail } from '@/lib/email-service'
import { useAuth } from '@/contexts/AuthContext'
import { adminAPI } from '@/lib/api'

interface NotificationType {
  id: string
  key: string
  name: string
  description: string | null
  category: 'email' | 'reminder' | 'greeting' | 'system'
  enabled: boolean
  default_enabled: boolean
  config: Record<string, any>
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export function NotificationSettings() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [activeTab] = useState('email-config')
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingNotification, setEditingNotification] = useState<NotificationType | null>(null)
  const [deletingNotification, setDeletingNotification] = useState<string | null>(null)

  // Email configuration settings
  const { settings, setSettings, loading, saveSettings } = useSettings(
    {
      emailServiceProvider: 'resend',
      resendApiKey: '',
      emailFrom: 'noreply@gritsync.com',
      emailFromName: 'GritSync',
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: 'true',
      emailNotificationsEnabled: true,
    },
    (data) => ({
      emailServiceProvider: data.emailServiceProvider || 'resend',
      resendApiKey: data.resendApiKey || '',
      emailFrom: data.emailFrom || 'noreply@gritsync.com',
      emailFromName: data.emailFromName || 'GritSync',
      smtpHost: data.smtpHost || '',
      smtpPort: data.smtpPort || '587',
      smtpUser: data.smtpUser || '',
      smtpPassword: data.smtpPassword || '',
      smtpSecure: data.smtpSecure || 'true',
      emailNotificationsEnabled: data.emailNotificationsEnabled === 'true' || (typeof data.emailNotificationsEnabled === 'boolean' && data.emailNotificationsEnabled) || data.emailNotificationsEnabled === undefined,
    })
  )

  // Load notification types
  useEffect(() => {
    loadNotificationTypes()
  }, [])

  async function loadNotificationTypes() {
    try {
      setLoadingNotifications(true)
      const types = await adminAPI.getNotificationTypes()
      const typedTypes = (Array.isArray(types) ? types : []) as any[]
      setNotificationTypes(typedTypes)
    } catch (error: any) {
      console.error('Error loading notification types:', error)
      // If table doesn't exist yet, show empty list (migration not run)
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        showToast('Notification types table not found. Please run the migration first.', 'warning')
        setNotificationTypes([])
      } else {
        showToast('Failed to load notifications', 'error')
      }
    } finally {
      setLoadingNotifications(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSettings(settings)
      showToast('Settings saved successfully!', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!user?.email) {
      showToast('No email address found. Please ensure you are logged in.', 'error')
      return
    }

    setTestingEmail(true)
    try {
      const success = await sendTestEmail(user.email)
      if (success) {
        showToast('Test email sent successfully! Please check your inbox.', 'success')
      } else {
        showToast('Failed to send test email. Please check your email configuration.', 'error')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to send test email', 'error')
    } finally {
      setTestingEmail(false)
    }
  }

  const handleToggleNotification = async (id: string, enabled: boolean) => {
    try {
      await adminAPI.updateNotificationType(id, { enabled: !enabled })
      await loadNotificationTypes()
      showToast(`Notification ${!enabled ? 'enabled' : 'disabled'} successfully`, 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to update notification', 'error')
    }
  }

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingNotification(id)
      await adminAPI.deleteNotificationType(id)
      await loadNotificationTypes()
      showToast('Notification deleted successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to delete notification', 'error')
    } finally {
      setDeletingNotification(null)
    }
  }

  const handleCreateNotification = async (formData: {
    key: string
    name: string
    description: string
    category: 'email' | 'reminder' | 'greeting' | 'system'
    enabled: boolean
    icon: string
  }) => {
    try {
      await adminAPI.createNotificationType({
        ...formData,
        default_enabled: formData.enabled,
        config: {},
        sort_order: notificationTypes.length,
      })
      await loadNotificationTypes()
      setShowCreateModal(false)
      showToast('Notification created successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to create notification', 'error')
    }
  }

  const handleUpdateNotification = async (id: string, updates: {
    name?: string
    description?: string
    enabled?: boolean
    icon?: string
    config?: Record<string, any>
  }) => {
    try {
      await adminAPI.updateNotificationType(id, updates)
      await loadNotificationTypes()
      if (showEditModal) {
        setShowEditModal(false)
        setEditingNotification(null)
      }
      showToast('Notification updated successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to update notification', 'error')
    }
  }

  // Sync notification types with settings table for backward compatibility
  useEffect(() => {
    if (notificationTypes.length > 0) {
      // Update settings table with notification type states
      const updateSettings = async () => {
        try {
          const settingsToUpdate: Record<string, any> = {}
          
          // Sync email notification settings
          notificationTypes.forEach(nt => {
            if (nt.category === 'email') {
              settingsToUpdate[nt.key] = nt.enabled.toString()
            }
          })
          
          // Update master email notifications enabled
          const emailNotifications = notificationTypes.filter(nt => nt.category === 'email' && nt.enabled)
          settingsToUpdate.emailNotificationsEnabled = (emailNotifications.length > 0).toString()
          
          if (Object.keys(settingsToUpdate).length > 0) {
            await adminAPI.saveSettings(settingsToUpdate)
          }
        } catch (error) {
          console.error('Failed to sync notification settings:', error)
        }
      }
      
      updateSettings()
    }
  }, [notificationTypes])

  if (loading) {
    return (
      <div className="p-6">
        <Loading text="Loading settings..." />
      </div>
    )
  }

  // Group notifications by category
  const notificationsByCategory = {
    email: notificationTypes.filter(nt => nt.category === 'email'),
    reminder: notificationTypes.filter(nt => nt.category === 'reminder'),
    greeting: notificationTypes.filter(nt => nt.category === 'greeting'),
    system: notificationTypes.filter(nt => nt.category === 'system'),
  }

  const tabs = [
    {
      id: 'email-config',
      label: 'Email Configuration',
      icon: Mail,
      content: (
        <EmailConfigTab
          settings={settings}
          setSettings={setSettings}
          user={user}
          testingEmail={testingEmail}
          onTestEmail={handleTestEmail}
        />
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      content: (
        <NotificationsManagementTab
          notifications={notificationTypes}
          loading={loadingNotifications}
          onToggle={handleToggleNotification}
          onDelete={handleDeleteNotification}
          onEdit={(nt: NotificationType) => {
            setEditingNotification(nt)
            setShowEditModal(true)
          }}
          onCreate={() => setShowCreateModal(true)}
          deletingId={deletingNotification}
        />
      ),
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: SettingsIcon,
      content: (
        <RemindersTab
          notifications={notificationsByCategory.reminder}
          loading={loadingNotifications}
          onToggle={handleToggleNotification}
          onDelete={handleDeleteNotification}
          onEdit={(nt: NotificationType) => {
            setEditingNotification(nt)
            setShowEditModal(true)
          }}
          onCreate={() => setShowCreateModal(true)}
          deletingId={deletingNotification}
          onUpdateNotification={handleUpdateNotification}
        />
      ),
    },
    {
      id: 'greetings',
      label: 'Greetings',
      icon: SettingsIcon,
      content: (
        <GreetingsTab
          notifications={notificationsByCategory.greeting}
          loading={loadingNotifications}
          onUpdateNotification={handleUpdateNotification}
          onToggle={handleToggleNotification}
          onDelete={handleDeleteNotification}
          onEdit={(nt: NotificationType) => {
            setEditingNotification(nt)
            setShowEditModal(true)
          }}
          onCreate={() => setShowCreateModal(true)}
          deletingId={deletingNotification}
        />
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Email & Notification Settings
          </h2>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      <Tabs tabs={tabs} defaultTab={activeTab} />

      {/* Create Notification Modal */}
      {showCreateModal && (
        <CreateNotificationModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateNotification}
        />
      )}

      {/* Edit Notification Modal */}
      {showEditModal && editingNotification && (
        <EditNotificationModal
          notification={editingNotification}
          onClose={() => {
            setShowEditModal(false)
            setEditingNotification(null)
          }}
          onUpdate={(updates: { name?: string; description?: string; enabled?: boolean; icon?: string; config?: Record<string, any> }) => handleUpdateNotification(editingNotification.id, updates)}
        />
      )}
    </div>
  )
}

// Email Configuration Tab
function EmailConfigTab({ settings, setSettings, user, testingEmail, onTestEmail }: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email Service Provider
          </label>
          <select
            value={settings.emailServiceProvider}
            onChange={(e) => setSettings({ ...settings, emailServiceProvider: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="resend">Resend (Recommended)</option>
            <option value="smtp">SMTP</option>
            <option value="sendgrid">SendGrid</option>
          </select>
        </div>

        {settings.emailServiceProvider === 'resend' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resend API Key
            </label>
            <input
              type="password"
              value={settings.resendApiKey}
              onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
              placeholder="re_..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">resend.com</a>
            </p>
          </div>
        )}

        {settings.emailServiceProvider === 'smtp' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SMTP Port
                </label>
                <input
                  type="text"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                  placeholder="587"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                SMTP Username
              </label>
              <input
                type="text"
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                placeholder="your-email@gmail.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                SMTP Password
              </label>
              <input
                type="password"
                value={settings.smtpPassword}
                onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.smtpSecure === 'true'}
                onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked ? 'true' : 'false' })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label className="text-xs text-gray-700 dark:text-gray-300">
                Use TLS/SSL
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Email Address
            </label>
            <input
              type="email"
              value={settings.emailFrom}
              onChange={(e) => setSettings({ ...settings, emailFrom: e.target.value })}
              placeholder="noreply@gritsync.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Name
            </label>
            <input
              type="text"
              value={settings.emailFromName}
              onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })}
              placeholder="GritSync"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onTestEmail}
            disabled={testingEmail || !user?.email}
            variant="outline"
            className="w-full"
          >
            {testingEmail ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending Test Email...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Send a test email to {user?.email || 'your email'} to verify your configuration
          </p>
        </div>
      </div>
    </div>
  )
}

// Notifications Management Tab
function NotificationsManagementTab({ notifications, loading, onToggle, onDelete, onEdit, onCreate, deletingId }: any) {
  const emailNotifications = notifications
    .filter((n: NotificationType) => n.category === 'email')
    .sort((a: NotificationType, b: NotificationType) => {
      // Sort by sort_order first, then by name
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return a.name.localeCompare(b.name)
    })

  if (loading) {
    return <Loading text="Loading notifications..." />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Email Notifications
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage email notification types ({emailNotifications.length} configured)
          </p>
        </div>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Notification
        </Button>
      </div>

      <div className="space-y-2">
        {emailNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No email notifications configured</p>
            <Button onClick={onCreate} variant="outline" size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Notification
            </Button>
          </div>
        ) : (
          emailNotifications.map((notification: NotificationType) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
              deleting={deletingId === notification.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Reminders Tab
function RemindersTab({ notifications, loading, onToggle, onDelete, onEdit, onCreate, deletingId, onUpdateNotification }: any) {
  if (loading) {
    return <Loading text="Loading reminders..." />
  }

  // Sort reminders by sort_order, then by name
  const sortedReminders = [...notifications].sort((a: NotificationType, b: NotificationType) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order
    }
    return a.name.localeCompare(b.name)
  })

  const profileReminder = notifications.find((n: NotificationType) => n.key === 'profileReminder')
  const reminderConfig = profileReminder?.config || {}
  const [localConfig, setLocalConfig] = useState({
    interval: reminderConfig.interval || 24,
    messages: reminderConfig.messages || {
      '0': 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!',
      '20': 'Your profile is {completion}% complete. Add more details to make your applications faster!',
      '40': 'You\'re {completion}% done with your profile. Keep going to complete it!',
      '60': 'Great progress! Your profile is {completion}% complete. Just a few more details needed!',
      '80': 'Almost there! Your profile is {completion}% complete. Finish the remaining details!',
    },
  })

  useEffect(() => {
    if (profileReminder) {
      const config = profileReminder.config || {}
      setLocalConfig({
        interval: config.interval || 24,
        messages: config.messages || {
          '0': 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!',
          '20': 'Your profile is {completion}% complete. Add more details to make your applications faster!',
          '40': 'You\'re {completion}% done with your profile. Keep going to complete it!',
          '60': 'Great progress! Your profile is {completion}% complete. Just a few more details needed!',
          '80': 'Almost there! Your profile is {completion}% complete. Finish the remaining details!',
        },
      })
    }
  }, [profileReminder])

  const handleUpdateConfig = async (updates: any) => {
    if (!profileReminder) return
    
    const newConfig = { ...reminderConfig, ...updates }
    try {
      await onUpdateNotification(profileReminder.id, { config: newConfig })
      setLocalConfig(prev => ({ ...prev, ...updates }))
    } catch (error) {
      console.error('Failed to update reminder config:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Reminder Notifications
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage reminder notification types ({sortedReminders.length} configured)
          </p>
        </div>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Reminder
        </Button>
      </div>

      <div className="space-y-4">
        {sortedReminders.map((notification: NotificationType) => (
          <div key={notification.id} className="space-y-3">
            <NotificationCard
              notification={notification}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
              deleting={deletingId === notification.id}
            />
            
            {/* Show configuration for profile reminder */}
            {notification.key === 'profileReminder' && notification.enabled && (
              <div className="ml-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reminder Interval (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={localConfig.interval}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 24
                      setLocalConfig(prev => ({ ...prev, interval: newValue }))
                      handleUpdateConfig({ interval: newValue })
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    How often to send reminders (1-168 hours)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Reminder Messages by Completion Level
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Use {'{completion}'} as a placeholder for the completion percentage
                  </p>
                  
                  {['0', '20', '40', '60', '80'].map((level) => {
                    const levelNum = parseInt(level)
                    const nextLevel = levelNum === 80 ? 100 : levelNum + 20
                    return (
                      <div key={level}>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {levelNum}-{nextLevel - 1}% Complete
                        </label>
                        <textarea
                          value={localConfig.messages[level] || ''}
                          onChange={(e) => {
                            const newMessages = { ...localConfig.messages, [level]: e.target.value }
                            setLocalConfig(prev => ({ ...prev, messages: newMessages }))
                            handleUpdateConfig({ messages: newMessages })
                          }}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {sortedReminders.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No reminder notifications configured</p>
            <Button onClick={onCreate} variant="outline" size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Reminder
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Greetings Tab
function GreetingsTab({ notifications, loading, onUpdateNotification, onToggle, onDelete, onEdit, onCreate, deletingId }: any) {
  // Sort greetings by sort_order, then by name
  const sortedGreetings = [...notifications].sort((a: NotificationType, b: NotificationType) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order
    }
    return a.name.localeCompare(b.name)
  })

  const greetingNotification = notifications.find((n: NotificationType) => n.key === 'birthdayGreeting')
  const greetingConfig = greetingNotification?.config || {}
  const [localConfig, setLocalConfig] = useState({
    customEnabled: greetingConfig.customEnabled || false,
    morning: greetingConfig.morning || 'Good morning',
    afternoon: greetingConfig.afternoon || 'Good afternoon',
    evening: greetingConfig.evening || 'Good evening',
  })

  useEffect(() => {
    if (greetingNotification) {
      const config = greetingNotification.config || {}
      setLocalConfig({
        customEnabled: config.customEnabled || false,
        morning: config.morning || 'Good morning',
        afternoon: config.afternoon || 'Good afternoon',
        evening: config.evening || 'Good evening',
      })
    }
  }, [greetingNotification])

  if (loading) {
    return <Loading text="Loading greetings..." />
  }

  const handleUpdateConfig = async (updates: any) => {
    if (!greetingNotification) return
    
    const newConfig = { ...greetingConfig, ...updates }
    try {
      await onUpdateNotification(greetingNotification.id, { config: newConfig })
      setLocalConfig(prev => ({ ...prev, ...updates }))
    } catch (error) {
      console.error('Failed to update greeting config:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Greeting Notifications
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage greeting notification types ({sortedGreetings.length} configured)
          </p>
        </div>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Greeting
        </Button>
      </div>

      {/* Show all greeting notifications */}
      {sortedGreetings.length > 0 ? (
        <div className="space-y-4">
          {sortedGreetings.map((notification: NotificationType) => (
            <div key={notification.id} className="space-y-3">
              <NotificationCard
                notification={notification}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                deleting={deletingId === notification.id}
              />
              
              {/* Show configuration for birthday greeting */}
              {notification.key === 'birthdayGreeting' && (
                <div className="ml-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Birthday Greeting Configuration
                  </h4>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Use Custom Greetings
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Override default time-based greetings with custom messages
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.customEnabled}
                        onChange={(e) => {
                          const newValue = e.target.checked
                          setLocalConfig(prev => ({ ...prev, customEnabled: newValue }))
                          handleUpdateConfig({ customEnabled: newValue })
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Morning Greeting (before 12:00 PM)
                      </label>
                      <input
                        type="text"
                        value={localConfig.morning}
                        onChange={(e) => {
                          const newValue = e.target.value
                          setLocalConfig(prev => ({ ...prev, morning: newValue }))
                          handleUpdateConfig({ morning: newValue })
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Good morning"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Afternoon Greeting (12:00 PM - 6:00 PM)
                      </label>
                      <input
                        type="text"
                        value={localConfig.afternoon}
                        onChange={(e) => {
                          const newValue = e.target.value
                          setLocalConfig(prev => ({ ...prev, afternoon: newValue }))
                          handleUpdateConfig({ afternoon: newValue })
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Good afternoon"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Evening Greeting (after 6:00 PM)
                      </label>
                      <input
                        type="text"
                        value={localConfig.evening}
                        onChange={(e) => {
                          const newValue = e.target.value
                          setLocalConfig(prev => ({ ...prev, evening: newValue }))
                          handleUpdateConfig({ evening: newValue })
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Good evening"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No greeting notifications configured</p>
          <Button onClick={onCreate} variant="outline" size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create First Greeting
          </Button>
        </div>
      )}
    </div>
  )
}

// Notification Card Component
function NotificationCard({ notification, onToggle, onDelete, onEdit, deleting }: any) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-2xl mt-1">
            {notification.icon || '🔔'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {notification.name}
              </h4>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                notification.enabled
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {notification.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            {notification.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {notification.description}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Key: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{notification.key}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(notification.id, notification.enabled)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={notification.enabled ? 'Disable' : 'Enable'}
          >
            {notification.enabled ? (
              <Power className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <PowerOff className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => onEdit(notification)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(notification.id)}
            disabled={deleting}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Create Notification Modal
function CreateNotificationModal({ onClose, onCreate }: any) {
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    category: 'email' as 'email' | 'reminder' | 'greeting' | 'system',
    enabled: true,
    icon: '🔔',
  })
  const [creating, setCreating] = useState(false)
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.key || !formData.name) {
      showToast('Key and name are required', 'error')
      return
    }

    setCreating(true)
    try {
      await onCreate(formData)
    } catch (error: any) {
      showToast(error.message || 'Failed to create notification', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Create New Notification" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notification Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            placeholder="emailNewFeature"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Unique identifier (no spaces, use camelCase)
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notification Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="New Feature Notification"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            placeholder="Describe what this notification does..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          >
            <option value="email">Email</option>
            <option value="reminder">Reminder</option>
            <option value="greeting">Greeting</option>
            <option value="system">System</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon (Emoji)
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="🔔"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label className="text-xs text-gray-700 dark:text-gray-300">
            Enable this notification by default
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Notification'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Edit Notification Modal
function EditNotificationModal({ notification, onClose, onUpdate }: any) {
  const [formData, setFormData] = useState({
    name: notification.name,
    description: notification.description || '',
    enabled: notification.enabled,
    icon: notification.icon || '🔔',
  })
  const [updating, setUpdating] = useState(false)
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      showToast('Name is required', 'error')
      return
    }

    setUpdating(true)
    try {
      await onUpdate(formData)
    } catch (error: any) {
      showToast(error.message || 'Failed to update notification', 'error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Notification" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notification Key
          </label>
          <input
            type="text"
            value={notification.key}
            disabled
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Key cannot be changed after creation
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notification Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon (Emoji)
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label className="text-xs text-gray-700 dark:text-gray-300">
            Enable this notification
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={updating}>
            {updating ? 'Updating...' : 'Update Notification'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
