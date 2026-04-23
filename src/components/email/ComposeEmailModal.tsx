/**
 * ComposeEmailModal - Gmail-style compose modal component
 * Modular, minimizable email composition interface
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  X, 
  Minimize2, 
  Maximize2,
  Send, 
  RefreshCw, 
  FileText, 
  Type, 
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
  XCircle,
  Clock,
  ExternalLink,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmailTemplate } from '@/lib/email-templates-api'
import { EmailSignature } from '@/lib/email-signatures-api'
import { EmailPreview } from '@/components/email/EmailPreview'

interface ComposeEmailModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (attachments?: File[], scheduledFor?: Date) => Promise<void>
  composeData: {
    to: string
    toName: string
    subject: string
    body: string
    cc: string
    bcc: string
  }
  onComposeDataChange: (data: any) => void
  sending: boolean
  fromEmail: string
  htmlBody?: string
  onHtmlBodyChange?: (htmlBody: string) => void
  forceShowPreview?: boolean
  emailTemplates: EmailTemplate[]
  emailSignatures: EmailSignature[]
  onTemplateSelect: (templateId: string) => void
  onSignatureSelect: (signatureId: string) => void
  selectedTemplateId: string
  selectedSignatureId: string
  templateVariables: Record<string, string>
  onTemplateVariablesChange: (vars: Record<string, string>) => void
  onApplyTemplate: () => void
  initialAttachments?: File[]
  adminEmailAddresses?: Array<{ id: string; email_address: string; display_name: string }>
  fromEmailAddressId?: string
  onFromEmailChange?: (emailAddressId: string) => void
}

export function ComposeEmailModal({
  isOpen,
  onClose,
  onSend,
  composeData,
  onComposeDataChange,
  sending,
  fromEmail,
  htmlBody,
  onHtmlBodyChange,
  forceShowPreview,
  emailTemplates,
  emailSignatures,
  onTemplateSelect,
  onSignatureSelect,
  selectedTemplateId,
  selectedSignatureId,
  templateVariables,
  onTemplateVariablesChange,
  onApplyTemplate,
  initialAttachments = [],
  adminEmailAddresses = [],
  fromEmailAddressId,
  onFromEmailChange,
}: ComposeEmailModalProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showSignatureMenu, setShowSignatureMenu] = useState(false)
  const [attachments, setAttachments] = useState<File[]>(initialAttachments)
  const [isDragging, setIsDragging] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [showScheduleOptions, setShowScheduleOptions] = useState(false)
  
  const templateMenuRef = useRef<HTMLDivElement>(null)
  const signatureMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bodyTextAreaRef = useRef<HTMLTextAreaElement>(null)
  // Stable ref for callbacks that change on every parent render — prevents infinite loops
  const onHtmlBodyChangeRef = useRef(onHtmlBodyChange)
  useEffect(() => { onHtmlBodyChangeRef.current = onHtmlBodyChange })

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
        setShowTemplateMenu(false)
      }
      if (signatureMenuRef.current && !signatureMenuRef.current.contains(event.target as Node)) {
        setShowSignatureMenu(false)
      }
    }

    if (showTemplateMenu || showSignatureMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTemplateMenu, showSignatureMenu])

  const handleFileAdd = useCallback((files: File[]) => {
    const newFiles = Array.from(files)
    setAttachments(prev => [...prev, ...newFiles])
  }, [])

  const handleFileRemove = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Handle paste event for images
  useEffect(() => {
    if (!isOpen) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleFileAdd([file])
          }
        }
      }
    }

    const textArea = bodyTextAreaRef.current
    if (textArea) {
      textArea.addEventListener('paste', handlePaste as any)
      return () => textArea.removeEventListener('paste', handlePaste as any)
    }
  }, [isOpen, handleFileAdd])

  // Clear attachments when modal closes, but preserve initial attachments on open
  useEffect(() => {
    if (!isOpen) {
      setAttachments([])
      setShowPreview(false)
    } else if (initialAttachments.length > 0) {
      // Set initial attachments when modal opens
      setAttachments(initialAttachments)
    }
  }, [isOpen, initialAttachments])

  // Update HTML preview when template variables change
  // NOTE: onHtmlBodyChange is accessed via ref to prevent infinite re-render loops
  useEffect(() => {
    if (selectedTemplateId && emailTemplates.length > 0) {
      const template = emailTemplates.find(t => t.id === selectedTemplateId)
      if (template && template.html_content) {
        import('@/lib/email-templates-api').then(({ emailTemplatesAPI }) => {
          const rendered = emailTemplatesAPI.render(template, templateVariables)
          if (rendered.html && rendered.html.trim().length > 0) {
            onHtmlBodyChangeRef.current?.(rendered.html)
            setShowPreview(true)
          }
        }).catch((_err) => {})
      }
    }
  }, [selectedTemplateId, templateVariables, emailTemplates])

  // Show preview when htmlBody is set or forceShowPreview is true
  useEffect(() => {
    if (isOpen) {
      if (forceShowPreview || (htmlBody && htmlBody.trim().length > 0 && selectedTemplateId)) {
        console.log('Auto-showing preview:', { 
          forceShowPreview, 
          hasHtmlBody: !!htmlBody, 
          htmlBodyLength: htmlBody?.length, 
          selectedTemplateId 
        })
        setShowPreview(true)
      }
    }
  }, [isOpen, forceShowPreview, htmlBody, selectedTemplateId])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFileAdd(files)
  }

  const handleClose = () => {
    setIsMinimized(false)
    setShowAdvancedOptions(false)
    setShowTemplateMenu(false)
    setShowSignatureMenu(false)
    setAttachments([])
    setSendMode('now')
    setScheduledDate('')
    setScheduledTime('')
    setShowScheduleOptions(false)
    setShowPreview(false)
    // Clear compose data when closing
    onComposeDataChange({
      to: '',
      toName: '',
      subject: '',
      body: '',
      cc: '',
      bcc: '',
    })
    onClose()
  }

  const handleSend = async () => {
    let scheduledFor: Date | undefined
    if (sendMode === 'schedule' && scheduledDate && scheduledTime) {
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`)
      if (dateTime > new Date()) {
        scheduledFor = dateTime
      }
    }
    await onSend(attachments, scheduledFor)
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div 
        className={cn(
          "rounded-lg shadow-2xl flex flex-col pointer-events-auto transition-all duration-200",
          isMinimized 
            ? "h-12 w-80 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 cursor-pointer" 
            : "w-full sm:max-w-2xl max-w-full bg-white dark:bg-gray-800 h-[90vh] sm:max-h-[85vh]"
        )}
        onClick={(e) => {
          e.stopPropagation()
          // If minimized, clicking anywhere expands it
          if (isMinimized && e.target === e.currentTarget) {
            setIsMinimized(false)
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary-500/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Paperclip className="h-12 w-12 mx-auto mb-2 text-primary-600" />
              <p className="text-primary-600 font-medium">Drop files to attach</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div onClick={(e) => {
          // If minimized, clicking header expands it
          if (isMinimized) {
            e.stopPropagation()
            setIsMinimized(false)
          }
        }}>
          <ComposeHeader
            isMinimized={isMinimized}
            onMinimize={(e) => {
              e?.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
            onClose={handleClose}
            fromEmail={fromEmail}
            subject={composeData.subject}
          />
        </div>

        {!isMinimized && (
          <>
            {/* To Field */}
            <ToField
              value={composeData.to}
              onChange={(value) => onComposeDataChange({ ...composeData, to: value })}
            />

            {/* Cc/Bcc Toggle */}
            <CcBccToggle
              showAdvanced={showAdvancedOptions}
              onToggle={() => setShowAdvancedOptions(!showAdvancedOptions)}
              cc={composeData.cc}
              bcc={composeData.bcc}
              onCcChange={(value) => onComposeDataChange({ ...composeData, cc: value })}
              onBccChange={(value) => onComposeDataChange({ ...composeData, bcc: value })}
            />

            {/* Subject */}
            <SubjectField
              value={composeData.subject}
              onChange={(value) => onComposeDataChange({ ...composeData, subject: value })}
            />

            {/* Preview Toggle */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {showPreview ? 'Preview' : 'Compose'}
              </span>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {/* From Email Selector */}
            {adminEmailAddresses.length > 0 && onFromEmailChange && (
              <div className="px-3 sm:px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-10 sm:w-12 flex-shrink-0">
                    From
                  </span>
                  <select
                    value={fromEmailAddressId || ''}
                    onChange={(e) => onFromEmailChange(e.target.value)}
                    className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100"
                  >
                    {adminEmailAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.display_name || addr.email_address} ({addr.email_address})
                      </option>
                    ))}
                  </select>
                  <a
                    href="/admin/emails/email-setup/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    title="Manage email addresses"
                  >
                    <Settings className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Body / Preview */}
            {showPreview ? (
              <div className="flex-1 overflow-y-auto min-h-[200px] sm:min-h-[300px] p-4 bg-gray-50 dark:bg-gray-900">
                <EmailPreview
                  html={htmlBody || composeData.body}
                  text={composeData.body}
                  emptyMessage="No content to preview. Start composing to see a preview."
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm min-h-full"
                />
              </div>
            ) : (
              <BodyField
                value={composeData.body}
                onChange={(value) => onComposeDataChange({ ...composeData, body: value })}
                textAreaRef={bodyTextAreaRef}
              />
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                    >
                      {file.type.startsWith('image/') ? (
                        <ImageIcon className="h-4 w-4 text-blue-600" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-gray-600" />
                      )}
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        onClick={() => handleFileRemove(index)}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                      >
                        <XCircle className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Options */}
            {showScheduleOptions && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="sendNow"
                      checked={sendMode === 'now'}
                      onChange={() => setSendMode('now')}
                      className="text-primary-600"
                    />
                    <label htmlFor="sendNow" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      Send Now
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="schedule"
                      checked={sendMode === 'schedule'}
                      onChange={() => setSendMode('schedule')}
                      className="text-primary-600"
                    />
                    <label htmlFor="schedule" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      Schedule
                    </label>
                  </div>
                </div>
                {sendMode === 'schedule' && (
                  <div className="mt-3 flex gap-3">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Footer Toolbar */}
            <ComposeFooter
              sending={sending}
              onSend={handleSend}
              disabled={!composeData.to || !composeData.subject || (!composeData.body && !htmlBody) || (sendMode === 'schedule' && (!scheduledDate || !scheduledTime))}
              templateMenuRef={templateMenuRef}
              showTemplateMenu={showTemplateMenu}
              onToggleTemplateMenu={() => setShowTemplateMenu(!showTemplateMenu)}
              emailTemplates={emailTemplates}
              onTemplateSelect={(id) => {
                onTemplateSelect(id)
                setShowTemplateMenu(false)
              }}
              selectedTemplateId={selectedTemplateId}
              templateVariables={templateVariables}
              onTemplateVariablesChange={onTemplateVariablesChange}
              onApplyTemplate={() => {
                onApplyTemplate()
                setShowTemplateMenu(false)
              }}
              signatureMenuRef={signatureMenuRef}
              showSignatureMenu={showSignatureMenu}
              onToggleSignatureMenu={() => setShowSignatureMenu(!showSignatureMenu)}
              emailSignatures={emailSignatures}
              onSignatureSelect={(id) => {
                onSignatureSelect(id)
                setShowSignatureMenu(false)
              }}
              selectedSignatureId={selectedSignatureId}
              fileInputRef={fileInputRef}
              onFileSelect={(files) => handleFileAdd(files)}
              attachmentCount={attachments.length}
              sendMode={sendMode}
              showScheduleOptions={showScheduleOptions}
              onToggleScheduleOptions={() => setShowScheduleOptions(!showScheduleOptions)}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ===== SUB-COMPONENTS =====

function ComposeHeader({ 
  isMinimized, 
  onMinimize, 
  onClose, 
  fromEmail,
  subject
}: {
  isMinimized: boolean
  onMinimize: (e?: React.MouseEvent) => void
  onClose: () => void
  fromEmail: string
  subject: string
}) {
  return (
    <div className={cn(
      "flex items-center justify-between border-b transition-colors",
      isMinimized 
        ? "px-3 py-1.5 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-800" 
        : "px-3 sm:px-4 py-2 border-gray-200 dark:border-gray-700"
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={cn(
          isMinimized ? "text-xs" : "text-sm",
          "font-medium truncate",
          isMinimized 
            ? "text-gray-800 dark:text-gray-200" 
            : "text-gray-700 dark:text-gray-300"
        )}>
          {isMinimized ? (subject || 'New Message') : 'New Message'}
        </span>
        {!isMinimized && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
            from {fromEmail}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMinimize(e)
          }}
          className={cn(
            "rounded transition-colors",
            isMinimized ? "p-1" : "p-1.5",
            isMinimized
              ? "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
          title={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? (
            <Maximize2 className="h-3.5 w-3.5" />
          ) : (
            <Minimize2 className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={onClose}
          className={cn(
            "rounded transition-colors",
            isMinimized ? "p-1" : "p-1.5",
            isMinimized
              ? "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <X className={isMinimized ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </div>
    </div>
  )
}

function ToField({ 
  value, 
  onChange 
}: { 
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="px-3 sm:px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 dark:text-gray-400 w-10 sm:w-12 flex-shrink-0">
          To
        </span>
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Recipients"
          className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
          autoFocus
        />
      </div>
    </div>
  )
}

function CcBccToggle({ 
  showAdvanced, 
  onToggle, 
  cc, 
  bcc,
  onCcChange,
  onBccChange
}: {
  showAdvanced: boolean
  onToggle: () => void
  cc: string
  bcc: string
  onCcChange: (value: string) => void
  onBccChange: (value: string) => void
}) {
  return (
    <div className="px-3 sm:px-4 py-0.5 border-b border-gray-200 dark:border-gray-700">
      {showAdvanced ? (
        <div className="space-y-1.5 py-1">
          <button
            onClick={onToggle}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Hide advanced
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-10 sm:w-12 flex-shrink-0">
              Cc
            </span>
            <input
              type="email"
              value={cc}
              onChange={(e) => onCcChange(e.target.value)}
              placeholder="Cc recipients"
              className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-10 sm:w-12 flex-shrink-0">
              Bcc
            </span>
            <input
              type="email"
              value={bcc}
              onChange={(e) => onBccChange(e.target.value)}
              placeholder="Bcc recipients"
              className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
            />
          </div>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline py-1"
        >
          Cc Bcc
        </button>
      )}
    </div>
  )
}

function SubjectField({ 
  value, 
  onChange 
}: { 
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="px-3 sm:px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Subject"
        className="w-full border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
      />
    </div>
  )
}

function BodyField({ 
  value, 
  onChange,
  textAreaRef
}: { 
  value: string
  onChange: (value: string) => void
  textAreaRef?: React.RefObject<HTMLTextAreaElement>
}) {
  return (
    <div className="flex-1 overflow-y-auto min-h-[200px] sm:min-h-[300px]">
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Compose email... (Paste images directly or drag & drop files)"
        className="w-full h-full px-4 py-3 border-0 focus:ring-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400 resize-none"
        style={{ minHeight: '200px' }}
      />
    </div>
  )
}

interface ComposeFooterProps {
  sending: boolean
  onSend: () => Promise<void>
  disabled: boolean
  templateMenuRef: React.RefObject<HTMLDivElement>
  showTemplateMenu: boolean
  onToggleTemplateMenu: () => void
  emailTemplates: EmailTemplate[]
  onTemplateSelect: (id: string) => void
  selectedTemplateId: string
  templateVariables: Record<string, string>
  onTemplateVariablesChange: (vars: Record<string, string>) => void
  onApplyTemplate: () => void
  signatureMenuRef: React.RefObject<HTMLDivElement>
  showSignatureMenu: boolean
  onToggleSignatureMenu: () => void
  emailSignatures: EmailSignature[]
  onSignatureSelect: (id: string) => void
  selectedSignatureId: string
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileSelect: (files: File[]) => void
  attachmentCount: number
  sendMode: 'now' | 'schedule'
  showScheduleOptions: boolean
  onToggleScheduleOptions: () => void
}

function ComposeFooter(props: ComposeFooterProps) {
  return (
    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 flex-wrap">
        {/* Send Button */}
        <button
          onClick={props.onSend}
          disabled={props.sending || props.disabled}
          className={cn(
            "px-4 sm:px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors",
            props.sending && "opacity-75"
          )}
        >
          {props.sending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Sending...</span>
            </>
          ) : (
            <>
              {props.sendMode === 'schedule' ? (
                <>
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedule</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </>
          )}
        </button>

        {/* Schedule Toggle */}
        <button
          onClick={props.onToggleScheduleOptions}
          className={cn(
            "p-2 rounded-full transition-colors",
            props.showScheduleOptions
              ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
          title="Schedule email"
        >
          <Clock className="h-4 w-4" />
        </button>
        
        {/* Template Menu */}
        <TemplateMenu {...props} />

        {/* Signature Menu */}
        <SignatureMenu {...props} />

        {/* Attach Files Button */}
        <div className="relative">
          <input
            ref={props.fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                props.onFileSelect(Array.from(e.target.files))
                e.target.value = '' // Reset input
              }
            }}
          />
          <button
            onClick={() => props.fileInputRef.current?.click()}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors relative"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
            {props.attachmentCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {props.attachmentCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateMenu({
  templateMenuRef,
  showTemplateMenu,
  onToggleTemplateMenu,
  emailTemplates,
  onTemplateSelect,
  selectedTemplateId,
  templateVariables,
  onTemplateVariablesChange,
  onApplyTemplate,
}: Pick<ComposeFooterProps, 
  'templateMenuRef' | 
  'showTemplateMenu' | 
  'onToggleTemplateMenu' | 
  'emailTemplates' | 
  'onTemplateSelect' | 
  'selectedTemplateId' | 
  'templateVariables' | 
  'onTemplateVariablesChange' | 
  'onApplyTemplate'
>) {
  return (
    <div className="relative ml-2" ref={templateMenuRef}>
      <button
        onClick={onToggleTemplateMenu}
        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        title="Templates"
      >
        <FileText className="h-4 w-4" />
      </button>
      {showTemplateMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[200px] max-h-[300px] overflow-y-auto">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Templates
            </div>
            {emailTemplates.length > 0 ? (
              emailTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onTemplateSelect(template.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {template.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {template.category}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No templates
              </div>
            )}
          </div>
          {selectedTemplateId && Object.keys(templateVariables).length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Template Variables
              </div>
              {Object.keys(templateVariables).map((varName) => (
                <div key={varName} className="mb-2">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 px-3">
                    {varName}
                  </label>
                  <input
                    type="text"
                    value={templateVariables[varName]}
                    onChange={(e) =>
                      onTemplateVariablesChange({
                        ...templateVariables,
                        [varName]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                    placeholder={`Enter ${varName}`}
                  />
                </div>
              ))}
              <button
                onClick={onApplyTemplate}
                className="w-full mt-2 px-3 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
              >
                Apply Template
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SignatureMenu({
  signatureMenuRef,
  showSignatureMenu,
  onToggleSignatureMenu,
  emailSignatures,
  onSignatureSelect,
}: Pick<ComposeFooterProps,
  'signatureMenuRef' |
  'showSignatureMenu' |
  'onToggleSignatureMenu' |
  'emailSignatures' |
  'onSignatureSelect'
>) {
  return (
    <div className="relative" ref={signatureMenuRef}>
      <button
        onClick={onToggleSignatureMenu}
        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        title="Signature"
      >
        <Type className="h-4 w-4" />
      </button>
      {showSignatureMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[200px]">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Signatures
            </div>
            <button
              onClick={() => onSignatureSelect('')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <span className="text-gray-500 dark:text-gray-400">No signature</span>
            </button>
            {emailSignatures.map((sig) => (
              <button
                key={sig.id}
                onClick={() => onSignatureSelect(sig.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {sig.name}
                </div>
                {sig.is_default && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Default</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

