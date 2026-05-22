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
  MessageSquare,
  MessageCircle,
  Users,
  Link2,
  ArrowUpRight,
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
  // The exact image prompt sent to the renderer for this item — captured
  // by /generate-batch (per-caption derivation OR the master guide). Null
  // for older rows generated before the column landed.
  image_prompt: string | null
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
// Categories are scoped to GritSync's NCLEX-processing service + the
// marketing that surrounds it. 'visa' and 'lifestyle' were dropped —
// those topics belong to a broader migration agency, not our NCLEX
// processing focus. 'service' is the new category for posts that
// explain a specific GritSync service or perk.
type TemplateCategory = 'success' | 'education' | 'service' | 'motivation' | 'cta' | 'bts'

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
  // ── Success / Marketing ────────────────────────────────────────────
  {
    id: 'nclex-passer-spotlight', label: 'NCLEX Passer Spotlight', emoji: '🎉',
    category: 'success',
    description: 'Celebrate a Filipino nurse who just passed the NCLEX-RN.',
    brief: 'Celebrate an anonymized Filipino nurse who just passed the NCLEX-RN with GritSync\'s processing support. Acknowledge the long road. Position GritSync as the partner who handled the application paperwork so they could focus on studying. End with a soft CTA — start your NCLEX journey at gritsync.com.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse holding a tablet with a green "PASS" indicator, eyes lit up with quiet relief.`,
    gradient: 'bg-gradient-to-br from-amber-200 via-rose-200 to-rose-300', ad_ready: true,
  },
  {
    id: 'day-in-the-life-usrn', label: 'USRN Dream — Day in the Life', emoji: '🩺',
    category: 'success',
    description: 'Aspirational scene of a Filipino USRN on the job.',
    brief: 'Paint a specific scene from a Filipino USRN\'s workday — first patient handoff, lunch with co-workers, end-of-shift moment. Relatable, never boastful. End by reminding readers the journey starts with the NCLEX, and GritSync handles that processing end-to-end.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino USRN walking through a modern US hospital corridor at golden-hour sunrise.`,
    gradient: 'bg-gradient-to-br from-orange-200 via-amber-200 to-amber-300', ad_ready: true,
  },

  // ── NCLEX Education (process-focused only — no CGFNS/VisaScreen/visa) ──
  {
    id: 'nclex-application-walkthrough', label: 'NCLEX Application Walkthrough', emoji: '🧭',
    category: 'education',
    description: 'Step-by-step walkthrough of the NCLEX-RN application.',
    brief: 'Walk a Filipino nurse through the NCLEX-RN application end-to-end in plain language: pick a state Board of Nursing, register for NCLEX, submit credentials, wait for eligibility, receive the ATT, schedule the exam. Keep it general — no fabricated timelines. End with: GritSync handles every step for you.',
    image_prompt: `${BRAND_IMAGE_BASE} Overhead view of a Filipino nurse's desk with an open NCLEX application checklist, passport, pen, coffee mug.`,
    gradient: 'bg-gradient-to-br from-blue-200 via-indigo-200 to-indigo-300', ad_ready: false,
  },
  {
    id: 'att-explainer', label: 'What is the ATT?', emoji: '📨',
    category: 'education',
    description: 'Explain the Authorization to Test (ATT) and how to get it.',
    brief: 'Demystify the ATT (Authorization to Test) for the NCLEX-RN: what it is, when it arrives, how long it\'s valid, what triggers it. Plain language. Mention that GritSync tracks ATT issuance for clients so they can book Pearson VUE the moment it lands.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse checking a laptop email inbox with a highlighted "Authorization to Test" notification.`,
    gradient: 'bg-gradient-to-br from-sky-200 via-blue-200 to-blue-300', ad_ready: false,
  },
  {
    id: 'eligibility-explainer', label: 'NCLEX Eligibility 101', emoji: '✅',
    category: 'education',
    description: 'Who can apply for the NCLEX-RN as a Filipino-trained nurse?',
    brief: 'Plain-language explainer of NCLEX-RN eligibility for Filipino-trained RNs: PRC license requirement, BSN equivalency, English competency. Avoid fabricated state-by-state rules — keep it general. End by inviting a free eligibility check with GritSync.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse smiling at a desk holding their PRC license folder.`,
    gradient: 'bg-gradient-to-br from-emerald-200 via-teal-200 to-teal-300', ad_ready: false,
  },
  {
    id: 'document-checklist-nclex', label: 'NCLEX Document Checklist', emoji: '📁',
    category: 'education',
    description: 'Documents Filipino nurses need to register for the NCLEX.',
    brief: 'List the documents a Filipino RN typically needs to register for NCLEX-RN: PRC license, transcripts, course-by-course evaluation, photo ID, application fees. Short bullet phrases. Note the most-commonly-missing item. End with: GritSync prepares + submits all of this for you.',
    image_prompt: `${BRAND_IMAGE_BASE} Top-down photo of a neat stack of NCLEX-application documents on a wood desk.`,
    gradient: 'bg-gradient-to-br from-yellow-200 via-amber-200 to-orange-300', ad_ready: false,
  },
  {
    id: 'common-application-mistakes', label: 'Common NCLEX Application Mistakes', emoji: '⚠️',
    category: 'education',
    description: 'Top mistakes Filipino nurses make filing for NCLEX.',
    brief: 'List 3-4 common mistakes Filipino nurses make when filing for the NCLEX-RN: wrong transcript routing, name mismatches between PRC and passport, missing eval reports, expired payment authorizations. Keep it practical. End with: GritSync catches these before you pay any fee.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse looking concerned at a laptop screen, paperwork half-organised on a desk.`,
    gradient: 'bg-gradient-to-br from-red-200 via-rose-200 to-rose-300', ad_ready: false,
  },
  {
    id: 'nclex-study-tip', label: 'NCLEX Study Tip', emoji: '🧠',
    category: 'education',
    description: 'One actionable NCLEX-RN study tactic for today.',
    brief: 'Give ONE specific, actionable NCLEX-RN study tip — priority/safety filter on SATA, time-boxing Qbank sessions, mining UWorld rationales. Plain language, no clichés. End with a reminder that GritSync handles the application paperwork so you can focus on study.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse studying at a cozy desk lamp at night with an NCLEX review book open.`,
    gradient: 'bg-gradient-to-br from-indigo-200 via-purple-200 to-purple-300', ad_ready: false,
  },
  {
    id: 'processing-timeline', label: 'NCLEX Processing Timeline', emoji: '⏳',
    category: 'education',
    description: 'Realistic timeline ranges for NCLEX-RN processing.',
    brief: 'Walk through the realistic timeline for NCLEX-RN processing from application to ATT: state BON review window, credentialing eval, Pearson VUE registration. Keep ranges general — no fabricated week-by-week guarantees. Mention that GritSync\'s priority processing tightens the wait where the BON allows.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse studying a calendar with NCLEX milestones marked, tablet in hand.`,
    gradient: 'bg-gradient-to-br from-cyan-200 via-sky-200 to-sky-300', ad_ready: false,
  },
  {
    id: 'state-bon-selection', label: 'Picking a State Board for NCLEX', emoji: '🗺️',
    category: 'education',
    description: 'How to choose the state Board of Nursing for your NCLEX application.',
    brief: 'Explain the considerations when picking a state Board of Nursing for NCLEX-RN application: BON friendliness toward foreign-educated nurses (in general terms), processing speed, future endorsement plans. Avoid fabricated state rankings. End with: GritSync helps you match the right BON to your profile.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse looking at a US map on a tablet at a clean modern desk.`,
    gradient: 'bg-gradient-to-br from-sky-200 via-cyan-200 to-blue-300', ad_ready: false,
  },
  {
    id: 'red-flag-processors', label: 'Red-Flag Processing "Agents"', emoji: '🚩',
    category: 'education',
    description: 'Spotting sketchy NCLEX processing services.',
    brief: 'Walk Filipino nurses through 3-4 red flags when evaluating an NCLEX processing service: upfront non-refundable fees, vague timelines, "guaranteed pass" claims, pressure tactics. Plain language. Position GritSync as the transparent, no-hidden-fee alternative — without naming competitors.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse looking thoughtfully at a laptop screen with a vague email open.`,
    gradient: 'bg-gradient-to-br from-red-200 via-orange-200 to-rose-300', ad_ready: false,
  },

  // ── GritSync Service / Perks ───────────────────────────────────────
  {
    id: 'dont-go-alone', label: 'Don\'t Go Alone', emoji: '🤝',
    category: 'service',
    description: 'Why an NCLEX processing agency beats DIY.',
    brief: 'Make the case for using a processing agency over filing solo: the documents are exacting, the timelines are tight, the costs of resubmission stack up fast. Honest framing — agencies aren\'t magic, they\'re structure. End with: GritSync gives you that structure.',
    image_prompt: `${BRAND_IMAGE_BASE} Two Filipino professionals at a clean modern desk reviewing a printed checklist together.`,
    gradient: 'bg-gradient-to-br from-violet-200 via-purple-200 to-fuchsia-300', ad_ready: true,
  },
  {
    id: 'service-explainer', label: 'What GritSync Handles', emoji: '🧾',
    category: 'service',
    description: 'End-to-end overview of the GritSync NCLEX-processing service.',
    brief: 'Plain-language overview of what GritSync handles for clients: NCLEX application processing, document preparation + submission, eligibility + requirement checking, ATT tracking + assistance, end-to-end NCLEX journey support. Concrete bullets. End with: book a free assessment at gritsync.com.',
    image_prompt: `${BRAND_IMAGE_BASE} Top-down flatlay of a clean desk with NCLEX paperwork, a passport, laptop, and small GritSync notebook.`,
    gradient: 'bg-gradient-to-br from-primary-200 via-primary-300 to-primary-400', ad_ready: true,
  },
  {
    id: 'gritsync-perks-rundown', label: 'GritSync Exclusive Perks', emoji: '✨',
    category: 'service',
    description: 'The 4 perks every GritSync client gets.',
    brief: 'List the four exclusive perks every GritSync client gets: Free Business Email Setup, Application Guidance System, Priority Processing Assistance, Personalized NCLEX Roadmap. One short sentence per perk explaining the concrete benefit. End with: get yours at gritsync.com/quote.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse smiling on a video call at a clean modern home desk, laptop open with unreadable screen.`,
    gradient: 'bg-gradient-to-br from-fuchsia-200 via-pink-200 to-rose-300', ad_ready: true,
  },
  {
    id: 'personalized-roadmap', label: 'Personalized NCLEX Roadmap', emoji: '🧭',
    category: 'service',
    description: 'The Personalized NCLEX Roadmap perk explained.',
    brief: 'Explain the Personalized NCLEX Roadmap perk: a per-client step-by-step plan calibrated to their profile (PH license stage, target state, study readiness). Why a generic checklist isn\'t enough. End with a soft CTA to get yours via gritsync.com/quote.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse reviewing a printed roadmap document at a modern desk, soft warm light.`,
    gradient: 'bg-gradient-to-br from-teal-200 via-emerald-200 to-green-300', ad_ready: false,
  },
  {
    id: 'priority-processing', label: 'Priority Processing Assistance', emoji: '⚡',
    category: 'service',
    description: 'The Priority Processing perk explained.',
    brief: 'Explain the Priority Processing Assistance perk: GritSync coordinates faster turnarounds + same-day updates with the state BON where the BON allows it. Honest framing — agencies cannot override BON queues, but they can keep clients out of preventable delay loops.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino professional at a desk with multiple monitors showing application status dashboards.`,
    gradient: 'bg-gradient-to-br from-amber-200 via-yellow-200 to-orange-300', ad_ready: false,
  },
  {
    id: 'business-email-perk', label: 'Free Business Email Setup', emoji: '📧',
    category: 'service',
    description: 'The Free Business Email Setup perk explained.',
    brief: 'Explain why GritSync sets up a free professional business email for clients: looks professional to US recruiters + state BONs, separates NCLEX correspondence from personal inbox, easier ATT + scheduling notifications.',
    image_prompt: `${BRAND_IMAGE_BASE} Close-up of a laptop screen showing a clean professional inbox setup, Filipino nurse hand on the trackpad.`,
    gradient: 'bg-gradient-to-br from-blue-200 via-sky-200 to-cyan-300', ad_ready: false,
  },
  {
    id: 'why-gritsync', label: 'Why GritSync', emoji: '🛡️',
    category: 'service',
    description: 'What makes GritSync different from other processors.',
    brief: 'Make the positioning case for GritSync: NCLEX-only focus (not a generic migration agency), transparent pricing, structured roadmap per client, dedicated processing support. Avoid trashing competitors by name.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino professional smiling confidently in front of a clean modern office space with subtle red/white branding.`,
    gradient: 'bg-gradient-to-br from-rose-200 via-red-200 to-red-300', ad_ready: true,
  },

  // ── Motivation (brand voice) ───────────────────────────────────────
  {
    id: 'encouragement', label: 'Quiet Encouragement', emoji: '💪',
    category: 'motivation',
    description: 'Warm, specific pep talk for nurses mid-NCLEX prep.',
    brief: 'Write a warm, specific encouragement for Filipino nurses in the middle of NCLEX-RN application or prep — name the hard moments (long shifts, slow paperwork, family pressure) without melodrama. Keep it short. Close with GritSync standing alongside them.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse in scrubs leaning against a hospital wall during a break, soft late-afternoon light.`,
    gradient: 'bg-gradient-to-br from-pink-200 via-rose-200 to-rose-400', ad_ready: false,
  },
  {
    id: 'one-step-at-a-time', label: 'One Step at a Time', emoji: '🪜',
    category: 'motivation',
    description: 'Break the NCLEX road into doable steps.',
    brief: 'Encourage Filipino nurses overwhelmed by the NCLEX process by reframing it as a sequence of small, doable steps — application, eligibility, ATT, study, exam. Quick example of the typical month-by-month rhythm in general terms. End with GritSync as the partner that breaks it down for you.',
    image_prompt: `${BRAND_IMAGE_BASE} Wide shot of a Filipino nurse walking up a softly lit modern stairwell, calm and steady.`,
    gradient: 'bg-gradient-to-br from-teal-200 via-emerald-200 to-green-300', ad_ready: false,
  },

  // ── Calls to action ────────────────────────────────────────────────
  {
    id: 'free-assessment-cta', label: 'Free Assessment CTA', emoji: '🎯',
    category: 'cta',
    description: 'Direct invite to book a free NCLEX assessment.',
    brief: 'Direct invite for Filipino nurses to book a free GritSync NCLEX assessment — a one-hour review of their current documents + readiness to file. Lead with the outcome (catch gaps before $$ goes out). Single clear next step. Honest claims only.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino GritSync advisor walking through a printed NCLEX checklist with a client, both at a clean modern desk.`,
    gradient: 'bg-gradient-to-br from-primary-200 via-primary-300 to-primary-500', ad_ready: true,
  },
  {
    id: 'quote-cta', label: 'Get Your Quote', emoji: '💬',
    category: 'cta',
    description: 'Drive operators to gritsync.com/quote.',
    brief: 'Direct CTA inviting Filipino nurses to get their official GritSync NCLEX processing quote at gritsync.com/quote. Lead with clarity (no hidden fees, no guesswork). One clear next step.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse smiling at a phone showing a clean website page, warm modern home setting.`,
    gradient: 'bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-400', ad_ready: true,
  },
  {
    id: 'free-consult-cta', label: 'Free Consultation', emoji: '📞',
    category: 'cta',
    description: 'Book a free GritSync NCLEX consultation.',
    brief: 'Direct invite to book a free GritSync NCLEX consultation — clear roadmap, no guesswork. Lead with the outcome. Honest claims only — no guarantees of outcomes or timelines.',
    image_prompt: `${BRAND_IMAGE_BASE} Filipino nurse on a friendly video call at a clean desk, light headset visible.`,
    gradient: 'bg-gradient-to-br from-emerald-200 via-teal-200 to-cyan-300', ad_ready: true,
  },

  // ── Behind the scenes ──────────────────────────────────────────────
  {
    id: 'behind-the-scenes', label: 'Behind the Scenes', emoji: '👥',
    category: 'bts',
    description: 'Show the GritSync NCLEX-processing workflow.',
    brief: 'Warm behind-the-scenes post about a GritSync NCLEX-processing workflow — a document review session, an ATT-tracking checkpoint, the team double-checking a state-BON submission. No fake testimonials, no named clients. End with: this hands-on care is what you get when you work with GritSync.',
    image_prompt: `${BRAND_IMAGE_BASE} Two Filipino GritSync staff at a clean modern desk reviewing a printed checklist together.`,
    gradient: 'bg-gradient-to-br from-slate-200 via-gray-200 to-gray-300', ad_ready: false,
  },
  {
    id: 'team-spotlight', label: 'Team Spotlight', emoji: '⭐',
    category: 'bts',
    description: 'Meet a GritSync NCLEX processor.',
    brief: 'Warm spotlight on a GritSync NCLEX processor (role + what they do for clients) without revealing private details. Highlight the human at the other end of the email. End with: a real Filipino-nurse-friendly team is behind every submission.',
    image_prompt: `${BRAND_IMAGE_BASE} Editorial portrait of a Filipino professional at a clean modern desk (face partially turned to protect identity).`,
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

// ─── Image templates ──────────────────────────────────────────────────
// Operator-managed library of (name, prompt, preview) templates that
// drive image generation. Selecting a template writes its prompt into
// the legacy `gritsync_socmed_master_image_prompt` key so Manager and
// any other consumer of `readMasterImagePrompt()` stay in sync.
interface ImageTemplate {
  id: string
  name: string
  prompt: string
  preview_url: string | null
  preview_status: 'pending' | 'available' | 'failed'
  preview_error: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

const SELECTED_IMAGE_TEMPLATE_ID_KEY = 'gritsync_socmed_selected_image_template_id'

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

// ─── Master caption format ────────────────────────────────────────────
// The structural blueprint every generated caption follows — 11 sections
// (hook → self-check → reframe → solution → perks → vision → authority →
// decision → CTA → sign-off → hashtags). Operator can edit + AI-refine
// from Compose; saved overrides persist in localStorage and reach both
// Compose's manual generate and the Manager's autonomous Generate Now.
//
// Paired with `length: 'long'` everywhere — the format only fits when
// the model has enough headroom to cover all 11 sections.
const MASTER_CAPTION_FORMAT_STORAGE_KEY = 'gritsync_socmed_master_caption_format'

const DEFAULT_MASTER_CAPTION_FORMAT = `1. HOOK (THOUGHT-PROVOKING + QUESTIONS)

Have you ever asked yourself bakit parang sobrang complicated ng USRN journey kahit alam mong kaya mo naman maging US Registered Nurse?

Or baka ito ang real question:

👉 Ano ba talaga ang humaharang sa'yo para simulan ang NCLEX journey mo ngayon?

For many Filipino nurses, klaro ang dream—pero confusing ang process.

2. SELF-CHECK / AWARENESS QUESTIONS

Kung ikaw ay:

- nagbabalak mag-NCLEX pero hindi alam saan magsisimula
- nalilito sa requirements at steps
- nag-aantay ng "right time"
- o natatakot magkamali sa application process

Tanungin mo sarili mo:

👉 Alam ko ba talaga ang step-by-step NCLEX process?
👉 Or nag-i-stuck lang ako kasi wala akong proper guidance?
👉 Ilang months or years na ba akong nagre-research pero wala pa ring progress?

Most of the time, hindi lack of ability ang issue—kundi lack of structure.

3. PROBLEM REFRAME (INSIGHTFUL)

What if hindi ikaw ang problema?

What if ang real issue ay ginagawa mong mag-isa ang isang process na dapat guided?

NCLEX application can feel overwhelming kapag walang system.

So the real question is:

👉 Gusto mo bang magpatuloy mag-isa?
👉 Or gusto mo ng guided, step-by-step NCLEX processing support?

4. GRITSYNC SOLUTION (NCLEX PROCESSING ONLY)

At GritSync NCLEX Processing Agency, we help Filipino nurses magkaroon ng clear at structured pathway papuntang USRN via NCLEX.

Hindi ka namin hinahayaan manghula kung ano ang next step.

We guide you step-by-step sa:

- NCLEX application processing
- Document preparation and submission guidance
- Eligibility and requirement checking
- ATT tracking and assistance
- End-to-end NCLEX journey support

So instead na stress at confusion, clarity at direction ang meron ka.

5. GRITSYNC PERKS (ADDED VALUE SECTION)

When you start your journey with GritSync, you also get exclusive support perks:

✨ Free Business Email Setup (for professional use abroad preparation)
✨ Application Guidance System (step-by-step tracking support)
✨ Priority Processing Assistance (faster coordination & updates)
✨ Personalized NCLEX Roadmap (based on your profile and stage)

Plus:

👉 Get your official quote here:
🌐 www.gritsync.com/quote

6. FUTURE VISION (EMOTIONAL + QUESTIONS)

Try to imagine this:

Nasa US ka na, working as a Registered Nurse.

👉 How different would your life feel?
👉 Paano mababago ang buhay ng family mo?
👉 Gaano ka kalaki yung peace of mind kapag stable ka na?
👉 At ano kaya ang mangyayari kung nagsimula ka na ngayon instead of later?

Sometimes, the only difference between "someday" and "now" is action.

7. AUTHORITY + TRUST MESSAGE

GritSync is built to make your NCLEX journey clear, structured, and less stressful.

We don't overcomplicate things—we organize the process so you can focus on your goal.

Because the real risk is not starting late—

It is starting without guidance.

8. DECISION QUESTIONS (CONVERSION TRIGGER)

So ngayon, tanungin mo sarili mo:

👉 Ready ka na ba mag-start ng NCLEX journey mo?
👉 Or magpapatuloy ka pa rin sa pagkalito at waiting game?
👉 Ano pa bang kailangan mo bago ka mag-decide mag-move forward?

9. CALL TO ACTION (CLEAR + DIRECT)

If ready ka na, we are here to guide you.

👉 Get your FREE assessment today
👉 Start your NCLEX processing with expert support
👉 Request your quote here: www.gritsync.com/quote
👉 Message us now to begin your USRN journey

10. BRAND SIGN-OFF

GritSync NCLEX Processing Agency
🌐 gritsync.com

11. HASHTAGS

#USRN #NCLEX #FilipinoNurses #NursingCareer #USRNJourney #NurseLife #HealthcareCareers #NCLEXJourney #GritSync #NursesToUSA`

function readMasterCaptionFormat(): string {
  try {
    const stored = localStorage.getItem(MASTER_CAPTION_FORMAT_STORAGE_KEY)
    return (stored && stored.trim().length > 0) ? stored : DEFAULT_MASTER_CAPTION_FORMAT
  } catch {
    return DEFAULT_MASTER_CAPTION_FORMAT
  }
}
function writeMasterCaptionFormat(value: string) {
  try {
    if (value.trim() === DEFAULT_MASTER_CAPTION_FORMAT.trim()) {
      localStorage.removeItem(MASTER_CAPTION_FORMAT_STORAGE_KEY)
    } else {
      localStorage.setItem(MASTER_CAPTION_FORMAT_STORAGE_KEY, value)
    }
  } catch {
    // Same private-browsing fallback as the image-prompt helper.
  }
}


const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  success: 'NCLEX passer / success',
  education: 'NCLEX education',
  service: 'GritSync service',
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

  type SocialTab = 'manager' | 'compose' | 'bank' | 'scheduled' | 'history' | 'accounts' | 'ads' | 'autoreply' | 'groups'
  const initialTab: SocialTab = (() => {
    const t = searchParams.get('tab')
    return (['manager', 'compose', 'bank', 'scheduled', 'history', 'accounts', 'ads', 'autoreply', 'groups'] as const).includes(t as any)
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
  // Page picker that opens automatically after a Facebook OAuth completes.
  // Lets the admin uncheck Pages / IG accounts they don't want connected
  // — we DELETE the unchecked social_accounts rows on save. `open` doubles
  // as the modal trigger; null means no picker is showing.
  const [pagePicker, setPagePicker] = useState<{ open: boolean } | null>(null)
  // Pending disconnect — replaces native window.confirm() with a proper
  // modal. `meta` disconnects the whole FB+IG+ads connection; `account`
  // disconnects a single per-platform row.
  type DisconnectTarget =
    | { kind: 'meta' }
    | { kind: 'account'; id: string; label: string; platform: Platform }
  const [disconnectTarget, setDisconnectTarget] = useState<DisconnectTarget | null>(null)
  const [disconnectBusy, setDisconnectBusy] = useState(false)

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
        refresh().then(() => {
          // Open the page picker after Facebook OAuth — gives the admin
          // a single screen to keep/drop each authorized Page + linked IG.
          if (e.data.platform === 'facebook') setPagePicker({ open: true })
        })
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

  function disconnectAccount(id: string) {
    const acc = accounts.find((a) => a.id === id)
    if (!acc) return
    setDisconnectTarget({
      kind: 'account',
      id,
      label: acc.display_name || `${PLATFORM_META[acc.platform].label} account`,
      platform: acc.platform,
    })
  }

  async function confirmDisconnect() {
    if (!disconnectTarget) return
    setDisconnectBusy(true)
    try {
      if (disconnectTarget.kind === 'meta') {
        const r = await fetch('/api/social/facebook/disconnect', {
          method: 'DELETE',
          headers: { ...authHeaders() },
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
        showToast('Facebook & Instagram disconnected', 'success')
        // Tell child components to reload their derived state.
        window.dispatchEvent(new CustomEvent('gritsync-accounts-changed'))
      } else {
        await api(`/accounts/${disconnectTarget.id}`, { method: 'DELETE' })
        showToast(`${disconnectTarget.label} disconnected`, 'success')
      }
      setDisconnectTarget(null)
      refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect', 'error')
    } finally {
      setDisconnectBusy(false)
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

  async function regenerateBankItemImage(
    id: string,
    image_prompt: string,
    provider?: 'openai' | 'nano-banana' | 'grok' | 'kling'
  ): Promise<BankItem> {
    const updated = await api<BankItem>(`/ai/content-bank/${id}/regenerate-image`, {
      method: 'POST',
      body: JSON.stringify({ image_prompt, provider }),
    })
    setBank((cur) => cur.map((it) => (it.id === id ? { ...it, ...updated } : it)))
    return updated
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
                { id: 'autoreply', label: 'AutoReply', count: null },
                { id: 'groups', label: 'Groups', count: null },
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
              onRegenerateImage={regenerateBankItemImage}
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
          ) : tab === 'autoreply' ? (
            <AutoReplyView showToast={showToast} hasMetaAccounts={accounts.some((a) => a.platform === 'facebook' || a.platform === 'instagram')} />
          ) : tab === 'groups' ? (
            <GroupsView showToast={showToast} />
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
              onConnect={startOAuth}
              onManual={(p) => { setConnectPlatform(p); setManualForm({ display_name: '', platform_user_id: '', access_token: '', refresh_token: '', profile_url: '', avatar_url: '' }) }}
              onDisconnect={disconnectAccount}
              onChoosePages={() => setPagePicker({ open: true })}
              onMetaDisconnect={() => setDisconnectTarget({ kind: 'meta' })}
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

      {/* Post-OAuth Page Picker — opens automatically after a Facebook OAuth
          completes so the admin can choose which Pages and linked Instagram
          accounts stay connected. Unchecked rows are removed via the same
          DELETE /accounts/:id used by the per-card disconnect button. */}
      <PagePickerModal
        open={!!pagePicker?.open}
        accounts={accounts}
        onClose={() => setPagePicker(null)}
        onSaved={() => { setPagePicker(null); refresh() }}
        showToast={showToast}
      />

      {/* Unified disconnect confirm — replaces native window.confirm() so
          the admin gets a calm modal with context-specific impact copy. */}
      <DisconnectConfirmModal
        target={disconnectTarget}
        accounts={accounts}
        busy={disconnectBusy}
        onCancel={() => { if (!disconnectBusy) setDisconnectTarget(null) }}
        onConfirm={confirmDisconnect}
      />

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

// ─── Page Picker (post-OAuth) ─────────────────────────────────────────────
// After a Facebook OAuth completes the backend has saved every Page +
// linked IG Business account the admin authorized. This modal pops up
// so they can prune the list — uncheck rows they don't want connected
// and save. Unchecked rows are deleted via DELETE /accounts/:id (the
// same path the per-card Disconnect uses), so leftover state can never
// drift from what the admin sees.
function PagePickerModal({
  open,
  accounts,
  onClose,
  onSaved,
  showToast,
}: {
  open: boolean
  accounts: SocialAccount[]
  onClose: () => void
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  // The pickable rows are every FB page + every IG account currently saved.
  // We filter out the synthetic fbuser:* row (it's not a publishing target).
  const metaAccounts = useMemo(
    () => accounts.filter(
      (a) => (a.platform === 'facebook' || a.platform === 'instagram') && !a.platform_user_id.startsWith('fbuser:')
    ),
    [accounts]
  )
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Reset selection every time the picker opens — default to "keep all".
  useEffect(() => {
    if (open) setChecked(new Set(metaAccounts.map((a) => a.id)))
  }, [open, metaAccounts])

  const toggle = (id: string) => {
    setChecked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const toDelete = metaAccounts.filter((a) => !checked.has(a.id))
      for (const a of toDelete) {
        await api(`/accounts/${a.id}`, { method: 'DELETE' })
      }
      if (toDelete.length > 0) {
        showToast(`Removed ${toDelete.length} unselected page${toDelete.length === 1 ? '' : 's'}`, 'success')
      } else {
        showToast('All authorized pages kept', 'success')
      }
      onSaved()
    } catch (err: any) {
      showToast(err.message || 'Failed to update pages', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Choose pages to connect"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You authorized {metaAccounts.length} {metaAccounts.length === 1 ? 'page or account' : 'pages and accounts'}.
          Untick anything you don't want GritSync to post to — those rows will be removed. You can reconnect anytime
          to bring them back.
        </p>

        {metaAccounts.length === 0 ? (
          <div className="text-sm text-amber-700 dark:text-amber-300 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            No Facebook Pages or Instagram Business accounts were authorized. Reconnect and tick the Pages you want
            in the Facebook consent dialog.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {metaAccounts.map((a) => {
              const isFb = a.platform === 'facebook'
              const Icon = isFb ? Facebook : Instagram
              const colorBg = isFb ? 'bg-blue-600' : 'bg-pink-600'
              const isChecked = checked.has(a.id)
              return (
                <label
                  key={a.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors',
                    isChecked
                      ? 'border-primary-300 bg-primary-50/50 dark:bg-primary-900/10 dark:border-primary-700'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0', colorBg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {a.display_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                      {isFb ? 'Facebook Page' : 'Instagram Business'} · {a.platform_user_id}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Skip</Button>
          <Button onClick={save} loading={saving} disabled={saving || metaAccounts.length === 0}>
            Save {checked.size} of {metaAccounts.length}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Disconnect confirm modal ─────────────────────────────────────────────
// One modal for every disconnect surface (single account row OR the whole
// Meta connection). Shows context-specific impact copy ("X scheduled posts
// use this account", "Disconnect 3 Pages + 1 IG") so the admin knows
// what's about to vanish. Replaces native window.confirm() which broke
// the visual flow and looked like a phishing dialog on some browsers.
function DisconnectConfirmModal({
  target,
  accounts,
  busy,
  onCancel,
  onConfirm,
}: {
  target:
    | { kind: 'meta' }
    | { kind: 'account'; id: string; label: string; platform: Platform }
    | null
  accounts: SocialAccount[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  // Pre-compute impact details so the modal renders the right copy
  // even on the first paint (no async lookups inside the modal).
  const meta = useMemo(() => {
    if (!target) return null
    if (target.kind === 'meta') {
      const fb = accounts.filter((a) => a.platform === 'facebook' && !a.platform_user_id.startsWith('fbuser:'))
      const ig = accounts.filter((a) => a.platform === 'instagram')
      return {
        title: 'Disconnect Facebook & Instagram?',
        body: `This will remove ${fb.length} Facebook Page${fb.length === 1 ? '' : 's'}, ${ig.length} Instagram account${ig.length === 1 ? '' : 's'}, and your ad-account access. You can reconnect anytime.`,
        confirmLabel: 'Disconnect all',
      }
    }
    return {
      title: `Disconnect ${target.label}?`,
      body: `${PLATFORM_META[target.platform].label} posting from this account will stop. Scheduled or draft posts that target this account will fail when they fire. You can reconnect anytime.`,
      confirmLabel: 'Disconnect',
    }
  }, [target, accounts])

  return (
    <Modal isOpen={!!target} onClose={onCancel} title={meta?.title || ''} size="sm">
      {meta && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {meta.body}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button
              onClick={onConfirm}
              loading={busy}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {meta.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </Modal>
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
// Facebook card — primary login surface for the Meta OAuth. One log in
// here grants posting to every Page the admin manages plus any linked
// IG Business accounts (rendered in InstagramCard below).
function FacebookCard({
  status,
  busy,
  oauthReady,
  onConnect,
  onDisconnect,
  onChoosePages,
}: {
  status: MetaConnectionStatus | null
  busy: boolean
  oauthReady: boolean | undefined
  onConnect: () => void
  onDisconnect: () => void
  // Opens the post-OAuth page-picker modal so the admin can prune which
  // Pages stay connected without re-running OAuth.
  onChoosePages: () => void
}) {
  if (status === null) {
    return (
      <Card className="p-4"><div className="text-sm text-gray-500 dark:text-gray-400">Loading…</div></Card>
    )
  }

  const oauthBlocked = oauthReady === false
  const connected = !!status.connected
  const pages = status.pages || []

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white flex-shrink-0', PLATFORM_META.facebook.color)}>
          <Facebook className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Facebook</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {connected
              ? `Logged in as ${status.fb_user_name || 'Meta user'}`
              : oauthBlocked
                ? 'Login unavailable — server setup needed'
                : 'Log in to authorize your Pages'}
          </div>
        </div>
        {connected ? (
          <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={busy} className="text-red-600 hover:text-red-700">
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={onConnect} loading={busy} disabled={busy || oauthBlocked}>
            Log in
          </Button>
        )}
      </div>

      {connected && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-[11px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Authorized pages
          </div>
          {pages.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pages.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200" title={p.id}>
                  <Facebook className="h-3 w-3" /> {p.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              No Pages authorized. Reconnect and tick the Pages you want to post to.
            </div>
          )}
          {connected && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <button
                onClick={onChoosePages}
                className="text-primary-600 dark:text-primary-300 hover:underline"
              >
                Choose pages
              </button>
              <button
                onClick={onConnect}
                disabled={busy}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Reconnect to add more
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// (InstagramCard removed — IG is now wired through its own Instagram Login
//  OAuth flow at /oauth/instagram/start, so it's rendered by SimplePlatformCard
//  just like Threads/LinkedIn/etc. The legacy via-Facebook IG rows still
//  publish correctly because publishToPlatform dispatches by metadata.kind.)

// Uniform per-platform card used across the Accounts grid. Same shape
// whether disconnected, connected, or OAuth-blocked: logo, name, status
// line, one primary action. Secondary actions (reconnect, refresh token,
// manual entry) live as small text links so they don't fight for attention.
function SimplePlatformCard({
  platform,
  account,
  oauthStatus,
  onConnect,
  onManual,
  onDisconnect,
  onRefreshToken,
  busy,
}: {
  platform: Platform
  account: SocialAccount | null
  oauthStatus: OAuthStatus | undefined
  onConnect: () => void
  onManual: () => void
  onDisconnect: (id: string) => void
  onRefreshToken?: () => void
  busy?: boolean
}) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const oauthReady = oauthStatus?.oauth_ready ?? true
  const connected = !!account

  const statusLine = connected
    ? `Logged in as ${account!.display_name || 'connected'}`
    : !oauthReady
      ? 'Login unavailable — paste a token instead'
      : `Log in with ${meta.label}`

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white flex-shrink-0', meta.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {meta.label}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {statusLine}
          </div>
        </div>
        {connected ? (
          <Button size="sm" variant="ghost" onClick={() => onDisconnect(account!.id)} disabled={busy} className="text-red-600 hover:text-red-700">
            Disconnect
          </Button>
        ) : oauthReady ? (
          <Button size="sm" onClick={onConnect} loading={busy} disabled={busy}>
            Log in
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onManual}>
            Use token
          </Button>
        )}
      </div>

      {connected && account?.last_error && (
        <div className="mt-3 text-xs p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300">
          <AlertCircle className="inline h-3 w-3 mr-1" />
          {account.last_error}
        </div>
      )}

      {connected && (onRefreshToken || account?.profile_url) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 text-xs">
          {account?.profile_url && (
            <a
              href={account.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <ExternalLink className="h-3 w-3" /> Open profile
            </a>
          )}
          {onRefreshToken && (
            <button
              onClick={onRefreshToken}
              disabled={busy}
              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <RefreshCw className={cn('h-3 w-3', busy && 'animate-spin')} /> Refresh token
            </button>
          )}
          <button
            onClick={onConnect}
            disabled={busy}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-auto"
          >
            Reconnect
          </button>
        </div>
      )}
    </Card>
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
  { title: 'NCLEX application step-by-step for Filipino nurses',                   brief: 'Plain-language walkthrough of the NCLEX-RN application from picking a state Board to getting your ATT. Position GritSync as the partner who handles every step.',                                       tag: 'NCLEX' },
  { title: 'What is the ATT and how do you get it?',                               brief: 'Demystify the Authorization to Test for Filipino nurses: what it is, when it arrives, validity window. Mention GritSync\'s ATT tracking + booking assistance.',                                  tag: 'NCLEX' },
  { title: 'Why use an NCLEX processing agency vs filing solo',                    brief: 'Make the case for using a processing agency: tight timelines, exacting documents, the cost of resubmission. Honest framing — GritSync gives structure, not magic.',                                tag: 'Service' },
  { title: 'Common NCLEX application mistakes (and how to avoid them)',            brief: '3-4 mistakes Filipino nurses make: wrong transcript routing, PRC/passport name mismatches, missing eval reports. End with: GritSync catches these before you pay any fee.',                          tag: 'NCLEX' },
  { title: 'GritSync exclusive perks for clients',                                 brief: 'Free Business Email Setup, Application Guidance System, Priority Processing Assistance, Personalized NCLEX Roadmap. One concrete benefit per perk. CTA to gritsync.com/quote.',                       tag: 'Service' },
  { title: 'How to pick a state Board of Nursing for your NCLEX',                  brief: 'Considerations when choosing a state BON for NCLEX-RN application: foreign-nurse friendliness in general terms, processing speed, endorsement plans. GritSync helps match BON to profile.',          tag: 'NCLEX' },
  { title: 'Red flags when shopping for an NCLEX processor',                       brief: 'Upfront non-refundable fees, vague timelines, "guaranteed pass" claims, pressure tactics. Position GritSync as the transparent, no-hidden-fee alternative.',                                          tag: 'Marketing' },
  { title: 'Book your free GritSync NCLEX assessment',                             brief: 'Direct CTA inviting Filipino nurses to book a free assessment with GritSync — one-hour review of documents + readiness to file. Catch gaps before any fee goes out.',                                tag: 'Marketing' },
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

  // ── Agent decision-making ──────────────────────────────────────────
  // `decideAgentPlan()` is the brain behind the "Generate Now" button:
  // the agent picks topic, goal, audience, and tone instead of leaving
  // the choice to the operator. Decisions are dynamic — we avoid topics
  // covered in recent posts, rotate goals across the week, match
  // audience to the topic's tag, and rotate tone across the day so a
  // single operator clicking Generate Now repeatedly gets variety.
  interface AgentPlan {
    topic: typeof TRENDING_TOPIC_IDEAS[number]
    goal: CampaignGoal
    audience: AudiencePreset
    tone: string
    length: 'short' | 'medium' | 'long'
    language: 'taglish' | 'english' | 'filipino'
    reasoning: string
  }
  function decideAgentPlan(): AgentPlan {
    // Topic: skip ideas whose tag or title fragment appears in any of
    // the last 10 posts so the feed doesn't repeat itself. Fall back
    // to the full list if everything's been used recently.
    const recentBlob = posts.slice(0, 10).map((p) => (p.content || '').toLowerCase()).join(' ')
    const fresh = TRENDING_TOPIC_IDEAS.filter((t) => {
      const tagHit = recentBlob.includes(t.tag.toLowerCase())
      const titleHit = recentBlob.includes(t.title.toLowerCase().slice(0, 20))
      return !tagHit && !titleHit
    })
    const pool = fresh.length > 0 ? fresh : TRENDING_TOPIC_IDEAS
    const topic = pool[Math.floor(Math.random() * pool.length)]

    // Goal: rotate across the week (day-of-week index into the 6 goals)
    // so even a once-daily click maintains a balanced mix of trust-
    // building, education, share-wins, etc. The operator can override
    // anytime by jumping into Compose directly.
    const goalRotation: CampaignGoal[] = ['build_trust', 'educate', 'share_win', 'community', 'promote_service', 'book_consult']
    const goal = goalRotation[new Date().getDay() % goalRotation.length]

    // Audience: match the topic's tag where possible — NCLEX content
    // should target nurses actively in NCLEX prep, visa content should
    // target nurses on the visa journey, etc. Falls back to the broad
    // "considering" segment when the tag isn't audience-specific.
    let audience: AudiencePreset = 'ph_considering'
    // Tag-to-audience mapping — every tag in the current
    // TRENDING_TOPIC_IDEAS is NCLEX-processing-aligned, so we map them
    // to the two audiences that fit best: nurses actively prepping
    // (NCLEX tag) vs nurses still researching the move (Service /
    // Marketing tags). 'Visa' / 'Career' / 'Lifestyle' are no longer
    // produced but kept as a defensive branch in case the list grows.
    if (topic.tag === 'NCLEX') audience = 'ph_nclex_prep'
    else if (topic.tag === 'Service' || topic.tag === 'Marketing') audience = 'ph_considering'
    else if (topic.tag === 'Visa') audience = 'ph_visa_stage'
    else if (topic.tag === 'Career' || topic.tag === 'Lifestyle') audience = 'ien_already_us'

    // Tone: rotate across the day so consecutive clicks read differently.
    const toneRotation = ['friendly', 'encouraging', 'professional', 'informative']
    const tone = toneRotation[new Date().getHours() % toneRotation.length]

    const goalLabel = CAMPAIGN_GOALS.find((g) => g.id === goal)?.label || goal
    const audienceLabel = AUDIENCE_PRESETS.find((a) => a.id === audience)?.label || audience
    const reasoning = `${topic.tag} angle for ${audienceLabel} · goal: ${goalLabel} · tone: ${tone}`

    return { topic, goal, audience, tone, length: 'medium', language: 'taglish', reasoning }
  }

  // Generate Now — the agent decides everything (topic, goal, audience,
  // tone) and produces ONE post in the bank. Faster feedback than the
  // cadence-driven Auto-generate button below (which batches postsPerDay
  // items at once). Always uses openai for the image AI per the brand
  // brief's DALL·E-style pipeline.
  const [agentGenerating, setAgentGenerating] = useState(false)
  async function agentGenerateNow() {
    setAgentGenerating(true)
    try {
      const plan = decideAgentPlan()
      showToast(`Agent: ${plan.reasoning}`, 'info')
      const data = await api<{ items: BankItem[]; brief: string }>('/ai/generate-batch', {
        method: 'POST',
        body: JSON.stringify({
          topic: plan.topic.title,
          preselected_idea: plan.topic.brief,
          template_id: null,
          template_image_prompt: readMasterImagePrompt(),
          caption_format: readMasterCaptionFormat(),
          goal: CAMPAIGN_GOALS.find((g) => g.id === plan.goal)?.brief || '',
          audience_preset: AUDIENCE_PRESETS.find((a) => a.id === plan.audience)?.brief || '',
          platforms: [],
          tone: plan.tone,
          // Captions follow the 11-section master format — only fits in
          // a long budget. Always long regardless of agent plan defaults.
          length: 'long',
          language: plan.language,
          count: 1,
          content_type: 'image',
          additional_details: 'Social-media manager agent — autonomous decision. Keep claims grounded, no guarantees.',
          image_provider: 'openai',
        }),
      })
      onBatchGenerated(data.items || [])
    } catch (err: any) {
      showToast(err.message || 'Generate Now failed', 'error')
    } finally {
      setAgentGenerating(false)
    }
  }

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
          // the master image prompt + master caption format — the same
          // values Compose sends. Refinements saved in Compose
          // immediately apply to the next auto-batch (continuous
          // learning).
          template_image_prompt: readMasterImagePrompt(),
          caption_format: readMasterCaptionFormat(),
          goal: CAMPAIGN_GOALS.find((g) => g.id === 'build_trust')?.brief || '',
          audience_preset: AUDIENCE_PRESETS.find((a) => a.id === 'ph_considering')?.brief || '',
          platforms: [],
          tone: 'friendly',
          // 11-section captions only fit in a long budget.
          length: 'long',
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
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={agentGenerateNow}
              loading={agentGenerating}
              disabled={agentGenerating || accounts.length === 0}
              title={accounts.length === 0
                ? 'Connect a social account in the Accounts tab before the agent can generate.'
                : 'Agent decides topic, goal, audience, tone — then renders one post via DALL·E.'}
            >
              <Sparkles className="h-4 w-4 mr-1.5" /> Generate Now
            </Button>
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
            <span className="text-[10px] text-gray-400 dark:text-gray-500 text-right max-w-[200px]">
              Generate Now: single autonomous post · Autopilot: daily nudges {autopilot ? 'on' : 'off'}.
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

      {/* Live performance — pulls Page Insights from Facebook + Instagram
          via the connected long-lived token. The "Generate AI plan" button
          feeds the metrics into gpt-4o-mini to produce a cadence + topic
          plan grounded in what's actually working, not a static topic list. */}
      <ManagerInsightsCard
        connectedPlatforms={stats.connectedPlatforms}
        onComposeWith={onComposeWith}
        onUseInAd={onUseInAd}
        postsPerDay={postsPerDay}
        showToast={showToast}
      />
    </div>
  )
}

// Live FB/IG insights + AI plan. Decoupled from ManagerView so it can own
// its own fetch state without re-rendering the whole agent surface.
function ManagerInsightsCard({
  connectedPlatforms,
  onComposeWith,
  onUseInAd,
  postsPerDay,
  showToast,
}: {
  connectedPlatforms: Platform[]
  onComposeWith: (topic: string, templateId?: string) => void
  onUseInAd: (brief: string) => void
  postsPerDay: number
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  type InsightsSummary = {
    platforms: Array<{
      platform: 'facebook' | 'instagram'
      account: { id: string; name: string }
      reach_28d: number | null
      engagement_28d: number | null
      followers: number | null
      follower_growth_28d: number | null
      top_posts: Array<{
        id: string
        permalink: string | null
        caption: string
        published_at: string | null
        reach: number | null
        engagement: number | null
      }>
      error?: string | null
    }>
  }
  type PlanRecommendation = {
    summary: string
    cadence: { recommended_per_day: number; rationale: string }
    best_times: Array<{ platform: string; window: string; note: string }>
    topic_recommendations: Array<{ title: string; brief: string; tag: string; why: string }>
  }

  const [data, setData] = useState<InsightsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<PlanRecommendation | null>(null)
  const [planLoading, setPlanLoading] = useState(false)

  const fbConnected = connectedPlatforms.includes('facebook') || connectedPlatforms.includes('instagram')

  async function loadInsights() {
    setLoading(true)
    try {
      const r = await api<InsightsSummary>('/analytics/summary')
      setData(r)
    } catch (err: any) {
      showToast(err.message || 'Failed to load insights', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function generatePlan() {
    setPlanLoading(true)
    try {
      const r = await api<PlanRecommendation>('/analytics/plan', {
        method: 'POST',
        body: JSON.stringify({ posts_per_day_target: postsPerDay }),
      })
      setPlan(r)
    } catch (err: any) {
      showToast(err.message || 'Failed to generate plan', 'error')
    } finally {
      setPlanLoading(false)
    }
  }

  useEffect(() => {
    if (fbConnected && !data && !loading) loadInsights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbConnected])

  if (!fbConnected) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live performance & plan</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect Facebook or Instagram in the Accounts tab — once linked, this card pulls real reach, engagement, and
          follower growth, then asks the AI to build a posting plan around what's actually landing.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live performance & plan</h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Real numbers from Facebook + Instagram Page Insights (last 28 days). The AI plan uses your top-performing
            posts to recommend what to publish next.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadInsights} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button size="sm" onClick={generatePlan} loading={planLoading} disabled={planLoading || loading || !data}>
            <Brain className="h-3.5 w-3.5 mr-1" /> Ask Strat for a plan
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-6"><Loading text="Pulling insights from Meta…" /></div>
      )}

      {data && data.platforms.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No analytics available yet — once your Pages have published posts, metrics will appear here.</p>
      )}

      {data && data.platforms.map((p) => (
        <div key={`${p.platform}-${p.account.id}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-white', PLATFORM_META[p.platform].color)}>
                {p.platform === 'facebook' ? <Facebook className="h-3.5 w-3.5" /> : <Instagram className="h-3.5 w-3.5" />}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.account.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{PLATFORM_META[p.platform].label}</div>
              </div>
            </div>
            {p.error && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300" title={p.error}>insights limited</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <InsightStat label="Reach 28d" value={p.reach_28d} />
            <InsightStat label="Engagement 28d" value={p.engagement_28d} />
            <InsightStat label="Followers" value={p.followers} />
            <InsightStat label="Growth 28d" value={p.follower_growth_28d} signed />
          </div>
          {p.top_posts.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Top posts
              </div>
              <ul className="space-y-1.5">
                {p.top_posts.slice(0, 3).map((post) => (
                  <li key={post.id} className="flex items-start justify-between gap-2 text-xs">
                    <a
                      href={post.permalink || '#'}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                      title={post.caption}
                    >
                      {post.caption || '(no caption)'}
                    </a>
                    <span className="flex-shrink-0 text-gray-500 dark:text-gray-400 tabular-nums">
                      {formatCompact(post.engagement)} eng
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {plan && (
        <div className="rounded-lg border border-primary-200 dark:border-primary-800/50 bg-primary-50/40 dark:bg-primary-900/20 p-3 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
              <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wider">Strat says</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">· plan grounded in your 28-day metrics</span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-100">{plan.summary}</p>
          </div>

          <div className="text-xs text-gray-700 dark:text-gray-200">
            <strong>Recommended cadence:</strong> {plan.cadence.recommended_per_day}/day · {plan.cadence.rationale}
          </div>

          {plan.best_times.length > 0 && (
            <div className="text-xs text-gray-700 dark:text-gray-200">
              <strong>Best times:</strong>
              <ul className="mt-1 space-y-0.5 ml-4 list-disc">
                {plan.best_times.map((bt, i) => (
                  <li key={i}><span className="font-medium capitalize">{bt.platform}:</span> {bt.window} <span className="text-gray-500 dark:text-gray-400">— {bt.note}</span></li>
                ))}
              </ul>
            </div>
          )}

          {plan.topic_recommendations.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Topic recommendations
              </div>
              <div className="space-y-2">
                {plan.topic_recommendations.map((t, i) => (
                  <div key={i} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 flex-shrink-0">
                          {t.tag}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.title}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" onClick={() => onComposeWith(t.brief)}>
                          <Sparkles className="h-3 w-3 mr-1" /> Generate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onUseInAd(t.brief)}>
                          <Megaphone className="h-3 w-3 mr-1" /> Ad
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{t.brief}</p>
                    <p className="text-[10px] text-primary-700 dark:text-primary-300 italic mt-1">Why now: {t.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function InsightStat({ label, value, signed }: { label: string; value: number | null; signed?: boolean }) {
  const tone = signed && typeof value === 'number'
    ? value > 0 ? 'text-green-600 dark:text-green-400'
    : value < 0 ? 'text-red-600 dark:text-red-400'
    : 'text-gray-700 dark:text-gray-200'
    : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums', tone)}>
        {value === null || value === undefined ? '—' : `${signed && value > 0 ? '+' : ''}${formatCompact(value)}`}
      </div>
    </div>
  )
}

function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
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
  onConnect,
  onManual,
  onDisconnect,
  onChoosePages,
  onMetaDisconnect,
}: {
  accounts: SocialAccount[]
  onConnect: (p: Platform) => void
  onManual: (p: Platform) => void
  onDisconnect: (id: string) => void
  // Opens the post-OAuth Facebook page-picker modal so the admin can
  // prune which Pages stay connected after they've already logged in.
  onChoosePages: () => void
  // Opens the unified disconnect-confirm modal for the whole Meta
  // (FB + IG + ads) connection. The actual DELETE runs in the parent.
  onMetaDisconnect: () => void
}) {
  const { showToast } = useToast()
  const [oauthStatus, setOauthStatus] = useState<Record<string, OAuthStatus>>({})
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const [metaStatus, setMetaStatus] = useState<MetaConnectionStatus | null>(null)
  // Meta-side busy state lives at the parent now (one disconnect modal).
  // Keep this as a literal so the card prop wiring stays unchanged.
  const metaBusy = false

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

  // The actual disconnect call lives in the parent (one modal flow for
  // every disconnect). AccountsView just opens the modal via onMetaDisconnect.

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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Connected accounts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Log in to each platform, authorize the pages you want to post to, and save. Repeat for every account you manage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FacebookCard
          status={metaStatus}
          busy={metaBusy}
          oauthReady={oauthStatus.facebook?.oauth_ready}
          onConnect={() => onConnect('facebook')}
          onDisconnect={onMetaDisconnect}
          onChoosePages={onChoosePages}
        />
        {/* Instagram, Threads, LinkedIn, YouTube, TikTok all follow the
            same single-account-per-platform pattern. IG was previously a
            sibling of Facebook (linked via the FB OAuth); it now has its
            own Instagram Login OAuth (see PLATFORM_CONFIG.instagram). */}
        {(['instagram', 'threads', 'linkedin', 'youtube', 'tiktok'] as Platform[]).map((p) => {
          const acc = accounts.find((a) => a.platform === p) || null
          return (
            <SimplePlatformCard
              key={p}
              platform={p}
              account={acc}
              oauthStatus={oauthStatus[p]}
              busy={p === 'threads' ? threadsBusy : false}
              onConnect={() => onConnect(p)}
              onManual={() => onManual(p)}
              onDisconnect={onDisconnect}
              onRefreshToken={p === 'threads' && acc ? refreshThreadsToken : undefined}
            />
          )
        })}
      </div>

      <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-lg">
          Media storage {driveStatus?.connected ? <span className="text-xs font-normal text-green-700 dark:text-green-300 ml-1">· Google Drive connected</span> : <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">· using in-database storage</span>}
        </summary>
        <div className="px-4 pb-4 pt-1 text-sm text-gray-600 dark:text-gray-400 space-y-3">
          <p>
            Optional: connect a Google Drive account to host AI-generated images and videos in a shared <strong>GritSync Social</strong> folder.
            Without Drive, media is stored in-database and still works fine.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {driveStatus?.connected ? (
              <>
                <div className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-200">
                  <strong>{driveStatus.email || 'Connected'}</strong>
                  {driveStatus.folder_name && <span className="text-gray-500 dark:text-gray-400"> · folder “{driveStatus.folder_name}”</span>}
                </div>
                <Button size="sm" variant="outline" onClick={connectDrive} loading={driveBusy} disabled={driveBusy}>Reconnect</Button>
                <Button size="sm" variant="ghost" onClick={disconnectDrive} disabled={driveBusy} className="text-red-600 hover:text-red-700">Disconnect</Button>
              </>
            ) : (
              <Button size="sm" onClick={connectDrive} loading={driveBusy} disabled={driveBusy}>
                Connect Google Drive
              </Button>
            )}
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-lg">
          Advanced — connect with an access token
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>If a platform's OAuth isn't set up yet, paste a long-lived access token directly.</p>
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
  // Image templates — operator-managed list of (name, prompt, preview)
  // tiles. Replaces the single master image prompt: now the operator
  // picks from a library + can add/edit/regenerate templates from the
  // Media section. The selected template's prompt is what gets sent to
  // the backend as `template_image_prompt` on every generation.
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedImageTemplateId, setSelectedImageTemplateIdRaw] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_IMAGE_TEMPLATE_ID_KEY) || null } catch { return null }
  })
  const [regeneratingTemplateIds, setRegeneratingTemplateIds] = useState<Set<string>>(new Set())
  const [templateModalOpen, setTemplateModalOpen] = useState<{ mode: 'new' } | { mode: 'edit'; template: ImageTemplate } | null>(null)
  const [templateDraft, setTemplateDraft] = useState<{ name: string; prompt: string }>({ name: '', prompt: '' })
  const [templateSubmitting, setTemplateSubmitting] = useState(false)
  const [templateAiDrafting, setTemplateAiDrafting] = useState(false)
  const [lensaOpen, setLensaOpen] = useState(false)

  // Lensa-assist inside the manual New/Edit template modal. Uses the
  // typed name as a brief (or the existing prompt as creative direction
  // when editing). Skips the orchestrator's preview render so the
  // operator stays inside the modal — they'll see the preview when they
  // hit "Create + render preview".
  async function draftTemplateWithLensa() {
    setTemplateAiDrafting(true)
    try {
      // For edit mode, treat the current prompt as the brief so Lensa
      // refines instead of starting from zero. For new mode, the typed
      // name (if any) is the creative direction; empty falls back to
      // "fill a gap" mode on the server.
      const brief = templateModalOpen?.mode === 'edit'
        ? `Refine this template, keeping its identity: ${templateDraft.prompt.slice(0, 600)}`
        : templateDraft.name.trim()
      const r = await api<{ name: string; prompt: string; reasoning: string }>('/ai/image-templates/orchestrate', {
        method: 'POST',
        body: JSON.stringify({ brief: brief || undefined, provider: imageAi, skip_preview: true }),
      })
      setTemplateDraft((d) => ({
        // Don't clobber the user's typed name unless the field was empty.
        name: d.name.trim() ? d.name : r.name,
        prompt: r.prompt,
      }))
      showToast(`Lensa drafted: ${r.reasoning}`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Lensa draft failed', 'error')
    } finally {
      setTemplateAiDrafting(false)
    }
  }
  // Master caption format — 11-section structural template every caption
  // follows. Parallel to the image-prompt editor: read/write helpers
  // persist overrides in localStorage; refinements via AI come back into
  // a draft for review.
  const [masterCaptionFormat, setMasterCaptionFormat] = useState<string>(() => readMasterCaptionFormat())
  const [captionEditorOpen, setCaptionEditorOpen] = useState(false)
  const [captionDraft, setCaptionDraft] = useState<string>('')
  const [captionRefining, setCaptionRefining] = useState(false)
  const [goal, setGoal] = useState<CampaignGoal>('build_trust')
  const [audiencePreset, setAudiencePreset] = useState<AudiencePreset>('ph_considering')
  const [tone, setTone] = useState('friendly')
  // Length is FORCED to 'long' so every generated caption can fully cover
  // the 11 sections in the master caption format. Kept as state for
  // payload consistency but no UI picker — the format itself sets the
  // expected length.
  const [length] = useState<'short' | 'medium' | 'long'>('long')
  const [language, setLanguage] = useState<'taglish' | 'english' | 'filipino'>('taglish')
  // Long captions are expensive to generate (and pricey on OpenAI), so
  // the range is now 1–3 with a default of 1. Operators can still bump
  // to 3 for A/B comparison.
  const [resultCount, setResultCount] = useState(1)
  const [contentType, setContentType] = useState<'image' | 'video'>('image')
  const [imageAi, setImageAi] = useState<'openai' | 'nano-banana' | 'grok' | 'kling'>('openai')
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

  // ── Image-template handlers ───────────────────────────────────────
  // Load templates on first mount. If none exist, seed the default one
  // from DEFAULT_MASTER_IMAGE_PROMPT so the operator has something to
  // start from instead of an empty grid.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setTemplatesLoading(true)
      try {
        const list = await api<ImageTemplate[]>('/ai/image-templates')
        if (cancelled) return
        if (Array.isArray(list) && list.length > 0) {
          setImageTemplates(list)
        } else {
          // First-run seed: create the default GritSync Master template.
          // POST /image-templates renders the preview synchronously, so
          // the operator sees the brand image immediately.
          try {
            const seed = await api<ImageTemplate>('/ai/image-templates', {
              method: 'POST',
              body: JSON.stringify({
                name: 'GritSync Master',
                prompt: DEFAULT_MASTER_IMAGE_PROMPT,
                is_default: true,
              }),
            })
            if (!cancelled) setImageTemplates([seed])
          } catch (seedErr: any) {
            if (!cancelled) showToast(seedErr.message || 'Failed to seed default template', 'error')
          }
        }
      } catch (err: any) {
        if (!cancelled) showToast(err.message || 'Failed to load image templates', 'error')
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolved selected template — falls back to the default tile if the
  // operator hasn't picked one yet (or the previously-selected id is no
  // longer in the list, e.g. after deletion).
  const selectedImageTemplate = useMemo<ImageTemplate | null>(() => {
    if (imageTemplates.length === 0) return null
    return imageTemplates.find((t) => t.id === selectedImageTemplateId)
      || imageTemplates.find((t) => t.is_default)
      || imageTemplates[0]
      || null
  }, [imageTemplates, selectedImageTemplateId])

  // Keep the legacy localStorage key in sync with the current selection
  // so Manager's autoGenerateBatch + agentGenerateNow (which read via
  // readMasterImagePrompt) automatically use the operator's pick.
  useEffect(() => {
    if (!selectedImageTemplate) return
    writeMasterImagePrompt(selectedImageTemplate.prompt)
    try { localStorage.setItem(SELECTED_IMAGE_TEMPLATE_ID_KEY, selectedImageTemplate.id) } catch {}
  }, [selectedImageTemplate?.id, selectedImageTemplate?.prompt])

  function selectImageTemplate(id: string) {
    setSelectedImageTemplateIdRaw(id)
  }

  function openNewTemplate() {
    setTemplateDraft({ name: '', prompt: DEFAULT_MASTER_IMAGE_PROMPT })
    setTemplateModalOpen({ mode: 'new' })
  }
  function openEditTemplate(t: ImageTemplate) {
    setTemplateDraft({ name: t.name, prompt: t.prompt })
    setTemplateModalOpen({ mode: 'edit', template: t })
  }
  async function submitTemplate() {
    const name = templateDraft.name.trim()
    const prompt = templateDraft.prompt.trim()
    if (!name || !prompt) {
      showToast('Name and prompt are both required', 'error')
      return
    }
    setTemplateSubmitting(true)
    try {
      if (!templateModalOpen) return
      if (templateModalOpen.mode === 'new') {
        const created = await api<ImageTemplate>('/ai/image-templates', {
          method: 'POST',
          body: JSON.stringify({ name, prompt }),
        })
        setImageTemplates((cur) => [created, ...cur])
        setSelectedImageTemplateIdRaw(created.id)
        showToast(created.preview_status === 'available'
          ? `Created "${created.name}" — preview rendered`
          : `Created "${created.name}" — preview render failed (${created.preview_error || 'unknown'})`,
          created.preview_status === 'available' ? 'success' : 'error')
      } else {
        const id = templateModalOpen.template.id
        const updated = await api<ImageTemplate>(`/ai/image-templates/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, prompt }),
        })
        setImageTemplates((cur) => cur.map((t) => t.id === id ? updated : t))
        showToast(`Updated "${updated.name}"`, 'success')
      }
      setTemplateModalOpen(null)
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setTemplateSubmitting(false)
    }
  }
  async function regenerateTemplate(id: string) {
    setRegeneratingTemplateIds((cur) => new Set(cur).add(id))
    try {
      const updated = await api<ImageTemplate>(`/ai/image-templates/${id}/regenerate`, { method: 'POST' })
      setImageTemplates((cur) => cur.map((t) => t.id === id ? updated : t))
      showToast(updated.preview_status === 'available' ? 'Preview regenerated' : `Preview render failed: ${updated.preview_error || 'unknown'}`,
        updated.preview_status === 'available' ? 'success' : 'error')
    } catch (err: any) {
      showToast(err.message || 'Regenerate failed', 'error')
    } finally {
      setRegeneratingTemplateIds((cur) => {
        const next = new Set(cur)
        next.delete(id)
        return next
      })
    }
  }
  async function deleteTemplate(id: string) {
    if (!confirm('Delete this image template?')) return
    try {
      await api(`/ai/image-templates/${id}`, { method: 'DELETE' })
      setImageTemplates((cur) => cur.filter((t) => t.id !== id))
      // If the deleted one was selected, pick the default (or the first
      // remaining) so subsequent generations have a valid prompt.
      if (selectedImageTemplateId === id) {
        const fallback = imageTemplates.find((t) => t.id !== id && t.is_default)
          || imageTemplates.find((t) => t.id !== id)
        setSelectedImageTemplateIdRaw(fallback?.id || null)
      }
      showToast('Template deleted', 'success')
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error')
    }
  }
  // ── Master caption format editor handlers ─────────────────────────
  function openCaptionEditor() {
    setCaptionDraft(masterCaptionFormat)
    setCaptionEditorOpen(true)
  }
  function saveCaptionFormat() {
    const value = captionDraft.trim()
    if (!value) {
      showToast('Master caption format cannot be empty', 'error')
      return
    }
    setMasterCaptionFormat(value)
    writeMasterCaptionFormat(value)
    setCaptionEditorOpen(false)
    showToast(value === DEFAULT_MASTER_CAPTION_FORMAT.trim()
      ? 'Reset to brand default — future captions will follow it'
      : 'Master caption format saved — future captions will follow it', 'success')
  }
  function resetCaptionFormat() {
    setCaptionDraft(DEFAULT_MASTER_CAPTION_FORMAT)
  }
  async function refineCaptionFormat() {
    setCaptionRefining(true)
    try {
      const r = await api<{ refined_format: string; reasoning?: string }>(
        '/ai/refine-master-caption-format',
        {
          method: 'POST',
          body: JSON.stringify({
            current_format: captionDraft || masterCaptionFormat,
            topic: topic.trim() || null,
            goal_brief: CAMPAIGN_GOALS.find((g) => g.id === goal)?.brief || null,
          }),
        }
      )
      if (r.refined_format && r.refined_format.trim()) {
        setCaptionDraft(r.refined_format.trim())
        showToast(r.reasoning
          ? `Refined — ${r.reasoning.slice(0, 90)}${r.reasoning.length > 90 ? '…' : ''}`
          : 'Master caption format refined — review and Save when ready', 'success')
      } else {
        throw new Error('No refined format returned')
      }
    } catch (err: any) {
      showToast(err.message || 'Refine failed', 'error')
    } finally {
      setCaptionRefining(false)
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
          // The selected image template's prompt — single source of truth
          // for what the image AI renders this batch. Falls back to the
          // default master prompt if no template has loaded yet (rare,
          // only on first paint before /image-templates returns).
          template_image_prompt: selectedImageTemplate?.prompt || DEFAULT_MASTER_IMAGE_PROMPT,
          // Parallel for captions: the 11-section master format is what
          // the LLM hews to when writing every variant. Length is forced
          // to 'long' so the model has room to cover all sections.
          caption_format: masterCaptionFormat,
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
          {/* Length picker removed — every caption follows the 11-section
              master caption format, which only fits in a "long" budget.
              Operators tune structure via the format editor below, not
              via a length toggle. */}
          <div className="grid grid-cols-3 gap-3">
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
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Results <span className="opacity-60">(long captions are pricey — keep small)</span>
              </label>
              <select
                value={resultCount}
                onChange={(e) => setResultCount(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Master caption format — 11-section structural template every
              caption follows. Parallel to the Master image prompt editor
              under section 4: edit + AI-refine, persists in localStorage. */}
          <div className="rounded-xl border border-primary-200 dark:border-primary-800/50 bg-primary-50/40 dark:bg-primary-900/15 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PencilLine className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Master caption format</h3>
                  {masterCaptionFormat !== DEFAULT_MASTER_CAPTION_FORMAT && (
                    <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      Customised
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                  11-section blueprint every generated caption follows — hook → self-check → reframe → solution →
                  perks → vision → authority → decision → CTA → sign-off → hashtags. Refinements persist on your
                  device and feed both Compose and the Manager's Generate Now.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={openCaptionEditor}>
                <PencilLine className="h-3.5 w-3.5 mr-1" /> Edit format
              </Button>
            </div>
            <div className="mt-3 rounded-lg bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3 max-h-32 overflow-y-auto">
              <p className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug line-clamp-6">
                {masterCaptionFormat}
              </p>
            </div>
            {captionEditorOpen && (
              <div className="mt-4 space-y-3 rounded-lg border border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-900 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Editing master caption format
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
                    <span><strong className="text-gray-700 dark:text-gray-200">{captionDraft.length.toLocaleString()}</strong> chars</span>
                    <span><strong className="text-gray-700 dark:text-gray-200">{captionDraft.trim() ? captionDraft.trim().split(/\s+/).length.toLocaleString() : 0}</strong> words</span>
                    <span><strong className="text-gray-700 dark:text-gray-200">{(captionDraft.match(/^\d+\.\s/gm) || []).length}</strong>/11 sections</span>
                  </div>
                </div>
                <Textarea
                  rows={18}
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setCaptionEditorOpen(false)} disabled={captionRefining}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetCaptionFormat} disabled={captionRefining}>
                    Reset to brand default
                  </Button>
                  <Button size="sm" variant="outline" onClick={refineCaptionFormat} loading={captionRefining} disabled={captionRefining}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Refine with AI
                  </Button>
                  <Button size="sm" onClick={saveCaptionFormat} disabled={captionRefining || !captionDraft.trim()}>
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  Refine with AI sends the current draft + your active topic/goal to <span className="font-mono">/ai/refine-master-caption-format</span>.
                  The model returns a tighter version of the same 11-section blueprint; review then click Save.
                </p>
              </div>
            )}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([
                { id: 'openai',      label: 'OpenAI',      sub: 'dall-e-3 hd + natural' },
                { id: 'nano-banana', label: 'Nano Banana', sub: 'Gemini 2.5 Flash Image' },
                { id: 'grok',        label: 'Grok',        sub: 'grok-2-image' },
                { id: 'kling',       label: 'Kling',       sub: 'Kuaishou kling-v1-5' },
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

          {/* Image templates — operator-managed library of (name, prompt,
              preview) tiles. Selecting a tile sets it as the current
              image-generation prompt for all of Compose + Manager. Click
              a tile to select; use the row of actions under each to edit
              the prompt (auto-regenerates preview), regenerate the
              preview without prompt changes, or delete (non-default
              templates only). The + New template tile opens the editor
              modal in create mode. */}
          {contentType === 'image' && (
            <div className="mt-4 rounded-xl border border-primary-200 dark:border-primary-800/50 bg-primary-50/40 dark:bg-primary-900/15 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Image templates</h3>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                    Pick the template whose look you want for this batch. The selected template's prompt drives every
                    image generated below. Click <strong>+ New template</strong> to design your own.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLensaOpen(true)}
                    title="Lensa researches your library + recent posts, then designs a new template + previews it"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Ask Lensa
                  </Button>
                  <Button size="sm" variant="outline" onClick={openNewTemplate}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New template
                  </Button>
                </div>
              </div>

              {templatesLoading && imageTemplates.length === 0 ? (
                <div className="py-8 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading templates…
                </div>
              ) : imageTemplates.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No templates yet. Click <strong>+ New template</strong> to create one.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {imageTemplates.map((t) => {
                    const selected = selectedImageTemplateId === t.id
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'group rounded-xl overflow-hidden border-2 bg-white dark:bg-gray-900 transition-all',
                          selected
                            ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900/40 shadow-md'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectImageTemplate(t.id)}
                          className="block w-full relative aspect-square overflow-hidden"
                          title={selected ? 'Selected — drives current image generation' : `Use "${t.name}" for this batch`}
                        >
                          {t.preview_url ? (
                            <img
                              src={t.preview_url}
                              alt={t.name}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : t.preview_status === 'pending' ? (
                            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                              <Loader2 className="h-5 w-5 animate-spin mb-1" />
                              Rendering…
                            </div>
                          ) : (
                            <div className="w-full h-full bg-amber-50 dark:bg-amber-900/20 flex flex-col items-center justify-center text-[10px] text-amber-700 dark:text-amber-300 p-3 text-center">
                              <AlertCircle className="h-5 w-5 mb-1" />
                              <span className="line-clamp-3">{t.preview_error || 'No preview'}</span>
                            </div>
                          )}
                          {t.is_default && (
                            <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full bg-white/85 dark:bg-black/55 backdrop-blur-sm text-gray-700 dark:text-gray-200">
                              Default
                            </span>
                          )}
                          {selected && (
                            <div className="absolute inset-0 bg-primary-600/25 flex items-center justify-center pointer-events-none">
                              <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full font-medium shadow">
                                Selected
                              </span>
                            </div>
                          )}
                        </button>
                        <div className="p-1.5 text-center">
                          <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate" title={t.name}>{t.name}</div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => openEditTemplate(t)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Edit prompt"
                            >
                              <PencilLine className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => regenerateTemplate(t.id)}
                              disabled={regeneratingTemplateIds.has(t.id)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-wait"
                              title="Regenerate preview"
                            >
                              {regeneratingTemplateIds.has(t.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </button>
                            {!t.is_default && (
                              <button
                                type="button"
                                onClick={() => deleteTemplate(t.id)}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-300"
                                title="Delete template"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* + New template tile — visual parity with the template
                      cards so the create affordance feels first-class. */}
                  <button
                    type="button"
                    onClick={openNewTemplate}
                    className="group rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 bg-white/40 dark:bg-gray-900/40 transition-colors flex flex-col items-center justify-center aspect-square text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    <Plus className="h-7 w-7 mb-1" />
                    <span className="text-xs font-medium">New template</span>
                    <span className="text-[10px] opacity-70">Prompt → render</span>
                  </button>
                </div>
              )}
            </div>
          )}
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

      {/* New / Edit image template modal. Renders the same form for both
          modes — the only difference is whether `submitTemplate` POSTs
          or PATCHes. Save triggers a (re-)render of the preview server-
          side so the operator sees what their prompt actually produces. */}
      <Modal
        isOpen={!!templateModalOpen}
        onClose={() => !templateSubmitting && setTemplateModalOpen(null)}
        title={templateModalOpen?.mode === 'edit'
          ? `Edit "${templateModalOpen.template.name}"`
          : 'New image template'}
        size="xl"
      >
        <div className="space-y-4">
          <Input
            label="Template name"
            placeholder="e.g. Premium Ad — Hospital Hero"
            value={templateDraft.name}
            onChange={(e) => setTemplateDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Image prompt
                <span className="text-gray-400 dark:text-gray-500 font-normal text-xs ml-2">
                  ({templateDraft.prompt.length.toLocaleString()} chars · {templateDraft.prompt.trim() ? templateDraft.prompt.trim().split(/\s+/).length.toLocaleString() : 0} words)
                </span>
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={draftTemplateWithLensa}
                loading={templateAiDrafting}
                disabled={templateAiDrafting || templateSubmitting}
                title={templateModalOpen?.mode === 'edit'
                  ? 'Lensa refines the current prompt while keeping its identity'
                  : 'Lensa drafts a brand-aligned prompt (uses the template name as the brief)'}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {templateModalOpen?.mode === 'edit' ? 'Refine with Lensa' : 'Ask Lensa to draft'}
              </Button>
            </div>
            <Textarea
              rows={16}
              value={templateDraft.prompt}
              onChange={(e) => setTemplateDraft((d) => ({ ...d, prompt: e.target.value }))}
              className="font-mono text-xs"
              placeholder='Describe the visual style: subject, setting, brand elements, palette, composition, negative-prompt block… or click "Ask Lensa to draft" to start from a structured template.'
            />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            Saving renders a preview via the production image pipeline (GPT image 2 → fallback chain), so what you see
            on the tile is what your generated posts will look like. Previews count as ONE image generation each — the
            same as a real post — so iterate thoughtfully.
          </p>
          <div className="flex flex-wrap items-center gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setTemplateModalOpen(null)} disabled={templateSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={submitTemplate}
              loading={templateSubmitting}
              disabled={templateSubmitting || !templateDraft.name.trim() || !templateDraft.prompt.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {templateModalOpen?.mode === 'edit' ? 'Save + regenerate preview' : 'Create + render preview'}
            </Button>
          </div>
        </div>
      </Modal>

      <LensaTemplateModal
        open={lensaOpen}
        onClose={() => setLensaOpen(false)}
        defaultProvider={imageAi}
        showToast={showToast}
        onSaved={(t) => {
          setImageTemplates((cur) => [t, ...cur])
          setSelectedImageTemplateIdRaw(t.id)
          try { localStorage.setItem(SELECTED_IMAGE_TEMPLATE_ID_KEY, t.id) } catch {}
          setLensaOpen(false)
          showToast(`Lensa shipped "${t.name}" — selected for this batch`, 'success')
        }}
      />
    </div>
  )
}

// Lensa — the image-template research + orchestrate + build agent. The
// operator types an optional brief, picks a renderer, hits Generate. The
// server pulls the template library + recent bank captions as research,
// orchestrates a complementary direction, and renders a preview. The
// operator can iterate (Generate again) or save as a new template.
interface LensaResult {
  name: string
  prompt: string
  reasoning: string
  preview_url: string | null
  preview_error: string | null
  provider: 'openai' | 'nano-banana' | 'grok' | 'kling'
}
function LensaTemplateModal({
  open,
  onClose,
  defaultProvider,
  onSaved,
  showToast,
}: {
  open: boolean
  onClose: () => void
  defaultProvider: 'openai' | 'nano-banana' | 'grok' | 'kling'
  onSaved: (template: ImageTemplate) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [brief, setBrief] = useState('')
  const [provider, setProvider] = useState<'openai' | 'nano-banana' | 'grok' | 'kling'>(defaultProvider)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<LensaResult | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setProvider(defaultProvider); setResult(null); setBrief('') }
  }, [open, defaultProvider])

  async function orchestrate() {
    setBusy(true)
    try {
      const r = await api<LensaResult>('/ai/image-templates/orchestrate', {
        method: 'POST',
        body: JSON.stringify({ brief: brief.trim() || undefined, provider }),
      })
      setResult(r)
      if (r.preview_error) showToast(`Preview note: ${r.preview_error}`, 'info')
    } catch (err: any) {
      showToast(err.message || 'Lensa failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!result) return
    setSaving(true)
    try {
      const created = await api<ImageTemplate>('/ai/image-templates', {
        method: 'POST',
        body: JSON.stringify({ name: result.name, prompt: result.prompt }),
      })
      onSaved(created)
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <Modal isOpen={open} onClose={() => !busy && !saving && onClose()} title="Ask Lensa — design a new image template" size="xl">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xs">
              <span className="font-semibold text-primary-700 dark:text-primary-300">Lensa</span>{' '}
              <span className="text-gray-500 dark:text-gray-400">· art-director agent</span>
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug mt-0.5">
              Reads your existing templates + recent post topics, finds a stylistic gap, designs a structured template prompt, and renders a preview with the chosen image AI. You approve before it saves.
            </div>
          </div>
        </div>

        {!result && (
          <>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Creative direction (optional)
              </label>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder='e.g. "Candid documentary feel of Filipino nurses during a study break"  or  "Celebratory ATT-received moments"'
              />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                Leave blank to let Lensa pick a fresh direction that fills a gap in your library.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Preview renderer
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'openai' | 'nano-banana' | 'grok' | 'kling')}
                disabled={busy}
                className="w-full text-sm px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
              >
                <option value="openai">OpenAI (gpt-image)</option>
                <option value="nano-banana">Gemini (nano-banana)</option>
                <option value="grok">Grok</option>
                <option value="kling">Kling (kling-v1-5)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={orchestrate} loading={busy} disabled={busy}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Generate template
              </Button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {result.preview_url ? (
                    <img src={result.preview_url} alt={result.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-xs text-amber-700 dark:text-amber-300 p-4">
                      <AlertCircle className="h-5 w-5 mx-auto mb-1" />
                      {result.preview_error || 'Preview failed'}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Rendered with {result.provider}
                </p>
              </div>
              <div className="md:col-span-3 space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Template name
                  </label>
                  <Input
                    value={result.name}
                    onChange={(e) => setResult({ ...result, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Why this template (Lensa's reasoning)
                  </label>
                  <p className="text-xs text-primary-700 dark:text-primary-300 italic">{result.reasoning}</p>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Template prompt (edit before saving if you want)
                  </label>
                  <Textarea
                    value={result.prompt}
                    onChange={(e) => setResult({ ...result, prompt: e.target.value })}
                    rows={10}
                    className="text-[11px] font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button variant="outline" onClick={() => setResult(null)} disabled={saving}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Try again
              </Button>
              <Button onClick={save} loading={saving} disabled={saving || !result.name.trim() || !result.prompt.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Save as template
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Content bank view ─────────────────────────────────────────────────────
function ContentBankView({
  bank,
  loading,
  onRefresh,
  onRefreshItem,
  onDelete,
  onRegenerateImage,
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
  onRegenerateImage: (id: string, image_prompt: string, provider?: 'openai' | 'nano-banana' | 'grok' | 'kling') => Promise<BankItem>
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
        onDelete={(id) => { onDelete(id); setViewItem(null) }}
        onRegenerateImage={async (id, prompt, provider) => {
          const updated = await onRegenerateImage(id, prompt, provider)
          setViewItem(updated)
          return updated
        }}
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
  onDelete,
  onRegenerateImage,
  hasAccounts,
}: {
  item: BankItem | null
  onClose: () => void
  onSchedule: (item: BankItem) => void
  onPostNow: (item: BankItem) => void
  onUseInAd: (item: BankItem) => void
  onDelete: (id: string) => void
  onRegenerateImage: (id: string, image_prompt: string, provider?: 'openai' | 'nano-banana' | 'grok' | 'kling') => Promise<BankItem>
  hasAccounts: boolean
}) {
  const { showToast } = useToast()
  const [promptDraft, setPromptDraft] = useState('')
  const [regenProvider, setRegenProvider] = useState<'openai' | 'nano-banana' | 'grok' | 'kling'>('openai')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (item) {
      setPromptDraft(item.image_prompt || '')
      const p = item.generation_settings?.image_provider
      setRegenProvider(p === 'nano-banana' || p === 'grok' || p === 'kling' ? p : 'openai')
    }
  }, [item?.id, item?.image_prompt])

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

          {item.media_type === 'image' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Image prompt
                </label>
                <div className="flex items-center gap-3">
                  {item.image_prompt && promptDraft !== item.image_prompt && (
                    <button
                      onClick={() => setPromptDraft(item.image_prompt || '')}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => { navigator.clipboard.writeText(promptDraft); showToast('Image prompt copied', 'success') }}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              </div>
              <Textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={8}
                className="text-[11px] font-mono"
                placeholder="Describe the image you want…"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={regenProvider}
                  onChange={(e) => setRegenProvider(e.target.value as 'openai' | 'nano-banana' | 'grok' | 'kling')}
                  disabled={regenerating}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                >
                  <option value="openai">OpenAI (gpt-image)</option>
                  <option value="nano-banana">Gemini (nano-banana)</option>
                  <option value="grok">Grok</option>
                  <option value="kling">Kling (kling-v1-5)</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  loading={regenerating}
                  disabled={regenerating || !promptDraft.trim()}
                  onClick={async () => {
                    setRegenerating(true)
                    try {
                      await onRegenerateImage(item.id, promptDraft.trim(), regenProvider)
                      showToast('Image regenerated', 'success')
                    } catch (err: any) {
                      showToast(err.message || 'Regeneration failed', 'error')
                    } finally {
                      setRegenerating(false)
                    }
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" /> Regenerate image
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-snug">
                Edit the prompt and click Regenerate to replace the image. GritSync branding is always re-applied automatically.
              </p>
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!confirm('Delete this bank item?')) return
                onDelete(item.id)
              }}
              className="ml-auto text-red-600 hover:text-red-700"
              title="Delete this bank item"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
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
        bank_id: state?.bank_id ?? undefined,
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

// ─── AutoReply tab ─────────────────────────────────────────────────────────
// Two sub-tabs: Inbox (FB + IG conversations) and Comments (post comments
// across FB + IG). Both surface a reply box with an optional AI-suggested
// draft. We deliberately keep auto-send disabled — the AI suggests, the
// operator picks. That's the right default until autopilot trust is built.
function AutoReplyView({
  showToast,
  hasMetaAccounts,
}: {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  hasMetaAccounts: boolean
}) {
  const [sub, setSub] = useState<'inbox' | 'comments'>('inbox')

  if (!hasMetaAccounts) {
    return (
      <Card className="p-8 text-center">
        <MessageSquare className="h-7 w-7 mx-auto text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          AutoReply needs a connected Facebook Page or Instagram Business account. Connect one in the Accounts tab.
        </p>
      </Card>
    )
  }

  const activeAgent = sub === 'inbox'
    ? { name: 'Mika', role: 'DM concierge', desc: 'Replies privately in the inbox — mirrors the writer\'s language, can quote pricing + ask follow-ups.' }
    : { name: 'Kuya Jay', role: 'public-comments specialist', desc: 'Replies in public Taglish — warm "po"/"opo" tone, defers personal questions to DMs, never argues.' }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([
          { id: 'inbox' as const, label: 'Inbox', icon: MessageSquare },
          { id: 'comments' as const, label: 'Comments', icon: MessageCircle },
        ]).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                sub === t.id
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>
      <AgentBadge name={activeAgent.name} role={activeAgent.role} desc={activeAgent.desc} />
      {sub === 'inbox' ? <InboxView showToast={showToast} /> : <CommentsView showToast={showToast} />}
    </div>
  )
}

// Tiny labeled chip that tells the operator which named AI agent is on the
// hook for this tab. Helps the team mentally separate Mika (private)
// from Kuya Jay (public Taglish) so they know what voice will come out.
function AgentBadge({ name, role, desc }: { name: string; role: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-xs">
          <span className="font-semibold text-primary-700 dark:text-primary-300">{name}</span>{' '}
          <span className="text-gray-500 dark:text-gray-400">· {role}</span>
        </div>
        <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug mt-0.5">{desc}</div>
      </div>
    </div>
  )
}

interface InboxThread {
  id: string
  account_id: string
  account_platform: 'facebook' | 'instagram'
  account_name: string
  with_name: string
  snippet: string
  updated_at: string
  unread: number
}
interface InboxMessage {
  id: string
  message: string
  from: { id: string; name?: string }
  to?: { data?: Array<{ id: string; name?: string }> }
  created_time: string
}

function InboxView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [loading, setLoading] = useState(false)
  const [activeThread, setActiveThread] = useState<InboxThread | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [accountPsid, setAccountPsid] = useState('')
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [drafting, setDrafting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await api<{ threads: InboxThread[] }>('/autoreply/inbox')
      setThreads(r.threads)
    } catch (err: any) {
      showToast(err.message || 'Failed to load inbox', 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function openThread(t: InboxThread) {
    setActiveThread(t)
    setMessages([])
    setReply('')
    setMsgsLoading(true)
    try {
      const r = await api<{ messages: InboxMessage[]; account_psid: string }>(`/autoreply/inbox/${t.id}/messages?account_id=${t.account_id}`)
      setMessages(r.messages)
      setAccountPsid(r.account_psid)
    } catch (err: any) {
      showToast(err.message || 'Failed to load messages', 'error')
    } finally {
      setMsgsLoading(false)
    }
  }

  async function suggest() {
    if (!activeThread) return
    const lastInbound = [...messages].reverse().find((m) => m.from?.id !== accountPsid)
    if (!lastInbound?.message) {
      showToast('No inbound message to draft from', 'info')
      return
    }
    setDrafting(true)
    try {
      const r = await api<{ reply: string }>('/autoreply/draft', {
        method: 'POST',
        body: JSON.stringify({ context_kind: 'inbox', message: lastInbound.message }),
      })
      setReply(r.reply)
    } catch (err: any) {
      showToast(err.message || 'AI draft failed', 'error')
    } finally {
      setDrafting(false)
    }
  }

  async function send() {
    if (!activeThread || !reply.trim()) return
    setSending(true)
    try {
      await api(`/autoreply/inbox/${activeThread.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ account_id: activeThread.account_id, message: reply.trim() }),
      })
      setReply('')
      showToast('Reply sent', 'success')
      // Refresh the thread so the new message shows.
      openThread(activeThread)
    } catch (err: any) {
      showToast(err.message || 'Failed to send', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-[500px]">
      <Card className="p-0 overflow-hidden lg:col-span-1">
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversations</div>
          <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 inline-flex items-center gap-1">
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto">
          {loading && threads.length === 0 && <div className="p-6"><Loading text="Loading…" /></div>}
          {!loading && threads.length === 0 && (
            <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">
              No conversations. Replies to your Pages/IG will show up here.
            </div>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(t)}
              className={cn(
                'block w-full text-left p-3 transition-colors',
                activeThread?.id === t.id ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {t.account_platform === 'facebook' ? <Facebook className="h-3 w-3 text-blue-600 flex-shrink-0" /> : <Instagram className="h-3 w-3 text-pink-500 flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.with_name}</span>
                </div>
                {t.unread > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{t.unread}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.snippet}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{new Date(t.updated_at).toLocaleString()} · via {t.account_name}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden lg:col-span-2 flex flex-col">
        {!activeThread ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Select a conversation to view messages and reply.
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{activeThread.with_name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{activeThread.account_platform} · {activeThread.account_name}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[500px] bg-gray-50 dark:bg-gray-900/30">
              {msgsLoading && <Loading text="Loading messages…" />}
              {messages.map((m) => {
                const own = m.from?.id === accountPsid
                return (
                  <div key={m.id} className={cn('flex', own ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                      own ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                    )}>
                      <div className="whitespace-pre-wrap">{m.message}</div>
                      <div className={cn('text-[10px] mt-0.5', own ? 'text-white/70' : 'text-gray-400 dark:text-gray-500')}>
                        {new Date(m.created_time).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Type your reply…"
              />
              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={suggest} loading={drafting} disabled={drafting} title="Mika drafts a private, on-brand DM reply">
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Ask Mika
                </Button>
                <Button size="sm" onClick={send} loading={sending} disabled={sending || !reply.trim()}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

interface CommentItem {
  id: string
  account_id: string
  account_platform: 'facebook' | 'instagram'
  account_name: string
  from_name: string
  from_avatar: string | null
  message: string
  created_at: string
  post: { id: string; permalink: string | null; message: string }
  is_own: boolean
}

function CommentsView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unanswered'>('unanswered')
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    try {
      const r = await api<{ comments: CommentItem[] }>('/autoreply/comments')
      setComments(r.comments)
    } catch (err: any) {
      showToast(err.message || 'Failed to load comments', 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function suggest(c: CommentItem) {
    setBusy((b) => ({ ...b, [`draft:${c.id}`]: true }))
    try {
      const r = await api<{ reply: string }>('/autoreply/draft', {
        method: 'POST',
        body: JSON.stringify({ context_kind: 'comment', message: c.message, post_caption: c.post.message }),
      })
      setReplies((cur) => ({ ...cur, [c.id]: r.reply }))
    } catch (err: any) {
      showToast(err.message || 'AI draft failed', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`draft:${c.id}`]: false }))
    }
  }
  async function send(c: CommentItem) {
    const text = (replies[c.id] || '').trim()
    if (!text) return
    setBusy((b) => ({ ...b, [`send:${c.id}`]: true }))
    try {
      await api(`/autoreply/comments/${c.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ account_id: c.account_id, message: text }),
      })
      setReplies((cur) => ({ ...cur, [c.id]: '' }))
      showToast('Reply posted', 'success')
    } catch (err: any) {
      showToast(err.message || 'Reply failed', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`send:${c.id}`]: false }))
    }
  }

  const filtered = filter === 'unanswered' ? comments.filter((c) => !c.is_own) : comments

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {(['unanswered', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filter === f
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-300'
              )}
            >
              {f === 'unanswered' ? 'Unanswered' : 'All'}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {loading && comments.length === 0 && <div className="py-8"><Loading text="Loading comments…" /></div>}
      {!loading && filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          {filter === 'unanswered' ? 'No unanswered comments.' : 'No comments yet.'}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-start gap-2 min-w-0">
                {c.from_avatar ? (
                  <img src={c.from_avatar} alt="" className="h-7 w-7 rounded-full flex-shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <AtSign className="h-3 w-3 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.from_name}</span>
                    {c.account_platform === 'facebook'
                      ? <Facebook className="h-3 w-3 text-blue-600" />
                      : <Instagram className="h-3 w-3 text-pink-500" />}
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.account_name} · {new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{c.message}</p>
                  {c.post.permalink && (
                    <a
                      href={c.post.permalink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" /> on post: {c.post.message || '(no caption)'}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 pl-9">
              <Textarea
                value={replies[c.id] || ''}
                onChange={(e) => setReplies((cur) => ({ ...cur, [c.id]: e.target.value }))}
                rows={2}
                placeholder="Reply to this comment…"
                className="text-sm"
              />
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => suggest(c)} loading={!!busy[`draft:${c.id}`]} disabled={!!busy[`draft:${c.id}`]} title="Kuya Jay drafts a public-comment reply in Taglish (the GritSync way)">
                  <Sparkles className="h-3 w-3 mr-1" /> Ask Kuya Jay
                </Button>
                <Button size="sm" onClick={() => send(c)} loading={!!busy[`send:${c.id}`]} disabled={!!busy[`send:${c.id}`] || !(replies[c.id] || '').trim()}>
                  <Send className="h-3 w-3 mr-1" /> Reply
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Groups tab ────────────────────────────────────────────────────────────
// Three sections:
//  1) "Your groups" — groups Meta returns from /me/groups (user_managed_groups).
//  2) "Share to a group" — picks one of the operator's recent published posts
//     and pushes its caption + link into the selected group's feed.
//  3) "Discover" — Meta killed public group search via Graph for new apps,
//     so we use gpt-4o-mini to surface group archetypes + facebook.com
//     search URLs, plus a manual "save candidate" workflow for tracking.
interface GroupRow {
  id: string
  name: string
  member_count?: number
  description?: string
  icon?: string
  privacy?: string
  // Populated by the server-side split. When 'page_joined', via_page tells
  // us which Page can post (Page token, not user token).
  source?: 'user_admin' | 'page_joined'
  via_page?: { id: string; name: string }
}

// Shared card for both group sections. Same layout; "via Page X" footnote
// only appears for page_joined rows so the operator knows which Page will
// post the share.
function GroupCard({ group, onShare }: { group: GroupRow; onShare: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {group.icon ? <img src={group.icon} alt="" className="h-6 w-6 rounded" /> : <Users className="h-4 w-4 text-gray-400" />}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{group.name}</span>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          {group.member_count != null ? `${group.member_count.toLocaleString()} members` : 'members count unavailable'} · {group.privacy || 'unknown'}
        </div>
        {group.via_page && (
          <div className="text-[11px] text-primary-700 dark:text-primary-300 mt-0.5">
            via Page: <strong>{group.via_page.name}</strong>
          </div>
        )}
        {group.description && <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{group.description}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={onShare}>
        <Send className="h-3 w-3 mr-1" /> Share
      </Button>
    </div>
  )
}
interface GroupCandidate { id: string; group_id: string | null; name: string; url: string | null; notes: string | null; status: string; created_at: string }
interface DiscoverSuggestion { name_pattern: string; why: string; search_url: string; engagement_strategy: string }

function GroupsView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [userGroups, setUserGroups] = useState<GroupRow[]>([])
  const [pageGroups, setPageGroups] = useState<GroupRow[]>([])
  const [candidates, setCandidates] = useState<GroupCandidate[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [shareModal, setShareModal] = useState<{ group: GroupRow } | null>(null)

  // Discover state
  const [focus, setFocus] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [suggestions, setSuggestions] = useState<DiscoverSuggestion[]>([])

  // Add-candidate form
  const [candName, setCandName] = useState('')
  const [candUrl, setCandUrl] = useState('')
  const [candNotes, setCandNotes] = useState('')
  const [candidateAdding, setCandidateAdding] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [g, p] = await Promise.all([
        api<{ user_groups?: GroupRow[]; page_groups?: GroupRow[]; groups?: GroupRow[]; candidates: GroupCandidate[]; note: string | null }>('/groups'),
        api<SocialPost[]>('/posts').catch(() => []),
      ])
      // Prefer the new split shape, fall back to the legacy union for
      // backwards compat with older server deploys.
      const ug = g.user_groups ?? (g.groups || []).filter((x) => x.source === 'user_admin' || !x.source)
      const pg = g.page_groups ?? (g.groups || []).filter((x) => x.source === 'page_joined')
      setUserGroups(ug)
      setPageGroups(pg)
      setCandidates(g.candidates || [])
      setNote(g.note || null)
      setPosts(Array.isArray(p) ? p : [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load groups', 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function discover() {
    setDiscovering(true)
    try {
      const r = await api<{ suggestions: DiscoverSuggestion[] }>('/groups/discover', {
        method: 'POST',
        body: JSON.stringify({ focus: focus.trim() || null }),
      })
      setSuggestions(r.suggestions || [])
    } catch (err: any) {
      showToast(err.message || 'Discover failed', 'error')
    } finally {
      setDiscovering(false)
    }
  }

  async function addCandidate() {
    if (!candName.trim()) {
      showToast('Group name is required', 'error')
      return
    }
    setCandidateAdding(true)
    try {
      const r = await api<GroupCandidate>('/groups/candidates', {
        method: 'POST',
        body: JSON.stringify({ name: candName.trim(), url: candUrl.trim() || null, notes: candNotes.trim() || null }),
      })
      setCandidates((cur) => [r, ...cur])
      setCandName(''); setCandUrl(''); setCandNotes('')
      showToast('Candidate added', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to add candidate', 'error')
    } finally {
      setCandidateAdding(false)
    }
  }
  async function updateCandidate(id: string, patch: Partial<GroupCandidate>) {
    try {
      const r = await api<GroupCandidate>(`/groups/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setCandidates((cur) => cur.map((c) => (c.id === id ? r : c)))
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error')
    }
  }
  async function deleteCandidate(id: string) {
    if (!confirm('Remove this candidate?')) return
    try {
      await api(`/groups/candidates/${id}`, { method: 'DELETE' })
      setCandidates((cur) => cur.filter((c) => c.id !== id))
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error')
    }
  }

  const totalGroups = userGroups.length + pageGroups.length

  return (
    <div className="space-y-4">
      {/* Section 1: groups the USER admins (post as user). */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Groups you admin</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Facebook groups your connected user administers. Posts go out as <strong>you</strong>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {loading && totalGroups === 0 && <div className="py-6"><Loading text="Loading groups…" /></div>}
        {!loading && userGroups.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No admin'd groups returned. Meta requires <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded">user_managed_groups</code> + app review for non-developer users.
          </div>
        )}
        {userGroups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {userGroups.map((g) => (
              <GroupCard key={g.id} group={g} onShare={() => setShareModal({ group: g })} />
            ))}
          </div>
        )}
      </Card>

      {/* Section 2: groups any PAGE has joined as a member (post as Page). */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Groups your Pages joined</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Communities your Pages are members of (you don't need to admin them). Posts go out <strong>as the Page</strong>.
            </p>
          </div>
        </div>

        {loading && totalGroups === 0 && <div className="py-6"><Loading text="Loading groups…" /></div>}
        {!loading && pageGroups.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            None of your connected Pages are members of any groups. Join a group from a Page on facebook.com, then refresh.
          </div>
        )}
        {pageGroups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pageGroups.map((g) => (
              <GroupCard key={`${g.via_page?.id || ''}:${g.id}`} group={g} onShare={() => setShareModal({ group: g })} />
            ))}
          </div>
        )}
      </Card>

      {note && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">{note}</p>
      )}

      {/* Discover */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Discover groups to join</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Meta restricts Group search via API, so <strong>Scout</strong> suggests group archetypes Filipino nurses gather in
          (with engagement strategy + search URL). Save promising ones to your candidates list below.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Optional focus (e.g. 'CGFNS, ATT applicants', 'TX/CA endorsement')"
          />
          <Button onClick={discover} loading={discovering} disabled={discovering} title="Scout suggests Facebook group archetypes Filipino nurses actually gather in">
            <Wand2 className="h-3.5 w-3.5 mr-1" /> Ask Scout
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name_pattern}</div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{s.why}</p>
                    <p className="text-[11px] text-primary-700 dark:text-primary-300 italic mt-1">Strategy: {s.engagement_strategy}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <a
                      href={s.search_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:border-primary-300 text-gray-700 dark:text-gray-200"
                    >
                      <ArrowUpRight className="h-3 w-3" /> Search FB
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCandName(s.name_pattern)
                        setCandNotes(s.engagement_strategy)
                        showToast('Filled candidate form — scroll down to save', 'info')
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Save lead
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Candidates */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Group candidates</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <Input value={candName} onChange={(e) => setCandName(e.target.value)} placeholder="Group name" />
          <Input value={candUrl} onChange={(e) => setCandUrl(e.target.value)} placeholder="facebook.com/groups/… (optional)" />
          <Input value={candNotes} onChange={(e) => setCandNotes(e.target.value)} placeholder="Notes (optional)" />
        </div>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={addCandidate} loading={candidateAdding} disabled={candidateAdding}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add candidate
          </Button>
        </div>
        {candidates.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No candidates yet — track groups you want to join here.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {candidates.map((c) => (
              <li key={c.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-[11px] text-gray-500 hover:text-primary-600 inline-flex items-center gap-0.5">
                        <ExternalLink className="h-3 w-3" /> open
                      </a>
                    )}
                  </div>
                  {c.notes && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={c.status}
                    onChange={(e) => updateCandidate(c.id, { status: e.target.value })}
                    className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                  >
                    <option value="researching">Researching</option>
                    <option value="requested">Requested</option>
                    <option value="joined">Joined</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button onClick={() => deleteCandidate(c.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {shareModal && (
        <ShareToGroupModal
          group={shareModal.group}
          posts={posts.filter((p) => p.status === 'published')}
          onClose={() => setShareModal(null)}
          onShared={() => { setShareModal(null); showToast('Posted to group', 'success') }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function ShareToGroupModal({
  group,
  posts,
  onClose,
  onShared,
  showToast,
}: {
  group: GroupRow
  posts: SocialPost[]
  onClose: () => void
  onShared: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!message.trim() && !link.trim()) {
      showToast('Add a message or link', 'error')
      return
    }
    setSubmitting(true)
    try {
      // Page-joined groups must post AS THE PAGE — send as_page_id so the
      // server uses the Page token instead of the user token.
      await api('/groups/share', {
        method: 'POST',
        body: JSON.stringify({
          group_id: group.id,
          message: message.trim(),
          link: link.trim() || undefined,
          as_page_id: group.source === 'page_joined' ? group.via_page?.id : undefined,
        }),
      })
      onShared()
    } catch (err: any) {
      showToast(err.message || 'Failed to post', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Share to ${group.name}${group.source === 'page_joined' && group.via_page ? ` (as ${group.via_page.name})` : ''}`}
      size="lg"
    >
      <div className="space-y-3">
        {posts.length > 0 && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">
              Reuse a recent published post
            </label>
            <select
              onChange={(e) => {
                const p = posts.find((x) => x.id === e.target.value)
                if (p) {
                  setMessage(p.content)
                  if (p.media_urls?.[0]) setLink(p.media_urls[0])
                }
              }}
              defaultValue=""
              className="w-full text-sm px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            >
              <option value="">— select a post —</option>
              {posts.slice(0, 25).map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.content || '').slice(0, 80)}…
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Message</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="What to share with the group…" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Link (optional)</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://gritsync.com/…" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} loading={submitting} disabled={submitting}>
            <Send className="h-3.5 w-3.5 mr-1" /> Post to group
          </Button>
        </div>
      </div>
    </Modal>
  )
}
