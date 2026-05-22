import { Router } from 'express'
import { readFileSync } from 'fs'
import path from 'path'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import pool from '../db'
import { isDriveConnected, uploadToDrive } from '../lib/google-drive'
import { GRITSYNC_KB, LENSA_IMAGE_CRAFT_KB } from '../lib/gritsync-knowledge'

// Brand mark — the official square GritSync logo (red background, white
// "GS" glyph). Loaded once at module init so we don't pay disk I/O on
// every generation. Resolved from a few candidate paths because the same
// build runs in dev (process.cwd = repo root) and prod (server compiled
// to a subdirectory). If none resolve we leave the buffer null and fall
// back to a text-only SVG wordmark in applyBrandWatermark.
const BRAND_LOGO_BUF: Buffer | null = (() => {
  const candidates = [
    path.resolve(process.cwd(), 'gritsync_logo.png'),
    path.resolve(process.cwd(), 'public/gritsync_logo.png'),
    path.resolve(__dirname, '../../gritsync_logo.png'),
    path.resolve(__dirname, '../../public/gritsync_logo.png'),
  ]
  for (const p of candidates) {
    try { return readFileSync(p) } catch { /* try the next path */ }
  }
  console.warn('[brand-watermark] gritsync_logo.png not found — falling back to SVG wordmark')
  return null
})()

const router = Router()

const OPENAI_KEY = () => process.env.OPENAI_API_KEY
const GOOGLE_KEY = () => process.env.GOOGLE_API_KEY
const XAI_KEY = () => process.env.XAI_API_KEY
const REPLICATE_KEY = () => process.env.REPLICATE_API_TOKEN
const REPLICATE_VIDEO_MODEL = () => process.env.REPLICATE_VIDEO_MODEL || 'luma/ray-flash-2-540p'
const KLING_ACCESS_KEY = () => process.env.KLING_ACCESS_KEY
const KLING_SECRET_KEY = () => process.env.KLING_SECRET_KEY
const KLING_HOST = () => process.env.KLING_HOST || 'https://api-singapore.klingai.com'

type ImageProvider = 'openai' | 'nano-banana' | 'grok' | 'kling'

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

    const system = `You are a senior creative director who specialises in writing image-generation prompts for premium social-media advertisements. The renderer is OpenAI gpt-image-1 (quality: high), which has industry-leading text rendering, accepts long structured multi-paragraph prompts (~32K input tokens), and produces photoreal subjects + cinematic lighting in one call. Lean into what gpt-image-1 does well — quoted on-canvas text strings ("GritSync", short headlines), layered compositions, perfect typography, layered branding, and detailed multi-section directions.

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
// Image-template library
// ---------------------------------------------------------------------------
// CRUD for operator-managed (name, prompt, preview_url) templates.
// The frontend's Compose tab uses these instead of a single master prompt
// so the team can save multiple branded "looks" and pick one per
// generation. The preview is rendered by the same DALL·E-3 pipeline as
// real post images so the operator sees exactly what generation looks
// like before they commit.
//
// All endpoints are admin-only. Missing-table failures degrade
// gracefully (GET returns empty list) so the UI doesn't break before the
// migration is applied.
// ---------------------------------------------------------------------------

let imageTemplatesTableMissing = false
async function safeQueryImageTemplates<T = any>(text: string, params?: any[]): Promise<{ rows: T[] } | null> {
  try {
    const r = await pool.query(text, params)
    return r as unknown as { rows: T[] }
  } catch (err: any) {
    if (err?.code === '42P01') {
      imageTemplatesTableMissing = true
      return null
    }
    throw err
  }
}

router.get('/image-templates', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    if (imageTemplatesTableMissing) return res.json({ data: [] })
    const r = await safeQueryImageTemplates(
      `SELECT id, name, prompt, preview_url, preview_status, preview_error, is_default, created_at, updated_at
         FROM social_image_templates
        ORDER BY is_default DESC, updated_at DESC`
    )
    if (!r) return res.json({ data: [] })
    res.json({ data: r.rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load image templates' })
  }
})

router.post('/image-templates', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { name = '', prompt = '', is_default = false } = req.body || {}
    const cleanName = String(name).trim()
    const cleanPrompt = String(prompt).trim()
    if (!cleanName) return res.status(400).json({ error: 'name is required' })
    if (!cleanPrompt) return res.status(400).json({ error: 'prompt is required' })

    // Generate the preview synchronously — single OpenAI call. The same
    // applyImageTextGuards wrapping the production image-gen path
    // applies, so previews look like actual generated posts.
    let preview_url: string | null = null
    let preview_status: 'available' | 'failed' = 'failed'
    let preview_error: string | null = null
    try {
      preview_url = await generateImageOpenAI(cleanPrompt)
      preview_status = 'available'
    } catch (err: any) {
      preview_error = err.message || 'Preview render failed'
    }

    const ins = await pool.query(
      `INSERT INTO social_image_templates
         (name, prompt, preview_url, preview_status, preview_error, is_default, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, prompt, preview_url, preview_status, preview_error, is_default, created_at, updated_at`,
      [cleanName, cleanPrompt, preview_url, preview_status, preview_error, !!is_default, req.user!.id]
    )
    res.json({ data: ins.rows[0] })
  } catch (err: any) {
    console.error('image-template create error:', err)
    res.status(500).json({ error: err.message || 'Failed to create image template' })
  }
})

router.patch('/image-templates/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'id is required' })

    const existing = await pool.query(
      `SELECT id, name, prompt FROM social_image_templates WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Template not found' })

    const cur = existing.rows[0]
    const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : cur.name
    const nextPrompt = req.body?.prompt !== undefined ? String(req.body.prompt).trim() : cur.prompt
    if (!nextName) return res.status(400).json({ error: 'name cannot be empty' })
    if (!nextPrompt) return res.status(400).json({ error: 'prompt cannot be empty' })

    // If the prompt actually changed, regenerate the preview so it stays
    // in sync. If only the name changed, skip the OpenAI roundtrip.
    let preview_url: string | null | undefined = undefined
    let preview_status: string | undefined
    let preview_error: string | null | undefined
    if (nextPrompt !== cur.prompt) {
      try {
        preview_url = await generateImageOpenAI(nextPrompt)
        preview_status = 'available'
        preview_error = null
      } catch (err: any) {
        preview_url = null
        preview_status = 'failed'
        preview_error = err.message || 'Preview render failed'
      }
    }

    const upd = preview_status !== undefined
      ? await pool.query(
          `UPDATE social_image_templates
              SET name = $1, prompt = $2, preview_url = $3, preview_status = $4, preview_error = $5, updated_at = NOW()
            WHERE id = $6
            RETURNING id, name, prompt, preview_url, preview_status, preview_error, is_default, created_at, updated_at`,
          [nextName, nextPrompt, preview_url, preview_status, preview_error, id]
        )
      : await pool.query(
          `UPDATE social_image_templates
              SET name = $1, prompt = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, name, prompt, preview_url, preview_status, preview_error, is_default, created_at, updated_at`,
          [nextName, nextPrompt, id]
        )
    res.json({ data: upd.rows[0] })
  } catch (err: any) {
    console.error('image-template patch error:', err)
    res.status(500).json({ error: err.message || 'Failed to update image template' })
  }
})

