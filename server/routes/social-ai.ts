import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import pool from '../db'
import { isDriveConnected, uploadToDrive } from '../lib/google-drive'
import { GRITSYNC_KB } from '../lib/gritsync-knowledge'

const router = Router()

const OPENAI_KEY = () => process.env.OPENAI_API_KEY
const GOOGLE_KEY = () => process.env.GOOGLE_API_KEY
const XAI_KEY = () => process.env.XAI_API_KEY
const REPLICATE_KEY = () => process.env.REPLICATE_API_TOKEN
const REPLICATE_VIDEO_MODEL = () => process.env.REPLICATE_VIDEO_MODEL || 'luma/ray-flash-2-540p'

type ImageProvider = 'openai' | 'nano-banana' | 'grok'

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// POST /api/social/ai/caption
// Generates 3 caption variants for the requested platforms.
// Body: { topic, platforms?: string[], tone?, length?, hashtags?, emojis?, audience? }
// ---------------------------------------------------------------------------
router.post('/caption', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const {
      topic,
      platforms = [],
      tone = 'professional',
      length = 'medium',
      hashtags = true,
      emojis = true,
      audience = '',
      language = 'English',
    } = req.body || {}

    if (!topic || !String(topic).trim()) {
      return res.status(400).json({ error: 'topic is required' })
    }

    const lengthHint =
      length === 'short' ? 'Under 100 characters.'
      : length === 'long' ? 'Around 250-400 characters across 2-3 short paragraphs.'
      : 'Around 120-220 characters.'

    const platformLine = platforms.length
      ? `The same caption will be cross-posted to: ${platforms.join(', ')}. Keep it short enough to work on every platform.`
      : 'Platform-agnostic — works for any social network.'

    const system = `You are a social-media copywriter for GritSync. Use the ground-truth facts below as the single source of company information — every line of copy you write must be consistent with them.

${GRITSYNC_KB}

Write warm, credible, specific captions. Avoid clichés and corporate-speak. Never fabricate stats or testimonials.`

    const user = `Write 3 distinct caption variants for this post.

Topic / brief: ${topic}
Tone: ${tone}
Length: ${lengthHint}
Include hashtags: ${hashtags ? 'yes — 3-6 relevant ones at the end' : 'no'}
Include emojis: ${emojis ? 'yes — sparingly, one or two max' : 'no'}
Audience hint: ${audience || 'GritSync followers (mostly nurses considering US migration or NCLEX prep)'}
Language: ${language}
${platformLine}

Return ONLY this JSON object — no surrounding text, no markdown fence:
{ "captions": ["First caption…", "Second caption…", "Third caption…"] }`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })
    }
    const text = j.choices?.[0]?.message?.content || ''
    let captions: string[] = []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) captions = parsed
      else if (Array.isArray(parsed.captions)) captions = parsed.captions
      else if (Array.isArray(parsed.variants)) captions = parsed.variants
    } catch {
      captions = text.split(/\n{2,}/).map((s: string) => s.trim()).filter(Boolean).slice(0, 3)
    }
    captions = captions.filter((c) => typeof c === 'string' && c.trim()).slice(0, 3)
    if (!captions.length) return res.status(502).json({ error: 'No captions produced' })
    res.json({ data: { captions } })
  } catch (err: any) {
    console.error('AI caption error:', err)
    res.status(500).json({ error: err.message || 'AI caption failed' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/ai/image
// Generates one image, saves it to public storage, and returns a URL the
// social platforms can fetch. Body: { prompt, aspect_ratio?, style?, quality? }
// ---------------------------------------------------------------------------
router.post('/image', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt, aspect_ratio = '1:1', style = '' } = req.body || {}
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' })

    const fullPrompt = style ? `${prompt}. Style: ${style}.` : prompt
    // Funnel through the same cascading provider helper used by the bank
    // generator so /image also benefits from the DALL·E-3 → DALL·E-2
    // (→ gpt-image-1 last-resort) fallback when project access is gated.
    try {
      const url = await generateImageOpenAI(fullPrompt, aspect_ratio)
      res.json({ data: { url, prompt: fullPrompt, aspect_ratio } })
    } catch (err: any) {
      return res.status(502).json({ error: err.message || 'OpenAI image generation failed' })
    }
  } catch (err: any) {
    console.error('AI image error:', err)
    res.status(500).json({ error: err.message || 'AI image failed' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/ai/refine-master-prompt
// Continuous-learning loop for the image-AI master prompt. Takes the
// operator's current master prompt + optional context (active topic,
// campaign goal) and asks gpt-4o-mini to propose an improved version
// that hews to GritSync's brand. Returns the refined prompt + a short
// reasoning blurb. The client overwrites its localStorage-backed prompt
// only after the operator reviews + clicks Save, so AI never silently
// rewrites brand-critical copy.
//
// Body: { current_prompt: string, topic?: string|null, goal_brief?: string|null }
// Returns: { data: { refined_prompt: string, reasoning: string } }
// ---------------------------------------------------------------------------
router.post('/refine-master-prompt', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const { current_prompt, topic = null, goal_brief = null } = req.body || {}
    if (!current_prompt || !String(current_prompt).trim()) {
      return res.status(400).json({ error: 'current_prompt is required' })
    }

    const system = `You are a senior creative director who specialises in writing image-generation prompts for premium social-media advertisements. The renderer is DALL·E 3 (hd + natural style), so your refinements should lean into what DALL·E 3 does best — photorealism, cinematic lighting, layered compositions, accurate fabric and skin textures. Avoid prompt patterns that only gpt-image-1 reliably renders (e.g. long arbitrary text strings, perfect typography).

You're refining a "master image prompt" for GritSync, an NCLEX-processing agency that helps Filipino-trained nurses become USRNs. The master prompt is a GUIDE, not a contract — you have license to restructure, drop sections, or add new ones if the brief reads better that way. Use these ground-truth facts so the refined prompt stays brand-aligned:

${GRITSYNC_KB}

Refinement rules:
- Treat the master prompt as inspiration: keep the brand feel (color palette, subject identity, composition language) but you may rearrange sections, prune dead phrases, or add fresh visual ideas that strengthen the spec.
- IMPROVE specificity: tighter visual language, more cinematic descriptors, clearer subject blocking.
- KEEP the brand identity intact — GritSync as the agency name, gritsync.com as the URL, "USRN" / "NCLEX" framing. If headline/CTA text appears, keep its meaning even if you reword for brevity.
- DO NOT add fabricated claims (no "guaranteed pass", "100% success", named hospitals, fabricated stats).
- DO NOT add ethnicities other than Filipino, or US-specific landmarks the brand hasn't endorsed.
- ALWAYS include a negative-prompt section — strengthen anti-artifact terms ("distorted hands", "warped documents", "AI text glitches", etc.).
- LENGTH: similar order of magnitude to the input — don't more than double or less than half it.`

    const userPayload: string[] = [
      'Current master image prompt:',
      '"""',
      String(current_prompt),
      '"""',
    ]
    if (topic) {
      userPayload.push('', `Operator is currently writing about: ${topic}`)
    }
    if (goal_brief) {
      userPayload.push('', `Campaign goal context: ${goal_brief}`)
    }
    userPayload.push(
      '',
      'Return ONLY this JSON object — no markdown fence, no prose around it:',
      `{ "refined_prompt": "<full refined prompt, multi-line with \\n line breaks>", "reasoning": "<one short sentence summarising what you changed and why>" }`
    )

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 2400,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPayload.join('\n') },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })
    }
    const text = j.choices?.[0]?.message?.content || ''
    let refined_prompt = ''
    let reasoning = ''
    try {
      const parsed = JSON.parse(text)
      refined_prompt = typeof parsed.refined_prompt === 'string' ? parsed.refined_prompt.trim() : ''
      reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : ''
    } catch {
      // If the model returned something un-JSONable, treat the whole
      // body as the refined prompt and skip the reasoning.
      refined_prompt = String(text).trim()
    }
    if (!refined_prompt) {
      return res.status(502).json({ error: 'Refinement produced no prompt' })
    }
    // Log the refinement so we can audit how the operator's master
    // prompt evolved over time (Postgres column is JSONB on a tiny
    // helper table — best-effort, never blocks the response).
    pool.query(
      `INSERT INTO social_ai_prompt_refinements (user_id, kind, source_prompt, refined_prompt, reasoning, topic, goal_brief)
       VALUES ($1, 'image_prompt', $2, $3, $4, $5, $6)`,
      [req.user?.id || null, current_prompt, refined_prompt, reasoning || null, topic || null, goal_brief || null]
    ).catch(() => { /* table may not exist yet — refinement logging is best-effort */ })
    res.json({ data: { refined_prompt, reasoning } })
  } catch (err: any) {
    console.error('AI refine-master-prompt error:', err)
    res.status(500).json({ error: err.message || 'AI refine failed' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/ai/refine-master-caption-format
// Sibling endpoint to /refine-master-prompt — refines the 11-section
// master caption format instead of the image prompt. Same contract:
// returns a refined version and a reasoning blurb; the client previews
// the result in its editor before persisting.
//
// Body: { current_format: string, topic?: string|null, goal_brief?: string|null }
// Returns: { data: { refined_format: string, reasoning: string } }
// ---------------------------------------------------------------------------
router.post('/refine-master-caption-format', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const { current_format, topic = null, goal_brief = null } = req.body || {}
    if (!current_format || !String(current_format).trim()) {
      return res.status(400).json({ error: 'current_format is required' })
    }

    const system = `You are a senior social-media copywriter who specialises in long-form, conversion-focused Taglish captions for Filipino healthcare audiences. You're refining a "master caption format" template for GritSync, an NCLEX-processing agency for Filipino-trained nurses. Use these ground-truth facts so the refined format stays brand-aligned:

${GRITSYNC_KB}

The current format is the 11-section structural blueprint every generated caption follows: HOOK → SELF-CHECK → PROBLEM REFRAME → GRITSYNC SOLUTION → GRITSYNC PERKS → FUTURE VISION → AUTHORITY / TRUST → DECISION QUESTIONS → CALL TO ACTION → BRAND SIGN-OFF → HASHTAGS.

Refinement rules:
- KEEP all 11 sections and their numbered headings — the structure is the brand. Do not collapse, drop, or reorder them.
- KEEP brand-critical strings exactly: "GritSync", "gritsync.com", "www.gritsync.com/quote", "NCLEX", "USRN", "CGFNS", "ATT", "VisaScreen". Do not paraphrase them.
- IMPROVE within sections: tighter hooks, sharper rhetorical questions, cleaner Taglish, more concrete scenes — but never invent claims that contradict the ground-truth (no "guaranteed pass", no fabricated stats, no named hospitals).
- KEEP the perks list (Free Business Email Setup, Application Guidance System, Priority Processing Assistance, Personalized NCLEX Roadmap) intact even if reordered for cadence.
- KEEP at least 8 hashtags in section 11.
- LENGTH: similar order of magnitude to the input — don't more than double or less than half it. Long is the point.`

    const userPayload: string[] = [
      'Current master caption format:',
      '"""',
      String(current_format),
      '"""',
    ]
    if (topic) userPayload.push('', `Operator is currently writing about: ${topic}`)
    if (goal_brief) userPayload.push('', `Campaign goal context: ${goal_brief}`)
    userPayload.push(
      '',
      'Return ONLY this JSON object — no markdown fence, no prose around it:',
      `{ "refined_format": "<full refined 11-section format, multi-line with \\n line breaks>", "reasoning": "<one short sentence summarising what you changed and why>" }`
    )

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 3200,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPayload.join('\n') },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })

    const text = j.choices?.[0]?.message?.content || ''
    let refined_format = ''
    let reasoning = ''
    try {
      const parsed = JSON.parse(text)
      refined_format = typeof parsed.refined_format === 'string' ? parsed.refined_format.trim() : ''
      reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : ''
    } catch {
      refined_format = String(text).trim()
    }
    if (!refined_format) return res.status(502).json({ error: 'Refinement produced no format' })

    // Same audit log as the image-prompt refinement — `kind` column
    // distinguishes the two paths. Best-effort INSERT; never blocks.
    pool.query(
      `INSERT INTO social_ai_prompt_refinements (user_id, kind, source_prompt, refined_prompt, reasoning, topic, goal_brief)
       VALUES ($1, 'caption_format', $2, $3, $4, $5, $6)`,
      [req.user?.id || null, current_format, refined_format, reasoning || null, topic || null, goal_brief || null]
    ).catch(() => { /* table may not exist yet — refinement logging is best-effort */ })

    res.json({ data: { refined_format, reasoning } })
  } catch (err: any) {
    console.error('AI refine-master-caption-format error:', err)
    res.status(500).json({ error: err.message || 'AI refine failed' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/ai/video
// Kicks off a text-to-video Replicate prediction. Body: { prompt,
// aspect_ratio?, duration? }. Returns the prediction id; the client polls
// GET /api/social/ai/video/:id to learn when it's ready.
// ---------------------------------------------------------------------------
router.post('/video', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = REPLICATE_KEY()
    if (!apiKey) return res.status(400).json({ error: 'REPLICATE_API_TOKEN is not set on the server' })

    const { prompt, aspect_ratio = '9:16', duration = 5 } = req.body || {}
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' })

    const model = REPLICATE_VIDEO_MODEL()
    const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        Prefer: 'respond-async',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio,
          duration: Number(duration) || 5,
        },
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.detail || j.error || `Replicate HTTP ${r.status}` })

    res.json({ data: { id: j.id, status: j.status || 'starting' } })
  } catch (err: any) {
    console.error('AI video error:', err)
    res.status(500).json({ error: err.message || 'AI video failed' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/social/ai/video/:id — poll Replicate for the prediction status.
// Once the model produces a video, we download it once and serve our own
// public URL so platform CDNs don't 404 when Replicate's signed URL expires.
// ---------------------------------------------------------------------------
const cachedVideoUrls = new Map<string, string>() // prediction id → our public URL

router.get('/video/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = REPLICATE_KEY()
    if (!apiKey) return res.status(400).json({ error: 'REPLICATE_API_TOKEN is not set on the server' })
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'id is required' })

    // If we've already re-hosted this prediction, short-circuit so we don't hit
    // Replicate on every poll after the video is done.
    const cached = cachedVideoUrls.get(id)
    if (cached) return res.json({ data: { id, status: 'succeeded', video_url: cached } })

    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.detail || `Replicate HTTP ${r.status}` })

    const status: string = j.status
    if (status !== 'succeeded') {
      return res.json({ data: { id, status, error: j.error || null, logs: typeof j.logs === 'string' ? j.logs.slice(-400) : null } })
    }

    const output = j.output
    const sourceUrl: string | null = Array.isArray(output) ? output[output.length - 1] : (typeof output === 'string' ? output : null)
    if (!sourceUrl) return res.status(502).json({ error: 'Prediction succeeded but no video URL was returned' })

    // Download and re-host so the URL stays valid for the platform fetchers.
    const dl = await fetch(sourceUrl)
    if (!dl.ok) return res.status(502).json({ error: `Failed to download generated video (HTTP ${dl.status})` })
    const buf = Buffer.from(await dl.arrayBuffer())
    const contentType = dl.headers.get('content-type') || 'video/mp4'
    const ext = contentType.includes('webm') ? 'webm' : 'mp4'
    const url = await persistVideo(buf, contentType, id, ext)
    cachedVideoUrls.set(id, url)
    res.json({ data: { id, status, video_url: url } })
  } catch (err: any) {
    console.error('AI video poll error:', err)
    res.status(500).json({ error: err.message || 'AI video poll failed' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/ai/ad
// AI Ads generator. Returns N ad variants tailored to the chosen platform &
// campaign goal. Each variant has: headline, primary_text, description, cta,
// image_prompt, audience_hint. Body: { product, offer, goal, platform,
// audience, tone?, variants? (default 3) }
// ---------------------------------------------------------------------------
router.post('/ad', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const {
      product = '',
      offer = '',
      goal = 'lead_gen',
      platform = 'facebook',
      audience = '',
      tone = 'persuasive',
      variants = 3,
    } = req.body || {}

    if (!product.trim()) return res.status(400).json({ error: 'product is required' })

    const goalLabel: Record<string, string> = {
      lead_gen: 'lead generation (capture sign-ups / form fills)',
      traffic: 'website traffic',
      conversions: 'paid conversions / purchases',
      awareness: 'brand awareness',
      engagement: 'post engagement',
      app_installs: 'app installs',
    }
    const goalText = goalLabel[goal] || goal

    const platformLimits: Record<string, string> = {
      facebook: 'Facebook/Meta Ads — Headline ≤ 40 chars, primary text ≤ 125 chars (best practice), description ≤ 30 chars.',
      instagram: 'Instagram Ads — same Meta limits; primary text ≤ 125 chars; one CTA button.',
      google: 'Google Ads RSAs — Headlines ≤ 30 chars (each), descriptions ≤ 90 chars.',
      linkedin: 'LinkedIn Single Image Ads — Headline ≤ 70 chars, intro text ≤ 150 chars.',
      tiktok: 'TikTok Ads — Ad text ≤ 100 chars, hook in first 3 seconds is critical.',
      youtube: 'YouTube Ads — short hook in first 5 seconds, on-screen text ≤ 30 chars.',
    }
    const limitText = platformLimits[platform] || ''

    const system = `You are a senior performance-marketing copywriter for GritSync. Every ad you draft must match the ground-truth facts below — never invent services, prices, timelines, or claims that contradict them.

${GRITSYNC_KB}

Ad-craft rules: specific benefit-led hooks, concrete numbers ONLY when grounded in the facts above, no clichés, no fake testimonials, no fake urgency, never claim guaranteed outcomes. Follow each ad network's policy.`

    const user = `Write ${variants} distinct ad variants.

Product / service: ${product}
Offer / promotion: ${offer || '(none specified — write evergreen ads)'}
Campaign goal: ${goalText}
Platform: ${platform}. ${limitText}
Target audience: ${audience || 'internationally educated nurses considering US migration / NCLEX prep'}
Tone: ${tone}

For each variant return:
- headline: hook (respect the platform character limit above)
- primary_text: main body copy
- description: short subtext (Meta) or second-line description (Google)
- cta: one of "Learn More", "Sign Up", "Get Offer", "Apply Now", "Book Now", "Download", "Subscribe"
- image_prompt: a specific text-to-image prompt for the matching ad creative — describe the subject, composition, lighting, mood, and inferred aspect-ratio context. Do NOT include text overlays.
- audience_hint: one short sentence on who this variant lands best with

Return ONLY this JSON object — no surrounding text, no markdown fence:
{ "ads": [ ${variants} objects with the fields above ] }`

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 3000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })

    const text = j.choices?.[0]?.message?.content || ''
    let ads: any[] = []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) ads = parsed
      else if (Array.isArray(parsed.ads)) ads = parsed.ads
      else if (Array.isArray(parsed.variants)) ads = parsed.variants
    } catch {
      return res.status(502).json({ error: 'Model returned malformed JSON', raw: text.slice(0, 500) })
    }
    if (!ads.length) return res.status(502).json({ error: 'No ad variants produced' })
    res.json({ data: { ads } })
  } catch (err: any) {
    console.error('AI ad error:', err)
    res.status(500).json({ error: err.message || 'AI ad failed' })
  }
})

