import { api, API_BASE_URL } from './api'
import { storage, StorageKeys } from './storage'

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  user_id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  role?: string | null
  avatar_path?: string | null
  last_subject?: string | null
  last_message?: string | null
  last_message_at?: string | null
  last_sender_id?: string | null
  unread_count?: number | string
}

export interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string | null
  subject?: string | null
  body?: string | null
  is_read?: boolean
  read_at?: string | null
  created_at?: string
  edited_at?: string | null
  attachments?: Array<{ path: string; name: string; type?: string | null; size?: number | null }> | null
  sender_first_name?: string | null
  sender_last_name?: string | null
  sender_role?: string | null
}

export const messagesAPI = {
  async conversations(): Promise<ConversationSummary[]> {
    const res = await api.get<{ data: ConversationSummary[] }>('/messages/conversations')
    return res.data?.data ?? []
  },
  async thread(userId: string): Promise<{ messages: MessageRow[]; user: any }> {
    const res = await api.get<{ data: MessageRow[]; user: any }>(`/messages/thread/${userId}`)
    return { messages: res.data?.data ?? [], user: res.data?.user }
  },
  async send(opts: { recipientId?: string | null; body: string; subject?: string }): Promise<MessageRow> {
    const res = await api.post<{ data: MessageRow }>('/messages', {
      recipientId: opts.recipientId ?? null,
      body: opts.body,
      subject: opts.subject,
    })
    return res.data.data
  },
  async unreadCount(): Promise<number> {
    try {
      const res = await api.get<{ count: number }>('/messages/unread-count')
      return Number(res.data?.count ?? 0)
    } catch {
      return 0
    }
  },
  async markRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return
    await api.patch('/messages/read', { messageIds })
  },
}

// ---------------------------------------------------------------------------
// Notifications (uses generic /api/db/:table)
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string
  user_id: string
  application_id?: string | null
  title?: string | null
  message?: string | null
  /** Legacy alias kept for forward-compat with older rows that have `body`
   *  instead of `message`. The migration in 2026-05-15 renamed body→message
   *  but a few old rows may still surface this. */
  body?: string | null
  type?: string | null
  /** The live column name in the DB is `read` (renamed from `is_read` by
   *  scripts/migrations/2026-05-15_notifications_align_with_app.sql). We
   *  keep `is_read` as an optional alias so older mobile builds still
   *  parse the row, but writes use `read`. */
  read?: boolean | null
  is_read?: boolean | null
  read_at?: string | null
  link?: string | null
  url?: string | null
  extra?: Record<string, unknown> | null
  created_at?: string
}

/** Normalize is_read|read on the way out so consumers can ignore the rename. */
function normalizeReadFlag(row: NotificationRow): NotificationRow {
  if (row.read == null && row.is_read != null) return { ...row, read: row.is_read }
  return row
}

