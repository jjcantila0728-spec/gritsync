import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import pool from '../db'

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

    const system = `You are a social-media copywriter for GritSync, a US healthcare and nursing career platform that helps internationally educated nurses immigrate and pass the NCLEX. Write copy that is warm, credible, and specific. Avoid clichés and corporate-speak. Never fabricate stats or testimonials.`

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
    const apiKey = OPENAI_KEY()
    if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY is not set on the server' })

    const { prompt, aspect_ratio = '1:1', style = '', quality = 'medium' } = req.body || {}
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' })

    const size =
      aspect_ratio === '16:9' ? '1536x1024'
      : aspect_ratio === '9:16' || aspect_ratio === '4:5' ? '1024x1536'
      : '1024x1024'

    const fullPrompt = style ? `${prompt}. Style: ${style}.` : prompt

    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: fullPrompt,
        size,
        quality,
        n: 1,
      }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: j.error?.message || `OpenAI HTTP ${r.status}` })

    const b64 = j.data?.[0]?.b64_json
    if (!b64) return res.status(502).json({ error: 'No image returned' })
    const buf = Buffer.from(b64, 'base64')

    const filename = `social/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    await pool.query(
      `INSERT INTO file_storage (storage_key, data, content_type, file_size)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (storage_key) DO UPDATE
         SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, updated_at = NOW()`,
      [filename, buf, 'image/png', buf.length]
    )

    const url = `${PUBLIC_BASE}/api/storage/public/${filename}`
    res.json({ data: { url, prompt: fullPrompt, aspect_ratio } })
  } catch (err: any) {
    console.error('AI image error:', err)
    res.status(500).json({ error: err.message || 'AI image failed' })
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
    const filename = `social/ai/${id}.${ext}`
    await pool.query(
      `INSERT INTO file_storage (storage_key, data, content_type, file_size)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (storage_key) DO UPDATE
         SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, updated_at = NOW()`,
      [filename, buf, contentType, buf.length]
    )
    const url = `${PUBLIC_BASE}/api/storage/public/${filename}`
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

    const system = `You are a senior performance-marketing copywriter for GritSync, a US healthcare/nursing career platform helping internationally educated nurses immigrate and pass the NCLEX. Write ads that convert: specific benefit-led hooks, concrete numbers when you have them, no clichés, no fake testimonials, no fake urgency, and never claim guaranteed outcomes. Follow each ad network's policy.`

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

