/**
 * Admin Emails Page - Enterprise-grade email management system
 * Features:
 * - Email history with advanced filtering
 * - Email analytics and statistics
 * - Compose and send emails
 * - Retry failed emails
 * - Email templates
 * - Bulk operations
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import { 
  Mail, 
  Send, 
  RefreshCw, 
  Search, 
  Filter, 
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Plus,
  X,
  FileText,
  Edit,
  Save,
  EyeOff,
  Star,
  PenTool,
  Settings,
  Upload,
  Paperclip,
  FlaskConical,
  Users,
  User,
} from 'lucide-react'
import { emailLogsAPI, sendEmailWithLogging, EmailLog, EmailStats } from '@/lib/email-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { emailTemplatesAPI } from '@/lib/email-templates-api'
import { emailSignaturesAPI, EmailSignature } from '@/lib/email-signatures-api'
import { resendInboxAPI, ReceivedEmail } from '@/lib/resend-inbox-api'
import { businessLogosAPI, BusinessLogo } from '@/lib/email-signatures-api'
import { db } from '@/lib/api-client'
import { getSignedFileUrl } from '@/lib/api-service'
import { getInitials, getAvatarColor, getAvatarColorDark, getAvatarTextColor, getAvatarTextColorDark } from '@/lib/avatar'

// Import types and utilities
import type { Tab, EnrichedReceivedEmail } from './AdminEmails/types'
import { getEmailPreview, exportToCSV as exportToCSVUtil } from './AdminEmails/utils/emailHelpers'

// Import extracted components
import { EmailTemplatesManager } from './AdminEmails/components/EmailTemplatesManager'
import { SignaturesTab } from './AdminEmails/components/SignaturesTab'
import { ScheduledEmailsTab } from './AdminEmails/components/ScheduledEmailsTab'
import { EmailAnalyticsTab } from './AdminEmails/components/EmailAnalyticsTab'
import { CampaignsTab } from './AdminEmails/components/CampaignsTab'
import { SubscribersTab } from './AdminEmails/components/SubscribersTab'
import { ABTestingTab } from './AdminEmails/components/ABTestingTab'
import { EmailDetailModal } from '@/components/email/EmailDetailModal'
import { ComposeEmailModal } from '@/components/email/ComposeEmailModal'

export function AdminEmails() {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  
  // Get initial tab from URL path or hash
  const getInitialTab = (): Tab => {
    // Check URL path first (e.g., /admin/emails/inbox, /admin/emails/sent, /admin/emails/signatures, /admin/emails/email-setup)
    const pathParts = location.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    const secondLastPart = pathParts[pathParts.length - 2]
    
    // Check for email-setup sub-routes
    if (secondLastPart === 'email-setup') {
      if (lastPart === 'admin' || lastPart === 'client') {
        return 'email-setup'
      }
    }
    
    if (lastPart && ['inbox', 'sent', 'scheduled', 'analytics', 'campaigns', 'subscribers', 'ab-testing', 'templates', 'signatures', 'email-setup'].includes(lastPart)) {
      return lastPart as Tab
    }
    
    // Then check hash (e.g., /admin/emails#inbox)
    const hash = location.hash.replace('#', '')
    if (hash && ['inbox', 'sent', 'scheduled', 'analytics', 'campaigns', 'subscribers', 'ab-testing', 'templates', 'signatures', 'email-setup'].includes(hash)) {
      return hash as Tab
    }
    
    return 'inbox'
  }
  
  // Get initial email type tab from URL
  const getInitialEmailTypeTab = (): 'admin' | 'client' => {
    const pathParts = location.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    const secondLastPart = pathParts[pathParts.length - 2]
    
    if (secondLastPart === 'email-setup' && lastPart === 'client') {
      return 'client'
    }
    
    return 'admin'
  }
  
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab())
  const [emailTypeTab, setEmailTypeTab] = useState<'admin' | 'client'>(getInitialEmailTypeTab())
  const [loading, setLoading] = useState(true)
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [receivedEmails, setReceivedEmails] = useState<any[]>([])
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedReceivedEmail, setSelectedReceivedEmail] = useState<any | null>(null)
  const [, setSelectedSentEmailPreview] = useState<EmailLog | null>(null)
  const [, setSelectedInboxEmailPreview] = useState<EnrichedReceivedEmail | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(false)
  
  // Selection state for bulk actions
  const [selectedSentIds, setSelectedSentIds] = useState<Set<string>>(new Set())
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(new Set())
  
  // Selected emails for preview
  const [selectedInboxEmail, setSelectedInboxEmail] = useState<EnrichedReceivedEmail | null>(null)
  const [selectedSentEmail, setSelectedSentEmail] = useState<EmailLog | null>(null)
  
  // Email detail modal state
  const [showEmailDetail, setShowEmailDetail] = useState(false)
  
  // Delete confirmation modal
  const [, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'sent' | 'inbox'
    emailId: string | null
    emailSubject: string
  }>({
    isOpen: false,
    type: 'sent',
    emailId: null,
    emailSubject: ''
  })

  // Email signatures state
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [, setEditingSignature] = useState<Partial<EmailSignature> | null>(null)
  const [, setShowSignatureEditor] = useState(false)

  // Email setup state
  const [businessLogos, setBusinessLogos] = useState<BusinessLogo[]>([])
  const [, setShowLogoUpload] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [editingEmail, setEditingEmail] = useState<any | null>(null)
  const [showEmailEditor, setShowEmailEditor] = useState(false)
  const [uploadedAvatarPreview, setUploadedAvatarPreview] = useState<string | null>(null)
  const [showAddEmailModal, setShowAddEmailModal] = useState(false)
  const [newEmailData, setNewEmailData] = useState({
    email_address: '',
    display_name: '',
    address_type: 'admin' as 'admin' | 'support' | 'noreply' | 'department' | 'client',
    department: '',
    can_send: true,
    can_receive: true,
  })
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
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
    cc: '',
    bcc: '',
  })
  const [htmlBody, setHtmlBody] = useState('')
  const [sending, setSending] = useState(false)
  const [, setShowAdvancedOptions] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showSignatureMenu, setShowSignatureMenu] = useState(false)
  const [, setIsMinimized] = useState(false)
  const [, setAttachments] = useState<File[]>([])
  const [emailViewMode, setEmailViewMode] = useState<'html' | 'text' | 'preview'>('html')
  const templateMenuRef = useRef<HTMLDivElement>(null)
  const signatureMenuRef = useRef<HTMLDivElement>(null)

  // Email addresses
  const [adminEmailAddresses, setAdminEmailAddresses] = useState<any[]>([])
  const [_loadingAddresses, setLoadingAddresses] = useState(false)
  
  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  const templateRenderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Email signatures
  const [emailSignatures, setEmailSignatures] = useState<any[]>([])
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('')

  // Check location.state for pre-filled compose email data
  useEffect(() => {
    const state = location.state as any
    if (state?.composeEmail) {
      const { from, fromName, to, cc, replyTo, subject, body, htmlBody: htmlBodyData, attachment } = state.composeEmail
      
      // Set compose data
      setComposeData(prev => ({
        ...prev,
        to: to || prev.to,
        subject: subject || prev.subject,
        body: body || prev.body,
        cc: cc || prev.cc,
        replyTo: replyTo || prev.replyTo,
      }))
      
      // Set HTML body if provided
      if (htmlBodyData) {
        setHtmlBody(htmlBodyData)
        // Also set it as body if body is not provided
        if (!body) {
          setComposeData(prev => ({ ...prev, body: htmlBodyData }))
        }
      }
      
      // Handle from/fromName - find the email address ID
      if (from) {
        // First check already-loaded addresses
        const matchingAddress = adminEmailAddresses.find(addr => 
          addr.email_address === from || 
          (fromName && addr.display_name === fromName)
        )
        if (matchingAddress) {
          setComposeData(prev => ({ ...prev, fromEmailAddressId: matchingAddress.id }))
        } else {
          // If not found in loaded addresses, try API call
          const findEmailAddressId = async () => {
            try {
              const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
              const allAddresses = await emailAddressesAPI.getAll()
              const apiMatchingAddress = allAddresses.find(addr => 
                addr.email_address === from || 
                (fromName && addr.display_name === fromName)
              )
              if (apiMatchingAddress) {
                setComposeData(prev => ({ ...prev, fromEmailAddressId: apiMatchingAddress.id }))
              }
            } catch (error) {
              console.error('Error finding email address ID:', error)
            }
          }
          findEmailAddressId()
        }
      }
      
      // Handle attachment if provided
      if (attachment && attachment instanceof File) {
        setAttachments([attachment])
      }
      
      // Open compose modal
      setComposing(true)
      
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.state, location.pathname])

  useEffect(() => {
    if (isAdmin()) {
      if (activeTab === 'sent') {
        // Clear inbox emails when showing sent
        setReceivedEmails([])
        loadData()
      } else if (activeTab === 'inbox') {
        // Clear sent emails when showing inbox
        setEmailLogs([])
        setTotalCount(0)
        setTotalPages(1)
        loadInboxEmails()
      } else if (activeTab === 'signatures') {
        // Clear both email lists when showing signatures
        setReceivedEmails([])
        setEmailLogs([])
        loadSignaturesData()
      } else if (activeTab === 'email-setup') {
        // Clear both email lists when showing email-setup
        setReceivedEmails([])
        setEmailLogs([])
        loadEmailSetupData()
      }
      loadAdminEmailAddresses()
      loadEmailTemplates()
      loadEmailSignatures()
    }
  }, [currentPage, statusFilter, typeFilter, categoryFilter, searchQuery, dateRange, activeTab])

  // Close dropdown menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
        setShowTemplateMenu(false)
      }
      if (signatureMenuRef.current && !signatureMenuRef.current.contains(event.target as Node)) {
        setShowSignatureMenu(false)
      }
    }

    if (showTemplateMenu || showSignatureMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTemplateMenu, showSignatureMenu])
  
  const loadAdminEmailAddresses = async () => {
    setLoadingAddresses(true)
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      // Load all email addresses and filter for business/system addresses (admin, support, noreply, department)
      // Show all, including unverified and inactive
      const allAddresses = await emailAddressesAPI.getAll()
      const businessAddresses = allAddresses.filter(addr => 
        ['admin', 'support', 'noreply', 'department'].includes(addr.address_type)
      )
      setAdminEmailAddresses(businessAddresses)
      // Set default from address (prefer active/verified addresses)
      const defaultAddress = businessAddresses.find(addr => addr.is_active && addr.is_verified) || businessAddresses[0]
      if (defaultAddress && !composeData.fromEmailAddressId) {
        setComposeData(prev => ({ ...prev, fromEmailAddressId: defaultAddress.id }))
      }
    } catch (error) {
      console.error('Error loading admin email addresses:', error)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const loadEmailTemplates = async () => {
    try {
      // Load all templates (not just active) for admin users to have full access
      const templates = await emailTemplatesAPI.getAll()
      setEmailTemplates(templates.filter(t => t.is_active))
    } catch (error) {
      console.error('Error loading email templates:', error)
    }
  }

  const loadEmailSignatures = async () => {
    try {
      const signatures = await emailSignaturesAPI.getUserSignatures()
      setEmailSignatures(signatures)
      // Auto-select default signature
      const defaultSig = signatures.find(s => s.is_default)
      if (defaultSig) {
        setSelectedSignatureId(defaultSig.id)
      }
    } catch (error) {
      console.error('Error loading email signatures:', error)
    }
  }

  const handleSignatureSelect = (signatureId: string) => {
    setSelectedSignatureId(signatureId)
    const signature = emailSignatures.find(s => s.id === signatureId)
    if (signature && composeData.body) {
      // Append signature to existing body
      setComposeData(prev => ({
        ...prev,
        body: prev.body + '\n\n' + signature.signature_html
      }))
    } else if (signature) {
      // Set signature as body if body is empty
      setComposeData(prev => ({
        ...prev,
        body: signature.signature_html
      }))
    }
  }

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId('')
      setTemplateVariables({})
      setHtmlBody('')
      return
    }

    try {
      const template = await emailTemplatesAPI.getById(templateId)
      if (!template) {
        showToast('Template not found', 'error')
        return
      }

      setSelectedTemplateId(templateId)
      
      // Initialize template variables with placeholder values
      const initialVars: Record<string, string> = {}
      template.variables?.forEach((v: any) => {
        initialVars[v.name] = ''
      })
      setTemplateVariables(initialVars)

      // Set subject from template
      setComposeData(prev => ({
        ...prev,
        subject: template.subject,
      }))

      // Show template HTML immediately in preview mode with full design
      if (template.html_content) {
        // Render template with empty variables to show structure
        const preview = emailTemplatesAPI.render(template, initialVars)
        if (preview.html) {
          console.log('Template loaded, HTML length:', preview.html.length)
          console.log('HTML preview (first 200 chars):', preview.html.substring(0, 200))
          setHtmlBody(preview.html)
          // Switch to preview mode to show the full design
          setEmailViewMode('preview')
          // Also update compose body with HTML for fallback
          setComposeData(prev => ({
            ...prev,
            body: preview.html, // Set body to HTML so preview can show it
          }))
        } else {
          console.error('Template rendered empty HTML')
        }
      } else {
        console.error('Template has no HTML content')
      }
    } catch (error) {
      console.error('Error loading template:', error)
      showToast('Failed to load template', 'error')
    }
  }

  // Reset all compose email state
  const resetComposeState = () => {
    // Clear any pending template render timeout
    if (templateRenderTimeoutRef.current) {
      clearTimeout(templateRenderTimeoutRef.current)
      templateRenderTimeoutRef.current = null
    }
    
    setComposeData({
      to: '',
      toName: '',
      subject: '',
      body: '',
      emailType: 'manual',
      category: 'custom',
      tags: [],
      fromEmailAddressId: adminEmailAddresses[0]?.id || '',
      replyTo: '',
      cc: '',
      bcc: '',
    })
    setHtmlBody('')
    setEmailViewMode('html')
    setSelectedTemplateId('')
    setTemplateVariables({})
    setAttachments([])
    setShowAdvancedOptions(false)
    setIsMinimized(false)
  }
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (templateRenderTimeoutRef.current) {
        clearTimeout(templateRenderTimeoutRef.current)
      }
    }
  }, [])

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {
      showToast('No template selected', 'warning')
      return
    }

    try {
      // Fetch template from API to ensure we have the latest data
      const template = await emailTemplatesAPI.getById(selectedTemplateId)
      if (!template) {
        showToast('Template not found', 'error')
        return
      }

      // Check if template has HTML content
      if (!template.html_content) {
        showToast('Template has no HTML content', 'error')
        console.error('Template missing HTML content:', template)
        return
      }

      const rendered = emailTemplatesAPI.render(template, templateVariables)
      
      // Debug logging
      console.log('Applying template:', {
        templateId: selectedTemplateId,
        templateName: template.name,
        htmlContentLength: template.html_content?.length || 0,
        renderedHtmlLength: rendered.html?.length || 0,
        variables: templateVariables,
        renderedSubject: rendered.subject
      })
      
      // Set both HTML and text content
      if (rendered.html && rendered.html.trim().length > 0) {
        setHtmlBody(rendered.html)
        setComposeData(prev => ({
          ...prev,
          subject: rendered.subject,
          body: rendered.text || rendered.html, // Use text version if available, otherwise HTML
        }))
        
        // Switch to HTML view mode when template is applied
        setEmailViewMode('html')

        // Show success message
        showToast('Template applied successfully!', 'success')

        // Increment usage counter
        emailTemplatesAPI.incrementUsage(selectedTemplateId).catch(console.error)
      } else {
        showToast('Template rendered empty HTML content', 'error')
        console.error('Rendered HTML is empty or invalid:', {
          rendered,
          templateHtmlLength: template.html_content?.length,
          templateHtmlPreview: template.html_content?.substring(0, 100)
        })
      }
    } catch (error) {
      console.error('Error applying template:', error)
      showToast(`Failed to apply template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  // Handle tab change and update URL
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    // Use path-based navigation for cleaner URLs
    if (tab === 'email-setup') {
      // Default to admin tab when navigating to email-setup
      navigate('/admin/emails/email-setup/admin', { replace: true })
      setEmailTypeTab('admin')
    } else {
      navigate(`/admin/emails/${tab}`, { replace: true })
    }
    // Clear selections when switching tabs
    if (tab === 'sent') {
      setSelectedInboxIds(new Set())
    } else if (tab === 'inbox') {
      setSelectedSentIds(new Set())
    }
  }

  // Listen for location changes (browser back/forward)
  useEffect(() => {
    const tab = getInitialTab()
    if (tab !== activeTab) {
      setActiveTab(tab)
    }
    
    // Update email type tab if on email-setup
    if (tab === 'email-setup') {
      const emailType = getInitialEmailTypeTab()
      // Only update if different to prevent flickering
      if (emailType !== emailTypeTab) {
        setEmailTypeTab(emailType)
      }
    }
  }, [location.pathname, location.hash])

  const loadData = async () => {
    setLoading(true)
    try {
      const [logsResult, statsResult] = await Promise.all([
        emailLogsAPI.getAll({
          page: currentPage,
          pageSize: 50,
          status: statusFilter || undefined,
          emailType: typeFilter || undefined,
          emailCategory: categoryFilter || undefined,
          search: searchQuery || undefined,
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
        }),
        emailLogsAPI.getStats({
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
        }),
      ])

      setEmailLogs(logsResult.data)
      setSelectedSentEmailPreview(logsResult.data?.[0] || null)
      setTotalCount(logsResult.count)
      setTotalPages(logsResult.totalPages)
      setStats(statsResult)
    } catch (error) {
      console.error('Error loading email data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInboxEmails = async () => {
    setLoading(true)
    try {
      const result = await resendInboxAPI.list({
        limit: 50,
      })
      
      console.log('Admin Inbox - API Result:', result)
      console.log('Admin Inbox - Emails data:', result.data)
      console.log('Admin Inbox - Number of emails:', result.data?.length)
      
      if (result.data && result.data.length > 0) {
        console.log('Admin Inbox - Email TO addresses:', result.data.slice(0, 5).map(e => ({ 
          id: e.id, 
          to: e.to, 
          subject: e.subject,
          hasHtml: !!e.html,
          hasText: !!e.text,
          htmlLength: e.html?.length || 0,
          textLength: e.text?.length || 0,
        })))
      }
      
      // Get read email IDs from localStorage
      const getReadEmailIds = (): Set<string> => {
        try {
          const stored = localStorage.getItem('adminReadEmails')
          return stored ? new Set(JSON.parse(stored)) : new Set()
        } catch {
          return new Set()
        }
      }
      const readEmailIds = getReadEmailIds()
      
      // Enrich emails with sender details (name and avatar from DB)
      const enrichedEmails = await Promise.all(
        (result.data || []).map(async (email) => {
          const enriched: EnrichedReceivedEmail = { ...email }
          
          // Extract sender email
          const senderEmail = email.from.match(/<(.+?)>/)?.[1] || email.from
          
          // Try to get sender's full name and avatar from database
          try {
            const { data: userData, error } = await db
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
                const avatarUrl = await getSignedFileUrl(String(user.avatar_path), 3600, true) // silent=true for avatars
                if (avatarUrl) {
                  enriched.senderAvatar = avatarUrl
                }
              }
            }
          } catch (error) {
            console.error('Error fetching sender details:', error)
          }
          
          // Fallback to email display name or email prefix if no DB match
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
      
      setReceivedEmails(enrichedEmails)
      setSelectedInboxEmailPreview(enrichedEmails[0] || null)
      setInboxHasMore(result.has_more)
      
      // Update unread count in localStorage for sidebar badge
      // Count emails where isRead is false or undefined (treat undefined as unread)
      const unreadCount = enrichedEmails.filter(e => !e.isRead).length
      if (user?.id) {
        try {
          localStorage.setItem(`unreadEmailsCount_${user.id}`, JSON.stringify({
            count: unreadCount,
            timestamp: Date.now(),
          }))
          // Trigger event for sidebar to update
          window.dispatchEvent(new CustomEvent('emailsUpdated'))
        } catch (err) {
          // Ignore localStorage errors
          console.error('Error saving unread email count:', err)
        }
      }
    } catch (error: any) {
      console.error('Error loading inbox emails:', error)
      
      // Show appropriate error message based on error type
      let errorMessage = 'Failed to load inbox emails'
      
      if (error?.message?.includes('not configured') || error?.message?.includes('API key')) {
        errorMessage = 'Resend API key not configured. Please configure it in Admin Settings → Notifications.'
      } else if (error?.message?.includes('permission') || error?.message?.includes('denied')) {
        errorMessage = 'Permission denied to access inbox.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      showToast(`❌ ${errorMessage}`, 'error')
      
      // Set empty state
      setReceivedEmails([])
      setInboxHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  // getEmailPreview is now imported from utils

  const markAdminEmailAsRead = (emailId: string) => {
    try {
      const stored = localStorage.getItem('adminReadEmails')
      const readIds = stored ? new Set(JSON.parse(stored)) : new Set<string>()
      readIds.add(emailId)
      localStorage.setItem('adminReadEmails', JSON.stringify(Array.from(readIds)))
      
      // Update email in state to mark as read
      setReceivedEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, isRead: true } : e
      ))
      
      // Update unread count
      if (user?.id) {
        const currentCount = receivedEmails.filter(e => e.id !== emailId && !e.isRead).length
        localStorage.setItem(`unreadEmailsCount_${user.id}`, JSON.stringify({
          count: currentCount,
          timestamp: Date.now(),
        }))
        window.dispatchEvent(new CustomEvent('emailsUpdated'))
      }
    } catch (error) {
      console.error('Error marking email as read:', error)
    }
  }

  const handleViewSentEmail = async (email: EmailLog) => {
    try {
      // Fetch receiver information from database
      const receiverEmail = email.recipient_email
      let receiverName = email.recipient_name || ''
      let receiverAvatar: string | null = null
      
      if (receiverEmail) {
        try {
          const { data: userData, error } = await db
            .from('users')
            .select('id, first_name, middle_name, last_name, avatar_path')
            .eq('email', receiverEmail)
            .maybeSingle()
          
          if (!error && userData) {
            const user = userData as any
            const nameParts = [
              user.first_name,
              user.middle_name,
              user.last_name
            ].filter(Boolean)
            receiverName = nameParts.join(' ')
            
            if (user.avatar_path) {
              const avatarUrl = await getSignedFileUrl(String(user.avatar_path), 3600, true)
              if (avatarUrl) {
                receiverAvatar = avatarUrl
              }
            }
          }
        } catch (error) {
          console.error('Error fetching receiver details:', error)
        }
      }
      
      // Create enriched email with receiver info
      const enrichedEmail = {
        ...email,
        recipient_name: receiverName || email.recipient_name || email.recipient_email.split('@')[0],
        recipient_avatar: receiverAvatar,
      }
      
      setSelectedSentEmail(enrichedEmail as any)
      setShowEmailDetail(true)
    } catch (error: any) {
      console.error('Error loading email details:', error)
      // Fallback: show email anyway
      setSelectedSentEmail(email)
      setShowEmailDetail(true)
    }
  }

  const handleViewReceivedEmail = async (email: EnrichedReceivedEmail | ReceivedEmail) => {
    try {
      // Mark email as read
      markAdminEmailAsRead(email.id)
      
      // Check if email already has content (html/text)
      const hasContent = email.html || email.text
      
      console.log('Admin Inbox - Opening email:', {
        id: email.id,
        hasHtml: !!email.html,
        hasText: !!email.text,
        htmlLength: email.html?.length || 0,
        textLength: email.text?.length || 0,
      })
      
      // If email already has content from LIST API, use it directly
      if (hasContent) {
        console.log('Admin Inbox - Using content from LIST API')
        setSelectedInboxEmail(email as EnrichedReceivedEmail)
        setShowEmailDetail(true)
        return
      }
      
      // Otherwise, try to fetch full email content
      console.log('Admin Inbox - No content in LIST API, fetching full email for:', email.id)
      setLoading(true)
      
      try {
        const fullEmail = await resendInboxAPI.getById(email.id)
        
        console.log('Admin Inbox - Full email fetched:', {
          id: fullEmail.id,
          hasHtml: !!fullEmail.html,
          hasText: !!fullEmail.text,
          htmlLength: fullEmail.html?.length || 0,
          textLength: fullEmail.text?.length || 0,
        })
        
        // Merge the enriched data (sender info) with full email data
        const enrichedFullEmail: EnrichedReceivedEmail = {
          ...fullEmail,
          senderName: (email as EnrichedReceivedEmail).senderName,      // From list view
          senderAvatar: (email as EnrichedReceivedEmail).senderAvatar,  // From list view
        }
        
        setSelectedInboxEmail(enrichedFullEmail)
        setShowEmailDetail(true)
      } catch (fetchError: any) {
        console.error('Error fetching full email:', fetchError)
        // If fetch fails, still show the email (even without content)
        // The user can see the metadata at least
        setSelectedInboxEmail(email as EnrichedReceivedEmail)
        setShowEmailDetail(true)
        
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
      setLoading(false)
    }
  }

  const handleDeleteSent = async (emailId: string, subject: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'sent',
      emailId,
      emailSubject: subject
    })
  }

  const handleDeleteInbox = async (emailId: string, subject: string) => {
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
      
      // Clear selection if viewing this email
      if (selectedReceivedEmail?.id === emailId) {
        setSelectedReceivedEmail(null)
      }
    } catch (error: any) {
      console.error('Error hiding inbox email:', error)
      showToast(`❌ Failed to hide email: ${error.message}`, 'error')
    }
  }

  const handleBulkDelete = async () => {
    const selectedIds = activeTab === 'sent' ? selectedSentIds : selectedInboxIds
    
    if (selectedIds.size === 0) {
      showToast('Please select at least one email to delete', 'warning')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} email(s)? This action cannot be undone.`)) {
      return
    }

    try {
      if (activeTab === 'sent') {
        await emailLogsAPI.bulkDelete(Array.from(selectedIds))
        setSelectedSentIds(new Set())
        loadData()
      } else {
        // Delete inbox emails one by one
        const errors: string[] = []
        for (const emailId of Array.from(selectedIds)) {
          try {
            await resendInboxAPI.delete(emailId)
          } catch (error) {
            console.error(`Failed to delete email ${emailId}:`, error)
            errors.push(emailId)
          }
        }
        
        setSelectedInboxIds(new Set())
        loadInboxEmails()
        
        if (errors.length > 0) {
          showToast(`Failed to delete ${errors.length} email(s). ${selectedIds.size - errors.length} deleted successfully.`, 'warning')
        } else {
          showToast(`${selectedIds.size} email(s) deleted successfully`, 'success')
        }
      }
    } catch (error) {
      console.error('Error deleting emails:', error)
      showToast('Failed to delete emails', 'error')
    }
  }

  const toggleSentSelection = (id: string) => {
    const newSelection = new Set(selectedSentIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedSentIds(newSelection)
  }

  // Email Signatures functions
  const loadSignaturesData = async () => {
    try {
      setLoading(true)
      const sigs = await emailSignaturesAPI.getAll()
      setSignatures(sigs)
    } catch (error) {
      console.error('Error loading signatures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSignature = () => {
    setEditingSignature({
      name: '',
      signature_html: '',
      signature_text: '',
      signature_type: 'personal',
      is_active: true,
      is_default: false,
    })
    setShowSignatureEditor(true)
  }

  const handleEditSignature = (signature: EmailSignature) => {
    setEditingSignature(signature)
    setShowSignatureEditor(true)
  }

  const handleDeleteSignature = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      await emailSignaturesAPI.delete(id)
      showToast('Signature deleted successfully', 'success')
      loadSignaturesData()
    } catch (error) {
      console.error('Error deleting signature:', error)
      showToast('Failed to delete signature', 'error')
    }
  }

  const handleSetDefaultSignature = async (id: string) => {
    try {
      await emailSignaturesAPI.setDefault(id)
      showToast('Default signature updated', 'success')
      loadSignaturesData()
    } catch (error) {
      console.error('Error setting default signature:', error)
      showToast('Failed to set default signature', 'error')
    }
  }

  // Email Setup functions
  const loadEmailSetupData = async () => {
    try {
      setLoading(true)
      const [addresses, logos] = await Promise.all([
        (async () => {
          const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
          // Load ALL email addresses, not just admin ones, to show noreply and support
          return emailAddressesAPI.getAll()
        })(),
        businessLogosAPI.getAll().catch((error) => {
          // Handle missing table gracefully
          if ((error as any)?.code === 'PGRST205') {
            console.warn('business_logos table not found. Run database migrations to enable logo management.')
            return []
          }
          throw error
        }),
      ])
      setAdminEmailAddresses(addresses)
      setBusinessLogos(logos)
    } catch (error) {
      console.error('Error loading email setup data:', error)
      // Don't show toast here as this is called on mount and errors are expected if tables don't exist
    } finally {
      setLoading(false)
    }
  }

  // Compress image before upload
  const compressImage = async (file: File, maxWidth: number = 512, maxHeight: number = 512, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width
          let height = img.height
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = width * ratio
            height = height * ratio
          }
          
          // Create canvas and compress
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }
          
          // Enable high-quality image rendering
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'))
                return
              }
              
              // Create new file with compressed blob
              const compressedFile = new File([blob], file.name, {
                type: file.type.startsWith('image/png') ? 'image/png' : 'image/jpeg',
                lastModified: Date.now(),
              })
              
              resolve(compressedFile)
            },
            file.type.startsWith('image/png') ? 'image/png' : 'image/jpeg',
            quality
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>, logoType: BusinessLogo['logo_type'], assignToEmailId?: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'warning')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB', 'warning')
      return
    }

    try {
      setUploadingLogo(true)
      
      // Compress image before upload (max 512x512 for avatars)
      const maxSize = logoType === 'avatar' ? 512 : 2000
      const compressedFile = await compressImage(file, maxSize, maxSize, 0.8)
      
      // Show preview immediately if editing email
      if (assignToEmailId && logoType === 'avatar') {
        const previewUrl = URL.createObjectURL(compressedFile)
        setUploadedAvatarPreview(previewUrl)
      }
      
      const uploadedLogo = await businessLogosAPI.upload(compressedFile, logoType, file.name)
      showToast('Avatar uploaded successfully', 'success')
      
      // Reload business logos to include the new one
      await loadEmailSetupData()
      
      // If editing an email, automatically assign the uploaded avatar to it
      if (assignToEmailId && logoType === 'avatar') {
        await handleAssignLogo(assignToEmailId, uploadedLogo.id)
        
        // Clear preview URL so the actual avatar from storage is shown
        if (uploadedAvatarPreview) {
          URL.revokeObjectURL(uploadedAvatarPreview)
          setUploadedAvatarPreview(null)
        }
        
        // Update editingEmail to show new avatar immediately
        if (editingEmail) {
          // Reload the email to get fresh data including the new logo
          const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
          const updatedEmail = await emailAddressesAPI.getById(editingEmail.id)
          setEditingEmail(updatedEmail)
        }
      }
      
      setShowLogoUpload(false)
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      const errorMessage = error.message || 'Failed to upload logo'
      if (errorMessage.includes('Bucket not found')) {
        showToast('Storage bucket not configured. Please run database migrations.', 'error')
      } else {
        showToast(errorMessage, 'error')
      }
      // Clear preview on error
      if (uploadedAvatarPreview) {
        URL.revokeObjectURL(uploadedAvatarPreview)
        setUploadedAvatarPreview(null)
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleEditEmail = (email: any) => {
    setEditingEmail(email)
    setShowEmailEditor(true)
    // Clear any previous preview when opening editor
    if (uploadedAvatarPreview) {
      URL.revokeObjectURL(uploadedAvatarPreview)
      setUploadedAvatarPreview(null)
    }
  }

  const handleSaveEmail = async () => {
    if (!editingEmail) return

    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      await emailAddressesAPI.update(editingEmail.id, {
        display_name: editingEmail.display_name,
        department: editingEmail.department,
        can_send: editingEmail.can_send,
        can_receive: editingEmail.can_receive,
        is_active: editingEmail.is_active,
        metadata: editingEmail.metadata || {},
      })
      showToast('Email address updated successfully', 'success')
      setShowEmailEditor(false)
      setEditingEmail(null)
      // Clean up preview URL
      if (uploadedAvatarPreview) {
        URL.revokeObjectURL(uploadedAvatarPreview)
        setUploadedAvatarPreview(null)
      }
      loadEmailSetupData()
    } catch (error) {
      console.error('Error updating email address:', error)
      showToast('Failed to update email address', 'error')
    }
  }

  const handleAddEmail = async () => {
    if (!newEmailData.email_address) {
      showToast('Please enter an email address', 'warning')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmailData.email_address)) {
      showToast('Please enter a valid email address', 'warning')
      return
    }

    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      
      // Check if email already exists
      const existingEmail = await emailAddressesAPI.getByEmail(newEmailData.email_address.toLowerCase())
      if (existingEmail) {
        showToast(`Email address "${newEmailData.email_address}" already exists in the system. Please use a different email address.`, 'warning')
        return
      }

      await emailAddressesAPI.create({
        ...newEmailData,
        email_address: newEmailData.email_address.toLowerCase(), // Normalize to lowercase
        is_system_address: true,
        is_active: true,
        is_verified: false,
      })
      showToast('Email address added successfully', 'success')
      setShowAddEmailModal(false)
      setNewEmailData({
        email_address: '',
        display_name: '',
        address_type: 'admin',
        department: '',
        can_send: true,
        can_receive: true,
      })
      loadEmailSetupData()
    } catch (error: any) {
      console.error('Error adding email address:', error)
      
      // Handle specific error cases
      if (error?.code === '23505' || error?.message?.includes('duplicate key') || error?.message?.includes('unique constraint')) {
        showToast(`Email address "${newEmailData.email_address}" already exists in the system. Please use a different email address.`, 'warning')
      } else if (error?.message) {
        showToast(`Failed to add email address: ${error.message}`, 'error')
      } else {
        showToast('Failed to add email address. Please try again.', 'error')
      }
    }
  }

  const handleDeleteEmail = async (id: string, emailAddress: string) => {
    if (!confirm(`Are you sure you want to delete "${emailAddress}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      await emailAddressesAPI.delete(id)
      showToast('Email address deleted successfully', 'success')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error deleting email address:', error)
      showToast('Failed to delete email address', 'error')
    }
  }

  const handleAssignLogo = async (emailId: string, logoId: string | null) => {
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      const email = await emailAddressesAPI.getById(emailId)
      const updatedMetadata = {
        ...(email.metadata || {}),
        logo_id: logoId,
      }
      await emailAddressesAPI.update(emailId, { metadata: updatedMetadata })
      showToast('Logo assigned successfully', 'success')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error assigning logo:', error)
      showToast('Failed to assign logo', 'error')
    }
  }

  // Helper functions are now imported from utils
  // Note: getEmailLogo and getAvatarForEmail need businessLogos and adminEmailAddresses as parameters
  const getEmailLogoLocal = (email: any): BusinessLogo | null => {
    if (!email || !businessLogos || businessLogos.length === 0) return null
    
    // Get logo from email address metadata
    const logoId = email.metadata?.logo_id
    if (!logoId) return null
    
    return businessLogos.find((logo) => logo.id === logoId && logo.logo_type === 'avatar') || null
  }
  
  const getAvatarForEmailLocal = (emailAddress: string): BusinessLogo | null => {
    // Extract email from string (handle formats like "Name <email@domain.com>" or just "email@domain.com")
    const emailMatch = emailAddress.match(/<([^>]+)>/) || [emailAddress]
    const cleanEmail = emailMatch[1] || emailMatch[0]
    
    // Find matching email address in adminEmailAddresses
    const emailAddr = adminEmailAddresses.find(
      addr => addr.email_address.toLowerCase() === cleanEmail.toLowerCase()
    )
    
    if (!emailAddr) return null
    
    // Get logo from email address metadata
    const logoId = emailAddr.metadata?.logo_id
    if (!logoId) return null
    
    return businessLogos.find((logo) => logo.id === logoId && logo.logo_type === 'avatar') || null
  }

  // Get default avatar display (initials) for an email
  const getDefaultAvatarDisplay = (email: any) => {
    const displayName = email.display_name || email.email_address
    const initials = getInitials(displayName)
    const bgColor = getAvatarColor(displayName)
    const bgColorDark = getAvatarColorDark(displayName)
    const textColor = getAvatarTextColor(displayName)
    const textColorDark = getAvatarTextColorDark(displayName)
    
    return { initials, bgColor, bgColorDark, textColor, textColorDark }
  }

  // Email Avatar Component - handles signed URLs for avatars
  const EmailAvatar = ({ avatar, email, size = 'sm' }: { 
    avatar: BusinessLogo
    email: any
    size?: 'sm' | 'md' | 'lg'
  }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(avatar.public_url || null)
    const [imgError, setImgError] = useState(false)
    const [loading, setLoading] = useState(!avatar.public_url && !!avatar.storage_path)
    
    const sizeClasses = {
      sm: 'h-6 w-6 text-[10px]',
      md: 'h-8 w-8 text-xs',
      lg: 'h-10 w-10 text-sm'
    }
    
    useEffect(() => {
      // If no public URL or public URL fails, try signed URL
      if (avatar.storage_path && !imgSrc && !imgError && loading) {
        getSignedFileUrl(avatar.storage_path, 3600, true)
          .then(url => {
            if (url) {
              setImgSrc(url)
              setImgError(false)
            } else {
              setImgError(true)
            }
          })
          .catch(() => {
            setImgError(true)
          })
          .finally(() => {
            setLoading(false)
          })
      }
    }, [avatar.storage_path, imgSrc, imgError, loading])
    
    if (loading) {
      return (
        <div className={cn(
          "rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse border border-gray-200 dark:border-gray-700",
          sizeClasses[size]
        )} />
      )
    }
    
    if (imgError || !imgSrc) {
      const defaultAvatar = getDefaultAvatarDisplay(email)
      return (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-semibold border border-gray-200 dark:border-gray-700",
            sizeClasses[size],
            defaultAvatar.bgColor,
            defaultAvatar.bgColorDark,
            defaultAvatar.textColor,
            defaultAvatar.textColorDark
          )}
          title={email.display_name || email.email_address}
        >
          {defaultAvatar.initials}
        </div>
      )
    }
    
    return (
      <img
        src={imgSrc}
        alt={avatar.alt_text || 'Avatar'}
        className={cn(
          "rounded-full object-cover border border-gray-200 dark:border-gray-700",
          sizeClasses[size]
        )}
        onError={async () => {
          // Try signed URL if public URL fails
          if (avatar.storage_path && !imgError) {
            try {
              const signedUrl = await getSignedFileUrl(avatar.storage_path, 3600, true)
              if (signedUrl) {
                setImgSrc(signedUrl)
                setImgError(false)
              } else {
                setImgError(true)
              }
            } catch {
              setImgError(true)
            }
          } else {
            setImgError(true)
          }
        }}
      />
    )
  }

  // Toggle active/inactive status
  const handleToggleActive = async (emailId: string, currentStatus: boolean) => {
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      await emailAddressesAPI.update(emailId, { is_active: !currentStatus })
      showToast(`Email address ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error toggling active status:', error)
      showToast('Failed to update email status', 'error')
    }
  }

  // Memoize filtered emails and counts to prevent flickering
  const filteredEmails = useMemo(() => {
    return emailTypeTab === 'admin'
      ? adminEmailAddresses.filter(e => e.address_type !== 'client')
      : adminEmailAddresses.filter(e => e.address_type === 'client')
  }, [emailTypeTab, adminEmailAddresses])

  const adminEmailCount = useMemo(() => {
    return adminEmailAddresses.filter(e => e.address_type !== 'client').length
  }, [adminEmailAddresses])

  const clientEmailCount = useMemo(() => {
    return adminEmailAddresses.filter(e => e.address_type === 'client').length
  }, [adminEmailAddresses])

  const toggleInboxSelection = (id: string) => {
    const newSelection = new Set(selectedInboxIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedInboxIds(newSelection)
  }

  const toggleSelectAllSent = () => {
    if (selectedSentIds.size === emailLogs.length) {
      setSelectedSentIds(new Set())
    } else {
      setSelectedSentIds(new Set(emailLogs.map(log => log.id)))
    }
  }

  const toggleSelectAllInbox = () => {
    if (selectedInboxIds.size === receivedEmails.length) {
      setSelectedInboxIds(new Set())
    } else {
      setSelectedInboxIds(new Set(receivedEmails.map(email => email.id)))
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

  const handleSendEmail = async (attachments?: File[], scheduledFor?: Date) => {
    if (!composeData.to || !composeData.subject || (!composeData.body && !htmlBody)) {
      showToast('Please fill in all required fields', 'warning')
      return
    }

    setSending(true)
    try {
      let emailHtml = ''
      let finalSubject = composeData.subject
      
      // If a template is selected, re-render it with current variables
      if (selectedTemplateId && Object.keys(templateVariables).length > 0) {
        try {
          const template = await emailTemplatesAPI.getById(selectedTemplateId)
          if (template && template.html_content) {
            const rendered = emailTemplatesAPI.render(template, templateVariables)
            if (rendered.html && rendered.html.trim().length > 0) {
              emailHtml = rendered.html
              // Use rendered subject if available, otherwise keep current subject
              if (rendered.subject) {
                finalSubject = rendered.subject
              }
            } else {
              console.error('Template rendered empty HTML')
              showToast('Template rendered empty content. Using current body.', 'warning')
              emailHtml = htmlBody || (composeData.body ? convertTextToHtml(composeData.body) : '')
            }
          } else {
            // Fallback to htmlBody or body
            emailHtml = htmlBody || (composeData.body ? convertTextToHtml(composeData.body) : '')
          }
        } catch (error) {
          console.error('Error rendering template before send:', error)
          showToast('Error rendering template. Using current body.', 'warning')
          emailHtml = htmlBody || (composeData.body ? convertTextToHtml(composeData.body) : '')
        }
      } else {
        // Use htmlBody if available (from template or location.state), otherwise convert plain text to HTML
        emailHtml = htmlBody || (composeData.body ? convertTextToHtml(composeData.body) : '')
      }
      
      // If scheduled, create a scheduled email entry instead of sending immediately
      if (scheduledFor) {
        // TODO: Implement scheduled email storage
        // For now, we'll store it in a scheduled_emails table or similar
        // This is a placeholder - you'll need to implement the actual scheduling logic
        showToast('Email scheduling feature coming soon!', 'info')
        setSending(false)
        return
      }
      
      const success = await sendEmailWithLogging({
        to: composeData.to,
        toName: composeData.toName,
        subject: finalSubject,
        html: emailHtml,
        emailType: composeData.emailType,
        emailCategory: composeData.category,
        tags: composeData.tags,
        fromEmailAddressId: composeData.fromEmailAddressId || undefined,
        replyTo: composeData.replyTo || undefined,
        cc: composeData.cc || undefined,
        bcc: composeData.bcc || undefined,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
      })

      if (success) {
        showToast('Email sent successfully!', 'success')
        setComposing(false)
        resetComposeState()
        loadData()
      } else {
        showToast('Failed to send email. Please check your email configuration.', 'error')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      showToast('Failed to send email', 'error')
    } finally {
      setSending(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setTypeFilter('')
    setCategoryFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

  const exportToCSV = () => {
    exportToCSVUtil(emailLogs, format)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  <Mail className="h-8 w-8 text-primary-600" />
                  Email Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Enterprise email system with analytics and tracking
                </p>
              </div>
              <button
                onClick={() => {
                  resetComposeState()
                  setComposing(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Compose Email
              </button>
            </div>
          </div>

          {/* Stats Cards - Email Management Analytics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Emails</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {stats.total.toLocaleString()}
                    </p>
                  </div>
                  <Mail className="h-10 w-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Delivered</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {stats.delivered.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{stats.deliveryRate}% rate</p>
                  </div>
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      {stats.failed.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{stats.failureRate}% rate</p>
                  </div>
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Send Time</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {stats.avgSendTime.toFixed(1)}s
                    </p>
                  </div>
                  <Activity className="h-10 w-10 text-purple-500" />
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                <button
                  onClick={() => handleTabChange('inbox')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'inbox'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Mail className="h-4 w-4 inline-block mr-2" />
                  Inbox
                </button>
                <button
                  onClick={() => handleTabChange('sent')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'sent'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Send className="h-4 w-4 inline-block mr-2" />
                  Sent Items
                </button>
                <button
                  onClick={() => handleTabChange('scheduled')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'scheduled'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Clock className="h-4 w-4 inline-block mr-2" />
                  Scheduled
                </button>
                <button
                  onClick={() => handleTabChange('analytics')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'analytics'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Activity className="h-4 w-4 inline-block mr-2" />
                  Analytics
                </button>
                <button
                  onClick={() => handleTabChange('campaigns')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'campaigns'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Mail className="h-4 w-4 inline-block mr-2" />
                  Campaigns
                </button>
                <button
                  onClick={() => handleTabChange('ab-testing')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'ab-testing'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <FlaskConical className="h-4 w-4 inline-block mr-2" />
                  A/B Testing
                </button>
                <button
                  onClick={() => handleTabChange('subscribers')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'subscribers'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Users className="h-4 w-4 inline-block mr-2" />
                  Subscribers
                </button>
                <button
                  onClick={() => handleTabChange('templates')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'templates'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <FileText className="h-4 w-4 inline-block mr-2" />
                  Templates
                </button>
                <button
                  onClick={() => handleTabChange('signatures')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'signatures'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <PenTool className="h-4 w-4 inline-block mr-2" />
                  Signatures
                </button>
                <button
                  onClick={() => handleTabChange('email-setup')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'email-setup'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Settings className="h-4 w-4 inline-block mr-2" />
                  Email Setup
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Sent Items Tab */}
              {activeTab === 'sent' && (
                    <>
                      {/* Bulk Actions Toolbar */}
                      {selectedSentIds.size > 0 && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {selectedSentIds.size} email(s) selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedSentIds(new Set())}
                              className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
                            >
                              Clear Selection
                            </button>
                            <button
                              onClick={handleBulkDelete}
                              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Selected
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Filters and Search */}
                      <div className="mb-6 space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <div className="flex-1 min-w-[300px]">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search by email, subject, or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Filter className="h-5 w-5" />
                            Filters
                          </button>
                          <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Download className="h-5 w-5" />
                            Export
                          </button>
                          <button
                            onClick={loadData}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <RefreshCw className="h-5 w-5" />
                            Refresh
                          </button>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium mb-2">Status</label>
                              <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="sent">Sent</option>
                                <option value="delivered">Delivered</option>
                                <option value="failed">Failed</option>
                                <option value="bounced">Bounced</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Type</label>
                              <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              >
                                <option value="">All Types</option>
                                <option value="transactional">Transactional</option>
                                <option value="notification">Notification</option>
                                <option value="marketing">Marketing</option>
                                <option value="manual">Manual</option>
                                <option value="automated">Automated</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Start Date</label>
                              <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">End Date</label>
                              <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div className="col-span-full flex justify-end">
                              <button
                                onClick={clearFilters}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                Clear all filters
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email List */}
                      {loading ? (
                        <div className="py-12">
                          <Loading text="Loading emails..." />
                        </div>
                      ) : emailLogs.length === 0 ? (
                        <div className="text-center py-12">
                          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400">No emails found</p>
                        </div>
                      ) : (
                        <>
                          {/* Gmail-style Compact Email List */}
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
                                    if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                                        (e.target as HTMLElement).closest('button')) {
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
                                      {(() => {
                                        const avatar = getAvatarForEmailLocal(log.sender_email);
                                        return avatar && avatar.storage_path ? (
                                          <EmailAvatar
                                            avatar={avatar}
                                            email={{ display_name: log.sender_email, email_address: log.sender_email }}
                                            size="lg"
                                          />
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                                            <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 min-w-0 pr-2">
                                      {/* Recipient & Status (Mobile: stacked, Desktop: inline) */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                                        <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none">
                                              {(() => {
                                                const recipient = log.recipient_name || log.recipient_email.split('@')[0];
                                                return recipient.length > 20 ? recipient.substring(0, 20) + '...' : recipient;
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
                                              {(log.subject && log.subject.length > 40 ? log.subject.substring(0, 40) + '...' : log.subject) || '(no subject)'}
                                            </span>
                                            <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate ml-1">
                                              - {getEmailPreview(log.body_html || undefined, log.body_text || undefined, 50)}
                                            </span>
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
                                        onClick={() => handleDeleteSent(log.id, log.subject || '(no subject)')}
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
                                      onClick={() => handleDeleteSent(log.id, log.subject || '(no subject)')}
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

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Showing {(currentPage - 1) * 50 + 1} to{' '}
                            {Math.min(currentPage * 50, totalCount)} of {totalCount} emails
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-2">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const page = i + 1
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                      'px-4 py-2 border rounded-lg',
                                      currentPage === page
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                  >
                                    {page}
                                  </button>
                                )
                              })}
                            </div>
                            <button
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                </>
              )}

              {/* Inbox Tab */}
              {activeTab === 'inbox' && (
                    <>
                      {/* Bulk Actions Toolbar */}
                      {selectedInboxIds.size > 0 && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {selectedInboxIds.size} email(s) selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedInboxIds(new Set())}
                              className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
                            >
                              Clear Selection
                            </button>
                            <button
                              onClick={handleBulkDelete}
                              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Selected
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Search and Filters */}
                      <div className="mb-6 space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <div className="flex-1 min-w-[300px]">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search inbox by sender, subject..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Filter className="h-5 w-5" />
                            Filters
                          </button>
                          <button
                            onClick={() => {
                              // Export inbox emails to CSV
                              const headers = ['Date', 'From', 'To', 'Subject', 'Message ID']
                              const rows = receivedEmails.map(email => [
                                format(new Date(email.created_at), 'yyyy-MM-dd HH:mm:ss'),
                                email.from,
                                email.to.join('; '),
                                email.subject,
                                email.message_id || '',
                              ])
                              const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
                              const blob = new Blob([csv], { type: 'text/csv' })
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `inbox-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`
                              a.click()
                            }}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Download className="h-5 w-5" />
                            Export
                          </button>
                          <button
                            onClick={loadInboxEmails}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <RefreshCw className="h-5 w-5" />
                            Refresh
                          </button>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium mb-2">Sender</label>
                              <input
                                type="text"
                                placeholder="Filter by sender..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Start Date</label>
                              <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">End Date</label>
                              <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div className="col-span-full flex justify-end">
                              <button
                                onClick={clearFilters}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                Clear all filters
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email List */}
                      {loading ? (
                        <div className="py-12">
                          <Loading text="Loading inbox..." />
                        </div>
                      ) : receivedEmails.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
                          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
                            <Mail className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            No Received Messages
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
                            Your inbox is empty. Emails received via Resend will appear here.
                          </p>
                          <div className="text-left max-w-2xl mx-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                              📧 Setup Resend Email Receiving
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                              To receive emails, configure Resend with these steps:
                            </p>
                            <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-2 mb-4">
                              <li>Go to <button onClick={() => navigate('/admin/settings')} className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-100">Admin Settings → Notifications</button></li>
                              <li>Enter your Resend API key in the email configuration</li>
                              <li>Configure your domain in <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900 dark:hover:text-blue-100">Resend Dashboard</a></li>
                              <li>Set up inbound email routing rules in Resend</li>
                              <li>Forward emails to your verified domains</li>
                            </ol>
                            <div className="flex gap-3">
                              <button
                                onClick={() => navigate('/admin/settings')}
                                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                              >
                                ⚙️ Go to Settings
                              </button>
                              <a
                                href="https://resend.com/docs/api-reference/emails/list-received-emails"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm px-4 py-2 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium transition-colors inline-block"
                              >
                                📚 View Documentation
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Gmail-style Compact Email List */}
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
                                  className="group relative flex flex-col sm:flex-row sm:items-center px-2 py-2 hover:shadow-sm transition-all cursor-pointer border-l-4 border-transparent hover:border-l-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                  onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                                        (e.target as HTMLElement).closest('button')) {
                                      return
                                    }
                                    handleViewReceivedEmail(email)
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

                                    {/* Avatar - Gmail Style */}
                                    <div className="w-10 h-10 flex-shrink-0 mr-2 sm:mr-3">
                                      {(() => {
                                        const enrichedEmail = email as EnrichedReceivedEmail
                                        // Use sender avatar if available
                                        if (enrichedEmail.senderAvatar) {
                                          return (
                                            <img
                                              src={enrichedEmail.senderAvatar}
                                              alt={enrichedEmail.senderName || 'Avatar'}
                                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                                            />
                                          )
                                        }
                                        // Fallback to business logo if available
                                        const avatar = getAvatarForEmailLocal(email.from)
                                        if (avatar && avatar.storage_path) {
                                          return (
                                            <EmailAvatar
                                              avatar={avatar}
                                              email={{ display_name: email.from, email_address: email.from }}
                                              size="lg"
                                            />
                                          )
                                        }
                                        // Show sender initial in colored circle
                                        const senderName = enrichedEmail.senderName || (email.from.includes('<') 
                                          ? email.from.split('<')[0].trim() 
                                          : email.from.split('@')[0])
                                        const initial = (senderName[0] || 'U').toUpperCase()
                                        // Generate consistent color based on sender
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
                                        const colorIndex = initial.charCodeAt(0) % colors.length
                                        return (
                                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
                                            {initial}
                                          </div>
                                        )
                                      })()}
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 min-w-0 pr-2">
                                      {/* Sender & Attachment Icon (Mobile: stacked, Desktop: inline) */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                                        <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none">
                                              {(() => {
                                                const enrichedEmail = email as EnrichedReceivedEmail
                                                const sender = enrichedEmail.senderName || (email.from.includes('<') ? email.from.split('<')[0].trim() : email.from.split('@')[0])
                                                return sender.length > 20 ? sender.substring(0, 20) + '...' : sender
                                              })()}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Subject & Preview */}
                                        <div className="flex-1 min-w-0 sm:px-2">
                                          <div className="flex items-center gap-1">
                                            {email.attachments && email.attachments.length > 0 && (
                                              <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            )}
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                              {(email.subject && email.subject.length > 40 ? email.subject.substring(0, 40) + '...' : email.subject) || '(no subject)'}
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
                                          <span className="text-xs text-gray-500">
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
                                        onClick={() => handleDeleteInbox(email.id, email.subject || '(no subject)')}
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
                                      onClick={() => handleDeleteInbox(email.id, email.subject || '(no subject)')}
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

                          {/* Load More */}
                          {inboxHasMore && (
                            <div className="mt-6 flex justify-center">
                              <button
                                onClick={loadInboxEmails}
                                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                              >
                                Load More Emails
                              </button>
                            </div>
                          )}
                        </>
                      )}
                </>
              )}

              {/* Templates Tab */}
              {activeTab === 'scheduled' && (
                <ScheduledEmailsTab showToast={showToast} />
              )}

              {activeTab === 'analytics' && (
                <EmailAnalyticsTab showToast={showToast} />
              )}

              {activeTab === 'campaigns' && (
                <CampaignsTab showToast={showToast} />
              )}

              {activeTab === 'ab-testing' && (
                <ABTestingTab showToast={showToast} />
              )}

              {activeTab === 'subscribers' && (
                <SubscribersTab showToast={showToast} />
              )}

              {activeTab === 'templates' && <EmailTemplatesManager />}

              {/* Signatures Tab */}
              {activeTab === 'signatures' && (
                <SignaturesTab
                  signatures={signatures}
                  loading={loading}
                  onCreateSignature={handleCreateSignature}
                  onEditSignature={handleEditSignature}
                  onSetDefaultSignature={handleSetDefaultSignature}
                  onDeleteSignature={handleDeleteSignature}
                />
              )}

              {/* Email Setup Tab */}
              {activeTab === 'email-setup' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Setup</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Manage admin business emails and client emails
                    </p>
                  </div>

                  {loading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Tab Navigation */}
                      <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                          <button
                            onClick={() => {
                              setEmailTypeTab('admin')
                              navigate('/admin/emails/email-setup/admin', { replace: true })
                            }}
                            className={cn(
                              "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                              emailTypeTab === 'admin'
                                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                            )}
                          >
                            Admin
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {adminEmailCount}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setEmailTypeTab('client')
                              navigate('/admin/emails/email-setup/client', { replace: true })
                            }}
                            className={cn(
                              "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                              emailTypeTab === 'client'
                                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                            )}
                          >
                            Client
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {clientEmailCount}
                            </span>
                          </button>
                        </nav>
                      </div>

                      {/* Business Emails Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {emailTypeTab === 'admin' ? 'Admin Business Emails' : 'Client Emails'}
                          </h3>
                          {emailTypeTab === 'admin' && (
                            <button
                              onClick={() => {
                                setNewEmailData({
                                  ...newEmailData,
                                  address_type: 'admin'
                                })
                                setShowAddEmailModal(true)
                              }}
                              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Email Address
                            </button>
                          )}
                        </div>

                        {(() => {
                          if (filteredEmails.length === 0) {
                            return (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                {emailTypeTab === 'admin' ? 'No Admin Emails' : 'No Client Emails'}
                              </h4>
                              <p className="text-gray-500 dark:text-gray-400 mb-4">
                                {emailTypeTab === 'admin' 
                                  ? 'Add your first admin business email address'
                                  : 'No client emails found in the database. Client emails are automatically created when users register.'}
                              </p>
                              {emailTypeTab === 'admin' && (
                                <button
                                  onClick={() => {
                                    setNewEmailData({
                                      ...newEmailData,
                                      address_type: 'admin'
                                    })
                                    setShowAddEmailModal(true)
                                  }}
                                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                >
                                  Add Email Address
                                </button>
                              )}
                              {emailTypeTab === 'client' && (
                                <button
                                  onClick={() => {
                                    loadEmailSetupData()
                                    showToast('Refreshing client emails from database...', 'info')
                                  }}
                                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 mx-auto"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Refresh from Database
                                </button>
                              )}
                            </div>
                            )
                          }
                          
                          return (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Email Address
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Display Name
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Avatar
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Type
                                      </th>
                                      {emailTypeTab === 'admin' && (
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                          Department
                                        </th>
                                      )}
                                      {emailTypeTab === 'client' && (
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                          Status
                                        </th>
                                      )}
                                      {emailTypeTab === 'admin' && (
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                          Status
                                        </th>
                                      )}
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Capabilities
                                      </th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredEmails.map((email) => (
                                    <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <Mail className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                            {email.email_address}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span className="text-xs text-gray-900 dark:text-gray-100">
                                          {email.display_name || '-'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        {(() => {
                                          const avatar = getEmailLogoLocal(email)
                                          if (avatar && avatar.storage_path) {
                                            // Use EmailAvatar component that handles signed URLs
                                            return (
                                              <EmailAvatar
                                                avatar={avatar}
                                                email={email}
                                              />
                                            )
                                          } else {
                                            const defaultAvatar = getDefaultAvatarDisplay(email)
                                            return (
                                              <div
                                                className={cn(
                                                  "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold border border-gray-200 dark:border-gray-700",
                                                  defaultAvatar.bgColor,
                                                  defaultAvatar.bgColorDark,
                                                  defaultAvatar.textColor,
                                                  defaultAvatar.textColorDark
                                                )}
                                                title={email.display_name || email.email_address}
                                              >
                                                {defaultAvatar.initials}
                                              </div>
                                            )
                                          }
                                        })()}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={cn(
                                          "px-1.5 py-0.5 text-[10px] font-medium rounded-full capitalize",
                                          email.address_type === 'admin' && "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
                                          email.address_type === 'client' && "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
                                          email.address_type === 'support' && "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                                          email.address_type === 'noreply' && "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300",
                                          email.address_type === 'department' && "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                                        )}>
                                          {email.address_type}
                                        </span>
                                      </td>
                                      {emailTypeTab === 'admin' && (
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {email.department || '-'}
                                          </span>
                                        </td>
                                      )}
                                      {emailTypeTab === 'client' && (
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <button
                                            onClick={() => handleToggleActive(email.id, email.is_active)}
                                            className={cn(
                                              "px-1.5 py-0.5 text-[10px] font-medium rounded-full transition-colors flex items-center gap-0.5",
                                              email.is_active
                                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                                                : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                            )}
                                            title={`Click to ${email.is_active ? 'deactivate' : 'activate'}`}
                                          >
                                            {email.is_active ? (
                                              <>
                                                <CheckCircle2 className="h-2.5 w-2.5" />
                                                Active
                                              </>
                                            ) : (
                                              <>
                                                <EyeOff className="h-2.5 w-2.5" />
                                                Inactive
                                              </>
                                            )}
                                          </button>
                                        </td>
                                      )}
                                      {emailTypeTab === 'admin' && (
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <div className="flex items-center gap-1">
                                            {email.is_verified && (
                                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 flex items-center gap-0.5">
                                                <CheckCircle2 className="h-2.5 w-2.5" />
                                                Verified
                                              </span>
                                            )}
                                            <button
                                              onClick={() => handleToggleActive(email.id, email.is_active)}
                                              className={cn(
                                                "px-1.5 py-0.5 text-[10px] font-medium rounded-full transition-colors flex items-center gap-0.5",
                                                email.is_active
                                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                                                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                              )}
                                              title={`Click to ${email.is_active ? 'deactivate' : 'activate'}`}
                                            >
                                              {email.is_active ? (
                                                <>
                                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                                  Active
                                                </>
                                              ) : (
                                                <>
                                                  <EyeOff className="h-2.5 w-2.5" />
                                                  Inactive
                                                </>
                                              )}
                                            </button>
                                            {email.is_primary && (
                                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 flex items-center gap-0.5">
                                                <Star className="h-2.5 w-2.5" fill="currentColor" />
                                                Primary
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      )}
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                          {email.can_send && (
                                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                              Send
                                            </span>
                                          )}
                                          {email.can_receive && (
                                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                              Receive
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => handleEditEmail(email)}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                            title="Edit"
                                          >
                                            <Edit className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteEmail(email.id, email.email_address)}
                                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          )
                        })()}
                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Add Email Address Modal */}
          {showAddEmailModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Email Address</h3>
                  <button
                    onClick={() => {
                      setShowAddEmailModal(false)
                      setNewEmailData({
                        email_address: '',
                        display_name: '',
                        address_type: 'admin',
                        department: '',
                        can_send: true,
                        can_receive: true,
                      })
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newEmailData.email_address}
                      onChange={(e) => setNewEmailData({ ...newEmailData, email_address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., support@gritsync.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newEmailData.display_name}
                      onChange={(e) => setNewEmailData({ ...newEmailData, display_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., GritSync Support"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newEmailData.address_type}
                      onChange={(e) => setNewEmailData({ ...newEmailData, address_type: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="support">Support</option>
                      <option value="noreply">No Reply</option>
                      <option value="department">Department</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={newEmailData.department}
                      onChange={(e) => setNewEmailData({ ...newEmailData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Support, Sales, Admin"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="can_send_new"
                        checked={newEmailData.can_send}
                        onChange={(e) => setNewEmailData({ ...newEmailData, can_send: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="can_send_new" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Can Send Emails
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="can_receive_new"
                        checked={newEmailData.can_receive}
                        onChange={(e) => setNewEmailData({ ...newEmailData, can_receive: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="can_receive_new" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Can Receive Emails
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowAddEmailModal(false)
                      setNewEmailData({
                        email_address: '',
                        display_name: '',
                        address_type: 'admin',
                        department: '',
                        can_send: true,
                        can_receive: true,
                      })
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEmail}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Email Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Editor Modal */}
          {showEmailEditor && editingEmail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Email Address</h3>
                  <button
                    onClick={() => {
                      setShowEmailEditor(false)
                      setEditingEmail(null)
                      // Clean up preview URL when closing
                      if (uploadedAvatarPreview) {
                        URL.revokeObjectURL(uploadedAvatarPreview)
                        setUploadedAvatarPreview(null)
                      }
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editingEmail.email_address}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editingEmail.display_name || ''}
                        onChange={(e) => setEditingEmail({ ...editingEmail, display_name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder="e.g., GritSync Office"
                      />
                    </div>
                    {editingEmail.address_type !== 'client' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          value={editingEmail.department || ''}
                          onChange={(e) => setEditingEmail({ ...editingEmail, department: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., Office, Support"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        Avatar
                      </label>
                      <label className="flex items-center gap-1.5 px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded cursor-pointer transition-colors">
                        <Upload className="h-3 w-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file && editingEmail) {
                              handleLogoUpload(e as any, 'avatar' as BusinessLogo['logo_type'], editingEmail.id)
                              e.target.value = ''
                            }
                          }}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                    
                    {/* Current Avatar Preview - Compact */}
                    <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Current:</span>
                        {(() => {
                          // Show uploaded preview if available (overwrites current)
                          if (uploadedAvatarPreview) {
                            return (
                              <img
                                src={uploadedAvatarPreview}
                                alt="Uploaded avatar"
                                className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                onError={() => {
                                  // If preview fails, clear it
                                  URL.revokeObjectURL(uploadedAvatarPreview)
                                  setUploadedAvatarPreview(null)
                                }}
                              />
                            )
                          }
                          
                          const currentAvatar = getEmailLogoLocal(editingEmail)
                          if (currentAvatar?.storage_path) {
                            // Use EmailAvatar component which handles signed URLs properly
                            return (
                              <EmailAvatar
                                avatar={currentAvatar}
                                email={editingEmail}
                                size="md"
                              />
                            )
                          }
                          
                          return (
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="canSend"
                          checked={editingEmail.can_send ?? true}
                          onChange={(e) => setEditingEmail({ ...editingEmail, can_send: e.target.checked })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <label htmlFor="canSend" className="text-xs text-gray-700 dark:text-gray-300">
                          Can Send Emails
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="canReceive"
                          checked={editingEmail.can_receive ?? true}
                          onChange={(e) => setEditingEmail({ ...editingEmail, can_receive: e.target.checked })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <label htmlFor="canReceive" className="text-xs text-gray-700 dark:text-gray-300">
                          Can Receive Emails
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end p-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowEmailEditor(false)
                      setEditingEmail(null)
                      // Clean up preview URL when closing
                      if (uploadedAvatarPreview) {
                        URL.revokeObjectURL(uploadedAvatarPreview)
                        setUploadedAvatarPreview(null)
                      }
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEmail}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Update Email Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Detail Modal */}
          {showEmailDetail && (selectedInboxEmail || selectedSentEmail) && (
            <EmailDetailModal
              isOpen={showEmailDetail}
              onClose={() => {
                setShowEmailDetail(false)
                setSelectedInboxEmail(null)
                setSelectedSentEmail(null)
              }}
              email={selectedInboxEmail || selectedSentEmail!}
              type={activeTab === 'inbox' ? 'inbox' : 'sent'}
              onReply={selectedInboxEmail ? () => {
                const senderEmail = selectedInboxEmail.from.match(/<(.+?)>/)?.[1] || selectedInboxEmail.from
                setComposeData({
                  ...composeData,
                  to: senderEmail,
                  toName: selectedInboxEmail.senderName || '',
                  subject: `Re: ${selectedInboxEmail.subject || ''}`,
                })
                setShowEmailDetail(false)
                setComposing(true)
              } : undefined}
              onForward={selectedInboxEmail ? () => {
                setComposeData({
                  ...composeData,
                  to: '',
                  subject: `Fwd: ${selectedInboxEmail.subject || ''}`,
                  body: selectedInboxEmail.html || selectedInboxEmail.text || '',
                })
                setShowEmailDetail(false)
                setComposing(true)
              } : undefined}
              onDelete={selectedInboxEmail ? () => {
                handleDeleteInbox(selectedInboxEmail.id, selectedInboxEmail.subject || '(no subject)')
                setShowEmailDetail(false)
              } : undefined}
              getAvatarInitial={getInitials}
              getAvatarColor={getAvatarColor}
            />
          )}

          {/* Compose Email Modal */}
          <ComposeEmailModal
            isOpen={composing}
            onClose={() => {
              resetComposeState()
              setComposing(false)
            }}
            onSend={handleSendEmail}
            composeData={composeData}
            onComposeDataChange={setComposeData}
            sending={sending}
            fromEmail={adminEmailAddresses.find(addr => addr.id === composeData.fromEmailAddressId)?.email_address || 'admin@gritsync.com'}
            htmlBody={htmlBody}
            onHtmlBodyChange={setHtmlBody}
            forceShowPreview={emailViewMode === 'preview' || (!!htmlBody && htmlBody.trim().length > 0 && !!selectedTemplateId)}
            emailTemplates={emailTemplates}
            emailSignatures={emailSignatures}
            onTemplateSelect={handleTemplateSelect}
            onSignatureSelect={handleSignatureSelect}
            selectedTemplateId={selectedTemplateId}
            selectedSignatureId={selectedSignatureId}
            templateVariables={templateVariables}
            onTemplateVariablesChange={setTemplateVariables}
            onApplyTemplate={handleApplyTemplate}
            adminEmailAddresses={adminEmailAddresses}
            fromEmailAddressId={composeData.fromEmailAddressId}
            onFromEmailChange={(emailAddressId) => {
              setComposeData(prev => ({ ...prev, fromEmailAddressId: emailAddressId }))
            }}
          />
        </main>
      </div>
    </div>
  )
}
