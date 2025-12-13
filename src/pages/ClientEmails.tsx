/**
 * Client Emails Page - Gmail-style email management
 * Features:
 * - Gmail-style inbox and sent views
 * - Sender profile pictures and full names
 * - Read/unread status tracking
 * - Full-page email view (not modal)
 * - Email content preview
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import { 
  Mail, 
  Send, 
  RefreshCw, 
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Reply,
  Forward,
  Printer,
  Paperclip,
  ChevronLeft,
} from 'lucide-react'
import { emailLogsAPI, EmailLog } from '@/lib/email-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { resendInboxAPI, ReceivedEmail } from '@/lib/resend-inbox-api'
import { receivedEmailsAPI, ReceivedEmail as DBReceivedEmail } from '@/lib/received-emails-api'
import { emailAddressesAPI, EmailAddress } from '@/lib/email-addresses-api'
import { userDetailsAPI } from '@/lib/supabase-api'
import { supabase } from '@/lib/supabase'
import { getSignedFileUrl } from '@/lib/supabase-api'
import { ComposeEmailModal } from '@/components/email/ComposeEmailModal'
import { emailTemplatesAPI, EmailTemplate } from '@/lib/email-templates-api'
import { emailSignaturesAPI, EmailSignature } from '@/lib/email-signatures-api'
import { sendEmailWithLogging } from '@/lib/email-api'

type Tab = 'inbox' | 'sent'
type ViewMode = 'list' | 'detail'

interface EnrichedReceivedEmail extends ReceivedEmail {
  senderName?: string
  senderAvatar?: string
  isRead?: boolean
}

export function ClientEmails() {
  const { user, isClient } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  
  const getInitialTab = (): Tab => {
    const pathParts = location.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && ['inbox', 'sent'].includes(lastPart)) {
      return lastPart as Tab
    }
    return 'inbox'
  }
  
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab())
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [receivedEmails, setReceivedEmails] = useState<EnrichedReceivedEmail[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)
  const [selectedReceivedEmail, setSelectedReceivedEmail] = useState<EnrichedReceivedEmail | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(false)
  const [clientEmailAddress, setClientEmailAddress] = useState<EmailAddress | null>(null)
  const [userFullName, setUserFullName] = useState<string>('')
  const [readEmailIds, setReadEmailIds] = useState<Set<string>>(new Set())
  
  // Email signatures state
  const [emailSignatures, setEmailSignatures] = useState<EmailSignature[]>([])
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('')
  
  // State for pre-loaded attachments from navigation
  const [preloadedAttachments, setPreloadedAttachments] = useState<File[]>([])
  
  // Check location.state for pre-filled compose email data
  useEffect(() => {
    const state = location.state as any
    if (state?.composeEmail) {
      const { to, cc, replyTo, subject, body, attachment } = state.composeEmail
      setComposeData(prev => ({
        ...prev,
        to: to || prev.to,
        toName: '',
        subject: subject || prev.subject,
        body: body || prev.body,
        cc: cc || prev.cc,
        replyTo: replyTo || prev.replyTo,
      }))
      
      // Handle PDF attachment if provided
      if (attachment && attachment instanceof File) {
        setPreloadedAttachments([attachment])
      } else {
        setPreloadedAttachments([])
      }
      
      setComposing(true)
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.state, location.pathname])
  
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
    cc: '',
    bcc: '',
    replyTo: '',
  })
  const [sending, setSending] = useState(false)
  
  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})

  // Selection state
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(new Set())
  const [selectedSentIds, setSelectedSentIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !isClient()) {
      navigate('/dashboard')
      return
    }

    loadClientEmailAddress()
    loadEmailSignatures()
    loadUserFullName()
    loadReadStatus()
  }, [user])

  useEffect(() => {
    if (!user || !isClient()) return
    
    // Wait for clientEmailAddress to be loaded before loading emails
    if (!clientEmailAddress) {
      console.log('Client Emails: Waiting for clientEmailAddress to load...')
      return
    }

    console.log('Client Emails: Loading emails for tab:', activeTab, 'email:', clientEmailAddress.email_address)

    if (activeTab === 'sent') {
      // Clear inbox emails when showing sent
      setReceivedEmails([])
      loadSentEmails()
    } else if (activeTab === 'inbox') {
      // Clear sent emails when showing inbox
      setEmailLogs([])
      loadInboxEmails()
    }
  }, [activeTab, clientEmailAddress, user])

  const loadReadStatus = () => {
    // Load read status from localStorage
    const stored = localStorage.getItem(`email_read_status_${user?.id}`)
    if (stored) {
      try {
        const ids = JSON.parse(stored)
        setReadEmailIds(new Set(ids))
      } catch (error) {
        console.error('Error loading read status:', error)
      }
    }
  }

  const markAsRead = (emailId: string) => {
    const newReadIds = new Set(readEmailIds)
    newReadIds.add(emailId)
    setReadEmailIds(newReadIds)
    // Save to localStorage
    localStorage.setItem(`email_read_status_${user?.id}`, JSON.stringify(Array.from(newReadIds)))
  }

  const loadUserFullName = async () => {
    if (!user?.id) return
    
    try {
      const details = await userDetailsAPI.get()
      if (details) {
        const firstName = (details as any).first_name || ''
        const middleName = (details as any).middle_name || ''
        const lastName = (details as any).last_name || ''
        
        const nameParts = [firstName, middleName, lastName].filter(Boolean)
        const fullName = nameParts.join(' ').trim() || 'Client'
        setUserFullName(fullName)
      }
    } catch (error) {
      console.error('Error loading user full name:', error)
      showToast('Unable to load user name. Using default.', 'warning')
      setUserFullName('Client')
    }
  }

  const loadClientEmailAddress = async () => {
    if (!user?.id) {
      console.warn('Cannot load email address: User ID not available')
      return
    }
    
    try {
      const addresses = await emailAddressesAPI.getUserAddresses(user.id)
      
      if (!Array.isArray(addresses)) {
        throw new Error('Invalid response format from email addresses API')
      }
      
      const primaryAddress = addresses.find(addr => addr.is_primary && addr.is_active) 
        || addresses.find(addr => addr.is_active)
        || addresses[0]
      
      if (!primaryAddress) {
        try {
          const generatedEmail = await emailAddressesAPI.generateClientEmail(user.id)
          console.log('Generated new client email:', generatedEmail)
          
          const updatedAddresses = await emailAddressesAPI.getUserAddresses(user.id)
          const newAddress = updatedAddresses.find(addr => addr.email_address === generatedEmail)
          
          if (newAddress) {
            setClientEmailAddress(newAddress)
            setComposeData(prev => ({ ...prev, fromEmailAddressId: newAddress.id }))
          } else {
            throw new Error('Failed to retrieve generated email address')
          }
        } catch (genError: any) {
          console.error('Error generating client email:', genError)
          showToast('❌ No email address found. Please contact support to have one assigned.', 'error')
        }
      } else {
        setClientEmailAddress(primaryAddress)
        setComposeData(prev => ({ ...prev, fromEmailAddressId: primaryAddress.id }))
      }
    } catch (error: any) {
      console.error('Error loading client email address:', error)
      const errorMessage = error?.message || 'Failed to load email address'
      
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        showToast('❌ Permission denied. Please contact support.', 'error')
      } else {
        showToast(`❌ Unable to load email address: ${errorMessage}`, 'error')
      }
    }
  }

  const loadSentEmails = async () => {
    if (!user?.id || !clientEmailAddress) {
      console.warn('Cannot load sent emails: Missing user ID or email address')
      return
    }

    try {
      setLoading(true)
      
      const response = await emailLogsAPI.getAll({
        fromEmailAddressId: clientEmailAddress.id,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      })
      
      if (!response || !Array.isArray(response.data)) {
        throw new Error('Invalid response format from email logs API')
      }
      
      setEmailLogs(response.data || [])
    } catch (error: any) {
      console.error('Error loading sent emails:', error)
      const errorMessage = error?.message || 'Failed to load sent emails'
      
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        showToast('❌ Permission denied to view sent emails.', 'error')
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        showToast('⚠️ Network error. Please check your connection.', 'warning')
      } else {
        showToast(`❌ Unable to load sent emails: ${errorMessage}`, 'error')
      }
      
      setEmailLogs([])
    } finally {
      setLoading(false)
    }
  }

  const loadInboxEmails = async () => {
    if (!clientEmailAddress) {
      console.warn('Cannot load inbox: Client email address not found')
      showToast('⚠️ Email address not configured. Please contact support.', 'warning')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      if (!clientEmailAddress.email_address || !clientEmailAddress.email_address.includes('@')) {
        throw new Error(`Invalid client email address: ${clientEmailAddress.email_address}`)
      }
      
      console.log('Client Inbox - Fetching emails for:', clientEmailAddress.email_address)
      
      // Fetch ALL emails first (no filter) to see what's available
      const allEmailsResponse = await resendInboxAPI.list({
        limit: 50,
      })
      
      console.log('Client Inbox - All emails from Resend:', allEmailsResponse?.data?.length || 0)
      
      if (!allEmailsResponse?.data) {
        console.warn('Client Inbox - No data property in response:', allEmailsResponse)
        setReceivedEmails([])
        setInboxHasMore(false)
        setLoading(false)
        return
      }
      
      if (allEmailsResponse.data.length > 0) {
        console.log('Client Inbox - Sample TO addresses:', allEmailsResponse.data.slice(0, 5).map(e => ({
          id: e.id,
          to: e.to,
          subject: e.subject,
          hasHtml: !!e.html,
          hasText: !!e.text,
          htmlLength: e.html?.length || 0,
          textLength: e.text?.length || 0,
        })))
      } else {
        console.log('Client Inbox - No emails received from Resend API')
      }
      
      // Now filter for this client's email address
      const clientEmailLower = clientEmailAddress.email_address.toLowerCase()
      const emails = allEmailsResponse.data.filter((email) => {
        const toAddresses = Array.isArray(email.to) ? email.to : [email.to]
        const matches = toAddresses.some((addr) => {
          const addrLower = addr.toLowerCase()
          // Check for exact match or if the address contains the client email
          return addrLower === clientEmailLower || addrLower.includes(clientEmailLower)
        })
        return matches
      })
      
      console.log('Client Inbox - After filtering for', clientEmailAddress.email_address, ':', emails.length, 'emails found')
      if (emails.length === 0 && allEmailsResponse.data.length > 0) {
        console.warn('Client Inbox - No emails matched filter. All email TO addresses:', 
          allEmailsResponse.data.slice(0, 10).map(e => e.to))
      }
      
      if (!Array.isArray(emails)) {
        throw new Error('Invalid response format from inbox API')
      }
      
      // Filter out hidden emails
      const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]')
      const visibleEmails = emails.filter(email => !hiddenEmails.includes(email.id))
      
      // Enrich emails with sender details
      const enrichedEmails = await Promise.all(
        visibleEmails.map(async (email) => {
          const enriched: EnrichedReceivedEmail = { ...email }
          
          // Extract sender email
          const senderEmail = email.from.match(/<(.+?)>/)?.[1] || email.from
          
          // Try to get sender's full name and avatar from database
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select('id, first_name, middle_name, last_name, avatar_path')
              .eq('email', senderEmail)
              .maybeSingle()
            
            if (!error && userData) {
              const user = userData as any
              const nameParts = [
                user.first_name,
                user.middle_name,
                user.last_name
              ].filter(Boolean)
              enriched.senderName = nameParts.join(' ')
              
              if (user.avatar_path) {
                const avatarUrl = await getSignedFileUrl(String(user.avatar_path), 3600)
                if (avatarUrl) {
                  enriched.senderAvatar = avatarUrl
                }
              }
            }
          } catch (error) {
            console.error('Error fetching sender details:', error)
          }
          
          // Fallback to email name if no DB match
          if (!enriched.senderName) {
            enriched.senderName = email.from.includes('<') 
              ? email.from.split('<')[0].trim() 
              : email.from.split('@')[0]
          }
          
          // Check if email is read
          enriched.isRead = readEmailIds.has(email.id)
          
          return enriched
        })
      )
      
      // Update unread count in localStorage for sidebar badge
      const unreadCount = enrichedEmails.filter(e => !e.isRead).length
      if (user?.id) {
        try {
          localStorage.setItem(`unreadEmailsCount_${user.id}`, JSON.stringify({
            count: unreadCount,
            timestamp: Date.now(),
          }))
          // Trigger event for sidebar to update
          window.dispatchEvent(new CustomEvent('emailsUpdated'))
        } catch {
          // Ignore errors
        }
      }
      
      setReceivedEmails(enrichedEmails)
      setInboxHasMore(emails.length >= 50)
    } catch (error: any) {
      console.error('Error loading inbox emails:', error)
      const errorMessage = error?.message || 'Failed to load inbox emails'
      
      if (errorMessage.includes('not configured') || errorMessage.includes('API key')) {
        showToast('❌ Email system not configured. Contact admin to set up Resend API key.', 'error')
      } else if (errorMessage.includes('Invalid')) {
        showToast('❌ Invalid email address. Please contact support.', 'error')
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        showToast('⚠️ Network error. Please check your connection.', 'warning')
      } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        showToast('❌ Permission denied. Contact admin.', 'error')
      } else {
        showToast(`❌ Unable to load inbox: ${errorMessage}`, 'error')
      }
      
      setReceivedEmails([])
      setInboxHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const loadEmailSignatures = async () => {
    if (!user?.id) return
    
    try {
      const signatures = await emailSignaturesAPI.getUserSignatures(user.id)
      
      if (!Array.isArray(signatures)) {
        throw new Error('Invalid response format from signatures API')
      }
      
      setEmailSignatures(signatures)
      setSelectedSignatureId('')
    } catch (error: any) {
      console.error('Error loading email signatures:', error)
      setEmailSignatures([])
    }
  }

  // Convert plain text to HTML, preserving formatting for business letters
  const convertTextToHtml = (text: string): string => {
    if (!text) return ''
    
    // Check if the text already contains HTML tags
    if (/<[a-z][\s\S]*>/i.test(text)) {
      // Already HTML, return as-is
      return text
    }
    
    // Escape HTML special characters
    const escapeHtml = (str: string) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }
      return str.replace(/[&<>"']/g, (m) => map[m])
    }
    
    // Split text into lines
    const lines = text.split(/\n/)
    const htmlLines: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      
      if (trimmedLine === '') {
        // Empty line - add a paragraph break for spacing
        htmlLines.push('<p>&nbsp;</p>')
      } else {
        // Non-empty line - escape and preserve
        const escapedLine = escapeHtml(trimmedLine)
        // Use paragraph tags for proper email formatting
        htmlLines.push(`<p style="margin: 0 0 12px 0;">${escapedLine}</p>`)
      }
    }
    
    // Wrap in a proper email-friendly HTML structure with inline styles
    // Inline styles are required for email clients like Gmail
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 600px;">
        ${htmlLines.join('\n        ')}
      </div>
    `.trim()
  }

  const handleSendEmail = async (attachments?: File[]) => {
    if (!clientEmailAddress) {
      showToast('❌ Email address not configured. Contact support.', 'error')
      return
    }

    if (!composeData.to || !composeData.subject || !composeData.body) {
      showToast('⚠️ Please fill in all required fields (To, Subject, Body)', 'warning')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(composeData.to)) {
      showToast('⚠️ Please enter a valid recipient email address.', 'warning')
      return
    }

    if (composeData.body.trim().length < 10) {
      showToast('⚠️ Email message too short (minimum 10 characters).', 'warning')
      return
    }

    try {
      setSending(true)
      
      let emailBody = composeData.body
      
      if (selectedSignatureId) {
        const signature = emailSignatures.find(s => s.id === selectedSignatureId)
        if (signature && signature.signature_html) {
          emailBody += '\n\n' + signature.signature_html
        }
      }

      // Convert plain text to HTML format for proper email formatting
      const htmlBody = convertTextToHtml(emailBody)

      const success = await sendEmailWithLogging({
        to: composeData.to,
        toName: composeData.toName || undefined,
        subject: composeData.subject,
        html: htmlBody,
        emailType: composeData.emailType,
        emailCategory: composeData.category,
        tags: composeData.tags,
        fromEmailAddressId: clientEmailAddress.id,
        fromName: userFullName || undefined,
        replyTo: composeData.replyTo || undefined,
        cc: composeData.cc || undefined,
        bcc: composeData.bcc || undefined,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
      })

      if (!success) {
        throw new Error('Email service returned unsuccessful response')
      }

      showToast('✅ Email sent successfully!', 'success')
      setComposing(false)
      
      // Clear compose data
      setComposeData({
        to: '',
        toName: '',
        subject: '',
        body: '',
        emailType: 'manual',
        category: 'custom',
        tags: [],
        fromEmailAddressId: clientEmailAddress.id,
        cc: '',
        bcc: '',
      })
      setSelectedTemplateId('')
      setTemplateVariables({})
      setSelectedSignatureId('')
      
      // Auto-open sent items
      setActiveTab('sent')
      navigate('/client/emails/sent')
      setTimeout(() => loadSentEmails(), 500)
    } catch (error: any) {
      console.error('Error sending email:', error)
      
      let errorMessage = 'Failed to send email'
      
      if (error?.message?.includes('not configured') || error?.message?.includes('API key')) {
        errorMessage = 'Email service not configured. Contact admin.'
      } else if (error?.message?.includes('permission') || error?.message?.includes('denied') || error?.message?.includes('403')) {
        errorMessage = 'Permission denied. You may not have access to send emails.'
      } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        errorMessage = 'Network error. Check your connection.'
      } else if (error?.message?.includes('invalid') || error?.message?.includes('format')) {
        errorMessage = 'Invalid email format. Check your inputs.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      showToast(`❌ ${errorMessage}`, 'error')
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
      
      if (!template) {
        throw new Error('Template not found')
      }
      
      if (template.variables && Array.isArray(template.variables)) {
        const vars: Record<string, string> = {}
        template.variables.forEach((v: any) => {
          const key = typeof v === 'string' ? v : v.name
          vars[key] = ''
        })
        setTemplateVariables(vars)
      } else {
        setTemplateVariables({})
      }
    } catch (error: any) {
      console.error('Error loading template:', error)
      showToast(`⚠️ Failed to load template: ${error?.message || 'Unknown error'}`, 'warning')
      setSelectedTemplateId('')
      setTemplateVariables({})
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

  const handleViewInboxEmail = async (email: EnrichedReceivedEmail) => {
    try {
      // Check if email already has content (html/text)
      const hasContent = email.html || email.text
      
      console.log('Client Inbox - Opening email:', {
        id: email.id,
        hasHtml: !!email.html,
        hasText: !!email.text,
        htmlLength: email.html?.length || 0,
        textLength: email.text?.length || 0,
      })
      
      // If email already has content from LIST API, use it directly
      if (hasContent) {
        console.log('Client Inbox - Using content from LIST API')
        setSelectedReceivedEmail(email)
        setViewMode('detail')
        markAsRead(email.id)
        return
      }
      
      // Otherwise, try to fetch full email content
      console.log('Client Inbox - No content in LIST API, fetching full email for:', email.id)
      setLoading(true)
      
      try {
        const fullEmail = await resendInboxAPI.getById(email.id)
        
        console.log('Client Inbox - Full email fetched:', {
          id: fullEmail.id,
          hasHtml: !!fullEmail.html,
          hasText: !!fullEmail.text,
          htmlLength: fullEmail.html?.length || 0,
          textLength: fullEmail.text?.length || 0,
        })
        
        // Merge the enriched data (sender info) with full email data
        const enrichedFullEmail: EnrichedReceivedEmail = {
          ...fullEmail,
          senderName: email.senderName,      // From list view
          senderAvatar: email.senderAvatar,  // From list view
          isRead: email.isRead,              // Preserve read status
        }
        
        setSelectedReceivedEmail(enrichedFullEmail)
        setViewMode('detail')
        markAsRead(email.id)
      } catch (fetchError: any) {
        console.error('Error fetching full email:', fetchError)
        // If fetch fails, still show the email (even without content)
        // The user can see the metadata at least
        setSelectedReceivedEmail(email)
        setViewMode('detail')
        markAsRead(email.id)
        
        // Only show error if the email really has no content
        if (!hasContent) {
          showToast(`⚠️ Email content unavailable. This may be a limitation of the email service.`, 'warning')
        }
      } finally {
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Error loading email details:', error)
      // Fallback: show email anyway
      setSelectedReceivedEmail(email)
      setViewMode('detail')
      markAsRead(email.id)
      setLoading(false)
    }
  }

  const handleViewSentEmail = (email: EmailLog) => {
    setSelectedEmail(email)
    setViewMode('detail')
  }

  const handleBackToList = () => {
    setViewMode('list')
    setSelectedEmail(null)
    setSelectedReceivedEmail(null)
  }

  const toggleInboxSelection = (id: string) => {
    const newSet = new Set(selectedInboxIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedInboxIds(newSet)
  }

  const toggleSentSelection = (id: string) => {
    const newSet = new Set(selectedSentIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedSentIds(newSet)
  }

  const toggleSelectAllInbox = () => {
    if (selectedInboxIds.size === receivedEmails.length) {
      setSelectedInboxIds(new Set())
    } else {
      setSelectedInboxIds(new Set(receivedEmails.map(e => e.id)))
    }
  }

  const toggleSelectAllSent = () => {
    if (selectedSentIds.size === emailLogs.length) {
      setSelectedSentIds(new Set())
    } else {
      setSelectedSentIds(new Set(emailLogs.map(e => e.id)))
    }
  }

  const getAvatarInitial = (name: string) => {
    return (name[0] || 'U').toUpperCase()
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-purple-500 to-pink-600',
      'from-blue-500 to-cyan-600',
      'from-green-500 to-emerald-600',
      'from-orange-500 to-red-600',
      'from-indigo-500 to-purple-600',
      'from-pink-500 to-rose-600',
      'from-teal-500 to-green-600',
      'from-yellow-500 to-orange-600',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const getEmailPreview = (html?: string, text?: string, maxLength: number = 80) => {
    if (text && text.trim()) {
      const cleaned = text.trim().replace(/\s+/g, ' ')
      return cleaned.substring(0, maxLength) + (cleaned.length > maxLength ? '...' : '')
    }
    if (html && html.trim()) {
      const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      return stripped.substring(0, maxLength) + (stripped.length > maxLength ? '...' : '')
    }
    return ''
  }

  const handleDeleteInboxEmail = async (emailId: string, subject: string) => {
    if (!confirm(`Hide "${subject || '(no subject)'}"?\n\nNote: This will hide the email from your view. Resend does not support permanent deletion of received emails.`)) {
      return
    }

    try {
      await resendInboxAPI.delete(emailId)
      showToast('✅ Email hidden from inbox', 'success')
      
      // Remove from local state
      setReceivedEmails(prev => prev.filter(e => e.id !== emailId))
      
      // Remove from selection
      const newSelectedIds = new Set(selectedInboxIds)
      newSelectedIds.delete(emailId)
      setSelectedInboxIds(newSelectedIds)
      
      // Store hidden email ID in localStorage
      const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]')
      hiddenEmails.push(emailId)
      localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails))
    } catch (error: any) {
      console.error('Error hiding inbox email:', error)
      showToast(`❌ Failed to hide email: ${error.message}`, 'error')
    }
  }

  const handleDeleteSentEmail = async (logId: string, subject: string) => {
    showToast('⚠️ Cannot delete sent email logs. Contact admin if needed.', 'warning')
    // Note: Sent emails are logs and typically shouldn't be deleted by clients
    // Only admins should have this ability
  }

  const handleBatchDeleteInbox = async () => {
    const selectedIds = Array.from(selectedInboxIds)
    
    if (selectedIds.length === 0) {
      showToast('⚠️ No emails selected', 'warning')
      return
    }

    if (!confirm(`Hide ${selectedIds.length} selected email(s)?\n\nNote: Emails will be hidden from your view but not permanently deleted.`)) {
      return
    }

    try {
      const result = await resendInboxAPI.batchDelete(selectedIds)
      
      if (result.success > 0) {
        showToast(`✅ Hidden ${result.success} email(s)`, 'success')
        // Remove from local state
        setReceivedEmails(prev => prev.filter(e => !selectedIds.includes(e.id)))
        setSelectedInboxIds(new Set())
        
        // Store hidden email IDs in localStorage
        const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]')
        hiddenEmails.push(...selectedIds)
        localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails))
      }
      
      if (result.failed > 0) {
        showToast(`⚠️ Failed to hide ${result.failed} email(s)`, 'warning')
      }
    } catch (error: any) {
      console.error('Error batch hiding:', error)
      showToast(`❌ Failed to hide emails: ${error.message}`, 'error')
    }
  }

  if (!user || !isClient()) {
    return <Loading text="Loading..." />
  }

  // Full-page email detail view
  if (viewMode === 'detail' && (selectedEmail || selectedReceivedEmail)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            {/* Email Detail View */}
            <div className="max-w-5xl mx-auto">
              {/* Header with back button */}
              <div className="mb-6">
                <button
                  onClick={handleBackToList}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span>Back to {activeTab === 'inbox' ? 'Inbox' : 'Sent Items'}</span>
                </button>
              </div>

              {/* Email Content */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                {/* Subject Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {selectedEmail?.subject || selectedReceivedEmail?.subject || '(no subject)'}
                  </h1>
                  
                  {selectedEmail && (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        {
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400':
                            selectedEmail.status === 'delivered' || selectedEmail.status === 'sent',
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400':
                            selectedEmail.status === 'pending',
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400':
                            selectedEmail.status === 'failed' || selectedEmail.status === 'bounced',
                        }
                      )}>
                        {selectedEmail.status}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(selectedEmail.created_at), 'MMMM d, yyyy • h:mm a')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sender/Recipient Info */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {selectedReceivedEmail?.senderAvatar ? (
                        <img
                          src={selectedReceivedEmail.senderAvatar}
                          alt="Sender"
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg',
                          `bg-gradient-to-br ${getAvatarColor(selectedReceivedEmail?.senderName || selectedEmail?.recipient_name || 'U')}`
                        )}>
                          {getAvatarInitial(selectedReceivedEmail?.senderName || selectedEmail?.recipient_name || 'U')}
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                            {selectedReceivedEmail?.senderName || selectedEmail?.recipient_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {selectedReceivedEmail ? (
                              <>
                                <span className="text-gray-500">from</span>{' '}
                                <span className="font-medium">{selectedReceivedEmail.from}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-500">to</span>{' '}
                                <span className="font-medium">{selectedEmail?.recipient_email}</span>
                              </>
                            )}
                          </p>
                          {selectedReceivedEmail && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {format(new Date(selectedReceivedEmail.created_at), 'MMMM d, yyyy • h:mm a')}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {selectedReceivedEmail && (
                            <>
                              <button
                                onClick={() => {
                                  const senderEmail = selectedReceivedEmail.from.match(/<(.+?)>/)?.[1] || selectedReceivedEmail.from
                                  setComposeData({
                                    ...composeData,
                                    to: senderEmail,
                                    toName: selectedReceivedEmail.senderName || '',
                                    subject: `Re: ${selectedReceivedEmail.subject || ''}`,
                                  })
                                  setComposing(true)
                                  handleBackToList()
                                }}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Reply"
                              >
                                <Reply className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              </button>
                              <button
                                onClick={() => {
                                  setComposeData({
                                    ...composeData,
                                    to: '',
                                    subject: `Fwd: ${selectedReceivedEmail.subject || ''}`,
                                  })
                                  setComposing(true)
                                  handleBackToList()
                                }}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Forward"
                              >
                                <Forward className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => window.print()}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Print"
                          >
                            <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                {selectedReceivedEmail?.attachments && selectedReceivedEmail.attachments.length > 0 && (
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {selectedReceivedEmail.attachments.length} Attachment{selectedReceivedEmail.attachments.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedReceivedEmail.attachments.map((attachment: any, idx: number) => {
                        const handleDownload = () => {
                          if (attachment.download_url) {
                            window.open(attachment.download_url, '_blank')
                          } else {
                            showToast('Download URL not available for this attachment', 'warning')
                          }
                        }
                        return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-sm transition-shadow"
                        >
                          <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate flex-1">
                            {attachment.filename}
                          </span>
                          <button
                            onClick={handleDownload}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Download attachment"
                          >
                            <Download className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Email Body */}
                <div className="px-6 py-6">
                  {selectedEmail?.body_html || selectedReceivedEmail?.html ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: selectedEmail?.body_html || selectedReceivedEmail?.html || ''
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                      {selectedEmail?.body_text || selectedReceivedEmail?.text || 'No content'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // List view
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
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Emails</h1>
                    {clientEmailAddress && (
                      <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                        {clientEmailAddress.email_address}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Manage your emails and communications
                  </p>
                </div>
                <button
                  onClick={() => setComposing(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Compose
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
                  {receivedEmails.filter(e => !e.isRead).length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                      {receivedEmails.filter(e => !e.isRead).length}
                    </span>
                  )}
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
              </div>
            </div>
          </div>

          {/* Email List Content */}
          <div className="space-y-6">
            {loading ? (
              <div className="py-12">
                <Loading text="Loading emails..." />
              </div>
            ) : activeTab === 'inbox' ? (
              /* INBOX TABLE */
              !clientEmailAddress ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                  <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Loading email address...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">Please wait while we set up your inbox.</p>
                </div>
              ) : receivedEmails.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                  <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">No emails in inbox</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Your inbox at {clientEmailAddress.email_address} is empty.
                  </p>
                  <button
                    onClick={loadInboxEmails}
                    className="mt-4 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 inline mr-2" />
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                  {/* Table Header */}
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                    <div className="flex items-center px-2 py-2">
                      <div className="w-10 sm:w-12 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedInboxIds.size === receivedEmails.length && receivedEmails.length > 0}
                          onChange={toggleSelectAllInbox}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </div>
                      <div className="flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {selectedInboxIds.size > 0 ? `${selectedInboxIds.size} selected` : 'Inbox'}
                      </div>
                    </div>
                  </div>

                  {/* Email Rows */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {receivedEmails.map((email) => (
                      <div
                        key={email.id}
                        className={cn(
                          'group relative flex flex-col sm:flex-row sm:items-center px-2 py-2 hover:shadow-sm transition-all cursor-pointer border-l-4 hover:border-l-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                          email.isRead 
                            ? 'border-transparent' 
                            : 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                        )}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return
                          }
                          handleViewInboxEmail(email)
                        }}
                      >
                        {/* Mobile/Tablet Layout */}
                        <div className="flex items-start sm:items-center flex-1 min-w-0">
                          {/* Checkbox */}
                          <div className="w-10 sm:w-12 flex items-center justify-center flex-shrink-0 pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedInboxIds.has(email.id)}
                              onChange={() => toggleInboxSelection(email.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </div>

                          {/* Avatar */}
                          <div className="w-10 h-10 flex-shrink-0 mr-2 sm:mr-3">
                            {email.senderAvatar ? (
                              <img
                                src={email.senderAvatar}
                                alt={email.senderName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                              />
                            ) : (
                              <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm',
                                `bg-gradient-to-br ${getAvatarColor(email.senderName || 'U')}`
                              )}>
                                {getAvatarInitial(email.senderName || 'U')}
                              </div>
                            )}
                          </div>

                          {/* Content Area */}
                          <div className="flex-1 min-w-0 pr-2">
                            {/* Sender & Read Status (Mobile: stacked, Desktop: inline) */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                              <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                <div className="flex items-center gap-2">
                                  {!email.isRead && (
                                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                                  )}
                                  <span className={cn(
                                    'text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none',
                                    email.isRead && 'font-normal text-gray-700 dark:text-gray-300'
                                  )}>
                                    {email.senderName && email.senderName.length > 20 
                                      ? email.senderName.substring(0, 20) + '...' 
                                      : email.senderName}
                                  </span>
                                </div>
                              </div>

                              {/* Subject & Preview */}
                              <div className="flex-1 min-w-0 sm:px-2">
                                <div className="flex items-center gap-1">
                                  {email.attachments && email.attachments.length > 0 && (
                                    <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className={cn(
                                    'text-sm font-medium text-gray-900 dark:text-gray-100 truncate',
                                    email.isRead && 'font-normal text-gray-700 dark:text-gray-300'
                                  )}>
                                    {(email.subject && email.subject.length > 40 
                                      ? email.subject.substring(0, 40) + '...' 
                                      : email.subject) || '(no subject)'}
                                  </span>
                                  {(() => {
                                    const preview = getEmailPreview(email.html, email.text, 50)
                                    return preview ? (
                                      <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate ml-1">
                                        - {preview}
                                      </span>
                                    ) : null
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Mobile: Date Row */}
                            <div className="flex items-center justify-between sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {email.attachments && email.attachments.length > 0 && (
                                <span>
                                  {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                                </span>
                              )}
                              <span className={email.attachments && email.attachments.length > 0 ? '' : 'ml-auto'}>
                                {format(new Date(email.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Desktop: Date & Actions */}
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-28 text-right px-2 flex-shrink-0">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {format(new Date(email.created_at), 'MMM d')}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {format(new Date(email.created_at), 'h:mm a')}
                            </div>
                          </div>

                          <div className="w-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDeleteInboxEmail(email.id, email.subject || '(no subject)')}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Mobile: Delete Button (Always visible) */}
                        <div className="sm:hidden absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteInboxEmail(email.id, email.subject || '(no subject)')}
                            className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              /* SENT TABLE */
              emailLogs.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                  <Send className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No sent emails</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                  {/* Table Header */}
                  <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                    <div className="flex items-center px-2 py-2">
                      <div className="w-10 sm:w-12 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedSentIds.size === emailLogs.length && emailLogs.length > 0}
                          onChange={toggleSelectAllSent}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </div>
                      <div className="flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {selectedSentIds.size > 0 ? `${selectedSentIds.size} selected` : 'Sent Items'}
                      </div>
                    </div>
                  </div>

                  {/* Email Rows */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {emailLogs.map((log) => (
                      <div
                        key={log.id}
                        className="group relative flex flex-col sm:flex-row sm:items-center px-2 py-2 hover:shadow-sm transition-all cursor-pointer border-l-4 border-transparent hover:border-l-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return
                          }
                          handleViewSentEmail(log)
                        }}
                      >
                        {/* Mobile/Tablet Layout */}
                        <div className="flex items-start sm:items-center flex-1 min-w-0">
                          {/* Checkbox */}
                          <div className="w-10 sm:w-12 flex items-center justify-center flex-shrink-0 pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedSentIds.has(log.id)}
                              onChange={() => toggleSentSelection(log.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </div>

                          {/* Avatar */}
                          <div className="w-10 h-10 flex-shrink-0 mr-2 sm:mr-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                              <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                            </div>
                          </div>

                          {/* Content Area */}
                          <div className="flex-1 min-w-0 pr-2">
                            {/* Recipient & Status (Mobile: stacked, Desktop: inline) */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                              <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none">
                                    {(() => {
                                      const recipient = log.recipient_name || log.recipient_email.split('@')[0]
                                      return recipient.length > 20 ? recipient.substring(0, 20) + '...' : recipient
                                    })()}
                                  </span>
                                  {/* Status Icon (Mobile: inline with recipient) */}
                                  <span className="sm:hidden">
                                    {log.status === 'delivered' || log.status === 'sent' ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    ) : log.status === 'pending' ? (
                                      <Clock className="h-3.5 w-3.5 text-yellow-600" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Subject & Preview */}
                              <div className="flex-1 min-w-0 sm:px-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {(log.subject && log.subject.length > 40 
                                      ? log.subject.substring(0, 40) + '...' 
                                      : log.subject) || '(no subject)'}
                                  </span>
                                  {(() => {
                                    const preview = getEmailPreview(log.body_html || undefined, log.body_text || undefined, 30)
                                    return preview ? (
                                      <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate ml-1">
                                        - {preview}
                                      </span>
                                    ) : null
                                  })()}
                                </div>
                              </div>

                              {/* Status & Indicators (Desktop only) */}
                              <div className="hidden sm:flex items-center gap-2 flex-shrink-0 px-2">
                                {log.status === 'delivered' || log.status === 'sent' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : log.status === 'pending' ? (
                                  <Clock className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            </div>

                            {/* Mobile: Date Row */}
                            <div className="flex items-center justify-between sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <span>
                                {format(new Date(log.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Desktop: Date & Actions */}
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-28 text-right px-2 flex-shrink-0">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {format(new Date(log.created_at), 'MMM d')}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {format(new Date(log.created_at), 'h:mm a')}
                            </div>
                          </div>

                          <div className="w-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDeleteSentEmail(log.id, log.subject || '(no subject)')}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                              title="Delete (Admin only)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Mobile: Delete Button */}
                        <div className="sm:hidden absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteSentEmail(log.id, log.subject || '(no subject)')}
                            className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700"
                            title="Delete (Admin only)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Compose Email Modal */}
          <ComposeEmailModal
            isOpen={composing}
            onClose={() => {
              setComposing(false)
              setPreloadedAttachments([]) // Clear preloaded attachments when closing
              // Clear compose data when closing
              setComposeData({
                to: '',
                toName: '',
                subject: '',
                body: '',
                emailType: 'manual',
                category: 'custom',
                tags: [],
                fromEmailAddressId: clientEmailAddress?.id || '',
                cc: '',
                bcc: '',
              })
              setSelectedTemplateId('')
              setTemplateVariables({})
              setSelectedSignatureId('')
            }}
            onSend={handleSendEmail}
            composeData={composeData}
            onComposeDataChange={setComposeData}
            sending={sending}
            fromEmail={clientEmailAddress?.email_address || ''}
            emailTemplates={emailTemplates}
            emailSignatures={emailSignatures}
            onTemplateSelect={handleTemplateSelect}
            onSignatureSelect={handleSignatureSelect}
            selectedTemplateId={selectedTemplateId}
            selectedSignatureId={selectedSignatureId}
            templateVariables={templateVariables}
            onTemplateVariablesChange={setTemplateVariables}
            onApplyTemplate={handleApplyTemplate}
            initialAttachments={preloadedAttachments}
          />
        </main>
      </div>
    </div>
  )
}
