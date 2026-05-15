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

/**
 * Brand wrapper for every outbound email. Adds the official GritSync logo
 * header on top and a consistent footer underneath whatever body HTML
 * each route already produces.
 *
 * Logo is served from the static frontend at /gritsync_logo.png.
 * Hosting it on the same domain (https://app.gritsync.com/gritsync_logo.png)
 * means email clients that block third-party images by default will still
 * usually fetch it once the user trusts the sender.
 */
const LOGO_URL = `${process.env.APP_URL || 'https://app.gritsync.com'}/gritsync_logo.png`
const CURRENT_YEAR = new Date().getUTCFullYear()

export function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GritSync</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td align="center" style="padding:28px 32px 16px;background:#ffffff;">
              <a href="${process.env.APP_URL || 'https://gritsync.com'}" style="display:inline-block;text-decoration:none;">
                <img src="${LOGO_URL}" alt="GritSync" width="160" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:160px;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 8px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.6;">
              <p style="margin:0 0 8px;">
                <strong style="color:#374151;">GritSync</strong> &middot; NCLEX Application Processing for Filipino Nurses
              </p>
              <p style="margin:0 0 8px;">
                <a href="${process.env.APP_URL || 'https://gritsync.com'}" style="color:#dc2626;text-decoration:none;">gritsync.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@gritsync.com" style="color:#dc2626;text-decoration:none;">support@gritsync.com</a>
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;">
                &copy; ${CURRENT_YEAR} GritSync. This is an automated message — please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type SendEmailOptions = {
  from?: string
  replyTo?: string
  text?: string
  attachments?: Array<{ filename: string; content: string }>
  /** Set true to skip the brand wrapper (e.g. when the body is already a full HTML doc). */
  raw?: boolean
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
      html: opts.raw ? html : wrapEmailHtml(html),
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
