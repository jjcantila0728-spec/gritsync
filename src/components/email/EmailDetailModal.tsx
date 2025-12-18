/**
 * EmailDetailModal - Compact modal for viewing email details
 * Features: Reply, Forward, Print, Delete, Attachments, HTML Preview
 */

import { X, Reply, Forward, Printer, Trash2, Download, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { EmailPreview } from './EmailPreview'

interface EmailDetailModalProps {
  isOpen: boolean
  onClose: () => void
  email: {
    id: string
    subject?: string
    from?: string
    to?: string
    created_at: string
    html?: string
    text?: string
    body_html?: string
    body_text?: string
    attachments?: any[]
    status?: string
    senderName?: string
    senderAvatar?: string
    recipient_name?: string
    recipient_email?: string
  }
  type: 'inbox' | 'sent'
  onReply?: () => void
  onForward?: () => void
  onDelete?: () => void
  getAvatarInitial: (name: string) => string
  getAvatarColor: (name: string) => string
}

export function EmailDetailModal({
  isOpen,
  onClose,
  email,
  type,
  onReply,
  onForward,
  onDelete,
  getAvatarInitial,
  getAvatarColor,
}: EmailDetailModalProps) {
  if (!isOpen) return null

  const isInbox = type === 'inbox'
  const displayName = isInbox 
    ? (email.senderName || email.from?.split('@')[0] || 'Unknown')
    : (email.recipient_name || email.recipient_email?.split('@')[0] || 'Unknown')
  
  const emailAddress = isInbox ? email.from : email.recipient_email

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">
              {email.subject || '(no subject)'}
            </h2>
            
            {/* Sender/Recipient Info */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {isInbox && email.senderAvatar ? (
                <img
                  src={email.senderAvatar}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm',
                  `bg-gradient-to-br ${getAvatarColor(displayName)}`
                )}>
                  {getAvatarInitial(displayName)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {displayName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {isInbox ? (
                    <>
                      <span className="text-gray-500">from</span>{' '}
                      <span className="font-medium">{emailAddress}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500">to</span>{' '}
                      <span className="font-medium">{emailAddress}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                {!isInbox && email.status && (
                  <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    {
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400':
                        email.status === 'delivered' || email.status === 'sent',
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400':
                        email.status === 'pending',
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400':
                        email.status === 'failed' || email.status === 'bounced',
                    }
                  )}>
                    {email.status}
                  </span>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {format(new Date(email.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isInbox && onReply && (
              <button
                onClick={onReply}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Reply"
              >
                <Reply className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            {isInbox && onForward && (
              <button
                onClick={onForward}
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
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-red-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((attachment: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
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

        {/* Email Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <EmailPreview
            html={email.html || email.body_html}
            text={email.text || email.body_text}
            className="min-h-full"
          />
        </div>

        {/* Footer with action buttons */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {isInbox && onReply && (
              <button
                onClick={onReply}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <Reply className="h-4 w-4" />
                Reply
              </button>
            )}
            {isInbox && onForward && (
              <button
                onClick={onForward}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Forward className="h-4 w-4" />
                Forward
              </button>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

