/**
 * 24/7 social autopilot — Mika (inbox) and Kuya Jay (comments).
 *
 * Three responsibilities, kept in one file because they share state:
 *
 *   1. RUNNERS — `runInboxAutopilot(maxPerRun)` and
 *      `runCommentsAutopilot(maxPerRun)`. Pure functions extracted from
 *      the original autoreply autorun routes so both the manual button
 *      and the scheduler call the same code. They return a uniform result
 *      shape `{ sent_count, results: [{ id, account_name, with_name|from_name,
 *      reply, sent, error? }] }`.
 *
 *   2. SCHEDULER — `startSocialAutopilot()` boots a 60s master tick. For
 *      each agent row in `social_autopilot_state` it checks: enabled?
 *      `last_run_at + interval_minutes * backoff` elapsed? If yes, run the
 *      agent's runner, persist a summary to `social_autopilot_state`, and
 *      append a row to `social_autopilot_log`. On failure it increments
 *      `consecutive_errors` so the next tick waits longer (exponential
 *      backoff, capped at 2^5 = 32× the base interval).
 *
 *   3. LEARNING + COST CONTROLS — every successful reply is logged to
 *      `social_autopilot_examples`. Before drafting we:
 *        a) look up exact-match prior inbounds for that agent — if there's
 *           a previously-approved (score >= 0) reply, REUSE IT instead of
 *           calling OpenAI. This is the single biggest cost reduction.
 *        b) if no cache hit, fetch the top 5 score=+1 examples for that
 *           agent and inject them as few-shot context so the model's voice
 *           progressively matches what the operator approves.
 *
 * Meta API call minimization (the operator explicitly asked for this):
 *
 *   - Per-account in-memory high-water marks. The scheduler remembers the
 *     latest `updated_time` it saw per account and skips conversations
 *     whose updated_time hasn't moved.
 *   - Per-account "fresh window": even with cache, we don't ask Meta more
 *     than once per `MIN_FETCH_INTERVAL_MS` (45s) — the Graph API
 *     rate-limits aggressively and the scheduler tick is just a heartbeat.
 *   - Seen-comment ID set per account. We don't re-process comments
 *     already replied-to this process lifetime (bounded LRU of 500).
 *   - Per-account exponential backoff on errors so a misconfigured account
 *     (expired token, revoked permission) doesn't burn quota for the
 *     others.
 *   - Cached-reply reuse skips OpenAI calls when the inbound text is an
 *     exact match for one we've already answered.
 */
import { query } from '../db'
import { listMetaAccounts, fbGet, fbPost, draftReply, hoursSince, STANDARD_MESSAGING_WINDOW_HOURS } from '../routes/social-meta'
import { handleMikaQuoteTurn } from './mika-quote'

type Agent = 'inbox' | 'comments'

interface InboxResult {
  thread_id: string
  account_name: string
  with_name: string
  reply: string
  sent: boolean
  error?: string
  cached?: boolean
}
interface CommentResult {
  comment_id: string
  account_name: string
  from_name: string
  reply: string
  sent: boolean
  error?: string
  cached?: boolean
}

// ── In-memory caches (per-process). Cleared on server restart. ────────────
//
// We deliberately keep these in-process — they're a soft cache to avoid
// hammering Meta, not a source of truth. Restarting the server is harmless;
// the next tick re-discovers state from Meta + the DB.
const MIN_FETCH_INTERVAL_MS = 45 * 1000
const SEEN_COMMENT_LIMIT = 500

interface InboxAccountCache {
  highWaterMark: number      // newest updated_time we've seen (ms)
  lastFetchedAt: number      // when we last hit Meta for this account
  failingUntil: number       // backoff: don't hit Meta until this ms
  consecutiveErrors: number
}
interface CommentsAccountCache {
  seenCommentIds: Set<string>
  seenOrder: string[]        // FIFO for bounded LRU eviction
  lastFetchedAt: number
  failingUntil: number
  consecutiveErrors: number
}

const inboxCache = new Map<string, InboxAccountCache>()
const commentsCache = new Map<string, CommentsAccountCache>()

