import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { query } from '../db'
import { GRITSYNC_KB } from '../lib/gritsync-knowledge'

const router = Router()

const GRAPH = 'https://graph.facebook.com/v20.0'
const OPENAI_KEY = () => process.env.OPENAI_API_KEY

// ─── Helpers ───────────────────────────────────────────────────────────────

// Pull every connected FB Page row + IG row. We deliberately read the raw
// social_accounts table so this works even when the synthetic fbuser:* row
// is stale — each per-Page row carries its own page token, which is what
// all Page-scoped Graph API calls (insights, comments, conversations, groups)
// require.
async function listMetaAccounts() {
  const r = await query(
    `SELECT id, platform, display_name, platform_user_id, access_token, metadata
       FROM social_accounts
      WHERE status = 'connected'
        AND platform IN ('facebook', 'instagram')
        AND platform_user_id NOT LIKE 'fbuser:%'`
  )
  return r.rows as Array<{
    id: string
    platform: 'facebook' | 'instagram'
    display_name: string
    platform_user_id: string
    access_token: string
    metadata: any
  }>
}

async function fbGet(path: string, accessToken: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: accessToken }).toString()
  const r = await fetch(`${GRAPH}/${path}?${qs}`)
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = j?.error?.message || `Graph HTTP ${r.status}`
    throw new Error(msg)
  }
  return j
}

async function fbPost(path: string, accessToken: string, body: Record<string, any>): Promise<any> {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  form.set('access_token', accessToken)
  const r = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: form })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message || `Graph HTTP ${r.status}`)
  return j
}

// ─── Analytics ─────────────────────────────────────────────────────────────

