import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { Loading } from '@/components/ui/Loading'
import { SEO } from '@/components/SEO'
import { cn } from '@/lib/utils'
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Music2,
  Plus,
  Trash2,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  X,
  RefreshCw,
  PencilLine,
  Sparkles,
  Wand2,
  Film,
  Loader2,
  Megaphone,
  Eye,
  Copy,
  Download,
  AtSign,
  Zap,
  Search,
  ExternalLink,
  Filter,
  TrendingUp,
  Calendar,
  Activity,
  ArrowRight,
  Brain,
} from 'lucide-react'
import { AdsGenerator, type AdVariant } from './AdminAds'

type Platform = 'facebook' | 'instagram' | 'threads' | 'linkedin' | 'youtube' | 'tiktok'

interface SocialAccount {
  id: string
  platform: Platform
  display_name: string
  platform_user_id: string
  profile_url: string | null
  avatar_url: string | null
  status: string
  scopes: string | null
  metadata: any
  connected_at: string | null
  token_expires_at: string | null
  last_error: string | null
}

interface SocialPost {
  id: string
  account_ids: string[]
  content: string
  media_urls: string[]
  scheduled_at: string | null
  published_at: string | null
  status: 'draft' | 'scheduled' | 'queued' | 'publishing' | 'published' | 'partial' | 'failed'
  results: Record<string, { platform: Platform; ok: boolean; remote_id?: string; error?: string; at?: string }>
  created_at: string
  accounts: Array<Pick<SocialAccount, 'id' | 'platform' | 'display_name' | 'avatar_url'>>
}

interface BankItem {
  id: string
  caption: string
  media_url: string | null
  media_type: 'image' | 'video'
  prediction_id: string | null
  source_image_url: string | null
  source_topic: string | null
  enhanced_prompt: string | null
  generation_settings: any
  status: 'available' | 'pending_media' | 'media_failed' | 'scheduled' | 'used'
  created_at: string
}

// Drives the shared schedule modal — used both for "Schedule from bank" and
// for editing an already-scheduled post. `bank_id` (when set) lets the modal
// mark the source bank item as used after a successful submit. `editing_post`
// (when set) flips submit to PATCH /posts/:id.
interface ScheduleModalState {
  caption: string
  media_urls: string[]
  bank_id: string | null
  editing_post: SocialPost | null
  // When true the modal hides the schedule date picker and shows a
  // single "Publish to selected accounts" CTA — the one-click "Post
  // Now" path triggered from Content Bank cards.
  quick_post?: boolean
  // Pre-select account checkboxes for *new* posts (not editing). Used
  // by Repost so the original platform mix is kept by default but the
  // operator can still tweak before submit.
  initial_account_ids?: string[]
}

// Post templates — branded around GritSync's core mission of helping
// Filipino-trained nurses become USRNs. Each template ships with:
//   - `brief`: a tight copywriting brief the LLM uses to write the caption
//   - `image_prompt`: a brand-aligned visual prompt that overrides the
//      generic image-prompt seed from the enhancer, so every post in a
//      template family looks like part of the same brand
//   - `gradient`: tailwind classes for the on-card sample preview tile
//   - `ad_ready`: legacy flag — kept on the data so existing bank rows
//      retain their tag, but the Compose UI no longer surfaces an
//      "Ad-ready" badge (every saved post can become an ad via the
//      Bank → Use in Ad shortcut, so the distinction is just noise)
type TemplateCategory = 'success' | 'education' | 'visa' | 'lifestyle' | 'motivation' | 'cta' | 'bts'

interface PostTemplate {
  id: string
  label: string
  emoji: string
  category: TemplateCategory
  description: string
  brief: string
  image_prompt: string
  gradient: string  // tailwind: bg-gradient-to-br from-... to-...
  ad_ready: boolean
}

// Shared visual lexicon: every image prompt prepends this so the brand stays
// recognisable across templates regardless of which image AI is selected.
const BRAND_IMAGE_BASE =
  'Photorealistic editorial photography, warm natural light, candid composition, soft depth of field. ' +
  'Subject: Filipino healthcare professional (warm-brown skin, mid-20s to early-40s). ' +
  'Modern setting. Clean, hopeful, grounded. ' +
  'No text overlays, no readable signage, no logos, no watermarks.'

const POST_TEMPLATES: PostTemplate[] = [
  {
    id: 'nclex-passer-spotlight',
    label: 'NCLEX Passer Spotlight',
    emoji: '🎉',
    category: 'success',
    description: 'Celebrate a Filipino nurse who just passed the NCLEX-RN.',
    brief:
      'Celebrate an anonymized Filipino nurse who just passed the NCLEX-RN. Acknowledge the long road — years balancing duty work, study, and family. End with quiet encouragement for nurses still on the journey and a soft reminder that GritSync walks with them step by step. Do not fabricate names, scores, or timelines.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino nurse in light-blue scrubs holding a tablet with a green "PASS" indicator, eyes lit up with quiet relief, soft window light from the side, clean modern apartment or hospital break-room background.`,
    gradient: 'bg-gradient-to-br from-amber-200 via-rose-200 to-rose-300',
    ad_ready: true,
  },
  {
    id: 'ph-to-usrn-step-guide',
    label: 'PH → USRN Step Guide',
    emoji: '📋',
    category: 'education',
    description: 'Walk through one step of the Philippines-to-USRN journey.',
    brief:
      'Pick ONE step in the Philippines-to-USRN journey (CGFNS application, state BON application, NCLEX ATT, VisaScreen, immigrant petition) and walk a Filipino nurse through it in plain language. Cover what is needed, the general timeline range (never fabricated specifics), and one common mistake to avoid. End with a soft CTA to consult GritSync for the actual filing.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Overhead view of a Filipino nurse's study desk: open NCLEX review book, laminated credentialing documents, passport, pen, steaming mug, neutral wood surface. Warm afternoon light.`,
    gradient: 'bg-gradient-to-br from-blue-200 via-indigo-200 to-indigo-300',
    ad_ready: false,
  },
  {
    id: 'credentialing-explainer',
    label: 'Credentialing Explainer',
    emoji: '🧾',
    category: 'education',
    description: 'Demystify CGFNS, VisaScreen, or a specific state BON.',
    brief:
      'Pick ONE of CGFNS, VisaScreen, or a specific state Board of Nursing requirement. Explain what it is, why it exists, and exactly what a Filipino-trained nurse needs to submit. Short sentences. One concrete tip. No fabricated stats. End with a soft CTA to GritSync for help with the filing.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Close-up of a Filipino nurse's hands organising a folder of credentialing documents with a faint US state seal visible on one paper, navy scrubs sleeve in frame, warm office-desk lighting.`,
    gradient: 'bg-gradient-to-br from-sky-200 via-blue-200 to-blue-300',
    ad_ready: false,
  },
  {
    id: 'visa-bulletin-update',
    label: 'Visa Bulletin Update',
    emoji: '📅',
    category: 'visa',
    description: 'Neutral, factual EB-3 / Schedule A movement for nurses.',
    brief:
      'Write a short, factual update on the current US visa bulletin movement for nurses (focus on EB-3 Schedule A and Philippines if relevant). Stay neutral — no speculation, no fabricated dates. Explain in one sentence what "retrogression" or "priority date current" means. End with a reminder that GritSync helps clients track this and stay application-ready.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino nurse studying a calendar on a tablet beside a US passport and what looks like an I-140 packet, soft window light, navy and white palette, modern home setting.`,
    gradient: 'bg-gradient-to-br from-emerald-200 via-teal-200 to-teal-300',
    ad_ready: false,
  },
  {
    id: 'day-in-the-life-usrn',
    label: 'Day-in-the-Life USRN',
    emoji: '🩺',
    category: 'success',
    description: 'A small, specific scene from a Filipino USRN\'s workday.',
    brief:
      'Paint a small, specific scene from a Filipino USRN\'s workday — early commute, first patient handoff, lunch with co-workers, end-of-shift moment. Make it relatable, never boastful. No fabricated dollar amounts or named hospitals. Close with one sentence reminding readers that GritSync helps Filipino nurses get here.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino USRN in navy scrubs walking through a modern US hospital corridor at golden-hour sunrise, ID badge visible but unreadable, warm caring expression, gentle motion blur of a colleague in the background.`,
    gradient: 'bg-gradient-to-br from-orange-200 via-amber-200 to-amber-300',
    ad_ready: true,
  },
  {
    id: 'nclex-study-tip',
    label: 'NCLEX Study Tip',
    emoji: '🧠',
    category: 'education',
    description: 'One actionable NCLEX-RN study tactic a nurse can apply today.',
    brief:
      'Give ONE specific, actionable NCLEX-RN study tip — focused enough that a nurse can apply it today (e.g. priority/safety filter on SATA questions, how to mine UWorld rationales, time-boxing Qbank sessions). Plain language, no clichés. End with a soft invite to GritSync\'s NCLEX prep guidance.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino nurse studying at a cozy desk lamp at night, NCLEX review book open, highlighters scattered, focused expression, warm yellow lamp light, hint of Filipino home interior (rattan, family photo softly blurred in background).`,
    gradient: 'bg-gradient-to-br from-indigo-200 via-purple-200 to-purple-300',
    ad_ready: false,
  },
  {
    id: 'migration-myth-buster',
    label: 'Migration Myth Buster',
    emoji: '❌',
    category: 'education',
    description: 'Debunk a common US-nursing-migration myth.',
    brief:
      'Debunk ONE common myth about US nursing migration for Filipinos (e.g. "I need a job offer before NCLEX", "CGFNS is automatic if I already have a PH license", "I can only work in California"). State the myth, the truth in one sentence, and what to actually do. No fabricated numbers. End with GritSync as the credible source for ongoing guidance.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino nurse at a desk, thoughtful expression, a notebook on one side and an organised stack of correct credentialing documents on the other, warm office light, navy scrubs, modern Filipino home setting.`,
    gradient: 'bg-gradient-to-br from-red-200 via-rose-200 to-rose-300',
    ad_ready: false,
  },
  {
    id: 'document-checklist',
    label: 'Document Checklist',
    emoji: '📁',
    category: 'education',
    description: 'What you actually need for the next filing step.',
    brief:
      'Pick ONE filing (state BON, NCLEX registration, CGFNS, VisaScreen) and list the documents a Filipino-trained nurse needs. Use short bullet-style phrases. Add a note about the most-commonly-missing item. No fabricated requirements — keep it general and accurate. End with a CTA to GritSync\'s checklist review service.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Top-down photo of a neat stack of credentialing documents — passport, PRC license folder, transcripts, birth-certificate envelope — arranged on a wood desk with a small Filipino flag pin and a coffee mug. Warm natural light.`,
    gradient: 'bg-gradient-to-br from-yellow-200 via-amber-200 to-orange-300',
    ad_ready: false,
  },
  {
    id: 'state-spotlight',
    label: 'State Spotlight',
    emoji: '🗺️',
    category: 'education',
    description: 'Why a particular US state works well for Filipino IENs.',
    brief:
      'Pick ONE US state (rotate: California, Texas, Nevada, New York, Florida) and write a short, factual spotlight: how friendly the state BON tends to be toward foreign-educated nurses in general terms, demand for RNs, lifestyle notes (cost of living, Filipino community). Avoid fabricated numbers. End by reminding readers GritSync helps match them to the right state pathway.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Cinematic shot of a Filipino USRN in scrubs standing in front of a modern US hospital entrance at golden hour, US flag softly out of focus to one side, hopeful expression.`,
    gradient: 'bg-gradient-to-br from-cyan-200 via-sky-200 to-sky-300',
    ad_ready: false,
  },
  {
    id: 'encouragement',
    label: 'Encouragement Post',
    emoji: '💪',
    category: 'motivation',
    description: 'Quiet, specific pep talk for nurses mid-journey.',
    brief:
      'Write a warm, specific encouragement for Filipino nurses in the middle of their NCLEX or immigration journey — name the hard moments (long shifts, slow paperwork, family pressure) without melodrama. Keep it short. Close with GritSync standing alongside them, not above them.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino nurse in scrubs leaning against a hospital wall during a break, soft late-afternoon light through a window, tired-but-determined faint smile, holding a coffee cup. Intimate framing.`,
    gradient: 'bg-gradient-to-br from-pink-200 via-rose-200 to-rose-400',
    ad_ready: false,
  },
  {
    id: 'free-consult-cta',
    label: 'Free Consultation CTA',
    emoji: '📞',
    category: 'cta',
    description: 'Direct invite to book a free GritSync consult.',
    brief:
      'Write a direct CTA post inviting Filipino nurses to book a free GritSync consultation about their NCLEX or USRN application. Lead with the outcome (clear roadmap, no guesswork). Name who it\'s for (PH-trained nurses planning the US move). Close with a single clear next step. Keep claims grounded — no guarantees of outcomes or timelines.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Filipino nurse smiling on a video call, laptop on a clean desk, light headset visible, light-blue scrubs at the shoulder, warm window light, small plant in the corner.`,
    gradient: 'bg-gradient-to-br from-primary-200 via-primary-300 to-primary-500',
    ad_ready: true,
  },
  {
    id: 'behind-the-scenes',
    label: 'Behind the Scenes',
    emoji: '👥',
    category: 'bts',
    description: 'Show the human side of GritSync helping a client.',
    brief:
      'Write a warm behind-the-scenes post about a GritSync workflow — a credential review session, an interview prep call, the team double-checking a VisaScreen submission. Make it feel human and specific. No fake testimonials, no named clients. End by reminding readers that this hands-on care is what they get when they work with GritSync.',
    image_prompt:
      `${BRAND_IMAGE_BASE} Two Filipino GritSync staff at a clean modern desk reviewing a printed checklist together, warm office light, laptops open with unreadable screens, focused expressions, no client face visible.`,
    gradient: 'bg-gradient-to-br from-slate-200 via-gray-200 to-gray-300',
    ad_ready: false,
  },
  // ── Added topics — bringing the library to 30 GritSync-aligned templates ──
  {
    id: 'first-month-in-us', label: 'First Month in the US', emoji: '🇺🇸',
    category: 'success',
    description: 'Reflection on the first month as a USRN.',
    brief: 'A Filipino RN reflects on their first month working as a USRN — the homesickness, the wins (first solo shift, first US paycheck), the small culture-shock moments. Keep it grounded and non-boastful. End by noting that GritSync helps Filipino nurses prepare for this transition, not just the paperwork.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN in navy scrubs in front of a modest US apartment window at dawn, coffee in hand, contemplative smile, soft warm morning light, lived-in but tidy interior behind.`,
    gradient: 'bg-gradient-to-br from-blue-200 via-red-200 to-red-300', ad_ready: false,
  },
  {
    id: 'new-state-license', label: 'New State License', emoji: '🗽',
    category: 'success',
    description: 'Endorsed your license to a new US state.',
    brief: 'A Filipino USRN just endorsed their license to a new US state (e.g. California → Texas, or NY → Florida). Note the paperwork involved, the timeline range (no fabricated specifics), and why the move made sense (job offer, family, pay). End with GritSync as a guide for endorsements too — it\'s not just about the first license.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN holding a fresh state RN license document with subtle US-state seal visible, navy scrubs sleeve in frame, warm desk light, faint US-state map or skyline silhouette softly blurred in background.`,
    gradient: 'bg-gradient-to-br from-purple-200 via-violet-200 to-indigo-300', ad_ready: false,
  },
  {
    id: 'consular-interview-passed', label: 'Consular Interview Passed', emoji: '🛂',
    category: 'success',
    description: 'Cleared the US visa interview.',
    brief: 'Celebrate (anonymously) a Filipino nurse who just cleared their US consular interview. Acknowledge the nerves, the document prep, the calm-but-fast Q&A. One concrete tip future interviewees can apply. No fabricated questions or quotes. End by reminding readers that GritSync helps clients rehearse the interview, not just file the paperwork.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse smiling outside a US embassy-style building at golden hour, holding a folder of documents, soft confident relief on the face, no readable signage on the building.`,
    gradient: 'bg-gradient-to-br from-emerald-200 via-green-200 to-teal-300', ad_ready: true,
  },
  {
    id: 'cgfns-vs-eric', label: 'CGFNS vs ERIC', emoji: '🆚',
    category: 'education',
    description: 'Difference between CGFNS and ERIC evaluations.',
    brief: 'Explain in plain language the difference between CGFNS Credentials Evaluation Service and ERES/ERIC reports. Which one your destination state accepts, and the practical timeline difference. No fabricated stats. End with a soft CTA to GritSync for help picking the right evaluator.',
    image_prompt: `${BRAND_IMAGE_BASE} Side-by-side flatlay on a wood desk: two folders labeled (unreadably) with credentialing report stacks, Filipino nurse\'s hand holding a pen above one of them, soft warm desk lamp.`,
    gradient: 'bg-gradient-to-br from-sky-200 via-cyan-200 to-blue-300', ad_ready: false,
  },
  {
    id: 'ielts-prep-tips', label: 'IELTS Prep Tips', emoji: '🗣️',
    category: 'education',
    description: 'IELTS-Academic prep tactics for nurses.',
    brief: 'Give 2-3 specific, actionable IELTS-Academic prep tips for Filipino nurses — focus on writing task 1 (visual description) and speaking part 3 (extended answers). Plain language, no clichés. End with a soft invite to GritSync\'s English-prep support.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse practicing IELTS speaking on a video call, light headset, notebook of cue cards beside laptop, modern home setting, warm window light.`,
    gradient: 'bg-gradient-to-br from-amber-200 via-yellow-200 to-orange-300', ad_ready: false,
  },
  {
    id: 'license-endorsement-101', label: 'License Endorsement 101', emoji: '🔁',
    category: 'education',
    description: 'How US interstate license endorsement works.',
    brief: 'Walk a Filipino USRN through the basics of endorsing a US RN license from one state to another (e.g. CA → TX, NV → IL). Cover the typical documents, fees range, and what "verification of licensure" means. Avoid fabricated state-specific timelines. End with GritSync as ongoing-pathway support.',
    image_prompt: `${BRAND_IMAGE_BASE} Top-down flatlay: two US state-seal-style icons on either side of a Filipino nurse\'s hands organising endorsement paperwork, neutral wood desk, warm daylight.`,
    gradient: 'bg-gradient-to-br from-indigo-200 via-blue-200 to-sky-300', ad_ready: false,
  },
  {
    id: 'choosing-your-state', label: 'Choosing Your State', emoji: '🗺️',
    category: 'education',
    description: 'How to pick the right first US state.',
    brief: 'Help a Filipino nurse think through how to pick their first US state: BON friendliness toward foreign-educated nurses (in general terms), demand for RNs, cost of living, Filipino-community size, climate. No fabricated rankings. End with GritSync as the partner for matching person → state.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse looking at a US map on a tablet at a modern desk, mug of coffee, notepad with pros/cons partially visible, warm desk lamp, contemplative expression.`,
    gradient: 'bg-gradient-to-br from-cyan-200 via-sky-200 to-blue-400', ad_ready: false,
  },
  {
    id: 'red-flag-recruiters', label: 'Red-Flag Recruiters', emoji: '🚩',
    category: 'education',
    description: 'How to spot scammy US recruiters.',
    brief: 'Walk Filipino nurses through 3-4 red flags when evaluating a US nursing recruiter (asking for upfront fees, vague employer info, "guaranteed visa" claims, pressure tactics). Plain language. End by positioning GritSync as the transparent, no-hidden-fee alternative — without trashing competitors by name.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse looking thoughtfully at a laptop screen with a vague email open (unreadable), eyebrows slightly raised, warm home desk light, modern interior.`,
    gradient: 'bg-gradient-to-br from-red-200 via-orange-200 to-rose-300', ad_ready: false,
  },
  {
    id: 'schedule-a-explained', label: 'Schedule A Explained', emoji: '📜',
    category: 'visa',
    description: 'What Schedule A nurse classification means.',
    brief: 'Explain Schedule A for nurses (EB-3 Schedule A pre-certified occupations) in plain language: why nurses are classified this way, how it affects PERM, and what it doesn\'t guarantee. No fabricated dates. End by reminding readers GritSync tracks visa-bulletin movement on their behalf.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse reading a US visa-classification document on a tablet beside an open passport and notepad, warm window light, navy scrubs sleeve, modern home setting.`,
    gradient: 'bg-gradient-to-br from-emerald-200 via-teal-200 to-cyan-300', ad_ready: false,
  },
  {
    id: 'visa-screen-walkthrough', label: 'VisaScreen Walkthrough', emoji: '🧾',
    category: 'visa',
    description: 'Step-by-step VisaScreen overview.',
    brief: 'Walk Filipino-trained nurses through the VisaScreen certificate process (CGFNS): purpose, the four parts (education review, license verification, English proficiency, exam), and a common mistake (e.g. ordering transcripts to the wrong address). No fabricated timelines. End with GritSync as a guide for filing.',
    image_prompt: `${BRAND_IMAGE_BASE} Close-up of a Filipino nurse organising VisaScreen application materials — transcripts envelope, license copy, ID — on a clean wood desk, warm afternoon light.`,
    gradient: 'bg-gradient-to-br from-green-200 via-emerald-200 to-teal-300', ad_ready: false,
  },
  {
    id: 'prc-good-standing', label: 'PRC Good Standing for the US', emoji: '🇵🇭',
    category: 'visa',
    description: 'Getting a PRC certification of good standing.',
    brief: 'Explain how a Filipino RN requests a PRC Certification of Good Standing for US credentialing purposes (where to file, what fields the receiving state BON needs, common reasons it gets rejected). Avoid fabricated fees. End with GritSync as the partner for chasing PH-side documents.',
    image_prompt: `${BRAND_IMAGE_BASE} Top-down photo of a PRC license folder and certification request form arranged neatly on a Filipino-coded wood desk, small Filipino flag pin, warm soft daylight.`,
    gradient: 'bg-gradient-to-br from-yellow-200 via-amber-200 to-orange-300', ad_ready: false,
  },
  {
    id: 'first-shift-tips', label: 'First US Shift', emoji: '🩹',
    category: 'lifestyle',
    description: 'What to expect on your first US shift.',
    brief: 'Give Filipino nurses 3 grounded tips for their very first US hospital shift: charting (EHR system unfamiliarity), patient-care ratios, asking for help from charge nurses. Keep it warm and tactical. End by noting that GritSync\'s onboarding guidance covers the soft side of the move, not just papers.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN at a hospital nurses\' station looking at an EHR screen with a senior colleague gesturing to help, soft clinical lighting, both in scrubs, faces partially turned away, calm and collaborative scene.`,
    gradient: 'bg-gradient-to-br from-rose-200 via-pink-200 to-fuchsia-300', ad_ready: false,
  },
  {
    id: 'finding-filipino-community', label: 'Filipino Community Abroad', emoji: '🏘️',
    category: 'lifestyle',
    description: 'Finding Filipino community in your US city.',
    brief: 'Help newly-arrived Filipino USRNs find their community in their new US city — Filipino churches, Fil-Am nursing associations, grocery stores with Pinoy staples. Warm in tone. End with GritSync\'s Pinoy-USRN alumni network as a soft mention.',
    image_prompt: `${BRAND_IMAGE_BASE} Group of Filipino USRNs gathered at a small dinner table with familiar Filipino dishes (pancit, lumpia visible in soft focus), laughter, warm modern apartment light.`,
    gradient: 'bg-gradient-to-br from-orange-200 via-amber-200 to-yellow-300', ad_ready: false,
  },
  {
    id: 'support-family-back-home', label: 'Supporting Family Back Home', emoji: '💌',
    category: 'lifestyle',
    description: 'Sending support to family in PH.',
    brief: 'A grounded reflection on the reality of being the family\'s breadwinner from the US: remittance rhythm, helping siblings finish school, the guilt of being away. No melodrama. End softly — GritSync is built BY Filipino nurses who know this weight.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN on a video call with family in the Philippines, laptop on a small kitchen table, soft warm light, faint expression of love and longing, modern US apartment interior.`,
    gradient: 'bg-gradient-to-br from-pink-200 via-rose-200 to-red-300', ad_ready: false,
  },
  {
    id: 'imposter-syndrome', label: 'Imposter Syndrome', emoji: '🪞',
    category: 'motivation',
    description: 'Handling imposter syndrome as a new USRN.',
    brief: 'Speak directly to Filipino USRNs feeling like they don\'t belong on their first US unit (despite years of PH experience). Validate, then offer one reframe and one tactical thing they can do this week (e.g. ask one peer one question per shift). End with quiet GritSync solidarity.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN looking at their reflection in a hospital window during a quiet moment, soft introspective expression, navy scrubs, late-afternoon golden light.`,
    gradient: 'bg-gradient-to-br from-violet-200 via-purple-200 to-fuchsia-300', ad_ready: false,
  },
  {
    id: 'one-step-at-a-time', label: 'One Step at a Time', emoji: '🪜',
    category: 'motivation',
    description: 'Break the long USRN road into doable steps.',
    brief: 'Encourage Filipino nurses overwhelmed by the USRN process by reframing it as a sequence of small, doable steps — not one giant leap. Give a quick example of the typical month-by-month rhythm in general terms. End with GritSync as the partner that breaks it down for you.',
    image_prompt: `${BRAND_IMAGE_BASE} Wide shot of a Filipino nurse walking up a softly lit modern stairwell, calm and steady, navy scrubs, warm late-afternoon light from a tall window.`,
    gradient: 'bg-gradient-to-br from-teal-200 via-emerald-200 to-green-300', ad_ready: false,
  },
  {
    id: 'credentialing-review-cta', label: 'Credentialing Review CTA', emoji: '✅',
    category: 'cta',
    description: 'Direct CTA to book a credentialing review.',
    brief: 'Direct invite for Filipino-trained nurses to book a GritSync credentialing review — a one-hour read of their current documents to catch missing items before they pay any application fee. Lead with the outcome (catch gaps before $$ goes out). Honest claims only.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino GritSync advisor (back-of-shoulder framing) walking through a printed credentialing checklist with a client, both at a clean modern desk, warm office lighting, no readable documents.`,
    gradient: 'bg-gradient-to-br from-primary-200 via-primary-300 to-primary-500', ad_ready: true,
  },
  {
    id: 'mentorship-cta', label: 'Mentorship CTA', emoji: '🧭',
    category: 'cta',
    description: 'Pair with a USRN mentor.',
    brief: 'Invite Filipino nurses still in PH to pair with a GritSync USRN mentor — someone who has already made the move. Lead with the human cost of doing this alone. Honest claims only — no guarantees of outcomes. End with a single clear next step.',
    image_prompt: `${BRAND_IMAGE_BASE} Two Filipino nurses on a side-by-side video call screen (laptop frame visible), one in PH scrubs and one in US scrubs, warm encouraging conversation, modern home setting.`,
    gradient: 'bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-400', ad_ready: false,
  },
  {
    id: 'team-spotlight', label: 'Team Spotlight', emoji: '⭐',
    category: 'bts',
    description: 'Meet a GritSync team member (anonymous OK).',
    brief: 'A warm spotlight on a GritSync team member (role + what they do day-to-day for clients) without revealing private details or attaching real names if not approved. Highlight the human at the other end of the email. End by reminding readers a real Filipino-nurse-friendly team is behind every reply.',
    image_prompt: `${BRAND_IMAGE_BASE} Editorial-style portrait of a Filipino professional at a clean modern desk (face partially turned or slightly out of focus to protect identity), warm office light, laptop open with unreadable screen.`,
    gradient: 'bg-gradient-to-br from-slate-200 via-gray-300 to-zinc-400', ad_ready: false,
  },
]

