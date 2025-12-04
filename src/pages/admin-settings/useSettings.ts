import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { clearSettingsCache } from '@/lib/settings'

export function useSettings<T extends Record<string, any>>(
  defaultSettings: T,
  settingsMapper?: (data: Record<string, string>) => T
) {
  const [settings, setSettings] = useState<T>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const settingsData = await adminAPI.getSettings().catch(() => null)
      
      if (settingsData) {
        if (settingsMapper) {
          setSettings(settingsMapper(settingsData))
        } else {
          setSettings(settingsData as T)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load settings')
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveSettings(newSettings: Partial<T>) {
    const updatedSettings = { ...settings, ...newSettings }
    await adminAPI.saveSettings(updatedSettings as Record<string, any>)
    clearSettingsCache()
    setSettings(updatedSettings)
  }

  return {
    settings,
    setSettings,
    loading,
    error,
    fetchSettings,
    saveSettings,
  }
}

