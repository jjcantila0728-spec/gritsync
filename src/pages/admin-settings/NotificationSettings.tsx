import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Bell, Save, Clock, MessageSquare, ChevronDown, ChevronUp, Mail, Settings as SettingsIcon } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { useSettings } from './useSettings'

export function NotificationSettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    email: true,
    reminders: true,
    greetings: true,
  })
  const { settings, setSettings, loading, saveSettings } = useSettings(
    {
      emailNotificationsEnabled: true,
      emailTimelineUpdates: true,
      emailStatusChanges: true,
      emailPaymentUpdates: true,
      // Reminders
      remindersEnabled: true,
      profileReminderEnabled: true,
      profileReminderInterval: '24',
      profileReminderMessage0: 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!',
      profileReminderMessage20: 'Your profile is {completion}% complete. Add more details to make your applications faster!',
      profileReminderMessage40: 'You\'re {completion}% done with your profile. Keep going to complete it!',
      profileReminderMessage60: 'Great progress! Your profile is {completion}% complete. Just a few more details needed!',
      profileReminderMessage80: 'Almost there! Your profile is {completion}% complete. Finish the remaining details!',
      // Greetings
      greetingMorning: 'Good morning',
      greetingAfternoon: 'Good afternoon',
      greetingEvening: 'Good evening',
      greetingCustomEnabled: false,
      // Email Configuration
      emailServiceProvider: 'resend', // 'resend', 'smtp', 'sendgrid'
      resendApiKey: '',
      emailFrom: 'noreply@gritsync.com',
      emailFromName: 'GritSync',
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: 'true',
    },
    (data) => ({
      emailNotificationsEnabled: data.emailNotificationsEnabled === 'true' || data.emailNotificationsEnabled === true || data.emailNotificationsEnabled === undefined,
      emailTimelineUpdates: data.emailTimelineUpdates === 'true' || data.emailTimelineUpdates === true || data.emailTimelineUpdates === undefined,
      emailStatusChanges: data.emailStatusChanges === 'true' || data.emailStatusChanges === true || data.emailStatusChanges === undefined,
      emailPaymentUpdates: data.emailPaymentUpdates === 'true' || data.emailPaymentUpdates === true || data.emailPaymentUpdates === undefined,
      // Reminders
      remindersEnabled: data.remindersEnabled === 'true' || data.remindersEnabled === true || data.remindersEnabled === undefined,
      profileReminderEnabled: data.profileReminderEnabled === 'true' || data.profileReminderEnabled === true || data.profileReminderEnabled === undefined,
      profileReminderInterval: data.profileReminderInterval || '24',
      profileReminderMessage0: data.profileReminderMessage0 || 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!',
      profileReminderMessage20: data.profileReminderMessage20 || 'Your profile is {completion}% complete. Add more details to make your applications faster!',
      profileReminderMessage40: data.profileReminderMessage40 || 'You\'re {completion}% done with your profile. Keep going to complete it!',
      profileReminderMessage60: data.profileReminderMessage60 || 'Great progress! Your profile is {completion}% complete. Just a few more details needed!',
      profileReminderMessage80: data.profileReminderMessage80 || 'Almost there! Your profile is {completion}% complete. Finish the remaining details!',
      // Greetings
      greetingMorning: data.greetingMorning || 'Good morning',
      greetingAfternoon: data.greetingAfternoon || 'Good afternoon',
      greetingEvening: data.greetingEvening || 'Good evening',
      greetingCustomEnabled: data.greetingCustomEnabled === 'true' || data.greetingCustomEnabled === true,
      // Email Configuration
      emailServiceProvider: data.emailServiceProvider || 'resend',
      resendApiKey: data.resendApiKey || '',
      emailFrom: data.emailFrom || 'noreply@gritsync.com',
      emailFromName: data.emailFromName || 'GritSync',
      smtpHost: data.smtpHost || '',
      smtpPort: data.smtpPort || '587',
      smtpUser: data.smtpUser || '',
      smtpPassword: data.smtpPassword || '',
      smtpSecure: data.smtpSecure || 'true',
    })
  )

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

  if (loading) {
    return (
      <div className="p-6">
        <Loading text="Loading settings..." />
      </div>
    )
  }

  const toggleSection = (section: 'reminders' | 'greetings') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Email & Notification Settings
        </h2>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Email Configuration Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Email Configuration
              </h3>
            </div>
            <button
              onClick={() => toggleSection('email')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {expandedSections.email ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </div>

          {expandedSections.email && (
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Choose your email service provider
                </p>
              </div>

              {settings.emailServiceProvider === 'resend' && (
                <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
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
                </div>
              )}

              {settings.emailServiceProvider === 'smtp' && (
                <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
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
            </div>
          )}
        </div>

        {/* Email Notifications Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Email Notifications
          </h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Email Notifications
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Master switch for all email notifications
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotificationsEnabled}
                onChange={(e) => setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {settings.emailNotificationsEnabled && (
            <div className="space-y-2 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Timeline Updates
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Notify users when application timeline steps are updated
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailTimelineUpdates}
                    onChange={(e) => setSettings({ ...settings, emailTimelineUpdates: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status Changes
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Notify users when application status changes
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailStatusChanges}
                    onChange={(e) => setSettings({ ...settings, emailStatusChanges: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Payment Updates
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Notify users about payment status and receipts
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailPaymentUpdates}
                    onChange={(e) => setSettings({ ...settings, emailPaymentUpdates: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Reminders Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Reminders
              </h3>
            </div>
            <button
              onClick={() => toggleSection('reminders')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {expandedSections.reminders ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </div>

          {expandedSections.reminders && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              {/* Master Reminders Toggle */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable Reminders
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Master switch for all reminder notifications
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.remindersEnabled}
                    onChange={(e) => setSettings({ ...settings, remindersEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {settings.remindersEnabled && (
                <div className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
                  {/* Profile Completion Reminder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Profile Completion Reminder
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Remind users to complete their profile
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.profileReminderEnabled}
                          onChange={(e) => setSettings({ ...settings, profileReminderEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    {settings.profileReminderEnabled && (
                      <div className="space-y-3 pl-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Reminder Interval (hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="168"
                            value={settings.profileReminderInterval}
                            onChange={(e) => setSettings({ ...settings, profileReminderInterval: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="24"
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
                          
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                0-19% Complete
                              </label>
                              <textarea
                                value={settings.profileReminderMessage0}
                                onChange={(e) => setSettings({ ...settings, profileReminderMessage0: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                20-39% Complete
                              </label>
                              <textarea
                                value={settings.profileReminderMessage20}
                                onChange={(e) => setSettings({ ...settings, profileReminderMessage20: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                40-59% Complete
                              </label>
                              <textarea
                                value={settings.profileReminderMessage40}
                                onChange={(e) => setSettings({ ...settings, profileReminderMessage40: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                60-79% Complete
                              </label>
                              <textarea
                                value={settings.profileReminderMessage60}
                                onChange={(e) => setSettings({ ...settings, profileReminderMessage60: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                80-99% Complete
                              </label>
                              <textarea
                                value={settings.profileReminderMessage80}
                                onChange={(e) => setSettings({ ...settings, profileReminderMessage80: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Greetings Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Greetings
              </h3>
            </div>
            <button
              onClick={() => toggleSection('greetings')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {expandedSections.greetings ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </div>

          {expandedSections.greetings && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg mb-4">
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
                    checked={settings.greetingCustomEnabled}
                    onChange={(e) => setSettings({ ...settings, greetingCustomEnabled: e.target.checked })}
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
                    value={settings.greetingMorning}
                    onChange={(e) => setSettings({ ...settings, greetingMorning: e.target.value })}
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
                    value={settings.greetingAfternoon}
                    onChange={(e) => setSettings({ ...settings, greetingAfternoon: e.target.value })}
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
                    value={settings.greetingEvening}
                    onChange={(e) => setSettings({ ...settings, greetingEvening: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Good evening"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
          >
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
      </div>
    </div>
  )
}

