/**
 * Email Subscribers API
 * Manages email subscribers for newsletters and marketing campaigns
 */

import { supabase } from './supabase'

export interface EmailSubscriber {
  id?: string
  email: string
  first_name?: string
  last_name?: string
  phone_number?: string
  status: 'subscribed' | 'unsubscribed' | 'bounced' | 'complained' | 'pending'
  subscribed_at?: string
  unsubscribed_at?: string
  unsubscribe_reason?: string
  unsubscribe_token?: string
  email_preferences?: {
    marketing?: boolean
    newsletters?: boolean
    notifications?: boolean
    promotions?: boolean
    [key: string]: boolean | undefined
  }
  tags?: string[]
  source?: string
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
  last_email_sent_at?: string
  email_count?: number
  open_count?: number
  click_count?: number
  bounce_count?: number
}

export interface SubscriberStats {
  subscribed_count: number
  unsubscribed_count: number
  bounced_count: number
  complained_count: number
  pending_count: number
  total_count: number
  subscribed_percentage: number
  new_this_week: number
  new_this_month: number
  unsubscribed_this_week: number
  unsubscribed_this_month: number
}

export interface SubscriberFilters {
  status?: 'subscribed' | 'unsubscribed' | 'bounced' | 'complained' | 'pending'
  tags?: string[]
  source?: string
  search?: string
  limit?: number
  offset?: number
}

