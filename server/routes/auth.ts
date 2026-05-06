import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query } from '../db'
import { authenticateToken, signToken, signRefreshToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

function generateGritId(): string {
  const num = Math.floor(100000 + Math.random() * 900000)
  return `GRIT${num}`
}

async function getResendApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY
  try {
    const r = await query(`SELECT value FROM settings WHERE key = 'resendApiKey' LIMIT 1`)
    return r.rows[0]?.value || null
  } catch { return null }
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sendVerificationEmail(personalEmail: string, firstName: string, token: string, otp?: string) {
  const apiKey = await getResendApiKey()
  if (!apiKey) return
  const verifyUrl = `${process.env.APP_URL || 'https://gritsync.com'}/verify-email?token=${token}`
  const otpSection = otp ? `
        <div style="text-align:center;margin:28px 0;">
          <p style="font-size:14px;color:#6b7280;margin:0 0 10px;">Or enter this verification code on the website:</p>
          <div style="display:inline-block;background:#f3f4f6;border:2px dashed #dc2626;border-radius:12px;padding:18px 36px;">
            <span style="font-size:36px;font-weight:800;color:#dc2626;letter-spacing:10px;font-family:monospace;">${otp}</span>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:10px 0 0;">This code expires in <strong>15 minutes</strong></p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  ` : ''
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:40px 32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;font-weight:700;">Verify Your Email</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;">GritSync Account Verification</p>
      </div>
      <div style="padding:40px 32px;">
        <p style="font-size:16px;color:#374151;">Hi <strong>${firstName}</strong>,</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;">
          Thank you for registering with GritSync! Please verify your email address to complete your account setup.
        </p>
        <div style="text-align:center;margin:32px 0 16px;">
          <a href="${verifyUrl}" style="background:#dc2626;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">
            Verify My Email
          </a>
          <p style="font-size:12px;color:#9ca3af;margin:10px 0 0;">This button expires in <strong>24 hours</strong></p>
        </div>
        ${otpSection}
        <p style="font-size:13px;color:#6b7280;line-height:1.5;">
          If you didn't create a GritSync account, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:12px;color:#9ca3af;text-align:center;">
          Having trouble clicking the button? Copy and paste this link into your browser:<br />
          <span style="color:#dc2626;word-break:break-all;">${verifyUrl}</span>
        </p>
      </div>
    </div>
  `
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GritSync <no-reply@gritsync.com>',
        to: [personalEmail],
        subject: 'Verify your GritSync account email',
        html,
      }),
    })
  } catch (e) {
    console.error('Failed to send verification email:', e)
  }
}

async function sendWelcomeEmail(personalEmail: string, firstName: string, lastName: string, gritId: string, gritsyncEmail: string) {
  const apiKey = await getResendApiKey()
  if (!apiKey) return
  const appUrl = process.env.APP_URL || 'https://gritsync.com'
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#10b981,#059669);padding:40px 32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;font-weight:700;">Welcome to GritSync! 🎉</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;">Your NCLEX Journey Starts Here</p>
      </div>
      <div style="padding:40px 32px;">
        <p style="font-size:16px;color:#374151;">Hi <strong>${firstName}</strong>,</p>
        <p style="font-size:15px;color:#374151;line-height:1.7;">I'm JJ Cantila — founder of GritSync and a Filipino nurse who has walked this exact path before you. I'm personally reaching out to welcome you and make sure you start your NCLEX journey on the right foot.</p>
        <p style="font-size:15px;color:#374151;line-height:1.7;">Your email has been verified and your GritSync account is now fully active. We're honored to be part of one of the most important milestones of your nursing career.</p>

        <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <h3 style="margin:0 0 12px;color:#10b981;font-size:16px;">Your Account Details</h3>
          <p style="margin:4px 0;color:#374151;"><strong>GRIT ID:</strong> <span style="font-family:monospace;font-size:16px;font-weight:700;color:#10b981;">${gritId}</span></p>
          <p style="margin:4px 0;color:#374151;"><strong>GritSync Email:</strong> ${gritsyncEmail}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Please save these details — you'll need them throughout your application process.</p>
        </div>

        <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <h3 style="margin:0 0 10px;color:#92400e;font-size:16px;">⚠️ Important: Complete These Steps Right Away</h3>
          <p style="margin:0;color:#78350f;font-size:15px;">To begin processing your application, we need two things from you <strong>as soon as possible</strong>. These are required before we can move forward with any processing.</p>
        </div>

        <h2 style="color:#1f2937;margin:32px 0 16px;font-size:20px;">Your Next Steps</h2>

        <div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid #10b981;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <div style="display:flex;align-items:flex-start;gap:16px;">
            <div style="flex-shrink:0;width:40px;height:40px;background:#10b981;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;line-height:40px;text-align:center;min-width:40px;">1</div>
            <div style="flex:1;">
              <h3 style="margin:0 0 8px;color:#1f2937;font-size:16px;">Complete Your Personal Details</h3>
              <p style="margin:0 0 12px;color:#374151;line-height:1.6;font-size:14px;">Fill in all your personal information, educational background, and contact details. This information is used directly in your NCLEX application — accuracy is critical.</p>
              <a href="${appUrl}/my-details" style="display:inline-block;background:#10b981;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Complete My Details →</a>
            </div>
          </div>
        </div>

        <div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid #3b82f6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <div style="display:flex;align-items:flex-start;gap:16px;">
            <div style="flex-shrink:0;width:40px;height:40px;background:#3b82f6;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;line-height:40px;text-align:center;min-width:40px;">2</div>
            <div style="flex:1;">
              <h3 style="margin:0 0 8px;color:#1f2937;font-size:16px;">Upload Your Required Documents</h3>
              <p style="margin:0 0 8px;color:#374151;line-height:1.6;font-size:14px;">We need three documents to get started:</p>
              <ul style="margin:0 0 12px;padding-left:20px;color:#374151;line-height:1.8;font-size:14px;">
                <li><strong>2x2 ID Photo</strong> — recent, white background</li>
                <li><strong>Nursing Diploma / Transcript of Records</strong></li>
                <li><strong>Valid Passport</strong> (data page)</li>
              </ul>
              <a href="${appUrl}/documents" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Upload Documents →</a>
            </div>
          </div>
        </div>

        <p style="color:#374151;line-height:1.7;font-size:15px;">Once you've completed both steps above, our team will review your submission and reach out with the next steps. The sooner you complete these, the sooner we can begin processing your application.</p>

        <div style="text-align:center;margin:32px 0;">
          <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">Go to My Dashboard</a>
        </div>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />

        <div style="background:#f8fafc;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <h3 style="margin:0 0 10px;color:#1f2937;font-size:15px;">About GritSync</h3>
          <p style="margin:0;color:#374151;line-height:1.7;font-size:14px;">GritSync was built by Filipino nurses, for Filipino nurses. We understand the unique challenges and sacrifices that come with pursuing your US nursing license, and we're committed to making the process as smooth and transparent as possible. You're not alone in this journey — we're with you every step of the way.</p>
        </div>

        <p style="color:#374151;font-size:15px;">With all the best for your NCLEX journey,</p>
        <p style="margin:4px 0 0;color:#374151;"><strong>JJ Cantila</strong><br>
        <span style="color:#6b7280;font-size:14px;">RM, RN, SGRN, CADRN, USRN<br>Founder &amp; CEO, GritSync</span></p>

        <p style="margin-top:20px;font-size:13px;color:#9ca3af;font-style:italic;">P.S. — If you have any questions or just want to talk through your concerns, you can reach us at <a href="mailto:admin@gritsync.com" style="color:#10b981;">admin@gritsync.com</a> or call us at +1 (509) 270-3437. We genuinely love hearing from our nurses.</p>
      </div>
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 32px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="font-size:12px;color:#9ca3af;margin:0;">GritSync | admin@gritsync.com | +1 (509) 270-3437</p>
        <p style="font-size:12px;color:#9ca3af;margin:4px 0 0;">Empowering Filipino Nurses on Their Path to the US</p>
      </div>
    </div>
  `
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'JJ Cantila at GritSync <no-reply@gritsync.com>',
        to: [personalEmail],
        subject: `[Important] Welcome to GritSync — Your First Steps, ${firstName}`,
        html,
      }),
    })
  } catch (e) {
    console.error('Failed to send welcome email:', e)
  }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { password, first_name, last_name, middle_name, mobile, personal_email, role = 'client' } = req.body

    if (!password || !first_name || !last_name || !mobile) {
      return res.status(400).json({ error: 'First name, last name, mobile number, and password are required' })
    }

    if (!personal_email) {
      return res.status(400).json({ error: 'Personal email address is required' })
    }

    // Validate personal email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(personal_email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid personal email address' })
    }

    // Disallow @gritsync.com as personal email
    if (personal_email.trim().toLowerCase().endsWith('@gritsync.com')) {
      return res.status(400).json({ error: 'Please use your personal email address (e.g. Gmail, Yahoo), not a GritSync email' })
    }

    // Check for duplicate personal email
    const existingEmail = await query('SELECT id FROM users WHERE personal_email = $1', [personal_email.trim().toLowerCase()])
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'This email address is already registered' })
    }

    // Check for duplicate mobile number
    const existingMobile = await query('SELECT id FROM users WHERE mobile = $1', [mobile.trim()])
    if (existingMobile.rows.length > 0) {
      return res.status(400).json({ error: 'This mobile number is already registered' })
    }

    // Generate GRIT ID
    const grit_id = generateGritId()

    // Auto-generate business email as firstname.lastname@gritsync.com
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const baseEmail = `${normalize(first_name)}.${normalize(last_name)}@gritsync.com`

    // Handle conflicts: append a number if the base gritsync email is taken
    let gritsync_email = baseEmail
    let suffix = 1
    while (true) {
      const conflict = await query('SELECT id FROM users WHERE gritsync_email = $1', [gritsync_email])
      if (conflict.rows.length === 0) break
      gritsync_email = `${normalize(first_name)}.${normalize(last_name)}${suffix}@gritsync.com`
      suffix++
      if (suffix > 99) {
        return res.status(500).json({ error: 'Unable to generate unique business email, please contact support' })
      }
    }

    const password_hash = await bcrypt.hash(password, 12)
    const personal_email_normalized = personal_email.trim().toLowerCase()

    // Generate email verification token (valid 24 hours) + OTP (valid 15 minutes)
    const verification_token = crypto.randomBytes(32).toString('hex')
    const verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const otp = generateOTP()
    const otp_expires = new Date(Date.now() + 15 * 60 * 1000)

    const result = await query(
      `INSERT INTO users (email, gritsync_email, personal_email, password_hash, first_name, last_name, middle_name, mobile, role, grit_id, email_verified, email_verification_token, email_verification_expires_at, email_otp, email_otp_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, $13, $14)
       RETURNING id, email, gritsync_email, personal_email, role, first_name, last_name, grit_id, created_at`,
      [gritsync_email, gritsync_email, personal_email_normalized, password_hash, first_name.trim(), last_name.trim(), middle_name || null, mobile.trim(), role, grit_id, verification_token, verification_expires, otp, otp_expires]
    )

    const user = result.rows[0]

    // Send verification email asynchronously (don't await, don't block registration)
    sendVerificationEmail(personal_email_normalized, first_name.trim(), verification_token, otp)

    // Do NOT create a session — user must verify email first
    res.status(201).json({
      requiresVerification: true,
      message: 'Account created! Please check your email to verify your account.',
      personal_email: personal_email_normalized,
    })
  } catch (err: any) {
    console.error('Register error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    const result = await query(
      `SELECT id, email, gritsync_email, personal_email, role, first_name, last_name, grit_id, email_verified, email_verification_expires_at, welcome_email_sent_at
       FROM users WHERE email_verification_token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification link' })
    }

    const user = result.rows[0]

    if (user.email_verified) {
      // Already verified — just log them in
    } else if (new Date(user.email_verification_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This verification link has expired. Please register again.' })
    }

    // Mark email as verified, clear the token
    await query(
      `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    )

    // Cascade verification to any other account sharing the same email/personal_email
    // (handles duplicate accounts where one is the personal email and the other is the gritsync email)
    const sharedEmail = user.personal_email || user.email
    if (sharedEmail) {
      await query(
        `UPDATE users SET email_verified = true, updated_at = NOW()
         WHERE id != $1 AND (email = $2 OR personal_email = $2) AND email_verified = false`,
        [user.id, sharedEmail]
      ).catch(() => {}) // non-fatal
    }

    // Send welcome email if not already sent (fire-and-forget)
    if (!user.welcome_email_sent_at && user.personal_email) {
      query(
        `UPDATE users SET welcome_email_sent_at = NOW() WHERE id = $1`,
        [user.id]
      ).catch(() => {})
      sendWelcomeEmail(
        user.personal_email,
        user.first_name || '',
        user.last_name || '',
        user.grit_id || '',
        user.gritsync_email || ''
      )
    }

    const accessToken = signToken({ id: user.id, email: user.email, role: user.role, grit_id: user.grit_id })
    const refresh_token = signRefreshToken({ id: user.id })

    res.json({
      verified: true,
      message: 'Email verified successfully! Your account is now active.',
      user: {
        id: user.id,
        email: user.email,
        gritsync_email: user.gritsync_email,
        personal_email: user.personal_email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        grit_id: user.grit_id,
      },
      session: {
        access_token: accessToken,
        refresh_token,
        token_type: 'bearer',
        expires_in: 604800,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          gritsync_email: user.gritsync_email,
          personal_email: user.personal_email,
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
            grit_id: user.grit_id,
            gritsync_email: user.gritsync_email,
            personal_email: user.personal_email,
            role: user.role,
          },
          app_metadata: { role: user.role },
        },
      },
    })
  } catch (err: any) {
    console.error('Verify email error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email/mobile and password required' })
    }

    // Accept email address, mobile number, or GRIT ID as login identifier
    const identifier = email.trim()
    const isEmail = identifier.includes('@')
    const isGritId = /^GRIT[A-Z0-9]+$/i.test(identifier)

    let result
    if (isEmail) {
      // Check both gritsync email (email col) and personal email.
      // Prefer exact email match first (so admin accounts take priority over client accounts
      // that share the same personal email), then fall back by creation date.
      result = await query(
        `SELECT id, email, gritsync_email, personal_email, password_hash, role, first_name, last_name, middle_name, grit_id, avatar_path, email_verified, created_at
         FROM users
         WHERE email = $1 OR personal_email = $1
         ORDER BY (email = $1) DESC, created_at ASC
         LIMIT 1`,
        [identifier.toLowerCase()]
      )
    } else if (isGritId) {
      result = await query(
        'SELECT id, email, gritsync_email, personal_email, password_hash, role, first_name, last_name, middle_name, grit_id, avatar_path, email_verified, created_at FROM users WHERE LOWER(grit_id) = LOWER($1)',
        [identifier]
      )
    } else {
      // Treat as mobile number
      result = await query(
        'SELECT id, email, gritsync_email, personal_email, password_hash, role, first_name, last_name, middle_name, grit_id, avatar_path, email_verified, created_at FROM users WHERE mobile = $1',
        [identifier]
      )
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid login credentials' })
    }

    // Block login if account is deactivated
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact support.' })
    }

    // Block login if email not verified
    if (user.email_verified === false) {
      return res.status(403).json({
        error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        requiresVerification: true,
        personal_email: user.personal_email,
      })
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      grit_id: user.grit_id,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
    })
    const refresh_token = signRefreshToken({ id: user.id })

    // Store session
    await query(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING`,
      [user.id, token]
    ).catch(() => {}) // sessions table may not have this structure

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        grit_id: user.grit_id,
        created_at: user.created_at,
      },
      session: {
        access_token: token,
        refresh_token,
        token_type: 'bearer',
        expires_in: 604800,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
            grit_id: user.grit_id,
            role: user.role,
          },
          app_metadata: { role: user.role },
        },
      },
    })
  } catch (err: any) {
    console.error('Login error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, email, role, first_name, last_name, middle_name, grit_id, avatar_path, mobile, gritsync_email, created_at FROM users WHERE id = $1',
      [req.user!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = result.rows[0]
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      grit_id: user.grit_id,
      avatar_path: user.avatar_path,
      mobile: user.mobile,
      gritsync_email: user.gritsync_email,
      created_at: user.created_at,
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        grit_id: user.grit_id,
        role: user.role,
      },
      app_metadata: { role: user.role },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' })

    const jwt = await import('jsonwebtoken')
    const JWT_SECRET = process.env.JWT_SECRET || 'gritsync-jwt-secret-key-2024'
    const decoded = jwt.default.verify(refresh_token, JWT_SECRET) as any

    const result = await query(
      'SELECT id, email, role, first_name, last_name, grit_id FROM users WHERE id = $1',
      [decoded.id]
    )

    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' })

    const user = result.rows[0]
    const { signToken: sign } = await import('../middleware/auth')
    const token = sign({ id: user.id, email: user.email, role: user.role, grit_id: user.grit_id })

    res.json({
      session: {
        access_token: token,
        refresh_token,
        token_type: 'bearer',
        expires_in: 604800,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          user_metadata: { first_name: user.first_name, last_name: user.last_name, grit_id: user.grit_id, role: user.role },
          app_metadata: { role: user.role },
        },
      },
    })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' })
})

// PUT /api/auth/update
router.put('/update', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { first_name, last_name, middle_name, mobile, email, password, avatar_path } = req.body
    const userId = req.user!.id

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (first_name !== undefined) { updates.push(`first_name = $${idx++}`); values.push(first_name) }
    if (last_name !== undefined) { updates.push(`last_name = $${idx++}`); values.push(last_name) }
    if (middle_name !== undefined) { updates.push(`middle_name = $${idx++}`); values.push(middle_name) }
    if (mobile !== undefined) { updates.push(`mobile = $${idx++}`); values.push(mobile) }
    if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email.toLowerCase()) }
    if (avatar_path !== undefined) { updates.push(`avatar_path = $${idx++}`); values.push(avatar_path) }
    if (password !== undefined) {
      const hash = await bcrypt.hash(password, 12)
      updates.push(`password_hash = $${idx++}`)
      values.push(hash)
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })

    updates.push(`updated_at = NOW()`)
    values.push(userId)

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, role, first_name, last_name, middle_name, grit_id, avatar_path`,
      values
    )

    res.json({ user: result.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/admin-login-as — generate a token for a user (admin only)
router.post('/admin-login-as', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' })
    }

    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const result = await query('SELECT id, email, gritsync_email, role, first_name, last_name, grit_id, mobile FROM users WHERE id = $1', [userId])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const targetUser = result.rows[0]
    const token = signToken({ id: targetUser.id, email: targetUser.email, role: targetUser.role })
    const refreshToken = signRefreshToken({ id: targetUser.id, email: targetUser.email })

    res.json({
      access_token: token,
      refresh_token: refreshToken,
      user: targetUser,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

async function sendPasswordResetEmail(personalEmail: string, firstName: string, token: string, otp: string) {
  const apiKey = await getResendApiKey()
  if (!apiKey) return
  const resetUrl = `${process.env.APP_URL || 'https://gritsync.com'}/reset-password?token=${token}`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:40px 32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;font-weight:700;">Reset Your Password</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;">GritSync Account Recovery</p>
      </div>
      <div style="padding:40px 32px;">
        <p style="font-size:16px;color:#374151;">Hi <strong>${firstName || 'there'}</strong>,</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;">
          We received a request to reset the password for your GritSync account. Use the button below or enter the code to continue.
        </p>
        <div style="text-align:center;margin:32px 0 16px;">
          <a href="${resetUrl}" style="background:#dc2626;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">
            Reset My Password
          </a>
          <p style="font-size:12px;color:#9ca3af;margin:10px 0 0;">This button expires in <strong>1 hour</strong></p>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <p style="font-size:14px;color:#6b7280;margin:0 0 10px;">Or enter this code on the website:</p>
          <div style="display:inline-block;background:#f3f4f6;border:2px dashed #dc2626;border-radius:12px;padding:18px 36px;">
            <span style="font-size:36px;font-weight:800;color:#dc2626;letter-spacing:10px;font-family:monospace;">${otp}</span>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:10px 0 0;">This code expires in <strong>15 minutes</strong></p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;line-height:1.5;">
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:12px;color:#9ca3af;text-align:center;">
          Having trouble clicking the button? Copy and paste this link into your browser:<br />
          <span style="color:#dc2626;word-break:break-all;">${resetUrl}</span>
        </p>
      </div>
    </div>
  `
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GritSync <no-reply@gritsync.com>',
        to: [personalEmail],
        subject: 'Reset your GritSync password',
        html,
      }),
    })
  } catch (e) {
    console.error('Failed to send password reset email:', e)
  }
}

// POST /api/auth/reset-password-request
router.post('/reset-password-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const normalized = email.trim().toLowerCase()
    const result = await query(
      `SELECT id, first_name, personal_email FROM users
       WHERE personal_email = $1 OR gritsync_email = $1 OR email = $1`,
      [normalized]
    )

    if (result.rows.length === 0) {
      return res.json({ message: 'If that email is registered, a reset link will be sent.' })
    }

    const user = result.rows[0]
    const token = crypto.randomBytes(32).toString('hex')
    const otp = generateOTP()
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000)
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000)

    await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [user.id])
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, otp, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, token, tokenExpires, otp, otpExpires]
    )

    sendPasswordResetEmail(user.personal_email, user.first_name || '', token, otp)

    res.json({ message: 'If that email is registered, a reset link will be sent.' })
  } catch (err: any) {
    console.error('Reset password request error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/verify-reset-otp
router.post('/verify-reset-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ error: 'Email and code are required' })

    const normalized = email.trim().toLowerCase()
    const result = await query(
      `SELECT prt.token, prt.otp, prt.otp_expires_at, prt.used
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE (u.personal_email = $1 OR u.gritsync_email = $1 OR u.email = $1)
         AND prt.used = false
       ORDER BY prt.created_at DESC LIMIT 1`,
      [normalized]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active reset request found. Please request a new reset.' })
    }

    const row = result.rows[0]

    if (!row.otp || row.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid code. Please check your email and try again.' })
    }

    if (new Date(row.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new password reset.' })
    }

    res.json({ token: row.token, message: 'Code verified. You may now reset your password.' })
  } catch (err: any) {
    console.error('Verify reset OTP error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, new_password } = req.body
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password are required' })

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' })
    }

    const result = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used
       FROM password_reset_tokens prt
       WHERE prt.token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new password reset.' })
    }

    const row = result.rows[0]

    if (row.used) {
      return res.status(400).json({ error: 'This reset link has already been used. Please request a new one.' })
    }

    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new password reset.' })
    }

    const password_hash = await bcrypt.hash(new_password, 12)

    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [password_hash, row.user_id])
    await query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [row.id])

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' })
  } catch (err: any) {
    console.error('Reset password error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { personal_email, otp } = req.body
    if (!personal_email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required' })
    }

    const result = await query(
      `SELECT id, email, gritsync_email, personal_email, role, first_name, last_name, grit_id, email_verified, email_otp, email_otp_expires_at
       FROM users WHERE personal_email = $1`,
      [personal_email.trim().toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification code' })
    }

    const user = result.rows[0]

    if (user.email_verified) {
      // Already verified — just log them in
      const accessToken = signToken({ id: user.id, email: user.email, role: user.role, grit_id: user.grit_id })
      const refresh_token = signRefreshToken({ id: user.id })
      return res.json({
        verified: true,
        message: 'Email already verified. Logging you in.',
        user: {
          id: user.id,
          email: user.email,
          gritsync_email: user.gritsync_email,
          personal_email: user.personal_email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          grit_id: user.grit_id,
        },
        token: accessToken,
        refresh_token,
      })
    }

    if (!user.email_otp || user.email_otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' })
    }

    if (new Date(user.email_otp_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new code.' })
    }

    // Mark email as verified, clear token and OTP
    await query(
      `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL, email_otp = NULL, email_otp_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    )

    // Send welcome email (fire-and-forget) — same as the link-based verification path
    if (user.personal_email) {
      query(`UPDATE users SET welcome_email_sent_at = NOW() WHERE id = $1`, [user.id]).catch(() => {})
      sendWelcomeEmail(
        user.personal_email,
        user.first_name || '',
        user.last_name || '',
        user.grit_id || '',
        user.gritsync_email || ''
      )
    }

    const accessToken = signToken({ id: user.id, email: user.email, role: user.role, grit_id: user.grit_id })
    const refresh_token = signRefreshToken({ id: user.id })

    res.json({
      verified: true,
      message: 'Email verified successfully! Your account is now active.',
      user: {
        id: user.id,
        email: user.email,
        gritsync_email: user.gritsync_email,
        personal_email: user.personal_email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        grit_id: user.grit_id,
      },
      token: accessToken,
      refresh_token,
    })
  } catch (err: any) {
    console.error('Verify OTP error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { personal_email } = req.body
    const emailInput = personal_email?.trim().toLowerCase()
    if (!emailInput) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Match by personal_email OR email column; prefer unverified accounts so we
    // can actually send them a new link (already-verified accounts are skipped below)
    const result = await query(
      `SELECT id, first_name, personal_email, email, email_verified
       FROM users
       WHERE personal_email = $1 OR email = $1
       ORDER BY email_verified ASC, created_at ASC
       LIMIT 1`,
      [emailInput]
    )

    if (result.rows.length === 0) {
      return res.json({ message: 'If that email is registered, a verification link will be sent.' })
    }

    const user = result.rows[0]
    if (user.email_verified) {
      return res.json({ message: 'This email is already verified. You can log in.' })
    }

    const verification_token = crypto.randomBytes(32).toString('hex')
    const verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const otp = generateOTP()
    const otp_expires = new Date(Date.now() + 15 * 60 * 1000)

    await query(
      `UPDATE users SET email_verification_token = $1, email_verification_expires_at = $2, email_otp = $3, email_otp_expires_at = $4, updated_at = NOW() WHERE id = $5`,
      [verification_token, verification_expires, otp, otp_expires, user.id]
    )

    // Send to the email the user provided (handles accounts where personal_email is null)
    const sendTo = user.personal_email || emailInput
    sendVerificationEmail(sendTo, user.first_name || '', verification_token, otp)

    res.json({ message: 'Verification email resent. Please check your inbox.' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/auth/admin/users/:id/deactivate  (admin only)
router.patch('/admin/users/:id/deactivate', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  if (authReq.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
  try {
    const { id } = req.params
    const { is_active } = req.body
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' })
    }
    const result = await query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_active`,
      [is_active, id]
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ success: true, user: result.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/auth/admin/users/:id  (admin only)
router.delete('/admin/users/:id', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  if (authReq.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
  try {
    const { id } = req.params
    // Prevent self-deletion
    if (authReq.user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    const result = await query(`DELETE FROM users WHERE id = $1 RETURNING id`, [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/backfill-welcome-emails  (admin only)
// Sends welcome emails to verified users who haven't received one yet
router.post('/backfill-welcome-emails', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  if (authReq.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }
  try {
    const result = await query(
      `SELECT id, personal_email, first_name, last_name, grit_id, gritsync_email
       FROM users
       WHERE email_verified = true AND welcome_email_sent_at IS NULL AND personal_email IS NOT NULL AND role = 'client'
       LIMIT 50`
    )
    const users = result.rows
    let sent = 0
    for (const u of users) {
      try {
        await query(`UPDATE users SET welcome_email_sent_at = NOW() WHERE id = $1`, [u.id])
        sendWelcomeEmail(u.personal_email, u.first_name || '', u.last_name || '', u.grit_id || '', u.gritsync_email || '')
        sent++
      } catch (e) {
        console.error('Backfill welcome email error for user', u.id, e)
      }
    }
    res.json({ message: `Queued welcome emails for ${sent} users`, total: users.length, sent })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
