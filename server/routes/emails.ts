import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { query } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { escapeHtml, getResendApiKey } from '../utils/email'

const esc = (v: unknown): string => (v == null ? '' : escapeHtml(String(v)))

const router = Router()

// ─── Resend webhook ────────────────────────────────────────────────────────
// Resend delivers webhooks via Svix. Each request carries:
//   svix-id         — unique id per webhook attempt
//   svix-timestamp  — unix seconds when Svix signed the payload
//   svix-signature  — space-separated list of "v1,<base64-hmac-sha256>"
// Signed content is `${svix-id}.${svix-timestamp}.${raw-body}` HMAC'd with
// the webhook signing secret (set in the Resend dashboard, copy into the
// RESEND_WEBHOOK_SECRET env var — value starts with "whsec_").
//
// Event types we react to: email.sent, email.delivered, email.bounced,
// email.complained, email.delivery_delayed, email.opened, email.clicked,
// email.failed. Each updates the matching email_logs row (matched by
// provider_message_id) and appends to email_analytics.
//
// Path: POST /api/emails/webhook (the public URL is
//   https://app.gritsync.com/api/emails/webhook — paste that into the
//   Resend webhook config).
// ---------------------------------------------------------------------------
function verifyResendSignature(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // No secret configured — refuse, but log loudly so the operator notices.
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting request')
    return false
  }
  const svixId = req.header('svix-id')
  const svixTimestamp = req.header('svix-timestamp')
  const svixSignature = req.header('svix-signature')
  const rawBody = (req as any).rawBody as Buffer | undefined
  if (!svixId || !svixTimestamp || !svixSignature || !rawBody) return false

  // Replay guard: svix-timestamp (unix seconds) is covered by the HMAC, so a
  // captured webhook can't be replayed after this window with a valid signature.
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    console.warn('[resend-webhook] stale svix-timestamp — rejecting (possible replay)')
    return false
  }

  // The Resend dashboard displays the secret as `whsec_<base64>`. Strip the
  // prefix and decode — the bytes are what we HMAC with.
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  // svix-signature is "v1,abc... v2,xyz..." — try each.
  for (const part of String(svixSignature).split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    // timingSafeEqual requires equal-length buffers; bail safely on mismatch.
    const a = Buffer.from(value)
    const b = Buffer.from(expected)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true
  }
  return false
}

// Maps Resend event types → (logs status, analytics event_type, optional
// timestamp column to set on email_logs).
const RESEND_EVENT_MAP: Record<string, { status?: string; analytics: string; tsCol?: 'delivered_at' | 'failed_at' }> = {
  'email.sent':              { status: 'sent',       analytics: 'sent' },
  'email.delivered':         { status: 'delivered',  analytics: 'delivered', tsCol: 'delivered_at' },
  'email.delivery_delayed':  { status: 'delayed',    analytics: 'delayed' },
  'email.bounced':           { status: 'bounced',    analytics: 'bounced',   tsCol: 'failed_at' },
  'email.complained':        { status: 'complained', analytics: 'complained' },
  'email.failed':            { status: 'failed',     analytics: 'failed',    tsCol: 'failed_at' },
  'email.opened':            { analytics: 'opened' },
  'email.clicked':           { analytics: 'clicked' },
}