// ---------------------------------------------------------------------------
// CONTENT BANK + GENERATOR
// Backs the new "Compose" post generator on /app/admin/social.
//
// Flow:
//   1. POST /generate-batch — runs a prompt-enhancer pass, generates N caption
//      variants, generates matching media per result (image inline; video via
//      Replicate, returns prediction id), and persists each result to
//      `social_content_bank`.
//   2. GET  /content-bank   — list available items (newest first).
//   3. POST /content-bank/:id/refresh-media — for video items, polls Replicate
//      and rehosts the finished video.
//   4. DELETE /content-bank/:id — remove an item.
// ---------------------------------------------------------------------------

// The agentic enhancer takes a raw operator brief and turns it into a tight
// strategy document a copywriter + image AI can both consume. The system
// prompt asks the model to think like a senior social-media strategist —
// goal → audience → hook → payoff → CTA → per-platform calibration —
// instead of just rewording the input.
async function enhanceBrief(input: {
  topic: string
  preselected_idea?: string | null
  tone: string
  length: string
  language: string
  content_type: 'image' | 'video'
  additional_details?: string
  goal?: string
  audience_preset?: string
  platforms?: string[]
}): Promise<{
  enhanced: string
  image_prompt_seed: string
  video_prompt_seed: string
  hook: string
  cta: string
  hashtags: string[]
  platform_notes: Record<string, string>
}> {
  const apiKey = OPENAI_KEY()
  const fallback = () => {
    const seed = [input.preselected_idea, input.topic, input.additional_details]
      .filter(Boolean).join(' — ')
    return {
      enhanced: seed,
      image_prompt_seed: seed,
      video_prompt_seed: seed,
      hook: '',
      cta: '',
      hashtags: [],
      platform_notes: {},
    }
  }
  if (!apiKey) return fallback()

  const system = `You are a senior social-media strategist at GritSync. The ground-truth facts below are the single source of company information — every plan you produce must be consistent with them.

${GRITSYNC_KB}

Think like a top-tier social-media manager:
1. GOAL FIRST — every post must drive one specific outcome (book a consult, share a credible story, educate on a step, drive saves/shares, etc.). Read the operator's goal and let it shape the structure.
2. AUDIENCE — write to ONE specific reader. A Filipino nurse considering migration is not the same as one in active NCLEX prep, which is not the same as a US-based USRN. Pick the right reader.
3. HOOK — the first 7-12 words must stop a thumb mid-scroll. Specific over abstract. Concrete scene > generic question.
4. PAYOFF — clear why-to-keep-reading; one insight, story, or actionable detail.
5. SINGLE CTA — exactly ONE next action. No "follow + comment + share + DM us + visit our site".
6. PLATFORM CALIBRATION — the same idea is shaped differently on FB (longer-form, line breaks), IG (tight hook + visual-led), LinkedIn (credibility-led), TikTok (3-second hook), YouTube (curiosity-led title).

Brand rules (NON-NEGOTIABLE):
- Never fabricate stats, scores, salaries, names, or testimonials.
- No fake urgency, no guaranteed outcomes, no "the only way" claims.
- Honor the operator's tone, length, and language exactly.
- Be warm and specific, not corporate.

Output STRICT JSON only. No markdown fences, no commentary.`

  const user = `Plan one post.

Raw topic from operator: ${input.topic || '(none)'}
Preselected template / angle: ${input.preselected_idea || '(none)'}
Campaign goal: ${input.goal || 'engagement / brand presence (operator did not specify)'}
Audience preset: ${input.audience_preset || 'general — Filipino RNs anywhere in their NCLEX/USRN journey'}
Platforms it will run on: ${(input.platforms || []).length ? (input.platforms || []).join(', ') : 'platform-agnostic'}
Tone: ${input.tone}
Length: ${input.length}
Language: ${input.language}
Content format: ${input.content_type}
Operator's additional guidance: ${input.additional_details || '(none)'}

Return ONLY this JSON object (all fields required):
{
  "enhanced": "3-5 sentences. Tell the copywriter: who this is for, the one outcome we want, the hook hypothesis, the payoff, and the single CTA. Concrete, no fluff.",
  "hook": "The exact 7-12 word opener you'd test first. Specific, scroll-stopping.",
  "cta": "The single call-to-action in plain language. e.g. 'Book a free 15-min consult with GritSync this week.'",
  "image_prompt_seed": "Concrete visual prompt for a single on-brand still image. Composition, subject, lighting, mood. Subjects are Filipino healthcare professionals in modern settings. No text overlays, no logos, no readable signage.",
  "video_prompt_seed": "5-second vertical video scene description. Subject, action, camera move, mood.",
  "hashtags": ["#GritSync", "#NCLEXPrep", "#USRNJourney", "..."],
  "platform_notes": {
    "facebook": "How to shape this post for FB (length, line breaks, vibe).",
    "instagram": "Same, for IG (caption-first vs visual-led, emoji density, hashtag placement).",
    "linkedin": "Same, for LinkedIn (credibility framing).",
    "tiktok": "Same, for TikTok (3-second hook, on-screen text concept).",
    "youtube": "Same, for YouTube (curiosity-led title direction)."
  }
}`

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 1400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return fallback()
    const text = j.choices?.[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback()
    const parsed = JSON.parse(match[0])
    const fb = fallback()
    return {
      enhanced: String(parsed.enhanced || '').trim() || fb.enhanced,
      image_prompt_seed: String(parsed.image_prompt_seed || '').trim() || fb.image_prompt_seed,
      video_prompt_seed: String(parsed.video_prompt_seed || '').trim() || fb.video_prompt_seed,
      hook: String(parsed.hook || '').trim(),
      cta: String(parsed.cta || '').trim(),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h: any) => typeof h === 'string').slice(0, 8) : [],
      platform_notes: typeof parsed.platform_notes === 'object' && parsed.platform_notes ? parsed.platform_notes : {},
    }
  } catch {
    return fallback()
  }
}

