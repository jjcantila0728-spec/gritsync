/**
 * One-shot Content Bank seeder.
 *
 * For every GritSync NCLEX/USRN template, fires ONE /generate-batch request
 * (count=1, image type) against the configured base URL. The Compose tab's
 * card grid stays empty until the user generates something — this fills it
 * with one on-brand sample post per template so the admin sees the visual
 * family immediately.
 *
 * Usage:
 *   1. Log into /admin/social as an admin user in any browser.
 *   2. Open DevTools → Console and run: copy(localStorage.getItem('gritsync_token'))
 *   3. From the repo root:
 *        SEED_TOKEN=<paste> node scripts/seed-content-bank.cjs
 *      Or against a local dev server:
 *        SEED_TOKEN=<paste> SEED_BASE_URL=http://localhost:3001 node scripts/seed-content-bank.cjs
 *
 * Notes:
 *   - We deliberately do NOT mint a JWT here — the script uses your real
 *     admin token, so created_by_user_id on the seeded rows points to a
 *     real user and the call is auditable.
 *   - Each /generate-batch call takes ~30-60s (enhancer + captions + image).
 *     Templates run sequentially so we don't blow OpenAI / Replicate limits.
 */

const BASE = (process.env.SEED_BASE_URL || 'https://app.gritsync.com').replace(/\/$/, '')
const token = process.env.SEED_TOKEN

if (!token) {
  console.error('SEED_TOKEN is not set.')
  console.error('Get yours from any /admin/social tab:')
  console.error('  DevTools → Console → copy(localStorage.getItem("gritsync_token"))')
  console.error('Then re-run: SEED_TOKEN=<paste> node scripts/seed-content-bank.cjs')
  process.exit(2)
}

// Shared image-prompt prefix — matches src/pages/AdminSocial.tsx `BRAND_IMAGE_BASE`
// so seeded posts look exactly like a normal Compose-tab generation.
const BRAND_IMAGE_BASE =
  'Photorealistic editorial photography, warm natural light, candid composition, soft depth of field. ' +
  'Subject: Filipino healthcare professional (warm-brown skin, mid-20s to early-40s). ' +
  'Modern setting. Clean, hopeful, grounded. ' +
  'No text overlays, no readable signage, no logos, no watermarks.'

