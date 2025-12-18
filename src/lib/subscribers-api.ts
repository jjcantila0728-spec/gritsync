/**
 * Email Subscribers API
 * Manages email subscribers for newsletters and marketing campaigns
 * NOTE: This feature is currently stubbed pending full migration
 */

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

// Stubbed API - feature pending migration
export const subscribersAPI = {
  getAll: async (_filters?: SubscriberFilters): Promise<EmailSubscriber[]> => [],
  getById: async (_id: string): Promise<EmailSubscriber | null> => null,
  getByEmail: async (_email: string): Promise<EmailSubscriber | null> => null,
  create: async (_data: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  update: async (_id: string, _data: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  subscribe: async (_email: string, _data?: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  unsubscribe: async (_email: string, _reason?: string): Promise<boolean> => false,
  bulkImport: async (_subscribers: Partial<EmailSubscriber>[]): Promise<{ imported: number; failed: number }> => ({ imported: 0, failed: 0 }),
  bulkDelete: async (_ids: string[]): Promise<{ deleted: number; failed: number }> => ({ deleted: 0, failed: 0 }),
  getTags: async (): Promise<string[]> => [],
  addTag: async (_id: string, _tag: string): Promise<boolean> => false,
  removeTag: async (_id: string, _tag: string): Promise<boolean> => false,
  getStats: async (): Promise<SubscriberStats> => ({
    subscribed_count: 0,
    unsubscribed_count: 0,
    bounced_count: 0,
    complained_count: 0,
    pending_count: 0,
    total_count: 0,
    subscribed_percentage: 0,
    new_this_week: 0,
    new_this_month: 0,
    unsubscribed_this_week: 0,
    unsubscribed_this_month: 0,
  }),
}
