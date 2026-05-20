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
} from 'lucide-react'
import { AdsGenerator, type AdVariant } from './AdminAds'

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok'

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
}

// Post templates — branded around GritSync's core mission of helping
// Filipino-trained nurses become USRNs. Each template ships with:
//   - `brief`: a tight copywriting brief the LLM uses to write the caption
//   - `image_prompt`: a brand-aligned visual prompt that overrides the
//      generic image-prompt seed from the enhancer, so every post in a
//      template family looks like part of the same brand
//   - `gradient`: tailwind classes for the on-card sample preview tile
//   - `ad_ready`: surfaces a "Use in Ad" shortcut on the matching Content
//      Bank item so the caption flows straight into the AI Ads generator
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
]

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
  linkedin: { label: 'LinkedIn', color: 'bg-sky-700', icon: Linkedin },
  youtube: { label: 'YouTube', color: 'bg-red-600', icon: Youtube },
  tiktok: { label: 'TikTok', color: 'bg-black', icon: Music2 },
}

const ALL_PLATFORMS: Platform[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok']

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

  const initialTab = (() => {
    const t = searchParams.get('tab')
    return (['compose', 'bank', 'scheduled', 'history', 'accounts', 'ads'] as const).includes(t as any)
      ? (t as 'compose' | 'bank' | 'scheduled' | 'history' | 'accounts' | 'ads')
      : 'compose'
  })()
  const [tab, setTab] = useState<'compose' | 'bank' | 'scheduled' | 'history' | 'accounts' | 'ads'>(initialTab)

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

  // Load the bank the first time the Content Bank tab is opened, plus on full
  // refresh so the count badge stays accurate.
  useEffect(() => {
    if (tab === 'bank' && bank.length === 0 && !bankLoading) {
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
          ) : tab === 'compose' ? (
            <GeneratorView
              hasAccounts={accounts.length > 0}
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
              onUseInAd={(item) => {
                // Hand the bank item off to the Ads tab via query params —
                // AdsGenerator reads them on mount and clears them, and
                // pins the bank image to every generated variant.
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'ads')
                next.set('brief', item.caption)
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
            />
          ) : tab === 'history' ? (
            <PostList
              posts={historyPosts}
              emptyText="No published posts yet."
              onEdit={editPost}
              onDelete={deletePost}
              onPublish={publishNow}
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
function AccountsView({
  accounts,
  onConnect,
  onManual,
  onDisconnect,
}: {
  accounts: SocialAccount[]
  onConnect: (p: Platform) => void
  onManual: (p: Platform) => void
  onDisconnect: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Connect a platform</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          OAuth is the preferred path. If credentials aren't configured on the server, the "Manual" button lets you paste a token to
          finish setup.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ALL_PLATFORMS.map((p) => {
            const meta = PLATFORM_META[p]
            const Icon = meta.icon
            const connectedCount = accounts.filter((a) => a.platform === p).length
            return (
              <div
                key={p}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 flex flex-col items-center text-center"
              >
                <div className={cn('h-12 w-12 rounded-full flex items-center justify-center text-white mb-2', meta.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{meta.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {connectedCount > 0 ? `${connectedCount} connected` : 'Not connected'}
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <Button size="sm" onClick={() => onConnect(p)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Connect
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onManual(p)}>
                    Manual
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Connected accounts</h2>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No accounts connected yet.</div>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const meta = PLATFORM_META[a.platform]
              const Icon = meta.icon
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white flex-shrink-0', meta.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.display_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {meta.label} · ID {a.platform_user_id}
                      {a.last_error && <span className="ml-2 text-red-600 dark:text-red-400">⚠ {a.last_error}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onDisconnect(a.id)} title="Disconnect">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Generator view (post generator — replaces the old compose form) ───────
function GeneratorView({
  hasAccounts,
  onGenerated,
}: {
  hasAccounts: boolean
  onGenerated: (items: BankItem[]) => void
}) {
  const { showToast } = useToast()
  const [topic, setTopic] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [tone, setTone] = useState('friendly')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [language, setLanguage] = useState<'taglish' | 'english' | 'filipino'>('taglish')
  const [resultCount, setResultCount] = useState(3)
  const [contentType, setContentType] = useState<'image' | 'video'>('image')
  const [imageAi, setImageAi] = useState<'openai' | 'nano-banana' | 'grok'>('openai')
  const [additionalDetails, setAdditionalDetails] = useState('')
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'enhancing' | 'generating'>('idle')

  const template = POST_TEMPLATES.find((t) => t.id === templateId) || null

  async function generate() {
    if (!topic.trim() && !template) {
      showToast('Pick a template or describe a topic', 'error')
      return
    }
    setGenerating(true)
    setPhase('enhancing')
    // Brief visual switch so the user sees the enhancer step, even though the
    // backend call is a single round-trip that orchestrates both stages.
    const flip = setTimeout(() => setPhase('generating'), 600)
    try {
      const data = await api<{ items: BankItem[]; brief: string }>('/ai/generate-batch', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          // We keep the legacy `preselected_idea` field name for the brief so
          // the backend prompt-enhancer sees it without a rename. `template_id`
          // and `template_image_prompt` are the new template-specific signals.
          preselected_idea: template?.brief || null,
          template_id: template?.id || null,
          template_image_prompt: template?.image_prompt || null,
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
      clearTimeout(flip)
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

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Post generator</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Describe a topic, tune the style, and we'll generate caption + media variants. Everything lands in the Content Bank.
          </p>
        </div>

        {/* 1. Topic / template picker */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            1. Describe your topic
            <span className="text-gray-400 font-normal"> — or pick a branded template below</span>
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
                GritSync templates — NCLEX & USRN path
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {POST_TEMPLATES.map((t) => {
                const selected = templateId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(selected ? '' : t.id)}
                    className={cn(
                      'group text-left rounded-xl overflow-hidden border-2 transition-all bg-white dark:bg-gray-900',
                      selected
                        ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900/40 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm'
                    )}
                  >
                    {/* Branded sample preview tile — illustrative of the visual
                        family the AI will generate from `image_prompt`. */}
                    <div className={cn('relative aspect-square flex items-center justify-center', t.gradient)}>
                      <div className="text-5xl drop-shadow-sm">{t.emoji}</div>
                      <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/40 text-gray-700 dark:text-gray-100 backdrop-blur-sm">
                        {TEMPLATE_CATEGORY_LABEL[t.category]}
                      </span>
                      {t.ad_ready && (
                        <span
                          title="Works well as an ad — use directly from Content Bank"
                          className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-primary-600 text-white"
                        >
                          Ad-ready
                        </span>
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-primary-600/10 flex items-center justify-center">
                          <span className="bg-primary-600 text-white text-xs px-3 py-1 rounded-full font-medium shadow">
                            Selected
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                        {t.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {t.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">
              Template tiles are illustrative — when you generate, the AI produces a fresh on-brand image using the
              template's visual prompt (Filipino healthcare professionals, modern US settings, no fake logos or
              testimonials).
            </p>
          </div>
        </div>

        {/* 2. Settings */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Settings</label>
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

        {/* 3. Content type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. Content type</label>
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
                { id: 'openai',      label: 'OpenAI',      sub: 'gpt-image-1' },
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

        {/* 4. Additional details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            4. Additional details
            <span className="text-gray-400 font-normal"> — extra guidance for the AI</span>
          </label>
          <Textarea
            rows={3}
            placeholder="e.g. Mention free consultations. Avoid medical claims. Tag @nclexsuccess."
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {phase === 'enhancing' ? (
              <><Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Enhancing prompt…</>
            ) : phase === 'generating' ? (
              <><Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Generating {resultCount} {contentType} result{resultCount === 1 ? '' : 's'}…</>
            ) : (
              'Prompt enhancer runs before generation to sharpen the brief.'
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
  onUseInAd,
  hasAccounts,
}: {
  bank: BankItem[]
  loading: boolean
  onRefresh: () => void
  onRefreshItem: (id: string) => void
  onDelete: (id: string) => void
  onSchedule: (item: BankItem) => void
  onUseInAd: (item: BankItem) => void
  hasAccounts: boolean
}) {
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
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {bank.length} item{bank.length === 1 ? '' : 's'} in your bank — schedule one to push it to your accounts.
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {bank.map((item) => (
          <Card key={item.id} className="overflow-hidden flex flex-col">
            <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center">
              {item.media_url ? (
                item.media_type === 'video' ? (
                  <video src={item.media_url} className="w-full h-full object-cover" controls preload="metadata" />
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
            </div>
            <div className="p-4 flex-1 flex flex-col gap-3">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap line-clamp-6">{item.caption}</p>
              <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                {item.status === 'pending_media' && (
                  <Button size="sm" variant="outline" onClick={() => onRefreshItem(item.id)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Check video
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => onSchedule(item)}
                  disabled={!hasAccounts || item.status === 'pending_media'}
                  title={!hasAccounts ? 'Connect a social account first' : item.status === 'pending_media' ? 'Wait for video to finish' : 'Schedule this'}
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
    </div>
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
      setAccountIds([])
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
    <Modal isOpen={isOpen} onClose={onClose} title={editingId ? 'Edit post' : 'Schedule post'} size="lg">
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
        <Input
          label="Schedule for (optional)"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          help="Leave blank to post immediately."
        />
        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="outline" onClick={() => submit('draft')} disabled={submitting}>Save draft</Button>
          {when ? (
            <Button onClick={() => submit('schedule')} loading={submitting}>
              <Clock className="h-4 w-4 mr-1" /> Schedule
            </Button>
          ) : (
            <Button onClick={() => submit('now')} loading={submitting}>
              <Send className="h-4 w-4 mr-1" /> Post now
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
  showResults = false,
}: {
  posts: SocialPost[]
  emptyText: string
  onEdit: (p: SocialPost) => void
  onDelete: (id: string) => void
  onPublish: (id: string) => void
  showResults?: boolean
}) {
  if (posts.length === 0) {
    return <Card className="p-8 text-center text-gray-500 dark:text-gray-400">{emptyText}</Card>
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.media_urls.map((u, i) => (
                    <a
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate max-w-xs"
                    >
                      <ImageIcon className="inline h-3 w-3 mr-1" />
                      Media {i + 1}
                    </a>
                  ))}
                </div>
              )}
              {showResults && p.results && Object.keys(p.results).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(p.results).map(([accId, r]) => {
                    const meta = PLATFORM_META[r.platform]
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
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              {(p.status === 'draft' || p.status === 'scheduled' || p.status === 'failed') && (
                <Button size="sm" variant="outline" onClick={() => onPublish(p.id)} title="Publish now">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
              {(p.status === 'draft' || p.status === 'scheduled' || p.status === 'failed') && (
                <Button size="sm" variant="ghost" onClick={() => onEdit(p)} title="Edit">
                  <PencilLine className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)} title="Delete">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
