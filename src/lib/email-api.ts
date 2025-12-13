/**
 * Email API - Enterprise-grade email management
 * Handles email logs, analytics, and admin email operations
 */

import { supabase } from './supabase'

export interface EmailLog {
  id: string
  recipient_email: string
  recipient_name: string | null
  recipient_user_id: string | null
  subject: string
  body_html: string | null
  body_text: string | null
  sender_email: string
  sender_name: string | null
  sent_by_user_id: string | null
  email_type: 'transactional' | 'notification' | 'marketing' | 'manual' | 'automated'
  email_category: string | null
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained'
  email_provider: string | null
  provider_message_id: string | null
  provider_response: any
  error_message: string | null
  error_code: string | null
  retry_count: number
  max_retries: number
  application_id: string | null
  quotation_id: string | null
  donation_id: string | null
  sponsorship_id: string | null
  metadata: Record<string, any>
  tags: string[]
  created_at: string
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  updated_at: string
}

export interface EmailAnalytics {
  date: string
  email_type: string
  email_category: string
  status: string
  count: number
  sent_count: number
  delivered_count: number
  failed_count: number
  bounced_count: number
  avg_send_time_seconds: number
}

export interface EmailStats {
  total: number
  sent: number
  delivered: number
  failed: number
  bounced: number
  pending: number
  deliveryRate: number
  failureRate: number
  avgSendTime: number
}

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  emailType?: 'transactional' | 'notification' | 'marketing' | 'manual' | 'automated'
  emailCategory?: string
  applicationId?: string
  quotationId?: string
  donationId?: string
  sponsorshipId?: string
  metadata?: Record<string, any>
  tags?: string[]
  fromEmailAddressId?: string  // ID from email_addresses table
  fromName?: string  // Sender display name
  replyTo?: string
  cc?: string
  bcc?: string
  attachments?: File[]  // File attachments
}

/**
 * Email Logs API
 */
export const emailLogsAPI = {
  /**
   * Get all email logs with pagination and filtering
   */
  getAll: async (options?: {
    page?: number
    pageSize?: number
    limit?: number
    status?: string
    emailType?: string
    emailCategory?: string
    search?: string
    startDate?: string
    endDate?: string
    recipientUserId?: string
    fromEmailAddressId?: string
  }) => {
    const {
      page = 1,
      pageSize,
      limit,
      status,
      emailType,
      emailCategory,
      search,
      startDate,
      endDate,
      recipientUserId,
      fromEmailAddressId,
    } = options || {}

    const effectivePageSize = limit || pageSize || 50

    let query = supabase
      .from('email_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (emailType) {
      query = query.eq('email_type', emailType)
    }
    if (emailCategory) {
      query = query.eq('email_category', emailCategory)
    }
    if (recipientUserId) {
      query = query.eq('recipient_user_id', recipientUserId)
    }
    if (fromEmailAddressId) {
      query = query.eq('from_email_address_id', fromEmailAddressId)
    }
    if (search) {
      query = query.or(
        `recipient_email.ilike.%${search}%,subject.ilike.%${search}%,recipient_name.ilike.%${search}%`
      )
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Apply pagination
    const start = (page - 1) * effectivePageSize
    const end = start + effectivePageSize - 1
    query = query.range(start, end)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching email logs:', error)
      throw error
    }

    return {
      data: data as EmailLog[],
      emails: data as EmailLog[],  // Alias for compatibility
      count: count || 0,
      page,
      pageSize: effectivePageSize,
      totalPages: count ? Math.ceil(count / effectivePageSize) : 0,
    }
  },

  /**
   * Get a single email log by ID
   */
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching email log:', error)
      throw error
    }

    return data as EmailLog
  },

  /**
   * Get email logs for a specific user
   */
  getByUserId: async (userId: string, limit: number = 50) => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user email logs:', error)
      throw error
    }

    return data as EmailLog[]
  },

  /**
   * Get email logs for a specific application
   */
  getByApplicationId: async (applicationId: string) => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching application email logs:', error)
      throw error
    }

    return data as EmailLog[]
  },

  /**
   * Get email statistics
   */
  getStats: async (options?: {
    startDate?: string
    endDate?: string
    emailType?: string
  }) => {
    const { startDate, endDate, emailType } = options || {}

    let query = supabase
      .from('email_logs')
      .select('status, created_at, sent_at')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (emailType) {
      query = query.eq('email_type', emailType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching email stats:', error)
      throw error
    }

    // Calculate statistics
    const total = data.length
    const sent = data.filter(log => log.status === 'sent' || log.status === 'delivered').length
    const delivered = data.filter(log => log.status === 'delivered').length
    const failed = data.filter(log => log.status === 'failed').length
    const bounced = data.filter(log => log.status === 'bounced').length
    const pending = data.filter(log => log.status === 'pending').length

    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0
    const failureRate = total > 0 ? (failed / total) * 100 : 0

    // Calculate average send time
    const sendTimes = data
      .filter(log => log.sent_at && log.created_at)
      .map(log => {
        const created = new Date(log.created_at).getTime()
        const sent = new Date(log.sent_at!).getTime()
        return (sent - created) / 1000 // in seconds
      })

    const avgSendTime = sendTimes.length > 0
      ? sendTimes.reduce((a, b) => a + b, 0) / sendTimes.length
      : 0

    return {
      total,
      sent,
      delivered,
      failed,
      bounced,
      pending,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      avgSendTime: Math.round(avgSendTime * 100) / 100,
    } as EmailStats
  },

  /**
   * Get email analytics data
   */
  getAnalytics: async (days: number = 30) => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('email_analytics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching email analytics:', error)
      throw error
    }

    return data as EmailAnalytics[]
  },

  /**
   * Refresh analytics materialized view
   */
  refreshAnalytics: async () => {
    const { error } = await supabase.rpc('refresh_email_analytics')

    if (error) {
      console.error('Error refreshing email analytics:', error)
      throw error
    }

    return true
  },

  /**
   * Create an email log entry
   */
  create: async (logData: Partial<EmailLog>) => {
    const { data, error } = await supabase
      .from('email_logs')
      .insert(logData)
      .select()
      .single()

    if (error) {
      console.error('Error creating email log:', error)
      throw error
    }

    return data as EmailLog
  },

  /**
   * Update an email log (e.g., update status after delivery)
   */
  update: async (id: string, updates: Partial<EmailLog>) => {
    const { data, error } = await supabase
      .from('email_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating email log:', error)
      throw error
    }

    return data as EmailLog
  },

  /**
   * Delete email logs (admin only)
   */
  delete: async (id: string) => {
    const { error } = await supabase
      .from('email_logs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting email log:', error)
      throw error
    }

    return true
  },

  /**
   * Bulk delete email logs
   */
  bulkDelete: async (ids: string[]) => {
    const { error } = await supabase
      .from('email_logs')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Error bulk deleting email logs:', error)
      throw error
    }

    return true
  },

  /**
   * Get email count by status
   */
  getCountByStatus: async () => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('status')

    if (error) {
      console.error('Error fetching email count by status:', error)
      throw error
    }

    const counts: Record<string, number> = {}
    data.forEach(log => {
      counts[log.status] = (counts[log.status] || 0) + 1
    })

    return counts
  },

  /**
   * Get recent failed emails
   */
  getRecentFailed: async (limit: number = 20) => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'failed')
      .order('failed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent failed emails:', error)
      throw error
    }

    return data as EmailLog[]
  },

  /**
   * Retry a failed email
   */
  retry: async (id: string) => {
    // Get the email log
    const log = await emailLogsAPI.getById(id)
    
    if (log.status !== 'failed') {
      throw new Error('Only failed emails can be retried')
    }

    if (log.retry_count >= log.max_retries) {
      throw new Error('Maximum retry attempts reached')
    }

    // Import email service
    const { sendEmail } = await import('./email-service')

    // Attempt to resend
    const success = await sendEmail({
      to: log.recipient_email,
      subject: log.subject,
      html: log.body_html || '',
      text: log.body_text,
    })

    if (success) {
      // Update the log
      await emailLogsAPI.update(id, {
        status: 'sent',
        retry_count: log.retry_count + 1,
        sent_at: new Date().toISOString(),
      })
    } else {
      // Update retry count
      await emailLogsAPI.update(id, {
        retry_count: log.retry_count + 1,
      })
    }

    return success
  },
}

