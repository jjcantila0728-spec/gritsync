import { Router } from 'express'
import { query } from '../db'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { fbGet, fbPost, hoursSince, STANDARD_MESSAGING_WINDOW_HOURS } from './social-meta'

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

const PLATFORMS = ['facebook', 'instagram', 'threads', 'linkedin', 'youtube', 'tiktok'] as const
type Platform = (typeof PLATFORMS)[number]

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://app.gritsync.com').replace(/\/$/, '')

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
    authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    // ONE OAuth covers Facebook Pages + Instagram Business + Marketing API.
    // The IG card on the Accounts tab delegates to this same flow, so the
    // scope set has to include the IG content-publishing perms — without
    // them the page access token cannot POST to /{ig-user-id}/media even
    // though we can READ the linked IG account from /me/accounts.
    //   pages_* — Facebook Pages API (posting, engagement, metadata).
    //   instagram_basic / instagram_content_publish — required for the IG
    //     Content Publishing API two-step container + media_publish.
    //   ads_* / business_management — Marketing API + business lookup.
    scopes: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_manage_ads',
      'pages_manage_metadata',
      // Insights API + Inbox + Comment moderation. The Manager tab's
      // analytics card uses read_insights; AutoReply needs pages_messaging
      // (Inbox replies) and pages_manage_engagement (reply/hide/like FB
      // comments). instagram_manage_comments + instagram_manage_insights
      // unlock the IG side of those same flows through the page token.
      'read_insights',
      'pages_messaging',
      'pages_manage_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'instagram_manage_messages',
      // Groups tab. user_managed_groups is the only scope Meta still
      // grants for listing groups the user admins; it requires app review
      // for non-dev users but works immediately for the app's developers /
      // admins / testers.
      'user_managed_groups',
      'ads_management',
      'ads_read',
      'business_management',
      'public_profile',
    ].join(','),
    envIdKey: 'FACEBOOK_APP_ID',
    envSecretKey: 'FACEBOOK_APP_SECRET',
    // Force Meta to re-show the consent dialog when scopes change. Without
    // this, a returning user with an older token may get auto-redirected
    // back without ever seeing the new permissions, leaving the token
    // stuck on the old scope set.
    extraAuthParams: { auth_type: 'rerequest' },
  },
  instagram: {
    // Direct Instagram Login flow (separate Meta app from the Facebook
    // one — uses Instagram's own OAuth at instagram.com, not facebook.com,
    // and the newer `instagram_business_*` scope set). Tokens here are
    // Instagram user tokens; publishing uses graph.instagram.com — see
    // handleInstagramDirectConnect + the IG branch of publishToPlatform.
    //
    // Required env vars (separate app, separate client):
    //   INSTAGRAM_APP_ID      — your IG app's client_id
    //   INSTAGRAM_APP_SECRET  — your IG app's client secret
    authUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: [
      'instagram_business_basic',
      'instagram_business_content_publish',
      'instagram_business_manage_comments',
      'instagram_business_manage_messages',
      'instagram_business_manage_insights',
    ].join(','),
    envIdKey: 'INSTAGRAM_APP_ID',
    envSecretKey: 'INSTAGRAM_APP_SECRET',
    // force_reauth=true makes Meta re-show the consent dialog every time,
    // which is what we want when adding scopes or switching accounts.
    extraAuthParams: { force_reauth: 'true' },
  },
  threads: {
    // Threads is a separate Meta app from the Facebook/Instagram one — it
    // has its own App ID / Secret and its own OAuth host (threads.net, not
    // facebook.com). Long-lived tokens are 60 days and refreshable via
    // /access_token?grant_type=th_refresh_token, same shape as IG Basic.
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies',
    envIdKey: 'THREADS_APP_ID',
    envSecretKey: 'THREADS_APP_SECRET',
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

// Build the OAuth callback URL the platform should redirect back to.
//
// Critical: this URL MUST match exactly between the authorization-code
// step (where we send `redirect_uri` to the platform's authorize URL)
// and the token-exchange step (where we send the same `redirect_uri`
// with the code). If the two differ, Meta / LinkedIn / TikTok will
// reject the exchange.
//
// Why does it take `req`? On Vercel, PUBLIC_BASE_URL is often unset,
// and a module-init constant would default to `http://localhost:5173`
// — which then ends up in the redirect_uri we send to Meta, which
// then refuses to redirect back. Deriving from the incoming request's
// proto + host gives us the right scheme/host on every deploy with
// zero env-var configuration.
function callbackUrl(req: any, platform: Platform) {
  const base = publicBaseFromReq(req)
  return `${base}/api/social/oauth/${platform}/callback`
}

function publicBaseFromReq(req: any): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  const proto = (req?.headers?.['x-forwarded-proto'] as string) || req?.protocol || 'https'
  const host = req?.headers?.host
  return host ? `${proto}://${host}` : 'https://app.gritsync.com'
}

