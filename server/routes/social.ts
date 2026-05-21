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

// Media URLs stored in the bank/posts are RELATIVE (`/api/storage/public/…`)
// so display survives any deploy environment, but external fetchers (Meta IG
// container, TikTok PULL_FROM_URL, Facebook link) need absolute URLs. Lift on
// the way out — leaves already-absolute URLs alone.
function toAbsoluteMediaUrl(u: string): string {
  if (/^https?:\/\//i.test(u)) return u
  const base = PUBLIC_BASE || 'https://app.gritsync.com'
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`
}

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
    // Full Marketing-API scope set: pages_* for posting, ads_* for managing
    // ad campaigns, business_management so we can look up which businesses
    // / ad accounts the connecting user has access to. These extra scopes
    // are gated by Meta's App Review for production — works out of the box
    // for the app admin while the app is in Development mode.
    scopes: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_manage_ads',
      'pages_manage_metadata',
      'ads_management',
      'ads_read',
      'business_management',
      'public_profile',
    ].join(','),
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
// GET /api/social/accounts/oauth-status
// Tells the UI which platforms have OAuth credentials configured on the
// server. Platforms missing creds can't use the "Connect" flow — the UI
// nudges users into Manual entry for those instead of letting the OAuth
// popup error out after a click.
// ---------------------------------------------------------------------------
router.get('/accounts/oauth-status', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  const status: Record<string, { oauth_ready: boolean; missing: string[] }> = {}
  for (const platform of PLATFORMS) {
    const cfg = PLATFORM_CONFIG[platform]
    const idSet = !!process.env[cfg.envIdKey]
    const secretSet = !!process.env[cfg.envSecretKey]
    const missing: string[] = []
    if (!idSet) missing.push(cfg.envIdKey)
    if (!secretSet) missing.push(cfg.envSecretKey)
    status[platform] = { oauth_ready: idSet && secretSet, missing }
  }
  res.json({ data: status })
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

    // Facebook gets a special path: we exchange the short-lived token for a
    // long-lived one (60d), then call /me/accounts to enumerate Pages (page
    // tokens are non-expiring while the user keeps the app installed) and
    // /me/adaccounts to list ad accounts the user can manage. We persist
    // one row per Page + a fb_user row that carries the long-lived user
    // token + the ad-account list for the Marketing API endpoints.
    if (platform === 'facebook') {
      await handleFacebookConnect({
        userId,
        shortLivedUserToken: accessToken,
        clientId,
        clientSecret,
        scopesCsv: cfg.scopes,
      })
    } else {
      // All other platforms — original single-row upsert.
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
    }

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
// Facebook OAuth — long-lived token + page enumeration + ad accounts.
//
// The short-lived token Meta returns from the authorization-code exchange
// is only valid for ~1 hour and CAN'T be refreshed. To keep the connection
// "permanent" we have to:
//   1. Exchange it for a long-lived user token (60-day TTL).
//   2. Call /me/accounts — page tokens minted from a long-lived user token
//      do NOT expire (per Meta's docs), so storing them gives us a
//      forever-token for posting to each Page.
//   3. Call /me/adaccounts to learn which ad accounts the user can manage,
//      stashed in metadata for the Marketing API endpoints below.
//
// We persist one row per Page (so the existing publish flow keeps working
// page-by-page) PLUS one synthetic "fb_user" row that holds the long-lived
// user token + the ad-account list — that token is what the Marketing API
// calls need (ads_management is granted at user level, not page level).
// ---------------------------------------------------------------------------
async function handleFacebookConnect(args: {
  userId: string
  shortLivedUserToken: string
  clientId: string
  clientSecret: string
  scopesCsv: string
}): Promise<void> {
  const { userId, shortLivedUserToken, clientId, clientSecret, scopesCsv } = args

  // 1. Exchange for long-lived user token.
  const longLived = await fbExchangeLongLived(shortLivedUserToken, clientId, clientSecret)
  const longTokenExpiresAt = longLived.expires_in
    ? new Date(Date.now() + longLived.expires_in * 1000)
    : null

  // 2. Get the user's id + name.
  const meRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(longLived.access_token)}`
  )
  const me: any = await meRes.json()
  if (!meRes.ok || !me.id) throw new Error(me.error?.message || 'Failed to fetch Facebook user profile')

  // 3. Fetch the user's Pages with their non-expiring page tokens.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category,tasks&limit=100&access_token=${encodeURIComponent(longLived.access_token)}`
  )
  const pagesJson: any = await pagesRes.json()
  if (!pagesRes.ok) throw new Error(pagesJson.error?.message || 'Failed to list Facebook pages')
  const pages: Array<{ id: string; name: string; access_token: string; category?: string; tasks?: string[] }> =
    pagesJson.data || []

  // 4. Fetch ad accounts the user can manage.
  const adAccountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=200&access_token=${encodeURIComponent(longLived.access_token)}`
  )
  const adAccountsJson: any = await adAccountsRes.json()
  // ad accounts is allowed to fail (user might not manage any) — log but
  // don't reject the connection.
  if (!adAccountsRes.ok) {
    console.warn('Facebook ad-account fetch failed:', adAccountsJson.error?.message)
  }
  const adAccounts: Array<{ id: string; account_id: string; name: string; account_status: number; currency?: string; timezone_name?: string }> =
    adAccountsJson.data || []

  // 5. Upsert the synthetic fb_user row that owns the long-lived user
  //    token + ad-account list. platform_user_id is prefixed with `fbuser:`
  //    so the publish flow's filter (which looks for normal page ids) skips
  //    it and only treats Pages as publish targets.
  await query(
    `INSERT INTO social_accounts
       (platform, display_name, platform_user_id, access_token, refresh_token,
        token_expires_at, scopes, metadata, status, connected_by_user_id, connected_at)
     VALUES ('facebook', $1, $2, $3, NULL, $4, $5, $6::jsonb, 'connected', $7, NOW())
     ON CONFLICT (platform, platform_user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           access_token = EXCLUDED.access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           scopes = EXCLUDED.scopes,
           metadata = EXCLUDED.metadata,
           status = 'connected',
           last_error = NULL,
           updated_at = NOW(),
           connected_at = NOW()`,
    [
      `${me.name} (Facebook user)`,
      `fbuser:${me.id}`,
      longLived.access_token,
      longTokenExpiresAt,
      scopesCsv,
      JSON.stringify({
        kind: 'fb_user',
        fb_user_id: me.id,
        fb_user_name: me.name,
        ad_accounts: adAccounts.map((a) => ({
          id: a.id,                  // e.g. "act_123"
          account_id: a.account_id,  // numeric id without the act_ prefix
          name: a.name,
          status: a.account_status,
          currency: a.currency,
          timezone: a.timezone_name,
        })),
        pages: pages.map((p) => ({ id: p.id, name: p.name })),
      }),
      userId,
    ]
  )

  // 6. Upsert one row per Page. Each row's access_token is the page token,
  //    which is what publishToPlatform() already expects.
  for (const page of pages) {
    await query(
      `INSERT INTO social_accounts
         (platform, display_name, platform_user_id, access_token,
          token_expires_at, scopes, metadata, status, connected_by_user_id, connected_at)
       VALUES ('facebook', $1, $2, $3, NULL, $4, $5::jsonb, 'connected', $6, NOW())
       ON CONFLICT (platform, platform_user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             access_token = EXCLUDED.access_token,
             token_expires_at = EXCLUDED.token_expires_at,
             scopes = EXCLUDED.scopes,
             metadata = EXCLUDED.metadata,
             status = 'connected',
             last_error = NULL,
             updated_at = NOW(),
             connected_at = NOW()`,
      [
        page.name,
        page.id,
        page.access_token,
        scopesCsv,
        JSON.stringify({
          kind: 'fb_page',
          page_id: page.id,
          page_name: page.name,
          category: page.category,
          tasks: page.tasks,
          fb_user_id: me.id,
        }),
        userId,
      ]
    )
  }
}

async function fbExchangeLongLived(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number; token_type?: string }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  })
  const r = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`)
  const j: any = await r.json()
  if (!r.ok || !j.access_token) {
    throw new Error(j.error?.message || j.error_description || 'Facebook long-lived token exchange failed')
  }
  return j
}

