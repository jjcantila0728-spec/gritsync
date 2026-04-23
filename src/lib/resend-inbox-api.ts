/**
 * Resend Inbox API - Proxies requests through Express backend to Resend
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

async function apiPost(path: string, body: Record<string, any>): Promise<any> {
  const token = localStorage.getItem('gritsync_token')
  const response = await fetch(`/api/emails${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error((data as any)?.error || `Request failed with status ${response.status}`)
  }

  return data
}

export async function listReceivedEmails(options?: {
  limit?: number
  after?: string
  before?: string
  to?: string
}): Promise<ListReceivedEmailsResponse> {
  try {
    if (options?.limit && (options.limit < 1 || options.limit > 100)) {
      throw new Error('Limit must be between 1 and 100')
    }
    if (options?.after && options?.before) {
      throw new Error('Cannot use both "after" and "before" parameters')
    }

    const data = await apiPost('/inbox/list', {
      limit: options?.limit,
      after: options?.after,
      before: options?.before,
      to: options?.to,
    })

    return data as ListReceivedEmailsResponse
  } catch (error) {
    console.error('Error fetching received emails:', error)
    throw error
  }
}

export async function getReceivedEmailById(emailId: string): Promise<ReceivedEmail> {
  try {
    if (!emailId) throw new Error('Email ID is required')
    const data = await apiPost('/inbox/get', { emailId })
    return data as ReceivedEmail
  } catch (error) {
    console.error('Error fetching received email by ID:', error)
    throw error
  }
}

export async function listReceivedEmailAttachments(emailId: string): Promise<ListAttachmentsResponse> {
  try {
    if (!emailId) throw new Error('Email ID is required')
    const data = await apiPost('/inbox/attachments', { emailId })
    return data as ListAttachmentsResponse
  } catch (error) {
    console.error('Error listing email attachments:', error)
    throw error
  }
}

async function deleteEmail(emailId: string): Promise<{ success: boolean }> {
  const hidden = JSON.parse(localStorage.getItem('hiddenEmails') || '[]')
  if (!hidden.includes(emailId)) hidden.push(emailId)
  localStorage.setItem('hiddenEmails', JSON.stringify(hidden))
  return { success: true }
}

async function batchDeleteEmails(emailIds: string[]): Promise<{ success: number; failed: number }> {
  const hidden = JSON.parse(localStorage.getItem('hiddenEmails') || '[]')
  for (const id of emailIds) {
    if (!hidden.includes(id)) hidden.push(id)
  }
  localStorage.setItem('hiddenEmails', JSON.stringify(hidden))
  return { success: emailIds.length, failed: 0 }
}

export const resendInboxAPI = {
  list: listReceivedEmails,
  getById: getReceivedEmailById,
  listAttachments: listReceivedEmailAttachments,
  delete: deleteEmail,
  batchDelete: batchDeleteEmails,
}

export default resendInboxAPI
