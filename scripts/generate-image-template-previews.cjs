/**
 * One-shot generator for the 15 IMAGE_TEMPLATES preview tiles.
 *
 * For every entry in IMAGE_TEMPLATES (kept in lock-step with the matching
 * constant in src/pages/AdminSocial.tsx), this script:
 *
 *   1. POSTs the template's `image_prompt` to /api/social/ai/image,
 *   2. Downloads the resulting URL,
 *   3. Saves the bytes to public/images/templates/<id>.jpg.
 *
 * After it finishes, commit the new files in public/images/templates/.
 * The Compose tab's image-style picker auto-uses them — each tile's
 * `preview_url` already points at /images/templates/<id>.jpg and falls
 * back to a deterministic picsum placeholder until the real asset lands.
 *
 * Usage (PowerShell):
 *   $env:SEED_TOKEN = "<paste-admin-token>"
 *   node scripts/generate-image-template-previews.cjs
 *
 * Against a local dev backend:
 *   $env:SEED_API_URL = "http://localhost:3001"
 *   $env:SEED_TOKEN = "<paste-admin-token>"
 *   node scripts/generate-image-template-previews.cjs
 *
 * Get the token from any /admin/social tab:
 *   DevTools → Console → copy(localStorage.getItem("gritsync_token"))
 *
 * Notes:
 *   - Each /image call takes ~10-30s on OpenAI's gpt-image-1 model
 *     (the cascading helper falls back to dall-e-3 if the project lacks
 *     gpt-image-1 access — same path the Compose tab uses).
 *   - Templates run sequentially so we don't blow OpenAI rate limits.
 *   - Re-running the script overwrites existing files, so you can refresh
 *     a single template by tweaking its prompt below and re-running.
 */

const fs = require('node:fs/promises')
const path = require('node:path')

const BASE = (process.env.SEED_API_URL || 'https://app.gritsync.com').replace(/\/$/, '')
const TOKEN = process.env.SEED_TOKEN

if (!TOKEN) {
  console.error('SEED_TOKEN is not set.')
  console.error('Get yours from /admin/social → DevTools Console:')
  console.error('  copy(localStorage.getItem("gritsync_token"))')
  console.error('Then re-run:')
  console.error('  $env:SEED_TOKEN = "<paste>"')
  console.error('  node scripts/generate-image-template-previews.cjs')
  process.exit(2)
}

// Must stay in sync with `BRAND_IMAGE_BASE` in src/pages/AdminSocial.tsx —
// the brand-look prefix every visual template prepends.
const BRAND_IMAGE_BASE =
  'Photorealistic editorial photography, warm natural light, candid composition, soft depth of field. ' +
  'Subject: Filipino healthcare professional (warm-brown skin, mid-20s to early-40s). ' +
  'Modern setting. Clean, hopeful, grounded. ' +
  'No text overlays, no readable signage, no logos, no watermarks.'

