import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// ---------------------------------------------------------------------------
// GET /api/messages  (legacy — used by the admin Messages page & old client view)
// - Admin: returns a list of unique client conversations with last message + unread count
// - Client: returns their own thread (messages between this client and any admin)
// ---------------------------------------------------------------------------
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const role = req.user!.role

    if (role === 'admin') {
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
          WHERE deleted_at IS NULL
        ) conv
        JOIN users u ON u.id = conv.client_id AND u.role = 'client'
        JOIN LATERAL (
          SELECT subject, body, created_at, sender_id
          FROM messages
          WHERE (sender_id = u.id OR recipient_id = u.id) AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON true
        LEFT JOIN messages m2 ON (m2.sender_id = u.id OR m2.recipient_id = u.id) AND m2.deleted_at IS NULL
        GROUP BY u.id, u.first_name, u.last_name, u.email, m.subject, m.body, m.created_at, m.sender_id
        ORDER BY m.created_at DESC
      `)
      return res.json({ data: result.rows })
    }

    const result = await query(`
      SELECT
        m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.is_read, m.read_at, m.created_at, m.edited_at, m.attachments,
        u.first_name AS sender_first_name,
        u.last_name AS sender_last_name,
        u.role AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = $1 OR m.recipient_id = $1) AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
    `, [userId])

    return res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/messages/conversations
// Returns the current user's conversation list (one entry per other user they
// have exchanged messages with) with the last message preview + unread count.
// Works for every authenticated user (admins and clients alike).
// ---------------------------------------------------------------------------
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const isAdmin = req.user!.role === 'admin'

    const result = await query(`
      WITH mine AS (
        SELECT
          m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.is_read, m.created_at, m.attachments,
          CASE
            WHEN m.sender_id = $1 AND m.recipient_id IS NOT NULL THEN m.recipient_id
            WHEN m.recipient_id = $1 THEN m.sender_id
            WHEN m.recipient_id IS NULL AND $2::boolean THEN m.sender_id
            ELSE NULL
          END AS partner_id
        FROM messages m
        WHERE m.deleted_at IS NULL
          AND (m.sender_id = $1 OR m.recipient_id = $1 OR (m.recipient_id IS NULL AND $2::boolean))
      ),
      filtered AS (
        SELECT * FROM mine WHERE partner_id IS NOT NULL AND partner_id <> $1
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY partner_id ORDER BY created_at DESC, id DESC) AS rn
        FROM filtered
      )
      SELECT
        u.id AS user_id,
        u.first_name, u.last_name, u.email, u.role, u.is_active, u.last_seen_at, u.avatar_path,
        r.subject AS last_subject,
        r.body AS last_message,
        r.attachments AS last_attachments,
        r.created_at AS last_message_at,
        r.sender_id AS last_sender_id,
        (SELECT COUNT(*) FROM filtered f WHERE f.partner_id = u.id AND f.sender_id = u.id AND f.is_read = false) AS unread_count
      FROM ranked r
      JOIN users u ON u.id = r.partner_id
      WHERE r.rn = 1
      ORDER BY r.created_at DESC
    `, [me, isAdmin])

    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages/conversations error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/messages/unread-count — total unread messages addressed to the user
// ---------------------------------------------------------------------------
router.get('/unread-count', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const isAdmin = req.user!.role === 'admin'

    const result = await query(`
      SELECT COUNT(*) AS count
      FROM messages
      WHERE is_read = false
        AND deleted_at IS NULL
        AND sender_id <> $1
        AND (
          recipient_id = $1
          OR (recipient_id IS NULL AND $2::boolean AND sender_id NOT IN (SELECT id FROM users WHERE role = 'admin'))
        )
    `, [me, isAdmin])

    res.json({ count: parseInt(result.rows[0].count, 10) })
  } catch (err: any) {
    console.error('GET /api/messages/unread-count error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/messages/users?q= — active users the current user can message
// ---------------------------------------------------------------------------
router.get('/users', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const q = ((req.query.q as string) || '').trim()
    const params: any[] = [me]
    let where = `id <> $1 AND is_active = true`
    if (q) {
      params.push(`%${q}%`)
      where += ` AND (
        first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2
        OR (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE $2
        OR grit_id ILIKE $2
      )`
    }
    const result = await query(`
      SELECT id, first_name, last_name, email, role, last_seen_at, avatar_path
      FROM users
      WHERE ${where}
      ORDER BY (role = 'admin') DESC, first_name NULLS LAST, last_name NULLS LAST
      LIMIT 50
    `, params)
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages/users error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/messages/clients?q= — admin only; search client users (legacy)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GET /api/messages/thread/:userId — full conversation between me and :userId
// ---------------------------------------------------------------------------
router.get('/thread/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const other = req.params.userId
    if (other === me) return res.status(400).json({ error: 'Cannot open a conversation with yourself' })
    const iAmAdmin = req.user!.role === 'admin'

    const ou = await query(
      `SELECT id, first_name, last_name, email, role, is_active, last_seen_at, avatar_path FROM users WHERE id = $1`,
      [other]
    )
    if (!ou.rowCount) return res.status(404).json({ error: 'User not found' })
    const otherIsAdmin = ou.rows[0].role === 'admin'

    const result = await query(`
      SELECT
        m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.is_read, m.read_at, m.created_at, m.edited_at, m.attachments,
        s.first_name AS sender_first_name,
        s.last_name AS sender_last_name,
        s.role AS sender_role
      FROM messages m
      JOIN users s ON s.id = m.sender_id
      WHERE m.deleted_at IS NULL AND (
        (m.sender_id = $1 AND (m.recipient_id = $2 OR (m.recipient_id IS NULL AND $3::boolean)))
        OR (m.sender_id = $2 AND (m.recipient_id = $1 OR (m.recipient_id IS NULL AND $4::boolean)))
      )
      ORDER BY m.created_at ASC, m.id ASC
    `, [me, other, otherIsAdmin, iAmAdmin])

    res.json({ data: result.rows, user: ou.rows[0] })
  } catch (err: any) {
    console.error('GET /api/messages/thread/:userId error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/messages/:clientId — admin only; full thread for a client (legacy)
// ---------------------------------------------------------------------------
router.get('/:clientId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { clientId } = req.params
    const result = await query(`
      SELECT
        m.id, m.sender_id, m.recipient_id, m.subject, m.body, m.is_read, m.read_at, m.created_at, m.edited_at, m.attachments,
        u.first_name AS sender_first_name,
        u.last_name AS sender_last_name,
        u.role AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = $1 OR m.recipient_id = $1) AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
    `, [clientId])

    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/messages/:clientId error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/messages — send a message
// ---------------------------------------------------------------------------
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const senderId = req.user!.id
    const role = req.user!.role
    const { body, subject, recipientId } = req.body

    // Normalise / validate attachments: [{ path, name, type?, size? }]
    let attachments: Array<{ path: string; name: string; type: string | null; size: number | null }> = []
    if (Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments
        .filter((a: any) => a && typeof a.path === 'string' && a.path.trim() && a.path.length < 600)
        .slice(0, 10)
        .map((a: any) => ({
          path: String(a.path),
          name: typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 255) : 'file',
          type: typeof a.type === 'string' ? a.type.slice(0, 120) : null,
          size: typeof a.size === 'number' && isFinite(a.size) && a.size >= 0 ? Math.floor(a.size) : null,
        }))
    }

    const bodyText = (body || '').toString().trim()
    if (!bodyText && attachments.length === 0) {
      return res.status(400).json({ error: 'A message must contain text or at least one attachment' })
    }

    let finalRecipientId: string | null = null

    if (recipientId) {
      if (recipientId === senderId) {
        return res.status(400).json({ error: 'You cannot message yourself' })
      }
      const rc = await query(`SELECT id, is_active FROM users WHERE id = $1`, [recipientId])
      if (rc.rowCount === 0) {
        return res.status(400).json({ error: 'Recipient not found' })
      }
      finalRecipientId = recipientId
    } else if (role !== 'admin') {
      // Legacy: a client with no explicit recipient broadcasts to all admins
      finalRecipientId = null
    } else {
      return res.status(400).json({ error: 'recipientId is required' })
    }

    const result = await query(`
      INSERT INTO messages (sender_id, recipient_id, subject, body, attachments, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, false, NOW())
      RETURNING id, sender_id, recipient_id, subject, body, attachments, is_read, read_at, created_at, edited_at
    `, [senderId, finalRecipientId, subject?.trim() || null, bodyText, JSON.stringify(attachments)])

    const row = result.rows[0]
    res.status(201).json({
      data: {
        ...row,
        sender_first_name: req.user!.first_name ?? null,
        sender_last_name: req.user!.last_name ?? null,
        sender_role: role,
      },
    })
  } catch (err: any) {
    console.error('POST /api/messages error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/messages/broadcast — send one message to many users at once.
// Requires the `messages.broadcast` or `messages.create_group` permission
// (admins always qualify). Body:
//   { body, subject?, audience?: 'all'|'clients'|'affiliates'|'advisors' }
//   { body, subject?, recipientIds: string[] }   (a hand-picked group)
// ---------------------------------------------------------------------------
async function canBroadcastMessages(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'admin') return true
  try {
    const r = await query(`SELECT value FROM settings WHERE key = 'rolePermissions' LIMIT 1`)
    if (!r.rowCount) return false
    const map = JSON.parse(r.rows[0].value || '{}') || {}
    const rolePerms = map[user.role] || {}
    return !!rolePerms['messages.broadcast'] || !!rolePerms['messages.create_group']
  } catch {
    return false
  }
}

router.post('/broadcast', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const sender = req.user!
    if (!(await canBroadcastMessages(sender))) {
      return res.status(403).json({ error: 'You do not have permission to broadcast messages' })
    }

    const bodyText = (req.body.body || '').toString().trim()
    if (!bodyText) return res.status(400).json({ error: 'Message body is required' })
    const subject = req.body.subject ? String(req.body.subject).trim().slice(0, 255) || null : null

    let recipientIds: string[] = []
    if (Array.isArray(req.body.recipientIds) && req.body.recipientIds.length > 0) {
      const ids = req.body.recipientIds.filter((x: any) => typeof x === 'string' && x.trim()).slice(0, 5000)
      if (ids.length === 0) return res.status(400).json({ error: 'No valid recipients supplied' })
      const r = await query(`SELECT id FROM users WHERE is_active = true AND id = ANY($1::uuid[]) AND id <> $2`, [ids, sender.id])
      recipientIds = r.rows.map((x: any) => x.id)
    } else {
      const audience = (req.body.audience || 'all').toString()
      const roleClause =
        audience === 'clients' ? `role = 'client'`
        : audience === 'affiliates' ? `role = 'affiliate'`
        : audience === 'advisors' ? `role = 'advisor'`
        : `role <> 'admin'` // 'all' — everyone except other admins
      const r = await query(`SELECT id FROM users WHERE is_active = true AND id <> $1 AND ${roleClause}`, [sender.id])
      recipientIds = r.rows.map((x: any) => x.id)
    }

    recipientIds = Array.from(new Set(recipientIds)).filter((id) => id && id !== sender.id)
    if (recipientIds.length === 0) return res.status(400).json({ error: 'No recipients matched' })

    // Bulk insert one message per recipient.
    const params: any[] = [sender.id, subject, bodyText]
    const valueTuples = recipientIds.map((_, i) => `($1, $${i + 4}, $2, $3, '[]'::jsonb, false, NOW())`)
    params.push(...recipientIds)
    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, body, attachments, is_read, created_at) VALUES ${valueTuples.join(', ')}`,
      params
    )

    res.status(201).json({ success: true, count: recipientIds.length })
  } catch (err: any) {
    console.error('POST /api/messages/broadcast error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/messages/read — mark a thread (or everything) as read for the user
// Body: { userId?: string }  ({ clientId } accepted for backwards compatibility)
// ---------------------------------------------------------------------------
router.patch('/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const isAdmin = req.user!.role === 'admin'
    const otherId: string | null = req.body.userId || req.body.clientId || null

    if (otherId) {
      await query(`
        UPDATE messages
        SET is_read = true, read_at = COALESCE(read_at, NOW())
        WHERE sender_id = $1 AND is_read = false
          AND (recipient_id = $2 OR (recipient_id IS NULL AND $3::boolean))
      `, [otherId, me, isAdmin])
    } else {
      await query(`
        UPDATE messages
        SET is_read = true, read_at = COALESCE(read_at, NOW())
        WHERE is_read = false AND sender_id <> $1
          AND (
            recipient_id = $1
            OR (recipient_id IS NULL AND $2::boolean AND sender_id NOT IN (SELECT id FROM users WHERE role = 'admin'))
          )
      `, [me, isAdmin])
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/messages/read error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/messages/heartbeat — record that the user is currently online
// ---------------------------------------------------------------------------
router.patch('/heartbeat', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [req.user!.id])
    res.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/messages/heartbeat error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/messages/:id — edit a message you sent
// ---------------------------------------------------------------------------
router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const { id } = req.params
    const { body } = req.body
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' })

    const r = await query(`
      UPDATE messages
      SET body = $1, edited_at = NOW()
      WHERE id = $2 AND sender_id = $3 AND deleted_at IS NULL
      RETURNING id, sender_id, recipient_id, subject, body, is_read, read_at, created_at, edited_at
    `, [body.trim(), id, me])

    if (r.rowCount === 0) return res.status(404).json({ error: 'Message not found or you cannot edit it' })
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    console.error('PATCH /api/messages/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/messages/:id — delete (for everyone) a message you sent
// ---------------------------------------------------------------------------
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user!.id
    const { id } = req.params
    const r = await query(
      `UPDATE messages SET deleted_at = NOW() WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL RETURNING id`,
      [id, me]
    )
    if (r.rowCount === 0) return res.status(404).json({ error: 'Message not found or you cannot delete it' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/messages/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
