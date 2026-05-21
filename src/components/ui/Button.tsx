import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive' | 'success'
  size?: 'sm' | 'md' | 'lg'
  /** When true, disables the button AND renders an animated spinner that
   * replaces any leading icon. The button's text stays visible so the
   * operator can still tell what they clicked. */
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600': variant === 'default',
            'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800': variant === 'ghost',
            'border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800': variant === 'outline',
            'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600': variant === 'destructive',
            'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600': variant === 'success',
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-base': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
          },
          loading && 'cursor-wait',
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2
            aria-hidden="true"
            className={cn(
              'animate-spin shrink-0',
              size === 'sm' ? 'h-3.5 w-3.5 mr-1.5' : size === 'lg' ? 'h-5 w-5 mr-2' : 'h-4 w-4 mr-2'
            )}
          />
        )}
        {/* Wrap children so we can hide the leading icon (if any) while
            loading — keeps the spinner from competing with a static icon
            for the eye's attention. Text stays visible regardless. */}
        <span className={cn('inline-flex items-center', loading && '[&>svg]:hidden')}>
          {children}
        </span>
      </button>
    )
  }
)

Button.displayName = 'Button'

