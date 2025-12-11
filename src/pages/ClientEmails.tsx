/**
 * Client Emails Page - Client email management system
 * Features:
 * - View sent emails (client's own)
 * - Compose and send emails (from client's email address)
 * - View received emails (inbox)
 * - Email templates (read-only)
 * - Client restrictions: can only use their own email address
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { 
  Mail, 
  Send, 
  RefreshCw, 
  Search, 
  Filter, 
  Download,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  X,
  FileText,
  Edit,
  Image as ImageIcon,
} from 'lucide-react'
import { emailLogsAPI, sendEmailWithLogging, EmailLog } from '@/lib/email-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { emailTemplatesAPI, EmailTemplate } from '@/lib/email-templates-api'
import { emailSignaturesAPI, EmailSignature } from '@/lib/email-signatures-api'
import { resendInboxAPI, ReceivedEmail } from '@/lib/resend-inbox-api'
import { emailAddressesAPI, EmailAddress } from '@/lib/email-addresses-api'
import { businessLogosAPI, BusinessLogo } from '@/lib/email-signatures-api'

type Tab = 'inbox' | 'sent' | 'templates'

export function ClientEmails() {
  const { user, isClient } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const getInitialTab = (): Tab => {
    const pathParts = location.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && ['inbox', 'sent', 'templates'].includes(lastPart)) {
      return lastPart as Tab
    }
    const hash = location.hash.replace('#', '')
    if (hash && ['inbox', 'sent', 'templates'].includes(hash)) {
      return hash as Tab
    }
    return 'inbox'
  }
  
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab())
  const [loading, setLoading] = useState(true)
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [receivedEmails, setReceivedEmails] = useState<any[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)
  const [selectedReceivedEmail, setSelectedReceivedEmail] = useState<any | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(false)
  const [clientEmailAddress, setClientEmailAddress] = useState<EmailAddress | null>(null)
  
  // Email signatures state
  const [emailSignatures, setEmailSignatures] = useState<EmailSignature[]>([])
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('')
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Compose email state
  const [composing, setComposing] = useState(false)
  const [composeData, setComposeData] = useState({
    to: '',
    toName: '',
    subject: '',
    body: '',
    emailType: 'manual' as const,
    category: 'custom',
    tags: [] as string[],
    fromEmailAddressId: '',
    replyTo: '',
  })
  const [sending, setSending] = useState(false)
  
  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user || !isClient()) {
      navigate('/dashboard')
      return
    }

    loadClientEmailAddress()
    loadEmailSignatures()
  }, [user])

  useEffect(() => {
    if (!user || !isClient() || !clientEmailAddress) return

    if (activeTab === 'sent') {
      loadSentEmails()
    } else if (activeTab === 'inbox') {
      loadInboxEmails()
    } else if (activeTab === 'templates') {
      loadEmailTemplates()
    }
  }, [activeTab, clientEmailAddress])

  const loadClientEmailAddress = async () => {
    if (!user?.id) return
    
    try {
      const addresses = await emailAddressesAPI.getUserAddresses(user.id)
      const primaryAddress = addresses.find(addr => addr.is_primary) || addresses[0]
      if (primaryAddress) {
        setClientEmailAddress(primaryAddress)
        setComposeData(prev => ({ ...prev, fromEmailAddressId: primaryAddress.id }))
      }
    } catch (error) {
      console.error('Error loading client email address:', error)
    }
  }

  const loadSentEmails = async () => {
    if (!user?.id || !clientEmailAddress) return

    try {
      setLoading(true)
      const response = await emailLogsAPI.getAll({
        fromEmailAddressId: clientEmailAddress.id,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      })
      setEmailLogs(response.emails || [])
    } catch (error) {
      console.error('Error loading sent emails:', error)
      alert('Failed to load sent emails')
    } finally {
      setLoading(false)
    }
  }

  const loadInboxEmails = async () => {
    if (!clientEmailAddress) return

    try {
      setLoading(true)
      const emails = await resendInboxAPI.getReceivedEmails({
        to: clientEmailAddress.email_address,
        limit: 50,
      })
      setReceivedEmails(emails || [])
      setInboxHasMore((emails?.length || 0) >= 50)
    } catch (error) {
      console.error('Error loading inbox emails:', error)
      alert('Failed to load inbox emails')
    } finally {
      setLoading(false)
    }
  }

  const loadEmailTemplates = async () => {
    try {
      setLoading(true)
      const templates = await emailTemplatesAPI.getAllActive()
      setEmailTemplates(templates || [])
    } catch (error) {
      console.error('Error loading email templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmailSignatures = async () => {
    try {
      const signatures = await emailSignaturesAPI.getUserSignatures(user?.id)
      setEmailSignatures(signatures || [])
      const defaultSig = signatures?.find(s => s.is_default)
      if (defaultSig) {
        setSelectedSignatureId(defaultSig.id)
      }
    } catch (error) {
      console.error('Error loading email signatures:', error)
    }
  }

  const handleSendEmail = async () => {
    if (!clientEmailAddress) {
      alert('Client email address not found. Please contact support.')
      return
    }

    if (!composeData.to || !composeData.subject || !composeData.body) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setSending(true)
      
      let emailBody = composeData.body
      if (selectedSignatureId) {
        const signature = emailSignatures.find(s => s.id === selectedSignatureId)
        if (signature) {
          emailBody += '\n\n' + signature.signature_html
        }
      }

      await sendEmailWithLogging({
        to: composeData.to,
        toName: composeData.toName || undefined,
        subject: composeData.subject,
        body: emailBody,
        emailType: composeData.emailType,
        category: composeData.category,
        tags: composeData.tags,
        fromEmailAddressId: clientEmailAddress.id,
        replyTo: composeData.replyTo || undefined,
      })

      alert('Email sent successfully!')
      setComposing(false)
      setComposeData({
        to: '',
        toName: '',
        subject: '',
        body: '',
        emailType: 'manual',
        category: 'custom',
        tags: [],
        fromEmailAddressId: clientEmailAddress.id,
        replyTo: '',
      })
      setSelectedTemplateId('')
      setTemplateVariables({})
      setSelectedSignatureId('')
      
      if (activeTab === 'sent') {
        loadSentEmails()
      }
    } catch (error: any) {
      console.error('Error sending email:', error)
      alert('Failed to send email: ' + (error.message || 'Unknown error'))
    } finally {
      setSending(false)
    }
  }

  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) {
      setTemplateVariables({})
      return
    }

    try {
      const template = await emailTemplatesAPI.getById(templateId)
      if (template?.variables) {
        const vars: Record<string, string> = {}
        template.variables.forEach((v: string) => {
          vars[v] = ''
        })
        setTemplateVariables(vars)
      }
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) return

    const template = emailTemplates.find(t => t.id === selectedTemplateId)
    if (!template) return

    let htmlContent = template.html_content || ''
    Object.keys(templateVariables).forEach((varName) => {
      const value = templateVariables[varName] || `{{${varName}}}`
      htmlContent = htmlContent.replace(new RegExp(`{{${varName}}}`, 'g'), value)
    })

    setComposeData({
      ...composeData,
      subject: template.subject || composeData.subject,
      body: htmlContent,
    })
  }

  const handleSignatureSelect = (signatureId: string) => {
    setSelectedSignatureId(signatureId)
  }

  const getEmailLogo = (): BusinessLogo | null => {
    if (!clientEmailAddress?.metadata?.logo_id) return null
    // Note: We'd need to load logos, but for now return null
    // In production, you'd want to load logos and find the matching one
    return null
  }

  if (!user || !isClient()) {
    return <Loading text="Loading..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Emails</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Manage your emails and communications
                  </p>
                </div>
                <button
                  onClick={() => setComposing(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Compose Email
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setActiveTab('inbox')
                    navigate('/client/emails/inbox')
                  }}
                  className={cn(
                    'px-4 py-2 font-medium transition-colors border-b-2',
                    activeTab === 'inbox'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  <Mail className="h-4 w-4 inline mr-2" />
                  Inbox
                </button>
                <button
                  onClick={() => {
                    setActiveTab('sent')
                    navigate('/client/emails/sent')
                  }}
                  className={cn(
                    'px-4 py-2 font-medium transition-colors border-b-2',
                    activeTab === 'sent'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  <Send className="h-4 w-4 inline mr-2" />
                  Sent
                </button>
                <button
                  onClick={() => {
                    setActiveTab('templates')
                    navigate('/client/emails/templates')
                  }}
                  className={cn(
                    'px-4 py-2 font-medium transition-colors border-b-2',
                    activeTab === 'templates'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  <FileText className="h-4 w-4 inline mr-2" />
                  Templates
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="space-y-6">
            {/* Inbox Tab */}
            {activeTab === 'inbox' && (
              <div>
                {loading ? (
                  <Loading text="Loading inbox..." />
                ) : receivedEmails.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      No emails in inbox
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Your received emails will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {receivedEmails.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedReceivedEmail(email)}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {email.from}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {email.subject}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(email.created_at), 'PPpp')}
                            </p>
                          </div>
                          <Eye className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sent Tab */}
            {activeTab === 'sent' && (
              <div>
                {loading ? (
                  <Loading text="Loading sent emails..." />
                ) : emailLogs.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <Send className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      No sent emails
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Emails you send will appear here
                    </p>
                    <button
                      onClick={() => setComposing(true)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Compose Your First Email
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailLogs.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                To: {email.recipient_email}
                              </span>
                              <span
                                className={cn(
                                  'px-2 py-0.5 text-xs font-medium rounded-full',
                                  {
                                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':
                                      email.status === 'delivered' || email.status === 'sent',
                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200':
                                      email.status === 'pending',
                                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200':
                                      email.status === 'failed' || email.status === 'bounced',
                                  }
                                )}
                              >
                                {email.status}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {email.subject}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(email.created_at), 'PPpp')}
                            </p>
                          </div>
                          <Eye className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div>
                {loading ? (
                  <Loading text="Loading templates..." />
                ) : emailTemplates.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      No email templates available
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Email templates will appear here when available
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {emailTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                      >
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {template.description || 'No description'}
                        </p>
                        <button
                          onClick={() => {
                            setComposing(true)
                            handleTemplateSelect(template.id)
                          }}
                          className="w-full px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          Use Template
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compose Email Modal */}
          {composing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Compose Email
                  </h2>
                  <button
                    onClick={() => setComposing(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)] space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">From Address</label>
                    <input
                      type="email"
                      value={clientEmailAddress?.email_address || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can only send from your assigned email address
                    </p>
                  </div>

                  {/* Template Selection */}
                  <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <label className="block text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
                      <FileText className="h-4 w-4 inline mr-1" />
                      Use Email Template (Optional)
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-gray-700"
                    >
                      <option value="">-- Select a template --</option>
                      {emailTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>

                    {selectedTemplateId && (
                      <>
                        <div className="space-y-2 mt-3">
                          <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                            Fill in template variables:
                          </p>
                          {Object.keys(templateVariables).map((varName) => (
                            <div key={varName}>
                              <label className="block text-xs text-blue-900 dark:text-blue-100 mb-1">
                                {varName}
                              </label>
                              <input
                                type="text"
                                value={templateVariables[varName]}
                                onChange={(e) =>
                                  setTemplateVariables({
                                    ...templateVariables,
                                    [varName]: e.target.value,
                                  })
                                }
                                placeholder={`Enter ${varName}`}
                                className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded dark:bg-gray-700"
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyTemplate}
                          className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Apply Template to Email
                        </button>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Recipient Email *</label>
                    <input
                      type="email"
                      value={composeData.to}
                      onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Recipient Name</label>
                    <input
                      type="text"
                      value={composeData.toName}
                      onChange={(e) => setComposeData({ ...composeData, toName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  {/* Email Signature Selection */}
                  {emailSignatures.length > 0 && (
                    <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <label className="block text-sm font-medium mb-2 text-green-900 dark:text-green-100">
                        Email Signature (Optional)
                      </label>
                      <select
                        value={selectedSignatureId}
                        onChange={(e) => handleSignatureSelect(e.target.value)}
                        className="w-full px-4 py-2 border border-green-300 dark:border-green-700 rounded-lg dark:bg-gray-700"
                      >
                        <option value="">-- No signature --</option>
                        {emailSignatures.map((sig) => (
                          <option key={sig.id} value={sig.id}>
                            {sig.name} {sig.is_default ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">Subject *</label>
                    <input
                      type="text"
                      value={composeData.subject}
                      onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                      placeholder="Email subject"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Body (HTML) *</label>
                    <textarea
                      value={composeData.body}
                      onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                      placeholder="<p>Your email content here...</p>"
                      rows={12}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can use HTML for formatting.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Reply-To Address</label>
                    <input
                      type="email"
                      value={composeData.replyTo}
                      onChange={(e) => setComposeData({ ...composeData, replyTo: e.target.value })}
                      placeholder="Optional reply-to address"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to use your email address
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setComposing(false)}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sending}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Detail Modal */}
          {selectedEmail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Email Details
                  </h2>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Recipient</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedEmail.recipient_name || selectedEmail.recipient_email}
                      </p>
                      <p className="text-sm text-gray-500">{selectedEmail.recipient_email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p>
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            {
                              'bg-green-100 text-green-800':
                                selectedEmail.status === 'delivered' ||
                                selectedEmail.status === 'sent',
                              'bg-yellow-100 text-yellow-800':
                                selectedEmail.status === 'pending',
                              'bg-red-100 text-red-800':
                                selectedEmail.status === 'failed' ||
                                selectedEmail.status === 'bounced',
                            }
                          )}
                        >
                          {selectedEmail.status}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Subject</label>
                      <p className="text-gray-900 dark:text-gray-100">{selectedEmail.subject}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created At</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {format(new Date(selectedEmail.created_at), 'PPpp')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email Body</label>
                      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                        <div
                          dangerouslySetInnerHTML={{ __html: selectedEmail.body_html || '' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Received Email Detail Modal */}
          {selectedReceivedEmail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Received Email
                  </h2>
                  <button
                    onClick={() => setSelectedReceivedEmail(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">From</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedReceivedEmail.from}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Subject</label>
                      <p className="text-gray-900 dark:text-gray-100">{selectedReceivedEmail.subject}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Received At</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {format(new Date(selectedReceivedEmail.created_at), 'PPpp')}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Email Content</label>
                      {selectedReceivedEmail.html ? (
                        <div 
                          className="prose dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                          dangerouslySetInnerHTML={{ __html: selectedReceivedEmail.html }}
                        />
                      ) : selectedReceivedEmail.text ? (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                          {selectedReceivedEmail.text}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No content available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