export const notificationsAPI = {
  async list(userId: string, limit = 50): Promise<NotificationRow[]> {
    const res = await api.get<{ data: NotificationRow[] | null }>('/db/notifications', {
      params: {
        user_id: `eq.${userId}`,
        order: 'created_at.desc',
        limit: String(limit),
      },
    })
    return (res.data?.data ?? []).map(normalizeReadFlag)
  },
  async markRead(id: string): Promise<void> {
    await api.patch('/db/notifications', {
      _filters: { id },
      read: true,
      read_at: new Date().toISOString(),
    })
  },
  async markAllRead(userId: string): Promise<void> {
    await api.patch('/db/notifications', {
      _filters: { user_id: userId, read: false },
      read: true,
      read_at: new Date().toISOString(),
    })
  },
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

export interface EmailLogRow {
  id: string
  subject?: string | null
  body_html?: string | null
  body_text?: string | null
  sender_email?: string | null
  sender_name?: string | null
  recipient_email?: string | null
  recipient_name?: string | null
  status?: string | null
  email_type?: string | null
  email_category?: string | null
  created_at?: string | null
  sent_at?: string | null
  delivered_at?: string | null
}

export const emailsAPI = {
  async myReceived(limit = 50, offset = 0): Promise<EmailLogRow[]> {
    const res = await api.get<{ data: EmailLogRow[] }>('/emails/my-received', {
      params: { limit, offset },
    })
    return res.data?.data ?? []
  },
  async sent(senderEmail: string, limit = 50): Promise<EmailLogRow[]> {
    if (!senderEmail) return []
    const res = await api.get<{ data: EmailLogRow[] }>('/db/email_logs', {
      params: {
        sender_email: `eq.${senderEmail}`,
        order: 'created_at.desc',
        limit: String(limit),
      },
    })
    return res.data?.data ?? []
  },
  async send(input: {
    to: string | string[]
    subject: string
    html: string
    text?: string
    from?: string
    replyTo?: string
    cc?: string | string[]
    bcc?: string | string[]
  }): Promise<{ id?: string }> {
    const res = await api.post('/emails/send', input)
    return res.data
  },
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export const storageAPI = {
  /**
   * Generic upload → lands in the server's Postgres `file_storage` table.
   * Use this for app-internal blobs (payment screenshots, attachments).
   * For user-visible documents that the web app's /client/documents page
   * should see, call `uploadDocument` instead — that one routes through
   * Supabase Storage so web + mobile share a single source of truth.
   */
  async upload(opts: {
    uri: string
    name: string
    mimeType?: string | null
    path: string
  }): Promise<{ path: string }> {
    return doMultipartUpload('/api/storage/upload', opts)
  },

  /**
   * Document upload that lands in Supabase Storage `documents` bucket — the
   * same bucket the web app reads from. Path is normalized server-side to
   * `<userId>/<filename>` regardless of what we send, so a file uploaded
   * here shows up on /client/documents in the browser immediately (and
   * vice versa).
   */
  async uploadDocument(opts: {
    uri: string
    name: string
    mimeType?: string | null
    /** Final filename within the user's storage folder. Convention used by
     *  the web app: `<doc_type>.<ext>` (e.g. `passport.pdf`) so re-uploads
     *  overwrite cleanly via Supabase's `upsert: true`. */
    path: string
  }): Promise<{ path: string; bucket: string }> {
    return doMultipartUpload('/api/storage/upload-document', opts)
  },

  /** Legacy file_storage signed URL (token in query string). */
  signedUrl(path: string): string {
    return `${API_BASE_URL}/api/storage/signed-url?path=${encodeURIComponent(path)}`
  },

  /**
   * Ask the server for a short-lived Supabase signed URL for a document.
   * Returns null if the file isn't found (e.g. uploaded long ago and pruned).
   */
  async signedDocumentUrl(path: string, expiresIn = 3600): Promise<string | null> {
    try {
      const res = await api.get<{ url?: string }>('/storage/document-url', {
        params: { path, expiresIn },
      })
      return res.data?.url ?? null
    } catch {
      return null
    }
  },

  async deleteDocument(path: string): Promise<void> {
    await api.delete('/storage/document', { data: { path } })
  },
}

async function doMultipartUpload(
  endpoint: string,
  opts: { uri: string; name: string; mimeType?: string | null; path: string },
): Promise<any> {
  const form = new FormData()
  // React Native FormData accepts { uri, name, type } objects directly and
  // translates them to a multipart part on the network.
  form.append('file', {
    uri: opts.uri,
    name: opts.name,
    type: opts.mimeType || 'application/octet-stream',
  } as unknown as Blob)
  form.append('path', opts.path)

  const token = await storage.get(StorageKeys.accessToken)
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    body: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Upload failed (${res.status})`)
  }
  return await res.json()
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export const authAPI = {
  async updateProfile(updates: {
    first_name?: string
    last_name?: string
    middle_name?: string
    mobile?: string
  }): Promise<{ user: any }> {
    const res = await api.put<{ user: any }>('/auth/update', updates)
    return res.data
  },
  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/reset-password-request', { email })
  },
  async register(input: {
    firstName: string
    lastName: string
    mobile: string
    personalEmail: string
    password: string
    referralCode?: string
  }): Promise<{ requiresVerification?: boolean; email?: string; personal_email?: string }> {
    const res = await api.post('/auth/register', {
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      personalEmail: input.personalEmail,
      password: input.password,
      userType: 'client',
      role: 'client',
      referralCode: input.referralCode,
    })
    return res.data
  },
  async verifyOtp(personalEmail: string, otp: string): Promise<{
    session: { access_token: string; refresh_token: string }
    user: any
  }> {
    const res = await api.post('/auth/verify-otp', { personal_email: personalEmail, otp })
    return res.data
  },
  async resendVerification(email: string): Promise<void> {
    await api.post('/auth/resend-verification', { email })
  },
  async verifyResetOtp(personalEmail: string, otp: string): Promise<{ reset_token: string }> {
    const res = await api.post('/auth/verify-reset-otp', { personal_email: personalEmail, otp })
    return res.data
  },
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword })
  },
}

// ---------------------------------------------------------------------------
// Applications & payments helpers
// ---------------------------------------------------------------------------

export interface ApplicationPayment {
  id: string
  application_id: string
  amount?: number | string | null
  currency?: string | null
  status?: string | null
  description?: string | null
  paid_at?: string | null
  created_at?: string | null
}

export interface TimelineStepRow {
  id: string
  application_id: string
  title?: string
  name?: string
  description?: string
  status?: string
  step_status?: string
  is_completed?: boolean
  completed_at?: string | null
  due_date?: string | null
  created_at?: string
  step_order?: number
  ordinal?: number
}