// Helper: convert raw user inputs into a single, richer "brief" the downstream
// caption + media prompts can both consume. This is the "prompt enhancer" the
// product spec calls for.
async function enhanceBrief(input: {
  topic: string
  preselected_idea?: string | null
  tone: string
  length: string
  language: string
  content_type: 'image' | 'video'
  additional_details?: string
}): Promise<{ enhanced: string; image_prompt_seed: string; video_prompt_seed: string }> {
  const apiKey = OPENAI_KEY()
  // Fall back to a trivial pass-through if OpenAI isn't configured — the
  // generator still works, just without the enhancer pass.
  const fallback = () => {
    const seed = [input.preselected_idea, input.topic, input.additional_details]
      .filter(Boolean).join(' — ')
    return { enhanced: seed, image_prompt_seed: seed, video_prompt_seed: seed }
  }
  if (!apiKey) return fallback()

  const system = `You refine raw post ideas into a tight brief for a downstream caption + media generator. Output STRICT JSON only.`
  const user = `Refine this post idea into a brief.

Raw topic: ${input.topic || '(none)'}
Preselected idea: ${input.preselected_idea || '(none)'}
Tone: ${input.tone}
Length: ${input.length}
Language: ${input.language}
Content type: ${input.content_type}
Additional guidance: ${input.additional_details || '(none)'}

Brand context: GritSync is a US healthcare/nursing career platform helping internationally educated nurses immigrate and pass the NCLEX. Stay accurate, warm, and never fabricate stats or testimonials.

Return ONLY this JSON object:
{
  "enhanced": "A 2-4 sentence sharpened brief for a copywriter — what to say, who to say it to, what the post should accomplish.",
  "image_prompt_seed": "A concrete visual prompt (composition, subject, lighting, mood) for a single still image. No text overlays.",
  "video_prompt_seed": "A short scene description for a 5-second vertical video (subject, action, camera, mood)."
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
        max_tokens: 600,
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
    return {
      enhanced: String(parsed.enhanced || '').trim() || fallback().enhanced,
      image_prompt_seed: String(parsed.image_prompt_seed || '').trim() || fallback().image_prompt_seed,
      video_prompt_seed: String(parsed.video_prompt_seed || '').trim() || fallback().video_prompt_seed,
    }
  } catch {
    return fallback()
  }
}

// Helper: generate N caption variants in the requested language/tone/length.
async function generateCaptions(brief: string, opts: {
  tone: string; length: string; language: string; count: number
}): Promise<string[]> {
  const apiKey = OPENAI_KEY()
  if (!apiKey) return Array.from({ length: opts.count }, (_, i) => `${brief} (variant ${i + 1})`)

  const lengthHint =
    opts.length === 'short' ? 'Under 100 characters.'
    : opts.length === 'long' ? 'Around 250-400 characters across 2-3 short paragraphs.'
    : 'Around 120-220 characters.'

  const languageNote =
    opts.language === 'taglish' ? 'Write in natural Taglish (Filipino + English code-switching, the way bilingual Filipino nurses actually talk online).'
    : opts.language === 'filipino' ? 'Write in conversational Filipino (Tagalog).'
    : 'Write in conversational English.'

  const system = `You are a social-media copywriter for GritSync, a US healthcare/nursing platform for internationally educated nurses. Write warm, specific, credible copy. No clichés, no fabricated stats or testimonials.`
  // JSON-mode requires an object root, so we wrap the array in { "captions": [...] }
  // and unwrap below. The model is much more reliable in JSON mode.
  const user = `Write ${opts.count} distinct caption variants for one post.

Brief: ${brief}
Tone: ${opts.tone}
Length: ${lengthHint}
Language: ${languageNote}
Hashtags: 3-6 relevant ones at the end.
Emojis: sparing, one or two max.

Return ONLY this JSON object — no surrounding text, no markdown fence:
{ "captions": ["First caption…", "Second caption…", ... exactly ${opts.count} strings] }`

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

// ─── Image generation (per-provider) ──────────────────────────────────────
//
// All three providers funnel through `generateImage(provider, prompt)`, which
// downloads/decodes the raw image into a Buffer, persists it to file_storage,
// and returns our public URL. That gives Replicate (for image-to-video) a
// stable URL it can fetch later, regardless of which provider made the image.

async function persistImage(buf: Buffer, contentType: string): Promise<string> {
  const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'png'
  const filename = `social/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  await pool.query(
    `INSERT INTO file_storage (storage_key, data, content_type, file_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (storage_key) DO UPDATE
       SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, updated_at = NOW()`,
    [filename, buf, contentType, buf.length]
  )
  return `${PUBLIC_BASE}/api/storage/public/${filename}`
}

