import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  unreadCount: number
  onClick: () => void
  className?: string
}

export function NotificationBell({ unreadCount, onClick, className }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        "disabled:pointer-events-none disabled:opacity-50",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        "p-2",
        className
      )}
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1">
          {/* Expanding ping ring for blink effect */}
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
          {/* Solid badge with count */}
          <span className="relative flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </button>
  )
}