// Caption generator. Now consumes the agentic enhancer's full plan (hook,
// CTA, hashtags, platform notes) so each variant has structure rather than
// just being a tone/length rewording of the brief.
async function generateCaptions(plan: {
  enhanced: string
  hook: string
  cta: string
  hashtags: string[]
  platform_notes: Record<string, string>
}, opts: {
  tone: string; length: string; language: string; count: number;
  platforms?: string[]
  /** The operator's 11-section master caption format from Compose. When
   *  provided, the LLM must follow this structural blueprint for every
   *  variant (each variant differs only in hook + section voice). When
   *  null, falls back to the prior unstructured copywriter behaviour. */
  caption_format?: string | null
}): Promise<string[]> {
  const apiKey = OPENAI_KEY()
  if (!apiKey) return Array.from({ length: opts.count }, (_, i) => `${plan.enhanced} (variant ${i + 1})`)

  const lengthHint =
    opts.length === 'short' ? 'Under 100 characters total.'
    : opts.length === 'long' ? 'Around 250-400 characters across 2-3 short paragraphs separated by blank lines for breath.'
    : 'Around 120-220 characters with at most one line break.'

  const languageNote =
    opts.language === 'taglish' ? 'Write in natural Taglish — the way bilingual Filipino nurses actually talk online (mix of Filipino + English, no forced code-switching).'
    : opts.language === 'filipino' ? 'Write in conversational Filipino (Tagalog), keeping medical/credentialing terms in English where Filipinos naturally do.'
    : 'Write in conversational English.'

  const platformLine = (opts.platforms || []).length
    ? `Platforms this post must work on: ${(opts.platforms || []).join(', ')}. Shape every variant to read well on all of them — short tight hook, no platform-specific formatting that breaks elsewhere.`
    : 'Platform-agnostic — keep formatting that works anywhere.'

  const platformNotesBlock = Object.entries(plan.platform_notes || {})
    .filter(([p]) => (opts.platforms || []).length === 0 || (opts.platforms || []).includes(p))
    .map(([p, n]) => `  - ${p}: ${n}`)
    .join('\n') || '  (none — write generically.)'

  const formatBlock = opts.caption_format
    ? `Master caption format (every variant MUST follow this 11-section blueprint — keep section headings verbatim, fill each section with caption-specific copy):
"""
${opts.caption_format}
"""

`
    : ''

  const system = `You are a senior copywriter at GritSync, writing for Filipino-trained nurses who want to become USRNs. The ground-truth facts below are the single source of company information — every line of copy you write must be consistent with them.

${GRITSYNC_KB}

${formatBlock}Voice rules:
- Lead with a SPECIFIC, scroll-stopping hook in the first 7-12 words. Concrete scene, not "Are you a nurse?".
- One concrete detail per paragraph — a name, a scene, a number you can actually cite, a moment.
- No clichés. No fake stats. No fabricated testimonials. No "the only way" / "guaranteed pass" claims.
- Match the requested tone, length, and language exactly.
- ${opts.caption_format
    ? 'Follow the master caption format above for every variant. Keep ALL 11 section headings ("1. HOOK", "2. SELF-CHECK / AWARENESS QUESTIONS", etc.) and fill each section with copy that reflects this post\'s specific topic. Variants differ in the HOOK (section 1) and the voice of each section — the structure is identical across variants.'
    : 'ONE call-to-action per caption. No CTA stacking.'}
- ${opts.caption_format
    ? 'CTAs live in section 9 of the master format — keep "www.gritsync.com/quote" verbatim and the four bullet CTAs intact.'
    : 'If hashtags are listed in the plan, include 3-6 of them (or your own equally-relevant ones) only at the very end, on a separate line.'}
- ${opts.caption_format
    ? 'Hashtags live in section 11 of the master format — keep them verbatim, or swap for equally-relevant ones if and only if the topic genuinely warrants different tags.'
    : 'Emojis sparingly: at most 2 per caption, used to anchor meaning, never to decorate.'}

Output STRICT JSON only.`

  const user = `Write ${opts.count} DISTINCT caption variants for ONE post — each variant a different angle on the same hook + payoff, so the operator can pick the strongest.

Strategist's plan:
- Brief: ${plan.enhanced}
- Hook hypothesis: ${plan.hook || '(model: derive from brief)'}
- Single CTA: ${plan.cta || '(model: derive from brief)'}
- Suggested hashtags (you may swap for equally-relevant ones): ${plan.hashtags.length ? plan.hashtags.join(' ') : '(none)'}
- Platform notes:
${platformNotesBlock}

Operator settings:
- Tone: ${opts.tone}
- Length: ${lengthHint}
- Language: ${languageNote}
- ${platformLine}

Each variant must:
1. Open with a different hook (varied phrasing, varied entry point).
2. Hit the same payoff and end on the SAME single CTA.
3. End with 3-6 hashtags on a new line.

Return ONLY this JSON object — no surrounding text, no markdown fence:
{ "captions": ["First caption…", "Second caption…", "..."] }`

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error?.message || `OpenAI HTTP ${r.status}`)
  const text = j.choices?.[0]?.message?.content || ''
  let captions: string[] = []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) captions = parsed
    else if (Array.isArray(parsed.captions)) captions = parsed.captions
    else if (Array.isArray(parsed.variants)) captions = parsed.variants
  } catch {
    captions = text.split(/\n{2,}/).map((s: string) => s.trim()).filter(Boolean)
  }
  captions = captions.filter((c) => typeof c === 'string' && c.trim()).slice(0, opts.count)
  if (!captions.length) throw new Error('No captions produced')
  // Pad if the model returned fewer than requested.
  while (captions.length < opts.count) captions.push(captions[captions.length - 1])
  return captions
}

