import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// GET /api/messages
// - Client: returns their own thread (messages between this client and any admin)
// - Admin: returns a list of unique client conversations with last message + unread count
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const role = req.user!.role

    if (role === 'admin') {
      // Return list of distinct client conversations
      const result = await query(`
        SELECT
          u.id AS client_id,
          u.first_name,
          u.last_name,
          u.email,
          m.subject AS last_subject,
          m.body AS last_message,
          m.created_at AS last_message_at,
          m.sender_id AS last_sender_id,
          COUNT(m2.id) FILTER (
            WHERE m2.is_read = false AND m2.sender_id = u.id
          ) AS unread_count
        FROM (
          SELECT DISTINCT
            CASE
              WHEN sender_id IN (SELECT id FROM users WHERE role = 'admin') THEN recipient_id
              ELSE sender_id
            END AS client_id
          FROM messages
        ) conv
        JOIN users u ON u.id = conv.client_id AND u.role = 'client'
        JOIN LATERAL (
          SELECT subject, body, created_at, sender_id
          FROM messages
          WHERE sender_id = u.id OR recipient_id = u.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON true
        LEFT JOIN messages m2 ON (m2.sender_id = u.id OR m2.recipient_id = u.id)
        GROUP BY u.id, u.first_name, u.last_name, u.email, m.subject, m.body, m.created_at, m.sender_id
        ORDER BY m.created_at DESC
      `)
      return res.json({ data: result.rows })
    }

    // Client: return their thread with admin
    const result = await query(`
      SELECT
        m.id,
        m.sender_id,
        m.recipient_id,
        m.subject,
        m.body,
        m.is_read,
        m.created_at,
        u.first_name AS sender_first_name,
        u.last_name AS sender_last_name,
        u.role AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.sender_id = $1 OR m.recipient_id = $1
      ORDER BY m.created_at ASC
    `, [userId])

    return res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/messages/unread-count
// Returns unread count for current user (messages sent to them that they haven't read)
router.get('/unread-count', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const role = req.user!.role

    let result
    if (role === 'admin') {
      // Admins: count messages from any client that are unread and recipient is null (to all admins) or this admin
      result = await query(`
        SELECT COUNT(*) AS count
        FROM messages
        WHERE is_read = false
          AND (recipient_id = $1 OR recipient_id IS NULL)
          AND sender_id NOT IN (SELECT id FROM users WHERE role = 'admin')
      `, [userId])
    } else {
      // Client: count unread messages sent to them by admins
      result = await query(`
        SELECT COUNT(*) AS count
        FROM messages
        WHERE is_read = false
          AND recipient_id = $1
          AND sender_id IN (SELECT id FROM users WHERE role = 'admin')
      `, [userId])
    }

    res.json({ count: parseInt(result.rows[0].count, 10) })
  } catch (err: any) {
    console.error('GET /api/messages/unread-count error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/messages/clients — admin only; search client users by name or email
router.get('/clients', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const q = ((req.query.q as string) || '').trim()
    if (!q) return res.json({ data: [] })

    const result = await query(`
      SELECT id, first_name, last_name, email
      FROM users
      WHERE role = 'client'
        AND (
          first_name ILIKE $1
          OR last_name ILIKE $1
          OR email ILIKE $1
          OR (first_name || ' ' || last_name) ILIKE $1
        )
      ORDER BY first_name, last_name
      LIMIT 20
    `, [`%${q}%`])

    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages/clients error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/messages/:clientId — admin only; returns full thread for a specific client
router.get('/:clientId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { clientId } = req.params
    const result = await query(`
      SELECT
        m.id,
        m.sender_id,
        m.recipient_id,
        m.subject,
        m.body,
        m.is_read,
        m.created_at,
        u.first_name AS sender_first_name,
        u.last_name AS sender_last_name,
        u.role AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.sender_id = $1 OR m.recipient_id = $1
      ORDER BY m.created_at ASC
    `, [clientId])

    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages/:clientId error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/messages — send a message
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const senderId = req.user!.id
    const role = req.user!.role
    const { body, subject, recipientId } = req.body

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required' })
    }

    let finalRecipientId: string | null = null

    if (role === 'admin') {
      // Admin must specify the client's userId
      if (!recipientId) {
        return res.status(400).json({ error: 'recipientId is required when admin sends a message' })
      }
      // Verify recipient is a client, not another admin
      const recipientCheck = await query(
        `SELECT id FROM users WHERE id = $1 AND role = 'client'`,
        [recipientId]
      )
      if (recipientCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Recipient must be a client user' })
      }
      finalRecipientId = recipientId
    } else {
      // Client sending to admins — store recipient_id as NULL (broadcast to all admins)
      finalRecipientId = null
    }

    const result = await query(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, is_read, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      RETURNING id, sender_id, recipient_id, subject, body, is_read, created_at
    `, [senderId, finalRecipientId, subject?.trim() || null, body.trim()])

    res.status(201).json({ data: result.rows[0] })
  } catch (err: any) {
    console.error('POST /api/messages error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/messages/read — mark messages in a thread as read for the current user
router.patch('/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const role = req.user!.role
    const { clientId } = req.body

    if (role === 'admin') {
      // Admin reading a client's thread — mark messages from that client as read
      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required for admin' })
      }
      await query(`
        UPDATE messages
        SET is_read = true
        WHERE sender_id = $1 AND (recipient_id = $2 OR recipient_id IS NULL) AND is_read = false
      `, [clientId, userId])
    } else {
      // Client reading their thread — mark admin messages sent to them as read
      await query(`
        UPDATE messages
        SET is_read = true
        WHERE recipient_id = $1
          AND sender_id IN (SELECT id FROM users WHERE role = 'admin')
          AND is_read = false
      `, [userId])
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/messages/read error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
