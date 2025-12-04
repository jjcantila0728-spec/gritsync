import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Loading } from '@/components/ui/Loading'
import { Shield, Settings, Bell, Lock, DollarSign, Calculator, Server } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: Settings, path: '/admin/settings/general' },
  { id: 'notifications', label: 'Email & Notifications', icon: Bell, path: '/admin/settings/notifications' },
  { id: 'security', label: 'Security', icon: Lock, path: '/admin/settings/security' },
  { id: 'payment', label: 'Payment', icon: DollarSign, path: '/admin/settings/payment' },
  { id: 'currency', label: 'Currency', icon: Calculator, path: '/admin/settings/currency' },
  { id: 'system', label: 'System', icon: Server, path: '/admin/settings/system' },
]

export function AdminSettings() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    // Redirect to general tab if on base settings route
    if (location.pathname === '/admin/settings' || location.pathname === '/admin/settings/') {
      navigate('/admin/settings/general', { replace: true })
    }
  }, [location.pathname, navigate])

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Access denied. Admin privileges required.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const currentTab = tabs.find(tab => location.pathname.startsWith(tab.path)) || tabs[0]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              Admin Settings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage system configuration and preferences
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav 
                className="-mb-px flex space-x-1 overflow-x-auto" 
                aria-label="Tabs"
                onKeyDown={(e) => {
                  // Keyboard navigation: Arrow keys to switch tabs
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    const currentIndex = tabs.findIndex(tab => location.pathname.startsWith(tab.path))
                    if (currentIndex === -1) return
                    
                    let nextIndex: number
                    if (e.key === 'ArrowLeft') {
                      nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
                    } else {
                      nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
                    }
                    
                    navigate(tabs[nextIndex].path)
                  }
                }}
              >
                {tabs.map((tab, index) => {
                  const Icon = tab.icon
                  const isActive = location.pathname.startsWith(tab.path)
                  return (
                    <button
                      key={tab.id}
                      onClick={() => navigate(tab.path)}
                      className={cn(
                        'group inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-t-lg',
                        isActive
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                      tabIndex={isActive ? 0 : -1}
                    >
                      <Icon className={cn(
                        'h-4 w-4 transition-colors',
                        isActive
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500'
                      )} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

