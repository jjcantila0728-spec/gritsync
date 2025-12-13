import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Settings, Save } from 'lucide-react'
import { Loading } from '@/components/ui/Loading'
import { useSettings } from './useSettings'

export function GeneralSettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const { settings, setSettings, loading, saveSettings } = useSettings(
    {
      siteName: 'GritSync',
      siteEmail: 'admin@gritsync.com',
      supportEmail: 'support@gritsync.com',
      phoneNumber: '+1 (509) 270-3437',
      maintenanceMode: false,
    },
    (data) => ({
      siteName: data.siteName || 'GritSync',
      siteEmail: data.siteEmail || 'admin@gritsync.com',
      supportEmail: data.supportEmail || 'support@gritsync.com',
      phoneNumber: data.phoneNumber || '+1 (509) 270-3437',
      maintenanceMode: String(data.maintenanceMode) === 'true',
    })
  )
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!settings.siteName || settings.siteName.trim().length === 0) {
      errors.siteName = 'Site name is required'
    }
    
    if (!settings.siteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.siteEmail)) {
      errors.siteEmail = 'Valid admin email is required'
    }
    
    if (!settings.supportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail)) {
      errors.supportEmail = 'Valid support email is required'
    }
    
    if (!settings.phoneNumber || settings.phoneNumber.trim().length === 0) {
      errors.phoneNumber = 'Phone number is required'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateSettings()) {
      showToast('Please fix validation errors before saving', 'error')
      return
    }
    
    setSaving(true)
    try {
      await saveSettings(settings)
      showToast('Settings saved successfully!', 'success')
      setValidationErrors({})
    } catch (error: any) {
      showToast(error.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-5 md:p-6">
        <Loading text="Loading settings..." />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-5 md:mb-6">
        <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
          General Settings
        </h2>
      </div>

      <div className="space-y-3 sm:space-y-4 max-w-2xl">
        <div>
          <Input
            label="Site Name"
            value={settings.siteName}
            onChange={(e) => {
              setSettings({ ...settings, siteName: e.target.value })
              if (validationErrors.siteName) {
                setValidationErrors({ ...validationErrors, siteName: '' })
              }
            }}
            placeholder="GritSync"
          />
          {validationErrors.siteName && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{validationErrors.siteName}</p>
          )}
        </div>

        <div>
          <Input
            label="Admin Email"
            type="email"
            value={settings.siteEmail}
            onChange={(e) => {
              setSettings({ ...settings, siteEmail: e.target.value })
              if (validationErrors.siteEmail) {
                setValidationErrors({ ...validationErrors, siteEmail: '' })
              }
            }}
            placeholder="admin@gritsync.com"
          />
          {validationErrors.siteEmail && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{validationErrors.siteEmail}</p>
          )}
        </div>

        <div>
          <Input
            label="Support Email"
            type="email"
            value={settings.supportEmail}
            onChange={(e) => {
              setSettings({ ...settings, supportEmail: e.target.value })
              if (validationErrors.supportEmail) {
                setValidationErrors({ ...validationErrors, supportEmail: '' })
              }
            }}
            placeholder="support@gritsync.com"
          />
          {validationErrors.supportEmail && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{validationErrors.supportEmail}</p>
          )}
        </div>

        <div>
          <Input
            label="Phone Number"
            type="tel"
            value={settings.phoneNumber}
            onChange={(e) => {
              setSettings({ ...settings, phoneNumber: e.target.value })
              if (validationErrors.phoneNumber) {
                setValidationErrors({ ...validationErrors, phoneNumber: '' })
              }
            }}
            placeholder="+1 (509) 270-3437"
          />
          {validationErrors.phoneNumber && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{validationErrors.phoneNumber}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            This phone number will be displayed across all pages (Footer, Contact, Terms, Privacy, etc.)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex-1 min-w-0">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
              Maintenance Mode
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Temporarily disable public access to the site
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {settings.maintenanceMode && (
          <div className="p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-300">
              ⚠ Maintenance mode is active. Users will see a maintenance message.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