const TEMPLATES = [
  {
    id: 'nclex-passer-spotlight',
    topic: 'Celebrate a recent NCLEX-RN passer',
    brief:
      'Celebrate an anonymized Filipino nurse who just passed the NCLEX-RN. Acknowledge the long road — years balancing duty work, study, and family. End with quiet encouragement for nurses still on the journey and a soft reminder that GritSync walks with them step by step. Do not fabricate names, scores, or timelines.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse in light-blue scrubs holding a tablet with a green "PASS" indicator, eyes lit up with quiet relief, soft window light from the side, clean modern apartment or hospital break-room background.`,
  },
  {
    id: 'ph-to-usrn-step-guide',
    topic: 'Walk through one step of the PH → USRN journey',
    brief:
      'Pick ONE step in the Philippines-to-USRN journey (CGFNS application, state BON application, NCLEX ATT, VisaScreen, immigrant petition) and walk a Filipino nurse through it in plain language. Cover what is needed, the general timeline range (never fabricated specifics), and one common mistake to avoid. End with a soft CTA to consult GritSync for the actual filing.',
    image_prompt: `${BRAND_IMAGE_BASE} Overhead view of a Filipino nurse's study desk: open NCLEX review book, laminated credentialing documents, passport, pen, steaming mug, neutral wood surface. Warm afternoon light.`,
  },
  {
    id: 'credentialing-explainer',
    topic: 'Explain CGFNS / VisaScreen / state BON in plain language',
    brief:
      'Pick ONE of CGFNS, VisaScreen, or a specific state Board of Nursing requirement. Explain what it is, why it exists, and exactly what a Filipino-trained nurse needs to submit. Short sentences. One concrete tip. No fabricated stats. End with a soft CTA to GritSync for help with the filing.',
    image_prompt: `${BRAND_IMAGE_BASE} Close-up of a Filipino nurse's hands organising a folder of credentialing documents with a faint US state seal visible on one paper, navy scrubs sleeve in frame, warm office-desk lighting.`,
  },
  {
    id: 'visa-bulletin-update',
    topic: 'Neutral, factual EB-3 / Schedule A movement update for nurses',
    brief:
      'Write a short, factual update on the current US visa bulletin movement for nurses (focus on EB-3 Schedule A and Philippines if relevant). Stay neutral — no speculation, no fabricated dates. Explain in one sentence what "retrogression" or "priority date current" means. End with a reminder that GritSync helps clients track this and stay application-ready.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse studying a calendar on a tablet beside a US passport and what looks like an I-140 packet, soft window light, navy and white palette, modern home setting.`,
  },
  {
    id: 'day-in-the-life-usrn',
    topic: 'A specific scene from a Filipino USRN\'s workday',
    brief:
      'Paint a small, specific scene from a Filipino USRN\'s workday — early commute, first patient handoff, lunch with co-workers, end-of-shift moment. Make it relatable, never boastful. No fabricated dollar amounts or named hospitals. Close with one sentence reminding readers that GritSync helps Filipino nurses get here.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN in navy scrubs walking through a modern US hospital corridor at golden-hour sunrise, ID badge visible but unreadable, warm caring expression, gentle motion blur of a colleague in the background.`,
  },
  {
    id: 'nclex-study-tip',
    topic: 'One actionable NCLEX-RN study tactic',
    brief:
      'Give ONE specific, actionable NCLEX-RN study tip — focused enough that a nurse can apply it today (e.g. priority/safety filter on SATA questions, how to mine UWorld rationales, time-boxing Qbank sessions). Plain language, no clichés. End with a soft invite to GritSync\'s NCLEX prep guidance.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse studying at a cozy desk lamp at night, NCLEX review book open, highlighters scattered, focused expression, warm yellow lamp light, hint of Filipino home interior (rattan, family photo softly blurred in background).`,
  },
  {
    id: 'migration-myth-buster',
    topic: 'Debunk a common US-nursing-migration myth',
    brief:
      'Debunk ONE common myth about US nursing migration for Filipinos (e.g. "I need a job offer before NCLEX", "CGFNS is automatic if I already have a PH license", "I can only work in California"). State the myth, the truth in one sentence, and what to actually do. No fabricated numbers. End with GritSync as the credible source for ongoing guidance.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse at a desk, thoughtful expression, a notebook on one side and an organised stack of correct credentialing documents on the other, warm office light, navy scrubs, modern Filipino home setting.`,
  },
  {
    id: 'document-checklist',
    topic: 'Documents needed for an upcoming filing',
    brief:
      'Pick ONE filing (state BON, NCLEX registration, CGFNS, VisaScreen) and list the documents a Filipino-trained nurse needs. Use short bullet-style phrases. Add a note about the most-commonly-missing item. No fabricated requirements — keep it general and accurate. End with a CTA to GritSync\'s checklist review service.',
    image_prompt: `${BRAND_IMAGE_BASE} Top-down photo of a neat stack of credentialing documents — passport, PRC license folder, transcripts, birth-certificate envelope — arranged on a wood desk with a small Filipino flag pin and a coffee mug. Warm natural light.`,
  },
  {
    id: 'state-spotlight',
    topic: 'Why a particular US state works well for Filipino IENs',
    brief:
      'Pick ONE US state (rotate: California, Texas, Nevada, New York, Florida) and write a short, factual spotlight: how friendly the state BON tends to be toward foreign-educated nurses in general terms, demand for RNs, lifestyle notes (cost of living, Filipino community). Avoid fabricated numbers. End by reminding readers GritSync helps match them to the right state pathway.',
    image_prompt: `${BRAND_IMAGE_BASE} Cinematic shot of a Filipino USRN in scrubs standing in front of a modern US hospital entrance at golden hour, US flag softly out of focus to one side, hopeful expression.`,
  },
  {
    id: 'encouragement',
    topic: 'Pep talk for nurses mid-journey',
    brief:
      'Write a warm, specific encouragement for Filipino nurses in the middle of their NCLEX or immigration journey — name the hard moments (long shifts, slow paperwork, family pressure) without melodrama. Keep it short. Close with GritSync standing alongside them, not above them.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse in scrubs leaning against a hospital wall during a break, soft late-afternoon light through a window, tired-but-determined faint smile, holding a coffee cup. Intimate framing.`,
  },
  {
    id: 'free-consult-cta',
    topic: 'Invite to book a free GritSync consultation',
    brief:
      'Write a direct CTA post inviting Filipino nurses to book a free GritSync consultation about their NCLEX or USRN application. Lead with the outcome (clear roadmap, no guesswork). Name who it\'s for (PH-trained nurses planning the US move). Close with a single clear next step. Keep claims grounded — no guarantees of outcomes or timelines.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse smiling on a video call, laptop on a clean desk, light headset visible, light-blue scrubs at the shoulder, warm window light, small plant in the corner.`,
  },
  {
    id: 'behind-the-scenes',
    topic: 'A behind-the-scenes look at GritSync helping a client',
    brief:
      'Write a warm behind-the-scenes post about a GritSync workflow — a credential review session, an interview prep call, the team double-checking a VisaScreen submission. Make it feel human and specific. No fake testimonials, no named clients. End by reminding readers that this hands-on care is what they get when they work with GritSync.',
    image_prompt: `${BRAND_IMAGE_BASE} Two Filipino GritSync staff at a clean modern desk reviewing a printed checklist together, warm office light, laptops open with unreadable screens, focused expressions, no client face visible.`,
  },
]

