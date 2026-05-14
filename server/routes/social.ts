import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// ---------------------------------------------------------------------------
// /api/social — social-media account connections + scheduled posts
//
// Platforms: facebook, instagram, linkedin, youtube, tiktok
// Each platform's OAuth flow needs app credentials in env vars
// (FACEBOOK_APP_ID/SECRET, INSTAGRAM_*, LINKEDIN_*, YOUTUBE_*, TIKTOK_*).
// When credentials are missing the connect endpoint returns a clear error so
// the admin UI can fall back to manual token entry (useful for first setup
// while OAuth apps are still being reviewed).
// ---------------------------------------------------------------------------

const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const
type Platform = (typeof PLATFORMS)[number]

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')

const PLATFORM_CONFIG: Record<Platform, {
  authUrl: string
  tokenUrl: string
  scopes: string
  envIdKey: string
  envSecretKey: string
  extraAuthParams?: Record<string, string>
}> = {
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: 'pages_show_list,pages_manage_posts,pages_read_engagement',
    envIdKey: 'FACEBOOK_APP_ID',
    envSecretKey: 'FACEBOOK_APP_SECRET',
  },
  instagram: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
    envIdKey: 'FACEBOOK_APP_ID',
    envSecretKey: 'FACEBOOK_APP_SECRET',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'openid,profile,email,w_member_social',
    envIdKey: 'LINKEDIN_CLIENT_ID',
    envSecretKey: 'LINKEDIN_CLIENT_SECRET',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    envIdKey: 'YOUTUBE_CLIENT_ID',
    envSecretKey: 'YOUTUBE_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: 'user.info.basic,video.publish,video.upload',
    envIdKey: 'TIKTOK_CLIENT_KEY',
    envSecretKey: 'TIKTOK_CLIENT_SECRET',
  },
}

function isPlatform(s: string): s is Platform {
  return (PLATFORMS as readonly string[]).includes(s)
}

function callbackUrl(platform: Platform) {
  return `${PUBLIC_BASE}/api/social/oauth/${platform}/callback`
}

