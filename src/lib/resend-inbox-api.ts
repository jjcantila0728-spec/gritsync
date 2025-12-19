/**
 * Resend Inbox API - Integration with backend for receiving emails
 */

import { apiClient } from './api-client';

export interface ReceivedEmailAttachment {
  id: string
  filename: string
  content_type: string
  content_id: string | null
  content_disposition: string
  size: number
  download_url?: string
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

export async function listReceivedEmails(options?: {
  limit?: number
  after?: string
  before?: string
  to?: string
}): Promise<ListReceivedEmailsResponse> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    
    const queryString = params.toString();
    const url = `/emails/inbox${queryString ? `?${queryString}` : ''}`;
    
    return await apiClient.get<ListReceivedEmailsResponse>(url);
  } catch (error) {
    console.error('Error fetching inbox emails:', error);
    return { object: 'list', has_more: false, data: [] };
  }
}

export async function getReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  try {
    return await apiClient.get<ReceivedEmail>(`/emails/inbox/${emailId}`);
  } catch {
    return null;
  }
}

export async function listAttachments(emailId: string): Promise<ListAttachmentsResponse> {
  return { object: 'list', data: [] };
}

export async function getAttachmentDetails(emailId: string, attachmentId: string): Promise<AttachmentDetails | null> {
  return null;
}

export async function downloadAttachment(emailId: string, attachmentId: string): Promise<Blob | null> {
  return null;
}

export async function syncEmailsToDatabase(): Promise<{ synced: number; failed: number }> {
  return { synced: 0, failed: 0 };
}

export const resendInboxAPI = {
  list: listReceivedEmails,
  get: getReceivedEmail,
  getById: getReceivedEmail,
  listAttachments,
  getAttachment: getAttachmentDetails,
  downloadAttachment,
  sync: syncEmailsToDatabase,
  delete: async (_emailId: string) => { return { success: true } },
};
