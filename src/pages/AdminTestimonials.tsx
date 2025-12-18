import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SEO } from '@/components/SEO'
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
      let query = supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching testimonials:', error)
        showToast('Failed to load testimonials', 'error')
        return
      }

      setTestimonials(data || [])
    } catch (error) {
      console.error('Error:', error)
      showToast('An error occurred', 'error')
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
      const { error } = await supabase
        .from('testimonials')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id
        })
        .eq('id', id)

      if (error) {
        console.error('Error approving testimonial:', error)
        showToast('Failed to approve testimonial', 'error')
        return
      }

      showToast('Testimonial approved and published!', 'success')
      fetchTestimonials()
    } catch (error) {
      console.error('Error:', error)
      showToast('An error occurred', 'error')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: user?.id
        })
        .eq('id', id)

      if (error) {
        console.error('Error rejecting testimonial:', error)
        showToast('Failed to reject testimonial', 'error')
        return
      }

      showToast('Testimonial rejected', 'info')
      fetchTestimonials()
    } catch (error) {
      console.error('Error:', error)
      showToast('An error occurred', 'error')
    }
  }

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ featured: !currentFeatured })
        .eq('id', id)

      if (error) {
        console.error('Error updating featured status:', error)
        showToast('Failed to update featured status', 'error')
        return
      }

      showToast(currentFeatured ? 'Removed from featured' : 'Added to featured!', 'success')
      fetchTestimonials()
    } catch (error) {
      console.error('Error:', error)
      showToast('An error occurred', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting testimonial:', error)
        showToast('Failed to delete testimonial', 'error')
        return
      }

      showToast('Testimonial deleted', 'success')
      fetchTestimonials()
      setShowModal(false)
    } catch (error) {
      console.error('Error:', error)
      showToast('An error occurred', 'error')
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
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock className="h-3 w-3" />
            Pending Review
          </span>
        )
    }
  }

  const pendingCount = testimonials.filter(t => t.status === 'pending').length
  const approvedCount = testimonials.filter(t => t.status === 'approved').length
  const rejectedCount = testimonials.filter(t => t.status === 'rejected').length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SEO
        title="Manage Success Stories - Admin | GritSync"
        description="Review and manage success story submissions from clients."
      />
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Success Stories Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Review and manage client testimonials
                </p>
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{testimonials.length}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{approvedCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejectedCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Rejected</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="mb-6">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search testimonials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={statusFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={statusFilter === 'pending' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('pending')}
                    >
                      Pending
                    </Button>
                    <Button
                      variant={statusFilter === 'approved' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('approved')}
                    >
                      Approved
                    </Button>
                    <Button
                      variant={statusFilter === 'rejected' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('rejected')}
                    >
                      Rejected
                    </Button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-600" />
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Loading testimonials...</p>
                </div>
              ) : filteredTestimonials.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No testimonials found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTestimonials.map((testimonial) => (
                    <div key={testimonial.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {testimonial.image_url ? (
                            <img
                              src={testimonial.image_url}
                              alt={testimonial.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <User className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
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
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <span>{testimonial.email}</span>
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
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                            {testimonial.testimony}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {testimonial.service}
                            </span>
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedTestimonial(testimonial); setShowModal(true) }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {testimonial.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(testimonial.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(testimonial.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {testimonial.status === 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleFeatured(testimonial.id, testimonial.featured)}
                              className={testimonial.featured ? 'text-purple-600' : 'text-gray-400'}
                              title={testimonial.featured ? 'Remove from Featured' : 'Add to Featured'}
                            >
                              <Award className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {showModal && selectedTestimonial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {selectedTestimonial.image_url ? (
                    <img
                      src={selectedTestimonial.image_url}
                      alt={selectedTestimonial.name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedTestimonial.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{selectedTestimonial.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {getStatusBadge(selectedTestimonial.status)}
                  {selectedTestimonial.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      <Award className="h-3 w-3" />
                      Featured
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Location:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedTestimonial.location || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Service:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedTestimonial.service}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Submitted:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {format(new Date(selectedTestimonial.created_at), 'MMMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Rating:</span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < selectedTestimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Testimony:</span>
                  <p className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedTestimonial.testimony}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {selectedTestimonial.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => { handleApprove(selectedTestimonial.id); setShowModal(false) }}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve & Publish
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { handleReject(selectedTestimonial.id); setShowModal(false) }}
                        className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  {selectedTestimonial.status === 'approved' && (
                    <Button
                      variant="outline"
                      onClick={() => handleToggleFeatured(selectedTestimonial.id, selectedTestimonial.featured)}
                      className="flex-1"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      {selectedTestimonial.featured ? 'Remove from Featured' : 'Add to Featured'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(selectedTestimonial.id)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
