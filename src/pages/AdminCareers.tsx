import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { CardSkeleton } from '@/components/ui/Loading'
import { careerApplicationsAPI, partnerAgenciesAPI, careersAPI } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  Send,
  FileText,
  MessageSquare,
  Building2,
  Briefcase,
  Plus,
  Edit,
  Trash2
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface CareerApplication {
  id: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  mobile_number: string
  date_of_birth: string | null
  country: string | null
  nursing_school: string | null
  graduation_date: string | null
  years_of_experience: string | null
  current_employment_status: string | null
  license_number: string | null
  license_state: string | null
  resume_path: string | null
  cover_letter_path: string | null
  additional_documents_path: string | null
  partner_agency_id: string | null
  forwarded_to_agency_at: string | null
  forwarded_email_sent: boolean
  status: 'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  partner_agencies?: {
    id: string
    name: string
    email: string
    contact_person_name: string | null
    contact_person_email: string | null
    phone: string | null
    website: string | null
  } | null
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  forwarded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  interviewed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const statusIcons: Record<string, any> = {
  pending: Clock,
  under_review: Eye,
  forwarded: Send,
  interviewed: CheckCircle,
  accepted: CheckCircle,
  rejected: XCircle,
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
}

export function AdminCareers() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'careers' | 'applications'>('careers')
  
  // Applications state
  const [applications, setApplications] = useState<CareerApplication[]>([])
  const [partnerAgencies, setPartnerAgencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [selectedApplication, setSelectedApplication] = useState<CareerApplication | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [forwarding, setForwarding] = useState(false)
  const [newStatus, setNewStatus] = useState<'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected'>('pending')
  const [adminNotes, setAdminNotes] = useState('')
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  
  // Careers state
  const [careers, setCareers] = useState<Career[]>([])
  const [loadingCareers, setLoadingCareers] = useState(false)
  const [careerSearchQuery, setCareerSearchQuery] = useState('')
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null)
  const [showCareerModal, setShowCareerModal] = useState(false)
  const [showDeleteCareerModal, setShowDeleteCareerModal] = useState(false)
  const [deletingCareer, setDeletingCareer] = useState(false)
  const [savingCareer, setSavingCareer] = useState(false)
  
  // Career form fields
  const [careerForm, setCareerForm] = useState({
    title: '',
    description: '',
    requirements: '',
    responsibilities: '',
    location: '',
    employment_type: '',
    salary_range: '',
    department: '',
    is_active: true,
    is_featured: false,
    application_deadline: '',
    application_instructions: '',
    partner_agency_id: '',
  })

  useEffect(() => {
    if (isAdmin()) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  async function fetchData() {
    try {
      setLoading(true)
      const [apps, agencies] = await Promise.all([
        careerApplicationsAPI.getAll(),
        partnerAgenciesAPI.getAll()
      ])
      setApplications(apps as CareerApplication[])
      setPartnerAgencies(agencies)
      setCurrentPage(1)
    } catch (error: any) {
      console.error('Error fetching data:', error)
      showToast(error?.message || 'Failed to load data', 'error')
      setApplications([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function fetchCareers() {
    try {
      setLoadingCareers(true)
      const data = await careersAPI.getAll(true) // Include inactive
      setCareers(data as Career[])
    } catch (error: any) {
      console.error('Error fetching careers:', error)
      showToast(error?.message || 'Failed to load careers', 'error')
      setCareers([])
    } finally {
      setLoadingCareers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'careers') {
      fetchCareers()
    } else {
      fetchData()
    }
  }, [activeTab])

  const handleCreateCareer = () => {
    setSelectedCareer(null)
    setCareerForm({
      title: '',
      description: '',
      requirements: '',
      responsibilities: '',
      location: '',
      employment_type: '',
      salary_range: '',
      department: '',
      is_active: true,
      is_featured: false,
      application_deadline: '',
      application_instructions: '',
      partner_agency_id: '',
    })
    setShowCareerModal(true)
  }

  const handleEditCareer = (career: Career) => {
    setSelectedCareer(career)
    setCareerForm({
      title: career.title,
      description: career.description,
      requirements: career.requirements || '',
      responsibilities: career.responsibilities || '',
      location: career.location || '',
      employment_type: career.employment_type || '',
      salary_range: career.salary_range || '',
      department: career.department || '',
      is_active: career.is_active,
      is_featured: career.is_featured,
      application_deadline: career.application_deadline ? career.application_deadline.split('T')[0] : '',
      application_instructions: career.application_instructions || '',
      partner_agency_id: career.partner_agency_id || '',
    })
    setShowCareerModal(true)
  }

  const handleSaveCareer = async () => {
    if (!careerForm.title.trim() || !careerForm.description.trim()) {
      showToast('Title and description are required', 'error')
      return
    }

    setSavingCareer(true)
    try {
      const careerData = {
        ...careerForm,
        application_deadline: careerForm.application_deadline || null,
        partner_agency_id: careerForm.partner_agency_id || null,
        requirements: careerForm.requirements || null,
        responsibilities: careerForm.responsibilities || null,
      }

      if (selectedCareer) {
        await careersAPI.update(selectedCareer.id, careerData)
        showToast('Career updated successfully', 'success')
      } else {
        await careersAPI.create(careerData)
        showToast('Career created successfully', 'success')
      }
      setShowCareerModal(false)
      await fetchCareers()
    } catch (error: any) {
      showToast(error?.message || 'Failed to save career', 'error')
    } finally {
      setSavingCareer(false)
    }
  }

  const handleDeleteCareer = async () => {
    if (!selectedCareer) return

    setDeletingCareer(true)
    try {
      await careersAPI.delete(selectedCareer.id)
      showToast('Career deleted successfully', 'success')
      setShowDeleteCareerModal(false)
      setSelectedCareer(null)
      await fetchCareers()
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete career', 'error')
    } finally {
      setDeletingCareer(false)
    }
  }

  const filteredCareers = useMemo(() => {
    return careers.filter(career => {
      const query = careerSearchQuery.toLowerCase()
      return career.title.toLowerCase().includes(query) ||
             (career.description && career.description.toLowerCase().includes(query)) ||
             (career.location && career.location.toLowerCase().includes(query))
    })
  }, [careers, careerSearchQuery])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  const handleViewDetails = (application: CareerApplication) => {
    setSelectedApplication(application)
    setNewStatus(application.status)
    setAdminNotes(application.admin_notes || '')
    setSelectedAgencyId(application.partner_agency_id || '')
    setShowDetailsModal(true)
  }

  const handleUpdateStatus = async () => {
    if (!selectedApplication) return

    setUpdatingStatus(true)
    try {
      await careerApplicationsAPI.updateStatus(
        selectedApplication.id,
        newStatus,
        adminNotes || undefined,
        selectedAgencyId || undefined
      )
      showToast('Application status updated successfully', 'success')
      setShowStatusModal(false)
      await fetchData()
      setSelectedApplication(null)
    } catch (error: any) {
      showToast(error?.message || 'Failed to update status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleForwardToAgency = async () => {
    if (!selectedApplication || !selectedAgencyId) {
      showToast('Please select a partner agency', 'error')
      return
    }

    setForwarding(true)
    try {
      await careerApplicationsAPI.forwardToAgency(selectedApplication.id, selectedAgencyId)
      showToast('Application forwarded to partner agency successfully', 'success')
      setShowForwardModal(false)
      await fetchData()
      setSelectedApplication(null)
    } catch (error: any) {
      showToast(error?.message || 'Failed to forward application', 'error')
    } finally {
      setForwarding(false)
    }
  }

  const filteredApplications = useMemo(() => {
    let filtered = applications

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (a) =>
          a.first_name.toLowerCase().includes(query) ||
          a.last_name.toLowerCase().includes(query) ||
          a.email.toLowerCase().includes(query) ||
          a.mobile_number.includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter)
    }

    return filtered
  }, [applications, searchQuery, statusFilter])

  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredApplications.slice(start, end)
  }, [filteredApplications, currentPage, pageSize])

  const totalPages = Math.ceil(filteredApplications.length / pageSize)

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                Access denied. Admin privileges required.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Careers Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage career listings and applications
            </p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="flex space-x-1" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('careers')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'careers'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                <Briefcase className="h-4 w-4" />
                Career Listings
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'applications'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                <FileText className="h-4 w-4" />
                Applications
              </button>
            </nav>
          </div>

          {/* Careers Tab Content */}
          {activeTab === 'careers' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1 max-w-md">
                  <Input
                    type="text"
                    placeholder="Search careers..."
                    value={careerSearchQuery}
                    onChange={(e) => setCareerSearchQuery(e.target.value)}
                    rightIcon={<Search className="h-4 w-4" />}
                  />
                </div>
                <Button onClick={handleCreateCareer}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Career
                </Button>
              </div>

              {loadingCareers ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredCareers.length === 0 ? (
                <Card className="p-12 text-center">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {careerSearchQuery ? 'No careers match your search' : 'No careers yet. Create your first career listing.'}
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCareers.map((career) => (
                    <Card key={career.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                            {career.title}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {career.is_featured && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                Featured
                              </span>
                            )}
                            {!career.is_active && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                Inactive
                              </span>
                            )}
                          </div>
                          {career.location && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              📍 {career.location}
                            </p>
                          )}
                          {career.employment_type && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              ⏰ {career.employment_type}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {career.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                        <span>{career.views_count} views</span>
                        <span>{career.applications_count} applications</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCareer(career)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCareer(career)
                            setShowDeleteCareerModal(true)
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Applications Tab Content */}
          {activeTab === 'applications' && (
            <>

          {/* Filters and Search */}
          <Card className="mb-6">
            <div className="p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  rightIcon={<Search className="h-4 w-4" />}
                />
              </div>
              <div className="w-full md:w-48">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="forwarded">Forwarded</option>
                  <option value="interviewed">Interviewed</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {['pending', 'under_review', 'forwarded', 'interviewed', 'accepted', 'rejected'].map((status) => {
              const count = applications.filter((a) => a.status === status).length
              const Icon = statusIcons[status]
              return (
                <Card key={status} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${statusColors[status]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Applications List */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : paginatedApplications.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== 'all'
                  ? 'No applications match your filters'
                  : 'No career applications yet'}
              </p>
            </Card>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {paginatedApplications.map((application) => {
                  const StatusIcon = statusIcons[application.status]
                  return (
                    <Card key={application.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {application.first_name} {application.last_name}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[application.status]}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {application.status.replace('_', ' ')}
                            </span>
                            {application.partner_agencies && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {application.partner_agencies.name}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <p>Email: {application.email}</p>
                            <p>Phone: {application.mobile_number}</p>
                            <p>Applied: {formatDate(application.created_at)}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleViewDetails(application)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, filteredApplications.length)} of{' '}
                    {filteredApplications.length} applications
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Details Modal */}
          {showDetailsModal && selectedApplication && (
            <Modal
              isOpen={showDetailsModal}
              onClose={() => {
                setShowDetailsModal(false)
                setSelectedApplication(null)
              }}
              title={`Career Application - ${selectedApplication.first_name} ${selectedApplication.last_name}`}
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Name
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedApplication.first_name} {selectedApplication.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{selectedApplication.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Phone
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{selectedApplication.mobile_number}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Country
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{selectedApplication.country || 'N/A'}</p>
                  </div>
                  {selectedApplication.nursing_school && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Nursing School
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedApplication.nursing_school}
                      </p>
                    </div>
                  )}
                  {selectedApplication.years_of_experience && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Years of Experience
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedApplication.years_of_experience}
                      </p>
                    </div>
                  )}
                  {selectedApplication.license_number && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        License Number
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedApplication.license_number}
                      </p>
                    </div>
                  )}
                  {selectedApplication.license_state && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        License State
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {selectedApplication.license_state}
                      </p>
                    </div>
                  )}
                </div>

                {selectedApplication.partner_agencies && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Forwarded to Partner Agency
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">
                      {selectedApplication.partner_agencies.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedApplication.partner_agencies.contact_person_email || selectedApplication.partner_agencies.email}
                    </p>
                    {selectedApplication.forwarded_to_agency_at && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Forwarded: {formatDate(selectedApplication.forwarded_to_agency_at)}
                      </p>
                    )}
                  </div>
                )}

                {selectedApplication.admin_notes && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Admin Notes
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedApplication.admin_notes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForwardModal(true)
                    }}
                    className="flex-1"
                    disabled={!partnerAgencies.length}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Forward to Agency
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowStatusModal(true)
                    }}
                    className="flex-1"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Update Status
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Status Update Modal */}
          {showStatusModal && selectedApplication && (
            <Modal
              isOpen={showStatusModal}
              onClose={() => {
                setShowStatusModal(false)
              }}
              title="Update Application Status"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <Select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(
                        e.target.value as 'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected'
                      )
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="forwarded">Forwarded</option>
                    <option value="interviewed">Interviewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Admin Notes
                  </label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this application..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowStatusModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus}
                    className="flex-1"
                  >
                    {updatingStatus ? 'Updating...' : 'Update Status'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Forward to Agency Modal */}
          {showForwardModal && selectedApplication && (
            <Modal
              isOpen={showForwardModal}
              onClose={() => {
                setShowForwardModal(false)
              }}
              title="Forward Application to Partner Agency"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Select Partner Agency
                  </label>
                  <Select
                    value={selectedAgencyId}
                    onChange={(e) => setSelectedAgencyId(e.target.value)}
                  >
                    <option value="">Select an agency...</option>
                    {partnerAgencies
                      .filter(agency => agency.is_active)
                      .map((agency) => (
                        <option key={agency.id} value={agency.id}>
                          {agency.name}
                        </option>
                      ))}
                  </Select>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The application will be automatically forwarded to the selected partner agency via email.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowForwardModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleForwardToAgency}
                    disabled={forwarding || !selectedAgencyId}
                    className="flex-1"
                  >
                    {forwarding ? 'Forwarding...' : 'Forward Application'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
            </>
          )}

          {/* Career Create/Edit Modal */}
          {showCareerModal && (
            <Modal
              isOpen={showCareerModal}
              onClose={() => setShowCareerModal(false)}
              title={selectedCareer ? 'Edit Career' : 'Create Career'}
              size="lg"
            >
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={careerForm.title}
                    onChange={(e) => setCareerForm({ ...careerForm, title: e.target.value })}
                    placeholder="e.g., Registered Nurse - ICU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={careerForm.description}
                    onChange={(e) => setCareerForm({ ...careerForm, description: e.target.value })}
                    placeholder="Job description..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Location
                    </label>
                    <Input
                      value={careerForm.location}
                      onChange={(e) => setCareerForm({ ...careerForm, location: e.target.value })}
                      placeholder="e.g., New York, NY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Employment Type
                    </label>
                    <Select
                      value={careerForm.employment_type}
                      onChange={(e) => setCareerForm({ ...careerForm, employment_type: e.target.value })}
                      options={[
                        { value: '', label: 'Select type' },
                        { value: 'full-time', label: 'Full-time' },
                        { value: 'part-time', label: 'Part-time' },
                        { value: 'contract', label: 'Contract' },
                        { value: 'temporary', label: 'Temporary' },
                        { value: 'internship', label: 'Internship' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Salary Range
                    </label>
                    <Input
                      value={careerForm.salary_range}
                      onChange={(e) => setCareerForm({ ...careerForm, salary_range: e.target.value })}
                      placeholder="e.g., $60,000 - $80,000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Department
                    </label>
                    <Input
                      value={careerForm.department}
                      onChange={(e) => setCareerForm({ ...careerForm, department: e.target.value })}
                      placeholder="e.g., Nursing, ICU"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Requirements
                  </label>
                  <Textarea
                    value={careerForm.requirements}
                    onChange={(e) => setCareerForm({ ...careerForm, requirements: e.target.value })}
                    placeholder="Job requirements..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Responsibilities
                  </label>
                  <Textarea
                    value={careerForm.responsibilities}
                    onChange={(e) => setCareerForm({ ...careerForm, responsibilities: e.target.value })}
                    placeholder="Job responsibilities..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Application Deadline
                    </label>
                    <Input
                      type="date"
                      value={careerForm.application_deadline}
                      onChange={(e) => setCareerForm({ ...careerForm, application_deadline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Partner Agency (Optional)
                    </label>
                    <Select
                      value={careerForm.partner_agency_id}
                      onChange={(e) => setCareerForm({ ...careerForm, partner_agency_id: e.target.value })}
                      options={[
                        { value: '', label: 'None' },
                        ...partnerAgencies.map(agency => ({
                          value: agency.id,
                          label: agency.name
                        }))
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Application Instructions
                  </label>
                  <Textarea
                    value={careerForm.application_instructions}
                    onChange={(e) => setCareerForm({ ...careerForm, application_instructions: e.target.value })}
                    placeholder="Special instructions for applicants..."
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={careerForm.is_active}
                      onChange={(e) => setCareerForm({ ...careerForm, is_active: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={careerForm.is_featured}
                      onChange={(e) => setCareerForm({ ...careerForm, is_featured: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Featured</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowCareerModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveCareer}
                    disabled={savingCareer}
                    className="flex-1"
                  >
                    {savingCareer ? 'Saving...' : selectedCareer ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Delete Career Confirmation Modal */}
          {showDeleteCareerModal && selectedCareer && (
            <Modal
              isOpen={showDeleteCareerModal}
              onClose={() => {
                setShowDeleteCareerModal(false)
                setSelectedCareer(null)
              }}
              title="Delete Career"
            >
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete "{selectedCareer.title}"? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteCareerModal(false)
                      setSelectedCareer(null)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteCareer}
                    disabled={deletingCareer}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {deletingCareer ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  )
}

