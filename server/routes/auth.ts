import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db'
import { authenticateToken, signToken, signRefreshToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

function generateGritId(): string {
  const num = Math.floor(100000 + Math.random() * 900000)
  return `GRIT${num}`
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, middle_name, mobile, role = 'client' } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already registered' })
    }

    const password_hash = await bcrypt.hash(password, 12)
    const grit_id = generateGritId()

    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, middle_name, mobile, role, grit_id, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
       RETURNING id, email, role, first_name, last_name, grit_id, created_at`,
      [email.toLowerCase(), password_hash, first_name || null, last_name || null, middle_name || null, mobile || null, role, grit_id]
    )

    const user = result.rows[0]
    const token = signToken({ id: user.id, email: user.email, role: user.role, grit_id: user.grit_id })
    const refresh_token = signRefreshToken({ id: user.id })

    res.status(201).json({
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
    console.error('Register error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const result = await query(
      'SELECT id, email, password_hash, role, first_name, last_name, middle_name, grit_id, avatar_path, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid login credentials' })
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

// POST /api/auth/reset-password-request
router.post('/reset-password-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    const result = await query('SELECT id FROM users WHERE email = $1', [email?.toLowerCase()])
    if (result.rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link will be sent.' })
    }
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')
       ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = NOW() + INTERVAL '1 hour'`,
      [result.rows[0].id, token]
    ).catch(() => {})
    res.json({ message: 'If that email exists, a reset link will be sent.', token })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