export const subscribersAPI = {
  /**
   * Get all subscribers with optional filters
   */
  async getAll(filters?: SubscriberFilters): Promise<EmailSubscriber[]> {
    let query = supabase
      .from('email_subscribers')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags)
    }

    if (filters?.source) {
      query = query.eq('source', filters.source)
    }

    if (filters?.search) {
      const search = `%${filters.search}%`
      query = query.or(`email.ilike.${search},first_name.ilike.${search},last_name.ilike.${search}`)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as EmailSubscriber[]
  },

  /**
   * Get subscriber by ID
   */
  async getById(id: string): Promise<EmailSubscriber | null> {
    const { data, error } = await supabase
      .from('email_subscribers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as EmailSubscriber
  },

  /**
   * Get subscriber by email
   */
  async getByEmail(email: string): Promise<EmailSubscriber | null> {
    const { data, error } = await supabase
      .from('email_subscribers')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as EmailSubscriber
  },

  /**
   * Get subscriber by unsubscribe token
   */
  async getByToken(token: string): Promise<EmailSubscriber | null> {
    const { data, error } = await supabase
      .from('email_subscribers')
      .select('*')
      .eq('unsubscribe_token', token)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as EmailSubscriber
  },

  /**
   * Subscribe a new email
   */
  async subscribe(subscriber: Omit<EmailSubscriber, 'id' | 'created_at' | 'updated_at'>): Promise<EmailSubscriber> {
    // Check if already exists
    const existing = await this.getByEmail(subscriber.email)
    
    if (existing) {
      // If previously unsubscribed, resubscribe
      if (existing.status === 'unsubscribed') {
        return await this.update(existing.id!, {
          status: 'subscribed',
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: undefined,
          unsubscribe_reason: undefined,
        })
      }
      return existing
    }

    const subscriberData = {
      ...subscriber,
      email: subscriber.email.toLowerCase(),
      status: subscriber.status || 'subscribed',
      subscribed_at: new Date().toISOString(),
      email_preferences: subscriber.email_preferences || {
        marketing: true,
        newsletters: true,
        notifications: true,
        promotions: true,
      },
      tags: subscriber.tags || [],
      metadata: subscriber.metadata || {},
      email_count: 0,
      open_count: 0,
      click_count: 0,
      bounce_count: 0,
    }

    const { data, error } = await supabase
      .from('email_subscribers')
      .insert(subscriberData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EmailSubscriber
  },

  /**
   * Update subscriber
   */
  async update(id: string, updates: Partial<EmailSubscriber>): Promise<EmailSubscriber> {
    const { data, error } = await supabase
      .from('email_subscribers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EmailSubscriber
  },

  /**
   * Delete subscriber
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('email_subscribers')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Bulk import subscribers
   */
  async bulkImport(subscribers: Omit<EmailSubscriber, 'id' | 'created_at' | 'updated_at'>[]): Promise<{
    success: number
    failed: number
    errors: { email: string; error: string }[]
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as { email: string; error: string }[],
    }

    for (const subscriber of subscribers) {
      try {
        await this.subscribe(subscriber)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          email: subscriber.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  },

  /**
   * Export subscribers to CSV format
   */
  async exportToCSV(filters?: SubscriberFilters): Promise<string> {
    const subscribers = await this.getAll(filters)
    
    // CSV headers
    const headers = ['Email', 'First Name', 'Last Name', 'Phone', 'Status', 'Subscribed At', 'Tags', 'Source', 'Email Count', 'Open Count', 'Click Count']
    
    // CSV rows
    const rows = subscribers.map(sub => [
      sub.email,
      sub.first_name || '',
      sub.last_name || '',
      sub.phone_number || '',
      sub.status,
      sub.subscribed_at || '',
      (sub.tags || []).join('; '),
      sub.source || '',
      sub.email_count || 0,
      sub.open_count || 0,
      sub.click_count || 0,
    ])

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    return csvContent
  },

  /**
   * Parse CSV file content for import
   */
  parseCSV(csvContent: string): Omit<EmailSubscriber, 'id' | 'created_at' | 'updated_at'>[] {
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
    const subscribers: Omit<EmailSubscriber, 'id' | 'created_at' | 'updated_at'>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      const subscriber: any = {
        status: 'subscribed' as const,
        source: 'import',
        tags: [],
      }

      headers.forEach((header, index) => {
        const value = values[index]
        if (!value) return

        switch (header) {
          case 'email':
          case 'email address':
            subscriber.email = value.toLowerCase()
            break
          case 'first name':
          case 'firstname':
            subscriber.first_name = value
            break
          case 'last name':
          case 'lastname':
            subscriber.last_name = value
            break
          case 'phone':
          case 'phone number':
            subscriber.phone_number = value
            break
          case 'tags':
            subscriber.tags = value.split(';').map(t => t.trim()).filter(Boolean)
            break
        }
      })

      if (subscriber.email) {
        subscribers.push(subscriber)
      }
    }

    return subscribers
  },

  /**
   * Get subscriber statistics
   */
  async getStats(): Promise<SubscriberStats> {
    const { data, error } = await supabase
      .from('subscriber_stats')
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as SubscriberStats
  },

  /**
   * Unsubscribe by token (public function)
   */
  async unsubscribe(token: string, reason?: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const { data, error } = await supabase.rpc('unsubscribe_email', {
      token_value: token,
      reason_text: reason,
    })

    if (error) throw new Error(error.message)
    return data as { success: boolean; email?: string; error?: string }
  },

  /**
   * Resubscribe by token (public function)
   */
  async resubscribe(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const { data, error } = await supabase.rpc('resubscribe_email', {
      token_value: token,
    })

    if (error) throw new Error(error.message)
    return data as { success: boolean; email?: string; error?: string }
  },

  /**
   * Update email preferences by token (public function)
   */
  async updatePreferences(
    token: string,
    preferences: Record<string, boolean>
  ): Promise<{ success: boolean; email?: string; error?: string }> {
    const { data, error } = await supabase.rpc('update_email_preferences', {
      token_value: token,
      preferences: preferences,
    })

    if (error) throw new Error(error.message)
    return data as { success: boolean; email?: string; error?: string }
  },

  /**
   * Increment email count
   */
  async incrementEmailCount(subscriberId: string): Promise<void> {
    await supabase.rpc('increment', {
      table_name: 'email_subscribers',
      row_id: subscriberId,
      column_name: 'email_count',
    })
  },

  /**
   * Increment open count
   */
  async incrementOpenCount(subscriberId: string): Promise<void> {
    await supabase.rpc('increment', {
      table_name: 'email_subscribers',
      row_id: subscriberId,
      column_name: 'open_count',
    })
  },

  /**
   * Increment click count
   */
  async incrementClickCount(subscriberId: string): Promise<void> {
    await supabase.rpc('increment', {
      table_name: 'email_subscribers',
      row_id: subscriberId,
      column_name: 'click_count',
    })
  },

  /**
   * Mark as bounced
   */
  async markAsBounced(subscriberId: string): Promise<void> {
    await this.update(subscriberId, {
      status: 'bounced',
      bounce_count: (await this.getById(subscriberId))?.bounce_count || 0 + 1,
    })
  },

  /**
   * Add tags to subscriber
   */
  async addTags(subscriberId: string, tags: string[]): Promise<void> {
    const subscriber = await this.getById(subscriberId)
    if (!subscriber) throw new Error('Subscriber not found')

    const currentTags = subscriber.tags || []
    const newTags = [...new Set([...currentTags, ...tags])]

    await this.update(subscriberId, { tags: newTags })
  },

  /**
   * Remove tags from subscriber
   */
  async removeTags(subscriberId: string, tags: string[]): Promise<void> {
    const subscriber = await this.getById(subscriberId)
    if (!subscriber) throw new Error('Subscriber not found')

    const currentTags = subscriber.tags || []
    const newTags = currentTags.filter(tag => !tags.includes(tag))

    await this.update(subscriberId, { tags: newTags })
  },
}