router.post('/webhook', async (req: Request, res: Response) => {
  // Resend retries on non-2xx. Always ack 200 once we've actually processed
  // (or deliberately ignored) the event; only return 4xx for genuine
  // protocol failures (bad signature, malformed payload).
  if (!verifyResendSignature(req)) {
    return res.status(401).json({ error: 'invalid signature' })
  }

  const event = req.body as { type?: string; created_at?: string; data?: any }
  const type = event?.type
  const data = event?.data || {}
  const emailId: string | undefined = data?.email_id || data?.id
  if (!type) return res.status(400).json({ error: 'missing event type' })

  const mapped = RESEND_EVENT_MAP[type]
  if (!mapped) {
    // Unknown event — ack so Resend stops retrying, but log so we can add
    // a handler later if it turns out to be useful.
    console.log('[resend-webhook] unhandled event type', type)
    return res.json({ ok: true, ignored: true })
  }

  try {
    let emailLogId: number | null = null
    if (emailId) {
      const row = await query(
        `SELECT id FROM email_logs WHERE provider_message_id = $1 LIMIT 1`,
        [emailId]
      ).catch(() => ({ rows: [] as any[] }))
      emailLogId = row.rows[0]?.id ?? null

      // Update the matching email_logs row. Only touch the timestamp the
      // event actually represents — don't clobber a prior delivered_at
      // with a later opened event.
      if (emailLogId) {
        const sets: string[] = [`updated_at = NOW()`]
        const params: any[] = []
        let i = 1
        if (mapped.status) {
          sets.push(`status = $${i++}`)
          params.push(mapped.status)
        }
        if (mapped.tsCol) {
          sets.push(`${mapped.tsCol} = NOW()`)
        }
        if (type === 'email.failed' || type === 'email.bounced') {
          // Resend's payload has a `reason` (bounced) or `error` (failed)
          // field with the diagnostic. Stash it on the row so the
          // operator UI can show why it didn't land.
          const errMsg = data?.bounce?.message || data?.failed?.reason || data?.reason || null
          if (errMsg) {
            sets.push(`error_message = $${i++}`)
            params.push(String(errMsg))
          }
        }
        params.push(emailLogId)
        await query(
          `UPDATE email_logs SET ${sets.join(', ')} WHERE id = $${i}`,
          params
        ).catch((err: any) => console.warn('[resend-webhook] email_logs update failed', err?.message))
      }
    }

    // Always record the event in analytics, even if we couldn't match an
    // email_logs row (e.g. email sent outside of our app). svix-id dedupes
    // Resend redeliveries of the same event (late ack, resubscribe) so
    // analytics counts don't inflate.
    await query(
      `INSERT INTO email_analytics (email_id, event_type, occurred_at, svix_id)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4)
       ON CONFLICT (svix_id) WHERE svix_id IS NOT NULL DO NOTHING`,
      [emailLogId, mapped.analytics, event?.created_at || null, req.header('svix-id') || null]
    ).catch((err: any) => console.warn('[resend-webhook] email_analytics insert failed', err?.message))

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[resend-webhook] handler error:', err)
    // Return 200 anyway — we've at least seen the event. 5xx would make
    // Resend retry and probably duplicate analytics rows.
    res.json({ ok: true, warning: err.message })
  }
})

