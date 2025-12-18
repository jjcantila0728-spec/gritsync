/**
 * Email Preferences Center - Public Page
 * Allows subscribers to manage their email preferences via token
 * Accessible at: /preferences/:token
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mail, CheckCircle2, XCircle, AlertCircle, Settings, ArrowLeft, Shield } from 'lucide-react'
import { subscribersAPI, EmailSubscriber } from '@/lib/subscribers-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'

export default function EmailPreferences() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscriber, setSubscriber] = useState<EmailSubscriber | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preferences, setPreferences] = useState({
    marketing: true,
    newsletters: true,
    notifications: true,
    promotions: true,
  })

  useEffect(() => {
    loadSubscriber()
  }, [token])

  const loadSubscriber = async () => {
    if (!token) {
      setError('Invalid or missing token')
      setLoading(false)
      return
    }

    try {
      const data = await subscribersAPI.getByToken(token)
      if (!data) {
        setError('Invalid or expired token. This link may have expired.')
        setLoading(false)
        return
      }

      setSubscriber(data)
      setPreferences(data.email_preferences || {
        marketing: true,
        newsletters: true,
        notifications: true,
        promotions: true,
      })
    } catch (err: any) {
      console.error('Error loading subscriber:', err)
      setError('Failed to load your preferences. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePreferences = async () => {
    if (!token) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await subscribersAPI.updatePreferences(token, preferences)
      
      if (result.success) {
        setSuccess('Your preferences have been updated successfully!')
        // Reload subscriber data
        await loadSubscriber()
      } else {
        setError(result.error || 'Failed to update preferences')
      }
    } catch (err: any) {
      console.error('Error updating preferences:', err)
      setError(err.message || 'Failed to update preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleUnsubscribeAll = async () => {
    if (!token) return
    
    if (!confirm('Are you sure you want to unsubscribe from all emails? You can resubscribe anytime.')) {
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await subscribersAPI.unsubscribe(token, 'User requested via preferences page')
      
      if (result.success) {
        setSuccess('You have been unsubscribed successfully. We\'re sorry to see you go!')
        await loadSubscriber()
      } else {
        setError(result.error || 'Failed to unsubscribe')
      }
    } catch (err: any) {
      console.error('Error unsubscribing:', err)
      setError(err.message || 'Failed to unsubscribe. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleResubscribe = async () => {
    if (!token) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await subscribersAPI.resubscribe(token)
      
      if (result.success) {
        setSuccess('Welcome back! You have been resubscribed successfully.')
        await loadSubscriber()
      } else {
        setError(result.error || 'Failed to resubscribe')
      }
    } catch (err: any) {
      console.error('Error resubscribing:', err)
      setError(err.message || 'Failed to resubscribe. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading text="Loading your preferences..." />
      </div>
    )
  }

  if (error && !subscriber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Link
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
            <Settings className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Email Preferences
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your email subscription preferences
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {error && subscriber && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Subscriber Info Card */}
        {subscriber && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {subscriber.first_name && subscriber.last_name
                    ? `${subscriber.first_name} ${subscriber.last_name}`
                    : 'Subscriber'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{subscriber.email}</p>
              </div>
              <div>
                {subscriber.status === 'subscribed' ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Subscribed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400 rounded-full text-sm font-medium">
                    <XCircle className="h-4 w-4" />
                    Unsubscribed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preferences Form */}
        {subscriber && subscriber.status === 'subscribed' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Email Types
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Choose which types of emails you'd like to receive from us
            </p>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Marketing Emails</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Product updates, special offers, and promotions
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Newsletters</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Monthly newsletters with tips and insights
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.newsletters}
                  onChange={(e) => setPreferences({ ...preferences, newsletters: e.target.checked })}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Notifications</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Important account and service notifications
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications}
                  onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">Promotions</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Exclusive deals and promotional offers
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.promotions}
                  onChange={(e) => setPreferences({ ...preferences, promotions: e.target.checked })}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Save Preferences
                  </>
                )}
              </button>
              <button
                onClick={handleUnsubscribeAll}
                disabled={saving}
                className="px-6 py-3 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Unsubscribe from All
              </button>
            </div>
          </div>
        )}

        {/* Resubscribe Option */}
        {subscriber && subscriber.status === 'unsubscribed' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 text-center">
            <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              You're Currently Unsubscribed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {subscriber.unsubscribe_reason && (
                <>Reason: {subscriber.unsubscribe_reason}<br /></>
              )}
              Changed your mind? You can resubscribe anytime.
            </p>
            <button
              onClick={handleResubscribe}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5" />
                  Resubscribe
                </>
              )}
            </button>
          </div>
        )}

        {/* Privacy Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Your Privacy Matters
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            We respect your inbox and your privacy. Your information is secure and will never be shared with third parties.
            You can update your preferences or unsubscribe at any time.
          </p>
        </div>

        {/* Back to Home Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </button>
        </div>
      </div>
    </div>
  )
}

