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

// POST /api/social/autoreply/inbox/:thread_id/reply
// Sends a text reply on the conversation. The Messenger Platform requires
// the recipient PSID, not the conversation id — we look it up by fetching
// the conversation's participants and picking the one that isn't our page.
// Accepts an optional `image_url` to send as an image attachment; Meta's
// Send API supports one attachment per call so when both message and image
// are present we send two messages (text first, then image).
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

    const conv = await fbGet(`${thread_id}`, acc.access_token, { fields: 'participants{id}' })
    const otherId = (conv.participants?.data || [])
      .map((p: any) => p.id)
      .find((id: string) => id !== acc.platform_user_id)
    if (!otherId) return res.status(400).json({ error: 'Could not determine recipient' })

    const sendFromPageId = acc.platform === 'instagram' ? (acc.metadata?.linked_page_id || acc.platform_user_id) : acc.platform_user_id

    // Human feel: turn on Meta's native typing indicator before posting,
    // wait a beat scaled to message length (max 3s), then send. The
    // recipient sees the "Mika is typing…" dots just like a person.
    try {
      await fbPost(`${sendFromPageId}/messages`, acc.access_token, {
        recipient: { id: otherId },
        sender_action: 'typing_on',
      })
    } catch { /* typing_on is a UX nicety — never block the actual send */ }

    const typingMs = Math.min(3000, 600 + (message?.trim().length || 0) * 25)
    await new Promise((r) => setTimeout(r, typingMs))

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
async function draftReply(args: {
  agent: 'inbox' | 'comments'
  message: string
  post_caption?: string | null
  has_inbound_image?: boolean
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

  const userBody = `Inbound ${isComment ? 'public comment' : 'direct message'}:
"""
${args.message?.trim() || '(no text — image only)'}
"""${imageNote}
${args.post_caption ? `\nOriginal post (context — don't re-quote):\n"""\n${args.post_caption}\n"""` : ''}

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

// POST /api/social/autoreply/inbox/autorun
// Mika autopilot. Walks every UNREAD thread across connected FB+IG inboxes,
// drafts a reply, and sends it (with the real Messenger typing indicator).
// Bounded by `max` (default 8) so a runaway thread count can't burn budget.
router.post('/autoreply/inbox/autorun', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const max = Math.min(20, Math.max(1, Number(req.body?.max) || 8))
    const accounts = await listMetaAccounts()

    type Result = { thread_id: string; account_name: string; with_name: string; reply: string; sent: boolean; error?: string }
    const results: Result[] = []

    for (const acc of accounts) {
      if (results.length >= max) break
      try {
        const isIg = acc.platform === 'instagram'
        const baseId = isIg ? (acc.metadata?.linked_page_id || acc.platform_user_id) : acc.platform_user_id
        const params: Record<string, string> = {
          fields: 'id,updated_time,unread_count,participants{name,id},messages.limit(1){message,from,attachments{mime_type,image_data}}',
          limit: '25',
        }
        if (isIg) params.platform = 'instagram'
        const conv = await fbGet(`${baseId}/conversations`, acc.access_token, params)

        for (const c of conv.data || []) {
          if (results.length >= max) break
          if (!c.unread_count || c.unread_count === 0) continue

          const lastMsg = c.messages?.data?.[0]
          // Don't reply if our last action WAS already a reply from us.
          if (lastMsg?.from?.id === acc.platform_user_id) continue
          const text = String(lastMsg?.message || '').trim()
          const atts = lastMsg?.attachments?.data || []
          const hasImage = atts.some((a: any) => String(a.mime_type || '').startsWith('image/'))
          if (!text && !hasImage) continue

          const participants = (c.participants?.data || []).filter((p: any) => p.id !== acc.platform_user_id)
          const otherId = participants[0]?.id
          if (!otherId) continue

          try {
            const reply = await draftReply({ agent: 'inbox', message: text, has_inbound_image: hasImage })
            if (!reply) continue

            // Typing on → pause → send → typing off (real human feel).
            try { await fbPost(`${baseId}/messages`, acc.access_token, { recipient: { id: otherId }, sender_action: 'typing_on' }) } catch {}
            await new Promise((r) => setTimeout(r, Math.min(3000, 600 + reply.length * 25)))
            await fbPost(`${baseId}/messages`, acc.access_token, {
              recipient: { id: otherId },
              message: { text: reply },
              messaging_type: 'RESPONSE',
            })
            try { await fbPost(`${baseId}/messages`, acc.access_token, { recipient: { id: otherId }, sender_action: 'typing_off' }) } catch {}

            results.push({ thread_id: c.id, account_name: acc.display_name, with_name: participants[0]?.name || 'Unknown', reply, sent: true })
          } catch (sendErr: any) {
            results.push({ thread_id: c.id, account_name: acc.display_name, with_name: participants[0]?.name || 'Unknown', reply: '', sent: false, error: sendErr.message })
          }
        }
      } catch (err: any) {
        console.warn(`Mika autorun failed for ${acc.platform}:${acc.display_name}:`, err.message)
      }
    }

    res.json({ data: { agent: 'Mika', sent_count: results.filter((r) => r.sent).length, results } })
  } catch (err: any) {
    console.error('inbox autorun error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/social/autoreply/comments/autorun
// Kuya Jay autopilot. Walks recent comments across all connected FB+IG
// accounts; for each that isn't from our own Page/IG and doesn't already
// have a Page reply nested under it, drafts a Taglish reply and posts it.
router.post('/autoreply/comments/autorun', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const max = Math.min(30, Math.max(1, Number(req.body?.max) || 12))
    const accounts = await listMetaAccounts()
    type Result = { comment_id: string; account_name: string; from_name: string; reply: string; sent: boolean; error?: string }
    const results: Result[] = []

    for (const acc of accounts) {
      if (results.length >= max) break
      try {
        if (acc.platform === 'facebook') {
          // comment_count on each child reply tells us if we already replied.
          const posts = await fbGet(`${acc.platform_user_id}/posts`, acc.access_token, {
            fields: 'id,message,comments.limit(10){id,from{id,name},message,comment_count,attachment{type,media{image{src}}}}',
            limit: '10',
          })
          for (const post of posts.data || []) {
            for (const c of post.comments?.data || []) {
              if (results.length >= max) break
              if (c.from?.id === acc.platform_user_id) continue
              // Skip if we've already replied to this comment (Page-level
              // replies are nested as a child comment with comment_count>0
              // when they exist). This isn't perfect — Meta doesn't tell us
              // who authored the child — but it stops obvious double-replies.
              if (c.comment_count && c.comment_count > 0) continue
              const text = String(c.message || '').trim()
              const att = c.attachment?.media?.image?.src ? true : false
              if (!text && !att) continue
              try {
                const reply = await draftReply({
                  agent: 'comments',
                  message: text,
                  post_caption: (post.message || '').slice(0, 240),
                  has_inbound_image: att,
                })
                if (!reply) continue
                await fbPost(`${c.id}/comments`, acc.access_token, { message: reply })
                results.push({ comment_id: c.id, account_name: acc.display_name, from_name: c.from?.name || 'Unknown', reply, sent: true })
              } catch (sendErr: any) {
                results.push({ comment_id: c.id, account_name: acc.display_name, from_name: c.from?.name || 'Unknown', reply: '', sent: false, error: sendErr.message })
              }
            }
          }
        } else {
          const media = await fbGet(`${acc.platform_user_id}/media`, acc.access_token, {
            fields: 'id,caption,comments.limit(10){id,from{id,username},text,user{username}}',
            limit: '10',
          })
          for (const m of media.data || []) {
            for (const c of m.comments?.data || []) {
              if (results.length >= max) break
              const text = String(c.text || '').trim()
              if (!text) continue
              try {
                const reply = await draftReply({
                  agent: 'comments',
                  message: text,
                  post_caption: (m.caption || '').slice(0, 240),
                })
                if (!reply) continue
                await fbPost(`${c.id}/comments`, acc.access_token, { message: reply })
                results.push({ comment_id: c.id, account_name: acc.display_name, from_name: c.from?.username || c.user?.username || 'someone', reply, sent: true })
              } catch (sendErr: any) {
                results.push({ comment_id: c.id, account_name: acc.display_name, from_name: c.from?.username || 'someone', reply: '', sent: false, error: sendErr.message })
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`Kuya Jay autorun failed for ${acc.platform}:${acc.display_name}:`, err.message)
      }
    }

    res.json({ data: { agent: 'Kuya Jay', sent_count: results.filter((r) => r.sent).length, results } })
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

export default router
