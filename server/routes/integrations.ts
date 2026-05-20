import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
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

export default router
