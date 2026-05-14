/**
 * Quick Actions Panel Component
 * Provides quick access to common actions for clients
 */

import { Link } from 'react-router-dom'
import { 
  FileText, 
  Plus, 
  DollarSign, 
  Upload, 
  Settings,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  badge?: number
  description?: string
}

interface QuickActionsPanelProps {
  pendingApplications?: number
  pendingPayments?: number
  pendingDocuments?: number
  upcomingDeadlines?: number
  className?: string
}

export function QuickActionsPanel({
  pendingApplications = 0,
  pendingPayments = 0,
  pendingDocuments = 0,
  upcomingDeadlines = 0,
  className
}: QuickActionsPanelProps) {
  const quickActions: QuickAction[] = [
    {
      id: 'new-application',
      label: 'New Application',
      icon: Plus,
      href: '/application/new',
      color: 'bg-primary-600 hover:bg-primary-700 text-white',
      description: 'Start a new NCLEX application'
    },
    {
      id: 'view-applications',
      label: 'My Applications',
      icon: FileText,
      href: '/tracking',
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      badge: pendingApplications,
      description: 'View and track all your applications'
    },
    {
      id: 'make-payment',
      label: 'Make Payment',
      icon: DollarSign,
      href: '/dashboard',
      color: 'bg-green-600 hover:bg-green-700 text-white',
      badge: pendingPayments,
      description: 'Pay for your applications'
    },
    {
      id: 'upload-documents',
      label: 'Upload Documents',
      icon: Upload,
      href: '/documents',
      color: 'bg-purple-600 hover:bg-purple-700 text-white',
      badge: pendingDocuments,
      description: 'Upload required documents'
    },
    {
      id: 'view-quotations',
      label: 'My Quotations',
      icon: DollarSign,
      href: '/quotations',
      color: 'bg-orange-600 hover:bg-orange-700 text-white',
      description: 'View your quotations'
    },
    {
      id: 'account-settings',
      label: 'Settings',
      icon: Settings,
      href: '/account-settings',
      color: 'bg-gray-600 hover:bg-gray-700 text-white',
      description: 'Manage your account settings'
    }
  ]

  const urgentActions: QuickAction[] = [
    ...(pendingPayments > 0 ? [{
      id: 'urgent-payment',
      label: 'Payment Required',
      icon: AlertCircle,
      href: '/dashboard',
      color: 'bg-red-600 hover:bg-red-700 text-white',
      badge: pendingPayments,
      description: `${pendingPayments} payment(s) pending`
    }] : []),
    ...(pendingDocuments > 0 ? [{
      id: 'urgent-documents',
      label: 'Documents Needed',
      icon: Upload,
      href: '/documents',
      color: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      badge: pendingDocuments,
      description: `${pendingDocuments} document(s) required`
    }] : []),
    ...(upcomingDeadlines > 0 ? [{
      id: 'upcoming-deadlines',
      label: 'Upcoming Deadlines',
      icon: Clock,
      href: '/tracking',
      color: 'bg-orange-600 hover:bg-orange-700 text-white',
      badge: upcomingDeadlines,
      description: `${upcomingDeadlines} deadline(s) approaching`
    }] : [])
  ]

  return (
    <div className={cn('space-y-4', className)}>
      {/* Urgent Actions */}
      {urgentActions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Action Required
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.id}
                  to={action.href}
                  className={cn(
                    'group relative p-4 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md',
                    action.color
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-5 w-5" />
                        <span className="font-medium text-sm">{action.label}</span>
                      </div>
                      {action.description && (
                        <p className="text-xs opacity-90 mt-1">{action.description}</p>
                      )}
                    </div>
                    {action.badge && action.badge > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm">
                        {action.badge}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary-500" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.id}
                to={action.href}
                className={cn(
                  'group relative p-4 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-gray-700',
                  action.color
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-5 w-5" />
                      <span className="font-medium text-sm">{action.label}</span>
                    </div>
                    {action.description && (
                      <p className="text-xs opacity-90 mt-1">{action.description}</p>
                    )}
                  </div>
                  {action.badge && action.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm">
                      {action.badge}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}



