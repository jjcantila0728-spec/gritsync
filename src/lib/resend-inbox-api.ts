/**
 * Resend Inbox API - Complete Integration with Resend for receiving emails
 * Reference: https://resend.com/docs/api-reference/emails/list-received-emails
 * Reference: https://resend.com/docs/api-reference/emails/retrieve-received-email
 * Reference: https://resend.com/docs/dashboard/receiving/attachments
 */

import { supabase } from './supabase'

export interface ReceivedEmailAttachment {
  id: string
  filename: string
  content_type: string
  content_id: string | null
  content_disposition: string
  size: number
  download_url?: string  // Available when fetching attachment details
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

/**
 * List received emails via Supabase Edge Function proxy to Resend
 * Reference: https://resend.com/docs/api-reference/emails/list-received-emails
 * 
 * Query Parameters:
 * - limit: Number of emails to retrieve (max: 100, min: 1)
 * - after: ID after which to retrieve more emails (pagination)
 * - before: ID before which to retrieve more emails (pagination)
 * - to: Filter by recipient email address
 * 
 * Note: Cannot use both 'after' and 'before' parameters simultaneously
 */
export async function listReceivedEmails(options?: {
  limit?: number
  after?: string
  before?: string
  to?: string
}): Promise<ListReceivedEmailsResponse> {
  try {
    // Validate limit parameter
    if (options?.limit && (options.limit < 1 || options.limit > 100)) {
      throw new Error('Limit must be between 1 and 100')
    }

    // Validate pagination parameters
    if (options?.after && options?.before) {
      throw new Error('Cannot use both "after" and "before" parameters')
    }

    const { data, error } = await supabase.functions.invoke('resend-inbox', {
      body: {
        action: 'list',
        options: {
          limit: options?.limit,
          after: options?.after,
          before: options?.before,
          to: options?.to,
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

    // Check if the response contains an error (from edge function)
    if (data.error) {
      const errorMsg = data.message || data.error
      console.error('Resend inbox API error:', errorMsg)
      throw new Error(errorMsg)
    }

    return data as ListReceivedEmailsResponse
  } catch (error) {
    console.error('Error fetching received emails:', error)
    throw error
  }
}

/**
 * Retrieve a single received email by ID
 * Reference: https://resend.com/docs/api-reference/emails/retrieve-received-email
 * 
 * Returns complete email details including:
 * - Full HTML content
 * - Plain text content
 * - Email headers
 * - All attachment metadata
 */
export async function getReceivedEmailById(emailId: string): Promise<ReceivedEmail> {
  try {
    if (!emailId) {
      throw new Error('Email ID is required')
    }

    const { data, error } = await supabase.functions.invoke('resend-inbox', {
      body: {
        action: 'get',
        emailId,
      },
    })

    if (error) {
      console.error('Error invoking resend-inbox get function:', error)
      throw new Error(error.message || 'Failed to retrieve email')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from resend-inbox function')
    }

    // Check if the response contains an error (from edge function)
    if (data.error) {
      const errorMsg = data.message || data.error
      console.error('Resend inbox API error:', errorMsg)
      throw new Error(errorMsg)
    }

    return data as ReceivedEmail
  } catch (error) {
    console.error('Error fetching received email by ID:', error)
    throw error
  }
}

/**
 * List all attachments for a received email
 * Reference: https://resend.com/docs/api-reference/emails/list-received-email-attachments
 * 
 * Returns array of attachments with download URLs
 */
export async function listReceivedEmailAttachments(emailId: string): Promise<ListAttachmentsResponse> {
  try {
    if (!emailId) {
      throw new Error('Email ID is required')
    }

    const { data, error } = await supabase.functions.invoke('resend-inbox', {
      body: {
        action: 'list-attachments',
        emailId,
      },
    })

    if (error) {
      console.error('Error invoking resend-inbox list-attachments function:', error)
      throw new Error(error.message || 'Failed to list attachments')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from resend-inbox function')
    }

    // Check if the response contains an error (from edge function)
    if (data.error) {
      const errorMsg = data.message || data.error
      console.error('Resend inbox API error:', errorMsg)
      throw new Error(errorMsg)
    }

    return data as ListAttachmentsResponse
  } catch (error) {
    console.error('Error listing email attachments:', error)
    throw error
  }
}

/**
 * Get attachment content by ID
 * Reference: https://resend.com/docs/api-reference/emails/retrieve-received-email-attachment
 * 
 * Downloads the actual attachment content as a Blob
 * Can be used to display images, download files, etc.
 */
export async function getReceivedEmailAttachment(
  emailId: string,
  attachmentId: string
): Promise<Blob> {
  try {
    if (!emailId || !attachmentId) {
      throw new Error('Email ID and Attachment ID are required')
    }

    const { data, error } = await supabase.functions.invoke('resend-inbox', {
      body: {
        action: 'get-attachment',
        emailId,
        attachmentId,
      },
    })

    if (error) {
      console.error('Error invoking resend-inbox get-attachment function:', error)
      throw new Error(error.message || 'Failed to retrieve attachment')
    }

    if (!data) {
      throw new Error('No attachment data returned')
    }

    // Check if the response contains an error (from edge function)
    if (typeof data === 'object' && data.error) {
      const errorMsg = data.message || data.error
      console.error('Resend inbox API error:', errorMsg)
      throw new Error(errorMsg)
    }

    // If data is already a Blob, return it
    if (data instanceof Blob) {
      return data
    }

    // If data contains a download URL, fetch it
    if (data.download_url) {
      const response = await fetch(data.download_url)
      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.statusText}`)
      }
      return await response.blob()
    }

    throw new Error('Invalid attachment data format')
  } catch (error) {
    console.error('Error fetching attachment:', error)
    throw error
  }
}

/**
 * Download attachment using download URL
 * Reference: https://resend.com/docs/dashboard/receiving/attachments
 * 
 * Triggers browser download for the attachment
 */
export async function downloadAttachment(
  emailId: string,
  attachmentId: string,
  filename: string
): Promise<void> {
  try {
    const blob = await getReceivedEmailAttachment(emailId, attachmentId)
    
    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading attachment:', error)
    throw error
  }
}

/**
 * Delete a received email from Resend
 */
export async function deleteReceivedEmail(emailId: string): Promise<void> {
  try {
    if (!emailId) {
      throw new Error('Email ID is required')
    }

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

    // Check if the response contains an error (from edge function)
    if (data && data.error) {
      const errorMsg = data.message || data.error
      console.error('Resend inbox API error:', errorMsg)
      throw new Error(errorMsg)
    }

    if (data && !data.success) {
      throw new Error(data.message || 'Failed to delete inbox email')
    }
  } catch (error) {
    console.error('Error deleting received email:', error)
    throw error
  }
}

/**
 * Batch delete multiple received emails
 */
export async function batchDeleteReceivedEmails(emailIds: string[]): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const emailId of emailIds) {
    try {
      await deleteReceivedEmail(emailId)
      results.success++
    } catch (error: any) {
      results.failed++
      results.errors.push(`${emailId}: ${error.message}`)
    }
  }

  return results
}

/**
 * Get received emails for a specific email address (client-safe)
 * Filters emails by the 'to' field to ensure clients only see their own emails
 */
export async function getReceivedEmails(options: {
  to: string
  limit?: number
  after?: string
  before?: string
}): Promise<ReceivedEmail[]> {
  try {
    if (!options.to) {
      throw new Error('Recipient email address is required')
    }

    console.log('getReceivedEmails: Requesting emails for:', options.to)

    // IMPORTANT: Don't pass 'to' filter to Resend API - it may not work as expected
    // Instead, fetch all emails and filter client-side for more reliable results
    const response = await listReceivedEmails({
      limit: options.limit || 50,
      after: options.after,
      before: options.before,
      // Removed: to: options.to  <- This was causing empty results
    })

    console.log('getReceivedEmails: Response from API (no filter):', {
      totalEmails: response.data?.length,
      hasMore: response.has_more,
      sampleEmails: response.data?.slice(0, 3).map(e => ({
        id: e.id,
        to: e.to,
        from: e.from,
        subject: e.subject,
      }))
    })

    // Client-side filtering - Filter emails where the client's email is in the 'to' array
    const filteredEmails = response.data.filter((email) => {
      const toAddresses = Array.isArray(email.to) ? email.to : [email.to]
      const matches = toAddresses.some((addr) => 
        addr.toLowerCase() === options.to.toLowerCase()
      )
      
      if (!matches) {
        console.log('getReceivedEmails: Email filtered out:', {
          emailTo: toAddresses,
          lookingFor: options.to,
        })
      }
      
      return matches
    })

    console.log('getReceivedEmails: After client-side filtering:', {
      originalCount: response.data?.length,
      filteredCount: filteredEmails.length,
      filteringFor: options.to,
    })

    return filteredEmails
  } catch (error) {
    console.error('Error fetching received emails for user:', error)
    throw error
  }
}

/**
 * Get paginated received emails with metadata
 */
export async function getReceivedEmailsPaginated(options: {
  to?: string
  limit?: number
  after?: string
  before?: string
}): Promise<{
  emails: ReceivedEmail[]
  hasMore: boolean
  nextCursor?: string
  prevCursor?: string
}> {
  try {
    const response = await listReceivedEmails({
      limit: options.limit || 50,
      after: options.after,
      before: options.before,
      to: options.to,
    })

    const emails = options.to
      ? response.data.filter((email) => {
          const toAddresses = Array.isArray(email.to) ? email.to : [email.to]
          return toAddresses.some((addr) => 
            addr.toLowerCase() === options.to!.toLowerCase()
          )
        })
      : response.data

    // Get cursors for pagination
    const nextCursor = response.has_more && emails.length > 0 
      ? emails[emails.length - 1].id 
      : undefined
    const prevCursor = emails.length > 0 
      ? emails[0].id 
      : undefined

    return {
      emails,
      hasMore: response.has_more,
      nextCursor,
      prevCursor,
    }
  } catch (error) {
    console.error('Error fetching paginated emails:', error)
    throw error
  }
}

/**
 * Process email attachments (e.g., for webhooks)
 * Reference: https://resend.com/docs/dashboard/receiving/attachments
 */
export async function processEmailAttachments(emailId: string): Promise<{
  processed: number
  failed: number
  attachments: AttachmentDetails[]
}> {
  try {
    const { data: attachments } = await listReceivedEmailAttachments(emailId)
    
    const results = {
      processed: 0,
      failed: 0,
      attachments: attachments.data,
    }

    for (const attachment of attachments.data) {
      try {
        // Download attachment using download_url
        const response = await fetch(attachment.download_url)
        if (!response.ok) {
          console.error(`Failed to download ${attachment.filename}`)
          results.failed++
          continue
        }

        // Get the file's contents
        const buffer = await response.arrayBuffer()
        
        // Here you can process the content:
        // - Save to storage (Supabase Storage, S3, etc.)
        // - Analyze the file
        // - Extract text/data
        // - Generate thumbnails for images
        console.log(`Processed attachment: ${attachment.filename} (${buffer.byteLength} bytes)`)
        
        results.processed++
      } catch (error) {
        console.error(`Error processing attachment ${attachment.filename}:`, error)
        results.failed++
      }
    }

    return results
  } catch (error) {
    console.error('Error processing email attachments:', error)
    throw error
  }
}

/**
 * Check if email has attachments
 */
export function hasAttachments(email: ReceivedEmail): boolean {
  return email.attachments && email.attachments.length > 0
}

/**
 * Get total attachment size for an email
 */
export function getTotalAttachmentSize(email: ReceivedEmail): number {
  if (!email.attachments) return 0
  return email.attachments.reduce((total, attachment) => total + (attachment.size || 0), 0)
}

/**
 * Format attachment size for display
 */
export function formatAttachmentSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get attachment icon based on content type
 */
export function getAttachmentIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return '🖼️'
  if (contentType.startsWith('video/')) return '🎥'
  if (contentType.startsWith('audio/')) return '🎵'
  if (contentType.includes('pdf')) return '📄'
  if (contentType.includes('word') || contentType.includes('document')) return '📝'
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊'
  if (contentType.includes('powerpoint') || contentType.includes('presentation')) return '📽️'
  if (contentType.includes('zip') || contentType.includes('compressed')) return '📦'
  if (contentType.includes('text')) return '📃'
  return '📎'
}

/**
 * Check if attachment is an image
 */
export function isImageAttachment(attachment: ReceivedEmailAttachment): boolean {
  return attachment.content_type.startsWith('image/')
}

/**
 * Preview image attachment inline
 */
export async function getImageAttachmentPreview(
  emailId: string,
  attachmentId: string
): Promise<string> {
  const blob = await getReceivedEmailAttachment(emailId, attachmentId)
  return URL.createObjectURL(blob)
}

// Export all functions as a consolidated API object
export const resendInboxAPI = {
  // Email operations
  list: listReceivedEmails,
  getById: getReceivedEmailById,
  delete: deleteReceivedEmail,
  batchDelete: batchDeleteReceivedEmails,
  
  // Client-safe operations
  getReceivedEmails,
  getReceivedEmailsPaginated,
  
  // Attachment operations
  listAttachments: listReceivedEmailAttachments,
  getAttachment: getReceivedEmailAttachment,
  downloadAttachment,
  processAttachments: processEmailAttachments,
  getImagePreview: getImageAttachmentPreview,
  
  // Utility functions
  hasAttachments,
  getTotalAttachmentSize,
  formatAttachmentSize,
  getAttachmentIcon,
  isImageAttachment,
}

export default resendInboxAPI
