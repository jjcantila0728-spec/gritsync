import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { query } from '../db'
import { GRITSYNC_KB } from '../lib/gritsync-knowledge'

const router = Router()

const GRAPH = 'https://graph.facebook.com/v20.0'
const OPENAI_KEY = () => process.env.OPENAI_API_KEY

// ─── Named AI agents ───────────────────────────────────────────────────────
// Every customer-facing AI surface has a named persona. The names show up in
// the operator UI ("Ask Kuya Jay", "Ask Mika") so the team knows which
// agent is acting and can mentally separate their voices. All personas
// share the same GRITSYNC_KB ground truth — they only differ in tone,
// channel, and risk surface.
//
// - Mika     · DM/Inbox concierge. 1:1 private chat, can ask for personal
//              details safely, can quote pricing more freely.
// - Kuya Jay · Public-comments specialist. Taglish-by-default, brand face
//              in front of strangers, defers anything personal to DMs.
// - Strat    · Analytics + planning agent (Manager tab). Reads metrics
//              and produces concrete plans.
// - Scout    · Groups researcher. Suggests where to engage, never invents
//              specific group names.
export const AGENT_NAMES = {
  inbox: 'Mika',
  comments: 'Kuya Jay',
  planner: 'Strat',
  scout: 'Scout',
} as const

// Shared header all customer-facing agents see before their channel rules.
// Keeps the GritSync ground truth front-and-center so no agent drifts into
// hallucinated claims.
function agentHeader(name: string, role: string): string {
  return `You are ${name}, ${role} for GritSync. Speak in first person as ${name} only when the operator addresses you directly — never sign comments/messages "— ${name}" (those go out under the GritSync brand).

GROUND TRUTH — your ONLY authoritative source. Never contradict it, never invent missing details:

${GRITSYNC_KB}

AUTHORIZED SOURCES — strict rule:
- The GROUND TRUTH block above is your ONLY information source. Plus these official GritSync URLs you may link to:
  · https://www.gritsync.com/         (homepage / process overview)
  · https://www.gritsync.com/quote    (personalized pricing + apply)
  · https://www.gritsync.com/faqs     (FAQ page — direct people here for in-depth questions)
- NEVER pull facts from general web knowledge, news, training-data memory of NCLEX/USRN/visa rules, or anything outside the GROUND TRUTH block.
- NEVER make assumptions to fill gaps. If a fact isn't above, you don't know it.

WHEN YOU DON'T KNOW (this happens often — handle it gracefully):
- If the inbound question is about something NOT covered in GROUND TRUTH (e.g. visa types, non-NY states, salary expectations, specific hospitals, immigration steps, English proficiency tests, study materials), DO NOT guess.
- Reply with a short honest deflection that invites them to the right place. Examples:
  · "Naku, mas safe na sa team ko ma-confirm 'yan — pa-DM po kayo sa Page so we can check details with you."
  · "That's not something we publish — kindly visit https://www.gritsync.com/faqs or DM the Page para sigurado ang sagot."
  · "Hindi po naming na-co-cover 'yan as a service (NY-only kami via NYSED-direct) — but our team can help you find the right next step. DM po."
- It is FAR better to escalate than to invent.

GUARDRAILS that apply to every reply you write:
- Never promise NCLEX pass rates, visa outcomes, salaries, or timelines outside the published ranges.
- Never name specific hospitals, schools, employers, or clients GritSync hasn't publicly endorsed.
- Never give legal, medical, or immigration advice.
- Only mention services GritSync actually does (NY pathway, NYSED-direct submission, Pearson VUE registration, the 3 document uploads: 2x2 photo / nursing diploma / Philippine passport). Never claim CGFNS, VisaScreen, or non-NY state processing.
- For pricing, use ranges from GROUND TRUTH ("around $800-$900 split across two payments") or point to https://www.gritsync.com/quote.
- For deep / personal questions (application status, eligibility check, exact timeline for THIS person), invite them to DM the Page or visit https://www.gritsync.com/quote.`
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Pull every connected FB Page row + IG row. We deliberately read the raw
// social_accounts table so this works even when the synthetic fbuser:* row
// is stale — each per-Page row carries its own page token, which is what
// all Page-scoped Graph API calls (insights, comments, conversations, groups)
// require.
export async function listMetaAccounts() {
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

export async function fbGet(path: string, accessToken: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: accessToken }).toString()
  const r = await fetch(`${GRAPH}/${path}?${qs}`)
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = j?.error?.message || `Graph HTTP ${r.status}`
    throw new Error(msg)
  }
  return j
}