// Caption-aware image-prompt derivation. The operator's master image
// prompt is a GUIDE — this helper takes that guide + the just-generated
// caption and asks the LLM to produce a fresh image prompt that respects
// the brand feel of the guide but adapts the scene, subject blocking,
// and emotional beat to match what the caption is saying. The agent is
// free to restructure or enhance the master prompt; it isn't a strict
// template.
//
// When the guide is empty (rare), the helper falls back to the brief's
// `image_prompt_seed` so generation still proceeds.
async function deriveImagePromptForCaption(args: {
  caption: string
  masterImageGuide: string
  briefImageSeed: string
}): Promise<string> {
  const { caption, masterImageGuide, briefImageSeed } = args
  const fallback = (masterImageGuide || briefImageSeed || '').trim()
  if (!fallback) return ''
  const apiKey = OPENAI_KEY()
  if (!apiKey) return fallback

  const system = `You are a senior creative director who turns social-media captions into DALL·E-3 image prompts for GritSync, an NCLEX-processing agency that helps Filipino-trained nurses become USRNs. The brand facts below are ground truth — every image you specify must be consistent with them.

${GRITSYNC_KB}

Your job:
1. Read the operator's MASTER IMAGE GUIDE — it captures the brand feel (subject identity, color palette, composition language, mood). Treat this as inspiration, not a contract.
2. Read the CAPTION the image must accompany. Extract the specific scene, emotional beat, and visual cues the copy implies.
3. Produce ONE final DALL·E-3 image prompt that:
   - Hews to the brand feel of the guide (Filipino healthcare subjects, premium ad aesthetic, deep-red / white / soft-black / gold palette).
   - Pictures the caption's specific moment — not a generic brand shot.
   - You may restructure, prune, or enhance the guide freely if the caption demands it. Reorder sections, add new visual ideas, drop dead phrases.
   - ALWAYS includes the GritSync brand logo placement (white or red wordmark "GritSync" in a top corner, plus subtle "gritsync.com" footer or website text somewhere unobtrusive). The renderer will approximate the letterforms; specify the placement, the colour, and the size so the composition leaves room for it.
   - Stays photorealistic + cinematic (DALL·E-3 thrives there).
   - Includes a negative-prompt block at the end with anti-artifact terms (distorted hands, warped documents, AI text glitches, etc.).
   - No fabricated claims, no named hospitals, no non-Filipino ethnicities, no US landmarks the brand hasn't endorsed.

TEXT-CORRECTNESS RULES (critical — DALL·E-3 renders text badly when prompted carelessly):
- LIMIT the number of distinct text strings in the image to AT MOST 3 (logo wordmark + one headline + one CTA / URL). More than that and DALL·E starts inventing letters.
- Every text string you ask DALL·E to render MUST be wrapped in double quotes in the prompt, exact spelling, e.g. the text "GritSync" in white sans-serif top-right.
- Keep each text string SHORT — under 6 words for headlines, under 4 for CTAs, single-token for the logo wordmark. Long sentences come out as gibberish.
- Always include this instruction near the top of the prompt verbatim: "All visible text must be rendered exactly as quoted, with clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs."
- Verify EVERY string you ask the renderer to draw is correctly spelled. Common brand strings: "GritSync" (one word, capital G + S), "gritsync.com" (all lowercase), "USRN", "NCLEX".
- Where the master guide asks for a long headline/CTA that's likely to glitch, REPLACE the string with the shortest brand-accurate equivalent (e.g. "YOUR USRN DREAM STARTS HERE" → "USRN STARTS HERE" if needed for legibility).
- Strengthen the negative-prompt section with: "misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling, illegible signage."

Return STRICT JSON only.`

  const user = `MASTER IMAGE GUIDE (inspiration — you may adapt):
"""
${masterImageGuide || briefImageSeed}
"""

CAPTION (the moment this image must visualise):
"""
${caption.slice(0, 1800)}
"""

Return ONLY this JSON object — no surrounding text, no markdown fence:
{ "image_prompt": "<the full image prompt as a single string, multi-line with \\n where useful>" }`

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 1400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return fallback
    const text = j.choices?.[0]?.message?.content || ''
    try {
      const parsed = JSON.parse(text)
      const derived = typeof parsed.image_prompt === 'string' ? parsed.image_prompt.trim() : ''
      return derived || fallback
    } catch {
      // Non-JSON return — use raw text if it looks prompt-shaped.
      const trimmed = String(text).trim()
      return trimmed.length > 60 ? trimmed : fallback
    }
  } catch {
    return fallback
  }
}

