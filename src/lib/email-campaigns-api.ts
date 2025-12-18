/**
 * Email Campaigns API
 * Handles email campaigns, newsletters, and subscriber management
 */


export type CampaignType = 'newsletter' | 'broadcast' | 'announcement' | 'promotional' | 'transactional'
export type RecipientType = 'subscribers' | 'users' | 'custom' | 'segment'
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled' | 'failed'
export type SubscriberStatus = 'subscribed' | 'unsubscribed' | 'bounced' | 'complained'

export interface EmailSubscriber {
  id?: string
  email: string
  first_name?: string
  last_name?: string
  phone_number?: string
  status?: SubscriberStatus
  subscribed_at?: string
  unsubscribed_at?: string
  unsubscribe_reason?: string
  email_preferences?: Record<string, any>
  tags?: string[]
  source?: string
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
  last_email_sent_at?: string
  email_count?: number
}

export interface EmailCampaign {
  id?: string
  name: string
  description?: string
  subject: string
  body_html: string
  body_text?: string
  campaign_type?: CampaignType
  recipient_type?: RecipientType
  recipient_segment?: Record<string, any>
  recipient_list?: string[]
  recipient_count?: number
  scheduled_for?: string
  timezone?: string
  status?: CampaignStatus
  send_rate?: number
  from_email_address_id?: string
  reply_to?: string
  sent_count?: number
  delivered_count?: number
  opened_count?: number
  clicked_count?: number
  bounced_count?: number
  unsubscribed_count?: number
  failed_count?: number
  open_rate?: number
  click_rate?: number
  bounce_rate?: number
  created_by_user_id?: string
  created_at?: string
  updated_at?: string
  sent_at?: string
  completed_at?: string
}

export interface CampaignRecipient {
  id?: string
  campaign_id: string
  subscriber_id?: string
  recipient_email: string
  recipient_name?: string
  status?: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'unsubscribed'
  sent_at?: string
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  bounced_at?: string
  unsubscribed_at?: string
  opened_count?: number
  clicked_count?: number
  last_opened_at?: string
  last_clicked_at?: string
  click_links?: Record<string, any>
  error_message?: string
  provider_message_id?: string
  provider_response?: any
  created_at?: string
}

