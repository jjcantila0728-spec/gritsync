import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Wand2,
  Loader2,
  Copy,
  Image as ImageIcon,
  Target,
  Users,
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Youtube,
  Search,
  Share2,
} from 'lucide-react'

type Platform = 'facebook' | 'instagram' | 'google' | 'linkedin' | 'tiktok' | 'youtube'
type Goal = 'lead_gen' | 'traffic' | 'conversions' | 'awareness' | 'engagement' | 'app_installs'

export interface AdVariant {
  headline: string
  primary_text: string
  description: string
  cta: string
  image_prompt: string
  audience_hint: string
  image_url?: string
  image_loading?: boolean
}

const PLATFORM_OPTIONS: Array<{ id: Platform; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-pink-600' },
  { id: 'google', label: 'Google Search', icon: Search, color: 'bg-emerald-600' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-sky-700' },
  { id: 'tiktok', label: 'TikTok', icon: Music2, color: 'bg-black' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'bg-red-600' },
]

const GOAL_OPTIONS: Array<{ id: Goal; label: string }> = [
  { id: 'lead_gen', label: 'Lead generation' },
  { id: 'traffic', label: 'Website traffic' },
  { id: 'conversions', label: 'Conversions / sales' },
  { id: 'awareness', label: 'Brand awareness' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'app_installs', label: 'App installs' },
]

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('gritsync_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface AdsGeneratorProps {
  /** When provided, pushes the ad into the host's social compose flow
   *  instead of router-navigating away. Used by AdminSocial when AdsGenerator
   *  is mounted inside its tab UI. */
  onPushToSocial?: (ad: AdVariant, platformHint: Platform) => void
  /** Pre-seeds the product/brief textarea. */
  initialBrief?: string
}

/**
 * Self-contained ad-variant generator. Renders the brief form on the left and
 * a grid of generated variants on the right. Does NOT render the page chrome
 * (Header/Sidebar/SEO/min-h-screen) — host page is responsible for that.
 */
export function AdsGenerator({ onPushToSocial, initialBrief }: AdsGeneratorProps = {}) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [product, setProduct] = useState(initialBrief ?? '')
  const [offer, setOffer] = useState('')
  const [audience, setAudience] = useState('')
  const [goal, setGoal] = useState<Goal>('lead_gen')
  const [platform, setPlatform] = useState<Platform>('facebook')
  const [tone, setTone] = useState<'persuasive' | 'professional' | 'casual' | 'urgent' | 'empathetic'>('persuasive')
  const [variants, setVariants] = useState<number>(3)
  const [aspect, setAspect] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1')

  const [generating, setGenerating] = useState(false)
  const [ads, setAds] = useState<AdVariant[]>([])
  const [fromSocial, setFromSocial] = useState(false)
  // Image URL carried over from the Content Bank "Use in Ad" shortcut — when
  // set, every generated ad variant inherits this image so the user doesn't
  // have to re-render a creative they already approved.
  const [seededImageUrl, setSeededImageUrl] = useState<string | null>(null)

  // Accept `?brief=` and `?image_url=` query params when the user clicked
  // "Make ads" / "Use in Ad" from the Content Bank — prefills the brief,
  // optionally pins the creative, then strips the params.
  useEffect(() => {
    const brief = searchParams.get('brief')
    const imageUrl = searchParams.get('image_url')
    if (brief || imageUrl) {
      if (brief) setProduct(brief)
      if (imageUrl) setSeededImageUrl(imageUrl)
      setFromSocial(true)
      const next = new URLSearchParams(searchParams)
      next.delete('brief')
      next.delete('image_url')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateAds() {
    if (!product.trim()) { showToast('Describe the product or service', 'error'); return }
    setGenerating(true)
    setAds([])
    try {
      const res = await fetch('/api/social/ai/ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ product, offer, goal, platform, audience, tone, variants }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      const fresh: AdVariant[] = body.data?.ads || []
      // If we arrived from a Content Bank item, pin its image onto each
      // variant so the user can copy/schedule without regenerating a creative.
      setAds(seededImageUrl ? fresh.map((a) => ({ ...a, image_url: seededImageUrl })) : fresh)
    } catch (err: any) {
      showToast(err.message || 'Failed to generate ads', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function generateImageFor(idx: number) {
    const ad = ads[idx]
    if (!ad?.image_prompt) return
    setAds((cur) => cur.map((a, i) => i === idx ? { ...a, image_loading: true } : a))
    try {
      const res = await fetch('/api/social/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ prompt: ad.image_prompt, aspect_ratio: aspect, quality: 'medium' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      const url = body.data?.url
      setAds((cur) => cur.map((a, i) => i === idx ? { ...a, image_url: url, image_loading: false } : a))
    } catch (err: any) {
      showToast(err.message || 'Image generation failed', 'error')
      setAds((cur) => cur.map((a, i) => i === idx ? { ...a, image_loading: false } : a))
    }
  }

  function copyAd(ad: AdVariant) {
    const text = [
      `Headline: ${ad.headline}`,
      `Primary text: ${ad.primary_text}`,
      `Description: ${ad.description}`,
      `CTA: ${ad.cta}`,
      ad.image_url ? `Image: ${ad.image_url}` : `Image prompt: ${ad.image_prompt}`,
    ].join('\n')
    navigator.clipboard.writeText(text)
    showToast('Ad copied to clipboard', 'success')
  }

  function adToPostText(ad: AdVariant): string {
    const parts: string[] = []
    if (ad.headline) parts.push(ad.headline)
    if (ad.primary_text) parts.push(ad.primary_text)
    if (ad.description && !ad.primary_text?.includes(ad.description)) parts.push(ad.description)
    return parts.join('\n\n')
  }

  function pushToSocial(ad: AdVariant) {
    if (onPushToSocial) {
      onPushToSocial(ad, platform)
      return
    }
    navigate('/admin/social', {
      state: {
        socialPrefill: {
          content: adToPostText(ad),
          media_urls: ad.image_url ? [ad.image_url] : [],
          source: 'ai-ad',
          platform_hint: platform,
        },
      },
    })
  }

  return (
    <div>
      {fromSocial && (
        <div className="mb-4 flex items-start justify-between gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50">
          <div className="flex items-start gap-3 text-sm text-primary-700 dark:text-primary-300">
            {seededImageUrl ? (
              <img src={seededImageUrl} alt="" className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
            ) : (
              <Share2 className="h-4 w-4 mt-0.5" />
            )}
            <span>
              Brief seeded from your <strong>{seededImageUrl ? 'Content Bank' : 'Social draft'}</strong>.
              {seededImageUrl ? ' The bank image is pinned to every variant — tune the campaign settings and generate ad copy.' : ' Tune the campaign settings and generate variants.'}
            </span>
          </div>
          <button
            onClick={() => { setFromSocial(false); setSeededImageUrl(null) }}
            className="text-primary-700 dark:text-primary-300 hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Brief form */}
        <Card className="p-6 lg:col-span-1 space-y-4 h-fit">
          <Textarea
            label="Product / service"
            rows={3}
            placeholder="e.g. NCLEX Live Lectures — weekly small-group review sessions led by US RNs"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
          <Input
            label="Offer / hook (optional)"
            placeholder="e.g. First month free, $99/mo after"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
          />
          <Input
            label="Target audience"
            placeholder="e.g. Filipino RNs eyeing the US, 1-3 years' experience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              <Target className="inline h-3.5 w-3.5 mr-1" /> Campaign goal
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              {GOAL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              <Users className="inline h-3.5 w-3.5 mr-1" /> Platform
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const Icon = p.icon
                const active = platform === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      'p-2 rounded-lg border text-xs flex flex-col items-center gap-1 transition-colors',
                      active
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-white', p.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="persuasive">Persuasive</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="urgent">Urgent</option>
              <option value="empathetic">Empathetic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Variants: {variants}</label>
            <input type="range" min={1} max={6} value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Creative aspect ratio</label>
            <div className="flex gap-2 flex-wrap">
              {(['1:1', '4:5', '9:16', '16:9'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAspect(a)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    aspect === a
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={generateAds} loading={generating} className="w-full">
            <Sparkles className="h-4 w-4 mr-1" /> {ads.length ? 'Regenerate ads' : 'Generate ads'}
          </Button>
        </Card>

        {/* Variants */}
        <div className="lg:col-span-2 space-y-4">
          {generating && (
            <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Drafting ad variants…
            </Card>
          )}
          {!generating && ads.length === 0 && (
            <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
              Fill in the brief and click "Generate ads" to get variants tailored to your platform.
            </Card>
          )}
          {ads.map((ad, i) => (
            <Card key={i} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                      Variant {i + 1}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {ad.cta}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                    {ad.headline}
                  </h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{ad.primary_text}</p>
                  {ad.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ad.description}</p>
                  )}
                  {ad.audience_hint && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
                      <Users className="inline h-3 w-3 mr-1" /> {ad.audience_hint}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="font-medium">Image prompt:</span> {ad.image_prompt}
                  </div>
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => copyAd(ad)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                    {!ad.image_url && (
                      <Button size="sm" variant="outline" onClick={() => generateImageFor(i)} loading={ad.image_loading}>
                        <Wand2 className="h-3.5 w-3.5 mr-1" /> Generate creative
                      </Button>
                    )}
                    <Button size="sm" onClick={() => pushToSocial(ad)}>
                      <Share2 className="h-3.5 w-3.5 mr-1" /> Schedule on social
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2 flex items-start justify-center">
                  {ad.image_loading ? (
                    <div className="aspect-square w-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : ad.image_url ? (
                    <div className="w-full space-y-2">
                      <img src={ad.image_url} alt="Ad creative" className="w-full rounded-lg border border-gray-200 dark:border-gray-700" />
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => { if (ad.image_url) { navigator.clipboard.writeText(ad.image_url); showToast('URL copied', 'success') } }}>
                          Copy URL
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => generateImageFor(i)} title="Regenerate">
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square w-full bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-xs text-gray-400 p-4 text-center">
                      <ImageIcon className="h-6 w-6 mb-2" />
                      Click "Generate creative" to render the matching ad image.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Back-compat shim. The standalone /admin/ads route is gone (it now lives as
 * the "Ads" tab inside /admin/social) but we keep this export so any direct
 * import doesn't break.
 */
export function AdminAds() {
  const { isAdmin } = useAuth()
  if (!isAdmin()) return null
  return <AdsGenerator />
}