// GET /api/social/analytics/summary
// Aggregates Page Insights (FB) + Media Insights (IG) for the last 28 days
// across every connected Page / IG Business account. Returns one block per
// platform-account pair so the Manager card can render side-by-side stats.
router.get('/analytics/summary', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const accounts = await listMetaAccounts()

    const results = await Promise.all(accounts.map(async (acc) => {
      const base = {
        platform: acc.platform,
        account: { id: acc.platform_user_id, name: acc.display_name },
        reach_28d: null as number | null,
        engagement_28d: null as number | null,
        followers: null as number | null,
        follower_growth_28d: null as number | null,
        top_posts: [] as Array<{ id: string; permalink: string | null; caption: string; published_at: string | null; reach: number | null; engagement: number | null }>,
        error: null as string | null,
      }

      try {
        if (acc.platform === 'facebook') {
          // Page-level metrics. `period=days_28` is supported by the modern
          // Insights API for these metrics; fans is point-in-time. We pull
          // them in one call to keep latency low.
          const insights = await fbGet(`${acc.platform_user_id}/insights`, acc.access_token, {
            metric: 'page_impressions_unique,page_post_engagements,page_fans,page_fan_adds_unique',
            period: 'days_28',
          }).catch((e: any) => ({ data: [], _err: e.message }))

          for (const row of insights.data || []) {
            const v = row.values?.[row.values.length - 1]?.value
            if (typeof v !== 'number') continue
            if (row.name === 'page_impressions_unique') base.reach_28d = v
            else if (row.name === 'page_post_engagements') base.engagement_28d = v
            else if (row.name === 'page_fans') base.followers = v
            else if (row.name === 'page_fan_adds_unique') base.follower_growth_28d = v
          }
          if ((insights as any)._err) base.error = (insights as any)._err

          // Top posts by engagement in the last 28d.
          const since = Math.floor((Date.now() - 28 * 24 * 3600 * 1000) / 1000)
          const posts = await fbGet(`${acc.platform_user_id}/posts`, acc.access_token, {
            fields: 'id,message,permalink_url,created_time,insights.metric(post_impressions_unique,post_engaged_users){values}',
            since: String(since),
            limit: '20',
          }).catch(() => ({ data: [] }))

          const scored: typeof base.top_posts = []
          for (const p of posts.data || []) {
            const ins = p.insights?.data || []
            const reach = ins.find((x: any) => x.name === 'post_impressions_unique')?.values?.[0]?.value ?? null
            const eng = ins.find((x: any) => x.name === 'post_engaged_users')?.values?.[0]?.value ?? null
            scored.push({
              id: p.id,
              permalink: p.permalink_url || null,
              caption: (p.message || '').slice(0, 180),
              published_at: p.created_time || null,
              reach,
              engagement: eng,
            })
          }
          base.top_posts = scored.sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 5)
        } else {
          // Instagram: the per-row access_token IS the FB Page token (IG
          // publishes through the linked Page). user_insights metric set
          // changed in v18+ — `reach` + `accounts_engaged` are the modern
          // canonical replacements.
          const since = Math.floor((Date.now() - 28 * 24 * 3600 * 1000) / 1000)
          const until = Math.floor(Date.now() / 1000)

          const insights = await fbGet(`${acc.platform_user_id}/insights`, acc.access_token, {
            metric: 'reach,accounts_engaged',
            period: 'day',
            metric_type: 'total_value',
            since: String(since),
            until: String(until),
          }).catch((e: any) => ({ data: [], _err: e.message }))

          for (const row of insights.data || []) {
            const v = row.total_value?.value
            if (typeof v !== 'number') continue
            if (row.name === 'reach') base.reach_28d = v
            else if (row.name === 'accounts_engaged') base.engagement_28d = v
          }
          if ((insights as any)._err) base.error = (insights as any)._err

          const profile = await fbGet(`${acc.platform_user_id}`, acc.access_token, {
            fields: 'followers_count',
          }).catch(() => null)
          if (profile?.followers_count) base.followers = profile.followers_count

          const media = await fbGet(`${acc.platform_user_id}/media`, acc.access_token, {
            fields: 'id,caption,permalink,timestamp,like_count,comments_count,insights.metric(reach){values}',
            limit: '20',
            since: String(since),
          }).catch(() => ({ data: [] }))

          const scored: typeof base.top_posts = []
          for (const m of media.data || []) {
            const reach = m.insights?.data?.find((x: any) => x.name === 'reach')?.values?.[0]?.value ?? null
            const eng = (m.like_count || 0) + (m.comments_count || 0)
            scored.push({
              id: m.id,
              permalink: m.permalink || null,
              caption: (m.caption || '').slice(0, 180),
              published_at: m.timestamp || null,
              reach,
              engagement: eng,
            })
          }
          base.top_posts = scored.sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 5)
        }
      } catch (err: any) {
        base.error = err.message || 'Insights unavailable'
      }
      return base
    }))

    res.json({ data: { platforms: results } })
  } catch (err: any) {
    console.error('analytics/summary error:', err)
    res.status(500).json({ error: err.message || 'Failed to load analytics' })
  }
})

