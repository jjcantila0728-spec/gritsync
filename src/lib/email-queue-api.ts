/**
 * Email Queue API
 * Handles scheduling and queuing emails for future delivery
 * NOTE: This feature is currently stubbed pending full migration
 */

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
  scheduled_for: string
  timezone?: string
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  email_type?: 'transactional' | 'notification' | 'marketing' | 'manual' | 'automated'
  email_category?: string | null
  priority?: number
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

// Stubbed API - feature pending migration
export const emailQueueAPI = {
  schedule: async (_data: Omit<EmailQueueItem, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<EmailQueueItem | null> => null,
  getAll: async (_filters?: EmailQueueFilters): Promise<EmailQueueItem[]> => [],
  getById: async (_id: string): Promise<EmailQueueItem | null> => null,
  update: async (_id: string, _data: Partial<EmailQueueItem>): Promise<EmailQueueItem | null> => null,
  cancel: async (_id: string): Promise<boolean> => false,
  reschedule: async (_id: string, _newTime: string): Promise<boolean> => false,
  retry: async (_id: string): Promise<boolean> => false,
  bulkCancel: async (_ids: string[]): Promise<{ cancelled: number; failed: number }> => ({ cancelled: 0, failed: 0 }),
  getStats: async (): Promise<{
    pending: number
    processing: number
    sent: number
    failed: number
    cancelled: number
  }> => ({
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  }),
  getUpcoming: async (_limit?: number): Promise<EmailQueueItem[]> => [],
  process: async (): Promise<{ processed: number; failed: number }> => ({ processed: 0, failed: 0 }),
}