// ---------------------------------------------------------------------------
// GET /api/social/facebook/ad-accounts
// Returns the connected user's ad accounts + pages so the Ads UI can pick
// which combination to launch a campaign under.
// ---------------------------------------------------------------------------
router.get('/facebook/ad-accounts', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT metadata FROM social_accounts
       WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
       ORDER BY connected_at DESC LIMIT 1`
    )
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'No Facebook user connected yet' })
    }
    const m = r.rows[0].metadata || {}
    res.json({
      data: {
        ad_accounts: m.ad_accounts || [],
        pages: m.pages || [],
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/facebook/create-ad
// Launches a PAUSED Facebook ad from a Content Bank item. Creates the full
// campaign → ad set → ad creative → ad chain via the Marketing API.
//
// Body: {
//   bank_id: string,             // pulls caption + media_url
//   ad_account_id: string,       // e.g. "act_123"
//   page_id: string,             // owning Page
//   daily_budget_cents?: number, // defaults to 200 ($2.00)
//   objective?: string,          // defaults to 'OUTCOME_AWARENESS'
//   link_url?: string,           // defaults to https://gritsync.com/quote
//   headline?: string,
//   description?: string,
//   cta?: string,                // e.g. 'LEARN_MORE', defaults to 'LEARN_MORE'
// }
// Returns: { campaign_id, adset_id, creative_id, ad_id, status }
//
// All resources are created in PAUSED status so the operator can review in
// Meta Ads Manager before going live. They're deliberately NOT published —
// this is a draft-on-the-platform flow, not "spend money instantly".
// ---------------------------------------------------------------------------
router.post('/facebook/create-ad', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      bank_id,
      ad_account_id,
      page_id,
      daily_budget_cents = 200,
      objective = 'OUTCOME_AWARENESS',
      link_url = 'https://gritsync.com/quote',
      headline,
      description,
      cta = 'LEARN_MORE',
    } = req.body || {}

    if (!bank_id) return res.status(400).json({ error: 'bank_id is required' })
    if (!ad_account_id) return res.status(400).json({ error: 'ad_account_id is required' })
    if (!page_id) return res.status(400).json({ error: 'page_id is required' })

    // 1. Pull the bank item — we need its caption + media_url.
    const bankRes = await query(`SELECT id, caption, media_url FROM social_content_bank WHERE id = $1`, [bank_id])
    if (bankRes.rows.length === 0) return res.status(404).json({ error: 'Bank item not found' })
    const item = bankRes.rows[0]
    if (!item.media_url) return res.status(400).json({ error: 'Bank item has no image — generate one before launching an ad' })

    // 2. Pull the long-lived user token (ads_management is user-level).
    const tokenRes = await query(
      `SELECT access_token FROM social_accounts
       WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
       ORDER BY connected_at DESC LIMIT 1`
    )
    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ error: 'Connect Facebook first (Accounts tab)' })
    }
    const userToken: string = tokenRes.rows[0].access_token

    const acct = ad_account_id.startsWith('act_') ? ad_account_id : `act_${ad_account_id}`
    const graph = (path: string) => `https://graph.facebook.com/v19.0/${path}`

    // Helper: POST form-encoded to Graph API. Surfaces error messages.
    const post = async (path: string, body: Record<string, any>): Promise<any> => {
      const formBody = new URLSearchParams()
      for (const [k, v] of Object.entries(body)) {
        formBody.set(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
      formBody.set('access_token', userToken)
      const r = await fetch(graph(path), { method: 'POST', body: formBody })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(`Meta ${path}: ${j.error?.message || `HTTP ${r.status}`}`)
      return j
    }

    // 3. Campaign — top-level container.
    const campaign = await post(`${acct}/campaigns`, {
      name: `GritSync · ${new Date().toISOString().slice(0, 10)} · ${(item.caption || '').slice(0, 40)}`,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
    })

    // 4. Ad set — targeting, budget, schedule. Defaults to broad PH + US,
    //    age 22-55, all genders. Operator can tune in Ads Manager.
    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const adset = await post(`${acct}/adsets`, {
      name: `${campaign.id} default adset`,
      campaign_id: campaign.id,
      daily_budget: daily_budget_cents,
      billing_event: 'IMPRESSIONS',
      optimization_goal: objective === 'OUTCOME_AWARENESS' ? 'REACH' : 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      start_time: startTime,
      targeting: {
        geo_locations: { countries: ['PH', 'US'] },
        age_min: 22,
        age_max: 55,
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed'],
        instagram_positions: ['stream', 'story', 'reels'],
      },
      status: 'PAUSED',
    })

    // 5. Ad creative — links the Page + image (Drive URL or our /api/storage URL).
    const mediaUrl = item.media_url.startsWith('http')
      ? item.media_url
      : `${PUBLIC_BASE || 'https://app.gritsync.com'}${item.media_url}`
    const creative = await post(`${acct}/adcreatives`, {
      name: `${campaign.id} creative`,
      object_story_spec: {
        page_id,
        link_data: {
          message: item.caption || '',
          link: link_url,
          name: headline || 'Start your NCLEX journey with GritSync',
          description: description || 'NCLEX application processing for Filipino nurses → USRN.',
          picture: mediaUrl,
          call_to_action: { type: cta, value: { link: link_url } },
        },
      },
    })

    // 6. Ad — binds the ad set to the creative.
    const ad = await post(`${acct}/ads`, {
      name: `${campaign.id} ad`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    })

    res.json({
      data: {
        campaign_id: campaign.id,
        adset_id: adset.id,
        creative_id: creative.id,
        ad_id: ad.id,
        status: 'PAUSED',
        manage_url: `https://www.facebook.com/adsmanager/manage/campaigns?act=${acct.replace(/^act_/, '')}&selected_campaign_ids=${campaign.id}`,
      },
    })
  } catch (err: any) {
    console.error('create-ad error:', err)
    res.status(500).json({ error: err.message || 'Failed to create Facebook ad' })
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
  mediaUrlsRaw: string[]
): Promise<{ ok: boolean; remote_id?: string; error?: string }> {
  const platform = account.platform as Platform
  const token = account.access_token
  // Every consumer below talks to a remote network that fetches media from
  // the public internet — lift relative paths to absolute before forwarding.
  const mediaUrls = mediaUrlsRaw.map(toAbsoluteMediaUrl)
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
let socialPostsTableMissing = false
export async function processDuePosts() {
  if (publishing || socialPostsTableMissing) return
  publishing = true
  try {
    const due = await query(
      `SELECT id, account_ids, content, media_urls, status
       FROM social_posts
       WHERE status = 'queued'
          OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW())
       ORDER BY COALESCE(scheduled_at, created_at) ASC
       LIMIT 25`
    ).catch((err: any) => {
      if (err?.code === '42P01') {
        socialPostsTableMissing = true
        console.warn('[social] social_posts table missing — scheduler disabled until migration is applied')
        return null
      }
      throw err
    })
    if (!due) { publishing = false; return }

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
