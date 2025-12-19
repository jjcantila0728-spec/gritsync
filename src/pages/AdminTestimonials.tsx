import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SEO } from '@/components/SEO'
import { testimonialsAPI } from '@/lib/api-client'
import {
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Award,
  User,
  MapPin,
  Calendar,
  Filter,
  MoreVertical,
  MessageSquare
} from 'lucide-react'
import { format } from 'date-fns'

interface Testimonial {
  id: string
  name: string
  email: string
  location: string | null
  service: string
  testimony: string
  image_url: string | null
  rating: number
  status: 'pending' | 'approved' | 'rejected'
  featured: boolean
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

export function AdminTestimonials() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!user || !isAdmin()) {
      navigate('/login')
      return
    }
  }, [user, isAdmin, navigate])

  useEffect(() => {
    fetchTestimonials()
  }, [statusFilter])

  const fetchTestimonials = async () => {
    try {
      setLoading(true)
      const data = await testimonialsAPI.getAll(statusFilter !== 'all' ? statusFilter : undefined)
      setTestimonials((data || []) as Testimonial[])
    } catch (error) {
      console.error('Error fetching testimonials:', error)
      showToast('Failed to load testimonials', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTestimonials()
    setRefreshing(false)
    showToast('Testimonials refreshed', 'success')
  }

  const handleApprove = async (id: string) => {
    try {
      await testimonialsAPI.update(id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id
      })
      showToast('Testimonial approved and published!', 'success')
      fetchTestimonials()
    } catch (error) {
      console.error('Error approving testimonial:', error)
      showToast('Failed to approve testimonial', 'error')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await testimonialsAPI.update(id, {
        status: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: user?.id
      })
      showToast('Testimonial rejected', 'info')
      fetchTestimonials()
    } catch (error) {
      console.error('Error rejecting testimonial:', error)
      showToast('Failed to reject testimonial', 'error')
    }
  }

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      await testimonialsAPI.update(id, { featured: !currentFeatured })
      showToast(currentFeatured ? 'Removed from featured' : 'Added to featured!', 'success')
      fetchTestimonials()
    } catch (error) {
      console.error('Error updating featured status:', error)
      showToast('Failed to update featured status', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial? This action cannot be undone.')) {
      return
    }

    try {
      await testimonialsAPI.delete(id)
      showToast('Testimonial deleted', 'success')
      fetchTestimonials()
      setShowModal(false)
    } catch (error) {
      console.error('Error deleting testimonial:', error)
      showToast('Failed to delete testimonial', 'error')
    }
  }

  const filteredTestimonials = testimonials.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.testimony.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        )
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        )
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <SEO 
        title="Manage Testimonials - Admin | GritSync"
        description="Review and manage client testimonials"
        noIndex={true}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 sm:pt-24 lg:ml-64">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Testimonials
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Review and manage client testimonials
                  </p>
                </div>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <Card className="mb-6 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search testimonials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </Card>

              {loading ? (
                <div className="grid gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-6 animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </Card>
                  ))}
                </div>
              ) : filteredTestimonials.length === 0 ? (
                <Card className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    No testimonials found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : 'Testimonials will appear here when clients submit them'}
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredTestimonials.map((testimonial) => (
                    <Card key={testimonial.id} className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-4 mb-4">
                            {testimonial.image_url ? (
                              <img
                                src={testimonial.image_url}
                                alt={testimonial.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <User className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                  {testimonial.name}
                                </h3>
                                {getStatusBadge(testimonial.status)}
                                {testimonial.featured && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                    <Award className="h-3 w-3" />
                                    Featured
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {testimonial.email}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {testimonial.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {testimonial.location}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(testimonial.created_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mb-3">
                            {renderStars(testimonial.rating)}
                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                              {testimonial.service}
                            </span>
                          </div>

                          <p className="text-gray-700 dark:text-gray-300 line-clamp-3">
                            "{testimonial.testimony}"
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTestimonial(testimonial)
                              setShowModal(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {testimonial.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(testimonial.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(testimonial.id)}
                                className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleFeatured(testimonial.id, testimonial.featured)}
                          >
                            <Award className={`h-4 w-4 mr-1 ${testimonial.featured ? 'text-purple-600' : ''}`} />
                            {testimonial.featured ? 'Unfeature' : 'Feature'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {showModal && selectedTestimonial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  {selectedTestimonial.image_url ? (
                    <img
                      src={selectedTestimonial.image_url}
                      alt={selectedTestimonial.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedTestimonial.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {selectedTestimonial.email}
                    </p>
                    {selectedTestimonial.location && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedTestimonial.location}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {renderStars(selectedTestimonial.rating)}
                  {getStatusBadge(selectedTestimonial.status)}
                  {selectedTestimonial.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      <Award className="h-3 w-3" />
                      Featured
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Service
                  </p>
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedTestimonial.service}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Testimonial
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    "{selectedTestimonial.testimony}"
                  </p>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Submitted on {format(new Date(selectedTestimonial.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {selectedTestimonial.status === 'pending' && (
                    <>
                      <Button onClick={() => handleApprove(selectedTestimonial.id)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReject(selectedTestimonial.id)}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleToggleFeatured(selectedTestimonial.id, selectedTestimonial.featured)}
                  >
                    <Award className={`h-4 w-4 mr-2 ${selectedTestimonial.featured ? 'text-purple-600' : ''}`} />
                    {selectedTestimonial.featured ? 'Remove from Featured' : 'Add to Featured'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(selectedTestimonial.id)}
                    className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