function getInboxCache(accountId: string): InboxAccountCache {
  let c = inboxCache.get(accountId)
  if (!c) {
    c = { highWaterMark: 0, lastFetchedAt: 0, failingUntil: 0, consecutiveErrors: 0 }
    inboxCache.set(accountId, c)
  }
  return c
}
function getCommentsCache(accountId: string): CommentsAccountCache {
  let c = commentsCache.get(accountId)
  if (!c) {
    c = { seenCommentIds: new Set(), seenOrder: [], lastFetchedAt: 0, failingUntil: 0, consecutiveErrors: 0 }
    commentsCache.set(accountId, c)
  }
  return c
}
function rememberCommentSeen(cache: CommentsAccountCache, id: string) {
  if (cache.seenCommentIds.has(id)) return
  cache.seenCommentIds.add(id)
  cache.seenOrder.push(id)
  while (cache.seenOrder.length > SEEN_COMMENT_LIMIT) {
    const evict = cache.seenOrder.shift()
    if (evict) cache.seenCommentIds.delete(evict)
  }
}
function noteAccountError(cache: { failingUntil: number; consecutiveErrors: number }) {
  cache.consecutiveErrors = Math.min(cache.consecutiveErrors + 1, 8)
  // 1m, 2m, 4m, 8m, 16m, 32m, 64m, 128m ceiling.
  const backoffMs = 60 * 1000 * Math.pow(2, cache.consecutiveErrors - 1)
  cache.failingUntil = Date.now() + backoffMs
}
function noteAccountSuccess(cache: { failingUntil: number; consecutiveErrors: number }) {
  cache.consecutiveErrors = 0
  cache.failingUntil = 0
}

// ── Learning store helpers ────────────────────────────────────────────────
//
// `social_autopilot_examples` holds every reply we've sent. Score lattice:
//   +1 = operator gave thumbs-up (use as few-shot exemplar)
//    0 = unrated (don't promote, but trust enough to short-circuit if
//        the inbound matches verbatim — saves an OpenAI call)
//   -1 = operator gave thumbs-down (skip entirely; never reuse or
//        promote)
//
// Cached-reply reuse — the cost-control core of the continuous-learning
// loop. Two stages, both backed by `social_autopilot_examples`:
//
//   1. EXACT MATCH (score >= 0) — fastest, free. Same trimmed/lowercased
//      inbound seen before? Return that reply.
//   2. FUZZY MATCH (score >= 1, similarity > 0.55) — operator-APPROVED
//      replies only. Trigram similarity via pg_trgm catches "magkano po
//      total?" vs "magkano po ba ang total nyo?" — same answer, different
//      wording. Skips the OpenAI call entirely, saving the cost AND
//      keeping the voice consistent with what the operator already
//      blessed.
//
// Short inbounds (<8 chars) are skipped — "ok", "thanks", "salamat" alone
// don't carry enough signal to reuse a specific past reply.
async function findCachedReply(agent: Agent, inbound: string): Promise<{ reply: string; similarity: number } | null> {
  const norm = inbound.trim().toLowerCase()
  if (!norm || norm.length < 8) return null

  // Exact match — score >= 0 (anything not actively thumbed-down).
  const exact = await query(
    `SELECT reply_text FROM social_autopilot_examples
       WHERE agent = $1
         AND LOWER(TRIM(inbound_text)) = $2
         AND score >= 0
       ORDER BY score DESC, created_at DESC
       LIMIT 1`,
    [agent, norm]
  )
  if (exact.rows[0]) return { reply: exact.rows[0].reply_text, similarity: 1 }

  // Trigram fuzzy match — operator-APPROVED only (score >= 1) so we
  // never re-send a meh reply. 0.55 is a strong-but-not-perfect bar
  // tuned for short Taglish messages where punctuation + "po" placement
  // varies. The GIN index added in the migration makes this O(log n).
  const fuzzy = await query(
    `SELECT reply_text, similarity(LOWER(inbound_text), $2) AS sim
       FROM social_autopilot_examples
      WHERE agent = $1
        AND score >= 1
        AND similarity(LOWER(inbound_text), $2) > 0.55
      ORDER BY sim DESC
      LIMIT 1`,
    [agent, norm]
  )
  if (fuzzy.rows[0]) {
    return { reply: fuzzy.rows[0].reply_text, similarity: Number(fuzzy.rows[0].sim) || 0.55 }
  }
  return null
}
async function fetchFewShot(agent: Agent): Promise<Array<{ inbound: string; reply: string }>> {
  const r = await query(
    `SELECT inbound_text AS inbound, reply_text AS reply
       FROM social_autopilot_examples
      WHERE agent = $1 AND score >= 1
      ORDER BY scored_at DESC NULLS LAST, created_at DESC
      LIMIT 5`,
    [agent]
  )
  return r.rows as Array<{ inbound: string; reply: string }>
}
async function logExample(args: {
  agent: Agent
  account_id?: string | null
  thread_or_post?: string | null
  inbound: string
  reply: string
}) {
  await query(
    `INSERT INTO social_autopilot_examples (agent, account_id, thread_or_post, inbound_text, reply_text)
     VALUES ($1, $2, $3, $4, $5)`,
    [args.agent, args.account_id || null, args.thread_or_post || null, args.inbound, args.reply]
  ).catch((err) => { console.warn('[autopilot] logExample failed:', err.message) })
}

