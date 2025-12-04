import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Calculator, Save, TrendingUp } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { useSettings } from './useSettings'

export function CurrencySettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [fetchingRate, setFetchingRate] = useState(false)
  const { settings, setSettings, loading, saveSettings } = useSettings(
    {
      usdToPhpMode: 'manual',
      usdToPhpRate: '56.00',
    },
    (data) => ({
      usdToPhpMode: data.usdToPhpMode || 'manual',
      usdToPhpRate: data.usdToPhpRate || '56.00',
    })
  )
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleFetchRealTimeRate = async () => {
    setFetchingRate(true)
    try {
      const rate = await adminAPI.fetchUsdToPhpRate()
      if (rate) {
        setSettings({ ...settings, usdToPhpRate: rate.toFixed(2) })
        showToast(`Real-time rate fetched: ₱${rate.toFixed(2)} per USD`, 'success')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch real-time rate', 'error')
    } finally {
      setFetchingRate(false)
    }
  }

  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!settings.usdToPhpRate || isNaN(parseFloat(settings.usdToPhpRate)) || parseFloat(settings.usdToPhpRate) <= 0) {
      errors.usdToPhpRate = 'Valid conversion rate is required'
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
        <Calculator className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          USD to PHP Conversion
        </h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Conversion Mode
          </label>
          <Select
            value={settings.usdToPhpMode}
            onChange={(e) => setSettings({ ...settings, usdToPhpMode: e.target.value })}
            options={[
              { value: 'manual', label: 'Manual (Set rate manually)' },
              { value: 'automatic', label: 'Automatic (Real-time exchange rate)' },
            ]}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Choose how the USD to PHP conversion rate is determined
          </p>
        </div>

        {settings.usdToPhpMode === 'manual' ? (
          <div>
            <Input
              label="Manual Conversion Rate (1 USD = ? PHP)"
              type="number"
              step="0.01"
              min="0"
              value={settings.usdToPhpRate}
              onChange={(e) => {
                setSettings({ ...settings, usdToPhpRate: e.target.value })
                if (validationErrors.usdToPhpRate) {
                  setValidationErrors({ ...validationErrors, usdToPhpRate: '' })
                }
              }}
              placeholder="56.00"
            />
            {validationErrors.usdToPhpRate && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.usdToPhpRate}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter the PHP amount equivalent to 1 USD
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Current Rate (1 USD = ? PHP)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.usdToPhpRate}
                  onChange={(e) => {
                    setSettings({ ...settings, usdToPhpRate: e.target.value })
                    if (validationErrors.usdToPhpRate) {
                      setValidationErrors({ ...validationErrors, usdToPhpRate: '' })
                    }
                  }}
                  placeholder="56.00"
                  readOnly
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Rate will be updated automatically from real-time exchange rates
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchRealTimeRate}
                disabled={fetchingRate}
                className="mb-0"
              >
                {fetchingRate ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Fetching...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Fetch Rate
                  </>
                )}
              </Button>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mt-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Automatic Mode:</strong> The conversion rate will be fetched from real-time exchange rate APIs. 
                You can manually update it by clicking "Fetch Rate" or it will be updated automatically when payments are processed.
              </p>
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conversion Preview</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">$1.00 USD</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                = ₱{parseFloat(settings.usdToPhpRate || '0').toFixed(2)} PHP
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">$100.00 USD</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                = ₱{(parseFloat(settings.usdToPhpRate || '0') * 100).toFixed(2)} PHP
              </span>
            </div>
          </div>
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