// Campaign goal — the strategist asks "what outcome am I driving?" first.
// The label is what the operator sees; the `brief` is what the agentic
// enhancer prompt actually receives.
type CampaignGoal =
  | 'book_consult' | 'educate' | 'share_win' | 'build_trust' | 'promote_service' | 'community'

interface GoalOption {
  id: CampaignGoal
  label: string
  emoji: string
  description: string
  brief: string
}

const CAMPAIGN_GOALS: GoalOption[] = [
  {
    id: 'book_consult', label: 'Book a consult', emoji: '📞',
    description: 'Drive Filipino nurses to schedule a free GritSync consultation.',
    brief: 'Drive bookings of GritSync\'s free 15-minute consult. Make the offer crisp and grounded — clear roadmap, no guesswork. Filipino nurses planning their USRN move.',
  },
  {
    id: 'educate', label: 'Educate', emoji: '🧠',
    description: 'Demystify one step of the NCLEX / immigration path.',
    brief: 'Educational post that demystifies ONE concrete step of the NCLEX-RN or US-immigration journey. Reader walks away knowing what to do next.',
  },
  {
    id: 'share_win', label: 'Share a win', emoji: '🎉',
    description: 'Celebrate a recent NCLEX pass or USRN milestone.',
    brief: 'Celebrate a real-but-anonymized client win (NCLEX pass, visa interview cleared, first US shift). Inspire without fabricating numbers or names.',
  },
  {
    id: 'build_trust', label: 'Build trust', emoji: '🤝',
    description: 'Show credibility — process, team, methodology.',
    brief: 'Build trust by showing GritSync\'s actual process / team / methodology. Specific scene over generic claims.',
  },
  {
    id: 'promote_service', label: 'Promote a service', emoji: '🚀',
    description: 'Highlight a paid offering (NCLEX prep, credentialing, mentorship).',
    brief: 'Promote a GritSync service (NCLEX prep, credentialing review, mentorship). Lead with the problem it solves, not the feature list. Honest claims only.',
  },
  {
    id: 'community', label: 'Community', emoji: '💬',
    description: 'Spark conversation among Filipino-nurse followers.',
    brief: 'Community-building post: a question, prompt, or relatable moment that makes Filipino nurses want to comment with their own story.',
  },
]

// Audience presets — pick the ONE specific reader so the model doesn't
// hedge by writing to "anyone interested in nursing".
type AudiencePreset =
  | 'ph_considering' | 'ph_nclex_prep' | 'ph_visa_stage' | 'ien_already_us' | 'new_grad_ph'

interface AudienceOption {
  id: AudiencePreset
  label: string
  brief: string
}

const AUDIENCE_PRESETS: AudienceOption[] = [
  {
    id: 'ph_considering',
    label: 'PH nurses considering US move',
    brief: 'A Philippines-based RN, 1-5 years bedside experience, exploring the US move but not yet committed. Worried about cost, timeline, and getting scammed.',
  },
  {
    id: 'ph_nclex_prep',
    label: 'In active NCLEX prep',
    brief: 'A Filipino RN in the middle of NCLEX-RN review — possibly enrolled in a Qbank, balancing duty work and study. Wants tactical advice, not motivation fluff.',
  },
  {
    id: 'ph_visa_stage',
    label: 'NCLEX passed, on visa journey',
    brief: 'A Filipino RN who already passed NCLEX and is now navigating VisaScreen / IELTS / employer petition / consular interview. Wants timeline clarity and reassurance.',
  },
  {
    id: 'ien_already_us',
    label: 'Filipino USRN already in the US',
    brief: 'A Filipino RN already working in the US (USRN). Possibly thinking about license endorsement to another state, or helping family back home.',
  },
  {
    id: 'new_grad_ph',
    label: 'New PH nursing graduate',
    brief: 'A fresh Philippines BSN graduate or board passer (under 1 year experience) starting to think about US opportunities and what they need to do now.',
  },
]

// ─── Master image prompt ──────────────────────────────────────────────
// Single source of truth for the image-AI. Every /generate-batch call
// (Compose + Manager auto-generate) sends this verbatim as the
// `template_image_prompt`, so every post in the feed inherits the same
// premium ad aesthetic.
//
// Operators can edit + refine this from the Compose tab — overrides
// live in localStorage so refinements persist across sessions. A
// "Refine with AI" CTA hits POST /api/social/ai/refine-master-prompt
// to let the model improve the prompt itself; that's the continuous-
// learning loop.
const MASTER_IMAGE_PROMPT_STORAGE_KEY = 'gritsync_socmed_master_image_prompt'

const DEFAULT_MASTER_IMAGE_PROMPT = `Ultra-realistic cinematic social media advertisement for "GritSync NCLEX Processing Agency", featuring a beautiful and confident Filipino nurse in modern navy blue scrubs holding NCLEX application documents, passport, and a coffee cup while standing inside a luxurious modern healthcare office. The nurse should look hopeful, motivated, and professional.

Background includes a subtle USA skyline at sunset, hospital environment, glowing city lights, modern glass office interiors, premium healthcare branding atmosphere, and soft depth-of-field blur.

Add supporting characters in the background such as professional agency staff assisting nurses with paperwork, laptops, visa documents, and online processing systems.

Include realistic visual elements:
- official-looking NCLEX paperwork
- CGFNS forms
- ATT approval email on laptop screen
- passport and travel documents
- hospital badge IDs
- modern workspace setup
- elegant red-and-white brand accents

Use a premium color palette: deep red, white, soft black, subtle gold highlights.

Main headline text using ultra high-quality modern luxury fonts:
"YOUR USRN DREAM STARTS HERE"

Subheadline:
"NCLEX Processing • CGFNS • ATT • VisaScreen • End-to-End Guidance"

Add CTA button design:
"GET YOUR FREE ASSESSMENT TODAY"

Add company branding:
- realistic GritSync logo placement on upper corner
- subtle watermark logo background pattern
- official website text: "gritsync.com"

Style: ultra photorealistic, cinematic lighting, luxury healthcare advertisement aesthetic, highly detailed skin textures, realistic eyes and facial expressions, professional typography layout, premium Facebook/Instagram ad composition, elegant shadows and reflections, realistic fabric textures, polished marketing-agency quality, visually emotional and aspirational, modern social media campaign style, sharp focus, HDR, 8k resolution, realistic color grading, award-winning advertisement design.

Composition: centered main character, layered depth composition, text positioned cleanly for readability, balanced negative space, premium luxury layout.

Aspect ratio: 1:1 for Instagram post, 4:5 for Facebook ad, 9:16 for story/reels version.

Negative prompt: blurry text, distorted hands, extra fingers, cartoon, low quality, oversaturated colors, unrealistic anatomy, poor typography, cluttered composition, low resolution, duplicate people, AI artifacts, warped documents, pixelated logo, fake-looking faces.`

function readMasterImagePrompt(): string {
  try {
    const stored = localStorage.getItem(MASTER_IMAGE_PROMPT_STORAGE_KEY)
    return (stored && stored.trim().length > 0) ? stored : DEFAULT_MASTER_IMAGE_PROMPT
  } catch {
    return DEFAULT_MASTER_IMAGE_PROMPT
  }
}
function writeMasterImagePrompt(value: string) {
  try {
    // Clear the override when the operator resets to the brand default —
    // keeps localStorage clean and means future default-prompt edits in
    // code automatically reach operators who never customised.
    if (value.trim() === DEFAULT_MASTER_IMAGE_PROMPT.trim()) {
      localStorage.removeItem(MASTER_IMAGE_PROMPT_STORAGE_KEY)
    } else {
      localStorage.setItem(MASTER_IMAGE_PROMPT_STORAGE_KEY, value)
    }
  } catch {
    // localStorage can throw in some private-browsing modes — silently
    // degrade to in-memory only. The next session falls back to default.
  }
}


const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  success: 'Success story',
  education: 'Educational',
  visa: 'Visa / News',
  lifestyle: 'Lifestyle',
  motivation: 'Motivation',
  cta: 'Call to action',
  bts: 'Behind the scenes',
}

const PLATFORM_META: Record<Platform, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  facebook: { label: 'Facebook', color: 'bg-blue-600', icon: Facebook },
  instagram: { label: 'Instagram', color: 'bg-pink-600', icon: Instagram },
  threads: { label: 'Threads', color: 'bg-gray-900', icon: AtSign },
  linkedin: { label: 'LinkedIn', color: 'bg-sky-700', icon: Linkedin },
  youtube: { label: 'YouTube', color: 'bg-red-600', icon: Youtube },
  tiktok: { label: 'TikTok', color: 'bg-black', icon: Music2 },
}

