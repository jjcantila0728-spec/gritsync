import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

async function getResendApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY
  try {
    const r = await query(`SELECT value FROM settings WHERE key = 'resendApiKey' LIMIT 1`)
    return r.rows[0]?.value || null
  } catch { return null }
}

async function getAdminEmail(): Promise<string> {
  try {
    const r = await query(`SELECT value FROM settings WHERE key = 'siteEmail' LIMIT 1`)
    return r.rows[0]?.value || 'admin@gritsync.com'
  } catch { return 'admin@gritsync.com' }
}

// POST /api/contact — public endpoint, no auth required
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    const apiKey = await getResendApiKey()
    if (!apiKey) {
      return res.status(500).json({ error: 'Email service not configured' })
    }

    const adminEmail = await getAdminEmail()

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">New Contact Form Message</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Received via GritSync website</p>
        </div>
        <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;width:100px;">
                <strong style="color:#374151;font-size:13px;">Name</strong>
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">
                ${name}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
                <strong style="color:#374151;font-size:13px;">Email</strong>
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;">
                <a href="mailto:${email}" style="color:#dc2626;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;">
                <strong style="color:#374151;font-size:13px;">Subject</strong>
              </td>
              <td style="padding:10px 0;color:#111827;font-size:14px;">${subject}</td>
            </tr>
          </table>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
            <p style="font-size:13px;font-weight:600;color:#374151;margin:0 0 10px;">Message:</p>
            <p style="font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.7;margin:0;">${message}</p>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;">
            Reply directly to <a href="mailto:${email}" style="color:#dc2626;">${email}</a> to respond to this inquiry.
          </p>
        </div>
      </div>
    `

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GritSync Contact <no-reply@gritsync.com>',
        to: [adminEmail],
        reply_to: email,
        subject: `Contact Form: ${subject}`,
        html,
        text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
      }),
    })

    if (!sendRes.ok) {
      const err = await sendRes.text()
      console.error('Resend error:', err)
      return res.status(500).json({ error: 'Failed to send email' })
    }

    res.json({ success: true, message: 'Your message has been sent successfully.' })
  } catch (err: any) {
    console.error('Contact form error:', err)
    res.status(500).json({ error: 'An error occurred. Please try again.' })
  }
})

export default router
