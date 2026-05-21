import { Router } from 'express'
import crypto from 'crypto'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import pool from '../db'
import {
  driveAuthUrl,
  exchangeCodeAndStore,
  getDriveStatus,
  disconnectDrive,
} from '../lib/google-drive'

const router = Router()

// Where Google should bounce back to. Prefer PUBLIC_BASE_URL but fall
// back to the request's own origin so the same code works locally.
function publicBaseFromReq(req: any): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https'
  const host = req.headers.host
  return `${proto}://${host}`
}

// GET /api/integrations/google-drive/status
// Returns whether Drive is connected + the connected email + folder info.
router.get('/google-drive/status', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const status = await getDriveStatus()
    res.json({ data: status })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/integrations/google-drive/connect-url
// Returns the Google OAuth URL the admin should open in a popup. We use
// the user's id as `state` so the callback can attribute the connection.
router.post('/google-drive/connect-url', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
      return res.status(400).json({
        error: 'GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET are not set on the server',
      })
    }
    const baseUrl = publicBaseFromReq(req)
    const state = req.user!.id
    const url = driveAuthUrl(baseUrl, state)
    res.json({ data: { url } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/integrations/google-drive/callback?code=...&state=<user-id>
// Google redirects the browser here after consent. We exchange the code
// for tokens, store them, then close the popup window and notify the
// opener so the UI can refresh its status pill.
router.get('/google-drive/callback', async (req, res) => {
  const code = String(req.query.code || '')
  const state = String(req.query.state || '')
  const errorParam = String(req.query.error || '')

  // Helper: render a tiny HTML page that posts a message back to the
  // popup's opener (the admin tab) and closes itself. Avoids needing a
  // React route for the callback.
  const closePage = (status: 'ok' | 'error', message: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Connecting Google Drive…</title>
<style>body{font-family:system-ui;padding:2rem;max-width:32rem;margin:0 auto;color:#1f2937}
.ok{color:#047857}.err{color:#b91c1c}</style></head>
<body>
<h2 class="${status === 'ok' ? 'ok' : 'err'}">${status === 'ok' ? 'Google Drive connected' : 'Drive connection failed'}</h2>
<p>${message}</p>
<p>You can close this window.</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'google-drive-${status}', message: ${JSON.stringify(message)} }, '*');
      setTimeout(function(){ window.close(); }, 800);
    }
  } catch (e) {}
</script>
</body></html>`

  if (errorParam) {
    res.set('content-type', 'text/html')
    return res.send(closePage('error', `Google returned: ${errorParam}`))
  }
  if (!code) {
    res.set('content-type', 'text/html')
    return res.send(closePage('error', 'No authorization code returned by Google.'))
  }
  try {
    const baseUrl = publicBaseFromReq(req)
    const { email } = await exchangeCodeAndStore(code, baseUrl, state)
    res.set('content-type', 'text/html')
    res.send(closePage('ok', email ? `Connected as ${email}.` : 'Connection saved.'))
  } catch (err: any) {
    res.set('content-type', 'text/html')
    res.send(closePage('error', err.message || 'Token exchange failed'))
  }
})

// DELETE /api/integrations/google-drive
router.delete('/google-drive', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    await disconnectDrive()
    res.json({ data: { disconnected: true } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// Facebook Data Deletion Callback — Meta requirement for any app that uses
// Facebook Login.
//
// Two URLs Meta cares about (paste both into the Meta App Dashboard →
// Settings → Basic):
//
//   Data Deletion Callback URL:
//     https://app.gritsync.com/api/integrations/facebook/data-deletion-callback
//
//   Data Deletion Instructions URL (shown to the user):
//     https://app.gritsync.com/client/account-settings/delete
//
// When a user revokes the app from facebook.com → Settings → Apps and
// Websites → GritSync → Remove, Meta POSTs a signed_request here. We
// verify the HMAC, delete every social_accounts row tied to that fb
// user_id, and respond with a `{ url, confirmation_code }` JSON envelope
// that Meta then shows the user. The url they get points at our public
// status page (mounted as a React route on the SPA, so the SPA fallback
// rewrite already serves it).
// ---------------------------------------------------------------------------

interface DecodedSignedRequest {
  algorithm: string
  expires?: number
  issued_at?: number
  user_id: string
}

function parseSignedRequest(signed: string, appSecret: string): DecodedSignedRequest | null {
  // Format is `<base64url(signature)>.<base64url(payload)>`. Per Meta's
  // spec we verify with HMAC-SHA256 over the RAW payload string (NOT the
  // decoded JSON) keyed by the app secret.
  const [encodedSig, encodedPayload] = signed.split('.')
  if (!encodedSig || !encodedPayload) return null
  let payload: DecodedSignedRequest
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload.algorithm || payload.algorithm.toUpperCase() !== 'HMAC-SHA256') return null

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest('base64url')
  // base64url is unpadded; Meta also sends unpadded — direct comparison
  // would still leak length. Use timingSafeEqual on equal-length buffers.
  const a = Buffer.from(encodedSig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  if (!payload.user_id) return null
  return payload
}

router.post('/facebook/data-deletion-callback', async (req, res) => {
  try {
    const appSecret = process.env.FACEBOOK_APP_SECRET
    if (!appSecret) {
      console.error('FACEBOOK_APP_SECRET not set — cannot verify deletion callback')
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    // Express's urlencoded() middleware turns the body into an object.
    // Meta posts the signed payload either as the form field `signed_request`
    // or in a JSON body — handle both.
    const signed = (req.body?.signed_request as string) || (req.query.signed_request as string)
    if (!signed) return res.status(400).json({ error: 'missing signed_request' })

    const decoded = parseSignedRequest(signed, appSecret)
    if (!decoded) return res.status(400).json({ error: 'invalid signed_request' })

    const fbUserId = String(decoded.user_id)

    // Generate the confirmation_code Meta will show the user. We give them
    // the row id so the status page can look it up directly.
    const confirmationCode = crypto.randomUUID()

    // Delete every connected account that traces back to this fb user.
    // Two row shapes own that user_id:
    //   1. the fb_user row with platform_user_id = 'fbuser:<user_id>'
    //   2. the page rows with metadata.fb_user_id matching
    const deleteRes = await pool.query(
      `DELETE FROM social_accounts
       WHERE (platform = 'facebook'
              AND (platform_user_id = $1 OR metadata->>'fb_user_id' = $2))
          OR (platform = 'instagram'
              AND metadata->>'fb_user_id' = $2)
       RETURNING id`,
      [`fbuser:${fbUserId}`, fbUserId]
    )

    const log = await pool.query(
      `INSERT INTO facebook_data_deletions
         (fb_user_id, confirmation_code, rows_deleted, completed_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [fbUserId, confirmationCode, deleteRes.rowCount || 0]
    )
    const id = log.rows[0].id

    const base = (process.env.PUBLIC_BASE_URL || 'https://app.gritsync.com').replace(/\/$/, '')
    res.json({
      url: `${base}/facebook-data-deletion-status?id=${id}`,
      confirmation_code: confirmationCode,
    })
  } catch (err: any) {
    console.error('facebook data deletion callback error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Public lookup for the deletion status page — no auth, just confirms a
// previously-completed deletion. Returns minimal info to avoid leaking
// fb_user_ids to anyone who guesses an id.
router.get('/facebook/data-deletion-status', async (req, res) => {
  try {
    const id = String(req.query.id || '').trim()
    if (!id) return res.status(400).json({ error: 'id required' })
    const r = await pool.query(
      `SELECT id, confirmation_code, rows_deleted, requested_at, completed_at
       FROM facebook_data_deletions WHERE id = $1`,
      [id]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