// POST /api/social/analytics/plan
// Pulls the same summary, feeds it to gpt-4o-mini with the GritSync KB, and
// returns structured cadence/best-time/topic recommendations grounded in the
// account's actual performance. Returns null gracefully if no Pages connected.
router.post('/analytics/plan', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const target = Number(req.body?.posts_per_day_target) || 2
    const accounts = await listMetaAccounts()
    if (accounts.length === 0) {
      return res.status(400).json({ error: 'Connect a Facebook Page or Instagram Business account first' })
    }

    // Reuse the summary route logic by calling it inline. Cheaper than
    // re-implementing; one Promise.all per request still fits under
    // serverless timeouts since the metric set is small.
    const summaryReq: any = req
    const summaryRes: any = { json: (v: any) => v, status: () => ({ json: (v: any) => v }) }
    // Easier path: just refetch summary by inlining the same code via a
    // dedicated helper. Keep code DRY by extracting once.
    const summary = await buildAnalyticsSummary(accounts)

    const system = `You are GritSync's social-media strategist. You build short, concrete weekly plans for an NCLEX-processing agency that helps Filipino nurses become USRNs. Use only the metrics provided and the brand facts below — never fabricate numbers, named hospitals, or guarantees.

${GRITSYNC_KB}

Return JSON only.`

    const user = `Operator's target cadence: ${target} posts/day.

Per-platform metrics (last 28 days):
${JSON.stringify(summary, null, 2)}

Produce a JSON object with this shape:
{
  "summary": "<one paragraph (under 80 words) reading the numbers — what's working, what's flat, where to push>",
  "cadence": { "recommended_per_day": <integer 1-6>, "rationale": "<one sentence>" },
  "best_times": [{ "platform": "<facebook|instagram>", "window": "<e.g. 'Tue/Thu 7-9 PM PHT'>", "note": "<one short sentence>" }],
  "topic_recommendations": [
    { "title": "<short hook>", "brief": "<2 sentences for the writer>", "tag": "<NCLEX|Service|Marketing|Story>", "why": "<one sentence tying it to a metric or pattern above>" }
  ]
}

Rules:
- Recommend 3-5 topics.
- Recommend 2-3 best_times entries (one per connected platform).
- If a platform has no top_posts data, say so in the summary instead of inventing patterns.
- All copy must be brand-aligned with GritSync (Filipino nurses → USRN, processing agency framing).`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 1800,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })

    const text = j.choices?.[0]?.message?.content || '{}'
    let parsed: any
    try { parsed = JSON.parse(text) } catch { parsed = { summary: text, cadence: { recommended_per_day: target, rationale: '' }, best_times: [], topic_recommendations: [] } }
    res.json({ data: parsed })
  } catch (err: any) {
    console.error('analytics/plan error:', err)
    res.status(500).json({ error: err.message || 'Failed to generate plan' })
  }
})

// Shared helper used by the plan endpoint. Mirrors the summary route's body
// without going through res — keeps a single source of truth for what gets
// sent to the LLM versus rendered in the UI.
async function buildAnalyticsSummary(accounts: Awaited<ReturnType<typeof listMetaAccounts>>) {
  return Promise.all(accounts.map(async (acc) => {
    const base: any = {
      platform: acc.platform,
      account: { id: acc.platform_user_id, name: acc.display_name },
      reach_28d: null,
      engagement_28d: null,
      followers: null,
      follower_growth_28d: null,
      top_posts: [] as any[],
    }
    try {
      if (acc.platform === 'facebook') {
        const insights = await fbGet(`${acc.platform_user_id}/insights`, acc.access_token, {
          metric: 'page_impressions_unique,page_post_engagements,page_fans,page_fan_adds_unique',
          period: 'days_28',
        }).catch(() => ({ data: [] }))
        for (const row of insights.data || []) {
          const v = row.values?.[row.values.length - 1]?.value
          if (typeof v !== 'number') continue
          if (row.name === 'page_impressions_unique') base.reach_28d = v
          else if (row.name === 'page_post_engagements') base.engagement_28d = v
          else if (row.name === 'page_fans') base.followers = v
          else if (row.name === 'page_fan_adds_unique') base.follower_growth_28d = v
        }
        const since = Math.floor((Date.now() - 28 * 24 * 3600 * 1000) / 1000)
        const posts = await fbGet(`${acc.platform_user_id}/posts`, acc.access_token, {
          fields: 'id,message,created_time,insights.metric(post_engaged_users){values}',
          since: String(since),
          limit: '10',
        }).catch(() => ({ data: [] }))
        base.top_posts = (posts.data || []).map((p: any) => ({
          caption: (p.message || '').slice(0, 200),
          published_at: p.created_time,
          engagement: p.insights?.data?.[0]?.values?.[0]?.value || 0,
        })).sort((a: any, b: any) => b.engagement - a.engagement).slice(0, 3)
      } else {
        const since = Math.floor((Date.now() - 28 * 24 * 3600 * 1000) / 1000)
        const until = Math.floor(Date.now() / 1000)
        const insights = await fbGet(`${acc.platform_user_id}/insights`, acc.access_token, {
          metric: 'reach,accounts_engaged',
          period: 'day',
          metric_type: 'total_value',
          since: String(since),
          until: String(until),
        }).catch(() => ({ data: [] }))
        for (const row of insights.data || []) {
          const v = row.total_value?.value
          if (typeof v !== 'number') continue
          if (row.name === 'reach') base.reach_28d = v
          else if (row.name === 'accounts_engaged') base.engagement_28d = v
        }
        const profile = await fbGet(`${acc.platform_user_id}`, acc.access_token, { fields: 'followers_count' }).catch(() => null)
        if (profile?.followers_count) base.followers = profile.followers_count
        const media = await fbGet(`${acc.platform_user_id}/media`, acc.access_token, {
          fields: 'id,caption,timestamp,like_count,comments_count',
          limit: '10',
          since: String(since),
        }).catch(() => ({ data: [] }))
        base.top_posts = (media.data || []).map((m: any) => ({
          caption: (m.caption || '').slice(0, 200),
          published_at: m.timestamp,
          engagement: (m.like_count || 0) + (m.comments_count || 0),
        })).sort((a: any, b: any) => b.engagement - a.engagement).slice(0, 3)
      }
    } catch {
      // swallow — partial data is fine for plan generation
    }
    return base
  }))
}