// Try one OpenAI image model. Returns the persisted URL on success, or a
// detail object with `modelAccessError: true` when the project key doesn't
// have access to the requested model — so the caller can fall back.
async function tryOpenAIImage(
  apiKey: string,
  prompt: string,
  model: 'gpt-image-1' | 'dall-e-3'
): Promise<{ url?: string; error?: string; modelAccessError?: boolean }> {
  const body: Record<string, any> = { model, prompt, n: 1, size: '1024x1024' }
  if (model === 'gpt-image-1') {
    body.quality = 'medium'
  } else {
    // dall-e-3 supports 'standard' | 'hd' and defaults to returning a URL.
    // Ask for b64 so we can persist without a second hop.
    body.quality = 'standard'
    body.response_format = 'b64_json'
  }
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = j.error?.message || `OpenAI HTTP ${r.status}`
    // OpenAI returns "Project ... does not have access to model `gpt-image-1`"
    // or a 403/404 with a model_not_found code when the model is gated.
    const accessError =
      /does not have access to model|model_not_found|model `[^`]+`/i.test(msg) ||
      j.error?.code === 'model_not_found' ||
      r.status === 403 || r.status === 404
    return { error: msg, modelAccessError: accessError }
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

async function generateImageOpenAI(prompt: string): Promise<string> {
  const apiKey = OPENAI_KEY()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set on the server')

  // gpt-image-1 is higher quality but requires project access (a one-click
  // approval inside OpenAI's dashboard). Fall back to dall-e-3, which is
  // available on every project by default, so generation works out of the box.
  const first = await tryOpenAIImage(apiKey, prompt, 'gpt-image-1')
  if (first.url) return first.url
  if (first.modelAccessError) {
    const second = await tryOpenAIImage(apiKey, prompt, 'dall-e-3')
    if (second.url) return second.url
    throw new Error(second.error || 'OpenAI dall-e-3 fallback failed')
  }
  throw new Error(first.error || 'OpenAI image generation failed')
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
    if (!cleanTopic && !cleanIdea) {
      return res.status(400).json({ error: 'A topic or a preselected idea is required' })
    }
    const n = Math.max(1, Math.min(6, Number(count) || 3))
    const ct: 'image' | 'video' = content_type === 'video' ? 'video' : 'image'
    const provider: ImageProvider =
      image_provider === 'nano-banana' || image_provider === 'grok' ? image_provider : 'openai'

    // Step 1: enhance.
    const brief = await enhanceBrief({
      topic: cleanTopic,
      preselected_idea: cleanIdea || null,
      tone, length, language,
      content_type: ct,
      additional_details,
    })

    // Step 2: captions in one call.
    const captions = await generateCaptions(brief.enhanced, {
      tone, length, language, count: n,
    })

    // When a template was picked, its `image_prompt` defines the visual
    // family — use it verbatim so every post in that template looks like
    // part of the same brand. Otherwise fall back to the enhancer's seed.
    const imagePrompt = cleanTemplateImagePrompt || brief.image_prompt_seed

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
    }

    const rows: any[] = []
    for (const caption of captions) {
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
          rows.push(ins.rows[0])
        } else {
          // 3a. Generate the starting frame with the chosen image AI.
          const sourceImageUrl = await generateImage(provider, imagePrompt)
          // 3b. Kick off image-to-video on Replicate.
          const predictionId = await startVideoPrediction(brief.video_prompt_seed, sourceImageUrl)
          const ins = await pool.query(
            `INSERT INTO social_content_bank
               (caption, media_url, media_type, prediction_id, source_image_url, source_topic, enhanced_prompt, generation_settings, status, created_by_user_id)
             VALUES ($1, NULL, 'video', $2, $3, $4, $5, $6::jsonb, 'pending_media', $7)
             RETURNING *`,
            [caption, predictionId, sourceImageUrl, cleanTopic || cleanIdea, brief.enhanced, JSON.stringify(settings), req.user!.id]
          )
          rows.push(ins.rows[0])
        }
      } catch (perItemErr: any) {
        // Persist a caption-only row so the user doesn't lose the copy when
        // media generation hits a provider error.
        const ins = await pool.query(
          `INSERT INTO social_content_bank
             (caption, media_type, source_topic, enhanced_prompt, generation_settings, status, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'media_failed', $6)
           RETURNING *`,
          [caption, ct, cleanTopic || cleanIdea, brief.enhanced + `\n\n[media error: ${perItemErr.message}]`, JSON.stringify(settings), req.user!.id]
        )
        rows.push(ins.rows[0])
      }
    }

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
    const filename = `social/ai/${row.prediction_id}.${ext}`
    await pool.query(
      `INSERT INTO file_storage (storage_key, data, content_type, file_size)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (storage_key) DO UPDATE
         SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, updated_at = NOW()`,
      [filename, buf, contentType, buf.length]
    )
    const url = `${PUBLIC_BASE}/api/storage/public/${filename}`
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