// ---------------------------------------------------------------------------
// GET /api/social/accounts
// ---------------------------------------------------------------------------
router.get('/accounts', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    // Exclude the synthetic `fbuser:<id>` row — it carries the long-lived
    // user token + ad-account list for Marketing-API calls, but it's not a
    // publishable destination. The Meta connection card shows its state
    // separately via /facebook/connection-status.
    const result = await query(
      `SELECT id, platform, display_name, profile_url, avatar_url, status,
              platform_user_id, scopes, metadata, connected_at, token_expires_at,
              last_error
       FROM social_accounts
       WHERE platform_user_id NOT LIKE 'fbuser:%'
         AND status <> 'revoked'
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
// Meta webhook callback — single endpoint that handles Facebook, Instagram,
// and Threads webhook subscriptions. Meta uses the same protocol for all
// three:
//   GET  ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
//        → echo back hub.challenge as text/plain when the token matches
//   POST { object: 'instagram'|'page'|'threads', entry: [...] }
//        → ack with 200 quickly; process events async
//
// Mounted at /api/social/webhooks/:platform so the same handler covers
// every product page in Meta's App Dashboard:
//   - Instagram:  https://app.gritsync.com/api/social/webhooks/instagram
//   - Facebook:   https://app.gritsync.com/api/social/webhooks/facebook
//   - Threads:    https://app.gritsync.com/api/social/webhooks/threads
//
// Verify token: pick any random string and set it as META_WEBHOOK_VERIFY_TOKEN
// in Vercel env vars. Paste the SAME string into the "Verify token" field
// in Meta's webhook config.
// ---------------------------------------------------------------------------
function metaWebhookVerifyToken(): string {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || 'gritsync-meta-webhook'
}

router.get('/webhooks/:platform', (req, res) => {
  // Use URLSearchParams to parse — qs (Express default) may expand dots into
  // nested objects ({hub:{mode:...}}) depending on version/config, while
  // URLSearchParams always treats dots as literal characters in param names.
  const params = new URLSearchParams(req.url.split('?')[1] || '')
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')
  if (mode === 'subscribe' && token === metaWebhookVerifyToken()) {
    res.set('content-type', 'text/plain').status(200).send(String(challenge || ''))
    return
  }
  console.warn('[meta-webhook] verification rejected', { mode, tokenMatches: token === metaWebhookVerifyToken() })
  res.sendStatus(403)
})

router.post('/webhooks/:platform', (req, res) => {
  // ACK immediately — Meta drops the webhook if we don't respond within 20s.
  // On Vercel Fluid Compute the function stays alive after res.sendStatus()
  // so all the async processing below completes even though the HTTP response
  // is already sent.
  res.sendStatus(200)
  const platform = req.params.platform as 'facebook' | 'instagram'
  const body = req.body
  if (!body?.entry) return
  processWebhookEntries(platform, body.entry).catch((err) =>
    console.error('[meta-webhook] processing error:', err)
  )
})

// ── Real-time webhook processor ───────────────────────────────────────────
// Called after we ack the webhook. Handles inbound DMs (Mika) and new
// comments (Kuya Jay). Uses the same logic as the autopilot runners but
// fires per-event instead of in batch so responses land within seconds.
async function processWebhookEntries(platform: 'facebook' | 'instagram', entries: any[]) {
  const { handleMikaQuoteTurn } = await import('../lib/mika-quote')
  const { findCachedReply } = await import('../lib/social-autopilot')
  const { draftReply } = await import('./social-meta')

  for (const entry of entries) {
    const pageId = String(entry.id || '')

    // Look up the connected account for this page once per entry.
    const acc = await query(
      `SELECT id, access_token, platform, platform_user_id, metadata
         FROM social_accounts
        WHERE platform_user_id = $1
          AND status = 'connected'
        LIMIT 1`,
      [pageId]
    ).then((r) => r.rows[0] || null).catch(() => null)

    // ── Inbound DMs (Facebook & Instagram messaging events) ─────────────
    for (const evt of entry.messaging || []) {
      if (!evt.message || evt.message.is_echo) continue   // skip our own sent msgs
      const senderId: string = evt.sender?.id || ''
      const text = String(evt.message?.text || '').trim()
      const hasImage = !!(evt.message?.attachments?.data?.some(
        (a: any) => a.type === 'image'
      ))
      if (!senderId || senderId === pageId) continue
      if (!acc) continue

      // 24h window check using the event timestamp
      const eventIso = evt.timestamp ? new Date(evt.timestamp).toISOString() : null
      if (hoursSince(eventIso) > STANDARD_MESSAGING_WINDOW_HOURS) continue

      // Fetch the full conversation thread so the quote-turn LLM has context.
      let threadId: string | null = null
      let recent: Array<{ from: 'user' | 'mika'; text: string }> = []
      try {
        const convRes = await fbGet(`${pageId}/conversations`, acc.access_token, {
          user_id: senderId,
          fields: 'id,messages{from,message,created_time}',
          limit: '1',
        })
        const thread = convRes.data?.[0]
        if (thread) {
          threadId = thread.id
          recent = (thread.messages?.data || []).map((m: any) => ({
            from: (m.from?.id === pageId ? 'mika' : 'user') as 'user' | 'mika',
            text: String(m.message || ''),
          })).reverse()
        }
      } catch { /* use empty history if the fetch fails */ }

      try {
        const turn = await handleMikaQuoteTurn({
          thread_id: threadId || `psid:${senderId}`,
          account_id: acc.id,
          conversation: recent,
          inbound: text || '(image)',
          inbound_message_id: evt.message?.mid || null,
        }).catch(async () => {
          // Fall back to simple cached/drafted reply on quote-turn failure.
          const cached = await findCachedReply('inbox', text).catch(() => null)
          const reply = cached?.reply || await draftReply({
            agent: 'inbox', message: text, has_inbound_image: hasImage,
          })
          return { reply, status: 'chat' as const }
        })

        if (!turn?.reply) continue
        const baseId = acc.platform === 'instagram'
          ? (acc.metadata?.linked_page_id || pageId) : pageId

        try { await fbPost(`${baseId}/messages`, acc.access_token, { recipient: { id: senderId }, sender_action: 'typing_on' }) } catch {}
        await new Promise((r) => setTimeout(r, Math.min(2500, 500 + turn.reply.length * 20)))
        await fbPost(`${baseId}/messages`, acc.access_token, {
          recipient: { id: senderId },
          message: { text: turn.reply },
          messaging_type: 'RESPONSE',
        })
        try { await fbPost(`${baseId}/messages`, acc.access_token, { recipient: { id: senderId }, sender_action: 'typing_off' }) } catch {}

        console.log(`[meta-webhook] Mika replied to ${senderId} on page ${pageId}`)
      } catch (err: any) {
        console.error(`[meta-webhook] Mika reply error for ${senderId}:`, err.message)
      }
    }

    // ── Facebook Page comment events ─────────────────────────────────────
    for (const change of entry.changes || []) {
      if (change.field !== 'feed') continue
      const val = change.value || {}
      if (val.item !== 'comment' || val.verb !== 'add') continue
      if (val.from?.id === pageId) continue  // skip our own comments
      if (!acc || acc.platform !== 'facebook') continue

      const commentId: string = val.comment_id || ''
      const text = String(val.message || '').trim()
      const postCaption = String(val.post?.message || '').slice(0, 240)
      if (!commentId || !text) continue

      try {
        const cached = await findCachedReply('comments', text).catch(() => null)
        const reply = cached?.reply || await draftReply({
          agent: 'comments', message: text, post_caption: postCaption,
        })
        if (!reply) continue
        await fbPost(`${commentId}/comments`, acc.access_token, { message: reply })
        console.log(`[meta-webhook] Kuya Jay replied to comment ${commentId}`)
      } catch (err: any) {
        console.error(`[meta-webhook] Kuya Jay reply error for ${commentId}:`, err.message)
      }
    }
  }
}

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
      redirect_uri: callbackUrl(req, platform),
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
      // Must match the redirect_uri sent at /oauth/:platform/start exactly
      // — both are derived from the same request-host helper, so they
      // stay in sync even when PUBLIC_BASE_URL isn't set on Vercel.
      redirect_uri: callbackUrl(req, platform),
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
    } else if (platform === 'instagram') {
      // Direct Instagram Login flow: the short-lived IG user token from
      // api.instagram.com → exchanged for a 60-day long-lived token at
      // graph.instagram.com → profile fetch → upsert as an IG row.
      // The token carries instagram_business_* scopes and publishing
      // hits graph.instagram.com (NOT graph.facebook.com).
      await handleInstagramDirectConnect({
        userId,
        shortLivedUserToken: accessToken,
        // Instagram's token-exchange response includes the user_id at the
        // top level — pass it through so we don't need a second profile call.
        igUserIdFromExchange: tokenJson.user_id ? String(tokenJson.user_id) : null,
        clientSecret,
        scopesCsv: cfg.scopes,
      })
    } else if (platform === 'threads') {
      // Threads also gets a long-lived exchange. We exchange the 1-hour
      // short token for a 60-day token, then fetch the user's profile so
      // the UI has a username to display.
      await handleThreadsConnect({
        userId,
        shortLivedUserToken: accessToken,
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
    const { account_ids, content, media_urls, scheduled_at, status, bank_id } = req.body || {}
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

    // If this post was created from a Content Bank item, mark the bank
    // row as 'used' so it disappears from the Bank tab. The post itself
    // (with the same caption + media) carries it forward into History.
    if (bank_id && typeof bank_id === 'string') {
      try {
        await query(
          `UPDATE social_content_bank
              SET status = 'used', updated_at = NOW()
            WHERE id = $1`,
          [bank_id]
        )
      } catch (e: any) {
        console.warn('Failed to mark bank item as used:', e.message)
      }
    }
    // "Post now" runs the scheduler INLINE and awaits it. On Vercel
    // serverless, firing it after res.json() is unreliable — the function
    // instance can be killed the moment the response is sent, leaving
    // queued rows that never publish. Awaiting keeps the publish work
    // within the function's lifetime (well under the 300s maxDuration).
    if (initialStatus === 'queued') {
      try {
        await processDuePosts()
      } catch (e: any) {
        console.error('immediate publish error:', e)
      }
      // Re-read the row so the response includes the final status +
      // per-account results, not the original 'queued' snapshot.
      const fresh = await query(
        `SELECT * FROM social_posts WHERE id = $1`,
        [result.rows[0].id]
      )
      return res.json({ data: fresh.rows[0] || result.rows[0] })
    }
    res.json({ data: result.rows[0] })
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
    // 'partial' is included so the Retry button in History can re-queue a
    // post that succeeded on some accounts but failed on others. The
    // publisher overwrites results wholesale, so a retry re-attempts every
    // account — including the ones that already succeeded.
    await query(
      `UPDATE social_posts SET status = 'queued', scheduled_at = NULL, updated_at = NOW()
       WHERE id = $1 AND status IN ('draft','scheduled','failed','partial')`,
      [req.params.id]
    )
    // Await the publisher inline so the function instance stays alive
    // through the Facebook/IG Graph API calls. Firing after res.json()
    // is unreliable on Vercel — see POST /posts above for the same fix.
    try {
      await processDuePosts()
    } catch (e: any) {
      console.error('immediate publish error:', e)
    }
    res.json({ success: true })
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
    `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${encodeURIComponent(longLived.access_token)}`
  )
  const me: any = await meRes.json()
  if (!meRes.ok || !me.id) throw new Error(me.error?.message || 'Failed to fetch Facebook user profile')

  // 3. Fetch the user's Pages with their non-expiring page tokens. We also
  //    ask for `instagram_business_account` so we can persist linked IG
  //    accounts in the same connect flow — IG publishes through the FB
  //    page token, not its own.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,category,tasks,picture{url},instagram_business_account{id,username,name,profile_picture_url}&limit=100&access_token=${encodeURIComponent(longLived.access_token)}`
  )
  const pagesJson: any = await pagesRes.json()
  if (!pagesRes.ok) throw new Error(pagesJson.error?.message || 'Failed to list Facebook pages')
  const allPages: Array<{
    id: string
    name: string
    access_token: string
    category?: string
    tasks?: string[]
    picture?: { data?: { url?: string } } | { url?: string }
    instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string }
  }> = pagesJson.data || []

  // Filter to only the Pages the user actually authorized in this OAuth
  // consent. /me/accounts returns every Page they have a role on, so
  // without this filter we'd surface (and persist) Pages the user
  // explicitly deselected on the page-picker step.
  const grantedPageIds = await fbGetGrantedPageIds(longLived.access_token, clientId, clientSecret)
  const pages = grantedPageIds
    ? allPages.filter((p) => grantedPageIds.has(String(p.id)))
    : allPages

  // 4. Fetch ad accounts the user can manage.
  const adAccountsRes = await fetch(
    `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=200&access_token=${encodeURIComponent(longLived.access_token)}`
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
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          instagram_business_account: p.instagram_business_account
            ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username }
            : null,
        })),
        instagram_accounts: pages
          .filter((p) => p.instagram_business_account)
          .map((p) => ({
            id: p.instagram_business_account!.id,
            username: p.instagram_business_account!.username,
            name: p.instagram_business_account!.name,
            avatar_url: p.instagram_business_account!.profile_picture_url,
            linked_page_id: p.id,
            linked_page_name: p.name,
          })),
        long_lived_token_expires_at: longTokenExpiresAt,
      }),
      userId,
    ]
  )

  // 6. Upsert one row per Page. Each row's access_token is the page token,
  //    which is what publishToPlatform() already expects. We also upsert
  //    one row per linked Instagram Business account using the SAME page
  //    token (IG publishes through the FB Page token, not its own).
  for (const page of pages) {
    const pagePicture = (page as any).picture?.data?.url || (page as any).picture?.url || null
    await query(
      `INSERT INTO social_accounts
         (platform, display_name, platform_user_id, access_token,
          token_expires_at, scopes, metadata, avatar_url,
          status, connected_by_user_id, connected_at)
       VALUES ('facebook', $1, $2, $3, NULL, $4, $5::jsonb, $6, 'connected', $7, NOW())
       ON CONFLICT (platform, platform_user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             access_token = EXCLUDED.access_token,
             token_expires_at = EXCLUDED.token_expires_at,
             scopes = EXCLUDED.scopes,
             metadata = EXCLUDED.metadata,
             avatar_url = EXCLUDED.avatar_url,
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
          instagram_business_account_id: page.instagram_business_account?.id || null,
        }),
        pagePicture,
        userId,
      ]
    )

    // If this Page has a linked IG Business account, persist it as an
    // Instagram row so the existing publish-to-IG flow (and the Connected
    // Accounts list) sees it. The access_token is the SAME FB Page token
    // — IG Graph API requires the page token for /media + /media_publish.
    if (page.instagram_business_account) {
      const ig = page.instagram_business_account
      await query(
        `INSERT INTO social_accounts
           (platform, display_name, platform_user_id, access_token,
            token_expires_at, scopes, metadata, avatar_url,
            status, connected_by_user_id, connected_at)
         VALUES ('instagram', $1, $2, $3, NULL, $4, $5::jsonb, $6, 'connected', $7, NOW())
         ON CONFLICT (platform, platform_user_id) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               access_token = EXCLUDED.access_token,
               token_expires_at = EXCLUDED.token_expires_at,
               scopes = EXCLUDED.scopes,
               metadata = EXCLUDED.metadata,
               avatar_url = EXCLUDED.avatar_url,
               status = 'connected',
               last_error = NULL,
               updated_at = NOW(),
               connected_at = NOW()`,
        [
          ig.username ? `@${ig.username}` : (ig.name || `IG ${ig.id}`),
          ig.id,
          page.access_token,
          'instagram_basic,instagram_content_publish',
          JSON.stringify({
            kind: 'ig_business',
            ig_user_id: ig.id,
            ig_username: ig.username,
            ig_name: ig.name,
            linked_page_id: page.id,
            linked_page_name: page.name,
            fb_user_id: me.id,
          }),
          ig.profile_picture_url || null,
          userId,
        ]
      )
    }
  }

  // Revoke any Pages (and their linked IG accounts) we previously
  // stored under this FB user that the user did NOT re-authorize this
  // round. Without this, deselecting a Page on a fresh OAuth grant
  // leaves stale 'connected' rows in the DB and they keep showing up
  // in the UI's "Authorized pages" list.
  if (grantedPageIds) {
    const authorizedIds = pages.map((p) => p.id)
    const authorizedIgIds = pages
      .map((p) => p.instagram_business_account?.id)
      .filter((x): x is string => !!x)

    // Mark stale FB Page rows tied to this fb_user_id as revoked.
    await query(
      `UPDATE social_accounts
          SET status = 'revoked',
              last_error = 'Not re-authorized in latest OAuth grant',
              updated_at = NOW()
        WHERE platform = 'facebook'
          AND platform_user_id NOT LIKE 'fbuser:%'
          AND metadata->>'fb_user_id' = $1
          AND ($2::text[] = '{}'::text[] OR NOT (platform_user_id = ANY($2::text[])))`,
      [me.id, authorizedIds]
    )

    // Mark stale IG rows that were linked through this fb_user_id.
    await query(
      `UPDATE social_accounts
          SET status = 'revoked',
              last_error = 'Linked FB Page not re-authorized in latest OAuth grant',
              updated_at = NOW()
        WHERE platform = 'instagram'
          AND metadata->>'fb_user_id' = $1
          AND ($2::text[] = '{}'::text[] OR NOT (platform_user_id = ANY($2::text[])))`,
      [me.id, authorizedIgIds]
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
  const r = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${params.toString()}`)
  const j: any = await r.json()
  if (!r.ok || !j.access_token) {
    throw new Error(j.error?.message || j.error_description || 'Facebook long-lived token exchange failed')
  }
  return j
}

