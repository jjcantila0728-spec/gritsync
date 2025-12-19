import { useState, useEffect } from 'react'
import { 
  Mail, 
  Send, 
  Users, 
  FileText, 
  Settings,
  Plus,
  Loader2,
  Check,
  X,
  Eye,
  Wand2,
  RefreshCw
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import NewsletterBuilderNew from './AdminEmails/components/NewsletterBuilderNew'

interface NewsletterSubscriber {
  id: string
  email: string
  subscription_type: string
  is_active: boolean
  created_at: string
}

type TabType = 'send' | 'subscribers' | 'newsletter' | 'test'

export default function AdminEmailsPage() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('send')
  const [loading, setLoading] = useState(false)
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  
  const [sendForm, setSendForm] = useState({
    to: '',
    subject: '',
    html: '',
    text: ''
  })

  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    if (activeTab === 'subscribers') {
      loadSubscribers()
    }
  }, [activeTab])

  const loadSubscribers = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<NewsletterSubscriber[]>('/newsletter/subscribers')
      setSubscribers(data)
    } catch (error) {
      console.error('Error loading subscribers:', error)
      showToast('Failed to load subscribers', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!sendForm.to || !sendForm.subject) {
      showToast('Please fill in recipient and subject', 'warning')
      return
    }

    setLoading(true)
    try {
      await apiClient.post('/emails/send', {
        to: sendForm.to,
        subject: sendForm.subject,
        html: sendForm.html || undefined,
        text: sendForm.text || undefined
      })
      showToast('Email sent successfully!', 'success')
      setSendForm({ to: '', subject: '', html: '', text: '' })
    } catch (error: any) {
      showToast(error.message || 'Failed to send email', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      showToast('Please enter an email address', 'warning')
      return
    }

    setLoading(true)
    try {
      await apiClient.post('/emails/test', { email: testEmail })
      showToast('Test email sent!', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send test email', 'error')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'send' as TabType, label: 'Send Email', icon: Send },
    { id: 'subscribers' as TabType, label: 'Subscribers', icon: Users },
    { id: 'newsletter' as TabType, label: 'AI Newsletter', icon: Wand2 },
    { id: 'test' as TabType, label: 'Test Email', icon: Settings },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Mail className="h-8 w-8 text-red-600" />
          Email Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Send emails, manage subscribers, and create AI-powered newsletters
        </p>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {activeTab === 'send' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="h-5 w-5 text-red-600" />
              Send Custom Email
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={sendForm.to}
                  onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                  placeholder="recipient@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sendForm.subject}
                  onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                  placeholder="Email subject line"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                HTML Content
              </label>
              <textarea
                value={sendForm.html}
                onChange={(e) => setSendForm({ ...sendForm, html: e.target.value })}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono text-sm focus:ring-2 focus:ring-red-500"
                placeholder="<html>...</html>"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Plain Text (fallback)
              </label>
              <textarea
                value={sendForm.text}
                onChange={(e) => setSendForm({ ...sendForm, text: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                placeholder="Plain text version of the email"
              />
            </div>

            <button
              onClick={handleSendEmail}
              disabled={loading || !sendForm.to || !sendForm.subject}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition',
                loading || !sendForm.to || !sendForm.subject
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Send Email
            </button>
          </div>
        )}

        {activeTab === 'subscribers' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-red-600" />
                Newsletter Subscribers
              </h2>
              <button
                onClick={loadSubscribers}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-red-600" />
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading subscribers...</p>
              </div>
            ) : subscribers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No subscribers yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Subscribed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {subscribers.map((subscriber) => (
                      <tr key={subscriber.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{subscriber.email}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                            {subscriber.subscription_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {subscriber.is_active ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <Check className="h-4 w-4" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-500">
                              <X className="h-4 w-4" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(subscriber.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Total:</strong> {subscribers.length} subscribers
                ({subscribers.filter(s => s.is_active).length} active)
              </p>
            </div>
          </div>
        )}

        {activeTab === 'newsletter' && (
          <div className="p-6">
            <NewsletterBuilderNew showToast={showToast} />
          </div>
        )}

        {activeTab === 'test' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-red-600" />
              Test Email Configuration
            </h2>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Send a test email to verify your email configuration is working correctly.
              </p>
            </div>

            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Email Address
              </label>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                  placeholder="your@email.com"
                />
                <button
                  onClick={handleSendTestEmail}
                  disabled={loading || !testEmail}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition',
                    loading || !testEmail
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                  )}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  Send Test
                </button>
              </div>
            </div>

            <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Email Service Status</h3>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Resend integration is configured and active
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