// ─── Image generation (per-provider) ──────────────────────────────────────
//
// All three providers funnel through `generateImage(provider, prompt)`, which
// downloads/decodes the raw image into a Buffer, persists it to file_storage,
// and returns our public URL. That gives Replicate (for image-to-video) a
// stable URL it can fetch later, regardless of which provider made the image.

// Persist a generated image. Prefers Google Drive when the operator has
// connected it (see /api/integrations/google-drive/status). Falls back to
// the file_storage Postgres table so generation keeps working even before
// Drive is wired up.
async function persistImage(buf: Buffer, contentType: string): Promise<string> {
  const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'png'
  const filename = `gritsync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  try {
    if (await isDriveConnected()) {
      // Drive returns a publicly-readable URL (anyoneWithLink reader) that
      // both the browser and Meta/IG/TikTok fetchers can hit directly.
      return await uploadToDrive(buf, contentType, filename)
    }
  } catch (err: any) {
    console.warn('Drive upload failed, falling back to Postgres file_storage:', err.message)
  }

  const key = `social/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  await pool.query(
    `INSERT INTO file_storage (storage_key, data, content_type, file_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (storage_key) DO UPDATE
       SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, updated_at = NOW()`,
    [key, buf, contentType, buf.length]
  )
  // Return a RELATIVE path. Frontend <img src> resolves against current
  // origin (works on every deploy), and toAbsoluteUrl() lifts to absolute
  // only at boundaries that need it (Replicate, Meta publishing).
  return `/api/storage/public/${key}`
}

