import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Home, Sun, Moon, Crown, Zap, BookOpen, User } from 'lucide-react'

interface NCLEXLayoutProps {
  children: ReactNode
  subscription?: {
    plan: string
    questions_today?: number
    daily_limit?: number | null
    expires_at?: string | null
  } | null
}

const PLAN_CONFIG = {
  free: {
    label: 'Free',
    icon: BookOpen,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
  },
  premium: {
    label: 'Premium',
    icon: Zap,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
  },
  vip: {
    label: 'VIP',
    icon: Crown,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
  },
}

export function NCLEXLayout({ children, subscription }: NCLEXLayoutProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const plan = subscription?.plan || 'free'
  const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free
  const PlanIcon = planConfig.icon

  const questionsToday = subscription?.questions_today ?? 0
  const dailyLimit = subscription?.daily_limit ?? null

  const firstName = user?.first_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
          {/* Left: Home button + branding */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="Back to GritSync"
            >
              <Home className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">GritSync</span>
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">NCLEX Review</span>
            </div>
          </div>

          {/* Right: Plan badge + usage + theme + user */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Daily usage (free plan) */}
            {plan === 'free' && dailyLimit !== null && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className={`font-semibold ${questionsToday >= dailyLimit ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {questionsToday}/{dailyLimit}
                </span>
                <span>today</span>
              </div>
            )}

            {/* Plan badge */}
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${planConfig.className}`}>
              <PlanIcon className="h-3 w-3" />
              {planConfig.label}
            </span>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* User */}
            <div className="flex items-center gap-2 pl-1">
              <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 hidden md:inline">{firstName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
