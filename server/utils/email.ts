import { query } from '../db'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function getResendApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY
  try {
    const result = await query(`SELECT value FROM settings WHERE key = 'resendApiKey' LIMIT 1`)
    return result.rows[0]?.value || null
  } catch {
    return null
  }
}

type SendEmailOptions = {
  from?: string
  replyTo?: string
  text?: string
  attachments?: Array<{ filename: string; content: string }>
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  opts: SendEmailOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      console.warn('Email not sent (no Resend API key):', subject, '->', to)
      return { ok: false, error: 'no-api-key' }
    }
    const payload: Record<string, any> = {
      from: opts.from || 'GritSync <noreply@gritsync.com>',
      to,
      subject,
      html,
    }
    if (opts.replyTo) payload.reply_to = opts.replyTo
    if (opts.text) payload.text = opts.text
    if (opts.attachments && opts.attachments.length > 0) {
      payload.attachments = opts.attachments
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data: any = await res.json().catch(() => null)
    if (!res.ok) {
      const message = data?.message ? String(data.message) : String(res.status)
      console.error('[email] Resend rejected:', {
        status: res.status,
        from: payload.from,
        to: payload.to,
        subject,
        resendError: data,
      })
      return { ok: false, error: message }
    }
    console.log('[email] Resend accepted:', { id: data?.id, from: payload.from, to: payload.to, subject })
    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('Email send error (non-fatal):', message)
    return { ok: false, error: message }
  }
}