router.post('/image-templates/:id/regenerate', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'id is required' })

    const existing = await pool.query(
      `SELECT id, prompt FROM social_image_templates WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Template not found' })

    const prompt: string = existing.rows[0].prompt
    let preview_url: string | null = null
    let preview_status: 'available' | 'failed' = 'failed'
    let preview_error: string | null = null
    try {
      preview_url = await generateImageOpenAI(prompt)
      preview_status = 'available'
    } catch (err: any) {
      preview_error = err.message || 'Preview render failed'
    }

    const upd = await pool.query(
      `UPDATE social_image_templates
          SET preview_url = $1, preview_status = $2, preview_error = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id, name, prompt, preview_url, preview_status, preview_error, is_default, created_at, updated_at`,
      [preview_url, preview_status, preview_error, id]
    )
    res.json({ data: upd.rows[0] })
  } catch (err: any) {
    console.error('image-template regenerate error:', err)
    res.status(500).json({ error: err.message || 'Failed to regenerate preview' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/social/ai/image-templates/orchestrate
//
// Lensa — the image-template research / orchestrate / build agent.
//
// Three phases in one call:
//   1. RESEARCH — read the existing template library + recent bank captions
//      to learn what styles we've already shipped and what audiences are
//      seeing right now. This grounds Lensa so she creates a complementary
//      template instead of duplicating an existing look.
//   2. ORCHESTRATE — feed the brief + research + GRITSYNC_KB into
//      gpt-4o-mini, ask for a structured template { name, prompt,
//      reasoning }.
//   3. BUILD — render a preview via generateImage(provider, prompt) so the
//      operator sees the look before committing. Branding guards
//      (applyImageTextGuards) apply automatically.
//
// Returns { name, prompt, preview_url, reasoning, provider } — does NOT
// persist. The client decides whether to save via POST /image-templates.
// ---------------------------------------------------------------------------
router.post('/image-templates/orchestrate', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const { brief = '', provider, skip_preview } = req.body || {}
    const cleanBrief = String(brief || '').trim()
    const useProvider: ImageProvider =
      provider === 'nano-banana' || provider === 'grok' || provider === 'kling' || provider === 'openai'
        ? provider
        : 'openai'
    const skipPreview = !!skip_preview

    // ── RESEARCH ──────────────────────────────────────────────────────
    // Existing templates: name + a 220-char prompt excerpt is enough for
    // Lensa to spot patterns ("we already have a hero-shot template — go
    // for a candid documentary feel instead").
    const existingTemplates = await safeQueryImageTemplates(
      `SELECT name, prompt, is_default FROM social_image_templates ORDER BY created_at DESC LIMIT 12`
    ).catch(() => ({ rows: [] }))

    // Recent bank captions: shows what topics + tones have been shipping,
    // so Lensa can build a template that fits the editorial direction.
    const recentBank = await pool.query(
      `SELECT caption, source_topic FROM social_content_bank
        WHERE status = 'available' OR status = 'used'
        ORDER BY created_at DESC LIMIT 8`
    ).catch(() => ({ rows: [] as any[] }))

    const templateSummaries = (existingTemplates?.rows || []).map((t: any) => ({
      name: t.name,
      is_default: !!t.is_default,
      prompt_excerpt: String(t.prompt || '').replace(/\s+/g, ' ').slice(0, 220),
    }))
    const captionSummaries = (recentBank.rows || []).map((b: any) => ({
      topic: b.source_topic || '(none)',
      excerpt: String(b.caption || '').replace(/\s+/g, ' ').slice(0, 160),
    }))

    // ── ORCHESTRATE ───────────────────────────────────────────────────
    // Infer an aspect-ratio hint from the operator brief so Lensa anchors
    // the template to one safe-zone-aware format. Default 4:5 — Meta's
    // preferred portrait, occupies ~33% more mobile screen than 1:1.
    const briefLower = cleanBrief.toLowerCase()
    const aspectHint =
      /\b(reel|story|stories|9:16|vertical)\b/.test(briefLower) ? '9:16'
      : /\b(banner|cover|youtube|16:9|landscape)\b/.test(briefLower) ? '16:9'
      : /\b(square|1:1|feed)\b/.test(briefLower) ? '1:1'
      : '4:5'

    // Per-renderer tuning notes — surface the right tradeoffs for whichever
    // provider the operator picked, so Lensa writes a prompt the renderer
    // can actually execute (e.g., minimal on-canvas text for Kling/Grok).
    const rendererNote =
      useProvider === 'nano-banana'
        ? 'Renderer: Gemini "nano-banana". Prefer short, sharply labelled prompts. Strong at preserving quoted strings — still spell "GritSync" letter-by-letter.'
        : useProvider === 'grok'
        ? 'Renderer: Grok image. Weak at fine typography — keep on-canvas copy minimal (wordmark + URL only, NO headline). Lean on photoreal subject + lighting.'
        : useProvider === 'kling'
        ? 'Renderer: Kling v1-5. Cinematic skin tones, weak at small text. Keep typography big and bold (≤4 words) or omit the headline entirely and let the caption do the talking.'
        : 'Renderer: OpenAI gpt-image-1 (quality: high). Best text + photoreal subjects in one call, accepts ~32K input tokens so write a detailed multi-paragraph structured prompt — don\'t hold back. Spell "GritSync" letter-by-letter and wrap every literal on-canvas word in straight double quotes.'

    const system = `You are Lensa, GritSync's senior art director. You research the existing image-template library and recent post topics, then design a NEW template that fills a gap, looks like a brand asset (not a stock-photo cliché), and renders cleanly on the operator's chosen renderer.

${GRITSYNC_KB}

${LENSA_IMAGE_CRAFT_KB}

YOUR JOB — three phases:
  1. READ the existing templates and recent captions in the user message. Identify gaps in style / mood / composition / aspect-ratio.
  2. DECIDE on ONE distinct visual direction that fills a gap. Examples: editorial portrait, candid documentary, golden-hour cinematic, minimalist studio, narrative dual-frame, congratulatory celebration moment, before/after, calm focused study scene, hero banner with bold headline lockup.
  3. PRODUCE a reusable image-template prompt — a GUIDE that holds up across many different captions, not a single literal scene.

PROMPT STRUCTURE — produce a multi-paragraph prompt with these labelled sections IN THIS EXACT ORDER. Be DETAILED — multiple sentences per section is correct. The prompt should read like a designer's spec sheet, not a tweet:

   Subject: <one Filipina healthcare professional category, age range, build, hair, makeup ("light natural, no glam"), wardrobe specifics (scrub color from navy/teal/burgundy/ceil-blue/soft-black palette, fit, drawstring waist, V-neck), accessories (thin watch, simple stud earrings, ID lanyard with face turned away), pose direction (three-quarter turn / direct frontal / over-the-shoulder), gaze direction (camera / down at work / off-frame mid-distance), single emotion vocabulary word from the KB ("quiet determination" / "joyful relief" / "tender support" / etc.)>

   Action: <the CATEGORY of moment this template captures across many posts — not a one-shot. e.g. "handwriting prep notes at a desk", "reading good news on a phone", "calm direct-to-camera authority pose">

   Setting: <named background category from the KB ("clean studio" / "environmental context" / "editorial blurred backdrop" / "narrative dual-frame" / "gradient + texture overlay" / "hero banner backdrop" / "top-down flat-lay"), dominant background hue with hex code, environment specifics, three depth layers (foreground anchor, midground subject, background field), atmosphere touches (soft window haze / dust motes / bokeh balls / lens flare — pick at most 2)>

   Composition: <framing keyword (portrait headshot / medium close-up / environmental wide / over-the-shoulder / top-down flat-lay / hero centered), focal point on a named rule-of-thirds intersection ("subject's eyes on the upper-third line"), depth-of-field with explicit f-stop, named negative-space zone reserved for caption overlay ("clean upper-right third reserved for headline")>

   Lighting: <ONE named lighting setup from the KB ("soft window light from frame-left" / "golden hour rim with warm front fill" / "studio softbox key 45° left + bounce fill 60% right" / "single-source dramatic 45° front-left" / "practical interior glow" / "top-down soft diffuse"), key-to-fill ratio, color temperature in Kelvin, sub-surface skin glow note for portraits>

   Style: <named color grade / film stock from the KB ("Kodak Portra 400 grade" / "Fujifilm Pro 400H" / "Cinestill 800T tungsten" / "modern editorial grade" / "warm documentary grade"), film grain level, contrast direction (lifted blacks / crushed blacks / clean true neutrals), overall mood adjective>

   Camera: <body + lens + shutter feel, e.g. "shot on Sony A7 IV, 50mm f/1.8, 1/250s, shallow depth of field" or "Fujifilm X-T5, 35mm f/2, environmental focus">

   Props & set dressing: <at least 3 props from the appropriate KB toolkit ("study scene" / "USRN journey" / "celebration" / etc.), with placement notes ("highlighter capped, lying parallel to notebook spine"), realism details (slight asymmetry, subtle wear, visible cable management, a small live plant out-of-focus in the corner)>

   Typography: <pick ONE type system from the KB ("editorial sans-serif" default, OR "display serif" for premium, OR "mono accent"), name the weight + hierarchy (e.g. "bold 700 headline, regular 400 subhead, mono 500 microcopy"), name the text layout pattern ("left-aligned stack" / "centered axial lockup" / "anchor + tag" / "window caption" / "in-scene placement"), tracking direction (tight for headlines, +5-8% for ALL CAPS), case treatment (Title Case / ALL CAPS / lowercase), literal headline string if the template fixes one (wrapped in straight double quotes ≤6 words), text legibility strategy ("subtle gradient scrim" / "frosted glass band" / "knockout block" / "outline + drop" / "in-scene placement"), color of text + scrim>

   Brand elements: <the GritSync brand mark is supplied as a reference image (the official square red icon with the stylized GS glyph). NATURALLY INTEGRATE it into the scene as a real-world object — embroidered patch on a scrub chest, ID-card badge clipped to a lanyard, printed on a notebook spine, sticker on a laptop lid, signage in the background, lockup on a hero banner. Specify which integration this template uses. Then specify how "gritsync.com" appears in-scene (printed on a poster, on the spine of a notebook, on signage, on a lanyard tag — NOT a floating watermark). Palette anchors with hex codes #B81D24 deep red / #FFFFFF white / #1A1A1A soft black / #C8A24C warm gold accents (≤10% of frame).>

   Aspect ratio & safe zones: <primary aspect ratio for this template, where critical content must stay so it survives platform crops + UI chrome, with explicit pixel margins>

   Negative prompt: <anti-artifact terms PLUS brand misspellings to forbid ("never 'GritSink', 'GritSinc', 'Grit Sync', 'gritsync com'"), garbled text, distorted hands, warped fingers, plastic skin, stock-photo flatness, cluttered background, low contrast, off-brand palette, fake bokeh, oversaturated colors, non-Filipino subject, decorative scripts unless template requires, heavy contour makeup, branded chain logos, recognizable real-world UI strings>

BRAND GUARDRAILS (non-negotiable):
  - Subjects: Filipino healthcare professionals (nurses, RNs). Never non-Filipino ethnicities.
  - Palette anchored by deep red #B81D24 + white + soft black + restrained warm gold. Accents ≤10% of frame.
  - The official GritSync brand mark MUST be NATURALLY INTEGRATED into the scene (badge / lanyard / embroidery / signage / sticker / lockup) — NOT a corner watermark. The mark is supplied to the renderer as a reference image; do not invent a different wordmark.
  - "gritsync.com" appears once as printed text in a natural location, not floating.
  - No fabricated claims, no named hospitals/schools, no US landmarks the brand hasn't endorsed.
  - Photoreal + cinematic — never illustrative, never stock-photo flat.

PROMPT QUALITY CHECKLIST — review your draft against this list before returning. If any item is missing, rewrite that section:
  ☐ Subject has wardrobe specifics, pose direction, gaze direction, and a single emotion-vocabulary word.
  ☐ Setting names a background category + dominant hue (hex) + three depth layers + at-most-2 atmosphere touches.
  ☐ Composition names framing keyword + rule-of-thirds anchor + explicit f-stop + a named negative-space zone.
  ☐ Lighting names a setup from the KB vocabulary with key-to-fill ratio + Kelvin temperature.
  ☐ Style names a film-stock grade.
  ☐ Camera names body + lens + aperture.
  ☐ Props lists ≥3 KB-appropriate items with placement notes.
  ☐ Typography names a type system + weight hierarchy + layout pattern + tracking + case + legibility strategy + color.
  ☐ Brand elements name a specific natural-integration site for the GritSync mark (badge / lanyard / sticker / signage / embroidery / lockup).
  ☐ Aspect ratio & safe zones include explicit pixel margins.
  ☐ Negative prompt includes brand-misspelling guards + ≥6 anti-artifact terms.
  ☐ No one-shot specifics that won't generalize across many captions.

PRIMARY ASPECT RATIO FOR THIS TEMPLATE: ${aspectHint} (write the Composition + Brand elements + safe-zone notes around this ratio).

${rendererNote}

NAMING:
  - Template name: 2-4 words, evocative, no jargon. Example shapes: "Golden Hour Pass", "Quiet Study Scene", "Newsroom Documentary", "ATT Inbox Moment".

Return JSON only.`

    const userPayload = `OPERATOR BRIEF (optional creative direction): ${cleanBrief || '(none — pick a fresh direction that fills a gap)'}

PRIMARY ASPECT RATIO (inferred from brief, or 4:5 default): ${aspectHint}

TARGET RENDERER: ${useProvider}

EXISTING TEMPLATES IN THE LIBRARY (research — identify gaps, do NOT duplicate):
${JSON.stringify(templateSummaries, null, 2)}

RECENT POST CAPTIONS (shows what topics the team is shipping — choose a template that complements them):
${JSON.stringify(captionSummaries, null, 2)}

Return ONLY this JSON object — no surrounding text, no markdown fence:
{
  "name": "<2-4 word template name>",
  "prompt": "<the full multi-paragraph structured template prompt as a single string with \\n line breaks. Must contain all 12 labelled sections IN THIS EXACT ORDER: Subject / Action / Setting / Composition / Lighting / Style / Camera / Props & set dressing / Typography / Brand elements / Aspect ratio & safe zones / Negative prompt. Each section should be DETAILED — multiple sentences. Read like a designer's spec sheet, not a tweet.>",
  "reasoning": "<one sentence: what gap this fills and why it'll work for this audience on the ${useProvider} renderer at ${aspectHint}>"
}`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.75,
        max_tokens: 5000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPayload },
        ],
      }),
    })
    const aiJson: any = await aiRes.json().catch(() => ({}))
    if (!aiRes.ok) return res.status(502).json({ error: aiJson.error?.message || `OpenAI HTTP ${aiRes.status}` })

    const text = aiJson.choices?.[0]?.message?.content || '{}'
    let parsed: { name?: string; prompt?: string; reasoning?: string } = {}
    try { parsed = JSON.parse(text) } catch {}
    const name = (parsed.name || '').trim()
    const prompt = (parsed.prompt || '').trim()
    const reasoning = (parsed.reasoning || '').trim()
    if (!name || !prompt) return res.status(502).json({ error: 'Lensa returned an incomplete template' })

    // ── BUILD ─────────────────────────────────────────────────────────
    // Render a preview with the chosen provider. applyImageTextGuards is
    // applied inside the provider funcs, so branding stays mandatory.
    // skip_preview lets the modal's inline "Ask Lensa to draft" finish in
    // one LLM call — the operator will see the preview when they hit
    // "Create + render preview" on save anyway.
    let preview_url: string | null = null
    let preview_error: string | null = null
    if (!skipPreview) {
      try {
        preview_url = await generateImage(useProvider, prompt)
      } catch (err: any) {
        preview_error = err.message || 'Preview render failed'
      }
    }

    res.json({ data: { name, prompt, reasoning, preview_url, preview_error, provider: useProvider } })
  } catch (err: any) {
    console.error('image-templates orchestrate error:', err)
    res.status(500).json({ error: err.message || 'Lensa failed to orchestrate a template' })
  }
})

router.delete('/image-templates/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'id is required' })

    const existing = await pool.query(
      `SELECT is_default FROM social_image_templates WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Template not found' })
    if (existing.rows[0].is_default) {
      return res.status(400).json({ error: 'Cannot delete the default template — edit it instead.' })
    }

    await pool.query(`DELETE FROM social_image_templates WHERE id = $1`, [id])
    res.json({ success: true })
  } catch (err: any) {
    console.error('image-template delete error:', err)
    res.status(500).json({ error: err.message || 'Failed to delete image template' })
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
    ? 'CTAs live in section 9 of the master format — keep "https://www.gritsync.com/quote" verbatim and the four bullet CTAs intact.'
    : 'If hashtags are listed in the plan, include 3-6 of them (or your own equally-relevant ones) only at the very end, on a separate line.'}
