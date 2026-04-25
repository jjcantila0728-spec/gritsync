import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { careersAPI } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  DollarSign, 
  Search,
  ArrowRight,
  Building2,
  Calendar,
  Users,
  Star,
  Zap,
  Globe,
  HeartHandshake,
  TrendingUp,
  GraduationCap
} from 'lucide-react'

function useInView(ref: React.RefObject<Element>, threshold = 0.2) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return inView
}

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
  partner_agency_id: string | null
  views_count: number
  applications_count: number
  created_at: string
  updated_at: string
  partner_agencies?: {
    id: string
    name: string
    email: string
  } | null
}

export function CareerListing() {
  const navigate = useNavigate()
  const [careers, setCareers] = useState<Career[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const listRef = useRef<HTMLDivElement>(null)
  const listInView = useInView(listRef)

  useEffect(() => {
    fetchCareers()
  }, [])

  const fetchCareers = async () => {
    try {
      setLoading(true)
      const data = await careersAPI.getAll()
      setCareers(data as Career[])
    } catch (error: any) {
      console.error('Error fetching careers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCareers = careers.filter(career => {
    const matchesSearch = career.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         career.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (career.location && career.location.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = filterType === 'all' || career.employment_type === filterType
    const matchesDepartment = filterDepartment === 'all' || career.department === filterDepartment
    return matchesSearch && matchesType && matchesDepartment
  })

  const featuredCareers = filteredCareers.filter(c => c.is_featured)
  const regularCareers = filteredCareers.filter(c => !c.is_featured)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Career Opportunities', url: currentUrl },
  ]

  const employmentTypes = ['full-time', 'part-time', 'contract', 'temporary', 'internship']
  const departments = Array.from(new Set(careers.map(c => c.department).filter(Boolean)))

  const perks = [
    { icon: Globe, title: 'Remote-Friendly', desc: 'Work from anywhere in the Philippines or the US.' },
    { icon: GraduationCap, title: 'NCLEX Mentorship', desc: 'Free NCLEX guidance for all team members.' },
    { icon: HeartHandshake, title: 'Mission-Driven', desc: 'Every role directly impacts nurses\' lives.' },
    { icon: TrendingUp, title: 'Growth Culture', desc: 'Fast-growing team with clear career paths.' },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="Career Opportunities - Join GritSync | NCLEX Processing Agency"
        description="Explore career opportunities with GritSync. Browse available positions and apply for nursing jobs, healthcare positions, and support roles."
        keywords="career, jobs, nursing jobs, healthcare careers, NCLEX agency jobs, nursing positions, healthcare employment, job openings"
        canonicalUrl={currentUrl}
        ogTitle="Career Opportunities - Join GritSync | NCLEX Processing Agency"
        ogDescription="Explore career opportunities with GritSync. Browse available positions and apply for nursing jobs and healthcare positions."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('Career Opportunities', 'Browse and apply for career opportunities with GritSync'),
        ]}
      />
      <Header />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[80vh] flex items-center overflow-hidden bg-gray-950">
          <div className="absolute inset-0">
            <img src="/assets/pages/career-hero.png" alt="Career at GritSync" className="w-full h-full object-cover opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/20" />
          </div>
          <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="container mx-auto px-4 relative py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/60 border border-blue-800 text-blue-300 text-sm font-medium mb-6">
                <Briefcase className="h-4 w-4" />
                <span>We're Hiring</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 text-white leading-tight">
                Join the<br />
                <span className="text-blue-400">GritSync</span><br />
                Mission
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-xl leading-relaxed">
                Be part of a team that changes lives. We're building the future of nursing licensure — and we need passionate people to help us get there.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {['🇵🇭 Filipino-Founded', '🏥 Healthcare Focus', '🌍 Remote Roles', '📈 Fast Growth'].map(tag => (
                  <span key={tag} className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm backdrop-blur-sm">{tag}</span>
                ))}
              </div>
              <a href="#openings">
                <Button size="lg" className="text-lg px-8 py-6 bg-blue-600 hover:bg-blue-500">
                  View Open Positions
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Perks Strip */}
        <div className="bg-gray-900 border-y border-gray-800 py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {perks.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-900/50 border border-blue-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <section id="openings" className="py-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {loading ? 'Loading...' : `${filteredCareers.length} Open Position${filteredCareers.length !== 1 ? 's' : ''}`}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Employment Types' },
                    ...employmentTypes.map(type => ({
                      value: type,
                      label: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')
                    }))
                  ]}
                />
                <Select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...departments.map(dept => ({ value: dept!, label: dept! }))
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Careers Listing */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div ref={listRef} className="max-w-5xl mx-auto">
              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 h-64 bg-gray-50 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              ) : filteredCareers.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <Briefcase className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">No positions found</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchQuery || filterType !== 'all' || filterDepartment !== 'all'
                      ? 'Try adjusting your search or filters.'
                      : 'Check back soon — new roles are added regularly.'}
                  </p>
                </div>
              ) : (
                <>
                  {featuredCareers.length > 0 && (
                    <div className="mb-12">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium">
                          <Star className="h-3 w-3" />
                          Featured Opportunities
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        {featuredCareers.map((career, i) => (
                          <div key={career.id} className={`transition-all duration-500 ${listInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i * 80}ms` }}>
                            <CareerCard career={career} featured />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {regularCareers.length > 0 && (
                    <div>
                      {featuredCareers.length > 0 && (
                        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-gray-100">All Opportunities</h2>
                      )}
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {regularCareers.map((career, i) => (
                          <div key={career.id} className={`transition-all duration-500 ${listInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${(featuredCareers.length + i) * 80}ms` }}>
                            <CareerCard career={career} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/60 border border-blue-800 text-blue-300 text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                <span>Don't see the right role?</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Send an Open Application</h2>
              <p className="text-gray-400 text-lg mb-8">We're always looking for passionate people. Tell us what you can bring to the GritSync team.</p>
              <Link to="/career/apply">
                <Button size="lg" className="text-lg px-8 py-6 bg-blue-600 hover:bg-blue-500">
                  Submit Open Application
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

interface CareerCardProps {
  career: Career
  featured?: boolean
}

function CareerCard({ career, featured = false }: CareerCardProps) {
  const navigate = useNavigate()
  const isDeadlinePassed = career.application_deadline && new Date(career.application_deadline) < new Date()

  return (
    <div className={`group relative p-6 rounded-2xl border-2 bg-white dark:bg-gray-800/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full ${
      featured 
        ? 'border-primary-300 dark:border-primary-700 bg-gradient-to-br from-primary-50/50 to-white dark:from-primary-900/10 dark:to-gray-800/50' 
        : 'border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
    }`}>
      {featured && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-600 text-white text-xs font-bold">
          <Star className="h-3 w-3 fill-white" />
          Featured
        </div>
      )}
      
      <div className="flex-1">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${featured ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <Briefcase className={`h-5 w-5 ${featured ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} />
          </div>
          <div className="min-w-0 pr-16">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{career.title}</h3>
            {career.partner_agencies && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{career.partner_agencies.name}</p>
            )}
          </div>
        </div>
        
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-3 leading-relaxed">{career.description}</p>

        <div className="space-y-1.5 mb-4">
          {career.location && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <span>{career.location}</span>
            </div>
          )}
          {career.employment_type && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="capitalize">{career.employment_type.replace('-', ' ')}</span>
            </div>
          )}
          {career.salary_range && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <DollarSign className="h-3.5 w-3.5 text-gray-400" />
              <span>{career.salary_range}</span>
            </div>
          )}
          {career.department && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              <span>{career.department}</span>
            </div>
          )}
          {career.application_deadline && (
            <div className={`flex items-center gap-2 text-xs ${isDeadlinePassed ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
              <Calendar className="h-3.5 w-3.5" />
              <span>Deadline: {formatDate(career.application_deadline)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {career.views_count} views
        </div>
        <Button
          onClick={() => navigate(`/career/apply?careerId=${career.id}`)}
          disabled={!!isDeadlinePassed}
          size="sm"
          className={isDeadlinePassed ? '' : 'group-hover:bg-primary-700'}
        >
          {isDeadlinePassed ? 'Closed' : 'Apply Now'}
          {!isDeadlinePassed && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