// Persist a rendered video. Same Drive-first / Postgres-fallback dance as
// persistImage, but keyed by the Replicate prediction id so the same row
// is reused across retries.
async function persistVideo(
  buf: Buffer,
  contentType: string,
  predictionId: string,
  ext: 'mp4' | 'webm'
): Promise<string> {
  const filename = `gritsync-${predictionId}.${ext}`
  try {
    if (await isDriveConnected()) {
      return await uploadToDrive(buf, contentType, filename)
    }
  } catch (err: any) {
    console.warn('Drive video upload failed, falling back to Postgres file_storage:', err.message)
  }
  const key = `social/ai/${predictionId}.${ext}`
  await pool.query(
    `INSERT INTO file_storage (storage_key, data, content_type, file_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (storage_key) DO UPDATE
       SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, updated_at = NOW()`,
    [key, buf, contentType, buf.length]
  )
  return `/api/storage/public/${key}`
}

// Lift a stored relative path to an absolute URL when handing off to an
// external fetcher (Replicate's image-to-video, Meta Graph API publishing).
// Leaves already-absolute URLs alone — Drive URLs are already absolute.
function toAbsoluteUrl(maybeRelative: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative
  const base = PUBLIC_BASE || 'https://app.gritsync.com'
  return `${base}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`
}

// Try one OpenAI image model. Returns the persisted URL on success, or a
// detail object with a structured error so the caller can decide whether
// to fall back to a different model.
type OpenAIImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'dall-e-3' | 'dall-e-2'

