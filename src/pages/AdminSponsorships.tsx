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
import { sponsorshipsAPI } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  Award,
  FileText,
  MessageSquare
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface Sponsorship {
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
  current_employment_status: string | null
  years_of_experience: string | null
  financial_need_description: string
  motivation_statement: string
  how_will_this_help: string | null
  resume_path: string | null
  transcript_path: string | null
  recommendation_letter_path: string | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  awarded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const statusIcons: Record<string, any> = {
  pending: Clock,
  under_review: Eye,
  approved: CheckCircle,
  rejected: XCircle,
  awarded: Award,
}

export function AdminSponsorships() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [selectedSponsorship, setSelectedSponsorship] = useState<Sponsorship | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState<'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded'>('pending')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (isAdmin()) {
      fetchSponsorships()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  async function fetchSponsorships() {
    try {
      setLoading(true)
      const data = await sponsorshipsAPI.getAll()
      setSponsorships(data as Sponsorship[])
      setCurrentPage(1)
    } catch (error: any) {
      console.error('Error fetching sponsorships:', error)
      showToast(error?.message || 'Failed to load sponsorships', 'error')
      setSponsorships([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSponsorships()
  }

  const handleViewDetails = (sponsorship: Sponsorship) => {
    setSelectedSponsorship(sponsorship)
    setNewStatus(sponsorship.status)
    setAdminNotes(sponsorship.admin_notes || '')
    setShowDetailsModal(true)
  }

  const handleUpdateStatus = async () => {
    if (!selectedSponsorship) return

    setUpdatingStatus(true)
    try {
      await sponsorshipsAPI.updateStatus(selectedSponsorship.id, newStatus, adminNotes || undefined)
      showToast('Sponsorship status updated successfully', 'success')
      setShowStatusModal(false)
      await fetchSponsorships()
      setSelectedSponsorship(null)
    } catch (error: any) {
      showToast(error?.message || 'Failed to update status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const filteredSponsorships = useMemo(() => {
    let filtered = sponsorships

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.first_name.toLowerCase().includes(query) ||
          s.last_name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.mobile_number.includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter)
    }

    return filtered
  }, [sponsorships, searchQuery, statusFilter])

  const paginatedSponsorships = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredSponsorships.slice(start, end)
  }, [filteredSponsorships, currentPage, pageSize])

  const totalPages = Math.ceil(filteredSponsorships.length / pageSize)

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
              NCLEX Sponsorships
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage sponsorship applications from nurses
            </p>
          </div>

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
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="awarded">Awarded</option>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {['pending', 'under_review', 'approved', 'rejected', 'awarded'].map((status) => {
              const count = sponsorships.filter((s) => s.status === status).length
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

          {/* Sponsorships List */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : paginatedSponsorships.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== 'all'
                  ? 'No sponsorships match your filters'
                  : 'No sponsorship applications yet'}
              </p>
            </Card>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {paginatedSponsorships.map((sponsorship) => {
                  const StatusIcon = statusIcons[sponsorship.status]
                  return (
                    <Card key={sponsorship.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {sponsorship.first_name} {sponsorship.last_name}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[sponsorship.status]}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {sponsorship.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <p>Email: {sponsorship.email}</p>
                            <p>Phone: {sponsorship.mobile_number}</p>
                            <p>Applied: {formatDate(sponsorship.created_at)}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleViewDetails(sponsorship)}
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
                    {Math.min(currentPage * pageSize, filteredSponsorships.length)} of{' '}
                    {filteredSponsorships.length} sponsorships
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
          {showDetailsModal && selectedSponsorship && (
            <Modal
              isOpen={showDetailsModal}
              onClose={() => {
                setShowDetailsModal(false)
                setSelectedSponsorship(null)
              }}
              title={`Sponsorship Application - ${selectedSponsorship.first_name} ${selectedSponsorship.last_name}`}
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Name
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedSponsorship.first_name} {selectedSponsorship.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{selectedSponsorship.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Phone
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{selectedSponsorship.mobile_number}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Country
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{selectedSponsorship.country || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Nursing School
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedSponsorship.nursing_school || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Employment Status
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedSponsorship.current_employment_status || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Financial Need Description
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedSponsorship.financial_need_description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Motivation Statement
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedSponsorship.motivation_statement}
                  </p>
                </div>

                {selectedSponsorship.how_will_this_help && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      How Will This Help
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedSponsorship.how_will_this_help}
                    </p>
                  </div>
                )}

                {selectedSponsorship.admin_notes && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Admin Notes
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedSponsorship.admin_notes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
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
          {showStatusModal && selectedSponsorship && (
            <Modal
              isOpen={showStatusModal}
              onClose={() => {
                setShowStatusModal(false)
              }}
              title="Update Sponsorship Status"
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
                        e.target.value as 'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded'
                      )
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="awarded">Awarded</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Admin Notes
                  </label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this sponsorship..."
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
        </main>
      </div>
    </div>
  )
}