/**
 * Send an email and log it
 */
export async function sendEmailWithLogging(options: SendEmailOptions): Promise<boolean> {
  const {
    to,
    toName,
    subject,
    html,
    text,
    emailType = 'manual',
    emailCategory = 'custom',
    applicationId,
    quotationId,
    donationId,
    sponsorshipId,
    metadata = {},
    tags = [],
  } = options

  try {
    // Get current user for sender info
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get email config
    const { generalSettings } = await import('./settings')
    const adminEmail = await generalSettings.getAdminEmail()
    const siteName = await generalSettings.getSiteName()

    // Create email log entry
    const logData: Partial<EmailLog> = {
      recipient_email: to,
      recipient_name: toName || null,
      subject,
      body_html: html,
      body_text: text || null,
      sender_email: adminEmail,
      sender_name: siteName,
      sent_by_user_id: user?.id || null,
      email_type: emailType,
      email_category: emailCategory,
      status: 'pending',
      application_id: applicationId || null,
      quotation_id: quotationId || null,
      donation_id: donationId || null,
      sponsorship_id: sponsorshipId || null,
      metadata,
      tags,
    }

    const emailLog = await emailLogsAPI.create(logData)

    // Send the email
    const { sendEmail } = await import('./email-service')
    const success = await sendEmail({
      to,
      subject,
      html,
      text,
      emailType,
      emailCategory,
      recipientName: toName,
      applicationId,
      quotationId,
      donationId,
      sponsorshipId,
      metadata,
      tags,
      fromEmailAddressId: options.fromEmailAddressId,
      fromName: options.fromName,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
    })

    // Update log based on result
    try {
      if (success) {
        await emailLogsAPI.update(emailLog.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } else {
        await emailLogsAPI.update(emailLog.id, {
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: 'Failed to send email',
        })
      }
    } catch (updateError: any) {
      // Log the error but don't fail if email was sent successfully
      console.error('Error updating email log status:', updateError)
      console.error('Note: Email was still sent successfully, only the status update failed')
      
      // If the email was sent successfully, still return true
      // The update failure is likely due to RLS policies
      if (success) {
        console.warn('Returning success=true despite log update failure since email was sent')
      }
    }

    return success
  } catch (error: any) {
    console.error('Error sending email with logging:', error)
    return false
  }
}

/**
 * Export for API consumers
 */
export { EmailLog, EmailAnalytics, EmailStats, SendEmailOptions }

