// @ts-nocheck
/**
 * Unsubscribe Page - One-Click Unsubscribe
 * Accessible at: /unsubscribe/:token
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Mail, CheckCircle2, XCircle, ArrowLeft, Settings, AlertTriangle } from 'lucide-react'
import { subscribersAPI } from '@/lib/subscribers-api'
import { Loading } from '@/components/ui/Loading'

export default function Unsubscribe() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [unsubscribed, setUnsubscribed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [reason, setReason] = useState('')
  const [showReasonForm, setShowReasonForm] = useState(false)

  const reasonOptions = [
    'I receive too many emails',
    'The content is not relevant to me',
    'I never signed up for this list',
    'The emails are too frequent',
    'I no longer need this service',
    'Other',
  ]

  const handleUnsubscribe = async (providedReason?: string) => {
    if (!token) {
      setError('Invalid or missing token')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await subscribersAPI.unsubscribe(token, providedReason || reason || 'User requested unsubscribe')
      
      if (result.success) {
        setEmail(result.email || '')
        setUnsubscribed(true)
      } else {
        setError(result.error || 'Failed to unsubscribe. Please try again.')
      }
    } catch (err: any) {
      console.error('Error unsubscribing:', err)
      setError(err.message || 'An error occurred. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (!showReasonForm && !unsubscribed && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
              <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Unsubscribe
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              We're sorry to see you go. Are you sure you want to unsubscribe from all our emails?
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowReasonForm(true)}
              disabled={loading}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Yes, Unsubscribe Me
            </button>
            
            <Link
              to={`/preferences/${token}`}
              className="block w-full px-6 py-3 border-2 border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors font-medium text-center"
            >
              <Settings className="inline-block h-5 w-5 mr-2" />
              Manage Preferences Instead
            </Link>

            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Never Mind, Take Me Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showReasonForm && !unsubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Help Us Improve
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Before you go, would you mind telling us why?
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {reasonOptions.map((option) => (
              <label
                key={option}
                className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={(e) => setReason(e.target.value)}
                  className="mr-3 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {reason === 'Other' && (
            <textarea
              placeholder="Please tell us more..."
              value={reason === 'Other' ? '' : reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
          )}

          <div className="space-y-3">
            <button
              onClick={() => handleUnsubscribe(reason)}
              disabled={loading || !reason}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Unsubscribing...
                </>
              ) : (
                'Confirm Unsubscribe'
              )}
            </button>

            <button
              onClick={() => setShowReasonForm(false)}
              disabled={loading}
              className="w-full px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading text="Processing your request..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Something Went Wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  if (unsubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            You've Been Unsubscribed
          </h1>
          {email && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              <strong>{email}</strong> has been removed from our mailing list.
            </p>
          )}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We're sorry to see you go. You won't receive any more emails from us.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Changed your mind? You can always <Link to={`/preferences/${token}`} className="underline font-medium">resubscribe</Link> or <Link to={`/preferences/${token}`} className="underline font-medium">manage your preferences</Link>.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Homepage
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

