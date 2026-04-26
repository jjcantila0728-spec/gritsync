import { ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  BookOpen, Video, FileText, Radio, ShoppingBag,
  ChevronLeft, Crown, Zap, Menu, X, Home,
} from 'lucide-react'

interface NCLEXLayoutProps {
  children: ReactNode
  subscription?: {
    plan: string
    questions_today?: number
    daily_limit?: number | null
    expires_at?: string | null
  } | null
}

const NAV_ITEMS = [
  { label: 'Q-Bank', icon: BookOpen, path: '/nclex-review' },
  { label: 'Video Library', icon: Video, path: '/nclex-review/video-library' },
  { label: 'Cheat Sheets', icon: FileText, path: '/nclex-review/cheat-sheets' },
  { label: 'Live Lectures', icon: Radio, path: '/nclex-review/live-lectures' },
  { label: 'Order History', icon: ShoppingBag, path: '/nclex-review/order-history' },
]

function PlanBadge({ plan }: { plan: string }) {
  if (plan === 'vip') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900">
        <Crown className="h-3 w-3" /> VIP
      </span>
    )
  }
  if (plan === 'premium') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-400 text-blue-900">
        <Zap className="h-3 w-3" /> Premium
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-500 text-white">
      Free
    </span>
  )
}

export function NCLEXLayout({ children, subscription }: NCLEXLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const plan = subscription?.plan || 'free'
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'User'
  const lastName = user?.last_name || ''
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'U'

  const expiresAt = subscription?.expires_at
  const expiresLabel = expiresAt
    ? `Expires ${new Date(expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : plan === 'free' ? 'Free Plan' : null

  const currentPath = location.pathname

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 flex-shrink-0 flex flex-col
        bg-[#0d2137] text-white
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo / Header */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#17c3b2] flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">GritSync</p>
                <p className="text-[10px] text-[#17c3b2] font-medium leading-tight">NCLEX Review</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Plan / Expiry card */}
        <div className="mx-4 mt-4 rounded-xl bg-[#163352] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#17c3b2]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-[#17c3b2]">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{firstName} {lastName}</p>
              {expiresLabel && (
                <p className="text-xs text-white/50 truncate">{expiresLabel}</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <PlanBadge plan={plan} />
            {plan === 'free' && (
              <button
                onClick={() => navigate('/nclex-review/checkout')}
                className="text-[10px] text-[#17c3b2] hover:underline font-medium"
              >
                Upgrade →
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
              const isActive = path === '/nclex-review'
                ? currentPath === '/nclex-review'
                : currentPath.startsWith(path)
              return (
                <button
                  key={path}
                  onClick={() => { navigate(path); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#17c3b2] text-white shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Back to GritSync */}
        <div className="px-3 pb-5 border-t border-white/10 pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to GritSync
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
            <span
              className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-[#17c3b2] transition-colors truncate"
              onClick={() => navigate('/nclex-review')}
            >
              NCLEX RN – Q-Bank
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {plan === 'free' && (
              <button
                onClick={() => navigate('/nclex-review/checkout')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#17c3b2] text-white text-xs font-semibold hover:bg-[#14a99a] transition-colors"
              >
                <Crown className="h-3 w-3" /> Upgrade
              </button>
            )}
            <div className="h-8 w-8 rounded-full bg-[#17c3b2] flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}

// Minimal layout for exam — no sidebar, full screen
interface ExamLayoutProps {
  children: ReactNode
  sessionId?: number
  questionNumber?: number
  totalQuestions?: number
  mode?: string
  onClose?: () => void
}

export function NCLEXExamLayout({ children, sessionId, questionNumber, totalQuestions, mode, onClose }: ExamLayoutProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'User'
  const lastName = user?.last_name || ''

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">
      {/* Top bar */}
      <header className="bg-[#0d2137] text-white h-12 flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
          <BookOpen className="h-4 w-4 text-[#17c3b2] flex-shrink-0" />
          <span className="font-semibold truncate hidden sm:inline">
            GritSync – {firstName} {lastName}
          </span>
          {sessionId && (
            <span className="text-white/50 text-xs hidden md:inline">
              | Test #{sessionId} {mode ? `(${mode})` : ''}
            </span>
          )}
        </div>

        {questionNumber !== undefined && totalQuestions !== undefined && (
          <div className="flex items-center gap-1.5 text-sm font-medium bg-white/10 px-3 py-1 rounded">
            <BookOpen className="h-3 w-3 text-[#17c3b2]" />
            {questionNumber} of {totalQuestions}
          </div>
        )}
      </header>

      {/* Toolbar */}
      <div className="bg-[#17c3b2] h-10 flex items-center px-4 gap-4 flex-shrink-0">
        <button
          onClick={onClose || (() => navigate('/nclex-review'))}
          className="flex items-center gap-1 text-white text-xs font-semibold hover:bg-white/20 px-2 py-1 rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Close
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
