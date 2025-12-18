// @ts-nocheck
/**
 * Scheduled Emails Tab Component
 * Displays and manages scheduled emails from the email queue
 */

import { useState, useEffect } from 'react'
import { 
  Clock, 
  Send, 
  XCircle, 
  RefreshCw, 
  Search, 
  Filter,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit
} from 'lucide-react'
import { emailQueueAPI, EmailQueueItem } from '@/lib/email-queue-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format as formatDate } from 'date-fns'

interface ScheduledEmailsTabProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function ScheduledEmailsTab({ showToast }: ScheduledEmailsTabProps) {
  const [loading, setLoading] = useState(true)
  const [scheduledEmails, setScheduledEmails] = useState<EmailQueueItem[]>([])
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    scheduled_today: 0,
    scheduled_this_week: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadScheduledEmails()
    loadStats()
  }, [])

  const loadScheduledEmails = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter) {
        filters.status = statusFilter as any
      }
      const emails = await emailQueueAPI.getAll(filters)
      setScheduledEmails(emails)
    } catch (error: any) {
      console.error('Error loading scheduled emails:', error)
      showToast('Failed to load scheduled emails. Email queue table may not exist yet.', 'error')
      // Set empty array so the component still renders
      setScheduledEmails([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const queueStats = await emailQueueAPI.getStats()
      setStats(queueStats)
    } catch (error) {
      console.error('Error loading queue stats:', error)
      // Set empty stats so component still renders
      setStats({
        total: 0,
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        scheduled_today: 0,
        scheduled_this_week: 0,
      })
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) {
      return
    }

    try {
      await emailQueueAPI.cancel(id)
      showToast('Email cancelled successfully', 'success')
      loadScheduledEmails()
      loadStats()
    } catch (error: any) {
      console.error('Error cancelling email:', error)
      showToast(error.message || 'Failed to cancel email', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled email? This action cannot be undone.')) {
      return
    }

    try {
      await emailQueueAPI.delete(id)
      showToast('Email deleted successfully', 'success')
      loadScheduledEmails()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting email:', error)
      showToast(error.message || 'Failed to delete email', 'error')
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmails.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredEmails.map(e => e.id!)))
    }
  }

  const filteredEmails = scheduledEmails.filter(email => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        email.recipient_email.toLowerCase().includes(query) ||
        email.subject.toLowerCase().includes(query) ||
        (email.recipient_name && email.recipient_name.toLowerCase().includes(query))
      )
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
      processing: { icon: RefreshCw, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Processing' },
      sent: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Sent' },
      failed: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Failed' },
      cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: 'Cancelled' },
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

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pending</div>
          <div className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processing</div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.processing}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sent</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.sent}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Failed</div>
          <div className="text-lg font-semibold text-red-600 dark:text-red-400">{stats.failed}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Today</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.scheduled_today}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Week</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.scheduled_this_week}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by recipient, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            loadScheduledEmails()
          }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => {
            loadScheduledEmails()
            loadStats()
          }}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Email List */}
      {loading ? (
        <div className="py-12">
          <Loading text="Loading scheduled emails..." />
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No scheduled emails found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(email.id!)}
                    onChange={() => toggleSelection(email.id!)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {email.recipient_name || email.recipient_email}
                          </span>
                          {getStatusBadge(email.status || 'pending')}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                          {email.subject}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(new Date(email.scheduled_for), 'MMM d, yyyy h:mm a')}
                          </span>
                          {email.recipient_email && (
                            <span className="truncate">{email.recipient_email}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {email.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleCancel(email.id!)}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(email.id!)}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {email.status === 'failed' && (
                          <button
                            onClick={() => handleDelete(email.id!)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