// Read granular_scopes via /debug_token to learn which Pages the user
// actually granted to our app during the consent flow. /me/accounts
// returns every Page the user has a role on regardless of consent, so
// without this filter we surface Pages the user explicitly deselected.
//
// Returns the union of target_ids across every pages_* scope. Returns
// null when the token has no granular_scopes block (older app config
// without granular permissions) — caller treats that as "no filtering".
async function fbGetGrantedPageIds(
  userAccessToken: string,
  clientId: string,
  clientSecret: string
): Promise<Set<string> | null> {
  try {
    const appAccessToken = `${clientId}|${clientSecret}`
    const r = await fetch(
      `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
    )
    const j: any = await r.json()
    if (!r.ok) {
      console.warn('debug_token failed:', j.error?.message)
      return null
    }
    const granular: Array<{ scope: string; target_ids?: string[] }> = j.data?.granular_scopes || []
    if (!granular.length) return null
    const granted = new Set<string>()
    let sawPageScope = false
    for (const gs of granular) {
      if (!gs.scope?.startsWith('pages_')) continue
      sawPageScope = true
      for (const tid of gs.target_ids || []) granted.add(String(tid))
    }
    // A pages_* scope with NO target_ids means "all pages" (the user
    // granted the scope without restricting it). Don't filter in that
    // case — fall back to /me/accounts as-is.
    if (!sawPageScope) return null
    if (granted.size === 0) return null
    return granted
  } catch (err: any) {
    console.warn('fbGetGrantedPageIds failed:', err.message)
    return null
  }
}

// ---------------------------------------------------------------------------
// Threads connection — long-lived exchange + profile fetch.
//
// Differences from Facebook:
//   - Different host (graph.threads.net, not graph.facebook.com).
//   - Long-lived exchange uses grant_type=th_exchange_token (not
//     fb_exchange_token) and requires client_secret AS A QUERY PARAM
//     (not the short-lived token's app secret) per the Threads API spec.
//   - There's no "Pages" layer — each connection is one Threads user.
//   - Refresh works the same: GET /refresh_access_token?grant_type=th_refresh_token.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Instagram direct OAuth — short → long-lived exchange + profile fetch.
//
// Differences from the FB-driven IG flow:
//   - Token lives on graph.instagram.com (NOT graph.facebook.com).
//   - One-step: each connect grants exactly ONE IG Business/Creator account.
//   - Long-lived exchange uses ?grant_type=ig_exchange_token (60 days).
//   - Refreshable via /refresh_access_token?grant_type=ig_refresh_token.
//
// Stored rows are tagged metadata.kind='ig_direct' so publishToPlatform
// dispatches them to the graph.instagram.com endpoints instead of the
// graph.facebook.com Page-token endpoints used by ig_business rows.
// ---------------------------------------------------------------------------
async function handleInstagramDirectConnect(args: {
  userId: string
  shortLivedUserToken: string
  igUserIdFromExchange: string | null
  clientSecret: string
  scopesCsv: string
}): Promise<void> {
  const { userId, shortLivedUserToken, igUserIdFromExchange, clientSecret, scopesCsv } = args

  // 1. Short → long-lived exchange (60-day TTL).
  const exchangeUrl =
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token` +
    `&client_secret=${encodeURIComponent(clientSecret)}` +
    `&access_token=${encodeURIComponent(shortLivedUserToken)}`
  const exchangeRes = await fetch(exchangeUrl)
  const exchangeJson: any = await exchangeRes.json().catch(() => ({}))
  if (!exchangeRes.ok || !exchangeJson.access_token) {
    throw new Error(exchangeJson.error?.message || exchangeJson.error_message || 'Instagram long-lived token exchange failed')
  }
  const longLivedToken: string = exchangeJson.access_token
  const longTokenExpiresAt = exchangeJson.expires_in
    ? new Date(Date.now() + Number(exchangeJson.expires_in) * 1000)
    : null

  // 2. Fetch the IG user profile so the UI has a username + picture.
  const meRes = await fetch(
    `https://graph.instagram.com/v20.0/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${encodeURIComponent(longLivedToken)}`
  )
  const me: any = await meRes.json().catch(() => ({}))
  if (!meRes.ok || !me.user_id) {
    // Fallback to the user_id Instagram returned in the token exchange.
    if (!igUserIdFromExchange) {
      throw new Error(me.error?.message || 'Failed to fetch Instagram profile')
    }
    me.user_id = igUserIdFromExchange
    me.username = me.username || null
  }

  const displayName = me.username ? `@${me.username}` : (me.name || `IG ${me.user_id}`)
  const profileUrl = me.username ? `https://www.instagram.com/${me.username}` : null

  // 3. Upsert. platform_user_id is the IG user id (graph.instagram.com calls
  //    use this as the {ig-user-id} path component for /media + /media_publish).
  await query(
    `INSERT INTO social_accounts
       (platform, display_name, platform_user_id, access_token, refresh_token,
        token_expires_at, profile_url, avatar_url, scopes, metadata,
        status, connected_by_user_id, connected_at)
     VALUES ('instagram', $1, $2, $3, NULL, $4, $5, $6, $7, $8::jsonb, 'connected', $9, NOW())
     ON CONFLICT (platform, platform_user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           access_token = EXCLUDED.access_token,
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
      displayName,
      String(me.user_id),
      longLivedToken,
      longTokenExpiresAt,
      profileUrl,
      me.profile_picture_url || null,
      scopesCsv,
      JSON.stringify({
        kind: 'ig_direct',
        ig_user_id: String(me.user_id),
        ig_username: me.username || null,
        account_type: me.account_type || null,
        long_lived_token_expires_at: longTokenExpiresAt,
      }),
      userId,
    ]
  )
}

async function handleThreadsConnect(args: {
  userId: string
  shortLivedUserToken: string
  clientSecret: string
  scopesCsv: string
}): Promise<void> {
  const { userId, shortLivedUserToken, clientSecret, scopesCsv } = args

  // 1. Short → long-lived exchange (60-day token).
  const exchangeParams = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedUserToken,
  })
  const exchangeRes = await fetch(`https://graph.threads.net/access_token?${exchangeParams.toString()}`)
  const exchangeJson: any = await exchangeRes.json()
  if (!exchangeRes.ok || !exchangeJson.access_token) {
    throw new Error(exchangeJson.error?.message || exchangeJson.error_description || 'Threads long-lived token exchange failed')
  }
  const longLivedToken: string = exchangeJson.access_token
  const longTokenExpiresAt = exchangeJson.expires_in
    ? new Date(Date.now() + Number(exchangeJson.expires_in) * 1000)
    : null

  // 2. Fetch the user's profile so the UI has a username/avatar to show.
  const meRes = await fetch(
    `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${encodeURIComponent(longLivedToken)}`
  )
  const me: any = await meRes.json()
  if (!meRes.ok || !me.id) {
    throw new Error(me.error?.message || 'Failed to fetch Threads profile')
  }

  await query(
    `INSERT INTO social_accounts
       (platform, display_name, platform_user_id, access_token, refresh_token,
        token_expires_at, profile_url, avatar_url, scopes, metadata,
        status, connected_by_user_id, connected_at)
     VALUES ('threads', $1, $2, $3, NULL, $4, $5, $6, $7, $8::jsonb, 'connected', $9, NOW())
     ON CONFLICT (platform, platform_user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           access_token = EXCLUDED.access_token,
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
      me.username ? `@${me.username}` : (me.name || `Threads ${me.id}`),
      me.id,
      longLivedToken,
      longTokenExpiresAt,
      me.username ? `https://www.threads.net/@${me.username}` : null,
      me.threads_profile_picture_url || null,
      scopesCsv,
      JSON.stringify({
        kind: 'threads_user',
        threads_user_id: me.id,
        threads_username: me.username,
        threads_name: me.name,
        long_lived_token_expires_at: longTokenExpiresAt,
      }),
      userId,
    ]
  )
}

// POST /api/social/threads/refresh-token
// 60-day long-lived tokens can be refreshed before expiry via a single
// GET — same pattern as the Meta refresh flow.
router.post('/threads/refresh-token', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT id, access_token, metadata FROM social_accounts
       WHERE platform = 'threads'
       ORDER BY connected_at DESC LIMIT 1`
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'No Threads connection to refresh' })

    const cur = r.rows[0]
    const refreshParams = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: cur.access_token,
    })
    const refreshRes = await fetch(`https://graph.threads.net/refresh_access_token?${refreshParams.toString()}`)
    const refreshJson: any = await refreshRes.json()
    if (!refreshRes.ok || !refreshJson.access_token) {
      throw new Error(refreshJson.error?.message || refreshJson.error_description || 'Threads refresh failed')
    }
    const expiresAt = refreshJson.expires_in
      ? new Date(Date.now() + Number(refreshJson.expires_in) * 1000)
      : null
    await query(
      `UPDATE social_accounts
         SET access_token = $1,
             token_expires_at = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
       WHERE id = $4`,
      [refreshJson.access_token, expiresAt, JSON.stringify({ long_lived_token_expires_at: expiresAt }), cur.id]
    )
    res.json({ data: { refreshed: true, expires_at: expiresAt } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/social/facebook/connection-status
// Returns the unified Meta connection state — connected FB user, expiry of
// the long-lived user token, list of Pages (each carrying a non-expiring
// page token), linked Instagram Business accounts, ad accounts. Used by
// the Accounts tab to render the Meta connection card without having to
// stitch together multiple social_accounts rows on the client.
// ---------------------------------------------------------------------------
router.get('/facebook/connection-status', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT metadata, token_expires_at, connected_at
       FROM social_accounts
       WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
       ORDER BY connected_at DESC LIMIT 1`
    )
    if (r.rows.length === 0) {
      return res.json({ data: { connected: false } })
    }
    const row = r.rows[0]
    const m = row.metadata || {}
    const userTokenExpiresAt: Date | null = row.token_expires_at
    const daysToExpiry = userTokenExpiresAt
      ? Math.max(0, Math.floor((new Date(userTokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null
    res.json({
      data: {
        connected: true,
        fb_user_id: m.fb_user_id,
        fb_user_name: m.fb_user_name,
        connected_at: row.connected_at,
        // The long-lived USER token expires ~60d; page tokens minted from
        // it do not. So posting stays permanent while ad management hits
        // a 60-day reconnect cadence (or token refresh, below).
        user_token_expires_at: userTokenExpiresAt,
        user_token_days_to_expiry: daysToExpiry,
        page_tokens_permanent: true,
        pages: m.pages || [],
        instagram_accounts: m.instagram_accounts || [],
        ad_accounts: m.ad_accounts || [],
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/facebook/refresh-token
// Re-exchanges the current long-lived user token for a fresh 60-day one.
// Lets the operator hit a button before the 60-day expiry without going
// through the full OAuth popup again.
router.post('/facebook/refresh-token', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const clientId = process.env.FACEBOOK_APP_ID
    const clientSecret = process.env.FACEBOOK_APP_SECRET
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not set on the server' })
    }
    const r = await query(
      `SELECT id, access_token, metadata FROM social_accounts
       WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
       ORDER BY connected_at DESC LIMIT 1`
    )
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'No Facebook user connection to refresh' })
    }
    const fbUserRow = r.rows[0]
    const fresh = await fbExchangeLongLived(fbUserRow.access_token, clientId, clientSecret)
    const expiresAt = fresh.expires_in
      ? new Date(Date.now() + fresh.expires_in * 1000)
      : null
    const newMetadata = {
      ...(fbUserRow.metadata || {}),
      long_lived_token_expires_at: expiresAt,
    }
    await query(
      `UPDATE social_accounts
         SET access_token = $1,
             token_expires_at = $2,
             metadata = $3::jsonb,
             updated_at = NOW()
       WHERE id = $4`,
      [fresh.access_token, expiresAt, JSON.stringify(newMetadata), fbUserRow.id]
    )
    res.json({ data: { refreshed: true, user_token_expires_at: expiresAt } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/social/facebook/disconnect
// Removes the Meta connection completely — every page, IG account, the
// synthetic fb_user row, and any cached metadata.
router.delete('/facebook/disconnect', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `DELETE FROM social_accounts
       WHERE platform = 'facebook' OR (platform = 'instagram' AND metadata->>'fb_user_id' IS NOT NULL)
       RETURNING id`
    )
    res.json({ data: { disconnected: true, rows_removed: r.rowCount || 0 } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

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

    // Support EITHER bank_id (legacy / from the Bank tab) OR a direct
    // payload { image_url, caption } so the Ads tab can launch standalone
    // without first persisting the creative to the bank.
    const directImage: string | undefined = req.body?.image_url
    const directCaption: string | undefined = req.body?.caption || req.body?.primary_text || req.body?.message
    if (!ad_account_id) return res.status(400).json({ error: 'ad_account_id is required' })
    if (!page_id) return res.status(400).json({ error: 'page_id is required' })
    if (!bank_id && !directImage) {
      return res.status(400).json({ error: 'Either bank_id or image_url is required' })
    }

    // 1. Resolve caption + media_url from whichever source the caller used.
    let item: { caption: string; media_url: string }
    if (bank_id) {
      const bankRes = await query(`SELECT id, caption, media_url FROM social_content_bank WHERE id = $1`, [bank_id])
      if (bankRes.rows.length === 0) return res.status(404).json({ error: 'Bank item not found' })
      const row = bankRes.rows[0]
      if (!row.media_url) return res.status(400).json({ error: 'Bank item has no image — generate one before launching an ad' })
      item = { caption: row.caption || '', media_url: row.media_url }
    } else {
      item = { caption: directCaption || '', media_url: directImage! }
    }

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
    const graph = (path: string) => `https://graph.facebook.com/v20.0/${path}`

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
      const r = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`)
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

// Return the subset of `required` scopes that the given Meta token is
// NOT currently granted. Falls back to "[] (assume granted)" when the
// /me/permissions call itself fails — we'd rather attempt the publish
// and surface Meta's own error than refuse to try because of a
// transient diagnostic-endpoint hiccup.
async function missingScopes(token: string, required: string[]): Promise<string[]> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v20.0/me/permissions?access_token=${encodeURIComponent(token)}`
    )
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || !Array.isArray(j.data)) return []
    const granted = new Set<string>(
      j.data.filter((p: any) => p.status === 'granted').map((p: any) => p.permission)
    )
    return required.filter((s) => !granted.has(s))
  } catch {
    return []
  }
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
      // Page-level publish. The token must be a Page access token (the
      // OAuth flow stores the non-expiring page token alongside each
      // /me/accounts row, so account.access_token IS the page token).
      const pageId = account.platform_user_id
      const firstMedia = mediaUrls[0] || null
      const isVideo = firstMedia && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(firstMedia)

      // Preflight: verify the Page token carries pages_manage_posts. The
      // most common cause of silent FB publish failures is the app's
      // permissions list not having pages_manage_posts added to its
      // Facebook Login use case — Meta then drops it from the consent
      // dialog and the resulting Page token can't post.
      const fbScopeMissing = await missingScopes(token, ['pages_manage_posts'])
      if (fbScopeMissing.length) {
        return {
          ok: false,
          error: `Facebook Page posting scope missing: ${fbScopeMissing.join(', ')}. Add this permission under App Dashboard → Use Cases → Facebook Login → Permissions, then Disconnect + Reconnect Facebook on the Accounts tab.`,
        }
      }

      // No media → plain status update via /feed.
      if (!firstMedia) {
        const r = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, {
          method: 'POST',
          body: new URLSearchParams({ message: content, access_token: token }),
        })
        const j: any = await r.json()
        if (!r.ok || j.error) return { ok: false, error: j.error?.message || 'Facebook publish failed' }
        return { ok: true, remote_id: j.id }
      }

      // Video → /videos with file_url. Facebook fetches the media from the
      // public URL we pass — keep the URL absolute (toAbsoluteMediaUrl
      // already did that) and let Meta handle the encoding.
      if (isVideo) {
        const r = await fetch(`https://graph.facebook.com/v20.0/${pageId}/videos`, {
          method: 'POST',
          body: new URLSearchParams({ file_url: firstMedia, description: content, access_token: token }),
        })
        const j: any = await r.json()
        if (!r.ok || j.error) return { ok: false, error: j.error?.message || 'Facebook video publish failed' }
        return { ok: true, remote_id: j.id }
      }

      // Image → /photos with url + caption. This creates an actual photo
      // post, not a link preview (which is what /feed with `link=` did
      // in an earlier version of this code, causing image URLs to show
      // up as plain links in the feed).
      const r = await fetch(`https://graph.facebook.com/v20.0/${pageId}/photos`, {
        method: 'POST',
        body: new URLSearchParams({
          url: firstMedia,
          caption: content,
          access_token: token,
          // published=true (default) immediately posts; pass explicitly so
          // intent is obvious to future readers.
          published: 'true',
        }),
      })
      const j: any = await r.json()
      if (!r.ok || j.error) return { ok: false, error: j.error?.message || 'Facebook photo publish failed' }
      // /photos returns { id: <photo_id>, post_id: <feed_post_id> } — the
      // post_id is what links to the feed entry, so prefer that.
      return { ok: true, remote_id: j.post_id || j.id }
    }
    if (platform === 'instagram') {
      // Instagram Content Publishing API. Two-step container + publish flow.
      // Two underlying flavors of IG row in social_accounts:
      //   kind='ig_direct'   — Direct IG Login flow (instagram.com OAuth).
      //                         Token is an IG user token + publish hits
      //                         graph.instagram.com. Scopes use the new
      //                         instagram_business_* prefix.
      //   kind='ig_business' — Old Facebook-OAuth-driven flow. Token is a
      //                         Page token + publish hits graph.facebook.com.
      //                         Scopes use the legacy instagram_basic +
      //                         instagram_content_publish.
      // Docs:
      //   Direct:   developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
      //   Via FB:   developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login
      const igUserId = account.platform_user_id
      const firstMedia = mediaUrls[0] || null
      if (!firstMedia) {
        return { ok: false, error: 'Instagram posts require an image or video' }
      }
      const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(firstMedia)
      const igMeta = account.metadata || {}
      const isDirectFlow = igMeta.kind === 'ig_direct'
      const igHost = isDirectFlow ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v20.0'

      // Preflight: token must carry the right publishing scope. The
      // scope name differs by flow — the new direct flow uses the
      // instagram_business_* prefix; the legacy flow uses instagram_basic
      // + instagram_content_publish. Direct-flow tokens live on
      // graph.instagram.com and don't expose /me/permissions, so we
      // skip the preflight there (Meta returns clearly-typed errors at
      // /media if scopes are missing).
      if (!isDirectFlow) {
        const igScopeMissing = await missingScopes(token, ['instagram_basic', 'instagram_content_publish'])
        if (igScopeMissing.length) {
          return {
            ok: false,
            error: `Instagram publishing scope missing: ${igScopeMissing.join(', ')}. If the permission is listed in your Meta App Dashboard (Use Cases → Instagram → Permissions), Disconnect Facebook on the Accounts tab and Log in again to mint a fresh token. Otherwise add the permission in the App Dashboard first.`,
          }
        }
      }
      // IG caps captions at 2200 chars + 30 hashtags. Truncate the body so
      // a too-long caption doesn't 400 the container.
      const captionForIg = content.length > 2200 ? content.slice(0, 2197) + '…' : content

      // 1. Create the media container.
      const containerParams = new URLSearchParams({ access_token: token, caption: captionForIg })
      if (isVideo) {
        // REELS is the modern video-publishing path on IG; plain VIDEO
        // is being phased out. video_url is fetched by IG's CDN, so it
        // must be publicly reachable and stable for the polling window.
        containerParams.set('media_type', 'REELS')
        containerParams.set('video_url', firstMedia)
      } else {
        containerParams.set('image_url', firstMedia)
      }
      const containerRes = await fetch(`${igHost}/${igUserId}/media`, {
        method: 'POST',
        body: containerParams,
      })
      const containerJson: any = await containerRes.json().catch(() => ({}))
      if (!containerRes.ok || !containerJson.id) {
        return { ok: false, error: containerJson.error?.message || `IG container failed (HTTP ${containerRes.status})` }
      }

      // 2. Poll the container's status_code until FINISHED. Required for
      //    video (encoding takes ~5-30s); recommended for images so we
      //    don't race ahead and publish a container Meta hasn't ingested.
      const maxPolls = isVideo ? 30 : 5
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const statusRes = await fetch(
          `${igHost}/${containerJson.id}?fields=status_code&access_token=${encodeURIComponent(token)}`
        )
        const statusJson: any = await statusRes.json().catch(() => ({}))
        if (statusJson.status_code === 'FINISHED') break
        if (statusJson.status_code === 'ERROR' || statusJson.status_code === 'EXPIRED') {
          return { ok: false, error: `IG container ${statusJson.status_code}` }
        }
      }

      // 3. Publish.
      const publishRes = await fetch(`${igHost}/${igUserId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: containerJson.id, access_token: token }),
      })
      const publishJson: any = await publishRes.json().catch(() => ({}))
      if (!publishRes.ok || publishJson.error) {
        return { ok: false, error: publishJson.error?.message || `IG publish failed (HTTP ${publishRes.status})` }
      }
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
    if (platform === 'threads') {
      // Threads publishing is a 2-step container flow, same shape as IG
      // Graph: POST /me/threads (creates the media container) returns an
      // id we then POST to /me/threads_publish to actually post.
      const igUserId = account.platform_user_id
      const firstMedia = mediaUrls[0] || null
      const isVideo = firstMedia && /\.(mp4|mov|webm)(\?|$)/i.test(firstMedia)
      const containerParams = new URLSearchParams({ access_token: token })
      containerParams.set('media_type', firstMedia ? (isVideo ? 'VIDEO' : 'IMAGE') : 'TEXT')
      // Threads caps text at 500 chars — truncate so we don't 400.
      if (content) containerParams.set('text', content.slice(0, 500))
      if (firstMedia) {
        containerParams.set(isVideo ? 'video_url' : 'image_url', firstMedia)
      }
      const containerRes = await fetch(`https://graph.threads.net/v1.0/${igUserId}/threads`, {
        method: 'POST',
        body: containerParams,
      })
      const containerJson: any = await containerRes.json().catch(() => ({}))
      if (!containerRes.ok || !containerJson.id) {
        return { ok: false, error: containerJson.error?.message || `Threads container failed (HTTP ${containerRes.status})` }
      }

      // Video containers need ~30s to finish processing before publish.
      // The /<container>?fields=status_code poll returns FINISHED when ready.
      if (isVideo) {
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const statusRes = await fetch(
            `https://graph.threads.net/v1.0/${containerJson.id}?fields=status_code&access_token=${encodeURIComponent(token)}`
          )
          const statusJson: any = await statusRes.json().catch(() => ({}))
          if (statusJson.status_code === 'FINISHED') break
          if (statusJson.status_code === 'ERROR') {
            return { ok: false, error: 'Threads video processing failed' }
          }
        }
      }

      const publishRes = await fetch(`https://graph.threads.net/v1.0/${igUserId}/threads_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: containerJson.id, access_token: token }),
      })
      const publishJson: any = await publishRes.json().catch(() => ({}))
      if (!publishRes.ok || publishJson.error) {
        return { ok: false, error: publishJson.error?.message || 'Threads publish failed' }
      }
      return { ok: true, remote_id: publishJson.id }
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
