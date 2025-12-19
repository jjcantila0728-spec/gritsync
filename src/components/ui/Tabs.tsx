import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
  compact?: boolean
}

export function Tabs({ tabs, defaultTab, className, compact = false }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <div className={cn('w-full', className)}>
      {/* Tab Headers */}
      <div className={cn(
        "border-b border-gray-200 dark:border-gray-700",
        compact ? "mb-3 sm:mb-4" : "mb-4 sm:mb-6"
      )}>
        <nav className="flex space-x-0.5 sm:space-x-1 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1 sm:gap-2 border-b-2 transition-colors whitespace-nowrap',
                  compact 
                    ? 'px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium' 
                    : 'px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium',
                  isActive
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {Icon && <Icon className={cn(compact ? "h-3 w-3 sm:h-4 sm:w-4" : "h-4 w-4")} />}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className={cn(compact ? "mt-2 sm:mt-3" : "mt-3 sm:mt-4")}>
        {activeTabContent}
      </div>
    </div>
  )
}

