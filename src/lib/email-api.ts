/**
 * Email API - Enterprise-grade email management
 * Handles email logs, analytics, and admin email operations
 */

import { apiClient } from './api-client';

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

export const emailLogsAPI = {
  async getAll(options?: {
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
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.pageSize) params.append('pageSize', String(options.pageSize));
    if (options?.status) params.append('status', options.status);
    if (options?.emailType) params.append('emailType', options.emailType);
    if (options?.search) params.append('search', options.search);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    
    const queryString = params.toString();
    const url = `/emails/logs${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getById(id: string): Promise<EmailLog | null> {
    try {
      return await apiClient.get<EmailLog>(`/emails/logs/${id}`);
    } catch {
      return null;
    }
  },
  
  async getByUserId(userId: string, limit?: number): Promise<EmailLog[]> {
    const response = await this.getAll({ 
      pageSize: limit || 50 
    });
    return response.data.filter(log => log.recipient_user_id === userId);
  },
  
  async getByApplicationId(applicationId: string): Promise<EmailLog[]> {
    const response = await this.getAll({ pageSize: 100 });
    return response.data.filter(log => log.application_id === applicationId);
  },
  
  async getStats(options?: {
    startDate?: string
    endDate?: string
    emailType?: string
  }): Promise<EmailStats> {
    return apiClient.get<EmailStats>('/emails/logs/stats');
  },
  
  async getAnalytics(options?: {
    startDate?: string
    endDate?: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<EmailAnalytics[]> {
    return [];
  },
  
  async delete(id: string): Promise<void> {
    return;
  },
  
  async retry(id: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Not implemented' };
  }
};

export async function sendEmailWithLogging(options: SendEmailOptions): Promise<{
  success: boolean
  data?: any
  error?: string
  emailLogId?: string
}> {
  try {
    const result = await apiClient.post<{ success: boolean; data?: any; error?: string }>('/emails/send-with-logging', {
      to: options.to,
      toName: options.toName,
      subject: options.subject,
      html: options.html,
      text: options.text,
      emailType: options.emailType,
      emailCategory: options.emailCategory,
      fromName: options.fromName,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc
    });
    
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendTestEmail(email: string, subject?: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await apiClient.post('/emails/test', { email, subject });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendDonationReceipt(email: string, name: string, amount: string, donationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await apiClient.post('/emails/donation-receipt', { email, name, amount, donationId });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
