import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  help?: string
  rightIcon?: ReactNode
  onRightIconClick?: () => void
  compact?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, help, rightIcon, onRightIconClick, compact = false, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className={cn(
            "block font-medium text-gray-700 dark:text-gray-300",
            compact ? "text-xs sm:text-sm mb-0.5" : "text-sm mb-1"
          )}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            className={cn(
              'w-full border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              compact ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2 text-sm sm:text-base',
              error && 'border-red-500 focus:ring-red-500',
              rightIcon && 'pr-10',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {rightIcon}
            </button>
          )}
        </div>
        {help && !error && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{help}</p>
        )}
        {error && (
          <p className={cn("mt-1 text-red-600 dark:text-red-400", compact ? "text-xs" : "text-sm")}>{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

