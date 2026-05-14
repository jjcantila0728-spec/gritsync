/**
 * Activity Feed Component
 * Displays recent activity with real-time updates
 */

import { Link } from 'react-router-dom'
import { 
  FileText, 
  DollarSign, 
  Clock,
  Upload,
  MessageSquare,
  ArrowRight,
  Activity
} from 'lucide-react'
import { formatDate, formatDistanceToNow } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface ActivityItem {
  id: string
  type: 'application' | 'payment' | 'document' | 'notification' | 'status_change'
  title: string
  description: string
  status?: string
  date: string
  link?: string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  maxItems?: number
  showHeader?: boolean
  className?: string
  onRefresh?: () => void
}

export function ActivityFeed({
  activities,
  maxItems = 10,
  showHeader = true,
  className,
  onRefresh
}: ActivityFeedProps) {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'application':
        return FileText
      case 'payment':
        return DollarSign
      case 'document':
        return Upload
      case 'notification':
        return MessageSquare
      case 'status_change':
        return Activity
      default:
        return Activity
    }
  }

  const getActivityColor = (type: ActivityItem['type'], status?: string) => {
    if (status) {
      switch (status.toLowerCase()) {
        case 'approved':
        case 'completed':
        case 'paid':
          return 'text-green-600 dark:text-green-400'
        case 'rejected':
        case 'failed':
          return 'text-red-600 dark:text-red-400'
        case 'pending':
        case 'in_progress':
          return 'text-yellow-600 dark:text-yellow-400'
        default:
          return 'text-blue-600 dark:text-blue-400'
      }
    }
    
    switch (type) {
      case 'application':
        return 'text-primary-600 dark:text-primary-400'
      case 'payment':
        return 'text-green-600 dark:text-green-400'
      case 'document':
        return 'text-purple-600 dark:text-purple-400'
      case 'notification':
        return 'text-blue-600 dark:text-blue-400'
      case 'status_change':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null

    const statusColors: Record<string, string> = {
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    }

    const colorClass = statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'

    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colorClass)}>
        {status}
      </span>
    )
  }

  const displayedActivities = activities.slice(0, maxItems)

  if (activities.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6', className)}>
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-500" />
              Recent Activity
            </h3>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Refresh
              </button>
            )}
          </div>
        )}
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700', className)}>
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-500" />
            Recent Activity
          </h3>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Refresh
            </button>
          )}
        </div>
      )}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {displayedActivities.map((activity) => {
          const Icon = activity.icon || getActivityIcon(activity.type)
          const colorClass = activity.color || getActivityColor(activity.type, activity.status)

          const content = (
            <div className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className={cn('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', 
                colorClass.replace('text-', 'bg-').replace('-600', '-100').replace('-400', '-900/30')
              )}>
                <Icon className={cn('h-5 w-5', colorClass)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {activity.title}
                  </p>
                  {activity.status && getStatusBadge(activity.status)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(activity.date))} ago</span>
                  <span>•</span>
                  <span>{formatDate(activity.date)}</span>
                </div>
              </div>
              {activity.link && (
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
              )}
            </div>
          )

          if (activity.link) {
            return (
              <Link key={activity.id} to={activity.link}>
                {content}
              </Link>
            )
          }

          return <div key={activity.id}>{content}</div>
        })}
      </div>
      {activities.length > maxItems && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <Link
            to="/tracking"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all activity ({activities.length} total)
          </Link>
        </div>
      )}
    </div>
  )
}



