/**
 * Email Campaigns API
 * Handles email campaigns, newsletters, and subscriber management
 * NOTE: This feature is currently stubbed pending full migration
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

// Stubbed API - feature pending migration
export const emailCampaignsAPI = {
  getAll: async (_filters?: {
    status?: CampaignStatus
    campaign_type?: CampaignType
    limit?: number
  }): Promise<EmailCampaign[]> => [],
  getById: async (_id: string): Promise<EmailCampaign | null> => null,
  create: async (_campaign: Partial<EmailCampaign>): Promise<EmailCampaign | null> => null,
  update: async (_id: string, _campaign: Partial<EmailCampaign>): Promise<EmailCampaign | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  schedule: async (_id: string, _scheduledFor: string): Promise<boolean> => false,
  send: async (_id: string): Promise<boolean> => false,
  pause: async (_id: string): Promise<boolean> => false,
  resume: async (_id: string): Promise<boolean> => false,
  cancel: async (_id: string): Promise<boolean> => false,
  getRecipients: async (_campaignId: string): Promise<CampaignRecipient[]> => [],
  getStats: async (_campaignId: string): Promise<any> => ({}),
}

export const subscribersAPI = {
  getAll: async (_filters?: {
    status?: SubscriberStatus
    search?: string
    limit?: number
    offset?: number
  }): Promise<EmailSubscriber[]> => [],
  getById: async (_id: string): Promise<EmailSubscriber | null> => null,
  getByEmail: async (_email: string): Promise<EmailSubscriber | null> => null,
  create: async (_subscriber: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  update: async (_id: string, _subscriber: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  subscribe: async (_email: string, _data?: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  unsubscribe: async (_email: string, _reason?: string): Promise<boolean> => false,
  bulkImport: async (_subscribers: Partial<EmailSubscriber>[]): Promise<{ imported: number; failed: number }> => ({ imported: 0, failed: 0 }),
  bulkDelete: async (_ids: string[]): Promise<{ deleted: number; failed: number }> => ({ deleted: 0, failed: 0 }),
  getTags: async (): Promise<string[]> => [],
  addTag: async (_id: string, _tag: string): Promise<boolean> => false,
  removeTag: async (_id: string, _tag: string): Promise<boolean> => false,
}
