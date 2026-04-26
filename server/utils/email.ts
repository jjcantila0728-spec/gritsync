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

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      console.warn('Email not sent (no Resend API key):', subject, '->', to)
      return
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'GritSync <noreply@gritsync.com>', to, subject, html }),
    })
    if (!res.ok) {
      const data: unknown = await res.json().catch(() => null)
      const message = data !== null && typeof data === 'object' && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : String(res.status)
      console.warn('Email send failed:', message)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('Email send error (non-fatal):', message)
  }
}