// Wrapped draftReply that checks the cached-reply store first, falls back
// to the model with few-shot examples on miss. Returns `{ reply, cached }`.
async function smartDraft(agent: Agent, args: {
  message: string
  post_caption?: string | null
  has_inbound_image?: boolean
}): Promise<{ reply: string; cached: boolean }> {
  const cached = await findCachedReply(agent, args.message).catch(() => null)
  if (cached) return { reply: cached.reply, cached: true }
  const fewShot = await fetchFewShot(agent).catch(() => [])
  const reply = await draftReply({
    agent,
    message: args.message,
    post_caption: args.post_caption,
    has_inbound_image: args.has_inbound_image,
    few_shot_examples: fewShot,
  })
  return { reply, cached: false }
}

// Export the cache lookup so other agents (Mika quote-turn) can short-
// circuit the LLM when they have a strong learned-knowledge match.
export { findCachedReply }

// ─────────────────────────────────────────────────────────────────────────
// Mika (inbox) runner
// ─────────────────────────────────────────────────────────────────────────
export async function runInboxAutopilot(maxPerRun: number): Promise<{ sent_count: number; results: InboxResult[] }> {
  const max = Math.min(20, Math.max(1, maxPerRun || 8))
  const accounts = await listMetaAccounts()
  const results: InboxResult[] = []

  for (const acc of accounts) {
    if (results.length >= max) break

    const accCache = getInboxCache(acc.id)
    const now = Date.now()

    // Skip accounts in backoff so we don't burn rate limit on a broken token.
    if (accCache.failingUntil > now) continue
    // Don't hit Meta more than once per fresh window per account.
    if (now - accCache.lastFetchedAt < MIN_FETCH_INTERVAL_MS) continue

    try {
      const isIg = acc.platform === 'instagram'
      const baseId = isIg ? (acc.metadata?.linked_page_id || acc.platform_user_id) : acc.platform_user_id
      const params: Record<string, string> = {
        fields: 'id,updated_time,unread_count,participants{name,id},messages.limit(1){message,from,created_time,attachments{mime_type,image_data}}',
        limit: '25',
      }
      if (isIg) params.platform = 'instagram'

      const conv = await fbGet(`${baseId}/conversations`, acc.access_token, params)
      accCache.lastFetchedAt = Date.now()
      noteAccountSuccess(accCache)

      let newestSeen = accCache.highWaterMark

      for (const c of conv.data || []) {
        if (results.length >= max) break
        if (!c.unread_count || c.unread_count === 0) continue

        // High-water mark: skip conversations whose updated_time we've
        // already processed in a previous tick. (First-ever tick: hwm=0
        // so everything passes through, which is correct.)
        const updatedMs = c.updated_time ? new Date(c.updated_time).getTime() : 0
        if (updatedMs && updatedMs <= accCache.highWaterMark) continue
        if (updatedMs > newestSeen) newestSeen = updatedMs

        const lastMsg = c.messages?.data?.[0]
        if (lastMsg?.from?.id === acc.platform_user_id) continue
        const text = String(lastMsg?.message || '').trim()
        const atts = lastMsg?.attachments?.data || []
        const hasImage = atts.some((a: any) => String(a.mime_type || '').startsWith('image/'))
        if (!text && !hasImage) continue

        const participants = (c.participants?.data || []).filter((p: any) => p.id !== acc.platform_user_id)
        const otherId = participants[0]?.id
        if (!otherId) continue

        // 24h standard messaging window — Meta error (#10) if we send past
        // 24h since the user's last message.
        const hrs = hoursSince(lastMsg?.created_time)
        if (hrs > STANDARD_MESSAGING_WINDOW_HOURS) {
          const ago = Number.isFinite(hrs) ? `${hrs.toFixed(1)}h ago` : 'long ago'
          results.push({
            thread_id: c.id,
            account_name: acc.display_name,
            with_name: participants[0]?.name || 'Unknown',
            reply: '',
            sent: false,
            error: `skipped: outside 24h window (last user message ${ago})`,
          })
          continue
        }

        try {
          // Pull the last few messages so the quote-turn LLM sees the whole
          // slot-fill context, not just the latest message. Use the same
          // call we already make for the inbox listing — Meta returns the
          // last 1 message there; this is one additional fetch per active
          // thread but only when there's something to reply to (the unread
          // filter above already gated us).
          let recent: Array<{ from: 'user' | 'mika'; text: string }> = []
          try {
            const mRes = await fbGet(`${c.id}/messages`, acc.access_token, { fields: 'from,message,created_time', limit: '15' })
            recent = (mRes.data || []).map((m: any) => ({
              from: (m.from?.id === acc.platform_user_id ? 'mika' : 'user') as 'user' | 'mika',
              text: String(m.message || ''),
            })).reverse() // Meta returns newest-first; flip to chronological
          } catch { /* fall through with empty history — quote-turn still works */ }

          // Quote-aware Mika turn: detects "I want a quote" intent and
          // slot-fills across multiple turns. For plain chat it just calls
          // the underlying draftReply with the few-shot cache. Status is
          // one of 'chat' | 'collecting' | 'created'.
          const turn = await handleMikaQuoteTurn({
            thread_id: c.id,
            account_id: acc.id,
            conversation: recent,
            inbound: text,
            inbound_message_id: lastMsg?.id || null,
          }).catch(async (err: any) => {
            console.warn('[autopilot] quote-turn failed, falling back to plain chat:', err.message)
            return null
          })

          let reply = ''
          let cached = false
          if (turn) {
            reply = turn.reply
          } else {
            // Fall back to the original chat path with cache + few-shot.
            const sd = await smartDraft('inbox', { message: text, has_inbound_image: hasImage })
            reply = sd.reply
            cached = sd.cached
          }
          if (!reply) continue

          try { await fbPost(`${baseId}/messages`, acc.access_token, { recipient: { id: otherId }, sender_action: 'typing_on' }) } catch {}
          // Just enough for the "is typing…" pip to register, then send.
          await new Promise((r) => setTimeout(r, 350))
          await fbPost(`${baseId}/messages`, acc.access_token, {
            recipient: { id: otherId },
            message: { text: reply },
            messaging_type: 'RESPONSE',
          })
          try { await fbPost(`${baseId}/messages`, acc.access_token, { recipient: { id: otherId }, sender_action: 'typing_off' }) } catch {}

          // Continuous learning: record the inbound + our reply so the
          // operator can score it. Skip the insert when we already had a
          // cache hit — the example is already in the table. For
          // quote-turn replies we still log (they're useful as future
          // training data for intent detection).
          if (!cached) {
            await logExample({ agent: 'inbox', account_id: acc.id, thread_or_post: c.id, inbound: text, reply })
          }

          results.push({
            thread_id: c.id,
            account_name: acc.display_name,
            with_name: participants[0]?.name || 'Unknown',
            reply,
            sent: true,
            cached,
          })
        } catch (sendErr: any) {
          // Per-thread error — don't escalate to account-level backoff.
          results.push({
            thread_id: c.id,
            account_name: acc.display_name,
            with_name: participants[0]?.name || 'Unknown',
            reply: '',
            sent: false,
            error: sendErr.message,
          })
        }
      }

      accCache.highWaterMark = newestSeen
    } catch (err: any) {
      // Account-level failure (auth expired, rate limited, network blip).
      // Mark it as failing so the next few ticks skip it; log but don't
      // throw — the scheduler treats this as a "partial run", not a fatal
      // error.
      noteAccountError(accCache)
      console.warn(`[autopilot] Mika failed for ${acc.platform}:${acc.display_name}: ${err.message}`)
      results.push({
        thread_id: 'account-failure',
        account_name: acc.display_name,
        with_name: '(account)',
        reply: '',
        sent: false,
        error: `account error (backing off): ${err.message}`,
      })
    }
  }

  return { sent_count: results.filter((r) => r.sent).length, results }
}

