/**
 * Resend Inbox API - Integration with Resend for receiving emails
 * Reference: https://resend.com/docs/api-reference/emails/list-received-emails
 */

import { supabase } from './supabase'

export interface ReceivedEmailAttachment {
  filename: string
  content_type: string
  content_id: string | null
  content_disposition: string
  id: string
  size: number
}

export interface ReceivedEmail {
  id: string
  to: string[]
  from: string
  created_at: string
  subject: string
  bcc: string[]
  cc: string[]
  reply_to: string[]
  message_id: string
  attachments: ReceivedEmailAttachment[]
  html?: string
  text?: string
}

export interface ListReceivedEmailsResponse {
  object: 'list'
  has_more: boolean
  data: ReceivedEmail[]
}

/**
 * List received emails via Supabase Edge Function proxy to Resend
 * This avoids CORS issues when calling the Resend API directly from the browser.
 */
export async function listReceivedEmails(options?: {
  limit?: number
  after?: string
  before?: string
}): Promise<ListReceivedEmailsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('resend-inbox', {
      body: {
        action: 'list',
        options: {
          limit: options?.limit,
          after: options?.after,
          before: options?.before,
        },
      },
    })

    if (error) {
      console.error('Error invoking resend-inbox function:', error)
      throw new Error(error.message || 'Failed to load inbox emails')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from resend-inbox function')
    }

    return data as ListReceivedEmailsResponse
  } catch (error) {
    console.error('Error fetching received emails:', error)
    throw error
  }
}

/**
 * Delete a received email from Resend via Supabase Edge Function proxy
 */
export async function deleteReceivedEmail(emailId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('resend-inbox', {
      body: {
        action: 'delete',
        emailId,
      },
    })

    if (error) {
      console.error('Error invoking resend-inbox delete function:', error)
      throw new Error(error.message || 'Failed to delete inbox email')
    }

    if (data && !data.success) {
      throw new Error(data.message || 'Failed to delete inbox email')
    }
  } catch (error) {
    console.error('Error deleting received email:', error)
    throw error
  }
}

// Placeholder functions for future use (e.g., viewing full message or downloading attachments)
// Currently the UI only uses the list endpoint, so these remain unimplemented.
export async function getReceivedEmailById(_emailId: string): Promise<ReceivedEmail> {
  throw new Error('getReceivedEmailById is not implemented yet.')
}

export async function getReceivedEmailAttachment(
  _emailId: string,
  _attachmentId: string
): Promise<Blob> {
  throw new Error('getReceivedEmailAttachment is not implemented yet.')
}

export const resendInboxAPI = {
  list: listReceivedEmails,
  delete: deleteReceivedEmail,
  getById: getReceivedEmailById,
  getAttachment: getReceivedEmailAttachment,
}