async function seedOne(t) {
  const res = await fetch(`${BASE}/api/social/ai/generate-batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      topic: t.topic,
      preselected_idea: t.brief,
      template_id: t.id,
      template_image_prompt: t.image_prompt,
      tone: 'friendly',
      length: 'medium',
      language: 'taglish',
      count: 1,
      content_type: 'image',
      image_provider: 'openai',
      additional_details: '',
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, status: res.status, error: body.error || 'unknown' }
  }
  const items = body.data?.items || []
  return {
    ok: true,
    count: items.length,
    media_status: items[0]?.status,
    media_url: items[0]?.media_url,
  }
}

;(async () => {
  console.log(`Seeding ${TEMPLATES.length} templates against ${BASE} ...`)
  const summary = []
  for (let i = 0; i < TEMPLATES.length; i++) {
    const t = TEMPLATES[i]
    process.stdout.write(`  [${i + 1}/${TEMPLATES.length}] ${t.id} ... `)
    const start = Date.now()
    try {
      const r = await seedOne(t)
      const sec = Math.round((Date.now() - start) / 1000)
      if (r.ok) {
        console.log(`done (${sec}s, status=${r.media_status})`)
        summary.push({ id: t.id, ok: true, sec, status: r.media_status })
      } else {
        console.log(`FAILED (HTTP ${r.status}: ${r.error})`)
        summary.push({ id: t.id, ok: false, error: r.error })
      }
    } catch (err) {
      console.log(`THREW (${err.message})`)
      summary.push({ id: t.id, ok: false, error: err.message })
    }
  }
  const okCount = summary.filter((s) => s.ok).length
  const availableCount = summary.filter((s) => s.ok && s.status === 'available').length
  console.log()
  console.log(`✓ ${okCount}/${TEMPLATES.length} responses ok`)
  console.log(`✓ ${availableCount}/${TEMPLATES.length} bank items have media`)
  const failed = summary.filter((s) => !s.ok)
  if (failed.length) {
    console.log('Failures:')
    failed.forEach((f) => console.log(`  - ${f.id}: ${f.error}`))
  }
})().catch((err) => {
  console.error('Seeder threw:', err)
  process.exit(1)
})
