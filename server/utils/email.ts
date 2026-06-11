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

type DeliverResult = { ok: boolean; error?: string; transient?: boolean }

/** Raw Resend delivery. `transient` marks failures worth retrying (network,
 *  429, 5xx) — 4xx rejections are permanent and retrying won't help. */
async function deliverViaResend(
  to: string | string[],
  subject: string,
  html: string,
  opts: SendEmailOptions = {},
): Promise<DeliverResult> {
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
      return { ok: false, error: message, transient: res.status === 429 || res.status >= 500 }
    }
    console.log('[email] Resend accepted:', { id: data?.id, from: payload.from, to: payload.to, subject })
    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('Email send error (non-fatal):', message)
    return { ok: false, error: message, transient: true }
  }
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  opts: SendEmailOptions = {},
): Promise<{ ok: boolean; error?: string; queued?: boolean }> {
  const result = await deliverViaResend(to, subject, html, opts)
  if (result.ok || !result.transient) return result
  // Transient failure (Resend outage, network blip): park it in email_queue
  // and let the cron drain retry with backoff. Attachments aren't queued —
  // the table has no column for them and callers pass short-lived buffers.
  if (opts.attachments && opts.attachments.length > 0) return result
  const queued = await query(
    `INSERT INTO email_queue (to_address, from_address, subject, html_body, text_body, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '2 minutes')`,
    [
      Array.isArray(to) ? to.join(',') : to,
      opts.from || null,
      subject,
      html,
      opts.text || null,
    ],
  ).then(() => true).catch((e) => {
    console.error('[email] enqueue failed', e)
    return false
  })
  return { ...result, queued }
}

/**
 * Retry queued emails. Called from the cron tick. Exponential backoff via
 * scheduled_at; gives up (status='failed') after 5 attempts.
 */
export async function drainEmailQueue(limit = 20): Promise<void> {
  let rows: Array<{
    id: number
    to_address: string
    from_address: string | null
    subject: string | null
    html_body: string | null
    text_body: string | null
    retry_count: number
  }>
  try {
    rows = (await query(
      `UPDATE email_queue SET status = 'processing'
        WHERE id IN (
          SELECT id FROM email_queue
           WHERE status = 'pending'
             AND (scheduled_at IS NULL OR scheduled_at <= NOW())
           ORDER BY created_at ASC LIMIT $1)
        RETURNING id, to_address, from_address, subject, html_body, text_body, retry_count`,
      [limit],
    )).rows
  } catch (err: any) {
    if (err?.code !== '42P01') console.error('[email] drainEmailQueue failed', err)
    return
  }
  for (const row of rows) {
    const to = row.to_address.includes(',') ? row.to_address.split(',') : row.to_address
    const result = await deliverViaResend(to, row.subject || '', row.html_body || '', {
      from: row.from_address || undefined,
      text: row.text_body || undefined,
    })
    if (result.ok) {
      await query(
        `UPDATE email_queue SET status = 'sent', sent_at = NOW(), processed_at = NOW() WHERE id = $1`,
        [row.id],
      ).catch(() => {})
    } else if (!result.transient || row.retry_count >= 4) {
      await query(
        `UPDATE email_queue SET status = 'failed', failed_at = NOW(), error_message = $2 WHERE id = $1`,
        [row.id, result.error || 'unknown'],
      ).catch(() => {})
    } else {
      // 2m, 4m, 8m, 16m backoff before the next attempt.
      await query(
        `UPDATE email_queue
            SET status = 'pending', retry_count = retry_count + 1, error_message = $2,
                scheduled_at = NOW() + (POWER(2, retry_count + 1) || ' minutes')::INTERVAL
          WHERE id = $1`,
        [row.id, result.error || 'unknown'],
      ).catch(() => {})
    }
  }
}
