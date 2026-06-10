import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  /** Optional call to action (button or link). */
  action?: ReactNode
  className?: string
}

// Shared empty state so lists, tables and panels all communicate "nothing
// here yet" the same way instead of each page improvising its own.
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/60">
          <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