// ─────────────────────────────────────────────────────────────────────────
// Kuya Jay (comments) runner
// ─────────────────────────────────────────────────────────────────────────
export async function runCommentsAutopilot(maxPerRun: number): Promise<{ sent_count: number; results: CommentResult[] }> {
  const max = Math.min(30, Math.max(1, maxPerRun || 12))
  const accounts = await listMetaAccounts()
  const results: CommentResult[] = []

  for (const acc of accounts) {
    if (results.length >= max) break

    const accCache = getCommentsCache(acc.id)
    const now = Date.now()

    if (accCache.failingUntil > now) continue
    if (now - accCache.lastFetchedAt < MIN_FETCH_INTERVAL_MS) continue

    try {
      if (acc.platform === 'facebook') {
        const posts = await fbGet(`${acc.platform_user_id}/posts`, acc.access_token, {
          fields: 'id,message,comments.limit(10){id,from{id,name},message,comment_count,attachment{type,media{image{src}}}}',
          limit: '10',
        })
        accCache.lastFetchedAt = Date.now()
        noteAccountSuccess(accCache)

        for (const post of posts.data || []) {
          for (const c of post.comments?.data || []) {
            if (results.length >= max) break
            if (c.from?.id === acc.platform_user_id) continue
            // Already-seen-this-process dedup so we don't try to re-reply
            // to a comment that's still showing comment_count=0 because of
            // Meta's eventual consistency.
            if (accCache.seenCommentIds.has(c.id)) continue
            if (c.comment_count && c.comment_count > 0) { rememberCommentSeen(accCache, c.id); continue }
            const text = String(c.message || '').trim()
            const hasImage = c.attachment?.media?.image?.src ? true : false
            if (!text && !hasImage) continue
            try {
              const { reply, cached } = await smartDraft('comments', {
                message: text,
                post_caption: (post.message || '').slice(0, 240),
                has_inbound_image: hasImage,
              })
              if (!reply) continue
              await fbPost(`${c.id}/comments`, acc.access_token, { message: reply })
              rememberCommentSeen(accCache, c.id)
              if (!cached) {
                await logExample({ agent: 'comments', account_id: acc.id, thread_or_post: post.id, inbound: text, reply })
              }
              results.push({
                comment_id: c.id,
                account_name: acc.display_name,
                from_name: c.from?.name || 'Unknown',
                reply,
                sent: true,
                cached,
              })
            } catch (sendErr: any) {
              results.push({
                comment_id: c.id,
                account_name: acc.display_name,
                from_name: c.from?.name || 'Unknown',
                reply: '',
                sent: false,
                error: sendErr.message,
              })
            }
          }
        }
      } else {
        const media = await fbGet(`${acc.platform_user_id}/media`, acc.access_token, {
          fields: 'id,caption,comments.limit(10){id,from{id,username},text,user{username}}',
          limit: '10',
        })
        accCache.lastFetchedAt = Date.now()
        noteAccountSuccess(accCache)

        for (const m of media.data || []) {
          for (const c of m.comments?.data || []) {
            if (results.length >= max) break
            if (accCache.seenCommentIds.has(c.id)) continue
            const text = String(c.text || '').trim()
            if (!text) continue
            try {
              const { reply, cached } = await smartDraft('comments', {
                message: text,
                post_caption: (m.caption || '').slice(0, 240),
              })
              if (!reply) continue
              await fbPost(`${c.id}/comments`, acc.access_token, { message: reply })
              rememberCommentSeen(accCache, c.id)
              if (!cached) {
                await logExample({ agent: 'comments', account_id: acc.id, thread_or_post: m.id, inbound: text, reply })
              }
              results.push({
                comment_id: c.id,
                account_name: acc.display_name,
                from_name: c.from?.username || c.user?.username || 'someone',
                reply,
                sent: true,
                cached,
              })
            } catch (sendErr: any) {
              results.push({
                comment_id: c.id,
                account_name: acc.display_name,
                from_name: c.from?.username || 'someone',
                reply: '',
                sent: false,
                error: sendErr.message,
              })
            }
          }
        }
      }
    } catch (err: any) {
      noteAccountError(accCache)
      console.warn(`[autopilot] Kuya Jay failed for ${acc.platform}:${acc.display_name}: ${err.message}`)
      results.push({
        comment_id: 'account-failure',
        account_name: acc.display_name,
        from_name: '(account)',
        reply: '',
        sent: false,
        error: `account error (backing off): ${err.message}`,
      })
    }
  }

  return { sent_count: results.filter((r) => r.sent).length, results }
}

