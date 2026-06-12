import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { careersAPI } from '@/lib/api'
import { getFileUrl } from '@/lib/storage-urls'
import { formatDate } from '@/lib/utils'
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Info,
  ListChecks,
  FileText,
} from 'lucide-react'

interface Career {
  id: string
  title: string
  description: string
  requirements: string | null
  responsibilities: string | null
  location: string | null
  employment_type: string | null
  salary_range: string | null
  department: string | null
  is_active: boolean
  is_featured: boolean
  application_deadline: string | null
  application_instructions: string | null
  promo_images: string[] | null
  views_count: number
  created_at: string
}

const FALLBACK_HERO = '/assets/pages/career-hero.png'

function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.gritsync.com'
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

export function CareerPromo() {
  const { careerId } = useParams<{ careerId: string }>()
  const navigate = useNavigate()
  const [career, setCareer] = useState<Career | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!careerId) return
    setLoading(true)
    setNotFound(false)
    careersAPI
      .getById(careerId)
      .then((data: any) => {
        if (!data || !data.is_active) {
          setNotFound(true)
        } else {
          setCareer(data as Career)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    window.scrollTo(0, 0)
  }, [careerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-full max-w-3xl mx-auto px-4 space-y-4">
            <div className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-8 w-2/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (notFound || !career) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-10 w-10 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Position not available</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This opening may have been filled or removed.</p>
            <Link to="/career">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Browse Open Positions
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const promoImages = (career.promo_images || []).map(getFileUrl)
  const heroImage = promoImages[0] || FALLBACK_HERO
  const galleryImages = promoImages.slice(1)
  const isDeadlinePassed = career.application_deadline && new Date(career.application_deadline) < new Date()

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Career Opportunities', url: `${baseUrl}/career` },
    { name: career.title, url: currentUrl },
  ]

  const facts = [
    career.location && { icon: MapPin, label: career.location },
    career.employment_type && { icon: Clock, label: career.employment_type.replace('-', ' ') },
    career.salary_range && { icon: DollarSign, label: career.salary_range },
    career.department && { icon: Building2, label: career.department },
  ].filter(Boolean) as { icon: typeof MapPin; label: string }[]

  const applyButton = (size: 'sm' | 'lg' = 'lg') => (
    <Button
      size={size}
      onClick={() => navigate(`/career/apply?careerId=${career.id}`)}
      disabled={!!isDeadlinePassed}
      className={size === 'lg' ? 'text-lg px-8 py-6 bg-blue-600 hover:bg-blue-500' : ''}
    >
      {isDeadlinePassed ? 'Applications Closed' : 'Apply Now'}
      {!isDeadlinePassed && <ArrowRight className="ml-2 h-5 w-5" />}
    </Button>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title={`${career.title} - Career Opportunity | GritSync`}
        description={career.description.slice(0, 160)}
        keywords={`${career.title}, nursing jobs, healthcare careers, ${career.location || ''}, ${career.department || ''}`}
        canonicalUrl={currentUrl}
        ogTitle={`${career.title} — Now Hiring via GritSync Partner Agencies`}
        ogDescription={career.description.slice(0, 160)}
        ogImage={toAbsoluteUrl(heroImage)}
        ogUrl={currentUrl}
        structuredData={[generateBreadcrumbSchema(breadcrumbs)]}
      />
      <Header />
      <main>
        {/* Promotional Hero */}
        <section className="relative min-h-[70vh] flex items-end overflow-hidden bg-gray-950">
          <div className="absolute inset-0">
            <img src={heroImage} alt={career.title} className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-gray-950/20" />
          </div>
          <div className="container mx-auto px-4 relative py-16">
            <div className="max-w-3xl">
              <Link to="/career" className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                All Open Positions
              </Link>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-900/60 border border-blue-800 text-blue-300 text-sm font-medium">
                  <Briefcase className="h-4 w-4" />
                  Now Hiring
                </span>
                {career.is_featured && (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-amber-900/60 border border-amber-700 text-amber-300 text-sm font-medium">
                    Featured
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-6xl font-black mb-5 text-white leading-tight">{career.title}</h1>
              <div className="flex flex-wrap gap-3 mb-7">
                {facts.map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm capitalize backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-blue-300" />
                    {label}
                  </span>
                ))}
                {career.application_deadline && (
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm backdrop-blur-sm ${isDeadlinePassed ? 'bg-red-900/50 border-red-800 text-red-300' : 'bg-white/10 border-white/20 text-white'}`}>
                    <Calendar className="h-4 w-4" />
                    {isDeadlinePassed ? 'Closed' : `Apply by ${formatDate(career.application_deadline)}`}
                  </span>
                )}
              </div>
              {applyButton()}
            </div>
          </div>
        </section>

        {/* Agency forwarding disclaimer */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900">
          <div className="container mx-auto px-4 py-4">
            <div className="max-w-4xl mx-auto flex items-start gap-3 text-sm text-blue-900 dark:text-blue-200">
              <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <p>
                <span className="font-semibold">GritSync is not the hiring employer.</span> We promote opportunities on behalf of our partner agencies — your application will be forwarded to the designated partner agency, which handles all hiring decisions.
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <section className="py-14">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-10">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  About the Role
                </h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{career.description}</p>
              </div>

              {career.responsibilities && (
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    <ListChecks className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    Responsibilities
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{career.responsibilities}</p>
                </div>
              )}

              {career.requirements && (
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    Requirements
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{career.requirements}</p>
                </div>
              )}

              {career.application_instructions && (
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">How to Apply</h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{career.application_instructions}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Promotional gallery */}
        {galleryImages.length > 0 && (
          <section className="pb-14">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Gallery</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {galleryImages.map((src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt={`${career.title} — promotional ${i + 2}`}
                      loading="lazy"
                      className="w-full h-64 object-cover rounded-2xl border border-gray-100 dark:border-gray-800"
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                {isDeadlinePassed ? 'This position is closed' : `Ready to apply for ${career.title}?`}
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                {isDeadlinePassed
                  ? 'Browse our other open positions — new roles are added regularly.'
                  : 'Submit your application and we\'ll forward it to the designated partner agency.'}
              </p>
              {isDeadlinePassed ? (
                <Link to="/career">
                  <Button size="lg" className="text-lg px-8 py-6 bg-blue-600 hover:bg-blue-500">
                    Browse Open Positions
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                applyButton()
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
