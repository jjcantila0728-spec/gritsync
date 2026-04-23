import { HTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm p-6',
          className
        )}
        {...props}
      >
        {title && (
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        )}
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

