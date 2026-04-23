/**
 * Personalized Recommendations Component
 * Provides intelligent recommendations based on user's application status, documents, and activity
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Lightbulb, 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Calendar,
  UserCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from '@/lib/utils'
import { applicationsAPI, userDocumentsAPI, applicationPaymentsAPI, userDetailsAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Recommendation {
  id: string
  type: 'document' | 'payment' | 'application' | 'profile' | 'deadline' | 'action'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionLabel: string
  actionUrl: string
  icon: React.ReactNode
  badge?: string
  estimatedTime?: string
}

interface PersonalizedRecommendationsProps {
  className?: string
  maxRecommendations?: number
}

export function PersonalizedRecommendations({ 
  className,
  maxRecommendations = 5 
}: PersonalizedRecommendationsProps) {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadRecommendations()
    }
  }, [user])

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      const recs: Recommendation[] = []

      // Get user's applications
      const applications = await applicationsAPI.getAll()
      const pendingApplications = applications.filter(
        (app: any) => app.status === 'pending' || app.status === 'in_review' || app.status === 'submitted'
      )

      // Get user's documents
      const documents = await userDocumentsAPI.getAll()
      const missingDocuments = documents.filter(
        (doc: any) => !doc.file_path || doc.status === 'pending'
      )

      // Get pending payments
      const payments = await applicationPaymentsAPI.getAll()
      const pendingPayments = payments.filter(
        (payment: any) => payment.status === 'pending' || payment.status === 'processing'
      )

      // Recommendation 1: Complete profile if incomplete
      const userDetails = await userDetailsAPI.get().catch(() => null)
      const profileComplete = userDetails?.first_name && 
                             userDetails?.last_name && 
                             userDetails?.date_of_birth &&
                             userDetails?.mobile_number
      
      if (!profileComplete) {
        recs.push({
          id: 'profile-complete',
          type: 'profile',
          priority: 'high',
          title: 'Complete Your Profile',
          description: 'Complete your profile information to speed up application processing.',
          actionLabel: 'Update Profile',
          actionUrl: '/my-details',
          icon: <UserCheck className="h-5 w-5" />,
          estimatedTime: '5 min'
        })
      }

      // Recommendation 2: Upload missing documents
      if (missingDocuments.length > 0) {
        recs.push({
          id: 'upload-documents',
          type: 'document',
          priority: 'high',
          title: `Upload ${missingDocuments.length} Missing Document${missingDocuments.length > 1 ? 's' : ''}`,
          description: 'Upload required documents to complete your application.',
          actionLabel: 'Upload Documents',
          actionUrl: '/my-details',
          icon: <FileText className="h-5 w-5" />,
          badge: `${missingDocuments.length} pending`,
          estimatedTime: '10 min'
        })
      }

      // Recommendation 3: Make pending payments
      if (pendingPayments.length > 0) {
        const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
        recs.push({
          id: 'make-payment',
          type: 'payment',
          priority: 'high',
          title: `Complete ${pendingPayments.length} Pending Payment${pendingPayments.length > 1 ? 's' : ''}`,
          description: `Total pending: $${totalPending.toFixed(2)}. Complete payments to continue processing.`,
          actionLabel: 'View Payments',
          actionUrl: '/payments',
          icon: <DollarSign className="h-5 w-5" />,
          badge: `$${totalPending.toFixed(0)}`,
          estimatedTime: '5 min'
        })
      }

      // Recommendation 4: Submit pending applications
      if (pendingApplications.length > 0) {
        const incompleteApps = pendingApplications.filter((app: any) => {
          // Check if application is incomplete (has draft status or missing required fields)
          return app.status === 'draft' || app.status === 'pending'
        })

        if (incompleteApps.length > 0) {
          recs.push({
            id: 'submit-application',
            type: 'application',
            priority: 'medium',
            title: `Complete ${incompleteApps.length} Application${incompleteApps.length > 1 ? 's' : ''}`,
            description: 'Finish and submit your pending applications to start processing.',
            actionLabel: 'View Applications',
            actionUrl: '/applications',
            icon: <FileText className="h-5 w-5" />,
            badge: `${incompleteApps.length} pending`,
            estimatedTime: '15 min'
          })
        }
      }

      // Recommendation 5: Check application status
      const inProgressApps = applications.filter(
        (app: any) => app.status === 'in_review' || app.status === 'processing'
      )
      if (inProgressApps.length > 0) {
        recs.push({
          id: 'check-status',
          type: 'application',
          priority: 'low',
          title: 'Track Your Applications',
          description: `${inProgressApps.length} application${inProgressApps.length > 1 ? 's are' : ' is'} currently being processed.`,
          actionLabel: 'View Status',
          actionUrl: '/tracking',
          icon: <TrendingUp className="h-5 w-5" />,
          badge: `${inProgressApps.length} active`
        })
      }

      // Recommendation 6: Review upcoming deadlines
      const upcomingDeadlines = applications.filter((app: any) => {
        if (!app.deadline) return false
        const deadline = new Date(app.deadline)
        const now = new Date()
        const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntilDeadline > 0 && daysUntilDeadline <= 30
      })

      if (upcomingDeadlines.length > 0) {
        recs.push({
          id: 'upcoming-deadlines',
          type: 'deadline',
          priority: 'high',
          title: `${upcomingDeadlines.length} Upcoming Deadline${upcomingDeadlines.length > 1 ? 's' : ''}`,
          description: 'Review and prepare for upcoming application deadlines.',
          actionLabel: 'View Deadlines',
          actionUrl: '/tracking',
          icon: <Calendar className="h-5 w-5" />,
          badge: `${upcomingDeadlines.length} soon`,
          estimatedTime: '10 min'
        })
      }

      // Sort by priority (high > medium > low) and limit
      const sortedRecs = recs
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        })
        .slice(0, maxRecommendations)

      setRecommendations(sortedRecs)
    } catch (error) {
      console.error('Error loading recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
      case 'medium':
        return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    }
  }

  if (loading) {
    return (
      <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Personalized Recommendations
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Personalized Recommendations
          </h3>
        </div>
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            Great job! You're all caught up. No urgent actions needed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Personalized Recommendations
          </h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {recommendations.length} suggestion{recommendations.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <Link
            key={rec.id}
            to={rec.actionUrl}
            className={cn(
              'block p-4 rounded-lg border-2 transition-all hover:shadow-md',
              getPriorityColor(rec.priority),
              'hover:scale-[1.02'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex-shrink-0 p-2 rounded-lg',
                rec.priority === 'high' && 'bg-red-100 dark:bg-red-900/30',
                rec.priority === 'medium' && 'bg-yellow-100 dark:bg-yellow-900/30',
                rec.priority === 'low' && 'bg-blue-100 dark:bg-blue-900/30'
              )}>
                {rec.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {rec.title}
                  </h4>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getPriorityIcon(rec.priority)}
                    {rec.badge && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                        {rec.badge}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {rec.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                    {rec.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                  {rec.estimatedTime && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ~{rec.estimatedTime}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {recommendations.length >= maxRecommendations && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/dashboard"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            View all recommendations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

