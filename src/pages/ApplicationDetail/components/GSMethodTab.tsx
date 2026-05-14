import { Link } from 'react-router-dom'
import { GraduationCap, MapPin, Plane, Sparkles } from 'lucide-react'
import { MandatoryCourseAgent } from './gs-method/MandatoryCourseAgent'
import { NyApplicationAgent } from './gs-method/NyApplicationAgent'
import { PvApplicationAgent } from './gs-method/PvApplicationAgent'
import type { ApplicationData } from '../types'

interface GSMethodTabProps {
  application: ApplicationData
  subTab: string
  isAdmin: boolean
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const SUB_TABS = [
  { id: 'mandatory-course', label: 'Mandatory Course', icon: GraduationCap },
  { id: 'ny-application', label: 'NY Application', icon: MapPin },
  { id: 'pv-application', label: 'PV Application', icon: Plane },
] as const

export function GSMethodTab({ application, subTab, isAdmin, showToast }: GSMethodTabProps) {
  const basePath = isAdmin ? '/admin/applications' : '/applications'
  const appId = application.grit_app_id || application.id

  const active = SUB_TABS.find((t) => t.id === subTab) ? subTab : 'mandatory-course'

  return (
    <div className="space-y-4">
      {/* Header card — explains what GS Method is */}
      <div className="rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500 dark:bg-purple-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">GS Method</h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              AI-powered automation that handles the end-to-end sequence: mandatory courses,
              New York application, and Pearson VUE registration. Pick a step below to initialize it.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1 overflow-x-auto whitespace-nowrap" aria-label="GS Method tabs">
          {SUB_TABS.map((t) => {
            const Icon = t.icon
            const isActive = active === t.id
            return (
              <Link
                key={t.id}
                to={`${basePath}/${appId}/gs-method/${t.id}`}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Sub-tab content */}
      <div>
        {active === 'mandatory-course' && (
          <MandatoryCourseAgent application={application} showToast={showToast} />
        )}
        {active === 'ny-application' && (
          <NyApplicationAgent application={application} showToast={showToast} />
        )}
        {active === 'pv-application' && (
          <PvApplicationAgent application={application} showToast={showToast} />
        )}
      </div>
    </div>
  )
}