async function tryOpenAIImage(
  apiKey: string,
  prompt: string,
  model: OpenAIImageModel,
  size: string = '1024x1024'
): Promise<{ url?: string; error?: string; shouldFallback?: boolean }> {
  // Build the minimal valid body per model. The Images API rejects unknown
  // parameters, so we send only what each model accepts.
  const body: Record<string, any> = { model, prompt, n: 1, size }
  if (model === 'dall-e-3') {
    // DALL·E-3: HD + natural is the right call for GritSync's master
    // prompt — photorealistic, cinematic, "premium Facebook/Instagram
    // ad" composition. `vivid` over-saturates; `natural` matches the
    // deep-red / white / soft-black palette the brand specifies.
    body.quality = 'hd'
    body.style = 'natural'
  } else if (model === 'gpt-image-1' || model === 'gpt-image-1-mini') {
    // gpt-image-1 family is the legacy fallback path now — see chain
    // ordering in generateImageOpenAI. Keep medium to balance latency
    // when DALL·E access is the rare miss.
    body.quality = 'medium'
  }
  // dall-e-2: just model + prompt + n + size.

  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = j.error?.message || `OpenAI HTTP ${r.status}`
    // Fall back on access / model-shape / unknown-parameter errors. Any of
    // these mean "try a different model" rather than "give up" — leaves
    // real failures (auth, rate limit, content policy) to bubble up.
    const shouldFallback =
      /does not have access to model|model_not_found|model `[^`]+`|unknown parameter|invalid request|unsupported|not supported|invalid model/i.test(msg) ||
      j.error?.code === 'model_not_found' ||
      j.error?.code === 'invalid_request_error' ||
      r.status === 400 || r.status === 403 || r.status === 404
    return { error: msg, shouldFallback }
  }
  const b64 = j.data?.[0]?.b64_json
  const url = j.data?.[0]?.url
  if (b64) {
    return { url: await persistImage(Buffer.from(b64, 'base64'), 'image/png') }
  }
  if (url) {
    const dl = await fetch(url)
    if (!dl.ok) return { error: `Failed to download OpenAI image (HTTP ${dl.status})` }
    const buf = Buffer.from(await dl.arrayBuffer())
    const ct = dl.headers.get('content-type') || 'image/png'
    return { url: await persistImage(buf, ct) }
  }
  return { error: 'OpenAI returned no image' }
}

// Sizes each OpenAI image model accepts. We pick the closest match per
// requested aspect ratio. dall-e-2 only does square sizes; gpt-image-1*
// accept 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape).
function sizeFor(model: OpenAIImageModel, aspect: string): string {
  if (model === 'dall-e-2') return '1024x1024'
  if (model === 'dall-e-3') {
    if (aspect === '16:9') return '1792x1024'
    if (aspect === '9:16' || aspect === '4:5') return '1024x1792'
    return '1024x1024'
  }
  // gpt-image-1 / gpt-image-1-mini
  if (aspect === '16:9') return '1536x1024'
  if (aspect === '9:16' || aspect === '4:5') return '1024x1536'
  return '1024x1024'
}

// Universal text-correctness preamble. DALL·E-3 reliably renders text
// only when it's short, quoted exactly, and explicitly demanded by the
// prompt. We prepend this block to every prompt so even the "fallback"
// path (no per-caption LLM derivation) still gets the brand strings
// rendered cleanly — and the negative-prompt section gets the standard
// anti-artifact terms appended regardless of what the caller wrote.
const IMAGE_TEXT_CORRECTNESS_PREAMBLE =
  'CRITICAL TEXT-RENDERING REQUIREMENTS: All visible text in the image must be rendered exactly as written in this prompt — clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs, no garbled words. Brand strings to render exactly: "GritSync" (one word, capital G and S), "gritsync.com" (all lowercase). Keep every visible text string short (under 6 words for headlines, under 4 for CTAs) so the renderer can produce legible letterforms.\n\n'

const IMAGE_NEGATIVE_TEXT_SUFFIX =
  '\n\nReinforced negative prompt (text artifacts): misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling, illegible signage, jumbled letters, distorted hands, warped documents, AI text glitches.'

function applyImageTextGuards(prompt: string): string {
  return `${IMAGE_TEXT_CORRECTNESS_PREAMBLE}${prompt}${IMAGE_NEGATIVE_TEXT_SUFFIX}`
}

async function generateImageOpenAI(prompt: string, aspect_ratio: string = '1:1'): Promise<string> {
  const apiKey = OPENAI_KEY()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set on the server')

  // Wrap every prompt with the universal text-correctness preamble +
  // reinforced negative suffix so brand strings render cleanly even on
  // the fallback path where no per-caption LLM derivation happened.
  const guardedPrompt = applyImageTextGuards(prompt)

  // DALL·E-style pipeline: DALL·E-3 (hd + natural) is the primary —
  // photorealistic, cinematic, and respects the deep-red / white /
  // soft-black palette the master prompt asks for. DALL·E-2 catches
  // legacy projects that haven't been granted DALL·E-3 access. The
  // gpt-image-1 variants stay in the chain ONLY as a last-resort
  // fallback for projects with no DALL·E access at all — the brand
  // wants the DALL·E look, so we always try it first.
  const chain: OpenAIImageModel[] = ['dall-e-3', 'dall-e-2', 'gpt-image-1', 'gpt-image-1-mini']
  let lastError = 'OpenAI image generation failed'
  for (const model of chain) {
    const r = await tryOpenAIImage(apiKey, guardedPrompt, model, sizeFor(model, aspect_ratio))
    if (r.url) return r.url
    lastError = `${model}: ${r.error || 'unknown'}`
    if (!r.shouldFallback) break
  }
  throw new Error(lastError)
}

// Google Gemini 2.5 Flash Image — codename "nano banana". OpenAI-incompatible
// envelope: images come back as inlineData.data on a candidate part.
async function generateImageGemini(prompt: string): Promise<string> {
  const apiKey = GOOGLE_KEY()
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set on the server')
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  )
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error?.message || `Gemini HTTP ${r.status}`)
  const parts: any[] = j.candidates?.[0]?.content?.parts || []
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData
  if (!inline?.data) throw new Error('Gemini returned no image')
  return persistImage(Buffer.from(inline.data, 'base64'), inline.mimeType || 'image/png')
}

// xAI Grok image generation — OpenAI-compatible surface at /v1/images/generations.
// Grok returns a temporary URL (no b64 support today), so we download + rehost.
async function generateImageGrok(prompt: string): Promise<string> {
  const apiKey = XAI_KEY()
  if (!apiKey) throw new Error('XAI_API_KEY is not set on the server')
  const r = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-2-image-1212',
      prompt,
      n: 1,
      response_format: 'url',
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error?.message || j.error || `Grok HTTP ${r.status}`)
  const url: string | undefined = j.data?.[0]?.url
  const b64: string | undefined = j.data?.[0]?.b64_json
  if (b64) return persistImage(Buffer.from(b64, 'base64'), 'image/png')
  if (!url) throw new Error('Grok returned no image')
  const dl = await fetch(url)
  if (!dl.ok) throw new Error(`Failed to download Grok image (HTTP ${dl.status})`)
  const buf = Buffer.from(await dl.arrayBuffer())
  const ct = dl.headers.get('content-type') || 'image/jpeg'
  return persistImage(buf, ct)
}

async function generateImage(provider: ImageProvider, prompt: string): Promise<string> {
  if (provider === 'nano-banana') return generateImageGemini(prompt)
  if (provider === 'grok') return generateImageGrok(prompt)
  return generateImageOpenAI(prompt)
}

// Helper: kick off a Replicate video prediction. If `startImageUrl` is set
// we send it as `start_image_url` — Luma Ray (the default model) accepts that
// for image-to-video; other models that don't will simply ignore it.
async function startVideoPrediction(prompt: string, startImageUrl?: string | null): Promise<string> {
  const apiKey = REPLICATE_KEY()
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN is not set on the server')
  const model = REPLICATE_VIDEO_MODEL()
  const input: Record<string, any> = { prompt, aspect_ratio: '9:16', duration: 5 }
  if (startImageUrl) input.start_image_url = startImageUrl
  const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({ input }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.detail || j.error || `Replicate HTTP ${r.status}`)
  if (!j.id) throw new Error('Replicate did not return a prediction id')
  return j.id as string
}

router.post('/generate-batch', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      topic = '',
      preselected_idea = null,
      template_id = null,
      template_image_prompt = null,
      caption_format = null,
      goal = '',
      audience_preset = '',
      platforms = [],
      tone = 'friendly',
      length = 'medium',
      language = 'taglish',
      count = 3,
      content_type = 'image',
      additional_details = '',
      image_provider = 'openai',
    } = req.body || {}

    const cleanTopic = String(topic).trim()
    const cleanIdea = preselected_idea ? String(preselected_idea).trim() : ''
    const cleanTemplateImagePrompt = template_image_prompt ? String(template_image_prompt).trim() : ''
    const cleanCaptionFormat = caption_format ? String(caption_format).trim() : ''
    const cleanPlatforms = Array.isArray(platforms)
      ? platforms.map((p: any) => String(p)).filter((p: string) => /^(facebook|instagram|linkedin|youtube|tiktok)$/.test(p))
      : []
    if (!cleanTopic && !cleanIdea) {
      return res.status(400).json({ error: 'A topic or a preselected idea is required' })
    }
    const n = Math.max(1, Math.min(6, Number(count) || 3))
    const ct: 'image' | 'video' = content_type === 'video' ? 'video' : 'image'
    const provider: ImageProvider =
      image_provider === 'nano-banana' || image_provider === 'grok' ? image_provider : 'openai'

    // Step 1: strategic plan (the "agentic" enhancer).
    const brief = await enhanceBrief({
      topic: cleanTopic,
      preselected_idea: cleanIdea || null,
      tone, length, language,
      content_type: ct,
      additional_details,
      goal: String(goal || '').trim(),
      audience_preset: String(audience_preset || '').trim(),
      platforms: cleanPlatforms,
    })

    // Step 2: captions per the plan. The operator's master caption format
    // (11-section blueprint) is threaded in so every variant follows the
    // brand's structural template.
    const captions = await generateCaptions(brief, {
      tone, length, language, count: n,
      platforms: cleanPlatforms,
      caption_format: cleanCaptionFormat || null,
    })

    // The operator's master image prompt is now a GUIDE, not a strict
    // template. For each caption variant we ask the LLM to derive a
    // fresh image prompt that respects the brand feel of the guide but
    // pictures the specific moment that caption's copy implies. The
    // helper falls back to the guide-as-is (or the enhancer's seed)
    // when the LLM is unavailable, so generation never breaks.
    const masterImageGuide = cleanTemplateImagePrompt || brief.image_prompt_seed
    const derivedImagePrompts = await Promise.all(captions.map((caption) =>
      deriveImagePromptForCaption({
        caption,
        masterImageGuide,
        briefImageSeed: brief.image_prompt_seed,
      })
    ))

    // Step 3+4: per variant, generate media and persist.
    // For video: we always generate a starting frame with the chosen image AI
    // first, then feed that frame to Replicate as `start_image_url`. That way
    // the bank UI has something to show while the video renders, and the
    // user-chosen image provider actually determines the look of the video.
    const settings = {
      tone, length, language, count: n,
      content_type: ct, additional_details,
      preselected_idea: cleanIdea || null,
      template_id: template_id || null,
      image_provider: provider,
      goal: String(goal || '').trim() || null,
      audience_preset: String(audience_preset || '').trim() || null,
      platforms: cleanPlatforms.length ? cleanPlatforms : null,
      hook: brief.hook || null,
      cta: brief.cta || null,
      hashtags: brief.hashtags?.length ? brief.hashtags : null,
    }

    // Generate all per-variant media in PARALLEL. Sequential generation
    // blew through Vercel's function timeout (3 variants × ~15s each = 45s
    // on a 30s limit). Running in parallel collapses total wall time to
    // the slowest single call (~15-25s) which fits comfortably in the
    // bumped maxDuration. Each variant catches its own error and either
    // returns an 'available'/'pending_media' row or a 'media_failed' row.
    const rows = await Promise.all(captions.map(async (caption, idx) => {
      const imagePrompt = derivedImagePrompts[idx] || masterImageGuide
      try {
        if (ct === 'image') {
          const mediaUrl = await generateImage(provider, imagePrompt)
          const ins = await pool.query(
            `INSERT INTO social_content_bank
               (caption, media_url, media_type, source_topic, enhanced_prompt, generation_settings, status, created_by_user_id)
             VALUES ($1, $2, 'image', $3, $4, $5::jsonb, 'available', $6)
             RETURNING *`,
            [caption, mediaUrl, cleanTopic || cleanIdea, brief.enhanced, JSON.stringify(settings), req.user!.id]
          )
          return ins.rows[0]
        } else {
          // Video: generate the starting frame with the chosen image AI,
          // then kick off image-to-video on Replicate. Replicate fetches
          // the start frame from the public internet, so the URL needs
          // to be absolute — toAbsoluteUrl() lifts our stored relative
          // path.
          const sourceImageUrl = await generateImage(provider, imagePrompt)
          const predictionId = await startVideoPrediction(
            brief.video_prompt_seed,
            toAbsoluteUrl(sourceImageUrl)
          )
          const ins = await pool.query(
            `INSERT INTO social_content_bank
               (caption, media_url, media_type, prediction_id, source_image_url, source_topic, enhanced_prompt, generation_settings, status, created_by_user_id)
             VALUES ($1, NULL, 'video', $2, $3, $4, $5, $6::jsonb, 'pending_media', $7)
             RETURNING *`,
            [caption, predictionId, sourceImageUrl, cleanTopic || cleanIdea, brief.enhanced, JSON.stringify(settings), req.user!.id]
          )
          return ins.rows[0]
        }
      } catch (perItemErr: any) {
        // Persist a caption-only row so the operator doesn't lose the
        // copy when image/video generation hits a provider error.
        const ins = await pool.query(
          `INSERT INTO social_content_bank
             (caption, media_type, source_topic, enhanced_prompt, generation_settings, status, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'media_failed', $6)
           RETURNING *`,
          [caption, ct, cleanTopic || cleanIdea, brief.enhanced + `\n\n[media error: ${perItemErr.message}]`, JSON.stringify(settings), req.user!.id]
        )
        return ins.rows[0]
      }
    }))

    res.json({ data: { items: rows, brief: brief.enhanced } })
  } catch (err: any) {
    console.error('generate-batch error:', err)
    res.status(500).json({ error: err.message || 'Generation failed' })
  }
})

router.get('/content-bank', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM social_content_bank
       WHERE status IN ('available', 'pending_media', 'media_failed')
       ORDER BY created_at DESC
       LIMIT 200`
    )
    res.json({ data: r.rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/content-bank/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id)
    await pool.query(`DELETE FROM social_content_bank WHERE id = $1`, [id])
    res.json({ data: { id, deleted: true } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// For video items: poll Replicate via the existing predictions API. If the
// prediction succeeded, download + rehost the video (so platform fetchers
// don't 404 on Replicate's expiring signed URL) and update the bank row.
router.post('/content-bank/:id/refresh-media', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = REPLICATE_KEY()
    if (!apiKey) return res.status(400).json({ error: 'REPLICATE_API_TOKEN is not set on the server' })
    const id = String(req.params.id)
    const row = (await pool.query(`SELECT * FROM social_content_bank WHERE id = $1`, [id])).rows[0]
    if (!row) return res.status(404).json({ error: 'Bank item not found' })
    if (row.media_type !== 'video' || !row.prediction_id) {
      return res.status(400).json({ error: 'Item has no pending video prediction to refresh' })
    }
    if (row.media_url && row.status === 'available') {
      return res.json({ data: row })
    }
    const r = await fetch(`https://api.replicate.com/v1/predictions/${row.prediction_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.detail || `Replicate HTTP ${r.status}` })
    if (j.status !== 'succeeded') {
      return res.json({ data: { ...row, prediction_status: j.status, prediction_logs: typeof j.logs === 'string' ? j.logs.slice(-400) : null } })
    }
    const output = j.output
    const sourceUrl: string | null = Array.isArray(output) ? output[output.length - 1] : (typeof output === 'string' ? output : null)
    if (!sourceUrl) return res.status(502).json({ error: 'Prediction succeeded but no video URL was returned' })
    const dl = await fetch(sourceUrl)
    if (!dl.ok) return res.status(502).json({ error: `Failed to download generated video (HTTP ${dl.status})` })
    const buf = Buffer.from(await dl.arrayBuffer())
    const contentType = dl.headers.get('content-type') || 'video/mp4'
    const ext = contentType.includes('webm') ? 'webm' : 'mp4'
    const url = await persistVideo(buf, contentType, row.prediction_id, ext)
    const upd = await pool.query(
      `UPDATE social_content_bank
         SET media_url = $1, status = 'available', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [url, id]
    )
    res.json({ data: upd.rows[0] })
  } catch (err: any) {
    console.error('refresh-media error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
