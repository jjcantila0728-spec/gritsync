/**
 * Minimal Google Drive client for GritSync's server-owned media uploads.
 *
 * No `googleapis` package — direct fetch against Drive's REST endpoints.
 * Keeps the Vercel function bundle small and avoids the SDK's quirky type
 * surface for what is essentially three calls: refresh token, upload file,
 * make file public.
 *
 * Connection model: ONE Google account owns the "GritSync Social" Drive
 * folder. We persist its refresh_token in `service_integrations` and
 * trade it for a short-lived access_token on demand, caching the access
 * token in the same row until it expires.
 */

import pool from '../db'

const CLIENT_ID = () => process.env.GOOGLE_DRIVE_CLIENT_ID || ''
const CLIENT_SECRET = () => process.env.GOOGLE_DRIVE_CLIENT_SECRET || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

// Used by both the OAuth start URL and the callback exchange — Google
// rejects the code exchange if the redirect_uri doesn't match exactly.
export function driveRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/integrations/google-drive/callback`
}

export function driveAuthUrl(baseUrl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    redirect_uri: driveRedirectUri(baseUrl),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',          // we need a refresh_token, not just access_token
    prompt: 'consent',               // force consent so refresh_token is always returned
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface ConnectionRow {
  id: string
  provider: string
  refresh_token: string
  access_token: string | null
  token_expires_at: Date | null
  metadata: any
  connected_account_email: string | null
}

async function getConnection(): Promise<ConnectionRow | null> {
  const r = await pool.query(
    `SELECT id, provider, refresh_token, access_token, token_expires_at, metadata, connected_account_email
     FROM service_integrations WHERE provider = 'google_drive' LIMIT 1`
  )
  return r.rows[0] || null
}

// Exchange an OAuth `code` for refresh + access tokens, then upsert the
// connection row. Also fetches the account's email so the UI can show
// "connected as foo@bar.com".
export async function exchangeCodeAndStore(
  code: string,
  baseUrl: string,
  connectedByUserId: string
): Promise<{ email: string }> {
  if (!CLIENT_ID() || !CLIENT_SECRET()) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET are not set on the server')
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      redirect_uri: driveRedirectUri(baseUrl),
      grant_type: 'authorization_code',
    }),
  })
  const tj: any = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tj.refresh_token) {
    throw new Error(tj.error_description || tj.error || 'Google token exchange failed')
  }
  const refresh_token: string = tj.refresh_token
  const access_token: string = tj.access_token
  const expires_in: number = tj.expires_in || 3600
  const expires_at = new Date(Date.now() + (expires_in - 60) * 1000)

  // Look up the connected account's email so the UI can show who is
  // connected. Drive offers /about?fields=user — single call.
  let email = ''
  try {
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const aboutJson: any = await aboutRes.json().catch(() => ({}))
    email = aboutJson?.user?.emailAddress || ''
  } catch {
    // non-fatal — connection still works without the email
  }

  // Upsert the single connection row.
  await pool.query(
    `INSERT INTO service_integrations
       (provider, refresh_token, access_token, token_expires_at, scopes,
        connected_account_email, connected_by_user_id)
     VALUES ('google_drive', $1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider) DO UPDATE
       SET refresh_token = EXCLUDED.refresh_token,
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           scopes = EXCLUDED.scopes,
           connected_account_email = EXCLUDED.connected_account_email,
           connected_by_user_id = EXCLUDED.connected_by_user_id,
           updated_at = NOW()`,
    [refresh_token, access_token, expires_at, SCOPE, email, connectedByUserId]
  )
  return { email }
}

export async function isDriveConnected(): Promise<boolean> {
  const conn = await getConnection()
  return !!conn
}

export async function getDriveStatus(): Promise<{
  connected: boolean
  email: string | null
  folder_id: string | null
  folder_name: string | null
  connected_at: string | null
}> {
  const conn = await getConnection()
  if (!conn) {
    return { connected: false, email: null, folder_id: null, folder_name: null, connected_at: null }
  }
  return {
    connected: true,
    email: conn.connected_account_email,
    folder_id: conn.metadata?.folder_id || null,
    folder_name: conn.metadata?.folder_name || null,
    connected_at: null,
  }
}

// Returns a usable access token — refreshing it via the stored refresh
// token if the cached one is expired or missing. Caches the refreshed
// token back to the row so concurrent callers within the same TTL window
// don't all hit Google's token endpoint.
async function getAccessToken(): Promise<string> {
  const conn = await getConnection()
  if (!conn) throw new Error('Google Drive is not connected — connect from /admin/social → Accounts')

  if (conn.access_token && conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 30_000)) {
    return conn.access_token
  }

  if (!CLIENT_ID() || !CLIENT_SECRET()) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET are not set on the server')
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) {
    throw new Error(j.error_description || j.error || 'Google access-token refresh failed')
  }
  const expires_in: number = j.expires_in || 3600
  const expires_at = new Date(Date.now() + (expires_in - 60) * 1000)
  await pool.query(
    `UPDATE service_integrations
       SET access_token = $1, token_expires_at = $2, updated_at = NOW()
     WHERE id = $3`,
    [j.access_token, expires_at, conn.id]
  )
  return j.access_token as string
}

// Find-or-create the "GritSync Social" folder so all uploads live in one
// predictable place the operator can browse in Drive. Folder id is cached
// in the connection's metadata after first creation.
async function ensureFolderId(): Promise<string> {
  const conn = await getConnection()
  if (!conn) throw new Error('Google Drive is not connected')
  if (conn.metadata?.folder_id) return conn.metadata.folder_id

  const token = await getAccessToken()
  const folderName = 'GritSync Social'

  // Look for an existing folder with that name owned by the connected user.
  const searchUrl = new URL('https://www.googleapis.com/drive/v3/files')
  searchUrl.searchParams.set('q', `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`)
  searchUrl.searchParams.set('fields', 'files(id,name)')
  const searchRes = await fetch(searchUrl.toString(), { headers: { Authorization: `Bearer ${token}` } })
  const searchJson: any = await searchRes.json().catch(() => ({}))
  if (!searchRes.ok) throw new Error(searchJson.error?.message || `Drive search failed (HTTP ${searchRes.status})`)
  let folderId: string | undefined = searchJson.files?.[0]?.id

  if (!folderId) {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
    })
    const createJson: any = await createRes.json().catch(() => ({}))
    if (!createRes.ok) throw new Error(createJson.error?.message || `Drive folder create failed (HTTP ${createRes.status})`)
    folderId = createJson.id
  }

  await pool.query(
    `UPDATE service_integrations
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
     WHERE provider = 'google_drive'`,
    [JSON.stringify({ folder_id: folderId, folder_name: folderName })]
  )
  return folderId!
}

// Upload a buffer to the GritSync Social Drive folder, mark it publicly
// readable, and return a stable URL the browser + social platforms can
// fetch. Uses Drive's multipart upload (one HTTP call covers metadata +
// bytes) which is the right shape for files under 5MB.
export async function uploadToDrive(
  buf: Buffer,
  contentType: string,
  filename: string
): Promise<string> {
  const token = await getAccessToken()
  const folderId = await ensureFolderId()

  const boundary = `gritsync_${Math.random().toString(36).slice(2, 10)}`
  const meta = {
    name: filename,
    mimeType: contentType,
    parents: [folderId],
  }
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    ),
    buf,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  const uploadJson: any = await uploadRes.json().catch(() => ({}))
  if (!uploadRes.ok) {
    throw new Error(uploadJson.error?.message || `Drive upload failed (HTTP ${uploadRes.status})`)
  }
  const fileId: string = uploadJson.id

  // Make the file readable by anyone with the link so <img>, Meta IG, and
  // TikTok can fetch it without auth.
  const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  if (!permRes.ok) {
    const errJson: any = await permRes.json().catch(() => ({}))
    throw new Error(errJson.error?.message || `Drive permission update failed (HTTP ${permRes.status})`)
  }

  // The viewer URL works for <img>: Drive serves the raw bytes inline
  // when the file is public. drive.google.com/uc?export=view&id=... is
  // the long-standing endpoint that returns the actual image stream
  // (vs webViewLink which returns the Drive UI wrapper).
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}

export async function disconnectDrive(): Promise<void> {
  await pool.query(`DELETE FROM service_integrations WHERE provider = 'google_drive'`)
}
