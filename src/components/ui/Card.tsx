import { HTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  compact?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, children, compact = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm',
          compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6',
          className
        )}
        {...props}
      >
        {title && (
          <h3 className={cn(
            "font-semibold text-gray-900 dark:text-gray-100",
            compact ? "text-sm sm:text-base mb-2 sm:mb-3" : "text-base sm:text-lg mb-3 sm:mb-4"
          )}>
            {title}
          </h3>
        )}
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