export const emailCampaignsAPI = {
  /**
   * Get all campaigns
   */
  async getAll(filters?: {
    status?: CampaignStatus
    campaign_type?: CampaignType
    limit?: number
  }): Promise<EmailCampaign[]> {
    let query = supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.campaign_type) {
      query = query.eq('campaign_type', filters.campaign_type)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as EmailCampaign[]
  },

  /**
   * Get campaign by ID
   */
  async getById(id: string): Promise<EmailCampaign | null> {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as EmailCampaign
  },

  /**
   * Create a new campaign
   */
  async create(campaign: Omit<EmailCampaign, 'id' | 'created_at' | 'updated_at'>): Promise<EmailCampaign> {
    const { data: { user } } = await supabase.auth.getUser()

    const campaignData: Partial<EmailCampaign> = {
      ...campaign,
      created_by_user_id: user?.id ?? undefined,
      status: campaign.status || 'draft',
      recipient_count: 0,
      sent_count: 0,
      delivered_count: 0,
      opened_count: 0,
      clicked_count: 0,
      bounced_count: 0,
      unsubscribed_count: 0,
      failed_count: 0,
      open_rate: 0,
      click_rate: 0,
      bounce_rate: 0,
    }

    const { data, error } = await supabase
      .from('email_campaigns')
      .insert(campaignData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EmailCampaign
  },

  /**
   * Update campaign
   */
  async update(id: string, updates: Partial<EmailCampaign>): Promise<EmailCampaign> {
    const { data, error } = await supabase
      .from('email_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as EmailCampaign
  },

  /**
   * Delete campaign
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Schedule campaign
   */
  async schedule(id: string, scheduledFor: string): Promise<EmailCampaign> {
    return await this.update(id, {
      scheduled_for: scheduledFor,
      status: 'scheduled',
    })
  },

  /**
   * Get campaign recipients
   */
  async getRecipients(campaignId: string): Promise<CampaignRecipient[]> {
    const { data, error } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []) as CampaignRecipient[]
  },

  /**
   * Get campaign statistics
   */
  async getStats(campaignId: string): Promise<{
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
    failed: number
    open_rate: number
    click_rate: number
    bounce_rate: number
  }> {
    const { error } = await supabase.rpc('update_campaign_stats', {
      p_campaign_id: campaignId
    })

    if (error) throw new Error(error.message)

    const campaign = await this.getById(campaignId)
    if (!campaign) throw new Error('Campaign not found')

    return {
      sent: campaign.sent_count || 0,
      delivered: campaign.delivered_count || 0,
      opened: campaign.opened_count || 0,
      clicked: campaign.clicked_count || 0,
      bounced: campaign.bounced_count || 0,
      unsubscribed: campaign.unsubscribed_count || 0,
      failed: campaign.failed_count || 0,
      open_rate: campaign.open_rate || 0,
      click_rate: campaign.click_rate || 0,
      bounce_rate: campaign.bounce_rate || 0,
    }
  },
}

export const emailSubscribersAPI = {
  /**
   * Get all subscribers
   */
  async getAll(filters?: {
    status?: SubscriberStatus
    tags?: string[]
    limit?: number
  }): Promise<EmailSubscriber[]> {
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

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as EmailSubscriber[]
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
   * Subscribe email
   */
  async subscribe(data: {
    email: string
    first_name?: string
    last_name?: string
    phone_number?: string
    tags?: string[]
    source?: string
    metadata?: Record<string, any>
  }): Promise<EmailSubscriber> {
    const subscriberData: Partial<EmailSubscriber> = {
      email: data.email.toLowerCase(),
      first_name: data.first_name,
      last_name: data.last_name,
      phone_number: data.phone_number,
      tags: data.tags || [],
      source: data.source || 'manual',
      metadata: data.metadata || {},
      status: 'subscribed',
    }

    const { data: result, error } = await supabase
      .from('email_subscribers')
      .upsert(subscriberData, {
        onConflict: 'email',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return result as EmailSubscriber
  },

  /**
   * Unsubscribe email
   */
  async unsubscribe(email: string, reason?: string): Promise<EmailSubscriber> {
    const { data, error } = await supabase
      .from('email_subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_reason: reason,
      })
      .eq('email', email.toLowerCase())
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
   * Import subscribers from CSV
   */
  async importFromCSV(
    csvData: Array<{
      email: string
      first_name?: string
      last_name?: string
      phone_number?: string
      tags?: string[]
    }>,
    source: string = 'csv_import'
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of csvData) {
      try {
        if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          skipped++
          errors.push(`Invalid email: ${row.email}`)
          continue
        }

        await this.subscribe({
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
          phone_number: row.phone_number,
          tags: row.tags || [],
          source,
        })

        imported++
      } catch (error: any) {
        skipped++
        errors.push(`Error importing ${row.email}: ${error.message}`)
      }
    }

    return { imported, skipped, errors }
  },

  /**
   * Get subscriber count by segment
   */
  async getCountBySegment(tags?: string[], status: SubscriberStatus = 'subscribed'): Promise<number> {
    const { data, error } = await supabase.rpc('get_subscriber_count_by_segment', {
      p_tags: tags || null,
      p_status: status,
    })

    if (error) throw new Error(error.message)
    return data || 0
  },

  /**
   * Get subscribers for segment
   */
  async getSubscribersForSegment(
    tags?: string[],
    status: SubscriberStatus = 'subscribed',
    limit: number = 1000
  ): Promise<EmailSubscriber[]> {
    const { data, error } = await supabase.rpc('get_subscribers_for_segment', {
      p_tags: tags || null,
      p_status: status,
      p_limit: limit,
    })

    if (error) throw new Error(error.message)
    return (data || []) as EmailSubscriber[]
  },

  /**
   * Get subscriber statistics
   */
  async getStats(): Promise<{
    total: number
    subscribed: number
    unsubscribed: number
    bounced: number
    complained: number
  }> {
    const [total, subscribed, unsubscribed, bounced, complained] = await Promise.all([
      supabase.from('email_subscribers').select('id', { count: 'exact', head: true }),
      supabase.from('email_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'subscribed'),
      supabase.from('email_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
      supabase.from('email_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'bounced'),
      supabase.from('email_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'complained'),
    ])

    return {
      total: total.count || 0,
      subscribed: subscribed.count || 0,
      unsubscribed: unsubscribed.count || 0,
      bounced: bounced.count || 0,
      complained: complained.count || 0,
    }
  },
}



