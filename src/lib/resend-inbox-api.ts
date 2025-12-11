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

const RESEND_API_URL = 'https://api.resend.com'

/**
 * Get Resend API key from database settings
 */
async function getResendApiKey(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'resendApiKey')
      .single()

    if (error || !data) {
      console.error('Error fetching Resend API key from settings:', error)
      // Fallback to env variable
      return import.meta.env.VITE_RESEND_API_KEY || ''
    }

    return data.value || ''
  } catch (error) {
    console.error('Error fetching Resend API key:', error)
    return import.meta.env.VITE_RESEND_API_KEY || ''
  }
}

/**
 * List received emails from Resend
 */
export async function listReceivedEmails(options?: {
  limit?: number
  after?: string
  before?: string
}): Promise<ListReceivedEmailsResponse> {
  try {
    const apiKey = await getResendApiKey()
    
    if (!apiKey) {
      throw new Error('Resend API key not configured. Please configure it in Admin Settings > Notifications.')
    }

    const params = new URLSearchParams()
    
    if (options?.limit) {
      params.append('limit', options.limit.toString())
    }
    if (options?.after) {
      params.append('after', options.after)
    }
    if (options?.before) {
      params.append('before', options.before)
    }

    const queryString = params.toString()
    const url = `${RESEND_API_URL}/emails/receiving${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch received emails: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching received emails:', error)
    throw error
  }
}

/**
 * Retrieve a specific received email by ID
 */
export async function getReceivedEmailById(emailId: string): Promise<ReceivedEmail> {
  try {
    const apiKey = await getResendApiKey()
    
    if (!apiKey) {
      throw new Error('Resend API key not configured. Please configure it in Admin Settings > Notifications.')
    }

    const url = `${RESEND_API_URL}/emails/receiving/${emailId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch received email: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching received email:', error)
    throw error
  }
}

/**
 * Get attachment from a received email
 */
export async function getReceivedEmailAttachment(
  emailId: string,
  attachmentId: string
): Promise<Blob> {
  try {
    const apiKey = await getResendApiKey()
    
    if (!apiKey) {
      throw new Error('Resend API key not configured. Please configure it in Admin Settings > Notifications.')
    }

    const url = `${RESEND_API_URL}/emails/receiving/${emailId}/attachments/${attachmentId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.statusText}`)
    }

    return await response.blob()
  } catch (error) {
    console.error('Error fetching attachment:', error)
    throw error
  }
}

export const resendInboxAPI = {
  list: listReceivedEmails,
  getById: getReceivedEmailById,
  getAttachment: getReceivedEmailAttachment,
}