// ─── AutoReply: Inbox ──────────────────────────────────────────────────────

// GET /api/social/autoreply/inbox
// Lists active conversations across every connected FB Page + IG Business
// account. Each platform's API returns its own conversation envelope; we
// normalise to a common shape the UI can render uniformly.
router.get('/autoreply/inbox', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const accounts = await listMetaAccounts()
    const threads: any[] = []

    await Promise.all(accounts.map(async (acc) => {
      try {
        if (acc.platform === 'facebook') {
          const r = await fbGet(`${acc.platform_user_id}/conversations`, acc.access_token, {
            fields: 'id,updated_time,snippet,unread_count,participants{name,id}',
            limit: '25',
          })
          for (const c of r.data || []) {
            const participants = (c.participants?.data || []).filter((p: any) => p.id !== acc.platform_user_id)
            threads.push({
              id: c.id,
              account_id: acc.id,
              account_platform: 'facebook',
              account_name: acc.display_name,
              with_name: participants[0]?.name || 'Unknown',
              snippet: c.snippet || '',
              updated_at: c.updated_time,
              unread: c.unread_count || 0,
            })
          }
        } else {
          // IG via the linked Page: same /conversations endpoint, but pass
          // `platform=instagram` so Meta routes to the IG inbox.
          const linkedPageId = acc.metadata?.linked_page_id
          if (!linkedPageId) return
          const r = await fbGet(`${linkedPageId}/conversations`, acc.access_token, {
            platform: 'instagram',
            fields: 'id,updated_time,snippet,unread_count,participants{name,id}',
            limit: '25',
          })
          for (const c of r.data || []) {
            const participants = (c.participants?.data || []).filter((p: any) => p.id !== acc.platform_user_id)
            threads.push({
              id: c.id,
              account_id: acc.id,
              account_platform: 'instagram',
              account_name: acc.display_name,
              with_name: participants[0]?.name || 'Unknown',
              snippet: c.snippet || '',
              updated_at: c.updated_time,
              unread: c.unread_count || 0,
            })
          }
        }
      } catch (err: any) {
        // One platform failing shouldn't take down the whole inbox.
        console.warn(`Inbox fetch failed for ${acc.platform}:${acc.display_name}:`, err.message)
      }
    }))

    threads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    res.json({ data: { threads } })
  } catch (err: any) {
    console.error('inbox error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/social/autoreply/inbox/:thread_id/messages
// Fetches the full message history of one conversation. account_id is needed
// to look up the right page token.
router.get('/autoreply/inbox/:thread_id/messages', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { thread_id } = req.params
    const account_id = String(req.query.account_id || '')
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })

    const r = (await query(`SELECT access_token, platform_user_id FROM social_accounts WHERE id = $1`, [account_id])).rows[0]
    if (!r) return res.status(404).json({ error: 'Account not found' })

    const msgs = await fbGet(`${thread_id}/messages`, r.access_token, {
      fields: 'id,message,from,to,created_time',
      limit: '50',
    })
    res.json({ data: { messages: (msgs.data || []).reverse(), account_psid: r.platform_user_id } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autoreply/inbox/:thread_id/reply
// Sends a text reply on the conversation. The Messenger Platform requires
// the recipient PSID, not the conversation id — we look it up by fetching
// the conversation's participants and picking the one that isn't our page.
router.post('/autoreply/inbox/:thread_id/reply', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { thread_id } = req.params
    const { account_id, message } = req.body || {}
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' })

    const acc = (await query(
      `SELECT access_token, platform_user_id, platform, metadata FROM social_accounts WHERE id = $1`,
      [account_id]
    )).rows[0]
    if (!acc) return res.status(404).json({ error: 'Account not found' })

    // Pull participants to learn the recipient PSID/IGSID.
    const conv = await fbGet(`${thread_id}`, acc.access_token, { fields: 'participants{id}' })
    const otherId = (conv.participants?.data || [])
      .map((p: any) => p.id)
      .find((id: string) => id !== acc.platform_user_id)
    if (!otherId) return res.status(400).json({ error: 'Could not determine recipient' })

    const sendFromPageId = acc.platform === 'instagram' ? (acc.metadata?.linked_page_id || acc.platform_user_id) : acc.platform_user_id
    const j = await fbPost(`${sendFromPageId}/messages`, acc.access_token, {
      recipient: { id: otherId },
      message: { text: message },
      messaging_type: 'RESPONSE',
    })
    res.json({ data: { message_id: j.message_id || null } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── AutoReply: Comments ───────────────────────────────────────────────────

// GET /api/social/autoreply/comments
// Pulls comments on recent posts across every connected Page + IG account.
// Returns the newest 50 across all sources so the operator can triage by age.
router.get('/autoreply/comments', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const accounts = await listMetaAccounts()
    const comments: any[] = []

    await Promise.all(accounts.map(async (acc) => {
      try {
        if (acc.platform === 'facebook') {
          const posts = await fbGet(`${acc.platform_user_id}/posts`, acc.access_token, {
            fields: 'id,message,permalink_url,comments.limit(10){id,from{id,name,picture{url}},message,created_time,parent}',
            limit: '15',
          })
          for (const post of posts.data || []) {
            for (const c of post.comments?.data || []) {
              comments.push({
                id: c.id,
                account_id: acc.id,
                account_platform: 'facebook',
                account_name: acc.display_name,
                from_name: c.from?.name || 'Unknown',
                from_avatar: c.from?.picture?.data?.url || null,
                message: c.message || '',
                created_at: c.created_time,
                post: {
                  id: post.id,
                  permalink: post.permalink_url || null,
                  message: (post.message || '').slice(0, 140),
                },
                is_own: c.from?.id === acc.platform_user_id,
              })
            }
          }
        } else {
          const media = await fbGet(`${acc.platform_user_id}/media`, acc.access_token, {
            fields: 'id,caption,permalink,comments.limit(10){id,from{id,username},text,timestamp,user{username,profile_picture_url}}',
            limit: '15',
          })
          for (const m of media.data || []) {
            for (const c of m.comments?.data || []) {
              comments.push({
                id: c.id,
                account_id: acc.id,
                account_platform: 'instagram',
                account_name: acc.display_name,
                from_name: c.from?.username || c.user?.username || 'someone',
                from_avatar: c.user?.profile_picture_url || null,
                message: c.text || '',
                created_at: c.timestamp,
                post: {
                  id: m.id,
                  permalink: m.permalink || null,
                  message: (m.caption || '').slice(0, 140),
                },
                is_own: false,
              })
            }
          }
        }
      } catch (err: any) {
        console.warn(`Comments fetch failed for ${acc.platform}:${acc.display_name}:`, err.message)
      }
    }))

    comments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    res.json({ data: { comments: comments.slice(0, 100) } })
  } catch (err: any) {
    console.error('comments error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autoreply/comments/:comment_id/reply
// Replies to a single comment on either platform.
router.post('/autoreply/comments/:comment_id/reply', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { comment_id } = req.params
    const { account_id, message } = req.body || {}
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' })

    const acc = (await query(`SELECT access_token, platform FROM social_accounts WHERE id = $1`, [account_id])).rows[0]
    if (!acc) return res.status(404).json({ error: 'Account not found' })

    // Both FB and IG accept POST /{comment-id}/comments with `message` (FB)
    // or `message` (IG — Meta normalized the field). For IG legacy compat
    // we send both `message` and `text` so it works on either surface.
    const body = acc.platform === 'instagram' ? { message } : { message }
    const j = await fbPost(`${comment_id}/comments`, acc.access_token, body)
    res.json({ data: { reply_id: j.id } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autoreply/draft
// Asks gpt-4o-mini to draft a reply for either a comment or an inbox
// message. Returns a single string — the UI shows it in the reply box and
// the operator can edit before sending. We deliberately keep this a
// suggest-only flow (no auto-send) so the brand voice stays under human
// control until we add explicit autopilot opt-in.
router.post('/autoreply/draft', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })
    const { context_kind, message, post_caption } = req.body || {}
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' })

    const system = `You write replies on behalf of GritSync, an NCLEX-processing agency for Filipino nurses. Tone: warm, concrete, no clichés, never promise a passing rate. Mix Taglish naturally when the inbound message uses Filipino. Use these ground-truth facts:

${GRITSYNC_KB}

Reply rules:
- Under 280 characters.
- Address the specific question — never copy-paste a generic CTA.
- If the asker is interested in services, end with "DM us or visit gritsync.com/quote" (only one CTA).
- If the message is hostile or off-topic, write a polite, short de-escalation. No arguments.
- Never invent prices, dates, or named hospitals.`

    const user = `Inbound ${context_kind === 'comment' ? 'comment on a post' : 'direct message'}:
"""
${message}
"""
${post_caption ? `Original post caption (for context):\n"""\n${post_caption}\n"""` : ''}

Return JSON: { "reply": "<the reply text>" }`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })
    const text = j.choices?.[0]?.message?.content || '{}'
    let reply = ''
    try { reply = JSON.parse(text).reply || '' } catch { reply = text.trim() }
    res.json({ data: { reply } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Groups ────────────────────────────────────────────────────────────────
//
// Meta locked down most of the Groups API in 2020. What still works:
//   • /me/groups (with user_managed_groups) — groups the *user* admins
//   • /{group_id}/feed POST — posting to a group as a member (the page
//     must have been added to the group as a member; admin-only)
// What no longer works for new apps:
//   • Public group search/discovery via Graph API (deprecated)
//   • Auto-posting on behalf of arbitrary users
//
// We implement what's available + a saved-candidates workflow so the
// operator can track groups they're researching to join.

// GET /api/social/groups
// Lists groups the connected FB user manages. Pull from the long-lived user
// token (the synthetic fbuser:* row) since user_managed_groups is granted
// at user-level, not page-level.
router.get('/groups', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const fbUser = (await query(
      `SELECT access_token FROM social_accounts
        WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
          AND status = 'connected'
        ORDER BY connected_at DESC LIMIT 1`
    )).rows[0]

    if (!fbUser) {
      return res.json({ data: { groups: [], note: 'Connect Facebook to see groups you manage' } })
    }

    // user_managed_groups returns groups the user is admin of. If the scope
    // wasn't granted (older OAuth), Meta returns an empty data array, not
    // an error — so we surface a helpful note in that case.
    let groups: any[] = []
    let note: string | null = null
    try {
      const r = await fbGet(`me/groups`, fbUser.access_token, {
        fields: 'id,name,member_count,description,icon,privacy',
        limit: '100',
      })
      groups = r.data || []
      if (groups.length === 0) {
        note = 'No groups returned. Reconnect Facebook and grant "Manage your groups" so we can list them.'
      }
    } catch (err: any) {
      note = err.message
    }

    // Layer in saved candidates from our own table so the UI shows both
    // sources in one list.
    const candidates = (await query(
      `SELECT id, group_id, name, url, notes, status, created_at
         FROM social_group_candidates
        ORDER BY created_at DESC`
    ).catch(() => ({ rows: [] }))).rows

    res.json({ data: { groups, candidates, note } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/groups/share
// Posts a link or text into a group as the connected user. Body:
//   { group_id, message, link? }
router.post('/groups/share', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { group_id, message, link } = req.body || {}
    if (!group_id) return res.status(400).json({ error: 'group_id is required' })
    if (!message?.trim() && !link) return res.status(400).json({ error: 'message or link is required' })

    const fbUser = (await query(
      `SELECT access_token FROM social_accounts
        WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
          AND status = 'connected' ORDER BY connected_at DESC LIMIT 1`
    )).rows[0]
    if (!fbUser) return res.status(400).json({ error: 'Connect Facebook first' })

    const body: Record<string, any> = { message: message || '' }
    if (link) body.link = link
    const j = await fbPost(`${group_id}/feed`, fbUser.access_token, body)
    res.json({ data: { post_id: j.id } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/groups/candidates
// Saves a "group I'm thinking of joining" entry. No Meta API call — Meta
// killed public group search for new apps, so the operator pastes a URL
// and we track it locally for follow-up.
router.post('/groups/candidates', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, url, notes } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
    // Extract group_id from a facebook.com/groups/<id>/ URL if present.
    let groupId: string | null = null
    if (url) {
      const m = String(url).match(/facebook\.com\/groups\/([^/?#]+)/i)
      if (m) groupId = m[1]
    }
    const r = await query(
      `INSERT INTO social_group_candidates (group_id, name, url, notes, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'researching', $5) RETURNING *`,
      [groupId, name.trim(), url || null, notes || null, req.user!.id]
    )
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/social/groups/candidates/:id
// Update status (researching -> requested -> joined -> rejected) or notes.
router.patch('/groups/candidates/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { status, notes, name, url } = req.body || {}
    const fields: string[] = []
    const params: any[] = []
    let i = 1
    if (status !== undefined) { fields.push(`status = $${i++}`); params.push(status) }
    if (notes !== undefined) { fields.push(`notes = $${i++}`); params.push(notes) }
    if (name !== undefined) { fields.push(`name = $${i++}`); params.push(name) }
    if (url !== undefined) { fields.push(`url = $${i++}`); params.push(url) }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' })
    fields.push(`updated_at = NOW()`)
    params.push(id)
    const r = await query(
      `UPDATE social_group_candidates SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/social/groups/candidates/:id
router.delete('/groups/candidates/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await query(`DELETE FROM social_group_candidates WHERE id = $1`, [req.params.id])
    res.json({ data: { deleted: true } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/groups/discover
// Heuristic discovery: since Meta killed public group search via Graph,
// we use gpt-4o-mini with the GritSync KB to suggest GROUP TYPES + search
// queries the operator can paste into facebook.com. Returns a list of
// concrete suggestions (name pattern, why it fits, search URL).
router.post('/groups/discover', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })
    const { focus } = req.body || {}

    const system = `You suggest Facebook groups for GritSync, an NCLEX-processing agency for Filipino nurses migrating to the US. Suggest groups where Filipino nurses, nursing students, or migrant healthcare workers actually gather. Use only group archetypes you're confident exist on Facebook — never invent specific group names that may not be real.

${GRITSYNC_KB}

Return JSON only.`

    const user = `${focus ? `Focus: ${focus}` : 'No specific focus — suggest a balanced mix.'}

Suggest 6-8 Facebook group archetypes worth joining. For each:
- name_pattern: a generic phrase Facebook search will surface (e.g. "Filipino Nurses USA"), NOT a specific group's exact title
- why: 1 sentence on why this audience matches GritSync
- search_url: a facebook.com search URL with the name_pattern URL-encoded
- engagement_strategy: 1 sentence on how to add value before posting any CTA

Return: { "suggestions": [ { "name_pattern": "…", "why": "…", "search_url": "…", "engagement_strategy": "…" } ] }`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })
    const text = j.choices?.[0]?.message?.content || '{}'
    let suggestions: any[] = []
    try { suggestions = JSON.parse(text).suggestions || [] } catch {}
    res.json({ data: { suggestions } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
