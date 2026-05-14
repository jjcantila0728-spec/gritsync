/**
 * Email Campaigns Tab Component
 * Manages email campaigns, newsletters, and broadcasts
 */

import { useState, useEffect } from 'react'
import { 
  Mail, 
  Plus, 
  Send, 
  Calendar,
  Users,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  Pause,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search
} from 'lucide-react'
import { emailCampaignsAPI, EmailCampaign, CampaignType, CampaignStatus } from '@/lib/email-campaigns-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { NewsletterBuilder } from './NewsletterBuilder'

interface CampaignsTabProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function CampaignsTab({ showToast }: CampaignsTabProps) {
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    scheduled: 0,
    sending: 0,
    sent: 0,
    total_emails_sent: 0,
    avg_open_rate: 0,
    avg_click_rate: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showNewsletterBuilder, setShowNewsletterBuilder] = useState(false)

  useEffect(() => {
    loadCampaigns()
    loadStats()
  }, [])

  const loadCampaigns = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter) {
        filters.status = statusFilter as CampaignStatus
      }
      if (typeFilter) {
        filters.campaign_type = typeFilter as CampaignType
      }
      const data = await emailCampaignsAPI.getAll(filters)
      setCampaigns(data)
    } catch (error: any) {
      console.error('Error loading campaigns:', error)
      showToast('Failed to load campaigns', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const allCampaigns = await emailCampaignsAPI.getAll()
      const total = allCampaigns.length
      const draft = allCampaigns.filter(c => c.status === 'draft').length
      const scheduled = allCampaigns.filter(c => c.status === 'scheduled').length
      const sending = allCampaigns.filter(c => c.status === 'sending').length
      const sent = allCampaigns.filter(c => c.status === 'sent').length
      const totalEmailsSent = allCampaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)
      
      const sentCampaigns = allCampaigns.filter(c => c.status === 'sent')
      const avgOpenRate = sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + (c.open_rate || 0), 0) / sentCampaigns.length
        : 0
      const avgClickRate = sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + (c.click_rate || 0), 0) / sentCampaigns.length
        : 0

      setStats({
        total,
        draft,
        scheduled,
        sending,
        sent,
        total_emails_sent: totalEmailsSent,
        avg_open_rate: Math.round(avgOpenRate * 100) / 100,
        avg_click_rate: Math.round(avgClickRate * 100) / 100,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return
    }

    try {
      await emailCampaignsAPI.delete(id)
      showToast('Campaign deleted successfully', 'success')
      loadCampaigns()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting campaign:', error)
      showToast(error.message || 'Failed to delete campaign', 'error')
    }
  }

  const getStatusBadge = (status: CampaignStatus) => {
    const badges = {
      draft: { icon: Edit, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: 'Draft' },
      scheduled: { icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Scheduled' },
      sending: { icon: RefreshCw, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Sending' },
      sent: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Sent' },
      paused: { icon: Pause, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Paused' },
      cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: 'Cancelled' },
      failed: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Failed' },
    }
    const badge = badges[status] || badges.draft
    const Icon = badge.icon
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', badge.color)}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    )
  }

  const getTypeBadge = (type: CampaignType) => {
    const types = {
      newsletter: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: 'Newsletter' },
      broadcast: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Broadcast' },
      announcement: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Announcement' },
      promotional: { color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400', label: 'Promotional' },
      transactional: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: 'Transactional' },
    }
    const typeInfo = types[type] || types.newsletter
    return (
      <span className={cn('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', typeInfo.color)}>
        {typeInfo.label}
      </span>
    )
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        campaign.name.toLowerCase().includes(query) ||
        campaign.subject.toLowerCase().includes(query) ||
        (campaign.description && campaign.description.toLowerCase().includes(query))
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Draft</div>
          <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">{stats.draft}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Scheduled</div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.scheduled}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sending</div>
          <div className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{stats.sending}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sent</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.sent}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Emails Sent</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total_emails_sent.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Open Rate</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.avg_open_rate.toFixed(1)}%</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Click Rate</div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.avg_click_rate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewsletterBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium"
          >
            <Plus className="h-4 w-4" />
            AI Newsletter Builder
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Manual Campaign
          </button>
        </div>

        <div className="flex flex-wrap gap-3 flex-1 justify-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search campaigns..."
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
              loadCampaigns()
            }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              loadCampaigns()
            }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="">All Types</option>
            <option value="newsletter">Newsletter</option>
            <option value="broadcast">Broadcast</option>
            <option value="announcement">Announcement</option>
            <option value="promotional">Promotional</option>
            <option value="transactional">Transactional</option>
          </select>
          <button
            onClick={() => {
              loadCampaigns()
              loadStats()
            }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="py-12">
          <Loading text="Loading campaigns..." />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No campaigns found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {campaign.name}
                      </h3>
                      {getStatusBadge(campaign.status || 'draft')}
                      {getTypeBadge(campaign.campaign_type || 'newsletter')}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate">
                      {campaign.subject}
                    </p>
                    {campaign.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                        {campaign.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign.recipient_count || 0} recipients
                      </span>
                      {campaign.sent_count && campaign.sent_count > 0 && (
                        <>
                          <span className="flex items-center gap-1">
                            <Send className="h-3 w-3" />
                            {campaign.sent_count} sent
                          </span>
                          {campaign.open_rate !== undefined && campaign.open_rate > 0 && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <Eye className="h-3 w-3" />
                              {campaign.open_rate.toFixed(1)}% open
                            </span>
                          )}
                          {campaign.click_rate !== undefined && campaign.click_rate > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <TrendingUp className="h-3 w-3" />
                              {campaign.click_rate.toFixed(1)}% click
                            </span>
                          )}
                        </>
                      )}
                      {campaign.scheduled_for && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(campaign.scheduled_for), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      {campaign.sent_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Sent {format(new Date(campaign.sent_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => {
                          // Navigate to edit campaign
                          showToast('Edit campaign feature coming soon', 'info')
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {campaign.status === 'scheduled' && (
                      <button
                        onClick={() => {
                          showToast('Cancel campaign feature coming soon', 'info')
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(campaign.id!)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Newsletter Builder Modal */}
      {showNewsletterBuilder && (
        <NewsletterBuilder
          showToast={showToast}
          onClose={() => setShowNewsletterBuilder(false)}
          onSuccess={() => {
            loadCampaigns()
            loadStats()
          }}
        />
      )}

      {/* Create Campaign Modal - Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Campaign</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Campaign creation interface coming soon. This will allow you to create newsletters, broadcasts, and other email campaigns.
              </p>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



