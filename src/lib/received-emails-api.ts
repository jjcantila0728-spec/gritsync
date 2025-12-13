/**
 * Received Emails API
 * Manages received emails stored in our database (from Resend webhook)
 */

import { supabase } from './supabase'

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

/**
 * Get received emails for current user
 */
export async function getReceivedEmails(options: ReceivedEmailsListOptions = {}): Promise<ReceivedEmail[]> {
  try {
    const {
      limit = 50,
      offset = 0,
      toEmail,
      isRead,
      includeDeleted = false,
    } = options

    let query = supabase
      .from('received_emails')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    // Filter by recipient email if provided
    if (toEmail) {
      query = query.eq('to_email', toEmail)
    }

    // Filter by read status if provided
    if (isRead !== undefined) {
      query = query.eq('is_read', isRead)
    }

    // Exclude deleted unless explicitly included
    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching received emails:', error)
      throw new Error(error.message)
    }

    return data as ReceivedEmail[]
  } catch (error) {
    console.error('Error in getReceivedEmails:', error)
    throw error
  }
}

/**
 * Get a single received email by ID
 */
export async function getReceivedEmailById(id: string): Promise<ReceivedEmail | null> {
  try {
    const { data, error } = await supabase
      .from('received_emails')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error('Error fetching received email:', error)
      throw new Error(error.message)
    }

    return data as ReceivedEmail
  } catch (error) {
    console.error('Error in getReceivedEmailById:', error)
    throw error
  }
}

/**
 * Mark email as read
 */
export async function markAsRead(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('received_emails')
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      console.error('Error marking email as read:', error)
      throw new Error(error.message)
    }
  } catch (error) {
    console.error('Error in markAsRead:', error)
    throw error
  }
}

/**
 * Mark email as unread
 */
export async function markAsUnread(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('received_emails')
      .update({ is_read: false })
      .eq('id', id)

    if (error) {
      console.error('Error marking email as unread:', error)
      throw new Error(error.message)
    }
  } catch (error) {
    console.error('Error in markAsUnread:', error)
    throw error
  }
}

/**
 * Soft delete email (mark as deleted)
 */
export async function deleteReceivedEmail(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('received_emails')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      console.error('Error deleting received email:', error)
      throw new Error(error.message)
    }
  } catch (error) {
    console.error('Error in deleteReceivedEmail:', error)
    throw error
  }
}

/**
 * Batch delete emails
 */
export async function batchDeleteReceivedEmails(ids: string[]): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const id of ids) {
    try {
      await deleteReceivedEmail(id)
      results.success++
    } catch (error: any) {
      results.failed++
      results.errors.push(`${id}: ${error.message}`)
    }
  }

  return results
}

/**
 * Get unread count for user
 */
export async function getUnreadCount(toEmail?: string): Promise<number> {
  try {
    let query = supabase
      .from('received_emails')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('is_deleted', false)

    if (toEmail) {
      query = query.eq('to_email', toEmail)
    }

    const { count, error } = await query

    if (error) {
      console.error('Error getting unread count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error in getUnreadCount:', error)
    return 0
  }
}

// Export as default object for easier imports
export const receivedEmailsAPI = {
  getAll: getReceivedEmails,
  getById: getReceivedEmailById,
  markAsRead,
  markAsUnread,
  delete: deleteReceivedEmail,
  batchDelete: batchDeleteReceivedEmails,
  getUnreadCount,
}