// ---------------------------------------------------------------------------
// GET /api/social/accounts
// ---------------------------------------------------------------------------
router.get('/accounts', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const result = await query(
      `SELECT id, platform, display_name, profile_url, avatar_url, status,
              platform_user_id, scopes, metadata, connected_at, token_expires_at,
              last_error
       FROM social_accounts
       ORDER BY platform ASC, created_at DESC`
    )
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /api/social/accounts error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/social/oauth/:platform/start
// Returns the URL the admin should be redirected to in order to authorize the
// app on the requested platform.
// ---------------------------------------------------------------------------
router.get('/oauth/:platform/start', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const platform = String(req.params.platform || '')
    if (!isPlatform(platform)) return res.status(400).json({ error: 'Unknown platform' })
    const cfg = PLATFORM_CONFIG[platform]
    const clientId = process.env[cfg.envIdKey]
    const clientSecret = process.env[cfg.envSecretKey]
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: `${platform} OAuth is not configured. Set ${cfg.envIdKey} and ${cfg.envSecretKey} on the server.`,
      })
    }
    const state = Buffer.from(JSON.stringify({
      platform,
      user_id: req.user!.id,
      ts: Date.now(),
    })).toString('base64url')
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(platform),
      response_type: 'code',
      scope: cfg.scopes,
      state,
      ...(cfg.extraAuthParams || {}),
    })
    res.json({ url: `${cfg.authUrl}?${params.toString()}` })
  } catch (err: any) {
    console.error('GET /oauth/start error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/social/oauth/:platform/callback
// Platform redirects here after the user authorizes. We exchange the code for
// an access token, fetch profile info, and persist the connection.
// ---------------------------------------------------------------------------
router.get('/oauth/:platform/callback', async (req, res) => {
  try {
    const platform = String(req.params.platform || '')
    if (!isPlatform(platform)) return res.status(400).send('Unknown platform')
    const code = req.query.code as string | undefined
    const stateRaw = req.query.state as string | undefined
    if (!code || !stateRaw) return res.status(400).send('Missing code or state')
    let userId: string
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
      if (parsed.platform !== platform) return res.status(400).send('State mismatch')
      userId = parsed.user_id
    } catch {
      return res.status(400).send('Invalid state')
    }

    const cfg = PLATFORM_CONFIG[platform]
    const clientId = process.env[cfg.envIdKey]
    const clientSecret = process.env[cfg.envSecretKey]
    if (!clientId || !clientSecret) return res.status(400).send('OAuth not configured')

    // Exchange code for token. Each platform's exact format differs slightly
    // but they all accept this basic form-encoded body.
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(platform),
    })
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const tokenJson: any = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error(`${platform} token exchange failed`, tokenJson)
      return res.status(400).send(`Token exchange failed: ${tokenJson.error_description || tokenJson.error || 'unknown'}`)
    }

    const accessToken = tokenJson.access_token
    const refreshToken = tokenJson.refresh_token || null
    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000)
      : null

    // Fetch a display name + platform id so the UI has something to show.
    const profile = await fetchPlatformProfile(platform, accessToken)

    await query(
      `INSERT INTO social_accounts
         (platform, display_name, platform_user_id, access_token, refresh_token,
          token_expires_at, profile_url, avatar_url, scopes, metadata,
          status, connected_by_user_id, connected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'connected',$11,NOW())
       ON CONFLICT (platform, platform_user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             access_token = EXCLUDED.access_token,
             refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
             token_expires_at = EXCLUDED.token_expires_at,
             profile_url = EXCLUDED.profile_url,
             avatar_url = EXCLUDED.avatar_url,
             scopes = EXCLUDED.scopes,
             metadata = EXCLUDED.metadata,
             status = 'connected',
             last_error = NULL,
             updated_at = NOW(),
             connected_at = NOW()`,
      [
        platform,
        profile.display_name,
        profile.platform_user_id || `${platform}:${Date.now()}`,
        accessToken,
        refreshToken,
        expiresAt,
        profile.profile_url,
        profile.avatar_url,
        cfg.scopes,
        JSON.stringify(profile.metadata || {}),
        userId,
      ]
    )

    // Close the popup if opened that way, otherwise show a success page.
    res.send(`
      <!doctype html><html><body style="font-family:system-ui;padding:24px;text-align:center">
        <h2>${platform} connected</h2>
        <p>You can close this window.</p>
        <script>
          try { window.opener && window.opener.postMessage({ type: 'social-connected', platform: '${platform}' }, '*') } catch (e) {}
          setTimeout(() => { try { window.close() } catch (e) {} }, 800);
        </script>
      </body></html>
    `)
  } catch (err: any) {
    console.error('OAuth callback error:', err)
    res.status(500).send(`OAuth error: ${err.message || 'unknown'}`)
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/accounts/manual
// Manual token entry for the admin to wire an account up while OAuth apps are
// still in review on the platform side. Body: { platform, display_name,
// access_token, platform_user_id, refresh_token?, profile_url?, avatar_url? }
// ---------------------------------------------------------------------------
router.post('/accounts/manual', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { platform, display_name, access_token, platform_user_id, refresh_token, profile_url, avatar_url, metadata } = req.body || {}
    if (!isPlatform(platform)) return res.status(400).json({ error: 'Unknown platform' })
    if (!display_name || !access_token || !platform_user_id) {
      return res.status(400).json({ error: 'display_name, access_token and platform_user_id are required' })
    }
    const result = await query(
      `INSERT INTO social_accounts
         (platform, display_name, platform_user_id, access_token, refresh_token,
          profile_url, avatar_url, scopes, metadata, status,
          connected_by_user_id, connected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'connected',$10,NOW())
       ON CONFLICT (platform, platform_user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             access_token = EXCLUDED.access_token,
             refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
             profile_url = EXCLUDED.profile_url,
             avatar_url = EXCLUDED.avatar_url,
             metadata = EXCLUDED.metadata,
             status = 'connected',
             last_error = NULL,
             updated_at = NOW(),
             connected_at = NOW()
       RETURNING *`,
      [
        platform, display_name, platform_user_id, access_token, refresh_token || null,
        profile_url || null, avatar_url || null, PLATFORM_CONFIG[platform].scopes,
        JSON.stringify(metadata || {}), req.user!.id,
      ]
    )
    res.json({ data: result.rows[0] })
  } catch (err: any) {
    console.error('manual connect error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/social/accounts/:id
// ---------------------------------------------------------------------------
router.delete('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query(`DELETE FROM social_accounts WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POSTS
// ---------------------------------------------------------------------------
router.get('/posts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = (req.query.status as string) || null
    const params: any[] = []
    let where = ''
    if (status) {
      params.push(status)
      where = `WHERE status = $1`
    }
    const result = await query(
      `SELECT p.*,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', a.id, 'platform', a.platform, 'display_name', a.display_name, 'avatar_url', a.avatar_url
           ))
            FROM social_accounts a
            WHERE a.id = ANY(p.account_ids)),
           '[]'::json
         ) AS accounts
       FROM social_posts p
       ${where}
       ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
       LIMIT 200`,
      params
    )
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error('GET /posts error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/posts', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { account_ids, content, media_urls, scheduled_at, status } = req.body || {}
    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return res.status(400).json({ error: 'Select at least one account' })
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' })
    }
    const initialStatus = status === 'draft' ? 'draft' : (scheduled_at ? 'scheduled' : 'queued')
    const result = await query(
      `INSERT INTO social_posts
         (account_ids, content, media_urls, scheduled_at, status, created_by_user_id)
       VALUES ($1::uuid[], $2, $3::jsonb, $4, $5, $6)
       RETURNING *`,
      [
        account_ids,
        content,
        JSON.stringify(media_urls || []),
        scheduled_at || null,
        initialStatus,
        req.user!.id,
      ]
    )
    res.json({ data: result.rows[0] })
    // Kick the scheduler immediately so "Post now" feels instant.
    if (initialStatus === 'queued') {
      processDuePosts().catch((e) => console.error('immediate publish error:', e))
    }
  } catch (err: any) {
    console.error('POST /posts error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.patch('/posts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { content, account_ids, media_urls, scheduled_at, status } = req.body || {}
    const fields: string[] = []
    const params: any[] = []
    let i = 1
    if (content !== undefined) { fields.push(`content = $${i++}`); params.push(content) }
    if (account_ids !== undefined) { fields.push(`account_ids = $${i++}::uuid[]`); params.push(account_ids) }
    if (media_urls !== undefined) { fields.push(`media_urls = $${i++}::jsonb`); params.push(JSON.stringify(media_urls)) }
    if (scheduled_at !== undefined) { fields.push(`scheduled_at = $${i++}`); params.push(scheduled_at) }
    if (status !== undefined) { fields.push(`status = $${i++}`); params.push(status) }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' })
    fields.push(`updated_at = NOW()`)
    params.push(req.params.id)
    const result = await query(
      `UPDATE social_posts SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )
    res.json({ data: result.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/posts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query(`DELETE FROM social_posts WHERE id = $1`, [req.params.id])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/posts/:id/publish', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query(
      `UPDATE social_posts SET status = 'queued', scheduled_at = NULL, updated_at = NOW()
       WHERE id = $1 AND status IN ('draft','scheduled','failed')`,
      [req.params.id]
    )
    res.json({ success: true })
    processDuePosts().catch((e) => console.error('immediate publish error:', e))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// Platform helpers — fetch the connected account profile and publish posts.
// These call each platform's public API directly with the OAuth access token.
// ---------------------------------------------------------------------------
async function fetchPlatformProfile(
  platform: Platform,
  accessToken: string
): Promise<{ display_name: string; platform_user_id: string; profile_url?: string; avatar_url?: string; metadata?: any }> {
  try {
    if (platform === 'facebook' || platform === 'instagram') {
      const r = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`)
      const j: any = await r.json()
      return {
        display_name: j.name || 'Facebook account',
        platform_user_id: j.id || `${platform}:unknown`,
        profile_url: j.id ? `https://facebook.com/${j.id}` : undefined,
      }
    }
    if (platform === 'linkedin') {
      const r = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const j: any = await r.json()
      return {
        display_name: j.name || j.email || 'LinkedIn account',
        platform_user_id: j.sub || `linkedin:unknown`,
        avatar_url: j.picture,
      }
    }
    if (platform === 'youtube') {
      const r = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const j: any = await r.json()
      const ch = j?.items?.[0]
      return {
        display_name: ch?.snippet?.title || 'YouTube channel',
        platform_user_id: ch?.id || `youtube:unknown`,
        profile_url: ch?.id ? `https://youtube.com/channel/${ch.id}` : undefined,
        avatar_url: ch?.snippet?.thumbnails?.default?.url,
      }
    }
    if (platform === 'tiktok') {
      const r = await fetch('https://open.tiktokapis.com/v2/user/info/', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const j: any = await r.json()
      const u = j?.data?.user
      return {
        display_name: u?.display_name || 'TikTok account',
        platform_user_id: u?.open_id || `tiktok:unknown`,
        avatar_url: u?.avatar_url,
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch ${platform} profile:`, err)
  }
  return { display_name: `${platform} account`, platform_user_id: `${platform}:${Date.now()}` }
}

async function publishToPlatform(
  account: any,
  content: string,
  mediaUrls: string[]
): Promise<{ ok: boolean; remote_id?: string; error?: string }> {
  const platform = account.platform as Platform
  const token = account.access_token
  try {
    if (platform === 'facebook') {
      // Posts to the page feed. The token must be a page access token; the
      // OAuth flow above returns a user token, which the admin can swap for a
      // page token via /me/accounts when wiring this up.
      const pageId = account.platform_user_id
      const url = `https://graph.facebook.com/v19.0/${pageId}/feed`
      const body = new URLSearchParams({ message: content, access_token: token })
      if (mediaUrls[0]) body.set('link', mediaUrls[0])
      const r = await fetch(url, { method: 'POST', body })
      const j: any = await r.json()
      if (!r.ok || j.error) return { ok: false, error: j.error?.message || 'Facebook publish failed' }
      return { ok: true, remote_id: j.id }
    }
    if (platform === 'instagram') {
      // Instagram Graph publishing is a two-step process: create container,
      // then publish. Requires a business/creator account and a linked FB page.
      const igUserId = account.platform_user_id
      if (!mediaUrls[0]) return { ok: false, error: 'Instagram posts require at least one image' }
      const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        body: new URLSearchParams({ image_url: mediaUrls[0], caption: content, access_token: token }),
      })
      const containerJson: any = await containerRes.json()
      if (!containerRes.ok || !containerJson.id) return { ok: false, error: containerJson.error?.message || 'IG container failed' }
      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: containerJson.id, access_token: token }),
      })
      const publishJson: any = await publishRes.json()
      if (!publishRes.ok || publishJson.error) return { ok: false, error: publishJson.error?.message || 'IG publish failed' }
      return { ok: true, remote_id: publishJson.id }
    }
    if (platform === 'linkedin') {
      const author = `urn:li:person:${account.platform_user_id}`
      const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: content },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok) return { ok: false, error: j.message || `LinkedIn HTTP ${r.status}` }
      return { ok: true, remote_id: j.id }
    }
    if (platform === 'youtube') {
      // YouTube needs an actual video file upload — Community posts are not in
      // the public API. We surface a clear error so the UI can prompt admins.
      return { ok: false, error: 'YouTube publishing requires a video upload — use Studio for community posts.' }
    }
    if (platform === 'tiktok') {
      if (!mediaUrls[0]) return { ok: false, error: 'TikTok posts require a video URL' }
      const r = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_info: { title: content.slice(0, 150), privacy_level: 'PUBLIC_TO_EVERYONE' },
          source_info: { source: 'PULL_FROM_URL', video_url: mediaUrls[0] },
        }),
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || j.error?.code) return { ok: false, error: j.error?.message || `TikTok HTTP ${r.status}` }
      return { ok: true, remote_id: j.data?.publish_id }
    }
    return { ok: false, error: 'Unsupported platform' }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error' }
  }
}