// ─────────────────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────────────────
//
// One master setInterval(60s). Each tick:
//   1. Read social_autopilot_state for both agents.
//   2. For each enabled agent whose backoff-adjusted interval has elapsed:
//      - Run the runner.
//      - Persist last_run_at / summary / consecutive_errors.
//      - Append a row to social_autopilot_log.
//   3. Swallow all errors — the scheduler must never crash the process.
const TICK_MS = 60 * 1000
const MAX_BACKOFF_EXP = 5    // ceiling so a long outage doesn't pause forever
let schedulerTimer: NodeJS.Timeout | null = null
let tickInFlight = false

interface AutopilotStateRow {
  agent: Agent
  enabled: boolean
  interval_minutes: number
  max_per_run: number
  last_run_at: string | null
  consecutive_errors: number
}

async function readState(): Promise<AutopilotStateRow[]> {
  const r = await query(
    `SELECT agent, enabled, interval_minutes, max_per_run, last_run_at, consecutive_errors
       FROM social_autopilot_state
      ORDER BY agent`
  )
  return r.rows as AutopilotStateRow[]
}

function shouldRunNow(row: AutopilotStateRow): boolean {
  if (!row.enabled) return false
  if (!row.last_run_at) return true
  const backoff = Math.pow(2, Math.min(row.consecutive_errors, MAX_BACKOFF_EXP))
  const effectiveMin = row.interval_minutes * backoff
  const elapsedMin = (Date.now() - new Date(row.last_run_at).getTime()) / 60_000
  return elapsedMin >= effectiveMin
}

