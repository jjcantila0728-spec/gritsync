/**
 * Subscribers Tab Component
 * Manages email subscribers for newsletters and campaigns
 */

import { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Edit,
  X,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react'
import { subscribersAPI, EmailSubscriber, SubscriberStats } from '@/lib/subscribers-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface SubscribersTabProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function SubscribersTab({ showToast }: SubscribersTabProps) {
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([])
  const [stats, setStats] = useState<SubscriberStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sourceFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSubscriber, setEditingSubscriber] = useState<EmailSubscriber | null>(null)

  useEffect(() => {
    loadSubscribers()
    loadStats()
  }, [statusFilter, sourceFilter])

  const loadSubscribers = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter) {
        filters.status = statusFilter
      }
      if (sourceFilter) {
        filters.source = sourceFilter
      }
      if (searchQuery) {
        filters.search = searchQuery
      }
      const data = await subscribersAPI.getAll(filters)
      setSubscribers(data)
    } catch (error: any) {
      console.error('Error loading subscribers:', error)
      showToast('Failed to load subscribers. Table may not exist yet.', 'error')
      setSubscribers([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await subscribersAPI.getStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats({
        subscribed_count: 0,
        unsubscribed_count: 0,
        bounced_count: 0,
        complained_count: 0,
        pending_count: 0,
        total_count: 0,
        subscribed_percentage: 0,
        new_this_week: 0,
        new_this_month: 0,
        unsubscribed_this_week: 0,
        unsubscribed_this_month: 0,
      })
    }
  }

  const handleSearch = () => {
    loadSubscribers()
  }

  const handleAddSubscriber = async (subscriber: Omit<EmailSubscriber, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await subscribersAPI.subscribe(subscriber)
      showToast('Subscriber added successfully', 'success')
      setShowAddModal(false)
      loadSubscribers()
      loadStats()
    } catch (error: any) {
      console.error('Error adding subscriber:', error)
      showToast(error.message || 'Failed to add subscriber', 'error')
    }
  }

  const handleEditSubscriber = async (id: string, updates: Partial<EmailSubscriber>) => {
    try {
      await subscribersAPI.update(id, updates)
      showToast('Subscriber updated successfully', 'success')
      setShowEditModal(false)
      setEditingSubscriber(null)
      loadSubscribers()
      loadStats()
    } catch (error: any) {
      console.error('Error updating subscriber:', error)
      showToast(error.message || 'Failed to update subscriber', 'error')
    }
  }

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) {
      return
    }

    try {
      await subscribersAPI.delete(id)
      showToast('Subscriber deleted successfully', 'success')
      loadSubscribers()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting subscriber:', error)
      showToast(error.message || 'Failed to delete subscriber', 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} subscribers?`)) {
      return
    }

    try {
      for (const id of selectedIds) {
        await subscribersAPI.delete(id)
      }
      showToast(`${selectedIds.size} subscribers deleted successfully`, 'success')
      setSelectedIds(new Set())
      loadSubscribers()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting subscribers:', error)
      showToast(error.message || 'Failed to delete subscribers', 'error')
    }
  }

  const handleExport = async () => {
    try {
      const csv = await subscribersAPI.exportToCSV({
        status: statusFilter as any,
        source: sourceFilter,
        search: searchQuery,
      })
      
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      showToast('Subscribers exported successfully', 'success')
    } catch (error: any) {
      console.error('Error exporting subscribers:', error)
      showToast(error.message || 'Failed to export subscribers', 'error')
    }
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const subscribers = subscribersAPI.parseCSV(text)
      
      if (subscribers.length === 0) {
        showToast('No valid subscribers found in CSV file', 'warning')
        return
      }

      const result = await subscribersAPI.bulkImport(subscribers)
      
      showToast(
        `Import complete: ${result.success} successful, ${result.failed} failed`,
        result.failed > 0 ? 'warning' : 'success'
      )
      
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors)
      }

      setShowImportModal(false)
      loadSubscribers()
      loadStats()
    } catch (error: any) {
      console.error('Error importing subscribers:', error)
      showToast(error.message || 'Failed to import subscribers', 'error')
    }
  }

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedIds(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === subscribers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(subscribers.map(s => s.id!)))
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      subscribed: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Subscribed' },
      unsubscribed: { icon: XCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: 'Unsubscribed' },
      bounced: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Bounced' },
      complained: { icon: AlertCircle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Complained' },
      pending: { icon: RefreshCw, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Pending' },
    }
    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', badge.color)}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    )
  }

  const filteredSubscribers = subscribers.filter(sub => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        sub.email.toLowerCase().includes(query) ||
        (sub.first_name && sub.first_name.toLowerCase().includes(query)) ||
        (sub.last_name && sub.last_name.toLowerCase().includes(query))
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Subscribed</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.subscribed_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Unsubscribed</div>
            <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">{stats.unsubscribed_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bounced</div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">{stats.bounced_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">New (Week)</div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              {stats.new_this_week}
              {stats.new_this_week > 0 && <TrendingUp className="h-4 w-4" />}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rate</div>
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
              {stats.subscribed_percentage}%
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Subscriber
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-3 flex-1 justify-end">
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search subscribers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
            <option value="complained">Complained</option>
            <option value="pending">Pending</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => {
              loadSubscribers()
              loadStats()
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {selectedIds.size} subscriber(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Subscriber List */}
      {loading ? (
        <div className="py-12">
          <Loading text="Loading subscribers..." />
        </div>
      ) : filteredSubscribers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No subscribers found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-750 font-medium text-xs text-gray-500 dark:text-gray-400 uppercase">
              <div className="w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === subscribers.length && subscribers.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
              <div className="flex-1">Email</div>
              <div className="w-40">Status</div>
              <div className="w-32">Emails</div>
              <div className="w-32">Opens</div>
              <div className="w-48">Subscribed</div>
              <div className="w-24">Actions</div>
            </div>
            {filteredSubscribers.map((subscriber) => (
              <div key={subscriber.id} className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(subscriber.id!)}
                    onChange={() => toggleSelection(subscriber.id!)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{subscriber.email}</p>
                  {(subscriber.first_name || subscriber.last_name) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {subscriber.first_name} {subscriber.last_name}
                    </p>
                  )}
                </div>
                <div className="w-40">{getStatusBadge(subscriber.status)}</div>
                <div className="w-32 text-sm text-gray-600 dark:text-gray-400">{subscriber.email_count || 0}</div>
                <div className="w-32 text-sm text-gray-600 dark:text-gray-400">{subscriber.open_count || 0}</div>
                <div className="w-48 text-sm text-gray-600 dark:text-gray-400">
                  {subscriber.subscribed_at ? format(new Date(subscriber.subscribed_at), 'MMM d, yyyy') : '-'}
                </div>
                <div className="w-24 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSubscriber(subscriber)
                      setShowEditModal(true)
                    }}
                    className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSubscriber(subscriber.id!)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <AddSubscriberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSubscriber}
        />
      )}

      {/* Edit Subscriber Modal */}
      {showEditModal && editingSubscriber && (
        <EditSubscriberModal
          subscriber={editingSubscriber}
          onClose={() => {
            setShowEditModal(false)
            setEditingSubscriber(null)
          }}
          onSave={(updates) => handleEditSubscriber(editingSubscriber.id!, updates)}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

// Add Subscriber Modal Component
function AddSubscriberModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (subscriber: Omit<EmailSubscriber, 'id' | 'created_at' | 'updated_at'>) => void
}) {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    status: 'subscribed' as const,
    source: 'manual' as const,
    tags: [] as string[],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Subscriber</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="subscriber@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              Add Subscriber
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Subscriber Modal Component  
function EditSubscriberModal({
  subscriber,
  onClose,
  onSave,
}: {
  subscriber: EmailSubscriber
  onClose: () => void
  onSave: (updates: Partial<EmailSubscriber>) => void
}) {
  const [formData, setFormData] = useState({
    first_name: subscriber.first_name || '',
    last_name: subscriber.last_name || '',
    phone_number: subscriber.phone_number || '',
    status: subscriber.status,
    tags: subscriber.tags || [],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Subscriber</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={subscriber.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Import Modal Component
function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (file: File) => void
}) {
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (file) {
      onImport(file)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Subscribers</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
              <strong>CSV Format:</strong>
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-200">
              Headers: email, first_name, last_name, phone, tags (separated by semicolons)
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

