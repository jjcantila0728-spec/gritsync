import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { CardSkeleton } from '@/components/ui/Loading'
import { donationsAPI } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import { 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Eye
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface Donation {
  id: string
  donor_name: string | null
  donor_email: string | null
  donor_phone: string | null
  is_anonymous: boolean
  amount: number
  currency: string
  payment_method: string | null
  stripe_payment_intent_id: string | null
  transaction_id: string | null
  sponsorship_id: string | null
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  message: string | null
  created_at: string
  updated_at: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

const statusIcons: Record<string, any> = {
  pending: Clock,
  completed: CheckCircle,
  failed: XCircle,
  refunded: DollarSign,
}

export function AdminDonations() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState({ total: 0, count: 0, pending: 0, failed: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    if (isAdmin()) {
      fetchDonations()
      fetchStats()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  async function fetchDonations() {
    try {
      setLoading(true)
      const data = await donationsAPI.getAll()
      setDonations(data as Donation[])
      setCurrentPage(1)
    } catch (error: any) {
      console.error('Error fetching donations:', error)
      showToast(error?.message || 'Failed to load donations', 'error')
      setDonations([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function fetchStats() {
    try {
      const statsData = await donationsAPI.getStats()
      setStats(statsData)
    } catch (error: any) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchDonations(), fetchStats()])
  }

  const handleViewDetails = (donation: Donation) => {
    setSelectedDonation(donation)
    setShowDetailsModal(true)
  }

  const filteredDonations = useMemo(() => {
    let filtered = donations

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (d) =>
          (d.donor_name && d.donor_name.toLowerCase().includes(query)) ||
          (d.donor_email && d.donor_email.toLowerCase().includes(query)) ||
          (d.donor_phone && d.donor_phone.includes(query)) ||
          d.transaction_id?.toLowerCase().includes(query) ||
          d.stripe_payment_intent_id?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter)
    }

    return filtered
  }, [donations, searchQuery, statusFilter])

  const paginatedDonations = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredDonations.slice(start, end)
  }, [filteredDonations, currentPage, pageSize])

  const totalPages = Math.ceil(filteredDonations.length / pageSize)

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
              Donations
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage donations to support nurses' USRN dreams
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(stats.total)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Donated</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.count}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.pending}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.failed}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6">
            <div className="p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by name, email, phone, or transaction ID..."
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
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
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

          {/* Donations List */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : paginatedDonations.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || statusFilter !== 'all'
                  ? 'No donations match your filters'
                  : 'No donations yet'}
              </p>
            </Card>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {paginatedDonations.map((donation) => {
                  const StatusIcon = statusIcons[donation.status]
                  return (
                    <Card key={donation.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {donation.is_anonymous
                                ? 'Anonymous Donor'
                                : donation.donor_name || donation.donor_email || 'Unknown'}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[donation.status]}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {donation.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              Amount: {formatCurrency(donation.amount)}
                            </p>
                            {!donation.is_anonymous && donation.donor_email && (
                              <p>Email: {donation.donor_email}</p>
                            )}
                            <p>Date: {formatDate(donation.created_at)}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleViewDetails(donation)}
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
                    {Math.min(currentPage * pageSize, filteredDonations.length)} of{' '}
                    {filteredDonations.length} donations
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
          {showDetailsModal && selectedDonation && (
            <Modal
              isOpen={showDetailsModal}
              onClose={() => {
                setShowDetailsModal(false)
                setSelectedDonation(null)
              }}
              title={`Donation Details - ${formatCurrency(selectedDonation.amount)}`}
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Donor Name
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedDonation.is_anonymous
                        ? 'Anonymous'
                        : selectedDonation.donor_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedDonation.is_anonymous
                        ? 'Hidden'
                        : selectedDonation.donor_email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Phone
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedDonation.is_anonymous
                        ? 'Hidden'
                        : selectedDonation.donor_phone || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Amount
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">
                      {formatCurrency(selectedDonation.amount)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedDonation.status]}`}
                    >
                      {selectedDonation.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Payment Method
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {selectedDonation.payment_method || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Transaction ID
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                      {selectedDonation.transaction_id || selectedDonation.stripe_payment_intent_id || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Date
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {formatDate(selectedDonation.created_at)}
                    </p>
                  </div>
                </div>

                {selectedDonation.message && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Message
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedDonation.message}
                    </p>
                  </div>
                )}
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  )
}



