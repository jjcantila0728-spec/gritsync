import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

async function getResendApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) {
    return process.env.RESEND_API_KEY
  }
  try {
    const result = await query(
      `SELECT value FROM settings WHERE key = 'resendApiKey' LIMIT 1`
    )
    return result.rows[0]?.value || null
  } catch {
    return null
  }
}

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

export default router
