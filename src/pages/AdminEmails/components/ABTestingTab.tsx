// @ts-nocheck
/**
 * A/B Testing Tab Component
 * Manages A/B tests for email campaigns
 */

import { useState, useEffect } from 'react'
import {
  FlaskConical,
  Plus,
  Play,
  Square,
  Trophy,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Mail,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react'
import { abTestingAPI, ABTest, ABTestResult, ABTestVariant } from '@/lib/ab-testing-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'

interface ABTestingTabProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function ABTestingTab({ showToast }: ABTestingTabProps) {
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<ABTest[]>([])
  const [stats, setStats] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null)
  const [testResults, setTestResults] = useState<ABTestResult[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    loadTests()
    loadStats()
  }, [statusFilter])

  const loadTests = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter) {
        filters.status = statusFilter
      }
      const data = await abTestingAPI.getAll(filters)
      setTests(data)
    } catch (error: any) {
      console.error('Error loading A/B tests:', error)
      showToast('Failed to load A/B tests. Table may not exist yet.', 'error')
      setTests([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await abTestingAPI.getStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats({
        draft_count: 0,
        running_count: 0,
        completed_count: 0,
        cancelled_count: 0,
        total_count: 0,
        avg_test_duration_hours: 0,
        tests_with_winners: 0,
      })
    }
  }

  const handleCreateTest = async (test: Omit<ABTest, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await abTestingAPI.create(test)
      showToast('A/B test created successfully', 'success')
      setShowCreateModal(false)
      loadTests()
      loadStats()
    } catch (error: any) {
      console.error('Error creating test:', error)
      showToast(error.message || 'Failed to create test', 'error')
    }
  }

  const handleStartTest = async (id: string) => {
    if (!confirm('Are you sure you want to start this test?')) return

    try {
      await abTestingAPI.start(id)
      showToast('Test started successfully', 'success')
      loadTests()
      loadStats()
    } catch (error: any) {
      console.error('Error starting test:', error)
      showToast(error.message || 'Failed to start test', 'error')
    }
  }

  const handleStopTest = async (id: string) => {
    if (!confirm('Are you sure you want to stop this test?')) return

    try {
      await abTestingAPI.stop(id)
      showToast('Test stopped successfully', 'success')
      loadTests()
      loadStats()
    } catch (error: any) {
      console.error('Error stopping test:', error)
      showToast(error.message || 'Failed to stop test', 'error')
    }
  }

  const handleDetermineWinner = async (id: string) => {
    try {
      const result = await abTestingAPI.determineWinner(id)
      if (result.success) {
        showToast(`Winner selected: Variant ${result.winner_variant}!`, 'success')
        loadTests()
        loadStats()
      } else {
        showToast(result.error || 'Failed to determine winner', 'error')
      }
    } catch (error: any) {
      console.error('Error determining winner:', error)
      showToast(error.message || 'Failed to determine winner', 'error')
    }
  }

  const handleDeleteTest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test? This action cannot be undone.')) return

    try {
      await abTestingAPI.delete(id)
      showToast('Test deleted successfully', 'success')
      loadTests()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting test:', error)
      showToast(error.message || 'Failed to delete test', 'error')
    }
  }

  const handleViewResults = async (test: ABTest) => {
    try {
      setSelectedTest(test)
      // Calculate latest metrics
      await abTestingAPI.calculateMetrics(test.id!)
      const results = await abTestingAPI.getResults(test.id!)
      setTestResults(results)
      setShowResultsModal(true)
    } catch (error: any) {
      console.error('Error loading results:', error)
      showToast(error.message || 'Failed to load results', 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { icon: Edit, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: 'Draft' },
      scheduled: { icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Scheduled' },
      running: { icon: Zap, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Running' },
      analyzing: { icon: BarChart3, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: 'Analyzing' },
      completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Completed' },
      cancelled: { icon: X, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Cancelled' },
    }
    const badge = badges[status as keyof typeof badges] || badges.draft
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
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Draft</div>
            <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">{stats.draft_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Running</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.running_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Completed</div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.completed_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cancelled</div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">{stats.cancelled_count}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">With Winners</div>
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">{stats.tests_with_winners}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Duration</div>
            <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
              {stats.avg_test_duration_hours ? `${Math.round(stats.avg_test_duration_hours)}h` : '-'}
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create A/B Test
        </button>

        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => {
              loadTests()
              loadStats()
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FlaskConical className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tests List */}
      {loading ? (
        <div className="py-12">
          <Loading text="Loading A/B tests..." />
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FlaskConical className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No A/B tests found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Your First Test
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tests.map((test) => (
              <div key={test.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{test.name}</h3>
                      {getStatusBadge(test.status || 'draft')}
                      {test.winner_variant && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-medium">
                          <Trophy className="h-3 w-3" />
                          Winner: {test.winner_variant}
                        </span>
                      )}
                    </div>
                    {test.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{test.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Type: {test.test_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {test.variants?.length || 0} variants
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {test.sample_size} per variant
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Criteria: {test.winner_criteria}
                      </span>
                      {test.started_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started: {format(new Date(test.started_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {test.status === 'draft' && (
                      <button
                        onClick={() => handleStartTest(test.id!)}
                        className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded transition-colors"
                        title="Start Test"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {test.status === 'running' && (
                      <>
                        <button
                          onClick={() => handleStopTest(test.id!)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                          title="Stop Test"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDetermineWinner(test.id!)}
                          className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 rounded transition-colors"
                          title="Determine Winner"
                        >
                          <Trophy className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleViewResults(test)}
                      className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                      title="View Results"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {test.status === 'draft' && (
                      <button
                        onClick={() => handleDeleteTest(test.id!)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Test Modal */}
      {showCreateModal && (
        <CreateTestModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTest}
        />
      )}

      {/* Results Modal */}
      {showResultsModal && selectedTest && (
        <ResultsModal
          test={selectedTest}
          results={testResults}
          onClose={() => {
            setShowResultsModal(false)
            setSelectedTest(null)
            setTestResults([])
          }}
        />
      )}
    </div>
  )
}

// Create Test Modal Component
function CreateTestModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (test: Omit<ABTest, 'id' | 'created_at' | 'updated_at'>) => void
}) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Partial<ABTest>>({
    name: '',
    description: '',
    test_type: 'subject',
    variants: [
      { name: 'A', subject: '' },
      { name: 'B', subject: '' },
    ],
    sample_size: 100,
    sample_percentage: 10,
    test_duration_hours: 24,
    winner_criteria: 'open_rate',
    auto_send_winner: true,
  })

  const addVariant = () => {
    const nextLetter = String.fromCharCode(65 + (formData.variants?.length || 0))
    setFormData({
      ...formData,
      variants: [...(formData.variants || []), { name: nextLetter, subject: '' }],
    })
  }

  const removeVariant = (index: number) => {
    const newVariants = formData.variants?.filter((_, i) => i !== index) || []
    setFormData({ ...formData, variants: newVariants })
  }

  const updateVariant = (index: number, field: string, value: string) => {
    const newVariants = [...(formData.variants || [])]
    newVariants[index] = { ...newVariants[index], [field]: value }
    setFormData({ ...formData, variants: newVariants })
  }

  const handleSubmit = () => {
    const validation = abTestingAPI.validate(formData)
    if (!validation.valid) {
      alert(validation.errors.join('\n'))
      return
    }
    onCreate(formData as any)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary-600" />
              Create A/B Test
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Step {step} of 3
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Test Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Welcome Email Subject Test"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="What are you testing?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Type *
                </label>
                <select
                  value={formData.test_type}
                  onChange={(e) => setFormData({ ...formData, test_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="subject">Subject Line</option>
                  <option value="content">Email Content</option>
                  <option value="sender">Sender Name/Email</option>
                  <option value="send_time">Send Time</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sample Size (per variant)
                  </label>
                  <input
                    type="number"
                    value={formData.sample_size}
                    onChange={(e) => setFormData({ ...formData, sample_size: parseInt(e.target.value) })}
                    min="10"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Test Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={formData.test_duration_hours}
                    onChange={(e) => setFormData({ ...formData, test_duration_hours: parseInt(e.target.value) })}
                    min="1"
                    max="168"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Winner Criteria
                </label>
                <select
                  value={formData.winner_criteria}
                  onChange={(e) => setFormData({ ...formData, winner_criteria: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="open_rate">Open Rate</option>
                  <option value="click_rate">Click Rate</option>
                  <option value="conversion_rate">Conversion Rate</option>
                  <option value="engagement_score">Engagement Score</option>
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.auto_send_winner}
                  onChange={(e) => setFormData({ ...formData, auto_send_winner: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Automatically send winner to remaining recipients
                </span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Configure Variants</h3>
                <button
                  onClick={addVariant}
                  disabled={(formData.variants?.length || 0) >= 10}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Add Variant
                </button>
              </div>

              <div className="space-y-3">
                {formData.variants?.map((variant, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Variant {variant.name}</h4>
                      {formData.variants!.length > 2 && (
                        <button
                          onClick={() => removeVariant(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {formData.test_type === 'subject' && (
                      <input
                        type="text"
                        value={variant.subject || ''}
                        onChange={(e) => updateVariant(index, 'subject', e.target.value)}
                        placeholder={`Subject line for variant ${variant.name}`}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    )}
                    {formData.test_type === 'content' && (
                      <textarea
                        value={variant.content || ''}
                        onChange={(e) => updateVariant(index, 'content', e.target.value)}
                        placeholder={`Email content for variant ${variant.name}`}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Review & Confirm</h3>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">{formData.name}</h4>
                <dl className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <div className="flex justify-between">
                    <dt>Test Type:</dt>
                    <dd className="font-medium">{formData.test_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Variants:</dt>
                    <dd className="font-medium">{formData.variants?.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sample Size:</dt>
                    <dd className="font-medium">{formData.sample_size} per variant</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Duration:</dt>
                    <dd className="font-medium">{formData.test_duration_hours} hours</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Winner Criteria:</dt>
                    <dd className="font-medium">{formData.winner_criteria}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium mb-1">Before you start:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Make sure you have enough subscribers for the test</li>
                      <li>The test will run for {formData.test_duration_hours} hours</li>
                      <li>You can manually determine the winner at any time</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                ← Previous
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <Save className="h-4 w-4" />
                Create Test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Results Modal Component
function ResultsModal({
  test,
  results,
  onClose,
}: {
  test: ABTest
  results: ABTestResult[]
  onClose: () => void
}) {
  // Prepare chart data
  const chartData = results.map(r => ({
    variant: `Variant ${r.variant_name}`,
    'Open Rate': r.open_rate,
    'Click Rate': r.click_rate,
    'Engagement': r.engagement_score,
  }))

  const winner = results.find(r => r.variant_name === test.winner_variant)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{test.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              A/B Test Results
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Winner Announcement */}
          {winner && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6 text-center">
              <Trophy className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mb-2">
                Winner: Variant {winner.variant_name}!
              </h3>
              <p className="text-yellow-800 dark:text-yellow-200">
                Open Rate: {winner.open_rate}% • Click Rate: {winner.click_rate}% • Engagement: {winner.engagement_score}
              </p>
            </div>
          )}

          {/* Performance Chart */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Performance Comparison</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="variant" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Open Rate" fill="#3b82f6" />
                  <Bar dataKey="Click Rate" fill="#10b981" />
                  <Bar dataKey="Engagement" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Results */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Detailed Metrics</h3>
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.variant_name}
                  className={cn(
                    "border rounded-lg p-4",
                    result.variant_name === test.winner_variant
                      ? "border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      Variant {result.variant_name}
                      {result.variant_name === test.winner_variant && (
                        <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </h4>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {result.sent_count} sent
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Opens</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {result.opened_count} ({result.open_rate}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Clicks</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {result.clicked_count} ({result.click_rate}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Bounces</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {result.bounced_count} ({result.bounce_rate}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Engagement</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {result.engagement_score}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

