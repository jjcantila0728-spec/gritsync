/**
 * Resend Inbox API - Complete Integration with Resend for receiving emails
 * NOTE: This feature is currently stubbed pending full migration
 */

export interface ReceivedEmailAttachment {
  id: string
  filename: string
  content_type: string
  content_id: string | null
  content_disposition: string
  size: number
  download_url?: string
}

export interface ReceivedEmailHeaders {
  'return-path'?: string
  'mime-version'?: string
  [key: string]: string | undefined
}

export interface ReceivedEmail {
  id: string
  object: 'email'
  to: string[]
  from: string
  created_at: string
  subject: string
  html?: string
  text?: string
  bcc: string[]
  cc: string[]
  reply_to: string[]
  message_id: string
  headers?: ReceivedEmailHeaders
  attachments: ReceivedEmailAttachment[]
}

export interface ListReceivedEmailsResponse {
  object: 'list'
  has_more: boolean
  data: ReceivedEmail[]
}

export interface AttachmentDetails {
  id: string
  filename: string
  content_type: string
  content_id: string | null
  content_disposition: string
  size: number
  download_url: string
}

export interface ListAttachmentsResponse {
  object: 'list'
  data: AttachmentDetails[]
}

// Stubbed API - feature pending migration
export async function listReceivedEmails(_options?: {
  limit?: number
  after?: string
  before?: string
  to?: string
}): Promise<ListReceivedEmailsResponse> {
  return { object: 'list', has_more: false, data: [] }
}

export async function getReceivedEmail(_emailId: string): Promise<ReceivedEmail | null> {
  return null
}

export async function listAttachments(_emailId: string): Promise<ListAttachmentsResponse> {
  return { object: 'list', data: [] }
}

export async function getAttachmentDetails(_emailId: string, _attachmentId: string): Promise<AttachmentDetails | null> {
  return null
}

export async function downloadAttachment(_emailId: string, _attachmentId: string): Promise<Blob | null> {
  return null
}

export async function syncEmailsToDatabase(): Promise<{ synced: number; failed: number }> {
  return { synced: 0, failed: 0 }
}

// API object for compatibility
export const resendInboxAPI = {
  list: listReceivedEmails,
  get: getReceivedEmail,
  listAttachments,
  getAttachment: getAttachmentDetails,
  downloadAttachment,
  sync: syncEmailsToDatabase,
}