// Build a "View on platform" URL from the publish-result remote id when
// the format is recognisable. Returns null for platforms where the id
// alone isn't enough (IG/Threads/TikTok need usernames or shortcodes
// that we don't store).
function platformPostUrl(platform: Platform, remoteId: string | undefined): string | null {
  if (!remoteId) return null
  if (platform === 'facebook') return `https://www.facebook.com/${remoteId}`
  if (platform === 'linkedin') {
    const urn = remoteId.startsWith('urn:li:') ? remoteId : `urn:li:share:${remoteId}`
    return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`
  }
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${encodeURIComponent(remoteId)}`
  return null
}

const ALL_PLATFORMS: Platform[] = ['facebook', 'instagram', 'threads', 'linkedin', 'youtube', 'tiktok']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('gritsync_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Short, glance-able "5m ago / 3d ago" formatting for the Accounts tab's
// last-published heartbeat. Falls back to a date when older than ~30 days.
function relativeTimeFromNow(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/social${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body.data ?? body
}

function StatusPill({ status }: { status: SocialPost['status'] }) {
  const map: Record<SocialPost['status'], string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    queued: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    publishing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', map[status])}>
      {status}
    </span>
  )
}

export function AdminSocial() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  type SocialTab = 'manager' | 'compose' | 'bank' | 'scheduled' | 'history' | 'accounts' | 'ads'
  const initialTab: SocialTab = (() => {
    const t = searchParams.get('tab')
    return (['manager', 'compose', 'bank', 'scheduled', 'history', 'accounts', 'ads'] as const).includes(t as any)
      ? (t as SocialTab)
      : 'manager'
  })()
  const [tab, setTab] = useState<SocialTab>(initialTab)
  // Compose-tab prefill triggered by Manager → "Generate a post about this".
  // GeneratorView consumes the topic + optional template once and clears it.
  const [composePrefill, setComposePrefill] = useState<{ topic?: string; templateId?: string } | null>(null)

  // Keep ?tab= in sync so the URL is deep-linkable and the /admin/ads redirect
  // lands on the right tab.
  useEffect(() => {
    if (searchParams.get('tab') !== tab) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', tab)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [bank, setBank] = useState<BankItem[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [scheduleModal, setScheduleModal] = useState<ScheduleModalState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Connect modal state
  const [connectPlatform, setConnectPlatform] = useState<Platform | null>(null)
  const [manualForm, setManualForm] = useState({
    display_name: '',
    platform_user_id: '',
    access_token: '',
    refresh_token: '',
    profile_url: '',
    avatar_url: '',
  })
  const [manualSaving, setManualSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin()) {
      setLoading(false)
      return
    }
    refresh()
    // Listen for OAuth popup callbacks
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'social-connected') {
        showToast(`${PLATFORM_META[e.data.platform as Platform]?.label} connected`, 'success')
        refresh()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prefill from another page (e.g. "Schedule on social" from AI Ads) routes
  // directly into the shared schedule modal instead of the old compose form.
  useEffect(() => {
    const prefill = (location.state as any)?.socialPrefill
    if (!prefill) return
    if (prefill.content || (Array.isArray(prefill.media_urls) && prefill.media_urls.length)) {
      setScheduleModal({
        caption: prefill.content || '',
        media_urls: Array.isArray(prefill.media_urls) ? prefill.media_urls : [],
        bank_id: null,
        editing_post: null,
      })
    }
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      const [accs, ps] = await Promise.all([
        api<SocialAccount[]>('/accounts'),
        api<SocialPost[]>('/posts'),
      ])
      setAccounts(accs)
      setPosts(ps)
    } catch (err: any) {
      showToast(err.message || 'Failed to load social data', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ─── Accounts tab ──────────────────────────────────────────────────────
  async function startOAuth(platform: Platform) {
    try {
      const data = await api<{ url: string }>(`/oauth/${platform}/start`)
      const popup = window.open(data.url, 'social-oauth', 'width=600,height=720')
      if (!popup) showToast('Popup blocked — allow popups for this site', 'error')
    } catch (err: any) {
      // Fall back to manual entry when OAuth isn't configured.
      showToast(err.message || 'OAuth not available — using manual entry', 'info')
      setConnectPlatform(platform)
      setManualForm({ display_name: '', platform_user_id: '', access_token: '', refresh_token: '', profile_url: '', avatar_url: '' })
    }
  }

  async function disconnectAccount(id: string) {
    if (!confirm('Disconnect this account? Scheduled posts using it will fail.')) return
    try {
      await api(`/accounts/${id}`, { method: 'DELETE' })
      showToast('Account disconnected', 'success')
      refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect', 'error')
    }
  }

  async function saveManualAccount() {
    if (!connectPlatform) return
    if (!manualForm.display_name.trim() || !manualForm.platform_user_id.trim() || !manualForm.access_token.trim()) {
      showToast('Display name, platform user ID, and access token are required', 'error')
      return
    }
    setManualSaving(true)
    try {
      await api('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify({ platform: connectPlatform, ...manualForm }),
      })
      showToast(`${PLATFORM_META[connectPlatform].label} connected`, 'success')
      setConnectPlatform(null)
      refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to save account', 'error')
    } finally {
      setManualSaving(false)
    }
  }

  // ─── Compose tab ───────────────────────────────────────────────────────
  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    try {
      await api(`/posts/${id}`, { method: 'DELETE' })
      showToast('Deleted', 'success')
      refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
    }
  }

  async function publishNow(id: string) {
    try {
      await api(`/posts/${id}/publish`, { method: 'POST' })
      showToast('Publishing — check History in a moment', 'success')
      refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to publish', 'error')
    }
  }

  function editPost(p: SocialPost) {
    // Editing now flows through the shared schedule modal so the post body +
    // media + accounts + scheduled time all live in one place.
    setScheduleModal({
      caption: p.content,
      media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
      bank_id: null,
      editing_post: p,
    })
  }

  function repostPost(p: SocialPost) {
    // Repost opens the schedule modal pre-filled with the original
    // caption + media + accounts, but as a NEW post (editing_post stays
    // null) so the operator can tweak the timing or remove platforms
    // before publishing the second run.
    setScheduleModal({
      caption: p.content,
      media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
      bank_id: null,
      editing_post: null,
      initial_account_ids: Array.isArray(p.account_ids) ? p.account_ids : [],
    })
  }

  // Content Bank actions
  async function loadBank() {
    setBankLoading(true)
    try {
      const items = await api<BankItem[]>('/ai/content-bank')
      setBank(items)
    } catch (err: any) {
      showToast(err.message || 'Failed to load content bank', 'error')
    } finally {
      setBankLoading(false)
    }
  }

  async function refreshBankItem(id: string) {
    try {
      const updated = await api<BankItem>(`/ai/content-bank/${id}/refresh-media`, { method: 'POST' })
      setBank((cur) => cur.map((it) => (it.id === id ? { ...it, ...updated } : it)))
      if (updated.media_url) showToast('Video ready', 'success')
    } catch (err: any) {
      showToast(err.message || 'Refresh failed', 'error')
    }
  }

  async function deleteBankItem(id: string) {
    if (!confirm('Delete this bank item?')) return
    try {
      await api(`/ai/content-bank/${id}`, { method: 'DELETE' })
      setBank((cur) => cur.filter((it) => it.id !== id))
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
    }
  }

  // Load the bank the first time the Content Bank tab is opened — and also
  // when the Manager tab is opened, since Manager surfaces a "bank ready"
  // count and gap-detection that depends on knowing the current bank state.
  useEffect(() => {
    if ((tab === 'bank' || tab === 'manager') && bank.length === 0 && !bankLoading) {
      loadBank()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const scheduledPosts = useMemo(
    () => posts.filter((p) => p.status === 'draft' || p.status === 'scheduled' || p.status === 'queued'),
    [posts]
  )
  const historyPosts = useMemo(
    () => posts.filter((p) => p.status === 'published' || p.status === 'partial' || p.status === 'failed' || p.status === 'publishing'),
    [posts]
  )

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center text-gray-600 dark:text-gray-400">
              Access denied. Admin privileges required.
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO title="Social — GritSync Admin" description="Manage GritSync social media accounts and scheduled posts" />
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Social</h1>
              <p className="text-gray-600 dark:text-gray-400">Connect GritSync's social accounts and schedule posts.</p>
            </div>
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* Tab bar */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="flex flex-wrap gap-1">
              {([
                { id: 'manager', label: 'Manager', count: null },
                { id: 'compose', label: 'Compose', count: null },
                { id: 'bank', label: 'Content Bank', count: bank.length },
                { id: 'scheduled', label: 'Scheduled', count: scheduledPosts.length },
                { id: 'history', label: 'History', count: historyPosts.length },
                { id: 'ads', label: 'Ads', count: null },
                { id: 'accounts', label: 'Accounts', count: accounts.length },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    tab === t.id
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  {t.label}
                  {t.count !== null && t.count > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <div className="py-12"><Loading text="Loading social..." /></div>
          ) : tab === 'manager' ? (
            <ManagerView
              accounts={accounts}
              posts={posts}
              bank={bank}
              onGoTo={(next) => setTab(next)}
              onComposeWith={(topic, templateId) => {
                setComposePrefill({ topic, templateId })
                setTab('compose')
              }}
              onUseInAd={(brief) => {
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'ads')
                next.set('brief', brief)
                setSearchParams(next, { replace: true })
                setTab('ads')
              }}
              onBatchGenerated={(items) => {
                setBank((cur) => [...items, ...cur])
                showToast(`Auto-generated ${items.length} item${items.length === 1 ? '' : 's'} — saved to Content Bank`, 'success')
                setTab('bank')
              }}
              showToast={showToast}
            />
          ) : tab === 'compose' ? (
            <GeneratorView
              hasAccounts={accounts.length > 0}
              prefill={composePrefill}
              onPrefillConsumed={() => setComposePrefill(null)}
              onGenerated={(items) => {
                setBank((cur) => [...items, ...cur])
                showToast(`Generated ${items.length} item${items.length === 1 ? '' : 's'} — saved to Content Bank`, 'success')
                setTab('bank')
              }}
            />
          ) : tab === 'bank' ? (
            <ContentBankView
              bank={bank}
              loading={bankLoading}
              onRefresh={loadBank}
              onRefreshItem={refreshBankItem}
              onDelete={deleteBankItem}
              onSchedule={(item) => setScheduleModal({
                caption: item.caption,
                media_urls: item.media_url ? [item.media_url] : [],
                bank_id: item.id,
                editing_post: null,
              })}
              onPostNow={(item) => setScheduleModal({
                caption: item.caption,
                media_urls: item.media_url ? [item.media_url] : [],
                bank_id: item.id,
                editing_post: null,
                quick_post: true,
              })}
              onUseInAd={(item) => {
                // Hand the bank item off to the Ads tab via query params —
                // AdsGenerator reads them on mount and clears them, pins
                // the bank image to every generated variant, and uses
                // bank_id to source the image when launching a real
                // Facebook ad via the Marketing API.
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'ads')
                next.set('brief', item.caption)
                next.set('bank_id', item.id)
                if (item.media_url) next.set('image_url', item.media_url)
                setSearchParams(next, { replace: true })
                setTab('ads')
              }}
              hasAccounts={accounts.length > 0}
            />
          ) : tab === 'scheduled' ? (
            <PostList
              posts={scheduledPosts}
              emptyText="No drafts or scheduled posts yet."
              onEdit={editPost}
              onDelete={deletePost}
              onPublish={publishNow}
              enableCalendarView
            />
          ) : tab === 'history' ? (
            <PostList
              posts={historyPosts}
              emptyText="No published posts yet."
              onEdit={editPost}
              onDelete={deletePost}
              onPublish={publishNow}
              onRepost={repostPost}
              showResults
            />
          ) : tab === 'ads' ? (
            <AdsGenerator
              onPushToSocial={(ad: AdVariant) => {
                // Re-use the existing "prefill into schedule modal" pathway
                // the standalone /admin/ads page used to trigger via router state.
                const text = [ad.headline, ad.primary_text, ad.description && !ad.primary_text?.includes(ad.description) ? ad.description : null]
                  .filter(Boolean)
                  .join('\n\n')
                setScheduleModal({
                  caption: text,
                  media_urls: ad.image_url ? [ad.image_url] : [],
                  bank_id: null,
                  editing_post: null,
                })
                setTab('compose')
              }}
            />
          ) : (
            <AccountsView
              accounts={accounts}
              posts={posts}
              onConnect={startOAuth}
              onManual={(p) => { setConnectPlatform(p); setManualForm({ display_name: '', platform_user_id: '', access_token: '', refresh_token: '', profile_url: '', avatar_url: '' }) }}
              onDisconnect={disconnectAccount}
            />
          )}
        </main>
      </div>

      <Modal
        isOpen={!!connectPlatform}
        onClose={() => setConnectPlatform(null)}
        title={connectPlatform ? `Connect ${PLATFORM_META[connectPlatform].label} (manual)` : ''}
        size="lg"
      >
        {connectPlatform && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Use this form to wire up an account with a long-lived access token you obtained from{' '}
              {PLATFORM_META[connectPlatform].label}'s developer portal. The OAuth-based "Connect" button is the preferred path once
              the {connectPlatform} app credentials are configured on the server.
            </p>
            <ManualInstructions platform={connectPlatform} />
            <Input
              label="Display name"
              placeholder="GritSync Official"
              value={manualForm.display_name}
              onChange={(e) => setManualForm({ ...manualForm, display_name: e.target.value })}
            />
            <Input
              label={
                connectPlatform === 'facebook' ? 'Page ID'
                : connectPlatform === 'instagram' ? 'Instagram business user ID'
                : connectPlatform === 'linkedin' ? 'Person URN (without urn:li:person:)'
                : connectPlatform === 'youtube' ? 'Channel ID'
                : 'TikTok open_id'
              }
              placeholder="e.g. 1234567890"
              value={manualForm.platform_user_id}
              onChange={(e) => setManualForm({ ...manualForm, platform_user_id: e.target.value })}
            />
            <Textarea
              label="Access token"
              rows={3}
              placeholder="Long-lived access token"
              value={manualForm.access_token}
              onChange={(e) => setManualForm({ ...manualForm, access_token: e.target.value })}
            />
            <Input
              label="Refresh token (optional)"
              value={manualForm.refresh_token}
              onChange={(e) => setManualForm({ ...manualForm, refresh_token: e.target.value })}
            />
            <Input
              label="Profile URL (optional)"
              placeholder="https://facebook.com/gritsync"
              value={manualForm.profile_url}
              onChange={(e) => setManualForm({ ...manualForm, profile_url: e.target.value })}
            />
            <Input
              label="Avatar URL (optional)"
              placeholder="https://..."
              value={manualForm.avatar_url}
              onChange={(e) => setManualForm({ ...manualForm, avatar_url: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConnectPlatform(null)} disabled={manualSaving}>Cancel</Button>
              <Button onClick={saveManualAccount} loading={manualSaving}>Save connection</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Shared schedule modal — drives both "Schedule from Content Bank" and
          "Edit scheduled/draft post". */}
      <ScheduleModal
        state={scheduleModal}
        accounts={accounts}
        onClose={() => setScheduleModal(null)}
        onSubmitted={(consumedBankId) => {
          setScheduleModal(null)
          refresh()
          if (consumedBankId) {
            setBank((cur) => cur.filter((it) => it.id !== consumedBankId))
          }
        }}
        showToast={showToast}
      />
    </div>
  )
}

// ─── Meta (Facebook + Instagram) connection card ──────────────────────────
//
// Single OAuth flow that powers BOTH Facebook page posting and Instagram
// Business posting via the linked Pages. The card surfaces:
//   - the connected FB user identity
//   - long-lived user-token expiry (60-day cadence) + a one-click refresh
//   - the list of Pages this OAuth granted access to (each carrying a
//     non-expiring Page token so posting is permanent)
//   - Instagram Business accounts linked to those Pages
//   - ad accounts the user can manage (used by the AI Ads launch flow)
function MetaConnectionCard({
  status,
  busy,
  oauthReady,
  oauthMissing,
  onConnect,
  onRefreshToken,
  onDisconnect,
}: {
  status: MetaConnectionStatus | null
  busy: boolean
  oauthReady: boolean | undefined
  oauthMissing: string[]
  onConnect: () => void
  onRefreshToken: () => void
  onDisconnect: () => void
}) {
  const fbColor = PLATFORM_META.facebook.color
  const igColor = PLATFORM_META.instagram.color

  if (status === null) {
    return (
      <Card className="p-6">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading Meta connection…</div>
      </Card>
    )
  }

  if (!status.connected) {
    const oauthBlocked = oauthReady === false
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex">
              <div className={cn('h-12 w-12 rounded-full -mr-3 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-white', fbColor)}>
                <Facebook className="h-6 w-6" />
              </div>
              <div className={cn('h-12 w-12 rounded-full ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-white', igColor)}>
                <Instagram className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meta (Facebook + Instagram)</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                One OAuth grants posting to every Page you manage, every linked Instagram Business account, and
                Marketing-API access to your ad accounts. Page tokens are <strong>permanent</strong> so posting never
                lapses; the user token (used for ads) refreshes every 60 days in one click.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Not connected
          </span>
        </div>

        {oauthBlocked && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200">
            <strong>OAuth is not configured.</strong> Missing on server: {oauthMissing.join(', ') || 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET'}. Set both in Vercel
            → Settings → Environment Variables, redeploy, then try Connect.
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={onConnect} loading={busy} disabled={busy || oauthBlocked}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Connect Meta
          </Button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Scopes requested: pages_manage_posts, instagram_content_publish, ads_management, business_management.
          </span>
        </div>
      </Card>
    )
  }

  const expiryDays = status.user_token_days_to_expiry ?? null
  const expiryTone =
    expiryDays === null ? 'gray'
    : expiryDays <= 7 ? 'red'
    : expiryDays <= 21 ? 'amber'
    : 'green'
  const expiryClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex">
            <div className={cn('h-12 w-12 rounded-full -mr-3 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-white', fbColor)}>
              <Facebook className="h-6 w-6" />
            </div>
            <div className={cn('h-12 w-12 rounded-full ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-white', igColor)}>
              <Instagram className="h-6 w-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Meta — {status.fb_user_name || 'connected'}
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                Connected
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {status.connected_at && <>Connected {new Date(status.connected_at).toLocaleString()}. </>}
              Posting tokens are permanent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefreshToken} loading={busy} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh token
          </Button>
          <Button size="sm" variant="outline" onClick={onConnect} disabled={busy}>
            Reconnect
          </Button>
          <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={busy} className="text-red-600 hover:text-red-700">
            Disconnect
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <MetaStat
          label="Pages (permanent)"
          value={String(status.pages?.length || 0)}
          tone="green"
        />
        <MetaStat
          label="Instagram accounts"
          value={String(status.instagram_accounts?.length || 0)}
          tone="green"
        />
        <MetaStat
          label="Ad accounts"
          value={String(status.ad_accounts?.length || 0)}
          tone={status.ad_accounts && status.ad_accounts.length > 0 ? 'green' : 'gray'}
        />
        <MetaStat
          label="User token"
          value={expiryDays === null ? 'no expiry' : `${expiryDays}d left`}
          tone={expiryTone}
          className={expiryClasses[expiryTone]}
        />
      </div>

      {/* Pages list */}
      {(status.pages?.length || 0) > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Pages connected (post permanently)
          </div>
          <div className="flex flex-wrap gap-2">
            {status.pages!.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
                title={p.id}
              >
                <Facebook className="h-3 w-3" />
                {p.name}
                {p.instagram_business_account?.username && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-300/80 ml-1">↔ @{p.instagram_business_account.username}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instagram accounts */}
      {(status.instagram_accounts?.length || 0) > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Instagram Business accounts
          </div>
          <div className="flex flex-wrap gap-2">
            {status.instagram_accounts!.map((ig) => (
              <div
                key={ig.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-pink-200 dark:border-pink-800/60 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-200"
              >
                <Instagram className="h-3 w-3" />
                @{ig.username || ig.id}
                <span className="text-[10px] text-pink-600 dark:text-pink-300/80 ml-1">via {ig.linked_page_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ad accounts */}
      {(status.ad_accounts?.length || 0) > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Ad accounts (Marketing API)
          </div>
          <div className="flex flex-wrap gap-2">
            {status.ad_accounts!.map((a) => (
              <div
                key={a.id}
                className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200"
                title={a.id}
              >
                {a.name}{a.currency ? ` · ${a.currency}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {(status.pages?.length || 0) === 0 && (
        <div className="text-xs p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200">
          The connected user manages no Facebook Pages. To post, they need to be an admin on at least one Page —
          reconnect with a different account or grant Page access in Meta Business Suite.
        </div>
      )}
    </Card>
  )
}

// Login-first OAuth card used for every non-Meta platform (Threads,
// LinkedIn, YouTube, TikTok). One big "Sign in with X" CTA is the primary
// affordance — manual token entry is a fallback exposed only when OAuth
// credentials aren't configured on the server yet, OR via the global
// "Advanced" disclosure at the bottom of the Accounts tab.
function PlatformCard({
  platform,
  account,
  oauthStatus,
  lastPublishedAt,
  onConnect,
  onManual,
  onDisconnect,
  onRefreshThreads,
  busy,
}: {
  platform: Platform
  account: SocialAccount | null
  oauthStatus: OAuthStatus | undefined
  lastPublishedAt: string | null
  onConnect: () => void
  onManual: () => void
  onDisconnect: (id: string) => void
  // Optional — only Threads has a server-side refresh endpoint exposed
  // separately. Other platforms refresh automatically at publish time.
  onRefreshThreads?: () => void
  busy?: boolean
}) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const info = PLATFORM_CONNECTION_INFO[platform]
  const oauthReady = oauthStatus?.oauth_ready ?? true
  const oauthMissing = oauthStatus?.missing || []
  const connected = !!account

  const expiryDays = (() => {
    if (!account?.token_expires_at) return null
    const ms = new Date(account.token_expires_at).getTime() - Date.now()
    if (!Number.isFinite(ms)) return null
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
  })()
  const expiryTone =
    expiryDays === null ? 'gray'
    : expiryDays <= 3 ? 'red'
    : expiryDays <= 14 ? 'amber'
    : 'green'
  const expiryClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    gray:  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }

  return (
    <Card className="p-5 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('h-11 w-11 rounded-full flex items-center justify-center text-white flex-shrink-0', meta.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {meta.label}{connected && account?.display_name ? <span className="text-gray-500 dark:text-gray-400 font-normal"> — {account.display_name}</span> : null}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
              {info?.description || 'Connect to publish.'}
            </p>
          </div>
        </div>
        <span className={cn(
          'text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
          connected
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : !oauthReady
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        )}>
          {connected ? 'Connected' : !oauthReady ? 'Setup needed' : 'Not connected'}
        </span>
      </div>

      {connected && account ? (
        <div className="mt-4 flex-1 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Account ID</div>
              <div className="font-mono text-[11px] text-gray-700 dark:text-gray-200 truncate" title={account.platform_user_id}>{account.platform_user_id}</div>
            </div>
            <div className={cn('px-2.5 py-1.5 rounded-md border', expiryClasses[expiryTone].replace('bg-', 'border-').replace('text-', ''), expiryClasses[expiryTone])}>
              <div className="text-[10px] uppercase tracking-wider opacity-80">Token</div>
              <div className="text-[11px] font-medium">{expiryDays === null ? 'no expiry' : `${expiryDays}d left`}</div>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {account.connected_at && <>Connected {new Date(account.connected_at).toLocaleDateString()}. </>}
            {lastPublishedAt
              ? <>Last published <span title={new Date(lastPublishedAt).toLocaleString()}>{relativeTimeFromNow(lastPublishedAt)}</span>.</>
              : <span className="italic">No publishes yet.</span>}
          </div>

          {account.last_error && (
            <div className="text-xs p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300">
              <AlertCircle className="inline h-3 w-3 mr-1" />
              Last publish error: {account.last_error}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2">
            {account.profile_url && (
              <a
                href={account.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-300"
              >
                <ExternalLink className="h-3 w-3" /> Open profile
              </a>
            )}
            {onRefreshThreads && (
              <Button size="sm" variant="outline" onClick={onRefreshThreads} loading={busy} disabled={busy}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh token
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onConnect} disabled={busy}>
              Reconnect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDisconnect(account.id)}
              disabled={busy}
              className="text-red-600 hover:text-red-700 ml-auto"
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : !oauthReady ? (
        // OAuth credentials missing on server — surface what's missing and
        // offer the manual fallback so the operator isn't stranded.
        <div className="mt-4 flex-1 flex flex-col gap-3">
          <div className="text-xs p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200">
            <strong>One-time setup needed.</strong> Add{' '}
            <code className="font-mono text-[11px]">{oauthMissing.join(' + ') || 'app credentials'}</code> to your
            Vercel env vars, then redeploy. Until then, you can paste a long-lived access token manually.
          </div>
          <div className="mt-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onManual}>
              Use a manual token instead
            </Button>
          </div>
        </div>
      ) : (
        // The happy path — OAuth is wired up, no account yet. One big CTA.
        <div className="mt-4 flex-1 flex flex-col gap-3">
          {info && (
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li>{info.whatYouCanDo}</li>
              <li>Scopes requested: <span className="font-mono text-[11px]">{info.scopes}</span></li>
              <li>Sign in opens a {meta.label} consent popup — no credentials touch GritSync.</li>
            </ul>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Button onClick={onConnect} loading={busy} disabled={busy} className="flex-1 sm:flex-none">
              <Plus className="h-3.5 w-3.5 mr-1" /> Sign in with {meta.label}
            </Button>
            <button
              onClick={onManual}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              title="Paste a long-lived access token instead"
            >
              Advanced: use a token
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

function MetaStat({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: string
  tone: 'green' | 'amber' | 'red' | 'gray'
  className?: string
}) {
  const tones: Record<string, string> = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300',
    gray: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
  }
  return (
    <div className={cn('px-3 py-2 rounded-lg border', className || tones[tone])}>
      <div className="text-[10px] uppercase tracking-wider opacity-80 font-medium">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  )
}

// ─── Manual-connect instructions (platform-specific step-by-step) ─────────
const MANUAL_INSTRUCTIONS: Record<Platform, {
  intro: string
  steps: Array<{ text: string; href?: string; hrefLabel?: string }>
  fields: { id: string; token: string }
}> = {
  facebook: {
    intro: 'Facebook Pages publish via a long-lived Page Access Token. Generate it once from a System User or the Graph API Explorer:',
    steps: [
      { text: 'Open the Graph API Explorer, pick your App, and add the permissions: pages_show_list, pages_manage_posts, pages_read_engagement.', href: 'https://developers.facebook.com/tools/explorer/', hrefLabel: 'Graph API Explorer' },
      { text: 'Click "Generate Access Token" and authorize. Copy the resulting user token.' },
      { text: 'Call GET /me/accounts with that token. In the response, find the Page you want to post from and copy its `id` and `access_token` (this is your Page Access Token).' },
      { text: 'Exchange the short-lived token for a long-lived one via the Access Token Tool, or use a System User token (recommended for prod).', href: 'https://developers.facebook.com/tools/debug/accesstoken/', hrefLabel: 'Access Token Tool' },
      { text: 'Paste the Page `id` below as Page ID and the Page Access Token as Access token.' },
    ],
    fields: { id: 'Page ID (e.g. 102345678901234)', token: 'Page Access Token (long-lived)' },
  },
  instagram: {
    intro: 'Instagram publishing uses the Graph API. You need a Business/Creator IG account linked to a Facebook Page, and a Page Access Token with Instagram permissions.',
    steps: [
      { text: 'Make sure your Instagram account is set to Business or Creator and linked to a Facebook Page in Page Settings → Instagram.' },
      { text: 'Open the Graph API Explorer and add scopes: instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement.', href: 'https://developers.facebook.com/tools/explorer/', hrefLabel: 'Graph API Explorer' },
      { text: 'Generate a User Access Token and call GET /me/accounts to find your Page and its Page Access Token.' },
      { text: 'Call GET /{page-id}?fields=instagram_business_account — the returned `id` is your Instagram Business User ID.' },
      { text: 'Use the Access Token Tool to extend the Page Access Token to a long-lived version (~60 days, or use a System User for non-expiring).', href: 'https://developers.facebook.com/tools/debug/accesstoken/', hrefLabel: 'Access Token Tool' },
      { text: 'Paste the IG Business User ID below as the platform ID and the Page Access Token as Access token.' },
    ],
    fields: { id: 'Instagram Business User ID', token: 'Page Access Token (long-lived)' },
  },
  threads: {
    intro: 'Threads publishing uses the Threads API (separate Meta app from Facebook/Instagram, but same dashboard). You need the user-level long-lived token (60-day TTL, refreshable).',
    steps: [
      { text: 'In Meta Developers, open your Threads app (or create one with the "Access the Threads API" use case).', href: 'https://developers.facebook.com/apps/', hrefLabel: 'Meta Developers' },
      { text: 'Under Use cases → Threads → Settings, add this redirect URI: https://app.gritsync.com/api/social/oauth/threads/callback' },
      { text: 'Click the user-token tester button next to your app to mint a short-lived token with scopes threads_basic + threads_content_publish.' },
      { text: 'Call GET https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=<SECRET>&access_token=<SHORT> to upgrade to a 60-day long-lived token.' },
      { text: 'Call GET https://graph.threads.net/v1.0/me?fields=id,username,name with the long-lived token — copy the numeric `id`.' },
      { text: 'Paste the `id` as Threads User ID and the long-lived access_token below.' },
    ],
    fields: { id: 'Threads User ID (numeric)', token: 'Long-lived access token' },
  },
  linkedin: {
    intro: 'LinkedIn posts use the UGC API on behalf of a member. You need an OAuth app with the w_member_social scope and a member access token.',
    steps: [
      { text: 'Go to LinkedIn Developer Apps and create (or open) your app.', href: 'https://www.linkedin.com/developers/apps', hrefLabel: 'LinkedIn Developer Apps' },
      { text: 'Under Products, request access to "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect".' },
      { text: 'In the Auth tab, copy your Client ID + Client Secret, and add an authorized redirect URL.' },
      { text: 'Run the 3-legged OAuth flow with scopes openid, profile, email, w_member_social. The OAuth 2.0 Tools page can do this for you.', href: 'https://www.linkedin.com/developers/tools/oauth/token-generator', hrefLabel: 'OAuth Token Generator' },
      { text: 'After authorizing, call GET https://api.linkedin.com/v2/userinfo with the resulting bearer token — the `sub` field is your Person URN suffix (e.g. abcdEFG123).' },
      { text: 'Paste the suffix below (without the urn:li:person: prefix) and the bearer token as Access token.' },
    ],
    fields: { id: 'Person URN suffix (e.g. abcdEFG123)', token: 'OAuth bearer token' },
  },
  youtube: {
    intro: 'YouTube publishing requires uploading video files. Connecting an account still works for metadata/auth, but note that "feed" posts via API aren\'t supported — only video uploads.',
    steps: [
      { text: 'Create or open a project in Google Cloud Console and enable the YouTube Data API v3.', href: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com', hrefLabel: 'Enable YouTube Data API' },
      { text: 'Under APIs & Services → Credentials, create an OAuth 2.0 Client ID (Desktop or Web). Note the Client ID + Client Secret.' },
      { text: 'Open the OAuth 2.0 Playground, click the gear → use your own credentials, and authorize the scope https://www.googleapis.com/auth/youtube.upload (also add youtube.readonly).', href: 'https://developers.google.com/oauthplayground/', hrefLabel: 'OAuth 2.0 Playground' },
      { text: 'Click "Exchange authorization code for tokens" — copy both the access_token and refresh_token.' },
      { text: 'Call GET https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true with the access token — copy the `id` of the channel you want.' },
      { text: 'Paste the channel `id` below as the platform ID, the access_token as Access token, and the refresh_token below.' },
    ],
    fields: { id: 'Channel ID (UC…)', token: 'OAuth access_token' },
  },
  tiktok: {
    intro: 'TikTok publishing uses the Content Posting API and requires a TikTok for Developers app with video.publish scope.',
    steps: [
      { text: 'Sign in at TikTok for Developers and create an app.', href: 'https://developers.tiktok.com/apps', hrefLabel: 'TikTok for Developers' },
      { text: 'Under "Add products", enable Login Kit and Content Posting API. Add user.info.basic, video.publish, video.upload scopes.' },
      { text: 'In Login Kit settings, add a Redirect URI and copy the Client Key + Client Secret.' },
      { text: 'Run the OAuth flow: open https://www.tiktok.com/v2/auth/authorize/?client_key=…&scope=user.info.basic,video.publish,video.upload&response_type=code&redirect_uri=…, sign in, copy the `code`.' },
      { text: 'POST that code to https://open.tiktokapis.com/v2/oauth/token/ to exchange it for an access_token and refresh_token.' },
      { text: 'Call GET https://open.tiktokapis.com/v2/user/info/ with the access token — copy `data.user.open_id`.' },
      { text: 'Paste open_id below as the platform ID and the access_token as Access token.' },
    ],
    fields: { id: 'open_id (from /v2/user/info/)', token: 'OAuth access_token' },
  },
}

function ManualInstructions({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const guide = MANUAL_INSTRUCTIONS[platform]
  return (
    <div className="rounded-lg border border-primary-200 dark:border-primary-800/50 bg-primary-50/60 dark:bg-primary-900/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('h-6 w-6 rounded-full inline-flex items-center justify-center text-white', meta.color)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          How to get a {meta.label} access token
        </h4>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{guide.intro}</p>
      <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
        {guide.steps.map((s, i) => (
          <li key={i} className="leading-relaxed">
            {s.text}
            {s.href && (
              <>
                {' '}
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 underline">
                  {s.hrefLabel || 'Open'}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <div><span className="font-medium">Platform ID:</span> {guide.fields.id}</div>
        <div><span className="font-medium">Access token:</span> {guide.fields.token}</div>
      </div>
    </div>
  )
}

// ─── Accounts view ─────────────────────────────────────────────────────────
interface OAuthStatus {
  oauth_ready: boolean
  missing: string[]
}

// Per-platform copy used by PlatformCard. Meta has its own dedicated card
// (different shape — multiple Pages/IG accounts/ad accounts under one
// OAuth), so it's intentionally absent from this map.
const PLATFORM_CONNECTION_INFO: Partial<Record<Platform, {
  description: string
  scopes: string
  whatYouCanDo: string
}>> = {
  threads: {
    description: 'Post directly to your Threads handle. We refresh the long-lived token automatically before it expires.',
    scopes: 'threads_basic, threads_content_publish',
    whatYouCanDo: 'Publish text + image + carousel posts to your @handle.',
  },
  linkedin: {
    description: 'Post as your LinkedIn member profile. Reach professional connections without leaving GritSync.',
    scopes: 'openid, profile, email, w_member_social',
    whatYouCanDo: 'Publish text + image posts to your personal feed.',
  },
  youtube: {
    description: 'Upload videos to your YouTube channel. Feed-style posts aren\'t supported by the API — videos only.',
    scopes: 'youtube.upload, youtube.readonly',
    whatYouCanDo: 'Upload short-form vertical and long-form video.',
  },
  tiktok: {
    description: 'Post videos to your TikTok account via the Content Posting API.',
    scopes: 'user.info.basic, video.publish, video.upload',
    whatYouCanDo: 'Upload mobile-first vertical videos to your feed.',
  },
}

interface DriveStatus {
  connected: boolean
  email: string | null
  folder_id: string | null
  folder_name: string | null
}

interface MetaConnectionPage {
  id: string
  name: string
  instagram_business_account?: { id: string; username?: string } | null
}
interface MetaConnectionIg {
  id: string
  username?: string
  name?: string
  avatar_url?: string
  linked_page_id: string
  linked_page_name: string
}
interface MetaConnectionAdAccount {
  id: string
  account_id: string
  name: string
  status: number
  currency?: string
}
interface MetaConnectionStatus {
  connected: boolean
  fb_user_id?: string
  fb_user_name?: string
  connected_at?: string
  user_token_expires_at?: string | null
  user_token_days_to_expiry?: number | null
  page_tokens_permanent?: boolean
  pages?: MetaConnectionPage[]
  instagram_accounts?: MetaConnectionIg[]
  ad_accounts?: MetaConnectionAdAccount[]
}

// ─── Manager view ─────────────────────────────────────────────────────────
// Strategic command center — surfaces cadence health, best-time-to-post
// guidance, topic recommendations, and an action queue with CTAs that
// route into every other sub-tab. Every recommendation here is opinionated
// rather than statistical (we don't yet ingest per-post engagement); when
// that data lands the cadence/best-time helpers below can swap their
// heuristics for measured numbers without touching the UI shape.

// Best posting windows per platform, tuned for GritSync's audience —
// Filipino healthcare professionals primarily in Asia/Manila (PHT). All
// times shown are PHT. Reasoning is surfaced inline so the operator
// understands *why* a window is recommended, not just what.
const BEST_TIMES: Record<Platform, { weekday: string; weekend: string; reason: string }> = {
  facebook:  { weekday: '8–10 AM · 7–10 PM',     weekend: '12–3 PM',     reason: 'Audience checks FB on the commute and after dinner. Weekends shift to early afternoon.' },
  instagram: { weekday: '12 PM · 7–9 PM',         weekend: '11 AM–2 PM',  reason: 'Lunch + post-shift scroll. Stories peak 8–10 PM PHT.' },
  threads:   { weekday: '12–1 PM · 10 PM–12 AM',  weekend: '10–11 PM',    reason: 'Threads skews late-night and conversational — short hooks win.' },
  linkedin:  { weekday: '8–10 AM (Tue/Wed/Thu)',  weekend: 'avoid',       reason: 'Professional audience reads in the workday lull. Weekends die for B2B.' },
  youtube:   { weekday: '7–10 PM',                weekend: 'Sat 6–8 PM',  reason: 'Watch-time peaks evenings; Saturday night is the longer-form sweet spot.' },
  tiktok:    { weekday: '6–10 PM',                weekend: '8–10 PM',     reason: 'Mobile-first audience — peak FYP time after dinner, every day of the week.' },
}

// Curated "what's hot for our audience right now" topic seeds. These run
// alongside random picks from POST_TEMPLATES so the suggestion list always
// mixes a quartet of evergreen brand-aligned topics with current-events
// hooks. Update this list as the visa bulletin / NCLEX format / state-BON
// landscape moves.
const TRENDING_TOPIC_IDEAS: Array<{ title: string; brief: string; tag: string }> = [
  { title: 'Visa Bulletin retrogression — what it means for nurses right now',     brief: 'Plain-language breakdown of the current EB-3 Schedule A movement for Filipino nurses, what "retrogression" means, and how GritSync helps clients stay application-ready while they wait.',                 tag: 'Visa' },
  { title: 'NCLEX Next-Gen question types — what changed and how to study',       brief: 'Walk Filipino nurses through the Next-Gen NCLEX-RN format: case-study items, bowtie, matrix, and how Qbank prep needs to shift. Honest, no fabricated pass-rate stats.',                                         tag: 'NCLEX' },
  { title: 'USRN salary by US state — what is competitive in 2026',                brief: 'A grounded overview of where new USRNs tend to earn well (in general ranges) — Cali, Texas, NY metros — vs cost-of-living trade-offs. No fabricated numbers; cite "general ranges" only.',                              tag: 'Career' },
  { title: 'The first 30 days as a USRN — what no one tells you',                  brief: 'Reflective post: charting in a new EHR, US patient-care ratios, the surreal first paycheck, homesickness. Warm, non-boastful, grounded.',                                                                       tag: 'Lifestyle' },
  { title: 'How to spot a scammy US nursing recruiter (4 red flags)',              brief: 'Upfront fees, vague employer info, "guaranteed visa" claims, and high-pressure tactics. Help nurses self-protect. End with GritSync as the transparent, no-hidden-fee alternative — without naming competitors.', tag: 'Education' },
  { title: 'Schedule A pre-certification explained for Filipino RNs',              brief: 'What Schedule A is, why nurses get it, and what it does NOT guarantee. Honest framing, no fabricated dates. GritSync as the partner that tracks the bulletin on their behalf.',                                   tag: 'Visa' },
  { title: 'Endorsing your US RN license to a second state — full walk-through',   brief: 'Cover the typical documents, verification-of-licensure step, fees range, and one common mistake. Avoid state-specific fabricated timelines.',                                                                      tag: 'Education' },
  { title: 'IELTS Academic for nurses — a 2-week prep plan',                       brief: 'A realistic 14-day study plan focused on the bands nurses tend to lose (writing task 1 visual descriptions, speaking part 3 extended answers). Actionable, no fluff.',                                                tag: 'Education' },
]

function ManagerView({
  accounts,
  posts,
  bank,
  onGoTo,
  onComposeWith,
  onUseInAd,
  onBatchGenerated,
  showToast,
}: {
  accounts: SocialAccount[]
  posts: SocialPost[]
  bank: BankItem[]
  onGoTo: (tab: 'compose' | 'bank' | 'scheduled' | 'history' | 'accounts' | 'ads') => void
  onComposeWith: (topic: string, templateId?: string) => void
  onUseInAd: (brief: string) => void
  // Called after the agent auto-generates a batch via /ai/generate-batch.
  // The parent merges the items into its `bank` state, shows a toast, and
  // routes to the Content Bank tab so the operator sees the new posts.
  onBatchGenerated: (items: BankItem[]) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  // Autopilot persists across sessions so the operator's intent is sticky.
  // Today the flag only drives a "the agent recommends, you click to apply"
  // workflow; flipping it ON is the user opt-in needed before we add the
  // real 24/7 cron that auto-refills the bank + auto-schedules to best
  // times. UI calls it "Beta" so expectations stay honest.
  const [autopilot, setAutopilot] = useState(() => localStorage.getItem('gritsync_socmed_autopilot') === 'on')
  function toggleAutopilot() {
    const next = !autopilot
    setAutopilot(next)
    localStorage.setItem('gritsync_socmed_autopilot', next ? 'on' : 'off')
    showToast(next
      ? 'Autopilot enabled — agent will surface daily plans and gap nudges'
      : 'Autopilot paused', 'success')
  }

  // Stats — all computed client-side from data already in scope. No
  // separate API call; this card stays in lock-step with the other tabs.
  const stats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000
    const published7d = posts.filter((p) =>
      p.published_at && new Date(p.published_at).getTime() >= sevenDaysAgo
    ).length
    const scheduledCount = posts.filter((p) =>
      p.status === 'draft' || p.status === 'scheduled' || p.status === 'queued'
    ).length
    const bankReady = bank.filter((b) => b.status === 'available').length
    const failedOrPartial = posts.filter((p) => p.status === 'failed' || p.status === 'partial').length
    const connectedPlatforms = Array.from(new Set(accounts.map((a) => a.platform)))
    return { published7d, scheduledCount, bankReady, failedOrPartial, connectedPlatforms, avgPerDay: published7d / 7 }
  }, [posts, bank, accounts])

  // The operator's chosen posts/day target — drives both the cadence bar
  // and the Auto-generate button's batch size. Persists across sessions
  // and seeds from a heuristic (0.7/day per connected platform, capped at
  // 3) for fresh installs.
  const heuristicTarget = Math.min(3, Math.max(1, Math.round(accounts.length * 0.7) || 1))
  const [postsPerDay, setPostsPerDayState] = useState<number>(() => {
    const stored = Number(localStorage.getItem('gritsync_socmed_posts_per_day'))
    return stored >= 1 && stored <= 6 ? stored : heuristicTarget
  })
  function setPostsPerDay(n: number) {
    const clamped = Math.max(1, Math.min(6, n))
    setPostsPerDayState(clamped)
    localStorage.setItem('gritsync_socmed_posts_per_day', String(clamped))
  }
  const cadence = useMemo(() => {
    const target = postsPerDay
    const current = Number(stats.avgPerDay.toFixed(2))
    const ratio = target > 0 ? Math.min(1.5, current / target) : 0
    return { target, current, ratio }
  }, [postsPerDay, stats.avgPerDay])

  // Auto-generate `postsPerDay` items into the Content Bank in a single
  // API call. Picks a random trending topic so consecutive clicks produce
  // varied output rather than 6 copies of the same idea. Uses GeneratorView's
  // current defaults (Taglish, friendly, medium, openai image) — the user
  // can always tune individual items via the Bank → Use in Ad flow.
  const [autogenerating, setAutogenerating] = useState(false)
  async function autoGenerateBatch() {
    setAutogenerating(true)
    try {
      const idx = Math.floor(Math.random() * TRENDING_TOPIC_IDEAS.length)
      const seed = TRENDING_TOPIC_IDEAS[idx]
      const data = await api<{ items: BankItem[]; brief: string }>('/ai/generate-batch', {
        method: 'POST',
        body: JSON.stringify({
          topic: seed.title,
          preselected_idea: seed.brief,
          template_id: null,
          // Manager auto-generate uses whatever the operator has saved as
          // the master image prompt — the same value Compose sends. This
          // is how the agent stays "continuously learning": refinements
          // saved in Compose immediately apply to the next auto-batch.
          template_image_prompt: readMasterImagePrompt(),
          goal: CAMPAIGN_GOALS.find((g) => g.id === 'build_trust')?.brief || '',
          audience_preset: AUDIENCE_PRESETS.find((a) => a.id === 'ph_considering')?.brief || '',
          platforms: [],
          tone: 'friendly',
          length: 'medium',
          language: 'taglish',
          count: postsPerDay,
          content_type: 'image',
          additional_details: 'Posting cadence: GritSync social manager auto-batch — keep claims grounded, no guarantees.',
          image_provider: 'openai',
        }),
      })
      onBatchGenerated(data.items || [])
    } catch (err: any) {
      showToast(err.message || 'Auto-generate failed', 'error')
    } finally {
      setAutogenerating(false)
    }
  }

  // Per-platform last-published heartbeat. Drives the gap warnings — if
  // a connected platform hasn't seen a publish in N days, the action
  // queue surfaces a "Schedule from bank" CTA.
  const gapsByPlatform = useMemo(() => {
    const last: Record<string, number> = {}
    for (const p of posts) {
      if (!p.published_at) continue
      const t = new Date(p.published_at).getTime()
      for (const a of (p.accounts || [])) {
        if (!last[a.platform] || t > last[a.platform]) last[a.platform] = t
      }
    }
    const connectedPlatforms = Array.from(new Set(accounts.map((a) => a.platform))) as Platform[]
    return connectedPlatforms
      .map((pl) => ({
        platform: pl,
        daysSince: last[pl] ? Math.floor((Date.now() - last[pl]) / (1000 * 3600 * 24)) : null,
      }))
      .sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999))
  }, [posts, accounts])

  // Recommended template mix — pick four POST_TEMPLATES across categories
  // so the operator gets variety without scrolling the dropdown. Memoised
  // so it doesn't reshuffle on every render.
  const recommendedTemplates = useMemo(() => {
    const byCategory: Record<string, typeof POST_TEMPLATES> = {}
    for (const t of POST_TEMPLATES) {
      byCategory[t.category] = byCategory[t.category] || []
      byCategory[t.category].push(t)
    }
    const cats = Object.keys(byCategory)
    const picks: typeof POST_TEMPLATES = []
    for (const cat of cats.slice(0, 4)) {
      const list = byCategory[cat]
      picks.push(list[Math.floor(Math.random() * list.length)])
    }
    return picks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Action queue — each item is "thing that's off, here's the one-click
  // fix". Ordered by severity; the most actionable item is first.
  const actions = useMemo(() => {
    const out: Array<{ id: string; severity: 'amber' | 'red' | 'blue'; title: string; cta: string; onClick: () => void }> = []
    if (accounts.length === 0) {
      out.push({ id: 'no-accounts', severity: 'red', title: "You haven't connected any social accounts yet.", cta: 'Connect Meta', onClick: () => onGoTo('accounts') })
    }
    if (stats.failedOrPartial > 0) {
      out.push({ id: 'failed', severity: 'red', title: `${stats.failedOrPartial} post${stats.failedOrPartial === 1 ? '' : 's'} failed or partial — review and retry.`, cta: 'Open History', onClick: () => onGoTo('history') })
    }
    if (stats.bankReady < 3 && accounts.length > 0) {
      out.push({ id: 'bank-low', severity: 'amber', title: `Content bank is low (${stats.bankReady} ready). Refill so the schedule never goes dark.`, cta: 'Generate batch', onClick: () => onGoTo('compose') })
    }
    const worstGap = gapsByPlatform[0]
    if (worstGap) {
      if (worstGap.daysSince === null) {
        out.push({ id: 'never-posted', severity: 'amber', title: `You haven't published anything on ${PLATFORM_META[worstGap.platform as Platform].label} yet.`, cta: 'Schedule from bank', onClick: () => onGoTo('bank') })
      } else if (worstGap.daysSince > 5) {
        out.push({ id: 'gap-' + worstGap.platform, severity: 'amber', title: `${PLATFORM_META[worstGap.platform as Platform].label} hasn't been posted to in ${worstGap.daysSince} days.`, cta: 'Schedule from bank', onClick: () => onGoTo('bank') })
      }
    }
    if (stats.scheduledCount === 0 && stats.bankReady > 0) {
      out.push({ id: 'queue-empty', severity: 'blue', title: 'No posts scheduled. Queue up a few from the bank to keep momentum.', cta: 'Open bank', onClick: () => onGoTo('bank') })
    }
    return out
  }, [accounts.length, stats, gapsByPlatform, onGoTo])

  return (
    <div className="space-y-6">
      {/* Header — agent identity + autopilot toggle. */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Social-media manager agent</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                Your always-on planner. Answers <em>how many posts/day</em>, <em>when to post</em>, and <em>what
                topics will land</em> with the Filipino-nurse audience. Every recommendation below has a one-click
                CTA into the right sub-tab.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={toggleAutopilot}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                autopilot
                  ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/50'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
              )}
              title="Toggles the agent's daily-planning nudges. (Background-cron auto-publish is on the roadmap.)"
            >
              <span className={cn('h-2 w-2 rounded-full', autopilot ? 'bg-green-500 animate-pulse' : 'bg-gray-400')} />
              Autopilot {autopilot ? 'ON' : 'OFF'}
              <span className="text-[9px] uppercase tracking-wider opacity-70">Beta</span>
            </button>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {autopilot ? 'Agent will nudge you daily.' : 'Agent only recommends when you open this tab.'}
            </span>
          </div>
        </div>
      </Card>

      {/* Stats — 4-up snapshot. Every card is a deep link into the matching
          sub-tab so the operator never has to context-switch through nav. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ManagerStatCard
          label="Published · 7d"
          value={String(stats.published7d)}
          sub={`${stats.avgPerDay.toFixed(1)}/day avg`}
          icon={Activity}
          tone={stats.published7d > 0 ? 'green' : 'gray'}
          onClick={() => onGoTo('history')}
        />
        <ManagerStatCard
          label="Scheduled queue"
          value={String(stats.scheduledCount)}
          sub={stats.scheduledCount === 0 ? 'empty — fill from bank' : 'click to manage'}
          icon={Calendar}
          tone={stats.scheduledCount > 0 ? 'green' : 'amber'}
          onClick={() => onGoTo('scheduled')}
        />
        <ManagerStatCard
          label="Bank ready"
          value={String(stats.bankReady)}
          sub={stats.bankReady < 3 ? 'low — refill' : 'ready to schedule'}
          icon={Sparkles}
          tone={stats.bankReady >= 3 ? 'green' : stats.bankReady > 0 ? 'amber' : 'red'}
          onClick={() => onGoTo('bank')}
        />
        <ManagerStatCard
          label="Connected"
          value={String(stats.connectedPlatforms.length)}
          sub={stats.connectedPlatforms.length === 0 ? 'connect a platform' : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
          icon={Zap}
          tone={stats.connectedPlatforms.length > 0 ? 'green' : 'red'}
          onClick={() => onGoTo('accounts')}
        />
      </div>

      {/* Action queue — gaps, low bank, failed posts. Each row CTA jumps
          into the sub-tab that fixes it. */}
      {actions.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">What needs your attention</h3>
          </div>
          <ul className="space-y-2">
            {actions.map((a) => (
              <li
                key={a.id}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-lg border text-sm',
                  a.severity === 'red'   ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20' :
                  a.severity === 'amber' ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20' :
                                           'border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/20'
                )}
              >
                <span className={cn(
                  a.severity === 'red'   ? 'text-red-800 dark:text-red-200' :
                  a.severity === 'amber' ? 'text-amber-800 dark:text-amber-200' :
                                           'text-blue-800 dark:text-blue-200'
                )}>{a.title}</span>
                <Button size="sm" variant="outline" onClick={a.onClick} className="flex-shrink-0">
                  {a.cta} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Cadence target + auto-generate. The slider sets the agent's daily
          target; clicking Auto-generate refills the Content Bank with
          exactly that many fresh posts in one API call. */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Posting cadence</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              You're publishing <strong>{cadence.current}</strong> post{cadence.current === 1 ? '' : 's'}/day · target
              is <strong>{cadence.target}</strong>/day.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={autoGenerateBatch} loading={autogenerating} disabled={autogenerating}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Auto-generate {postsPerDay} post{postsPerDay === 1 ? '' : 's'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onGoTo('compose')}>
              Fine-tune in Compose <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={cn(
              'h-full transition-all',
              cadence.ratio >= 0.9 ? 'bg-green-500' : cadence.ratio >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${Math.min(100, (cadence.ratio / 1.5) * 100)}%` }}
          />
        </div>

        {/* Target picker — slider + numeric pills. Mobile-friendly: tap a
            pill on small screens; on desktop drag the slider for finer
            cadence-vs-quality intuition. */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Posts per day target
            </label>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Auto-generate clicks produce <strong className="text-gray-700 dark:text-gray-200">{postsPerDay * 7}</strong>{' '}
              posts per week.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(Number(e.target.value))}
              className="flex-1 accent-primary-600"
            />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPostsPerDay(n)}
                  className={cn(
                    'h-7 w-7 rounded-md text-xs font-semibold border transition-colors',
                    postsPerDay === n
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                  )}
                >{n}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-snug">
            {postsPerDay === 1 && 'Minimum-viable cadence — stays top-of-mind without exhausting the feed.'}
            {postsPerDay === 2 && 'Recommended for most pages — one morning hook, one evening payoff.'}
            {postsPerDay === 3 && 'Aggressive but sustainable when the bank is full and the team is shipping.'}
            {postsPerDay >= 4 && 'Heavy cadence — make sure each post earns its slot. Audiences unsubscribe past this rate.'}
            {' '}When per-post engagement data is wired up, the agent will nudge this number based on what's actually working.
          </p>
        </div>
      </Card>

      {/* Best times to post. PHT-tuned for the Filipino-nurse audience. Each
          row CTAs into Bank → schedule modal so the operator can act on the
          recommendation in two clicks. */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Best times to post · PH time</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Windows tuned for your audience: Filipino healthcare professionals in Asia/Manila planning the US move.
        </p>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {(stats.connectedPlatforms.length > 0
            ? stats.connectedPlatforms
            : (['facebook', 'instagram', 'threads', 'linkedin'] as Platform[])
          ).map((pl) => {
            const meta = PLATFORM_META[pl]
            const Icon = meta.icon
            const bt = BEST_TIMES[pl]
            return (
              <li key={pl} className="py-2.5 flex items-start gap-3">
                <span className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0', meta.color)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{meta.label}</div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                    <span className="inline-flex items-center gap-1 mr-3"><span className="text-gray-500 dark:text-gray-400">Weekdays:</span> {bt.weekday}</span>
                    <span className="inline-flex items-center gap-1"><span className="text-gray-500 dark:text-gray-400">Weekends:</span> {bt.weekend}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{bt.reason}</div>
                </div>
              </li>
            )
          })}
        </ul>
        {stats.connectedPlatforms.length === 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 italic">
            Connect an account to see times tailored to your active platforms.
          </p>
        )}
      </Card>

      {/* Viral topic ideas — clickable. Each topic routes to Compose
          with the topic pre-filled, OR into Ads via the small ad-CTA. */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Topics that tend to land</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Trending hooks for the Filipino-nurse audience, plus a few curated GritSync angles. Click any to start
              a fresh post in Compose.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {TRENDING_TOPIC_IDEAS.map((t) => (
            <div
              key={t.title}
              className="group flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    {t.tag}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.title}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{t.brief}</p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <Button size="sm" onClick={() => onComposeWith(t.brief)}>
                  <Sparkles className="h-3 w-3 mr-1" /> Generate
                </Button>
                <Button size="sm" variant="outline" onClick={() => onUseInAd(t.brief)}>
                  <Megaphone className="h-3 w-3 mr-1" /> Use in ad
                </Button>
              </div>
            </div>
          ))}
        </div>

        {recommendedTemplates.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="text-[11px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-2">
              From the brand library
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {recommendedTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onComposeWith('', t.id)}
                  className="group text-left rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors bg-white dark:bg-gray-900"
                >
                  <div className={cn('aspect-[5/3] flex items-center justify-center', t.gradient)}>
                    <span className="text-3xl drop-shadow-sm">{t.emoji}</span>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{t.label}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// Small stat tile used in ManagerView. Each tile is a deep-link button —
// clicking it sets the parent's tab so the operator never has to context-
// switch via the top nav.
function ManagerStatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'green' | 'amber' | 'red' | 'gray'
  onClick: () => void
}) {
  const tones: Record<string, string> = {
    green: 'border-green-200 dark:border-green-800/50 bg-green-50/60 dark:bg-green-900/20',
    amber: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/20',
    red:   'border-red-200 dark:border-red-800/50 bg-red-50/60 dark:bg-red-900/20',
    gray:  'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
  }
  const iconTones: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red:   'text-red-600 dark:text-red-400',
    gray:  'text-gray-500 dark:text-gray-400',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-lg border p-3 transition-all hover:shadow-sm hover:-translate-y-0.5',
        tones[tone]
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconTones[tone])} />
        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
        {sub}
        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  )
}

function AccountsView({
  accounts,
  posts,
  onConnect,
  onManual,
  onDisconnect,
}: {
  accounts: SocialAccount[]
  // Used to surface "Last published N min/hours/days ago" on each connected
  // account row — sourced from `posts[*].results[account_id].at`, so even
  // partial-success publishes still count as a heartbeat.
  posts: SocialPost[]
  onConnect: (p: Platform) => void
  onManual: (p: Platform) => void
  onDisconnect: (id: string) => void
}) {
  // Most-recent successful publish per account id. Walks through every
  // post's `results` map and keeps the latest `.at` timestamp seen for
  // each account. Memoised because History can hold hundreds of posts.
  const lastPublishedById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const p of posts) {
      if (!p.results) continue
      for (const [accId, r] of Object.entries(p.results)) {
        if (!r?.ok || !r.at) continue
        if (!out[accId] || new Date(r.at) > new Date(out[accId])) {
          out[accId] = r.at
        }
      }
    }
    return out
  }, [posts])
  const { showToast } = useToast()
  const [oauthStatus, setOauthStatus] = useState<Record<string, OAuthStatus>>({})
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const [metaStatus, setMetaStatus] = useState<MetaConnectionStatus | null>(null)
  const [metaBusy, setMetaBusy] = useState(false)

  const refreshMetaStatus = () => {
    api<MetaConnectionStatus>('/facebook/connection-status')
      .then(setMetaStatus)
      .catch(() => setMetaStatus({ connected: false }))
  }

  useEffect(() => {
    api<Record<string, OAuthStatus>>('/accounts/oauth-status')
      .then(setOauthStatus)
      .catch(() => {
        // If the endpoint isn't deployed yet, fall back to "unknown" — both
        // buttons stay enabled so the legacy behaviour still works.
      })
  }, [])

  const refreshDriveStatus = () => {
    // /api/integrations/google-drive/status lives outside the /social router,
    // so go through fetch directly instead of api() (which prefixes /api/social).
    fetch('/api/integrations/google-drive/status', { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((j) => setDriveStatus(j.data || null))
      .catch(() => setDriveStatus(null))
  }

  useEffect(() => {
    refreshDriveStatus()
    refreshMetaStatus()
    // Listen for OAuth popup postMessages from Drive + social platform
    // callbacks so we can refresh status pills immediately after the
    // operator finishes the consent flow.
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'google-drive-ok') {
        showToast(e.data.message || 'Google Drive connected', 'success')
        refreshDriveStatus()
      } else if (e.data?.type === 'google-drive-error') {
        showToast(e.data.message || 'Google Drive connection failed', 'error')
      } else if (e.data?.type === 'social-connected' && (e.data.platform === 'facebook' || e.data.platform === 'instagram')) {
        // FB callback also re-emits this. Pull the new Meta state.
        refreshMetaStatus()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshMetaToken() {
    setMetaBusy(true)
    try {
      const r = await fetch('/api/social/facebook/refresh-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      showToast('Meta user token refreshed (+60 days)', 'success')
      refreshMetaStatus()
    } catch (err: any) {
      showToast(err.message || 'Token refresh failed', 'error')
    } finally {
      setMetaBusy(false)
    }
  }

  // Threads is the only non-Meta platform with a separate refresh-token
  // endpoint; LinkedIn/YouTube/TikTok refresh automatically server-side at
  // publish time using stored refresh tokens.
  const [threadsBusy, setThreadsBusy] = useState(false)
  async function refreshThreadsToken() {
    setThreadsBusy(true)
    try {
      await api('/threads/refresh-token', { method: 'POST' })
      showToast('Threads token refreshed (+60 days)', 'success')
      window.dispatchEvent(new CustomEvent('gritsync-accounts-changed'))
    } catch (err: any) {
      showToast(err.message || 'Threads refresh failed', 'error')
    } finally {
      setThreadsBusy(false)
    }
  }

  async function disconnectMeta() {
    if (!confirm('Disconnect Meta? This removes all Facebook Pages, Instagram Business accounts, and ad-account access. You can reconnect anytime.')) return
    setMetaBusy(true)
    try {
      const r = await fetch('/api/social/facebook/disconnect', {
        method: 'DELETE',
        headers: { ...authHeaders() },
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      showToast(`Meta disconnected (${j.data?.rows_removed || 0} rows)`, 'success')
      refreshMetaStatus()
      // Bubble up to parent so the platforms grid + Connected Accounts
      // list both reload without a manual refresh.
      window.dispatchEvent(new CustomEvent('gritsync-accounts-changed'))
    } catch (err: any) {
      showToast(err.message || 'Disconnect failed', 'error')
    } finally {
      setMetaBusy(false)
    }
  }

  async function connectDrive() {
    setDriveBusy(true)
    try {
      const r = await fetch('/api/integrations/google-drive/connect-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      const popup = window.open(j.data.url, 'gritsync-drive-connect', 'width=520,height=620,resizable=yes,scrollbars=yes')
      if (!popup) showToast('Allow popups to connect Google Drive', 'error')
    } catch (err: any) {
      showToast(err.message || 'Failed to start Drive connection', 'error')
    } finally {
      setDriveBusy(false)
    }
  }

  async function disconnectDrive() {
    if (!confirm('Disconnect Google Drive? New generated media will fall back to in-database storage until you reconnect.')) return
    setDriveBusy(true)
    try {
      const r = await fetch('/api/integrations/google-drive', {
        method: 'DELETE',
        headers: { ...authHeaders() },
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      showToast('Google Drive disconnected', 'success')
      refreshDriveStatus()
    } catch (err: any) {
      showToast(err.message || 'Disconnect failed', 'error')
    } finally {
      setDriveBusy(false)
    }
  }

  const anyOAuthReady = Object.values(oauthStatus).some((s) => s?.oauth_ready)

  return (
    <div className="space-y-6">
      {/* Storage integration — Google Drive. When connected, all AI-generated
          images + videos are uploaded to a "GritSync Social" folder and the
          bank stores the Drive public URL. Falls back to in-database storage
          when not connected, so nothing breaks if Drive isn't set up yet. */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Media storage</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
              Connect a Google Drive account to host all AI-generated images and videos in a shared{' '}
              <strong>GritSync Social</strong> folder. Drive URLs are publicly fetchable, so the social
              platforms can pull them at publish time without going through our server.
            </p>
          </div>
          {driveStatus?.connected ? (
            <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Connected
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Using in-database storage
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {driveStatus?.connected ? (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800 dark:text-gray-200">
                  <strong>{driveStatus.email || 'Connected account'}</strong>
                  {driveStatus.folder_name && <span className="text-gray-500 dark:text-gray-400"> · folder “{driveStatus.folder_name}”</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  New AI-generated media now flows here. Existing bank items stay where they were created.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={connectDrive} loading={driveBusy} disabled={driveBusy}>
                Reconnect
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnectDrive} disabled={driveBusy} className="text-red-600 hover:text-red-700">
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Button onClick={connectDrive} loading={driveBusy} disabled={driveBusy}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Connect Google Drive
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Opens a Google consent popup. Requires <code className="text-[11px]">GOOGLE_DRIVE_CLIENT_ID</code> +{' '}
                <code className="text-[11px]">_SECRET</code> set on the server.
              </span>
            </>
          )}
        </div>
      </Card>

      {/* Meta (Facebook + Instagram) connection — one OAuth grants posting to
          every Page the user manages, every linked Instagram Business
          account, and Marketing-API access to every ad account the user
          can manage. Long-lived user token is 60 days; page tokens are
          permanent so posting never breaks even if the user token lapses. */}
      <MetaConnectionCard
        status={metaStatus}
        busy={metaBusy}
        oauthReady={oauthStatus.facebook?.oauth_ready}
        oauthMissing={oauthStatus.facebook?.missing || []}
        onConnect={() => onConnect('facebook')}
        onRefreshToken={refreshMetaToken}
        onDisconnect={disconnectMeta}
      />

      {/* Per-platform OAuth cards. Each card is a self-contained "Sign in
          with X" surface — connected state, identity, last publish, and
          manage actions live inside the card so there's no separate
          "connected accounts" list to drift out of sync. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(['threads', 'linkedin', 'youtube', 'tiktok'] as Platform[]).map((p) => {
          const acc = accounts.find((a) => a.platform === p) || null
          const lastAt = acc ? (lastPublishedById[acc.id] || null) : null
          return (
            <PlatformCard
              key={p}
              platform={p}
              account={acc}
              oauthStatus={oauthStatus[p]}
              lastPublishedAt={lastAt}
              busy={p === 'threads' ? threadsBusy : false}
              onConnect={() => onConnect(p)}
              onManual={() => onManual(p)}
              onDisconnect={onDisconnect}
              onRefreshThreads={p === 'threads' && acc ? refreshThreadsToken : undefined}
            />
          )
        })}
      </div>

      {/* When every configured platform is OAuth-blocked the operator needs
          a single, calm "this is a server-side config issue" hint rather
          than four amber boxes shouting in sequence. */}
      {Object.keys(oauthStatus).length > 0 && !anyOAuthReady && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <strong>None of the platform OAuth apps are configured yet.</strong> Add the missing app credentials in{' '}
              Vercel → Settings → Environment Variables, redeploy, then refresh this page. Each card above shows the
              specific env vars it's waiting on.
            </div>
          </div>
        </Card>
      )}

      {/* Advanced — manual token entry. Hidden by default since OAuth is
          the supported path; surfaces a "still need a manual token?"
          link for each platform. */}
      <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-lg">
          Advanced — connect with an access token
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            If a platform's OAuth flow isn't configured yet, or you already have a long-lived access token from the
            platform's developer portal, you can paste it in directly. This is the same token the publishing pipeline
            uses — it just skips the login dance.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const meta = PLATFORM_META[p]
              const Icon = meta.icon
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onManual(p)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  <span className={cn('h-4 w-4 rounded-full inline-flex items-center justify-center text-white', meta.color)}>
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  Token for {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      </details>
    </div>
  )
}

// ─── Generator view (post generator — replaces the old compose form) ───────
function GeneratorView({
  hasAccounts,
  onGenerated,
  prefill,
  onPrefillConsumed,
}: {
  hasAccounts: boolean
  onGenerated: (items: BankItem[]) => void
  // Optional one-shot prefill from the Manager tab: jumps straight into
  // a topic + (optionally) a curated template, consuming the prefill
  // after applying so future tab switches don't reset the user's edits.
  prefill?: { topic?: string; templateId?: string } | null
  onPrefillConsumed?: () => void
}) {
  const { showToast } = useToast()
  const [topic, setTopic] = useState('')
  const [templateId, setTemplateId] = useState('')
  // The current master image prompt — drives the image AI for every
  // generation. Reads from localStorage (or DEFAULT_MASTER_IMAGE_PROMPT
  // for fresh sessions); writes back on every edit so refinements stick
  // across sessions and across Compose ↔ Manager auto-generate.
  const [masterImagePrompt, setMasterImagePrompt] = useState<string>(() => readMasterImagePrompt())
  const [masterPromptOpen, setMasterPromptOpen] = useState(false)
  const [masterPromptDraft, setMasterPromptDraft] = useState<string>('')
  const [masterPromptRefining, setMasterPromptRefining] = useState(false)
  const [goal, setGoal] = useState<CampaignGoal>('build_trust')
  const [audiencePreset, setAudiencePreset] = useState<AudiencePreset>('ph_considering')
  const [tone, setTone] = useState('friendly')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [language, setLanguage] = useState<'taglish' | 'english' | 'filipino'>('taglish')
  const [resultCount, setResultCount] = useState(3)
  const [contentType, setContentType] = useState<'image' | 'video'>('image')
  const [imageAi, setImageAi] = useState<'openai' | 'nano-banana' | 'grok'>('openai')
  const [additionalDetails, setAdditionalDetails] = useState('')
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'planning' | 'writing' | 'rendering'>('idle')

  const template = POST_TEMPLATES.find((t) => t.id === templateId) || null

  // Apply a one-shot prefill from the Manager tab — sets the topic and/or
  // selected template, then clears the prefill upstream so subsequent
  // re-renders don't keep overwriting the user's edits.
  useEffect(() => {
    if (!prefill) return
    if (prefill.topic) setTopic(prefill.topic)
    if (prefill.templateId) setTemplateId(prefill.templateId)
    onPrefillConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  // Master image prompt — edit / reset / AI-refine. Refining hits the
  // server's /ai/refine-master-prompt endpoint and applies the returned
  // version straight to the editor draft so the operator can review
  // before saving.
  function openMasterPromptEditor() {
    setMasterPromptDraft(masterImagePrompt)
    setMasterPromptOpen(true)
  }
  function saveMasterPrompt() {
    const value = masterPromptDraft.trim()
    if (!value) {
      showToast('Master image prompt cannot be empty', 'error')
      return
    }
    setMasterImagePrompt(value)
    writeMasterImagePrompt(value)
    setMasterPromptOpen(false)
    showToast(value === DEFAULT_MASTER_IMAGE_PROMPT.trim()
      ? 'Reset to brand default — future generations will use it'
      : 'Master image prompt saved — future generations will use it', 'success')
  }
  function resetMasterPromptToDefault() {
    setMasterPromptDraft(DEFAULT_MASTER_IMAGE_PROMPT)
  }
  async function refineMasterPromptWithAI() {
    setMasterPromptRefining(true)
    try {
      const r = await api<{ refined_prompt: string; reasoning?: string }>(
        '/ai/refine-master-prompt',
        {
          method: 'POST',
          body: JSON.stringify({
            current_prompt: masterPromptDraft || masterImagePrompt,
            // Hint the model with context that's likely in flight so the
            // refinement keeps the relevant brand cues. Topic is what
            // the operator is currently writing about; campaign goal
            // shapes what "good" looks like for this round.
            topic: topic.trim() || null,
            goal_brief: CAMPAIGN_GOALS.find((g) => g.id === goal)?.brief || null,
          }),
        }
      )
      if (r.refined_prompt && r.refined_prompt.trim()) {
        setMasterPromptDraft(r.refined_prompt.trim())
        showToast(r.reasoning
          ? `Refined — ${r.reasoning.slice(0, 90)}${r.reasoning.length > 90 ? '…' : ''}`
          : 'Master prompt refined — review and Save when ready', 'success')
      } else {
        throw new Error('No refined prompt returned')
      }
    } catch (err: any) {
      showToast(err.message || 'Refine failed', 'error')
    } finally {
      setMasterPromptRefining(false)
    }
  }

  async function generate() {
    if (!topic.trim() && !template) {
      showToast('Pick a template or describe a topic', 'error')
      return
    }
    setGenerating(true)
    setPhase('planning')
    // Three quick visual phases so the user feels the agentic pipeline:
    // plan → write → render. The backend is a single round-trip; these
    // timers just narrate the work that's happening server-side.
    const t1 = setTimeout(() => setPhase('writing'), 800)
    const t2 = setTimeout(() => setPhase('rendering'), 2600)
    try {
      const data = await api<{ items: BankItem[]; brief: string }>('/ai/generate-batch', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          // We keep the legacy `preselected_idea` field name for the brief so
          // the backend prompt-enhancer sees it without a rename. `template_id`
          // and `template_image_prompt` are the template-specific signals.
          // image-template wins over topic-template for the visual prompt.
          preselected_idea: template?.brief || null,
          template_id: template?.id || null,
          // Always send the master image prompt — single source of truth
          // for what the image AI renders. The operator can edit/refine
          // this from the editor below; whatever's saved in localStorage
          // is what ships to the backend.
          template_image_prompt: masterImagePrompt,
          goal: CAMPAIGN_GOALS.find((g) => g.id === goal)?.brief || '',
          audience_preset: AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.brief || '',
          // Platforms are no longer chosen here — the operator picks accounts
          // at Schedule time. Backend treats [] as "platform-agnostic copy".
          platforms: [],
          tone,
          length,
          language,
          count: resultCount,
          content_type: contentType,
          additional_details: additionalDetails.trim(),
          image_provider: imageAi,
        }),
      })
      onGenerated(data.items || [])
    } catch (err: any) {
      showToast(err.message || 'Generation failed', 'error')
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      setGenerating(false)
      setPhase('idle')
    }
  }

  return (
    <div className="space-y-6">
      {!hasAccounts && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="inline h-4 w-4 mr-1" />
            You can generate posts now — connect a social account in the Accounts tab before you can schedule.
          </p>
        </Card>
      )}

      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Post generator</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Plan like a social-media manager: pick a <strong>goal</strong>, name the <strong>audience</strong>, choose
            the <strong>angle</strong>, and the strategist agent drafts a hook + payoff + CTA before the copywriter
            writes variants. Everything lands in the <strong>Content Bank</strong> — pick which accounts to publish to
            when you schedule.
          </p>
        </div>

        {/* 1. Strategy — goal + audience. The agentic enhancer treats these
            as the most important signals; they shape hook, payoff, and CTA. */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            1. Strategy
            <span className="text-gray-400 font-normal"> — what outcome, and for whom</span>
          </label>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Content goal
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMPAIGN_GOALS.map((g) => {
                const selected = goal === g.id
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={cn(
                      'text-left rounded-lg border-2 p-3 transition-colors',
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-100'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 text-gray-700 dark:text-gray-200'
                    )}
                  >
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      <span>{g.emoji}</span> {g.label}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                      {g.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Audience
            </div>
            <select
              value={audiencePreset}
              onChange={(e) => setAudiencePreset(e.target.value as AudiencePreset)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            >
              {AUDIENCE_PRESETS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">
              {AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.brief}
            </p>
          </div>
        </div>

        {/* 2. Angle (topic + template grid) */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            2. Angle
            <span className="text-gray-400 font-normal"> — your topic, or a branded template</span>
          </label>
          <Textarea
            rows={3}
            placeholder="e.g. A nurse just passed the NCLEX after a year of prep. Celebrate her and remind followers we also cover credentialing."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                GritSync topics — NCLEX & USRN path
              </p>
              {template && (
                <button
                  type="button"
                  onClick={() => setTemplateId('')}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear selection
                </button>
              )}
            </div>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            >
              <option value="">— No topic (free-form from your prompt above) —</option>
              {(Object.keys(TEMPLATE_CATEGORY_LABEL) as TemplateCategory[]).map((cat) => {
                const inCat = POST_TEMPLATES.filter((t) => t.category === cat)
                if (inCat.length === 0) return null
                return (
                  <optgroup key={cat} label={TEMPLATE_CATEGORY_LABEL[cat]}>
                    {inCat.map((t) => (
                      <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            {template && (
              <div className="mt-2 flex items-start gap-3 p-3 rounded-lg border border-primary-200 dark:border-primary-800/50 bg-primary-50/60 dark:bg-primary-900/15">
                <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center text-3xl flex-shrink-0', template.gradient)}>
                  {template.emoji}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{template.label}</div>
                  <div className="text-[11px] uppercase tracking-wider text-primary-700 dark:text-primary-300 mt-0.5">
                    {TEMPLATE_CATEGORY_LABEL[template.category]}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-snug">{template.description}</p>
                </div>
              </div>
            )}
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">
              30 GritSync-aligned topics grouped by category. Leave it on "No topic" to write purely from your prompt above.
            </p>
          </div>

          {/* Master image prompt — single source of truth for the image AI.
              Operator can edit + AI-refine; saved overrides persist in
              localStorage so the agent's "learning" carries across
              sessions. Compose and Manager auto-generate both send
              whatever's saved here as `template_image_prompt`. */}
          <div className="rounded-xl border border-primary-200 dark:border-primary-800/50 bg-primary-50/40 dark:bg-primary-900/15 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Master image prompt</h3>
                  {masterImagePrompt !== DEFAULT_MASTER_IMAGE_PROMPT && (
                    <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      Customised
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                  Drives every image the AI renders for posts. Edit it to evolve the look — refinements are saved on
                  your device and the model can self-improve via the Refine button.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={openMasterPromptEditor}>
                <PencilLine className="h-3.5 w-3.5 mr-1" /> Edit prompt
              </Button>
            </div>
            <div className="mt-3 rounded-lg bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3 max-h-32 overflow-y-auto">
              <p className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug line-clamp-6">
                {masterImagePrompt}
              </p>
            </div>
            {masterPromptOpen && (
              <div className="mt-4 space-y-3 rounded-lg border border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-900 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Editing master prompt
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {masterPromptDraft.length.toLocaleString()} chars
                  </div>
                </div>
                <Textarea
                  rows={14}
                  value={masterPromptDraft}
                  onChange={(e) => setMasterPromptDraft(e.target.value)}
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setMasterPromptOpen(false)} disabled={masterPromptRefining}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetMasterPromptToDefault} disabled={masterPromptRefining}>
                    Reset to brand default
                  </Button>
                  <Button size="sm" variant="outline" onClick={refineMasterPromptWithAI} loading={masterPromptRefining} disabled={masterPromptRefining}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Refine with AI
                  </Button>
                  <Button size="sm" onClick={saveMasterPrompt} disabled={masterPromptRefining || !masterPromptDraft.trim()}>
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  Refine with AI sends the current draft + your active topic/goal to <span className="font-mono">/ai/refine-master-prompt</span>.
                  The model returns an improved version; review then click Save. Reset wipes your override so future
                  default-prompt updates in code reach you automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Format — voice + length + language + how many variants. Account
            selection (which platforms to publish to) now happens at Schedule
            time so the same Content Bank item can land on different accounts
            on different days. */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            3. Format
            <span className="text-gray-400 font-normal"> — how it sounds (accounts get picked at Schedule)</span>
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="encouraging">Encouraging</option>
                <option value="playful">Playful</option>
                <option value="informative">Informative</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Length</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as 'short' | 'medium' | 'long')}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                <option value="short">Short (&lt;100 chars)</option>
                <option value="medium">Medium (~150 chars)</option>
                <option value="long">Long (300+ chars)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'taglish' | 'english' | 'filipino')}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                <option value="taglish">Taglish (default)</option>
                <option value="english">English</option>
                <option value="filipino">Filipino</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Results</label>
              <select
                value={resultCount}
                onChange={(e) => setResultCount(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. Media */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            4. Media
            <span className="text-gray-400 font-normal"> — still image or short vertical video</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setContentType('image')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors',
                contentType === 'image'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              )}
            >
              <Wand2 className="h-4 w-4" /> Image
            </button>
            <button
              type="button"
              onClick={() => setContentType('video')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors',
                contentType === 'video'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              )}
            >
              <Film className="h-4 w-4" /> Video
            </button>
          </div>
          {contentType === 'video' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Video flow: we generate the starting frame with your chosen image AI below, then animate it via Replicate. Bank items
              start as <em>rendering</em> and can be refreshed once ready.
            </p>
          )}

          {/* Image AI selector — drives the still image for "Image" mode, and
              the starting frame for image-to-video in "Video" mode. */}
          <div className="mt-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {contentType === 'video' ? 'Image AI (starting frame)' : 'Image AI'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'openai',      label: 'OpenAI',      sub: 'gpt-image-1 → dall-e fallback' },
                { id: 'nano-banana', label: 'Nano Banana', sub: 'Gemini 2.5 Flash Image' },
                { id: 'grok',        label: 'Grok',        sub: 'grok-2-image' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setImageAi(opt.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-left transition-colors',
                    imageAi === opt.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  )}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-70">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Specifics — extra guidance the strategist agent should respect */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            5. Specifics
            <span className="text-gray-400 font-normal"> — non-negotiables, names to drop, claims to avoid</span>
          </label>
          <Textarea
            rows={3}
            placeholder="e.g. Mention this week's free consult. Avoid medical claims. Don't promise NCLEX pass rates. Reference our hands-on credentialing review."
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {phase === 'planning' ? (
              <><Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Strategist agent planning hook + payoff + CTA…</>
            ) : phase === 'writing' ? (
              <><Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Copywriter drafting {resultCount} variant{resultCount === 1 ? '' : 's'}…</>
            ) : phase === 'rendering' ? (
              <><Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Rendering {contentType} on-brand…</>
            ) : (
              'Strategist agent plans → copywriter writes → image AI renders. One round-trip.'
            )}
          </div>
          <Button onClick={generate} loading={generating} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-1" /> Generate
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ─── Content bank view ─────────────────────────────────────────────────────
function ContentBankView({
  bank,
  loading,
  onRefresh,
  onRefreshItem,
  onDelete,
  onSchedule,
  onPostNow,
  onUseInAd,
  hasAccounts,
}: {
  bank: BankItem[]
  loading: boolean
  onRefresh: () => void
  onRefreshItem: (id: string) => void
  onDelete: (id: string) => void
  onSchedule: (item: BankItem) => void
  onPostNow: (item: BankItem) => void
  onUseInAd: (item: BankItem) => void
  hasAccounts: boolean
}) {
  const [viewItem, setViewItem] = useState<BankItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'pending_media' | 'media_failed' | 'used'>('all')
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all')

  // Count by status — drives the filter chip badges so the operator can
  // see at a glance how many items are stuck rendering or failed.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: bank.length, available: 0, pending_media: 0, media_failed: 0, used: 0 }
    for (const it of bank) counts[it.status] = (counts[it.status] || 0) + 1
    return counts
  }, [bank])

  const filteredBank = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return bank.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false
      if (mediaFilter !== 'all' && it.media_type !== mediaFilter) return false
      if (q && !it.caption.toLowerCase().includes(q) && !(it.source_topic || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [bank, searchTerm, statusFilter, mediaFilter])

  if (loading && bank.length === 0) {
    return <div className="py-12"><Loading text="Loading content bank…" /></div>
  }
  if (bank.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">No bank items yet — generate some posts from the Compose tab.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </Card>
    )
  }

  const filtersActive = searchTerm.trim() !== '' || statusFilter !== 'all' || mediaFilter !== 'all'

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filtersActive
            ? <>Showing <strong className="text-gray-700 dark:text-gray-200">{filteredBank.length}</strong> of {bank.length} items</>
            : <>{bank.length} item{bank.length === 1 ? '' : 's'} in your bank — schedule one to push it to your accounts.</>}
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <Card className="p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search captions or topic…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm pl-8 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          {([
            { id: 'all',           label: 'All' },
            { id: 'available',     label: 'Ready' },
            { id: 'pending_media', label: 'Rendering' },
            { id: 'media_failed',  label: 'Failed' },
            { id: 'used',          label: 'Used' },
          ] as const).map((s) => {
            const active = statusFilter === s.id
            const count = statusCounts[s.id] ?? 0
            return (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors',
                  active
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                )}
              >
                {s.label}
                {count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-semibold',
                    active ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  )}>{count}</span>
                )}
              </button>
            )
          })}
          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          {([
            { id: 'all',   label: 'All media' },
            { id: 'image', label: 'Image' },
            { id: 'video', label: 'Video' },
          ] as const).map((m) => {
            const active = mediaFilter === m.id
            return (
              <button
                key={m.id}
                onClick={() => setMediaFilter(m.id)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  active
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                )}
              >
                {m.label}
              </button>
            )
          })}
          {filtersActive && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); setMediaFilter('all') }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      {filteredBank.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No items match these filters.
        </Card>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredBank.map((item) => (
          <Card key={item.id} className="overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => setViewItem(item)}
              className="aspect-square bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center group cursor-zoom-in text-left"
              title="View full content"
            >
              {item.media_url ? (
                item.media_type === 'video' ? (
                  <video src={item.media_url} className="w-full h-full object-cover" preload="metadata" muted />
                ) : (
                  <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                )
              ) : item.status === 'pending_media' ? (
                <div className="relative w-full h-full">
                  {/* While the video renders, show the still frame the user chose. */}
                  {item.source_image_url ? (
                    <img src={item.source_image_url} alt="" className="w-full h-full object-cover opacity-70" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800" />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                    <span className="text-sm">Video rendering…</span>
                  </div>
                </div>
              ) : item.status === 'media_failed' ? (
                <div className="text-center text-gray-500 text-sm p-4">
                  <AlertCircle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                  Media failed — caption saved
                </div>
              ) : (
                <ImageIcon className="h-8 w-8 text-gray-400" />
              )}
              <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/50 text-white">
                {item.media_type}
              </span>
              {item.media_url && (
                <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-0.5 rounded-full bg-black/60 text-white flex items-center gap-1">
                  <Eye className="h-3 w-3" /> View
                </span>
              )}
            </button>
            <div className="p-4 flex-1 flex flex-col gap-3">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap line-clamp-6">{item.caption}</p>
              <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewItem(item)}
                  title="View full caption + image"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                </Button>
                {item.status === 'pending_media' && (
                  <Button size="sm" variant="outline" onClick={() => onRefreshItem(item.id)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Check video
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => onPostNow(item)}
                  disabled={!hasAccounts || item.status === 'pending_media'}
                  title={!hasAccounts ? 'Connect a social account first' : item.status === 'pending_media' ? 'Wait for video to finish' : 'Publish immediately to selected accounts'}
                >
                  <Zap className="h-3.5 w-3.5 mr-1" /> Post Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSchedule(item)}
                  disabled={!hasAccounts || item.status === 'pending_media'}
                  title={!hasAccounts ? 'Connect a social account first' : 'Schedule for later'}
                >
                  <Clock className="h-3.5 w-3.5 mr-1" /> Schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUseInAd(item)}
                  disabled={item.status === 'pending_media'}
                  title={item.status === 'pending_media' ? 'Wait for video to finish' : 'Use this caption + image as the basis for an ad'}
                >
                  <Megaphone className="h-3.5 w-3.5 mr-1" /> Use in Ad
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(item.id)}
                  className="ml-auto text-gray-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      )}
      <BankItemModal
        item={viewItem}
        onClose={() => setViewItem(null)}
        onSchedule={(it) => { setViewItem(null); onSchedule(it) }}
        onPostNow={(it) => { setViewItem(null); onPostNow(it) }}
        onUseInAd={(it) => { setViewItem(null); onUseInAd(it) }}
        hasAccounts={hasAccounts}
      />
    </div>
  )
}

// Full-content viewer modal — shows the caption at full length, the media
// at full size, and the generation metadata (template, tone, language,
// timestamps). Doubles as a quick way to copy the caption or grab the
// public media URL.
function BankItemModal({
  item,
  onClose,
  onSchedule,
  onPostNow,
  onUseInAd,
  hasAccounts,
}: {
  item: BankItem | null
  onClose: () => void
  onSchedule: (item: BankItem) => void
  onPostNow: (item: BankItem) => void
  onUseInAd: (item: BankItem) => void
  hasAccounts: boolean
}) {
  const { showToast } = useToast()
  if (!item) return null
  const settings = item.generation_settings || {}
  const created = new Date(item.created_at)
  const meta: Array<[string, string]> = []
  if (settings.template_id) meta.push(['Template', String(settings.template_id)])
  if (settings.tone) meta.push(['Tone', String(settings.tone)])
  if (settings.language) meta.push(['Language', String(settings.language)])
  if (settings.length) meta.push(['Length', String(settings.length)])
  if (settings.image_provider) meta.push(['Image AI', String(settings.image_provider)])
  meta.push(['Status', item.status])
  meta.push(['Created', created.toLocaleString()])

  return (
    <Modal isOpen={!!item} onClose={onClose} title="Content Bank item" size="xl">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square flex items-center justify-center">
            {item.media_url ? (
              item.media_type === 'video' ? (
                <video src={item.media_url} className="w-full h-full object-contain" controls autoPlay />
              ) : (
                <img src={item.media_url} alt="" className="w-full h-full object-contain" />
              )
            ) : (
              <div className="text-center text-gray-500 text-sm p-6">
                <AlertCircle className="h-7 w-7 mx-auto text-amber-500 mb-2" />
                {item.status === 'media_failed'
                  ? 'Media generation failed — only the caption was saved.'
                  : item.status === 'pending_media'
                    ? 'Video still rendering. Refresh the bank in a few minutes.'
                    : 'No media attached to this item.'}
              </div>
            )}
          </div>
          {item.media_url && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const abs = item.media_url!.startsWith('http')
                    ? item.media_url!
                    : `${window.location.origin}${item.media_url}`
                  navigator.clipboard.writeText(abs)
                  showToast('Media URL copied', 'success')
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy media URL
              </Button>
              <a
                href={item.media_url}
                download
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
              <a
                href={item.media_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Caption
              </label>
              <button
                onClick={() => { navigator.clipboard.writeText(item.caption); showToast('Caption copied', 'success') }}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 max-h-72 overflow-y-auto">
              {item.caption}
            </div>
          </div>

          {item.enhanced_prompt && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">
                Enhanced brief
              </label>
              <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 max-h-40 overflow-y-auto">
                {item.enhanced_prompt}
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="text-gray-800 dark:text-gray-200 truncate" title={v}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button
              size="sm"
              onClick={() => onPostNow(item)}
              disabled={!hasAccounts || item.status === 'pending_media' || !item.media_url}
              title={!hasAccounts ? 'Connect a social account first' : 'Publish immediately'}
            >
              <Zap className="h-3.5 w-3.5 mr-1" /> Post Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSchedule(item)}
              disabled={!hasAccounts || item.status === 'pending_media' || !item.media_url}
              title={!hasAccounts ? 'Connect a social account first' : 'Schedule for later'}
            >
              <Clock className="h-3.5 w-3.5 mr-1" /> Schedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUseInAd(item)}
              disabled={item.status === 'pending_media'}
            >
              <Megaphone className="h-3.5 w-3.5 mr-1" /> Use in Ad
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Schedule modal ────────────────────────────────────────────────────────
// Shared between "Schedule from bank" and "Edit scheduled post". Submitting new
// content POSTs to /api/social/posts; editing PATCHes /api/social/posts/:id.
function ScheduleModal({
  state,
  accounts,
  onClose,
  onSubmitted,
  showToast,
}: {
  state: ScheduleModalState | null
  accounts: SocialAccount[]
  onClose: () => void
  onSubmitted: (consumedBankId: string | null) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [caption, setCaption] = useState('')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [when, setWhen] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!state) return
    setCaption(state.caption)
    setMediaUrls(state.media_urls)
    if (state.editing_post) {
      setAccountIds(state.editing_post.account_ids)
      setWhen(state.editing_post.scheduled_at
        ? new Date(state.editing_post.scheduled_at).toISOString().slice(0, 16)
        : '')
    } else {
      setAccountIds(state.initial_account_ids || [])
      setWhen('')
    }
  }, [state])

  const editingId = state?.editing_post?.id || null
  const isOpen = !!state

  async function submit(mode: 'now' | 'schedule' | 'draft') {
    if (mode !== 'draft' && accountIds.length === 0) {
      showToast('Select at least one account', 'error'); return
    }
    if (!caption.trim()) {
      showToast('Caption is required', 'error'); return
    }
    if (mode === 'schedule' && !when) {
      showToast('Pick a date and time', 'error'); return
    }
    setSubmitting(true)
    try {
      const body = {
        account_ids: accountIds,
        content: caption.trim(),
        media_urls: mediaUrls,
        scheduled_at: mode === 'schedule' ? new Date(when).toISOString() : null,
        status: mode === 'draft' ? 'draft' : undefined,
      }
      if (editingId) {
        await api(`/posts/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
        if (mode === 'now') {
          await api(`/posts/${editingId}/publish`, { method: 'POST' })
        }
        showToast('Post updated', 'success')
      } else {
        await api('/posts', { method: 'POST', body: JSON.stringify(body) })
        showToast(
          mode === 'now' ? 'Publishing in the background — check History in a moment'
          : mode === 'schedule' ? 'Scheduled'
          : 'Draft saved',
          'success'
        )
      }
      onSubmitted(state?.bank_id ?? null)
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? 'Edit post' : state?.quick_post ? 'Post now' : 'Schedule post'}
      size="lg"
    >
      <div className="space-y-4">
        <Textarea
          label="Caption"
          rows={6}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        {mediaUrls.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Media</label>
            <div className="flex flex-wrap gap-2">
              {mediaUrls.map((u, i) => (
                <div key={i} className="relative">
                  {/\.(mp4|webm|mov)(\?|$)/i.test(u) ? (
                    <video src={u} className="h-24 w-24 object-cover rounded border border-gray-200 dark:border-gray-700" muted />
                  ) : (
                    <img src={u} alt="" className="h-24 w-24 object-cover rounded border border-gray-200 dark:border-gray-700" />
                  )}
                  <button
                    onClick={() => setMediaUrls((cur) => cur.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-0.5 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Post to</label>
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No connected accounts — head to the Accounts tab.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {accounts.map((a) => {
                const meta = PLATFORM_META[a.platform]
                const Icon = meta.icon
                const checked = accountIds.includes(a.id)
                return (
                  <label
                    key={a.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors',
                      checked ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setAccountIds((cur) => cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id])}
                      className="h-4 w-4"
                    />
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.display_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.label}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        {/* In quick-post mode (triggered by the bank's "Post Now" button) we
            hide the datetime picker + draft option so the operator just picks
            accounts and hits Publish. */}
        {!state?.quick_post && (
          <Input
            label="Schedule for (optional)"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            help="Leave blank to post immediately."
          />
        )}
        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          {!state?.quick_post && (
            <Button variant="outline" onClick={() => submit('draft')} disabled={submitting}>Save draft</Button>
          )}
          {when && !state?.quick_post ? (
            <Button onClick={() => submit('schedule')} loading={submitting}>
              <Clock className="h-4 w-4 mr-1" /> Schedule
            </Button>
          ) : (
            <Button onClick={() => submit('now')} loading={submitting}>
              <Zap className="h-4 w-4 mr-1" /> Publish now
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Post list (scheduled + history) ───────────────────────────────────────
function PostList({
  posts,
  emptyText,
  onEdit,
  onDelete,
  onPublish,
  onRepost,
  showResults = false,
  enableCalendarView = false,
}: {
  posts: SocialPost[]
  emptyText: string
  onEdit: (p: SocialPost) => void
  onDelete: (id: string) => void
  onPublish: (id: string) => void
  // Optional — only History wires this up. Lets the operator clone a
  // previously-published post into the schedule modal for a fresh send,
  // typically a few weeks later or to a different subset of accounts.
  onRepost?: (p: SocialPost) => void
  showResults?: boolean
  // When true, surfaces a List/Calendar view toggle. Calendar plots posts
  // onto the month grid by `scheduled_at`. Enabled for the Scheduled tab.
  enableCalendarView?: boolean
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all')
  const [view, setView] = useState<'list' | 'calendar'>('list')

  // Platforms actually present across this set — drives the filter chip
  // row so we don't show YouTube when the user has only FB+IG accounts.
  const availablePlatforms = useMemo(() => {
    const set = new Set<Platform>()
    for (const p of posts) {
      for (const a of p.accounts || []) set.add(a.platform)
    }
    return ALL_PLATFORMS.filter((pl) => set.has(pl))
  }, [posts])

  const filteredPosts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return posts.filter((p) => {
      if (platformFilter !== 'all' && !(p.accounts || []).some((a) => a.platform === platformFilter)) return false
      if (q && !p.content.toLowerCase().includes(q)) return false
      return true
    })
  }, [posts, searchTerm, platformFilter])

  if (posts.length === 0) {
    return <Card className="p-8 text-center text-gray-500 dark:text-gray-400">{emptyText}</Card>
  }

  const filtersActive = searchTerm.trim() !== '' || platformFilter !== 'all'

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search post text…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm pl-8 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {enableCalendarView && (
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'text-xs px-3 py-2 transition-colors',
                  view === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView('calendar')}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs px-3 py-2 transition-colors',
                  view === 'calendar'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                <Calendar className="h-3.5 w-3.5" /> Calendar
              </button>
            </div>
          )}
        </div>
        {availablePlatforms.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <button
              onClick={() => setPlatformFilter('all')}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                platformFilter === 'all'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300'
              )}
            >
              All platforms
            </button>
            {availablePlatforms.map((pl) => {
              const meta = PLATFORM_META[pl]
              const Icon = meta.icon
              const active = platformFilter === pl
              return (
                <button
                  key={pl}
                  onClick={() => setPlatformFilter(pl)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors',
                    active
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                  )}
                >
                  <span className={cn('h-3.5 w-3.5 rounded-full inline-flex items-center justify-center text-white', meta.color)}>
                    <Icon className="h-2 w-2" />
                  </span>
                  {meta.label}
                </button>
              )
            })}
            {filtersActive && (
              <button
                onClick={() => { setSearchTerm(''); setPlatformFilter('all') }}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Reset
              </button>
            )}
          </div>
        )}
        {filtersActive && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing <strong className="text-gray-700 dark:text-gray-200">{filteredPosts.length}</strong> of {posts.length}
          </p>
        )}
      </Card>

      {enableCalendarView && view === 'calendar' ? (
        <PostsCalendar
          posts={filteredPosts}
          onEdit={onEdit}
          onPublish={onPublish}
          onDelete={onDelete}
        />
      ) : filteredPosts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No posts match these filters.</Card>
      ) : filteredPosts.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusPill status={p.status} />
                {p.scheduled_at && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="inline h-3 w-3 mr-0.5" />
                    {new Date(p.scheduled_at).toLocaleString()}
                  </span>
                )}
                {p.published_at && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Published {new Date(p.published_at).toLocaleString()}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {p.accounts?.map((a) => {
                    const meta = PLATFORM_META[a.platform]
                    const Icon = meta?.icon
                    return Icon ? (
                      <span
                        key={a.id}
                        title={a.display_name}
                        className={cn('h-5 w-5 rounded-full inline-flex items-center justify-center text-white', meta.color)}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                    ) : null
                  })}
                </div>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                {p.content}
              </p>
              {Array.isArray(p.media_urls) && p.media_urls.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {p.media_urls.map((u, i) => {
                    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(u)
                    return (
                      <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative"
                        title="Open original"
                      >
                        {isVideo ? (
                          <video src={u} className="w-full h-full object-cover" muted preload="metadata" />
                        ) : (
                          <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                        )}
                        <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/55 text-white">
                          {isVideo ? 'video' : 'image'}
                        </span>
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <ExternalLink className="h-4 w-4 text-white" />
                        </span>
                      </a>
                    )
                  })}
                </div>
              )}
              {showResults && p.results && Object.keys(p.results).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(p.results).map(([accId, r]) => {
                    const meta = PLATFORM_META[r.platform]
                    const url = r.ok ? platformPostUrl(r.platform, r.remote_id) : null
                    return (
                      <div
                        key={accId}
                        className={cn(
                          'text-xs flex items-center gap-2',
                          r.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                        )}
                      >
                        {r.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        <span className="font-medium">{meta?.label || r.platform}:</span>
                        <span className="truncate">
                          {r.ok ? `OK${r.remote_id ? ` · ${r.remote_id}` : ''}` : r.error}
                        </span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-primary-600 dark:text-primary-400 hover:underline ml-auto"
                            title={`Open on ${meta?.label || r.platform}`}
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0 w-32">
              {(p.status === 'draft' || p.status === 'scheduled' || p.status === 'failed' || p.status === 'partial') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(p)}
                  title="Edit caption, media, accounts, or scheduled time"
                  className="justify-start"
                >
                  <PencilLine className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              )}
              {(p.status === 'draft' || p.status === 'scheduled') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPublish(p.id)}
                  title="Publish now (bypass schedule)"
                  className="justify-start"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Publish
                </Button>
              )}
              {(p.status === 'failed' || p.status === 'partial') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPublish(p.id)}
                  title={p.status === 'partial' ? 'Re-attempts every account (including ones that already succeeded)' : 'Re-attempts publishing to every account'}
                  className="justify-start text-amber-700 hover:text-amber-800 border-amber-300 hover:bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-900/20"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              )}
              {onRepost && (p.status === 'published' || p.status === 'partial' || p.status === 'failed') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRepost(p)}
                  title="Clone this post into a fresh draft — pre-fills caption, media, and accounts"
                  className="justify-start"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Repost
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(p.id)}
                title="Delete"
                className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// Month-grid calendar for the Scheduled tab. Plots posts with a
// `scheduled_at` onto the day they're due to publish; drafts without a
// scheduled time are surfaced as a small banner above the grid so they
// aren't silently dropped from view. Clicking a chip opens Edit.
function PostsCalendar({
  posts,
  onEdit,
  onPublish,
  onDelete,
}: {
  posts: SocialPost[]
  onEdit: (p: SocialPost) => void
  onPublish: (id: string) => void
  onDelete: (id: string) => void
}) {
  // Seed the calendar on the month of the earliest scheduled post so the
  // operator sees content immediately. Falls back to the current month
  // when nothing is scheduled.
  const [month, setMonth] = useState<Date>(() => {
    const dates = posts.map((p) => p.scheduled_at).filter(Boolean) as string[]
    if (dates.length === 0) return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const earliest = Math.min(...dates.map((d) => new Date(d).getTime()))
    const dt = new Date(earliest)
    return new Date(dt.getFullYear(), dt.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const { cells, monthLabel, unscheduledDrafts, postsByDay } = useMemo(() => {
    const year = month.getFullYear()
    const monthIdx = month.getMonth()
    const firstDay = new Date(year, monthIdx, 1)
    const lastDay = new Date(year, monthIdx + 1, 0)
    const startWeekday = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    const cells: Array<Date | null> = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIdx, d))
    while (cells.length % 7 !== 0) cells.push(null)
    const postsByDay: Record<string, SocialPost[]> = {}
    let unscheduled = 0
    for (const p of posts) {
      if (!p.scheduled_at) { unscheduled += 1; continue }
      const key = new Date(p.scheduled_at).toDateString()
      postsByDay[key] = postsByDay[key] || []
      postsByDay[key].push(p)
    }
    return {
      cells,
      monthLabel: month.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      unscheduledDrafts: unscheduled,
      postsByDay,
    }
  }, [month, posts])

  function jumpMonth(delta: number) {
    setMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1))
    setSelectedDay(null)
  }
  function jumpToToday() {
    const t = new Date()
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1))
    setSelectedDay(t.toDateString())
  }

  const todayStr = new Date().toDateString()
  const selectedPosts = selectedDay ? (postsByDay[selectedDay] || []) : []

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{monthLabel}</h3>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => jumpMonth(-1)} title="Previous month">‹</Button>
          <Button size="sm" variant="outline" onClick={jumpToToday}>Today</Button>
          <Button size="sm" variant="ghost" onClick={() => jumpMonth(1)} title="Next month">›</Button>
        </div>
      </div>

      {unscheduledDrafts > 0 && (
        <div className="text-xs px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-200">
          {unscheduledDrafts} draft{unscheduledDrafts === 1 ? '' : 's'} without a scheduled time — switch to <strong>List</strong> view to see them.
        </div>
      )}

      <div>
        <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={i} className="min-h-[88px] rounded-md bg-gray-50 dark:bg-gray-900/30" />
            }
            const key = cell.toDateString()
            const dayPosts = postsByDay[key] || []
            const isToday = key === todayStr
            const isSelected = key === selectedDay
            const isPast = cell.getTime() < new Date(new Date().toDateString()).getTime()
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : key)}
                className={cn(
                  'min-h-[88px] rounded-md border p-1.5 text-left transition-colors flex flex-col gap-1',
                  isSelected
                    ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900/40 bg-primary-50/50 dark:bg-primary-900/15'
                    : isToday
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10'
                      : isPast
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700',
                )}
              >
                <div className={cn(
                  'text-[11px] font-semibold',
                  isToday ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200'
                )}>
                  {cell.getDate()}
                </div>
                <div className="flex flex-col gap-0.5 min-h-0">
                  {dayPosts.slice(0, 3).map((p) => {
                    const time = new Date(p.scheduled_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    const firstPlatform = p.accounts?.[0]?.platform
                    const meta = firstPlatform ? PLATFORM_META[firstPlatform] : null
                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onEdit(p) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit(p) } }}
                        className={cn(
                          'group/chip flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer',
                          meta ? cn(meta.color, 'text-white') : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                        )}
                        title={`${time} · ${p.content.slice(0, 80)}${p.content.length > 80 ? '…' : ''}`}
                      >
                        <span className="font-semibold flex-shrink-0">{time}</span>
                        <span className="truncate opacity-90">{p.content.replace(/\s+/g, ' ').slice(0, 24)}</span>
                      </div>
                    )
                  })}
                  {dayPosts.length > 3 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1.5">
                      +{dayPosts.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected-day detail — a list of full post cards so the operator
          can act (edit/publish/delete) without leaving the calendar. */}
      {selectedDay && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {new Date(selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>
          {selectedPosts.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">No posts scheduled for this day.</p>
          ) : (
            selectedPosts
              .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
              .map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {new Date(p.scheduled_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <StatusPill status={p.status} />
                      <div className="flex items-center gap-1">
                        {p.accounts?.map((a) => {
                          const m = PLATFORM_META[a.platform]
                          const Icon = m?.icon
                          return Icon ? (
                            <span key={a.id} className={cn('h-4 w-4 rounded-full inline-flex items-center justify-center text-white', m.color)}>
                              <Icon className="h-2.5 w-2.5" />
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words line-clamp-3">
                      {p.content}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => onEdit(p)} className="justify-start">
                      <PencilLine className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onPublish(p.id)} className="justify-start">
                      <Send className="h-3 w-3 mr-1" /> Publish
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)} className="justify-start text-red-600 hover:text-red-700">
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </Card>
  )
}