// Mirror of src/pages/AdminSocial.tsx → IMAGE_TEMPLATES. If you add or
// rename a template there, update this list and re-run.
const TEMPLATES = [
  { id: 'editorial-portrait',  prompt: `${BRAND_IMAGE_BASE} Editorial-grade portrait of a Filipino healthcare professional, soft window light, navy or light-blue scrubs, neutral background, eyes warm and confident, shallow depth of field.` },
  { id: 'hospital-corridor',   prompt: `${BRAND_IMAGE_BASE} Filipino nurse walking through a modern US hospital corridor at golden-hour sunrise, ID badge visible but unreadable, gentle motion blur of a colleague in the background, warm clinical lighting.` },
  { id: 'study-desk-overhead', prompt: `${BRAND_IMAGE_BASE} Overhead view of a Filipino nurse's study desk: open NCLEX review book, laminated credentialing documents, passport, pen, steaming mug, neutral wood surface. Warm afternoon light, soft shadows.` },
  { id: 'golden-hour-outdoor', prompt: `${BRAND_IMAGE_BASE} Filipino USRN standing outside a modern US hospital entrance at golden hour, soft warm light, US flag softly blurred in background, hopeful expression, cinematic framing.` },
  { id: 'bright-apartment',    prompt: `${BRAND_IMAGE_BASE} Bright modern apartment interior: Filipino nurse on a tablet/laptop on the sofa, large windows, hints of warm Filipino touches (rattan, potted plants), natural daylight, lived-in but tidy.` },
  { id: 'document-flatlay',    prompt: `${BRAND_IMAGE_BASE} Top-down flatlay on a clean wood desk: PRC license folder, passport, transcripts, credentialing forms, US-state seal partially visible, small Filipino flag pin, coffee mug, pen. Warm daylight.` },
  { id: 'group-consult',       prompt: `${BRAND_IMAGE_BASE} Two or three Filipino healthcare professionals around a laptop in a modern office: focused, collaborative, no client face visible. Warm office light, clean modern desk, faint background blur.` },
  { id: 'quiet-reflection',    prompt: `${BRAND_IMAGE_BASE} Quiet, intimate framing: Filipino nurse leaning against a window in scrubs during a break, soft late-afternoon light, tired-but-determined faint smile, coffee cup in hand. Cinematic depth of field.` },
  { id: 'diploma-closeup',     prompt: `${BRAND_IMAGE_BASE} Macro close-up of a US RN license / NCLEX pass document / nursing diploma corner with subtle gold seal, navy-scrub sleeve in frame holding it, soft natural light. No readable names.` },
  { id: 'us-cityscape',        prompt: `${BRAND_IMAGE_BASE} Filipino nurse silhouette or back-of-shoulder framing looking at a US city skyline at dawn or dusk (generic — no specific landmark), navy scrubs, hopeful contemplative mood, soft warm/cool color contrast.` },
  { id: 'filipino-home-scene', prompt: `${BRAND_IMAGE_BASE} Warm Filipino home interior — sala/kitchen scene: nurse on a video call or studying at a wooden dining table, family member subtly in background (not the focus), warm yellow tungsten light, hints of rattan and family photos softly blurred.` },
  { id: 'workspace-detail',    prompt: `${BRAND_IMAGE_BASE} Side-angle shot of a clean modern desk: open laptop with unreadable screen, printed checklist, highlighter, stethoscope draped on a chair back, warm afternoon light through a window. Filipino nurse's hand frame on the keyboard.` },
  { id: 'celebration-moment',  prompt: `${BRAND_IMAGE_BASE} Joyful celebration scene: Filipino nurse looking at a phone or tablet with a green "PASS" indicator, hands raised, soft window light, modern apartment or hospital break room. Subtle confetti or balloon hint optional, never overdone.` },
  { id: 'night-study-lamp',    prompt: `${BRAND_IMAGE_BASE} Filipino nurse studying at a cozy desk lamp at night, NCLEX review book open, highlighters scattered, focused expression, warm yellow lamp light, hint of Filipino home interior softly blurred in background.` },
  { id: 'formal-interview',    prompt: `${BRAND_IMAGE_BASE} Professional setting: Filipino nurse in a clean blazer or smart-casual top shaking hands with a US-coded recruiter or HR person at a modern office desk. Warm soft light, US flag pin subtle in background, confident calm expression.` },
]

const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'templates')

async function generateOne(t) {
  const r = await fetch(`${BASE}/api/social/ai/image`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ prompt: t.prompt, aspect_ratio: '1:1', quality: 'medium' }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)

  const remote = body.data && body.data.url
  if (!remote) throw new Error('No URL in /image response')

  // /image may return a relative path (in-DB storage) OR an absolute URL
  // (Drive). Resolve relative paths against the configured BASE so the
  // script works in both modes.
  const absolute = /^https?:\/\//i.test(remote) ? remote : `${BASE}${remote}`

  const dl = await fetch(absolute)
  if (!dl.ok) throw new Error(`Download failed: HTTP ${dl.status}`)
  const buf = Buffer.from(await dl.arrayBuffer())

  const outPath = path.join(OUT_DIR, `${t.id}.jpg`)
  await fs.writeFile(outPath, buf)
  return outPath
}

;(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true })
  console.log(`Generating ${TEMPLATES.length} image-template previews → ${OUT_DIR}`)
  console.log(`Backend: ${BASE}`)
  let ok = 0
  let fail = 0
  for (const t of TEMPLATES) {
    process.stdout.write(`  · ${t.id} ... `)
    try {
      const p = await generateOne(t)
      const stat = await fs.stat(p)
      console.log(`OK (${Math.round(stat.size / 1024)} KB)`)
      ok += 1
    } catch (err) {
      console.log(`FAILED — ${err.message}`)
      fail += 1
    }
  }
  console.log('')
  console.log(`Done. ${ok} generated, ${fail} failed.`)
  if (ok > 0) {
    console.log('Commit the new files in public/images/templates/ and refresh /admin/social?tab=compose.')
  }
})()
