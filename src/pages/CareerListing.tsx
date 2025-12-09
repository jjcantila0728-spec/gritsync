import { useState, useEffect } from 'react'
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
  Users
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Career Opportunities - Join GritSync | NCLEX Processing Agency"
        description="Explore career opportunities with GritSync. Browse available positions and apply for nursing jobs, healthcare positions, and support roles. Join our team helping nurses achieve their USRN dreams."
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
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-6">
                <Briefcase className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Career Opportunities
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                Join our team and help nurses achieve their USRN dreams. Explore available positions and find your next career opportunity.
              </p>
            </div>
          </div>
        </section>

        {/* Search and Filters */}
        <section className="py-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
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
                    ...departments.map(dept => ({ value: dept, label: dept }))
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Careers Listing */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">Loading career opportunities...</p>
                </div>
              ) : filteredCareers.length === 0 ? (
                <Card className="p-12 text-center">
                  <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">No careers found</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchQuery || filterType !== 'all' || filterDepartment !== 'all'
                      ? 'Try adjusting your search or filters.'
                      : 'Check back later for new opportunities.'}
                  </p>
                </Card>
              ) : (
                <>
                  {/* Featured Careers */}
                  {featuredCareers.length > 0 && (
                    <div className="mb-12">
                      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Featured Opportunities</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {featuredCareers.map((career) => (
                          <CareerCard key={career.id} career={career} featured />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regular Careers */}
                  {regularCareers.length > 0 && (
                    <div>
                      {featuredCareers.length > 0 && (
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">All Opportunities</h2>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {regularCareers.map((career) => (
                          <CareerCard key={career.id} career={career} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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
    <Card className={`p-6 hover:shadow-lg transition-shadow h-full flex flex-col ${featured ? 'border-2 border-primary-300 dark:border-primary-700' : ''}`}>
      {featured && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium mb-3 w-fit">
          <Users className="h-3 w-3" />
          Featured
        </div>
      )}
      
      <div className="flex-1">
        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          {career.title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
          {career.description}
        </p>

        <div className="space-y-2 mb-4">
          {career.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4" />
              <span>{career.location}</span>
            </div>
          )}
          
          {career.employment_type && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span className="capitalize">{career.employment_type.replace('-', ' ')}</span>
            </div>
          )}
          
          {career.salary_range && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <DollarSign className="h-4 w-4" />
              <span>{career.salary_range}</span>
            </div>
          )}
          
          {career.department && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Building2 className="h-4 w-4" />
              <span>{career.department}</span>
            </div>
          )}
          
          {career.application_deadline && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              <span>Deadline: {formatDate(career.application_deadline)}</span>
            </div>
          )}
        </div>

        {career.partner_agencies && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Partner: {career.partner_agencies.name}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {career.views_count} views • {career.applications_count} applications
          </div>
          <Button
            onClick={() => navigate(`/career/apply?careerId=${career.id}`)}
            disabled={isDeadlinePassed}
            size="sm"
          >
            {isDeadlinePassed ? 'Closed' : 'Apply Now'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