- ${opts.caption_format
    ? 'Hashtags live in section 11 of the master format — keep them verbatim, or swap for equally-relevant ones if and only if the topic genuinely warrants different tags.'
    : 'Emojis sparingly: at most 2 per caption, used to anchor meaning, never to decorate.'}
- HARD REQUIREMENT: every caption MUST include a GritSync website URL on its OWN line, immediately before the hashtags. Use https://www.gritsync.com/quote when the caption pushes toward applying / pricing / getting a quote; otherwise use https://www.gritsync.com/. Do not shorten, paraphrase, or omit the URL.

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
  // Belt-and-braces: enforce the GritSync URL even when the model drops
  // it. If any gritsync.com link is already present we trust the model's
  // placement; otherwise we insert the website URL on its own line just
  // before the trailing hashtags.
  return captions.map(ensureGritsyncUrl)
}

// Insert a GritSync URL into a caption when the model forgot to include
// one. Picks /quote when the caption clearly pushes toward applying or
// pricing; falls back to the homepage for everything else. Idempotent —
// returns the caption unchanged when a gritsync.com URL is already present.
function ensureGritsyncUrl(caption: string): string {
  if (/gritsync\.com/i.test(caption)) return caption
  const wantsQuote = /\b(quote|apply|price|pricing|payment|enroll|sign\s*up|start your application)\b/i.test(caption)
  const url = wantsQuote ? 'https://www.gritsync.com/quote' : 'https://www.gritsync.com/'

  // Split the caption into a body and a trailing hashtag block so we can
  // slot the URL on its own line BETWEEN them (hashtags stay at the end).
  const lines = caption.split('\n')
  let hashtagStart = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t) continue
    if (/^#\S/.test(t) || /(\s|^)#\S+/.test(t)) hashtagStart = i
    else break
  }
  const body = lines.slice(0, hashtagStart).join('\n').replace(/\s+$/, '')
  const tail = lines.slice(hashtagStart).join('\n').trim()
  return tail ? `${body}\n\n${url}\n\n${tail}` : `${body}\n\n${url}`
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

  const system = `You are a senior creative director who turns social-media captions into image prompts for GritSync, an NCLEX-processing agency that helps Filipino-trained nurses become USRNs. The renderer is OpenAI gpt-image-1 at the "high" quality tier — it does photoreal subjects, cinematic light, and short on-image text strings extremely well, and accepts long multi-paragraph structured prompts (~32K input tokens) so you can be detailed without truncation. The brand facts below are ground truth — every image you specify must be consistent with them.

${GRITSYNC_KB}

YOUR JOB:
1. Read the operator's MASTER IMAGE GUIDE — it captures the brand feel (subject identity, color palette, composition language, mood). Treat this as inspiration, not a contract.
2. Read the CAPTION the image must accompany. Extract the specific scene, emotional beat, and visual cues the copy implies.
3. Produce ONE final image prompt (STRUCTURED, multi-paragraph) that:
   - Hews to the brand feel of the guide (Filipino healthcare subjects, premium ad aesthetic, deep-red / white / soft-black / gold palette).
   - Pictures the caption's specific moment — not a generic brand shot.
   - You may restructure, prune, or enhance the guide freely if the caption demands it. Reorder sections, add new visual ideas, drop dead phrases.
   - ALWAYS includes the GritSync brand wordmark + gritsync.com URL in the composition (specify placement + color + size — the renderer will approximate the letterforms).
   - Stays photorealistic + cinematic.
   - Includes a negative-prompt block at the end with anti-artifact terms (distorted hands, warped documents, AI text glitches, etc.).
   - No fabricated claims, no named hospitals, no non-Filipino ethnicities, no US landmarks the brand hasn't endorsed.

PROMPT STRUCTURE — every output should follow these labelled sections in order:
   Subject: <one short sentence: who's in the frame, age range, scrubs/clothing>
   Action: <what they're doing in the caption's specific moment>
   Setting: <where + when, lighting, weather/mood>
   Composition: <camera angle, framing, depth of field, focal point>
   Brand elements: <GritSync logo placement, gritsync.com URL placement, color palette anchors>
   Text overlays (max 3, each quoted): <"...", "...", "...">  // skip if the moment doesn't need text
   Style: <photoreal / cinematic descriptors>
   Negative prompt: <comma-separated anti-artifact terms>

TEXT-CORRECTNESS RULES (critical — image renderers garble text when prompted carelessly):
- LIMIT the number of distinct text strings in the image to AT MOST 3 (logo wordmark + one headline + one CTA / URL). More than that and the renderer starts inventing letters.
- Every text string you ask the renderer to render MUST be wrapped in double quotes in the prompt, exact spelling, e.g. the text "GritSync" in white sans-serif top-right.
- Keep each text string SHORT — under 6 words for headlines, under 4 for CTAs, single-token for the logo wordmark. Long sentences come out as gibberish.
- Always include this instruction near the top of the prompt verbatim: "All visible text must be rendered exactly as quoted, with clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs."
- Verify EVERY string you ask the renderer to draw is correctly spelled. Common brand strings: "GritSync" (one word, capital G + S), "gritsync.com" (all lowercase), "USRN", "NCLEX", "ATT".
- Where the master guide asks for a long headline/CTA that's likely to glitch, REPLACE the string with the shortest brand-accurate equivalent (e.g. "YOUR USRN DREAM STARTS HERE" → "USRN STARTS HERE").
- Strengthen the negative-prompt section with: "misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling, illegible signage."

────────────────────────────────────────────────────────────────────────
FEW-SHOT EXAMPLES — match this shape, vocabulary, and discipline.

EXAMPLE 1 — Caption hook: "Nakapasa sa NCLEX gamit ang GritSync na walang stress"
Image prompt:
  All visible text must be rendered exactly as quoted, with clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs.
  Subject: Filipino registered nurse, late 20s, light-blue scrubs, hair tied back, holding a tablet that shows a clean green "PASS" indicator on a soft white UI background.
  Action: Quiet relief — eyes lit up, faint smile, tablet held close to chest as she looks slightly off-camera.
  Setting: Modern apartment break-room corner at golden hour, soft window light from the side, hint of a coffee mug on a wood side table.
  Composition: Medium-close portrait, shallow depth of field, subject slightly right-of-center, negative space top-left for the logo.
  Brand elements: White "GritSync" wordmark in top-right, small "gritsync.com" footer text in soft gray bottom-right, deep-red and gold subtle accents on the tablet UI.
  Text overlays: "GritSync", "gritsync.com".
  Style: Photoreal editorial, cinematic warm tones, gentle natural light, premium social-ad aesthetic.
  Negative prompt: misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling, illegible signage, distorted hands, warped documents, AI text glitches.

EXAMPLE 2 — Caption hook: "Iniwan kang mag-isa sa NCLEX paperwork? Hindi kami ganon."
Image prompt:
  All visible text must be rendered exactly as quoted, with clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs.
  Subject: Two Filipino professionals at a clean modern office desk — one in light-blue scrubs (the client), one in a soft navy blazer (the GritSync advisor), heads angled toward each other in collaboration.
  Action: Advisor's finger lightly touching a printed NCLEX application checklist; client nodding with a relieved expression.
  Setting: Bright minimalist office, large window blurred behind them, warm afternoon light, hint of red-and-white branding on the back wall.
  Composition: Three-quarter angle, shallow depth of field, top-third of the frame open for the wordmark.
  Brand elements: White "GritSync" wordmark in top-right of the image, small "gritsync.com" text in soft gray bottom-center.
  Text overlays: "GritSync", "gritsync.com".
  Style: Photoreal editorial, soft cinematic light, premium agency feel.
  Negative prompt: misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling, illegible signage, distorted hands, AI text glitches.

EXAMPLE 3 — Caption hook: "ATT mo, hinihintay namin para sa'yo araw-araw."
Image prompt:
  All visible text must be rendered exactly as quoted, with clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs.
  Subject: Filipino healthcare professional, mid-20s, sitting at a tidy desk, soft focus on a laptop screen showing a clean email inbox with a single highlighted notification.
  Action: Hand lightly resting on the trackpad, slight forward lean, calm focused expression — the moment they see the notification land.
  Setting: Modern home office at evening, warm desk-lamp light, a small plant and a mug just out of focus.
  Composition: Over-the-shoulder framing, shallow depth of field, screen filling the right two-thirds of the frame.
  Brand elements: "GritSync" wordmark subtly visible on the laptop's open browser tab UI; "gritsync.com" in small text at the corner of the screen.
  Text overlays: "ATT received", "GritSync".
  Style: Photoreal cinematic, warm tones, ad-quality lighting.
  Negative prompt: misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling, illegible signage, distorted hands, warped documents, AI text glitches.
────────────────────────────────────────────────────────────────────────

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

// DALL·E-3 has a hard ~4000-char prompt limit; DALL·E-2 is tighter (~1000).
// gpt-image-1 accepts ~32K input tokens (≈ 100K+ characters in practice),
// so we pass complex multi-paragraph prompts to it without truncation. For
// the DALL·E fallbacks we keep the core composition + drop the longer
// brand-guard preamble so the request fits.
const DALLE3_MAX_CHARS = 3800
const DALLE2_MAX_CHARS = 950

function trimPromptForModel(prompt: string, model: OpenAIImageModel): string {
  if (model === 'dall-e-3' && prompt.length > DALLE3_MAX_CHARS) {
    // Keep the brand mandate + the FIRST paragraph of the user prompt + the
    // negative-text suffix. Multi-paragraph structured prompts have the
    // subject in para 1; later paragraphs are typography/composition which
    // DALL·E-3 handles weakly anyway.
    const head = prompt.slice(0, DALLE3_MAX_CHARS - 400)
    const tail = prompt.slice(-380)
    return `${head}\n\n…[trimmed for DALL·E-3]…\n\n${tail}`
  }
  if (model === 'dall-e-2' && prompt.length > DALLE2_MAX_CHARS) {
    return prompt.slice(0, DALLE2_MAX_CHARS - 4) + '…'
  }
  return prompt
}

async function tryOpenAIImage(
  apiKey: string,
  prompt: string,
  model: OpenAIImageModel,
  size: string = '1024x1024'
): Promise<{ url?: string; error?: string; shouldFallback?: boolean }> {
  const finalPrompt = trimPromptForModel(prompt, model)

  // For gpt-image-1, when we have the brand logo buffer loaded, route
  // through /v1/images/edits with the logo as a reference image. The
  // model then composes the GritSync mark naturally INTO the scene —
  // embroidered on a scrub badge, printed on a notebook, on signage, on
  // a coffee cup, etc. — instead of hallucinating its own wordmark or
  // having one stamped on top later. This is the "designed in, not
  // watermark" guarantee.
  if ((model === 'gpt-image-1' || model === 'gpt-image-1-mini') && BRAND_LOGO_BUF) {
    return await tryOpenAIImageWithLogo(apiKey, finalPrompt, model, size)
  }

  // Plain text-to-image path: gpt-image-1 without the reference logo,
  // or DALL·E fallbacks. The prompt-side brand mandate handles wordmark
  // placement on these paths.
  const r = await openaiImagesGenerationsRequest(apiKey, finalPrompt, model, size)
  return await handleOpenAIImageResponse(r)
}

// Helper: text-to-image POST (no reference images). Pulled out so the
// edit path and the plain path share response handling.
async function openaiImagesGenerationsRequest(
  apiKey: string,
  prompt: string,
  model: OpenAIImageModel,
  size: string,
): Promise<Response> {
  const body: Record<string, any> = { model, prompt, n: 1, size }
  if (model === 'gpt-image-1' || model === 'gpt-image-1-mini') {
    body.quality = 'high'
    body.moderation = 'low'
    body.output_format = 'png'
  } else if (model === 'dall-e-3') {
    body.quality = 'hd'
    body.style = 'natural'
  }
  return await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
}

// /v1/images/edits path — gpt-image-1 with the GritSync logo as a reference
// image. The model treats the reference as visual context: it doesn't have
// to COPY the logo, but it knows the brand mark to compose into the design.
// Multipart form body (JSON isn't accepted on /edits).
async function tryOpenAIImageWithLogo(
  apiKey: string,
  prompt: string,
  model: OpenAIImageModel,
  size: string,
): Promise<{ url?: string; error?: string; shouldFallback?: boolean }> {
  if (!BRAND_LOGO_BUF) {
    // Shouldn't reach here (caller checks BRAND_LOGO_BUF) but be safe.
    return { error: 'brand logo not loaded', shouldFallback: true }
  }
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', size)
  form.append('quality', 'high')
  form.append('output_format', 'png')
  // `image[]` — reference image. The OpenAI client accepts repeated
  // `image[]` keys for multiple references; we ship just the GritSync
  // logo so the design composes around that single visual anchor.
  form.append(
    'image[]',
    new Blob([new Uint8Array(BRAND_LOGO_BUF)], { type: 'image/png' }),
    'gritsync_logo.png',
  )
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  return await handleOpenAIImageResponse(r)
}

async function handleOpenAIImageResponse(r: Response): Promise<{ url?: string; error?: string; shouldFallback?: boolean }> {
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = j.error?.message || `OpenAI HTTP ${r.status}`
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
// requested aspect ratio. dall-e-2 only does square sizes; the gpt-image-1
// family accepts 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape).
function sizeFor(model: OpenAIImageModel, aspect: string): string {
  if (model === 'dall-e-2') return '1024x1024'
  if (model === 'dall-e-3') {
    if (aspect === '16:9') return '1792x1024'
    if (aspect === '9:16' || aspect === '4:5') return '1024x1792'
    return '1024x1024'
  }
  // gpt-image-1 / gpt-image-1-mini share the size set.
  if (aspect === '16:9') return '1536x1024'
  if (aspect === '9:16' || aspect === '4:5') return '1024x1536'
  return '1024x1024'
}

// Universal branding + text-correctness preamble. Every image leaving any
// provider (OpenAI / Gemini / Grok) is wrapped with this block so the
// GritSync wordmark and URL appear on the composition even when the
// source prompt forgot to ask. The text-correctness rules keep the
// brand strings legible — image renderers garble copy when it's vague
// or unquoted.
const IMAGE_BRAND_MANDATE =
  'MANDATORY GRITSYNC BRANDING — every generated image MUST include the GritSync brand identity NATURALLY INTEGRATED into the scene (NOT as a corner watermark). These elements are NON-NEGOTIABLE:\n' +
  '  • The official GritSync brand mark — a square red icon with a stylized "GS" glyph — has been provided as a reference image. INTEGRATE it into the design as a real-world object visible in the scene: embroidered patch on a scrub uniform, ID-card badge clipped to a lanyard, printed on a notebook cover, sticker on a laptop, signage on a wall behind the subject, lockup on a hero banner, etc. It must look like part of the scene — same lighting, same perspective, same shadow as everything else.\n' +
  '  • The brand mark must be CLEARLY VISIBLE and IDENTIFIABLE — not hidden, not heavily cropped, not blurred out. Size it like a real-world brand mark in that context (chest-patch sized on a uniform, business-card sized on signage).\n' +
  '  • The URL "gritsync.com" (all lowercase, no spaces) appears once as small printed text in a natural location — printed at the bottom of a poster, on the spine of a notebook, on signage, on a lanyard tag. Not a floating watermark.\n' +
  '  • Brand color palette anchored to deep red, clean white, soft black, with restrained warm-gold accents.\n' +
  '  • Do NOT invent a different GritSync wordmark or alter the provided brand mark. Reproduce it faithfully — colors, glyph proportions, spelling — as it appears in the reference.\n\n'

const IMAGE_TEXT_CORRECTNESS_PREAMBLE =
  IMAGE_BRAND_MANDATE +
  'TEXT-RENDERING REQUIREMENTS: All visible text in the image must be rendered exactly as written — clean modern sans-serif typography, no spelling errors, no extra letters, no warped glyphs, no garbled words. Brand strings to render exactly: "GritSync" (one word, capital G and S), "gritsync.com" (all lowercase). Keep every visible text string short (under 6 words for headlines, under 4 for CTAs) so the renderer can produce legible letterforms.\n\n'

const IMAGE_NEGATIVE_TEXT_SUFFIX =
  '\n\nReinforced negative prompt (text artifacts + branding): misspelled text, garbled letters, fake-looking typography, double-printed words, extra characters, wrong brand spelling (never "GritSink", "GritSinc", "Grit Sync", "gritsync com"), illegible signage, jumbled letters, distorted hands, warped documents, AI text glitches, missing GritSync wordmark, missing gritsync.com URL, off-brand color palette.'

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

  // Cascade ordering — gpt-image-1 is the primary:
  //   1. gpt-image-1       — best text + photoreal subjects on one call,
  //                          accepts ~32K input tokens so complex
  //                          multi-paragraph structured prompts pass
  //                          through verbatim.
  //   2. gpt-image-1-mini  — cheaper / faster fallback (same family,
  //                          same prompt shape, slightly weaker text).
  //   3. dall-e-3          — last-resort photoreal; prompt is trimmed
  //                          to ~3800 chars to fit its hard limit.
  //   4. dall-e-2          — emergency fallback. Prompt trimmed to ~950.
  // If OpenAI returns `model_not_found` for any step the chain quietly
  // tries the next.
  const chain: OpenAIImageModel[] = ['gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2']
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
  const guardedPrompt = applyImageTextGuards(prompt)
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: guardedPrompt }] }],
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
  const guardedPrompt = applyImageTextGuards(prompt)
  const r = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-2-image-1212',
      prompt: guardedPrompt,
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

// Kling AI (Kuaishou). Auth is JWT signed with HS256 over { iss: access_key,
// exp: now+1800s, nbf: now-5s }. Image gen lives at /v1/images/generations
// with `kling-v1-5` as the modern default. Like every other provider we
// route through applyImageTextGuards so GritSync branding stays mandatory.
function klingJwt(): string {
  const accessKey = KLING_ACCESS_KEY()
  const secretKey = KLING_SECRET_KEY()
  if (!accessKey || !secretKey) {
    throw new Error('KLING_ACCESS_KEY / KLING_SECRET_KEY not set on the server')
  }
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { iss: accessKey, exp: now + 1800, nbf: now - 5 },
    secretKey,
    { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } }
  )
}

async function klingPoll(host: string, taskId: string, kind: 'images' | 'videos/text2video' | 'videos/image2video'): Promise<any> {
  // Kling jobs are async — submit returns a task_id, then poll
  // /{kind}/{task_id} until status === 'succeed' or 'failed'.
  const deadline = Date.now() + 4 * 60 * 1000 // 4-minute budget per gen
  while (Date.now() < deadline) {
    const r = await fetch(`${host}/v1/${kind}/${taskId}`, {
      headers: { Authorization: `Bearer ${klingJwt()}` },
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j?.message || `Kling poll HTTP ${r.status}`)
    const status = j?.data?.task_status
    if (status === 'succeed') return j.data
    if (status === 'failed') throw new Error(j?.data?.task_status_msg || 'Kling task failed')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error('Kling task timed out after 4 minutes')
}

async function generateImageKling(prompt: string, aspect_ratio: string = '1:1'): Promise<string> {
  const host = KLING_HOST()
  const guardedPrompt = applyImageTextGuards(prompt)
  // Kling accepts ratios as their own enum — map common values, default 1:1.
  const klingRatio =
    aspect_ratio === '16:9' ? '16:9'
    : aspect_ratio === '9:16' ? '9:16'
    : aspect_ratio === '4:5' || aspect_ratio === '3:4' ? '3:4'
    : '1:1'

  const submit = await fetch(`${host}/v1/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${klingJwt()}` },
    body: JSON.stringify({
      model_name: 'kling-v1-5',
      prompt: guardedPrompt,
      n: 1,
      aspect_ratio: klingRatio,
    }),
  })
  const submitJson: any = await submit.json().catch(() => ({}))
  if (!submit.ok) throw new Error(submitJson?.message || `Kling submit HTTP ${submit.status}`)
  const taskId = submitJson?.data?.task_id
  if (!taskId) throw new Error('Kling did not return a task_id')

  const done = await klingPoll(host, taskId, 'images')
  const url: string | undefined = done?.task_result?.images?.[0]?.url
  if (!url) throw new Error('Kling task succeeded but returned no image URL')
  const dl = await fetch(url)
  if (!dl.ok) throw new Error(`Failed to download Kling image (HTTP ${dl.status})`)
  const buf = Buffer.from(await dl.arrayBuffer())
  const ct = dl.headers.get('content-type') || 'image/png'
  return persistImage(buf, ct)
}

async function generateImage(provider: ImageProvider, prompt: string): Promise<string> {
  if (provider === 'nano-banana') return generateImageGemini(prompt)
  if (provider === 'grok') return generateImageGrok(prompt)
  if (provider === 'kling') return generateImageKling(prompt)
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
      image_provider === 'nano-banana' || image_provider === 'grok' || image_provider === 'kling' ? image_provider : 'openai'

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
          // image_prompt persists the EXACT prompt sent to the renderer
          // (the per-caption-derived one, falling back to the master
          // guide) so the BankItemModal can show it and operators can
          // copy/iterate. The column was added in
          // 2026-05-20_social_content_bank_image_prompt.sql.
          const ins = await pool.query(
            `INSERT INTO social_content_bank
               (caption, media_url, media_type, source_topic, enhanced_prompt, image_prompt, generation_settings, status, created_by_user_id)
             VALUES ($1, $2, 'image', $3, $4, $5, $6::jsonb, 'available', $7)
             RETURNING *`,
            [caption, mediaUrl, cleanTopic || cleanIdea, brief.enhanced, imagePrompt, JSON.stringify(settings), req.user!.id]
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
               (caption, media_url, media_type, prediction_id, source_image_url, source_topic, enhanced_prompt, image_prompt, generation_settings, status, created_by_user_id)
             VALUES ($1, NULL, 'video', $2, $3, $4, $5, $6, $7::jsonb, 'pending_media', $8)
             RETURNING *`,
            [caption, predictionId, sourceImageUrl, cleanTopic || cleanIdea, brief.enhanced, imagePrompt, JSON.stringify(settings), req.user!.id]
          )
          return ins.rows[0]
        }
      } catch (perItemErr: any) {
        // Persist a caption-only row so the operator doesn't lose the
        // copy when image/video generation hits a provider error. Keep
        // the image_prompt that WOULD have been used so the operator
        // can copy + retry from the BankItemModal.
        const ins = await pool.query(
          `INSERT INTO social_content_bank
             (caption, media_type, source_topic, enhanced_prompt, image_prompt, generation_settings, status, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'media_failed', $7)
           RETURNING *`,
          [caption, ct, cleanTopic || cleanIdea, brief.enhanced + `\n\n[media error: ${perItemErr.message}]`, imagePrompt, JSON.stringify(settings), req.user!.id]
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

// Regenerate the image for an existing bank item using a (possibly edited)
// prompt. Image items only — videos must be re-rendered through the batch
// generator. The new prompt + provider get persisted onto the row so the
// modal shows the prompt that produced the visible image.
router.post('/content-bank/:id/regenerate-image', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id)
    const { image_prompt, provider } = req.body || {}

    const row = (await pool.query(`SELECT * FROM social_content_bank WHERE id = $1`, [id])).rows[0]
    if (!row) return res.status(404).json({ error: 'Bank item not found' })
    if (row.media_type !== 'image') {
      return res.status(400).json({ error: 'Only image items can be regenerated. Use the batch generator to remake videos.' })
    }

    const nextPrompt = typeof image_prompt === 'string' && image_prompt.trim()
      ? image_prompt.trim()
      : (row.image_prompt || '').trim()
    if (!nextPrompt) return res.status(400).json({ error: 'image_prompt is required' })

    const existingProvider: ImageProvider =
      row.generation_settings?.image_provider === 'nano-banana' ? 'nano-banana'
      : row.generation_settings?.image_provider === 'grok' ? 'grok'
      : row.generation_settings?.image_provider === 'kling' ? 'kling'
      : 'openai'
    const nextProvider: ImageProvider =
      provider === 'nano-banana' || provider === 'grok' || provider === 'kling' || provider === 'openai'
        ? provider
        : existingProvider

    let mediaUrl: string
    try {
      mediaUrl = await generateImage(nextProvider, nextPrompt)
    } catch (err: any) {
      return res.status(502).json({ error: err.message || 'Image regeneration failed' })
    }

    const nextSettings = {
      ...(row.generation_settings || {}),
      image_provider: nextProvider,
      regenerated_at: new Date().toISOString(),
    }

    const upd = await pool.query(
      `UPDATE social_content_bank
         SET media_url = $1,
             image_prompt = $2,
             generation_settings = $3::jsonb,
             status = 'available',
             updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [mediaUrl, nextPrompt, JSON.stringify(nextSettings), id]
    )
    res.json({ data: upd.rows[0] })
  } catch (err: any) {
    console.error('regenerate-image error:', err)
    res.status(500).json({ error: err.message || 'Image regeneration failed' })
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
