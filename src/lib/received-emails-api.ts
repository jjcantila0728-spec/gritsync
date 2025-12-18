/**
 * Received Emails API
 * Manages received emails stored in our database
 * NOTE: This feature is currently stubbed pending full migration
 */

export interface ReceivedEmailAttachment {
  id: string
  filename: string
  content_type: string
  size: number
}

export interface ReceivedEmail {
  id: string
  resend_id: string
  from_email: string
  from_name: string | null
  to_email: string
  cc: string[]
  bcc: string[]
  reply_to: string[]
  subject: string | null
  html_body: string | null
  text_body: string | null
  message_id: string | null
  headers: Record<string, any>
  attachments: ReceivedEmailAttachment[]
  received_at: string
  is_read: boolean
  is_deleted: boolean
  recipient_user_id: string | null
  recipient_email_address_id: string | null
  created_at: string
  updated_at: string
}

export interface ReceivedEmailsListOptions {
  limit?: number
  offset?: number
  toEmail?: string
  isRead?: boolean
  includeDeleted?: boolean
}

// Stubbed API - feature pending migration
export async function getReceivedEmails(_options: ReceivedEmailsListOptions = {}): Promise<ReceivedEmail[]> {
  return []
}

export async function getReceivedEmailById(_id: string): Promise<ReceivedEmail | null> {
  return null
}

export async function markEmailAsRead(_id: string): Promise<boolean> {
  return false
}

export async function markEmailAsUnread(_id: string): Promise<boolean> {
  return false
}

export async function deleteReceivedEmail(_id: string): Promise<boolean> {
  return false
}

export async function getUnreadCount(): Promise<number> {
  return 0
}