router.post('/inbox/list', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      return res.status(503).json({ error: 'Email service not configured. Contact admin to set up Resend API key.' })
    }

    const { limit, after, before } = req.body

    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    if (after) params.set('after', after)
    if (before) params.set('before', before)

    // Use the inbound receiving endpoint, not the sent emails endpoint
    const url = `https://api.resend.com/emails/receiving?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend receiving list error:', data)
      return res.status(response.status).json({ error: (data as any)?.message || 'Failed to fetch received emails from Resend' })
    }

    res.json(data)
  } catch (error: any) {
    console.error('Resend inbox list error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

router.post('/inbox/get', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      return res.status(503).json({ error: 'Email service not configured.' })
    }

    const { emailId } = req.body
    if (!emailId) {
      return res.status(400).json({ error: 'emailId is required' })
    }

    // Use the receiving endpoint for inbound emails
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: (data as any)?.message || 'Failed to fetch received email' })
    }

    res.json(data)
  } catch (error: any) {
    console.error('Resend inbox get error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

router.post('/send', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      return res.status(503).json({ error: 'Email service not configured. Contact admin to set up Resend API key.' })
    }

    const { to, subject, html, text, from, replyTo, cc, bcc, attachments } = req.body

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
    }

    const payload: Record<string, any> = {
      to,
      subject,
      html,
      from: from || 'GritSync <noreply@gritsync.com>',
    }
    if (text) payload.text = text
    if (replyTo) payload.reply_to = replyTo
    if (cc) payload.cc = cc
    if (bcc) payload.bcc = bcc
    if (attachments && attachments.length > 0) payload.attachments = attachments

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend send error:', data)
      return res.status(response.status).json({ error: (data as any)?.message || 'Failed to send email via Resend' })
    }

    res.json({ success: true, id: (data as any)?.id })
  } catch (error: any) {
    console.error('Email send error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

router.post('/inbox/attachments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      return res.status(503).json({ error: 'Email service not configured.' })
    }

    const { emailId } = req.body
    if (!emailId) {
      return res.status(400).json({ error: 'emailId is required' })
    }

    // Use the receiving attachments endpoint for inbound email attachments
    const response = await fetch(`https://api.resend.com/emails/${emailId}/attachments/receiving`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: (data as any)?.message || 'Failed to fetch attachments' })
    }

    res.json(data)
  } catch (error: any) {
    console.error('Resend inbox attachments error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * Public route — no auth required since quote generation is unauthenticated.
 * Sends a formatted quote confirmation email to the client.
 */
router.post('/send-quote', async (req, res) => {
  try {
    const apiKey = await getResendApiKey()
    if (!apiKey) {
      return res.status(503).json({ error: 'Email service not configured.' })
    }

    const {
      quoteNumber,
      quoteId,
      clientName,
      email,
      mobileNumber,
      service,
      state,
      paymentType,
      lineItems,
      subtotal,
      tax,
      total,
      validUntil,
      quoteUrl,
    } = req.body

    if (!email || !quoteNumber) {
      return res.status(400).json({ error: 'email and quoteNumber are required' })
    }

    const formatCurrency = (n: number) =>
      `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const TAX_RATE = 0.12
    const isStaggered = paymentType === 'staggered'

    const renderItemRow = (item: any) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">${esc(item.description)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#374151;font-size:14px;">${esc(item.quantity || 1)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:14px;">${formatCurrency(item.unitPrice || item.amount || 0)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:14px;">${item.taxable ? '<span style="font-size:11px;color:#6b7280;">VAT</span>' : ''}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-size:14px;">${formatCurrency(item.total || item.amount || 0)}</td>
        </tr>`.trim()

    const itemTotalWithTax = (item: any) => {
      const base = Number(item.total || item.amount || 0)
      return base + (item.taxable ? base * TAX_RATE : 0)
    }

    const step1Items = isStaggered && Array.isArray(lineItems)
      ? lineItems.filter((i: any) => !i.payLater)
      : []
    const step2Items = isStaggered && Array.isArray(lineItems)
      ? lineItems.filter((i: any) => i.payLater)
      : []

    const step1Total = step1Items.reduce((s, i) => s + itemTotalWithTax(i), 0)
    const step2Total = step2Items.reduce((s, i) => s + itemTotalWithTax(i), 0)
    const grandTotal = step1Total + step2Total

    const sectionHeaderRow = (label: string, accent: string) => `
        <tr>
          <td colspan="5" style="padding:10px 12px;background:${accent};font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.6px;">
            ${label}
          </td>
        </tr>`.trim()

    let lineItemsHtml: string
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      lineItemsHtml = '<tr><td colspan="5" style="padding:12px;text-align:center;color:#6b7280;font-size:13px;">No line items</td></tr>'
    } else if (isStaggered) {
      const step1Block = step1Items.length > 0
        ? sectionHeaderRow('Step 1 — Pay Now to Initiate', '#dc2626') + step1Items.map(renderItemRow).join('')
        : ''
      const step2Block = step2Items.length > 0
        ? sectionHeaderRow('Step 2 — Pay Later (After Step 1 Completion)', '#6b7280') + step2Items.map(renderItemRow).join('')
        : ''
      lineItemsHtml = step1Block + step2Block
    } else {
      lineItemsHtml = lineItems.map(renderItemRow).join('')
    }

    const validUntilFormatted = validUntil
      ? new Date(validUntil).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your GritSync Quotation — ${esc(quoteNumber)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#b91c1c 0%,#dc2626 100%);padding:32px 40px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                <span style="color:#fca5a5;">GRIT</span>SYNC
              </div>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">NCLEX Application Processing</p>
            </td>
          </tr>

          <!-- Quote badge -->
          <tr>
            <td style="background:#fef2f2;padding:20px 40px;border-bottom:2px solid #fecaca;text-align:center;">
              <p style="margin:0;font-size:13px;color:#b91c1c;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Official Quotation</p>
              <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${esc(quoteNumber)}</p>
              ${validUntilFormatted ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Valid until <strong style="color:#374151;">${validUntilFormatted}</strong></p>` : ''}
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0;font-size:16px;color:#111827;">Hello <strong>${esc(clientName)}</strong>,</p>
              <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Thank you for your interest in GritSync. Here is your personalized quotation for NCLEX application processing services. Please review the details below.
              </p>
              ${isStaggered && step1Total > 0 ? `
              <p style="margin:14px 0 0;font-size:14px;color:#b91c1c;line-height:1.6;font-weight:600;">
                To initiate the process, you only need to pay the Step 1 fee amounting to <strong>${formatCurrency(step1Total)}</strong>.
              </p>` : ''}
            </td>
          </tr>

          <!-- Service details -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;width:40%;">
                    <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Service</span>
                  </td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:14px;color:#111827;font-weight:600;">${service ? esc(service) : '—'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">State</span>
                  </td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:14px;color:#111827;">${state ? esc(state) : '—'}</span>
                  </td>
                </tr>
                ${paymentType ? `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Payment Type</span>
                  </td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:14px;color:#111827;">${esc(paymentType)}</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 16px;">
                    <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Client</span>
                  </td>
                  <td style="padding:12px 16px;">
                    <span style="font-size:14px;color:#111827;">${esc(clientName)}</span>
                    ${mobileNumber ? `<span style="font-size:13px;color:#6b7280;display:block;">${esc(mobileNumber)}</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line items -->
          <tr>
            <td style="padding:0 40px 8px;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Fee Breakdown</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                    <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Unit Price</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Tax</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:8px 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${isStaggered ? `
                <tr>
                  <td style="padding:6px 0;text-align:right;font-size:13px;color:#6b7280;">Step 1 (Pay Now)</td>
                  <td style="padding:6px 0 6px 24px;text-align:right;font-size:14px;font-weight:700;color:#dc2626;min-width:120px;">${formatCurrency(step1Total)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;text-align:right;font-size:13px;color:#6b7280;">Step 2 (Pay Later)</td>
                  <td style="padding:6px 0 6px 24px;text-align:right;font-size:14px;font-weight:600;color:#374151;">${formatCurrency(step2Total)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0 0;text-align:right;border-top:2px solid #e5e7eb;font-size:15px;font-weight:700;color:#111827;">Total Amount</td>
                  <td style="padding:10px 0 0 24px;text-align:right;border-top:2px solid #e5e7eb;font-size:16px;font-weight:800;color:#111827;">${formatCurrency(grandTotal)}</td>
                </tr>` : `
                <tr>
                  <td style="padding:6px 0;text-align:right;font-size:13px;color:#6b7280;">Subtotal</td>
                  <td style="padding:6px 0 6px 24px;text-align:right;font-size:13px;color:#374151;min-width:120px;">${formatCurrency(subtotal || 0)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;text-align:right;font-size:13px;color:#6b7280;">VAT (12%)</td>
                  <td style="padding:6px 0 6px 24px;text-align:right;font-size:13px;color:#374151;">${formatCurrency(tax || 0)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0 0;text-align:right;border-top:2px solid #e5e7eb;font-size:16px;font-weight:700;color:#111827;">Total</td>
                  <td style="padding:10px 0 0 24px;text-align:right;border-top:2px solid #e5e7eb;font-size:18px;font-weight:800;color:#dc2626;">${formatCurrency(total || 0)}</td>
                </tr>`}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 32px;text-align:center;">
              <a href="${esc(quoteUrl)}" style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                View Full Quotation →
              </a>
              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">Or copy this link: <a href="${esc(quoteUrl)}" style="color:#dc2626;text-decoration:none;">${esc(quoteUrl)}</a></p>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;">
                <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                  <strong>Note:</strong> This quotation is valid for 30 days from the date of issuance. Prices are subject to change after the validity period. To proceed with your NCLEX application, please <a href="${esc(quoteUrl)}" style="color:#b45309;font-weight:600;">view your quote</a> and click <em>Apply Now</em>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#374151;font-weight:600;">GritSync — NCLEX Application Processing</p>
              <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Questions? Reply to this email or contact us through the app.</p>
              <p style="margin:10px 0 0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} GritSync. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GritSync Quotations <noreply@gritsync.com>',
        to: email,
        subject: `Your GritSync Quotation — ${quoteNumber}`,
        html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Quote email send error:', data)
      return res.status(response.status).json({ error: (data as any)?.message || 'Failed to send quote email' })
    }

    res.json({ success: true, id: (data as any)?.id })
  } catch (error: any) {
    console.error('Send-quote error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// GET /api/emails/my-received — returns GritSync system emails sent to the authenticated user
// These are transactional emails stored in email_logs (verification, welcome, password reset, etc.)
router.get('/my-received', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { limit = 50, offset = 0 } = req.query

    const result = await query(
      `SELECT id, subject, body_html, body_text, sender_email, sender_name,
              recipient_email, recipient_name, status, email_type, email_category,
              created_at, sent_at, delivered_at
       FROM email_logs
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), Number(offset)]
    )

    res.json({ data: result.rows, total: result.rowCount })
  } catch (error: any) {
    console.error('my-received error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
