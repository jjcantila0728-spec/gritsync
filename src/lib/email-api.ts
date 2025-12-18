/**
 * Email API - Enterprise-grade email management
 * Handles email logs, analytics, and admin email operations
 * NOTE: This feature is currently stubbed pending full migration
 */

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
  fromEmailAddressId?: string
  fromName?: string
  replyTo?: string
  cc?: string
  bcc?: string
  attachments?: File[]
}

// Stubbed API - feature pending migration
export const emailLogsAPI = {
  getAll: async (_options?: {
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
  }): Promise<{
    data: EmailLog[]
    emails: EmailLog[]
    count: number
    page: number
    pageSize: number
    totalPages: number
  }> => ({
    data: [],
    emails: [],
    count: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
  }),
  getById: async (_id: string): Promise<EmailLog | null> => null,
  getByUserId: async (_userId: string, _limit?: number): Promise<EmailLog[]> => [],
  getByApplicationId: async (_applicationId: string): Promise<EmailLog[]> => [],
  getStats: async (_options?: {
    startDate?: string
    endDate?: string
    emailType?: string
  }): Promise<EmailStats> => ({
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    bounced: 0,
    pending: 0,
    deliveryRate: 0,
    failureRate: 0,
    avgSendTime: 0,
  }),
  getAnalytics: async (_options?: {
    startDate?: string
    endDate?: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<EmailAnalytics[]> => [],
  retry: async (_id: string): Promise<boolean> => false,
  delete: async (_id: string): Promise<boolean> => false,
  bulkDelete: async (_ids: string[]): Promise<{ deleted: number }> => ({ deleted: 0 }),
}

// Stubbed admin email API
export const adminEmailAPI = {
  send: async (_options: SendEmailOptions): Promise<{ success: boolean; emailId?: string }> => ({
    success: false,
  }),
  sendBulk: async (_emails: SendEmailOptions[]): Promise<{ sent: number; failed: number }> => ({
    sent: 0,
    failed: 0,
  }),
  getTemplates: async (): Promise<any[]> => [],
  createTemplate: async (_template: any): Promise<any> => null,
  updateTemplate: async (_id: string, _template: any): Promise<any> => null,
  deleteTemplate: async (_id: string): Promise<boolean> => false,
}

// Stub for sendEmailWithLogging
export async function sendEmailWithLogging(
  _options: SendEmailOptions
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  console.warn('Email sending is not yet migrated')
  return { success: false, error: 'Email feature not available' }
}
