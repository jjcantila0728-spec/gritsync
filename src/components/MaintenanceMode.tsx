import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { generalSettings } from '@/lib/settings'
import { Wrench, AlertCircle } from 'lucide-react'

export function MaintenanceMode() {
  const { isAdmin } = useAuth()
  const [isMaintenance, setIsMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkMaintenanceMode() {
      try {
        const maintenance = await generalSettings.isMaintenanceMode()
        setIsMaintenance(maintenance)
      } catch (error) {
        console.error('Error checking maintenance mode:', error)
        // If there's an error, assume not in maintenance mode
        setIsMaintenance(false)
      } finally {
        setLoading(false)
      }
    }

    checkMaintenanceMode()
  }, [])

  // Don't show maintenance mode to admins
  if (loading || !isMaintenance || isAdmin()) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <Wrench className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          System Maintenance
        </h1>
        
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-6">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300 text-left">
            We're currently performing scheduled maintenance to improve your experience. 
            Please check back shortly.
          </p>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          We apologize for any inconvenience. Our team is working hard to get everything back up and running.
        </p>
      </div>
    </div>
  )
}

