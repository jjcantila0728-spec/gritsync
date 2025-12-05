import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Lock, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { useSettings } from './useSettings'

export function SecuritySettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const { settings, setSettings, loading, saveSettings } = useSettings(
    {
      sessionTimeout: '30',
      maxLoginAttempts: '5',
      passwordMinLength: '8',
      requireStrongPassword: false,
    },
    (data) => ({
      sessionTimeout: data.sessionTimeout || '30',
      maxLoginAttempts: data.maxLoginAttempts || '5',
      passwordMinLength: data.passwordMinLength || '8',
      requireStrongPassword: data.requireStrongPassword === 'true' || (typeof data.requireStrongPassword === 'boolean' && data.requireStrongPassword),
    })
  )
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (parseInt(settings.sessionTimeout) < 5 || parseInt(settings.sessionTimeout) > 480) {
      errors.sessionTimeout = 'Session timeout must be between 5 and 480 minutes'
    }
    
    if (parseInt(settings.maxLoginAttempts) < 3 || parseInt(settings.maxLoginAttempts) > 10) {
      errors.maxLoginAttempts = 'Max login attempts must be between 3 and 10'
    }
    
    if (parseInt(settings.passwordMinLength) < 6 || parseInt(settings.passwordMinLength) > 32) {
      errors.passwordMinLength = 'Password minimum length must be between 6 and 32 characters'
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
      <div className="p-6">
        <Loading text="Loading settings..." />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Security Settings
        </h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div>
          <Input
            label="Session Timeout (minutes)"
            type="number"
            min="5"
            max="480"
            value={settings.sessionTimeout}
            onChange={(e) => {
              setSettings({ ...settings, sessionTimeout: e.target.value })
              if (validationErrors.sessionTimeout) {
                setValidationErrors({ ...validationErrors, sessionTimeout: '' })
              }
            }}
            placeholder="30"
          />
          {validationErrors.sessionTimeout && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.sessionTimeout}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Automatically log out users after inactivity (5-480 minutes)
          </p>
        </div>

        <div>
          <Input
            label="Max Login Attempts"
            type="number"
            min="3"
            max="10"
            value={settings.maxLoginAttempts}
            onChange={(e) => {
              setSettings({ ...settings, maxLoginAttempts: e.target.value })
              if (validationErrors.maxLoginAttempts) {
                setValidationErrors({ ...validationErrors, maxLoginAttempts: '' })
              }
            }}
            placeholder="5"
          />
          {validationErrors.maxLoginAttempts && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.maxLoginAttempts}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Number of failed login attempts before account lockout (3-10)
          </p>
        </div>

        <div>
          <Input
            label="Password Minimum Length"
            type="number"
            min="6"
            max="32"
            value={settings.passwordMinLength}
            onChange={(e) => {
              setSettings({ ...settings, passwordMinLength: e.target.value })
              if (validationErrors.passwordMinLength) {
                setValidationErrors({ ...validationErrors, passwordMinLength: '' })
              }
            }}
            placeholder="8"
          />
          {validationErrors.passwordMinLength && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.passwordMinLength}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum password length requirement (6-32 characters)
          </p>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Require Strong Passwords
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enforce passwords with uppercase, lowercase, numbers, and special characters
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requireStrongPassword}
              onChange={(e) => setSettings({ ...settings, requireStrongPassword: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSave}
            disabled={saving}
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