export async function tickOnce() {
  if (tickInFlight) return
  tickInFlight = true
  try {
    const rows = await readState()
    for (const row of rows) {
      if (!shouldRunNow(row)) continue
      const startedAt = Date.now()
      let summary: any = null
      let topLevelError: string | null = null

      try {
        const r = row.agent === 'inbox'
          ? await runInboxAutopilot(row.max_per_run)
          : await runCommentsAutopilot(row.max_per_run)
        summary = { sent_count: r.sent_count, candidates: r.results.length, results: r.results }
      } catch (err: any) {
        topLevelError = err.message || 'unknown error'
        console.error(`[autopilot] ${row.agent} tick failed:`, topLevelError)
      }

      const durationMs = Date.now() - startedAt

      // Persist state + log. Both queries are best-effort — if Postgres is
      // hiccuping we don't want the scheduler to die.
      try {
        if (topLevelError) {
          await query(
            `UPDATE social_autopilot_state
                SET last_run_at = NOW(),
                    last_run_summary = $2,
                    consecutive_errors = consecutive_errors + 1,
                    updated_at = NOW()
              WHERE agent = $1`,
            [row.agent, { error: topLevelError }]
          )
        } else {
          await query(
            `UPDATE social_autopilot_state
                SET last_run_at = NOW(),
                    last_run_summary = $2,
                    consecutive_errors = 0,
                    updated_at = NOW()
              WHERE agent = $1`,
            [row.agent, { sent_count: summary?.sent_count || 0, candidates: summary?.candidates || 0 }]
          )
        }

        await query(
          `INSERT INTO social_autopilot_log (agent, sent_count, candidates, results, error, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            row.agent,
            summary?.sent_count || 0,
            summary?.candidates || 0,
            JSON.stringify(summary?.results || []),
            topLevelError,
            durationMs,
          ]
        )
      } catch (dbErr: any) {
        console.error(`[autopilot] failed to persist tick state for ${row.agent}:`, dbErr.message)
      }
    }
  } catch (outer: any) {
    console.error('[autopilot] master tick crashed (swallowed):', outer.message)
  } finally {
    tickInFlight = false
  }
}

export function startSocialAutopilot() {
  if (schedulerTimer) return // already started
  // Fire one tick on boot so the operator sees activity quickly after
  // toggling an agent on, instead of waiting up to 60s.
  setImmediate(() => { tickOnce().catch(() => {}) })
  schedulerTimer = setInterval(() => { tickOnce().catch(() => {}) }, TICK_MS)
  console.log('[autopilot] social autopilot scheduler started (60s tick)')
}

export function stopSocialAutopilot() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
