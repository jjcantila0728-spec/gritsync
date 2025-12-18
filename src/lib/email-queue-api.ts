/**
 * Email Queue API
 * Handles scheduling and queuing emails for future delivery
 */

import { supabase } from './supabase'

export interface EmailQueueItem {
  id?: string
  recipient_email: string
  recipient_name?: string | null
  recipient_user_id?: string | null
  subject: string
  body_html: string
  body_text?: string | null
  sender_email?: string | null
  sender_name?: string | null
  from_email_address_id?: string | null
  scheduled_for: string // ISO timestamp
  timezone?: string
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  email_type?: 'transactional' | 'notification' | 'marketing' | 'manual' | 'automated'
  email_category?: string | null
  priority?: number // 1-10, 1 = highest
  application_id?: string | null
  quotation_id?: string | null
  donation_id?: string | null
  sponsorship_id?: string | null
  retry_count?: number
  max_retries?: number
  metadata?: Record<string, any>
  tags?: string[]
  created_by_user_id?: string | null
  created_at?: string
  updated_at?: string
  cancelled_at?: string | null
}

export interface EmailQueueFilters {
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  recipient_email?: string
  scheduled_from?: string
  scheduled_to?: string
  email_type?: string
  email_category?: string
  limit?: number
  offset?: number
}

export const emailQueueAPI = {
  /**
   * Schedule an email to be sent at a future time
   */
  async schedule(data: Omit<EmailQueueItem, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<EmailQueueItem> {
    const { data: { user } } = await supabase.auth.getUser()
    
    const queueData: Partial<EmailQueueItem> = {
      ...data,
      status: 'pending',
      created_by_user_id: user?.id || null,
      priority: data.priority || 5,
      max_retries: data.max_retries || 3,
      retry_count: 0,
      timezone: data.timezone || 'UTC',
      metadata: data.metadata || {},
      tags: data.tags || [],
    }

    const { data: result, error } = await supabase
      .from('email_queue')
      .insert(queueData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return result as EmailQueueItem
  },

  /**
   * Get all queued emails with optional filters
   */
  async getAll(filters?: EmailQueueFilters): Promise<EmailQueueItem[]> {
    let query = supabase
      .from('email_queue')
      .select('*')
      .order('scheduled_for', { ascending: true })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.recipient_email) {
      query = query.ilike('recipient_email', `%${filters.recipient_email}%`)
    }

    if (filters?.scheduled_from) {
      query = query.gte('scheduled_for', filters.scheduled_from)
    }

    if (filters?.scheduled_to) {
      query = query.lte('scheduled_for', filters.scheduled_to)
    }

    if (filters?.email_type) {
      query = query.eq('email_type', filters.email_type)
    }

    if (filters?.email_category) {
      query = query.eq('email_category', filters.email_category)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as EmailQueueItem[]
  },

  /**
   * Get a single queued email by ID
   */
  async getById(id: string): Promise<EmailQueueItem | null> {
    const { data, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(error.message)
    }

    return data as EmailQueueItem
  },

  /**
   * Update a queued email
   */
  async update(id: string, updates: Partial<EmailQueueItem>): Promise<EmailQueueItem> {
    const { data, error } = await supabase
      .from('email_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EmailQueueItem
  },

  /**
   * Cancel a scheduled email
   */
  async cancel(id: string): Promise<EmailQueueItem> {
    return await this.update(id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
  },

  /**
   * Get pending emails ready to send (used by worker)
   */
  async getPendingToSend(limit: number = 50): Promise<EmailQueueItem[]> {
    const { data, error } = await supabase.rpc('get_pending_emails_to_send', {
      limit_count: limit
    })

    if (error) throw new Error(error.message)
    return (data || []) as EmailQueueItem[]
  },

  /**
   * Mark email as processing (used by worker)
   */
  async markProcessing(id: string): Promise<void> {
    const { error } = await supabase.rpc('mark_email_processing', {
      queue_id: id
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Mark email as sent (used by worker)
   */
  async markSent(id: string, providerMessageId?: string, providerResponse?: any): Promise<void> {
    const { error } = await supabase.rpc('mark_email_sent', {
      queue_id: id,
      provider_message_id: providerMessageId || null,
      provider_response: providerResponse || null
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Mark email as failed (used by worker)
   */
  async markFailed(id: string, errorMessage: string, providerResponse?: any): Promise<void> {
    const { error } = await supabase.rpc('mark_email_failed', {
      queue_id: id,
      error_message: errorMessage,
      provider_response: providerResponse || null
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number
    pending: number
    processing: number
    sent: number
    failed: number
    cancelled: number
    scheduled_today: number
    scheduled_this_week: number
  }> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week

    const [all, pending, processing, sent, failed, cancelled, today, thisWeek] = await Promise.all([
      supabase.from('email_queue').select('id', { count: 'exact', head: true }),
      supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
      supabase.from('email_queue').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('scheduled_for', todayStart.toISOString())
        .lt('scheduled_for', new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('email_queue').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('scheduled_for', weekStart.toISOString())
        .lt('scheduled_for', new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    return {
      total: all.count || 0,
      pending: pending.count || 0,
      processing: processing.count || 0,
      sent: sent.count || 0,
      failed: failed.count || 0,
      cancelled: cancelled.count || 0,
      scheduled_today: today.count || 0,
      scheduled_this_week: thisWeek.count || 0,
    }
  },

  /**
   * Delete a queued email (only if not sent)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('email_queue')
      .delete()
      .eq('id', id)
      .in('status', ['pending', 'cancelled', 'failed'])

    if (error) throw new Error(error.message)
  },
}



