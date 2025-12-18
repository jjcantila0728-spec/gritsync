/**
 * EmailListWithPreview - Reusable two-column email list with live preview
 * Used for Admin Inbox and Sent views
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { 
  Mail, 
  Paperclip, 
  Trash2, 
  Reply, 
  Forward, 
  Printer,
  Download,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmailPreview } from '@/components/email/EmailPreview'
import type { EmailLog } from '@/lib/email-api'
import type { EnrichedReceivedEmail } from '../types'

interface EmailListWithPreviewProps {
  type: 'inbox' | 'sent'
  emails: (EnrichedReceivedEmail | EmailLog)[]
  selectedIds: Set<string>
  selectedEmail: EnrichedReceivedEmail | EmailLog | null
  onEmailSelect: (email: EnrichedReceivedEmail | EmailLog) => void
  onToggleSelection: (id: string) => void
  onToggleSelectAll: () => void
  onDelete?: (id: string, subject: string) => void
  onReply?: (email: EnrichedReceivedEmail) => void
  onForward?: (email: EnrichedReceivedEmail) => void
  getAvatarInitial: (name: string) => string
  getAvatarColor: (name: string) => string
  getEmailPreview: (html?: string, text?: string, maxLength?: number) => string
}

export function EmailListWithPreview({
  type,
  emails,
  selectedIds,
  selectedEmail,
  onEmailSelect,
  onToggleSelection,
  onToggleSelectAll,
  onDelete,
  onReply,
  onForward,
  getAvatarInitial,
  getAvatarColor,
  getEmailPreview,
}: EmailListWithPreviewProps) {
  const isInbox = type === 'inbox'

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)]">
      {/* Left Column: Email List */}
      <div className="w-full lg:w-2/5 flex flex-col overflow-hidden">
        {emails.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg h-full flex flex-col items-center justify-center">
            <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {isInbox ? 'No emails in inbox' : 'No sent emails'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
            {/* Table Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex-shrink-0">
              <div className="flex items-center px-2 py-2">
                <div className="w-10 sm:w-12 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === emails.length && emails.length > 0}
                    onChange={onToggleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : isInbox ? 'Inbox' : 'Sent Items'}
                </div>
              </div>
            </div>

            {/* Email Rows - Scrollable */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto flex-1">
              {emails.map((email) => {
                const isReceivedEmail = 'from' in email
                const displayName = isReceivedEmail 
                  ? (email as EnrichedReceivedEmail).senderName || (email as EnrichedReceivedEmail).from.split('@')[0]
                  : (email as EmailLog).recipient_name || (email as EmailLog).recipient_email.split('@')[0]
                
                const subject = isReceivedEmail 
                  ? (email as EnrichedReceivedEmail).subject 
                  : (email as EmailLog).subject

                const preview = isReceivedEmail
                  ? getEmailPreview((email as EnrichedReceivedEmail).html, (email as EnrichedReceivedEmail).text, 50)
                  : getEmailPreview((email as EmailLog).body_html || undefined, (email as EmailLog).body_text || undefined, 50)

                const hasAttachments = isReceivedEmail 
                  ? (email as EnrichedReceivedEmail).attachments && (email as EnrichedReceivedEmail).attachments!.length > 0
                  : false

                return (
                  <div
                    key={email.id}
                    className={cn(
                      'group relative flex items-center px-2 py-2 hover:shadow-sm transition-all cursor-pointer border-l-4 border-transparent hover:border-l-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                      selectedEmail?.id === email.id && 'bg-gray-100 dark:bg-gray-700 border-l-primary-500'
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                          (e.target as HTMLElement).closest('button')) {
                        return
                      }
                      onEmailSelect(email)
                    }}
                  >
                    {/* Checkbox */}
                    <div className="w-10 sm:w-12 flex items-center justify-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(email.id)}
                        onChange={() => onToggleSelection(email.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 flex-shrink-0 mr-2 sm:mr-3">
                      {isReceivedEmail && (email as EnrichedReceivedEmail).senderAvatar ? (
                        <img
                          src={(email as EnrichedReceivedEmail).senderAvatar}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm',
                          `bg-gradient-to-br ${getAvatarColor(displayName)}`
                        )}>
                          {getAvatarInitial(displayName)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName}
                        </span>
                        {!isReceivedEmail && (
                          <span className="flex-shrink-0">
                            {(email as EmailLog).status === 'delivered' || (email as EmailLog).status === 'sent' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : (email as EmailLog).status === 'pending' ? (
                              <Clock className="h-3.5 w-3.5 text-yellow-600" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasAttachments && <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {(subject && subject.length > 40 ? subject.substring(0, 40) + '...' : subject) || '(no subject)'}
                        </span>
                        {preview && (
                          <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate ml-1">
                            - {preview}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {format(new Date(email.created_at), 'MMM d, h:mm a')}
                      </div>
                    </div>

                    {/* Delete Button (Desktop) */}
                    {onDelete && (
                      <div className="w-10 flex-shrink-0 hidden sm:block" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onDelete(email.id, subject || '(no subject)')}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Email Preview */}
      <div className="hidden lg:flex lg:w-3/5 flex-col bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {selectedEmail ? (
          <>
            {/* Email Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex-1 pr-4">
                  {('from' in selectedEmail ? selectedEmail.subject : (selectedEmail as EmailLog).subject) || '(no subject)'}
                </h2>
                <div className="flex items-center gap-1">
                  {isInbox && 'from' in selectedEmail && onReply && (
                    <button
                      onClick={() => onReply(selectedEmail as EnrichedReceivedEmail)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Reply"
                    >
                      <Reply className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                  {isInbox && 'from' in selectedEmail && onForward && (
                    <button
                      onClick={() => onForward(selectedEmail as EnrichedReceivedEmail)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Forward"
                    >
                      <Forward className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Print"
                  >
                    <Printer className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Sender/Recipient Info */}
              <div className="flex items-center gap-3 mb-2">
                {/* Avatar */}
                {'from' in selectedEmail && (selectedEmail as EnrichedReceivedEmail).senderAvatar ? (
                  <img
                    src={(selectedEmail as EnrichedReceivedEmail).senderAvatar}
                    alt="Sender"
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm',
                    `bg-gradient-to-br ${getAvatarColor(
                      'from' in selectedEmail 
                        ? ((selectedEmail as EnrichedReceivedEmail).senderName || (selectedEmail as EnrichedReceivedEmail).from)
                        : ((selectedEmail as EmailLog).recipient_name || (selectedEmail as EmailLog).recipient_email)
                    )}`
                  )}>
                    {getAvatarInitial(
                      'from' in selectedEmail 
                        ? ((selectedEmail as EnrichedReceivedEmail).senderName || (selectedEmail as EnrichedReceivedEmail).from)
                        : ((selectedEmail as EmailLog).recipient_name || (selectedEmail as EmailLog).recipient_email)
                    )}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {'from' in selectedEmail 
                      ? ((selectedEmail as EnrichedReceivedEmail).senderName || (selectedEmail as EnrichedReceivedEmail).from.split('@')[0])
                      : ((selectedEmail as EmailLog).recipient_name || (selectedEmail as EmailLog).recipient_email.split('@')[0])
                    }
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {'from' in selectedEmail ? (
                      <>
                        <span className="text-gray-500">from</span>{' '}
                        <span className="font-medium">{(selectedEmail as EnrichedReceivedEmail).from}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-500">to</span>{' '}
                        <span className="font-medium">{(selectedEmail as EmailLog).recipient_email}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Status & Date */}
                <div className="text-right flex-shrink-0">
                  {!('from' in selectedEmail) && (
                    <span className={cn(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      {
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400':
                          (selectedEmail as EmailLog).status === 'delivered' || (selectedEmail as EmailLog).status === 'sent',
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400':
                          (selectedEmail as EmailLog).status === 'pending',
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400':
                          (selectedEmail as EmailLog).status === 'failed' || (selectedEmail as EmailLog).status === 'bounced',
                      }
                    )}>
                      {(selectedEmail as EmailLog).status}
                    </span>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {format(new Date(selectedEmail.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>

              {/* Attachments */}
              {'from' in selectedEmail && (selectedEmail as EnrichedReceivedEmail).attachments && (selectedEmail as EnrichedReceivedEmail).attachments!.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {(selectedEmail as EnrichedReceivedEmail).attachments!.length} Attachment{(selectedEmail as EnrichedReceivedEmail).attachments!.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedEmail as EnrichedReceivedEmail).attachments!.map((attachment: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
                          {attachment.filename}
                        </span>
                        {attachment.download_url && (
                          <button
                            onClick={() => window.open(attachment.download_url, '_blank')}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Download attachment"
                          >
                            <Download className="h-3.5 w-3.5 text-gray-500" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <EmailPreview
                html={'from' in selectedEmail ? (selectedEmail as EnrichedReceivedEmail).html : (selectedEmail as EmailLog).body_html || undefined}
                text={'from' in selectedEmail ? (selectedEmail as EnrichedReceivedEmail).text : (selectedEmail as EmailLog).body_text || undefined}
                className="min-h-full"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Mail className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Select an email to view its content
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

