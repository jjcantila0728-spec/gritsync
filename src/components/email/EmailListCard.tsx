/**
 * EmailListCard - Reusable email list item component
 * Used for both inbox and sent emails
 */

import { format } from 'date-fns'
import { Mail, Clock, CheckCircle2, XCircle, AlertCircle, Eye, Trash2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmailLog } from '@/lib/email-api'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SenderInfo {
  avatar_path: string | null
  first_name: string | null
  last_name: string | null
}

interface EmailListCardProps {
  email: EmailLog | any
  type: 'sent' | 'inbox'
  onClick: () => void
  onDelete?: () => void
}

export function EmailListCard({ email, type, onClick, onDelete }: EmailListCardProps) {
  if (type === 'sent') {
    return <SentEmailCard email={email} onClick={onClick} onDelete={onDelete} />
  }
  return <InboxEmailCard email={email} onClick={onClick} onDelete={onDelete} />
}

function SentEmailCard({ 
  email, 
  onClick, 
  onDelete 
}: { 
  email: EmailLog
  onClick: () => void
  onDelete?: () => void
}) {
  const getStatusIcon = () => {
    switch (email.status) {
      case 'delivered':
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'failed':
      case 'bounced':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = () => {
    switch (email.status) {
      case 'delivered':
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'failed':
      case 'bounced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Avatar & Content */}
        <div className="flex items-start gap-3 flex-1 min-w-0" onClick={onClick}>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {(email.recipient_name || email.recipient_email)[0].toUpperCase()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Recipient & Status */}
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {email.recipient_name || email.recipient_email.split('@')[0]}
              </p>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1', getStatusColor())}>
                {getStatusIcon()}
                {email.status}
              </span>
            </div>

            {/* Email & Time */}
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
              {email.recipient_email}
            </p>

            {/* Subject */}
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
              {email.subject || '(no subject)'}
            </p>

            {/* Preview */}
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {email.body_text || 'No preview available'}
            </p>

            {/* Date */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {format(new Date(email.created_at), 'MMM d, yyyy • h:mm a')}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={onClick}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InboxEmailCard({ 
  email, 
  onClick, 
  onDelete 
}: { 
  email: any
  onClick: () => void
  onDelete?: () => void
}) {
  const [senderInfo, setSenderInfo] = useState<SenderInfo | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const getSenderName = () => {
    // If we have sender info from database, use it
    if (senderInfo?.first_name && senderInfo?.last_name) {
      return `${senderInfo.first_name} ${senderInfo.last_name}`
    }
    
    // Otherwise parse from email
    const fromEmail = email.from || ''
    const match = fromEmail.match(/^(.*?)</)
    return match ? match[1].trim() : fromEmail.split('@')[0]
  }

  const getSenderEmail = () => {
    const fromEmail = email.from || ''
    const match = fromEmail.match(/<(.+?)>/)
    return match ? match[1] : fromEmail
  }

  // Fetch sender info and avatar
  useEffect(() => {
    const fetchSenderInfo = async () => {
      try {
        const senderEmail = getSenderEmail()
        
        // Try to find user by email in email_addresses table
        const { data: emailAddress } = await supabase
          .from('email_addresses')
          .select('user_id')
          .eq('email_address', senderEmail)
          .single()

        if (emailAddress?.user_id) {
          // Fetch user info
          const { data: userData } = await supabase
            .from('users')
            .select('avatar_path, first_name, last_name')
            .eq('id', emailAddress.user_id)
            .single()

          if (userData) {
            setSenderInfo(userData)

            // If user has avatar, get signed URL
            if (userData.avatar_path) {
              const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(userData.avatar_path)
              
              setAvatarUrl(publicUrl)
            }
          }
        }
      } catch (error) {
        // Silently fail - will show generated avatar
        console.log('Could not fetch sender info:', error)
      }
    }

    fetchSenderInfo()
  }, [email.from])

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Avatar & Content */}
        <div className="flex items-start gap-3 flex-1 min-w-0" onClick={onClick}>
          {/* Avatar - Show real profile picture or generated */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={getSenderName()} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span>{getSenderName()[0]?.toUpperCase() || 'U'}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Sender Name */}
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {getSenderName()}
              </p>
              {email.attachments && email.attachments.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                  {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Sender Email */}
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
              {getSenderEmail()}
            </p>

            {/* Subject */}
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
              {email.subject || '(no subject)'}
            </p>

            {/* Preview */}
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {email.text || email.html?.substring(0, 150) || 'No preview available'}
            </p>

            {/* Date */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {format(new Date(email.created_at), 'MMM d, yyyy • h:mm a')}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={onClick}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Email List Container
interface EmailListProps {
  emails: Array<EmailLog | any>
  type: 'sent' | 'inbox'
  onEmailClick: (email: EmailLog | any) => void
  onEmailDelete?: (email: EmailLog | any) => void
  loading?: boolean
  emptyMessage?: string
}

export function EmailList({ 
  emails, 
  type, 
  onEmailClick, 
  onEmailDelete, 
  loading,
  emptyMessage = 'No emails found'
}: EmailListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
          <Mail className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {emails.map((email, index) => (
        <EmailListCard
          key={email.id || index}
          email={email}
          type={type}
          onClick={() => onEmailClick(email)}
          onDelete={onEmailDelete ? () => onEmailDelete(email) : undefined}
        />
      ))}
    </div>
  )
}

