import { HTMLAttributes, ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatAccent = 'primary' | 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'cyan' | 'gray'

// Single source of truth for stat/KPI cards across client, admin, advisor and
// affiliate views. Accent drives the left bar, icon tile and value color so
// every panel reads the same visual language.
const ACCENTS: Record<StatAccent, { bar: string; iconBg: string; icon: string; value: string }> = {
  primary: { bar: 'border-l-primary-600', iconBg: 'bg-primary-100 dark:bg-primary-900/40', icon: 'text-primary-600 dark:text-primary-400', value: 'text-primary-700 dark:text-primary-300' },
  blue:    { bar: 'border-l-blue-600',    iconBg: 'bg-blue-100 dark:bg-blue-900/40',       icon: 'text-blue-600 dark:text-blue-400',       value: 'text-blue-700 dark:text-blue-300' },
  green:   { bar: 'border-l-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-300' },
  amber:   { bar: 'border-l-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-900/40',     icon: 'text-amber-600 dark:text-amber-400',     value: 'text-amber-700 dark:text-amber-300' },
  violet:  { bar: 'border-l-violet-600',  iconBg: 'bg-violet-100 dark:bg-violet-900/40',   icon: 'text-violet-600 dark:text-violet-400',   value: 'text-violet-700 dark:text-violet-300' },
  rose:    { bar: 'border-l-rose-600',    iconBg: 'bg-rose-100 dark:bg-rose-900/40',       icon: 'text-rose-600 dark:text-rose-400',       value: 'text-rose-700 dark:text-rose-300' },
  cyan:    { bar: 'border-l-cyan-600',    iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',       icon: 'text-cyan-600 dark:text-cyan-400',       value: 'text-cyan-700 dark:text-cyan-300' },
  gray:    { bar: 'border-l-gray-400',    iconBg: 'bg-gray-100 dark:bg-gray-700/60',       icon: 'text-gray-600 dark:text-gray-300',       value: 'text-gray-900 dark:text-gray-100' },
}

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  value: ReactNode
  icon?: LucideIcon
  accent?: StatAccent
  /** Small line under the value, e.g. a delta or hint. */
  sub?: ReactNode
}

export function StatCard({ label, value, icon: Icon, accent = 'primary', sub, className, ...props }: StatCardProps) {
  const a = ACCENTS[accent]
  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-5',
        'transition-shadow hover:shadow-md motion-reduce:transition-none',
        a.bar,
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums leading-tight', a.value)}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', a.iconBg)}>
            <Icon className={cn('h-5 w-5', a.icon)} />
          </div>
        )}
      </div>
    </div>
  )
}