// ---------------------------------------------------------------------------
// Scheduler — every minute, pick up posts whose status is 'queued' or
// 'scheduled' with a due time and publish them to each selected account.
// Exported so server/index.ts can start the interval at boot.
// ---------------------------------------------------------------------------
let publishing = false
export async function processDuePosts() {
  if (publishing) return
  publishing = true
  try {
    const due = await query(
      `SELECT id, account_ids, content, media_urls, status
       FROM social_posts
       WHERE status = 'queued'
          OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW())
       ORDER BY COALESCE(scheduled_at, created_at) ASC
       LIMIT 25`
    )

    for (const post of due.rows) {
      await query(`UPDATE social_posts SET status = 'publishing', updated_at = NOW() WHERE id = $1`, [post.id])
      const accountsRes = await query(
        `SELECT * FROM social_accounts WHERE id = ANY($1::uuid[])`,
        [post.account_ids]
      )
      const results: Record<string, any> = {}
      let anyOk = false
      let anyFail = false
      const mediaUrls: string[] = Array.isArray(post.media_urls) ? post.media_urls : []
      for (const acc of accountsRes.rows) {
        const r = await publishToPlatform(acc, post.content, mediaUrls)
        results[acc.id] = { platform: acc.platform, ...r, at: new Date().toISOString() }
        if (r.ok) anyOk = true
        else anyFail = true
        if (!r.ok) {
          await query(
            `UPDATE social_accounts SET last_error = $1, updated_at = NOW() WHERE id = $2`,
            [r.error || 'publish failed', acc.id]
          )
        }
      }
      const finalStatus = anyOk && !anyFail ? 'published' : anyOk ? 'partial' : 'failed'
      await query(
        `UPDATE social_posts
         SET status = $1,
             published_at = CASE WHEN $1 IN ('published','partial') THEN NOW() ELSE published_at END,
             results = $2::jsonb,
             updated_at = NOW()
         WHERE id = $3`,
        [finalStatus, JSON.stringify(results), post.id]
      )
    }
  } catch (err) {
    console.error('processDuePosts error:', err)
  } finally {
    publishing = false
  }
}

export default router