export async function fbPost(path: string, accessToken: string, body: Record<string, any>): Promise<any> {
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

    const system = `${agentHeader('Strat', 'the social-media strategist agent (Manager tab)')}

YOU ARE STRAT — the data-driven strategist for the GritSync social team. You read the metrics the operator just pulled from Meta and translate them into a concrete weekly plan. Honesty is the brand: if the data is thin or flat, say so plainly instead of inventing a pattern.

OUTPUT RULES:
- Use ONLY the metrics block below. Never fabricate numbers.
- Every recommendation must be tied to what the data shows — a flat reach, a hot post, a follower-growth dip, etc.
- Topic recommendations should be Filipino-nurse focused (NCLEX, NY pathway, ATT, Pearson VUE, GritSync perks). Captions written in Taglish are explicitly fine when the audience speaks it.
- 3-5 topic recommendations. 2-3 best-times entries (one per connected platform, PH time / Asia/Manila).
- Cadence: integer 1-6/day, with a one-sentence rationale grounded in throughput vs. fatigue.

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
// Walks Meta's cursor-paginated conversations until we hit a sane cap.
// Used by /autoreply/inbox so the lead list reflects the entire history,
// not just the most recent page. Each cursor follow is a separate Graph
// call so we cap aggressively to stay well inside serverless time budgets.
async function fetchAllConversations(
  endpointId: string,
  accessToken: string,
  options: { igPlatform?: boolean; maxThreads?: number } = {}
): Promise<any[]> {
  const maxThreads = options.maxThreads ?? 200
  const all: any[] = []
  let after: string | null = null
  const baseParams: Record<string, string> = {
    fields: 'id,updated_time,snippet,unread_count,participants{name,id}',
    limit: '100',
  }
  if (options.igPlatform) baseParams.platform = 'instagram'

  // Bounded loop: max 5 pages * 100 = 500 conversations theoretical max
  // per account. We cut early at `maxThreads`.
  for (let page = 0; page < 5 && all.length < maxThreads; page++) {
    const params: Record<string, string> = { ...baseParams }
    if (after) params.after = after
    const r = await fbGet(`${endpointId}/conversations`, accessToken, params)
    for (const c of r.data || []) all.push(c)
    after = r.paging?.cursors?.after || null
    if (!after || !r.paging?.next) break
  }
  return all.slice(0, maxThreads)
}

router.get('/autoreply/inbox', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const accounts = await listMetaAccounts()
    const threads: any[] = []
    // PSID → profile pic lookups are billed per request, so we batch
    // them at the end across all accounts and dedup. Capped at the first
    // 80 unique participants (top-of-list bias by recency).
    const picLookups: Array<{ psid: string; accessToken: string; platform: 'facebook' | 'instagram' }> = []
    const picBySender = new Map<string, string | null>()

    await Promise.all(accounts.map(async (acc) => {
      try {
        const isIg = acc.platform === 'instagram'
        const baseId = isIg ? (acc.metadata?.linked_page_id || acc.platform_user_id) : acc.platform_user_id
        if (isIg && !acc.metadata?.linked_page_id) return

        const conversations = await fetchAllConversations(baseId, acc.access_token, { igPlatform: isIg, maxThreads: 200 })
        for (const c of conversations) {
          const participants = (c.participants?.data || []).filter((p: any) => p.id !== acc.platform_user_id)
          const otherId = participants[0]?.id
          if (otherId && !picBySender.has(otherId)) {
            picBySender.set(otherId, null) // placeholder so we don't queue twice
            picLookups.push({ psid: otherId, accessToken: acc.access_token, platform: acc.platform })
          }
          threads.push({
            id: c.id,
            account_id: acc.id,
            account_platform: acc.platform,
            account_name: acc.display_name,
            with_name: participants[0]?.name || 'Unknown',
            with_id: otherId || null,
            with_avatar: null as string | null, // populated below
            snippet: c.snippet || '',
            updated_at: c.updated_time,
            unread: c.unread_count || 0,
          })
        }
      } catch (err: any) {
        console.warn(`Inbox fetch failed for ${acc.platform}:${acc.display_name}:`, err.message)
      }
    }))

    threads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    // Batch fetch profile pics for the first 80 unique participants. FB
    // uses /{psid}?fields=profile_pic (returns a short-lived CDN URL); IG
    // uses /{igsid}?fields=profile_picture_url. Failures fall back to
    // null and the UI shows a placeholder avatar.
    const capped = picLookups.slice(0, 80)
    await Promise.all(capped.map(async (l) => {
      try {
        const field = l.platform === 'instagram' ? 'profile_picture_url' : 'profile_pic'
        const r = await fbGet(l.psid, l.accessToken, { fields: field })
        const url = l.platform === 'instagram' ? r.profile_picture_url : r.profile_pic
        if (url) picBySender.set(l.psid, url)
      } catch { /* profile-pic permission isn't guaranteed; ignore */ }
    }))

    for (const t of threads) {
      if (t.with_id && picBySender.get(t.with_id)) t.with_avatar = picBySender.get(t.with_id) || null
    }

    res.json({ data: { threads } })
  } catch (err: any) {
    console.error('inbox error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/social/avatar?account_id=...&psid=...
// Profile-pic proxy. Meta's `profile_pic` / `profile_picture_url` URLs are
// short-lived CDN links (~1h) that silently 403 after expiry. The frontend
// caches the URL on the inbox listing, but if the operator stays on the
// page past the TTL the avatars break. This endpoint re-resolves a fresh
// CDN URL on demand and redirects, so the browser sees one HTTP request
// per render and the image always loads.
//
// In-memory cache shaves repeat lookups within the URL's lifetime. We
// don't bother persisting it — restarting the server just re-fetches.
const _avatarCache = new Map<string, { url: string; expiresAt: number }>()
const _AVATAR_TTL_MS = 50 * 60 * 1000  // 50 min — under Meta's ~1h CDN TTL
router.get('/avatar', async (req, res) => {
  try {
    const accountId = String(req.query.account_id || '')
    const psid = String(req.query.psid || '')
    if (!accountId || !psid) return res.status(400).send('account_id and psid required')

    const cacheKey = `${accountId}:${psid}`
    const cached = _avatarCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return res.redirect(302, cached.url)
    }

    const acc = (await query(
      `SELECT access_token, platform FROM social_accounts WHERE id = $1`,
      [accountId]
    )).rows[0]
    if (!acc) return res.status(404).send('account not found')

    const field = acc.platform === 'instagram' ? 'profile_picture_url' : 'profile_pic'
    const r = await fbGet(psid, acc.access_token, { fields: field }).catch(() => null)
    const url = acc.platform === 'instagram' ? r?.profile_picture_url : r?.profile_pic
    if (!url) {
      // No permission / not visible. Send a 1x1 transparent gif so the
      // <img onError> branch on the frontend fires cleanly and shows the
      // name-initial chip.
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      res.set('Content-Type', 'image/gif')
      res.set('Cache-Control', 'public, max-age=300')
      return res.send(transparentGif)
    }
    _avatarCache.set(cacheKey, { url, expiresAt: Date.now() + _AVATAR_TTL_MS })
    res.redirect(302, url)
  } catch (err: any) {
    console.warn('avatar proxy failed:', err.message)
    res.status(500).send('avatar lookup failed')
  }
})

// GET /api/social/autoreply/inbox/:thread_id/messages
// Fetches the full message history of one conversation. account_id is needed
// to look up the right page token. Includes attachments (images, stickers,
// files) so the UI can render them in-line and so the draft agent knows
// when the inbound is a photo it should acknowledge.
router.get('/autoreply/inbox/:thread_id/messages', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { thread_id } = req.params
    const account_id = String(req.query.account_id || '')
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })

    const r = (await query(`SELECT access_token, platform_user_id FROM social_accounts WHERE id = $1`, [account_id])).rows[0]
    if (!r) return res.status(404).json({ error: 'Account not found' })

    const msgs = await fbGet(`${thread_id}/messages`, r.access_token, {
      fields: 'id,message,from,to,created_time,attachments{mime_type,name,file_url,image_data}',
      limit: '50',
    })
    // Normalise attachments down to { type, url } so the UI doesn't have
    // to care about FB vs IG's slightly different envelopes.
    const messages = (msgs.data || []).map((m: any) => {
      const raws = m.attachments?.data || []
      const attachments = raws.map((a: any) => {
        const mime = a.mime_type || ''
        const url = a.image_data?.url || a.image_data?.preview_url || a.file_url || null
        return {
          type: mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file',
          url,
          name: a.name || null,
          mime,
        }
      }).filter((a: any) => a.url)
      return { ...m, attachments }
    }).reverse()
    res.json({ data: { messages, account_psid: r.platform_user_id } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Messenger Platform 24-hour standard messaging policy
// (https://developers.facebook.com/docs/messenger-platform/policy-overview):
// a Page can only freely send `messaging_type: RESPONSE` within 24 hours of
// the user's last inbound message. Past that window the Send API returns
// error (#10) "This message is sent outside of allowed window" and the
// message is dropped. To stay compliant Mika checks this window before
// every send — manual or autopilot. We don't auto-escalate to MESSAGE_TAG
// because the only general-purpose tag (HUMAN_AGENT) requires a real human
// behind the reply and is capped at 7 days; an automated agent doesn't
// qualify. If the window has lapsed we surface a clear refusal instead of
// burning the API call.
export const STANDARD_MESSAGING_WINDOW_HOURS = 24

export function hoursSince(iso: string | undefined | null): number {
  if (!iso) return Infinity
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return Infinity
  return (Date.now() - ts) / 36e5
}

// POST /api/social/autoreply/inbox/:thread_id/reply
// Sends a text reply on the conversation. The Messenger Platform requires
// the recipient PSID, not the conversation id — we look it up by fetching
// the conversation's participants and picking the one that isn't our page.
// Accepts an optional `image_url` to send as an image attachment; Meta's
// Send API supports one attachment per call so when both message and image
// are present we send two messages (text first, then image).
//
// Before sending we verify the user has messaged us inside the 24-hour
// standard messaging window. Outside that window we refuse with a 409 so
// the operator UI can show "user hasn't messaged in 24h" instead of
// silently triggering Meta's (#10) outside-allowed-window error.
router.post('/autoreply/inbox/:thread_id/reply', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { thread_id } = req.params
    const { account_id, message, image_url } = req.body || {}
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })
    if (!message?.trim() && !image_url) return res.status(400).json({ error: 'message or image_url is required' })

    const acc = (await query(
      `SELECT access_token, platform_user_id, platform, metadata FROM social_accounts WHERE id = $1`,
      [account_id]
    )).rows[0]
    if (!acc) return res.status(404).json({ error: 'Account not found' })

    // Pull the last few messages so we can find the most recent INBOUND
    // (i.e. from the user, not us) and check the 24h window.
    const conv = await fbGet(`${thread_id}`, acc.access_token, {
      fields: 'participants{id},messages.limit(5){from,created_time}',
    })
    const otherId = (conv.participants?.data || [])
      .map((p: any) => p.id)
      .find((id: string) => id !== acc.platform_user_id)
    if (!otherId) return res.status(400).json({ error: 'Could not determine recipient' })

    const lastInbound = (conv.messages?.data || []).find((m: any) => m.from?.id && m.from.id !== acc.platform_user_id)
    const hrs = hoursSince(lastInbound?.created_time)
    if (hrs > STANDARD_MESSAGING_WINDOW_HOURS) {
      const ago = Number.isFinite(hrs) ? `${hrs.toFixed(1)}h ago` : 'never in the recent history'
      return res.status(409).json({
        error: `Messenger 24h policy: this user last messaged ${ago}. Pages can only send RESPONSE messages within ${STANDARD_MESSAGING_WINDOW_HOURS}h of the user's last inbound (Meta error #10). Wait for them to message again before replying.`,
        code: 'outside_24h_window',
        hours_since_last_inbound: Number.isFinite(hrs) ? Number(hrs.toFixed(2)) : null,
      })
    }

    const sendFromPageId = acc.platform === 'instagram' ? (acc.metadata?.linked_page_id || acc.platform_user_id) : acc.platform_user_id

    // Show the typing indicator just long enough for it to render on the
    // recipient's side, then send immediately. ~350ms is the sweet spot —
    // the "is typing…" pip appears so the reply feels alive, but nobody
    // waits around for it. (Previously the wait scaled with reply length
    // and felt sluggish; the operator asked for instant-after-typing.)
    try {
      await fbPost(`${sendFromPageId}/messages`, acc.access_token, {
        recipient: { id: otherId },
        sender_action: 'typing_on',
      })
    } catch { /* typing_on is a UX nicety — never block the actual send */ }
    await new Promise((r) => setTimeout(r, 350))

    const sentIds: string[] = []
    if (message?.trim()) {
      const j = await fbPost(`${sendFromPageId}/messages`, acc.access_token, {
        recipient: { id: otherId },
        message: { text: message.trim() },
        messaging_type: 'RESPONSE',
      })
      if (j.message_id) sentIds.push(j.message_id)
    }
    if (image_url) {
      const j = await fbPost(`${sendFromPageId}/messages`, acc.access_token, {
        recipient: { id: otherId },
        message: { attachment: { type: 'image', payload: { url: image_url, is_reusable: true } } },
        messaging_type: 'RESPONSE',
      })
      if (j.message_id) sentIds.push(j.message_id)
    }

    // Best-effort: turn typing OFF after the send so the indicator
    // doesn't linger on the user's screen.
    try {
      await fbPost(`${sendFromPageId}/messages`, acc.access_token, {
        recipient: { id: otherId },
        sender_action: 'typing_off',
      })
    } catch { /* same as above — never block the response */ }

    res.json({ data: { message_ids: sentIds } })
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
          // attachment{media,type,url} surfaces images / videos / shared
          // links attached to a comment; the UI renders thumbnails for
          // images so Kuya Jay can acknowledge the photo in his reply.
          const posts = await fbGet(`${acc.platform_user_id}/posts`, acc.access_token, {
            fields: 'id,message,permalink_url,full_picture,comments.limit(10){id,from{id,name,picture{url}},message,created_time,parent,attachment{type,media{image{src}},url}}',
            limit: '15',
          })
          for (const post of posts.data || []) {
            for (const c of post.comments?.data || []) {
              const att = c.attachment
              const attachment = att?.media?.image?.src
                ? { type: 'image', url: att.media.image.src }
                : att?.url ? { type: att.type || 'link', url: att.url }
                : null
              comments.push({
                id: c.id,
                account_id: acc.id,
                account_platform: 'facebook',
                account_name: acc.display_name,
                from_name: c.from?.name || 'Unknown',
                from_avatar: c.from?.picture?.data?.url || null,
                message: c.message || '',
                attachment,
                created_at: c.created_time,
                post: {
                  id: post.id,
                  permalink: post.permalink_url || null,
                  message: (post.message || '').slice(0, 140),
                  thumbnail: post.full_picture || null,
                },
                is_own: c.from?.id === acc.platform_user_id,
              })
            }
          }
        } else {
          const media = await fbGet(`${acc.platform_user_id}/media`, acc.access_token, {
            fields: 'id,caption,permalink,media_url,comments.limit(10){id,from{id,username},text,timestamp,user{username,profile_picture_url}}',
            limit: '15',
          })
          for (const m of media.data || []) {
            for (const c of m.comments?.data || []) {
              // IG comments don't carry attached media via Graph (only
              // GIFs/stickers come through as text). We still surface
              // the parent post's image so the operator has visual ctx.
              comments.push({
                id: c.id,
                account_id: acc.id,
                account_platform: 'instagram',
                account_name: acc.display_name,
                from_name: c.from?.username || c.user?.username || 'someone',
                from_avatar: c.user?.profile_picture_url || null,
                message: c.text || '',
                attachment: null,
                created_at: c.timestamp,
                post: {
                  id: m.id,
                  permalink: m.permalink || null,
                  message: (m.caption || '').slice(0, 140),
                  thumbnail: m.media_url || null,
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
// Replies to a single comment. Accepts optional `image_url`; FB supports
// `attachment_url` directly on the comment, IG doesn't (text-only replies
// to comments per Graph API limits) so we drop the image with a warning
// instead of failing.
router.post('/autoreply/comments/:comment_id/reply', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { comment_id } = req.params
    const { account_id, message, image_url } = req.body || {}
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })
    if (!message?.trim() && !image_url) return res.status(400).json({ error: 'message or image_url is required' })

    const acc = (await query(`SELECT access_token, platform FROM social_accounts WHERE id = $1`, [account_id])).rows[0]
    if (!acc) return res.status(404).json({ error: 'Account not found' })

    const body: Record<string, any> = { message: message?.trim() || '' }
    let note: string | null = null
    if (image_url) {
      if (acc.platform === 'facebook') {
        body.attachment_url = image_url
      } else {
        note = 'Instagram comments can\'t carry image attachments via Graph API — sent text only.'
      }
    }
    const j = await fbPost(`${comment_id}/comments`, acc.access_token, body)
    res.json({ data: { reply_id: j.id, note } })
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
    const { context_kind, message, post_caption, has_inbound_image } = req.body || {}
    // We accept empty message ONLY when there's an inbound image (image-only
    // comment / DM). Without either we have nothing for the agent to react to.
    if (!message?.trim() && !has_inbound_image) return res.status(400).json({ error: 'message or has_inbound_image is required' })

    const isComment = context_kind === 'comment'
    const agentName = isComment ? AGENT_NAMES.comments : AGENT_NAMES.inbox

    // ── Kuya Jay (public comments) ─────────────────────────────────────
    // Taglish-by-default. Filipino-fluent. Brand-face in front of strangers,
    // so the rules are tighter: never expose personal data, always invite
    // private follow-ups, never argue, never quote exact pricing in public.
    const kuyaJaySystem = `${agentHeader('Kuya Jay', 'the public-comments specialist')}

YOU ARE KUYA JAY — replying in public, on a Page or IG post, where everyone can see.

CORE RULE — answer ONLY what was asked:
- Read the comment carefully. Identify the SINGLE thing they're asking. Answer that one thing. Nothing more.
- If they asked one specific question, give one specific answer. Don't add "btw we also offer X..." or volunteer extra info.
- If a relevant official URL helps (https://www.gritsync.com/, /quote, /faqs), include EXACTLY ONE link in the reply. Otherwise no link.
- "Concise" means: 1-2 short sentences whenever possible. Never more than 3.

LANGUAGE — Taglish by default:
- Default style is natural Taglish (Tagalog + English mixed the way Filipinos actually text). Sample feel:
  · "Hi po! Thanks for asking. Pwede po kayong mag-DM para sa step-by-step — or check https://www.gritsync.com/quote para sa personalized plan."
  · "Salamat sa interes! Yes po, NY pathway lang muna kami for now. NYSED-direct kami, kaya mas mabilis."
  · "Naku, naiintindihan po namin. Pa-DM nalang po para ma-check namin sayo."
- Use "po"/"opo" naturally — it's the brand voice for Filipino audiences and signals respect to strangers.
- DO NOT write in pure English unless the inbound comment is clearly all-English AND clearly not from a Filipino speaker.
- DO NOT write in pure deep Tagalog (gawing salita, etc.) — Taglish only.
- Common useful Taglish phrases you can lean on: "Hi po!", "Salamat po sa tanong!", "Pwede po kayong...", "Naku, gets ko po.", "Sige po, pa-DM nalang.", "Check niyo po itong link...", "Para po sa specifics..."

FILIPINO COMMENT ETIQUETTE:
- Always open warmly: "Hi po!", "Salamat sa pag-comment!", "Naku, congrats!" etc.
- Use the commenter's first name when visible — feels personal.
- Emojis: at most 1, only when it fits ("🙏", "💜", "🇵🇭"). Never spam.
- Never argue, never get defensive. If the comment is hostile, give one calm de-escalation: "Pasensya na po kung naging stressful — please DM us para ma-check namin in detail."
- Never reveal private info in public (no application status, no specific timelines for a named person, no internal staff names).
- Don't tag random Pages or other people in the reply.

CTA RULES (one per reply, never two):
- Service-curious comments → "Pa-DM po kayo or check https://www.gritsync.com/quote para sa personalized plan."
- General curiosity → "Punta po kayo sa https://www.gritsync.com/ for the full process overview."
- Specific personal questions ("kelan ATT ko?") → "Pa-DM po kayo para ma-check namin sa system."
- Praise / congrats / thanks → no CTA; just a warm short thank-you.

LENGTH: keep it under 240 characters. One short paragraph, no line breaks.

FEW-SHOT EXAMPLES (match this shape):

Comment: "Magkano po ba total fees nyo?"
Reply: "Hi po! Around $800-$900 po total, split sa dalawang payments. Para sa exact breakdown na fit sa case nyo: https://www.gritsync.com/quote 🙏"

Comment: "Available pa ba ang NY pathway?"
Reply: "Yes po! NY pathway lang muna kami for now, at NYSED-direct kami — hindi kami dumadaan sa CGFNS, kaya mas mabilis. Pa-DM po if you'd like na ma-walk through namin."

Comment: "Scam to. Sayang lang pera."
Reply: "Pasensya na po kung that's how it came across. We'd really like the chance to address your concerns — please DM us your details para ma-check namin nang maayos. Salamat."

Comment: "Congrats sa mga nag-pass!"
Reply: "Salamat po! Sobrang proud kami sa lahat ng nag-grind 💜"

Comment: "How long ang processing nyo?"
Reply: "Typically 6-9 months po from complete application to ATT. NYSED review usually 8-16 weeks, then BON 4-12 weeks. More details: https://www.gritsync.com/"`

    // ── Mika (private DMs / Inbox) ─────────────────────────────────────
    // Private channel, so Mika can ask follow-up questions, quote pricing
    // more precisely, and use slightly more direct language than Kuya Jay.
    const mikaSystem = `${agentHeader('Mika', 'the DM/Inbox concierge')}

YOU ARE MIKA — replying privately in a one-on-one chat.

CORE RULE — answer ONLY what was asked:
- Read the message carefully. Identify the SPECIFIC question. Answer THAT.
- Do NOT volunteer extra info, do NOT explain things they didn't ask about, do NOT add upsells.
- If a relevant official URL is useful, include EXACTLY ONE: https://www.gritsync.com/ (overview), https://www.gritsync.com/quote (pricing/apply), or https://www.gritsync.com/faqs (general questions). Otherwise no link.
- "Concise" means: 1-2 short sentences whenever possible. Max 3.

LANGUAGE:
- Mirror the inbound's language. Taglish for Filipino, English for English. Always warm, never stiff.

TONE:
- Helpful, direct, human. One short paragraph. 0-1 emoji.

WHAT YOU CAN DO IN DMS (vs public comments):
- Quote exact pricing ranges from KB when ASKED about price.
- Ask one targeted follow-up if their question is too vague to answer.
- Walk them through a specific step in the 13-stage tracker if they ask about it.

WHAT YOU STILL CAN'T DO:
- Never share another client's status or info.
- Never promise pass rates, visa outcomes, or specific dates beyond KB ranges.
- Never collect payment info, passport numbers, or sensitive data over Messenger — point to the secure flow on the site.
- Never claim PRC license is required for NCLEX (BSN graduation + nursing diploma is enough through GritSync).

LENGTH HARD CAP: under 280 characters whenever possible. Long answers feel like a robot reading a brochure.`

    const system = isComment ? kuyaJaySystem : mikaSystem

    const imageNote = has_inbound_image
      ? `\n\nNote: the inbound ALSO contains an attached image. Acknowledge it briefly and naturally — Filipino-style ("Ay, salamat sa pic po!" / "Naku, na-receive po namin yung image" / "Thanks for the screenshot!"). Don't describe the image; you can't see it. If the person is clearly asking you to review/check it, route them to DM the Page so a human can look at it.`
      : ''

    const user = `Inbound ${isComment ? 'public comment on one of our posts' : 'direct message'}:
"""
${message?.trim() || '(no text — image only)'}
"""${imageNote}
${post_caption ? `\nOriginal post the comment is on (for context — do not re-quote it):\n"""\n${post_caption}\n"""` : ''}

Return JSON: { "reply": "<the reply text — no surrounding quotes, no leading 'Reply:' label>" }`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 500,
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
    res.json({ data: { reply, agent: agentName } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Internal helper used by both /autoreply/draft and the autorun endpoints
// below. Returns the agent's reply text. Throws on hard failures so the
// caller can decide whether to skip + continue or abort the whole batch.
//
// `few_shot_examples` is the continuous-learning channel: the autopilot
// passes the most recent operator-approved (score=+1) examples so the
// agent's voice progressively matches what was approved. Empty by default.
export async function draftReply(args: {
  agent: 'inbox' | 'comments'
  message: string
  post_caption?: string | null
  has_inbound_image?: boolean
  few_shot_examples?: Array<{ inbound: string; reply: string }>
}): Promise<string> {
  const apiKey = OPENAI_KEY()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set on the server')

  const isComment = args.agent === 'comments'

  // We rebuild the same system + user prompts the public /draft endpoint
  // uses, so autorun and manual-suggest produce identical voices. If you
  // tune one, mirror the change here.
  const systemKuyaJay = `${agentHeader('Kuya Jay', 'the public-comments specialist')}

YOU ARE KUYA JAY — public-facing Taglish replies. Answer ONLY what was asked, in 1-2 short sentences (<240 chars). "po"/"opo" tone. Include exactly ONE official URL when it actually helps (https://www.gritsync.com/, /quote, /faqs); otherwise no link. Never argue. Never volunteer extra info they didn't ask for.`

  const systemMika = `${agentHeader('Mika', 'the DM/Inbox concierge')}

YOU ARE MIKA — private DM concierge. Answer ONLY the specific question they asked, in 1-2 short sentences (<280 chars). Mirror their language (Taglish/English). Include exactly ONE official URL when useful (https://www.gritsync.com/, /quote, /faqs); otherwise no link. Quote pricing ranges from KB only when asked. Never volunteer extra info.`

  const system = isComment ? systemKuyaJay : systemMika

  const imageNote = args.has_inbound_image
    ? `\n\nNote: the inbound ALSO contains an attached image. Acknowledge it naturally in Filipino style. Don't describe the image; you can't see it.`
    : ''

  // Continuous-learning channel: when the autopilot calls us with recent
  // operator-approved (score=+1) examples we inject them as few-shot. The
  // agent's voice progressively matches what the operator has thumbed-up.
  const fewShot = (args.few_shot_examples || []).slice(0, 5)
  const fewShotBlock = fewShot.length
    ? `\n\nRECENT OPERATOR-APPROVED REPLIES (your voice should match these — Filipino tone, length, structure):\n${fewShot.map((e, i) =>
        `Example ${i + 1}\nInbound: "${(e.inbound || '').replace(/"/g, "'").slice(0, 240)}"\nReply: "${(e.reply || '').replace(/"/g, "'").slice(0, 320)}"`
      ).join('\n\n')}`
    : ''

  const userBody = `Inbound ${isComment ? 'public comment' : 'direct message'}:
"""
${args.message?.trim() || '(no text — image only)'}
"""${imageNote}
${args.post_caption ? `\nOriginal post (context — don't re-quote):\n"""\n${args.post_caption}\n"""` : ''}${fewShotBlock}

Return JSON: { "reply": "<the reply text>" }`

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userBody },
      ],
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI HTTP ${r.status}`)
  const text = j.choices?.[0]?.message?.content || '{}'
  try { return (JSON.parse(text).reply || '').trim() } catch { return String(text).trim() }
}

// POST /api/social/autoreply/inbox/:thread_id/quote-turn
// Single-thread Mika turn — pulls the latest messages, runs the quote-
// aware decision tree, sends the reply via Messenger. Used by the operator
// UI to manually trigger Mika on a specific thread (e.g. "kick Mika to
// follow up on this lead now"). The autopilot already calls the same
// `handleMikaQuoteTurn` lib function on every tick.
router.post('/autoreply/inbox/:thread_id/quote-turn', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { thread_id } = req.params
    const { account_id } = req.body || {}
    if (!account_id) return res.status(400).json({ error: 'account_id is required' })

    const acc = (await query(
      `SELECT id, access_token, platform_user_id, platform, metadata
         FROM social_accounts WHERE id = $1`,
      [account_id]
    )).rows[0]
    if (!acc) return res.status(404).json({ error: 'Account not found' })

    // Pull conversation + identify recipient + 24h window check (same rules
    // as the regular /reply route).
    const conv = await fbGet(`${thread_id}`, acc.access_token, {
      fields: 'participants{id,name},messages.limit(15){id,from,message,created_time}',
    })
    const otherParticipant = (conv.participants?.data || [])
      .find((p: any) => p.id !== acc.platform_user_id)
    const otherId = otherParticipant?.id
    if (!otherId) return res.status(400).json({ error: 'Could not determine recipient' })

    const msgs = (conv.messages?.data || []) as Array<any>
    const lastInbound = msgs.find((m) => m.from?.id && m.from.id !== acc.platform_user_id)
    if (!lastInbound) return res.status(400).json({ error: 'No inbound message in this thread to respond to' })

    const hrs = hoursSince(lastInbound.created_time)
    if (hrs > STANDARD_MESSAGING_WINDOW_HOURS) {
      const ago = Number.isFinite(hrs) ? `${hrs.toFixed(1)}h ago` : 'long ago'
      return res.status(409).json({
        error: `Messenger 24h policy: last user message was ${ago}. Can't auto-send (Meta error #10). Wait for them to message again.`,
        code: 'outside_24h_window',
      })
    }

    const conversation = msgs.map((m) => ({
      from: (m.from?.id === acc.platform_user_id ? 'mika' : 'user') as 'mika' | 'user',
      text: String(m.message || ''),
    })).reverse()

    const { handleMikaQuoteTurn, sendMikaReply } = await import('../lib/mika-quote')
    const turn = await handleMikaQuoteTurn({
      thread_id,
      account_id: acc.id,
      conversation,
      inbound: String(lastInbound.message || ''),
      inbound_message_id: lastInbound.id || null,
    })
    await sendMikaReply({ account: acc, recipient_psid: otherId, reply: turn.reply })

    res.json({ data: { reply: turn.reply, status: turn.status, created: turn.created || null } })
  } catch (err: any) {
    console.error('quote-turn error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autoreply/inbox/autorun
// Mika autopilot. Thin wrapper around the shared `runInboxAutopilot()` in
// server/lib/social-autopilot.ts — the same code path the 24/7 scheduler
// uses. Bounded by `max` (default 8) so one manual click can't burn the
// budget. The lib handles caching, 24h policy, learning, and backoff.
router.post('/autoreply/inbox/autorun', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { runInboxAutopilot } = await import('../lib/social-autopilot')
    const max = Number(req.body?.max) || 8
    const r = await runInboxAutopilot(max)
    res.json({ data: { agent: 'Mika', sent_count: r.sent_count, results: r.results } })
  } catch (err: any) {
    console.error('inbox autorun error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autoreply/comments/autorun
// Kuya Jay autopilot. Thin wrapper around `runCommentsAutopilot()`.
router.post('/autoreply/comments/autorun', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { runCommentsAutopilot } = await import('../lib/social-autopilot')
    const max = Number(req.body?.max) || 12
    const r = await runCommentsAutopilot(max)
    res.json({ data: { agent: 'Kuya Jay', sent_count: r.sent_count, results: r.results } })
  } catch (err: any) {
    console.error('comments autorun error:', err)
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
      `SELECT access_token, scopes FROM social_accounts
        WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
          AND status = 'connected'
        ORDER BY connected_at DESC LIMIT 1`
    )).rows[0]

    if (!fbUser) {
      return res.json({ data: { groups: [], note: 'Connect Facebook (Accounts tab) to see groups you can post to.' } })
    }

    type GroupBase = {
      id: string
      name: string
      member_count?: number
      description?: string
      icon?: string
      privacy?: string
    }
    type UserGroup = GroupBase & { source: 'user_admin' }
    type PageGroup = GroupBase & { source: 'page_joined'; via_page: { id: string; name: string } }

    const userGroups: UserGroup[] = []
    const pageGroups: PageGroup[] = []
    const notes: string[] = []

    // ── Source 1: /me/groups (groups the connected USER admins).
    // Requires `user_managed_groups` AND Meta app review for non-dev users.
    const tokenScopes = String(fbUser.scopes || '').toLowerCase()
    const hasUserManagedGroupsScope = tokenScopes.includes('user_managed_groups')
    if (!hasUserManagedGroupsScope) {
      notes.push('Your Facebook token is missing the user_managed_groups scope — disconnect & reconnect in the Accounts tab to grant it.')
    }
    try {
      const r = await fbGet(`me/groups`, fbUser.access_token, {
        fields: 'id,name,member_count,description,icon,privacy',
        limit: '100',
      })
      for (const g of r.data || []) userGroups.push({ ...g, source: 'user_admin' })
    } catch (err: any) {
      notes.push(`/me/groups failed: ${err.message}`)
    }

    // ── Source 2: per-Page /{page_id}/groups (groups each connected Page
    // is a MEMBER of, regardless of whether the personal user admins
    // them). Posts to these groups must go through the PAGE token, not
    // the user token — /groups/share honors via_page.id for that path.
    const pages = (await query(
      `SELECT platform_user_id AS id, display_name AS name, access_token
         FROM social_accounts
        WHERE platform = 'facebook'
          AND platform_user_id NOT LIKE 'fbuser:%'
          AND status = 'connected'`
    )).rows as Array<{ id: string; name: string; access_token: string }>

    await Promise.all(pages.map(async (page) => {
      try {
        const r = await fbGet(`${page.id}/groups`, page.access_token, {
          fields: 'id,name,member_count,description,icon,privacy',
          limit: '100',
        })
        for (const g of r.data || []) {
          pageGroups.push({ ...g, source: 'page_joined', via_page: { id: page.id, name: page.name } })
        }
      } catch (err: any) {
        // Per-Page failures are expected (most Pages don't join groups
        // and the /groups edge requires the Page itself to be a member).
        console.warn(`groups for page ${page.name}:`, err.message)
      }
    }))

    // Sort both lists alphabetically for stable rendering.
    userGroups.sort((a, b) => a.name.localeCompare(b.name))
    pageGroups.sort((a, b) => a.name.localeCompare(b.name))

    if (userGroups.length === 0 && pageGroups.length === 0 && notes.length === 0) {
      notes.push(
        'No groups returned. Common reasons: (a) Meta requires App Review for user_managed_groups before non-dev users see results, ' +
        '(b) the connected user doesn\'t admin any groups, (c) the Pages aren\'t members of any groups. Add candidates below to track groups manually.'
      )
    }

    const candidates = (await query(
      `SELECT id, group_id, name, url, notes, status, created_at
         FROM social_group_candidates
        ORDER BY created_at DESC`
    ).catch(() => ({ rows: [] }))).rows

    res.json({
      data: {
        user_groups: userGroups,
        page_groups: pageGroups,
        // Backwards-compat: keep `groups` populated with the union for
        // any frontend code that hasn't migrated to the split shape yet.
        groups: [...userGroups, ...pageGroups],
        candidates,
        note: notes.join(' · ') || null,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/groups/share
// Posts a link or text into a group. Body:
//   { group_id, message, link?, as_page_id? }
// When as_page_id is set we post AS THAT PAGE using its Page token (works
// for groups the Page is a member of, even when the personal user isn't
// admin). Without it we fall back to the connected user's token (works for
// groups the user admins).
router.post('/groups/share', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { group_id, message, link, as_page_id } = req.body || {}
    if (!group_id) return res.status(400).json({ error: 'group_id is required' })
    if (!message?.trim() && !link) return res.status(400).json({ error: 'message or link is required' })

    let token: string | null = null
    let posting_as: 'page' | 'user' = 'user'
    if (as_page_id) {
      const page = (await query(
        `SELECT access_token FROM social_accounts
          WHERE platform = 'facebook' AND platform_user_id = $1
            AND status = 'connected' LIMIT 1`,
        [as_page_id]
      )).rows[0]
      if (!page) return res.status(404).json({ error: 'Page not found or not connected' })
      token = page.access_token
      posting_as = 'page'
    } else {
      const fbUser = (await query(
        `SELECT access_token FROM social_accounts
          WHERE platform = 'facebook' AND platform_user_id LIKE 'fbuser:%'
            AND status = 'connected' ORDER BY connected_at DESC LIMIT 1`
      )).rows[0]
      if (!fbUser) return res.status(400).json({ error: 'Connect Facebook first' })
      token = fbUser.access_token
    }

    const body: Record<string, any> = { message: message || '' }
    if (link) body.link = link
    const j = await fbPost(`${group_id}/feed`, token!, body)
    res.json({ data: { post_id: j.id, posting_as } })
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

    const system = `${agentHeader('Scout', 'the groups researcher agent')}

YOU ARE SCOUT — you find Facebook communities where GritSync's audience (Filipino nurses pursuing the US/NY pathway) actually hangs out. You only suggest GROUP ARCHETYPES (patterns), never specific group titles you can't verify — those go stale and embarrass the brand when they don't exist.

YOUR JOB:
- Suggest 6-8 archetypes the operator should search on Facebook themselves.
- For each, give a generic search phrase (e.g. "Filipino Nurses USA", "NCLEX NY Pathway", "PRC RN US Migration").
- Explain why each audience matches GritSync (KB-grounded — NY-only processing, NYSED-direct, Filipino-nurse focus).
- Suggest a Filipino-friendly engagement strategy that adds value BEFORE any CTA (answer a question, share a tip, congratulate someone). Hard-sell first-post = ban.

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

// ─── 24/7 Autopilot controls ──────────────────────────────────────────────
//
// The scheduler lives in server/lib/social-autopilot.ts and ticks every 60s
// against the `social_autopilot_state` table. These endpoints are the
// operator UI surface: read state + recent run log, toggle agents on/off,
// adjust interval, and score replies for the continuous-learning loop.

// GET /api/social/autopilot/state
// Returns the per-agent state row plus the next-allowed-run timestamp so
// the UI can render "next tick in 2m 14s" without doing the math.
router.get('/autopilot/state', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await query(
      `SELECT agent, enabled, interval_minutes, max_per_run, last_run_at,
              last_run_summary, consecutive_errors, updated_at
         FROM social_autopilot_state
        ORDER BY agent`
    )
    const data = r.rows.map((row: any) => {
      const backoff = Math.pow(2, Math.min(row.consecutive_errors || 0, 5))
      const nextAt = row.last_run_at
        ? new Date(new Date(row.last_run_at).getTime() + row.interval_minutes * backoff * 60_000).toISOString()
        : null
      return { ...row, next_run_at: nextAt }
    })
    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/social/autopilot/state/:agent
// Toggle enabled / adjust interval / adjust max_per_run. Validation is
// strict — bad values get clamped to safe bounds rather than rejected so
// the UI never has to deal with edit-form error states.
router.put('/autopilot/state/:agent', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const agent = String(req.params.agent || '')
    if (agent !== 'inbox' && agent !== 'comments') {
      return res.status(400).json({ error: 'agent must be "inbox" or "comments"' })
    }
    const { enabled, interval_minutes, max_per_run } = req.body || {}
    const interval = Math.min(60, Math.max(1, Number(interval_minutes) || 5))
    const maxRun = Math.min(50, Math.max(1, Number(max_per_run) || 8))

    const r = await query(
      `UPDATE social_autopilot_state
          SET enabled = COALESCE($2, enabled),
              interval_minutes = $3,
              max_per_run = $4,
              consecutive_errors = CASE WHEN $2 = TRUE THEN 0 ELSE consecutive_errors END,
              updated_at = NOW()
        WHERE agent = $1
       RETURNING *`,
      [agent, typeof enabled === 'boolean' ? enabled : null, interval, maxRun]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'agent state row missing — re-run migration' })
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/social/autopilot/log?agent=inbox&limit=20
// Recent runs across both agents. Operator audits this to see what the
// scheduler has been doing while they were away. We don't expose the full
// per-thread results array in the listing — it's heavy — but each row
// includes the sent/candidate counts and any top-level error.
router.get('/autopilot/log', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const agent = req.query.agent ? String(req.query.agent) : null
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30))
    const args: any[] = []
    let where = ''
    if (agent) { args.push(agent); where = `WHERE agent = $1` }
    const r = await query(
      `SELECT id, agent, ran_at, sent_count, candidates, results, error, duration_ms
         FROM social_autopilot_log
         ${where}
        ORDER BY ran_at DESC
        LIMIT ${limit}`,
      args
    )
    res.json({ data: r.rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/social/autopilot/examples?agent=inbox&score=0&limit=50
// Browse the learning store. Default returns recent unscored examples so
// the operator can rate them.
router.get('/autopilot/examples', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const agent = req.query.agent ? String(req.query.agent) : null
    const score = req.query.score !== undefined ? Number(req.query.score) : null
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
    const conds: string[] = []
    const args: any[] = []
    if (agent) { args.push(agent); conds.push(`agent = $${args.length}`) }
    if (score !== null && Number.isFinite(score)) { args.push(score); conds.push(`score = $${args.length}`) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const r = await query(
      `SELECT id, agent, account_id, thread_or_post, inbound_text, reply_text,
              score, scored_at, created_at
         FROM social_autopilot_examples
         ${where}
        ORDER BY created_at DESC
        LIMIT ${limit}`,
      args
    )
    res.json({ data: r.rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autopilot/examples/:id/score
// Operator thumbs-up (+1) / thumbs-down (-1) on a specific reply. Score=+1
// promotes the example into the few-shot set the agent sees on next draft;
// score=-1 hides it from the cached-reply reuse path so we don't re-send a
// bad reply when the same inbound shows up again.
router.post('/autopilot/examples/:id/score', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id || '')
    const raw = Number(req.body?.score)
    if (!Number.isInteger(raw) || raw < -1 || raw > 1) {
      return res.status(400).json({ error: 'score must be -1, 0, or 1' })
    }
    const r = await query(
      `UPDATE social_autopilot_examples
          SET score = $2, scored_by = $3, scored_at = NOW()
        WHERE id = $1
       RETURNING id, agent, inbound_text, reply_text, score`,
      [id, raw, req.user?.id || null]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'example not found' })
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
