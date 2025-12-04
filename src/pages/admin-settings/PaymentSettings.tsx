import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DollarSign, Save, Key, Eye, EyeOff, Building2, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Loading } from '@/components/ui/Loading'
import { useSettings } from './useSettings'
import { Select } from '@/components/ui/Select'

interface MobileBankingConfig {
  id: string
  name: string
  accountName: string
  accountNumber: string
  enabled: boolean
}

export function PaymentSettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const { settings, setSettings, loading, saveSettings, fetchSettings } = useSettings(
    {
      stripeEnabled: false,
      stripePublishableKey: '',
      stripeSecretKey: '',
      stripeWebhookSecret: '',
      mobileBankingEnabled: true,
      mobileBankingConfigs: '[]',
    },
    (data) => ({
      stripeEnabled: data.stripeEnabled === 'true' || data.stripeEnabled === true,
      stripePublishableKey: data.stripePublishableKey || '',
      stripeSecretKey: data.stripeSecretKey || '',
      stripeWebhookSecret: data.stripeWebhookSecret || '',
      mobileBankingEnabled: data.mobileBankingEnabled === 'true' || data.mobileBankingEnabled === true || data.mobileBankingEnabled === undefined,
      mobileBankingConfigs: data.mobileBankingConfigs || '[]',
    })
  )
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // Parse mobile banking configs
  const [mobileBankingConfigs, setMobileBankingConfigs] = useState<MobileBankingConfig[]>([])
  
  // Sync mobile banking configs when settings are loaded
  useEffect(() => {
    if (!loading) {
      try {
        const parsed = JSON.parse(settings.mobileBankingConfigs || '[]')
        // If empty, initialize with default configs
        if (parsed.length === 0) {
          const defaultConfigs = [
            { id: 'bdo', name: 'BDO', accountName: 'Joy Jeric Cantila', accountNumber: '0059 4600 0994', enabled: true },
            { id: 'gcash', name: 'GCash', accountName: 'Joy Jeric Cantila', accountNumber: '09691533239', enabled: true },
            { id: 'zelle', name: 'Zelle', accountName: 'Joy Jeric Cantila', accountNumber: '509 270 3437', enabled: true },
          ]
          setMobileBankingConfigs(defaultConfigs)
        } else {
          setMobileBankingConfigs(parsed)
        }
      } catch {
        const defaultConfigs = [
          { id: 'bdo', name: 'BDO', accountName: 'Joy Jeric Cantila', accountNumber: '0059 4600 0994', enabled: true },
          { id: 'gcash', name: 'GCash', accountName: 'Joy Jeric Cantila', accountNumber: '09691533239', enabled: true },
          { id: 'zelle', name: 'Zelle', accountName: 'Joy Jeric Cantila', accountNumber: '509 270 3437', enabled: true },
        ]
        setMobileBankingConfigs(defaultConfigs)
      }
    }
  }, [settings.mobileBankingConfigs, loading])

  // Update settings when mobile banking configs change
  const updateMobileBankingConfigs = (configs: MobileBankingConfig[]) => {
    setMobileBankingConfigs(configs)
    setSettings({ ...settings, mobileBankingConfigs: JSON.stringify(configs) })
  }

  const validateSettings = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (settings.stripeEnabled) {
      if (!settings.stripePublishableKey || !settings.stripePublishableKey.startsWith('pk_')) {
        errors.stripePublishableKey = 'Valid Stripe publishable key is required (starts with pk_)'
      }
      if (!settings.stripeSecretKey || (!settings.stripeSecretKey.startsWith('sk_') && !settings.stripeSecretKey.startsWith('***'))) {
        errors.stripeSecretKey = 'Valid Stripe secret key is required (starts with sk_)'
      }
    }
    
    // Validate mobile banking configs
    if (settings.mobileBankingEnabled) {
      mobileBankingConfigs.forEach((config, index) => {
        if (config.enabled) {
          if (!config.name || config.name.trim().length === 0) {
            errors[`mobileBanking_${index}_name`] = 'Bank/service name is required'
          }
          if (!config.accountName || config.accountName.trim().length === 0) {
            errors[`mobileBanking_${index}_accountName`] = 'Account name is required'
          }
          if (!config.accountNumber || config.accountNumber.trim().length === 0) {
            errors[`mobileBanking_${index}_accountNumber`] = 'Account number is required'
          }
        }
      })
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
      const settingsToSave = {
        ...settings,
        mobileBankingConfigs: JSON.stringify(mobileBankingConfigs),
      }
      await saveSettings(settingsToSave)
      showToast('Settings saved successfully!', 'success')
      setValidationErrors({})
      await fetchSettings()
    } catch (error: any) {
      showToast(error.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addMobileBankingConfig = () => {
    const newConfig: MobileBankingConfig = {
      id: `custom_${Date.now()}`,
      name: '',
      accountName: '',
      accountNumber: '',
      enabled: true,
    }
    updateMobileBankingConfigs([...mobileBankingConfigs, newConfig])
  }

  const removeMobileBankingConfig = (id: string) => {
    if (mobileBankingConfigs.length <= 1) {
      showToast('At least one mobile banking option must be configured', 'error')
      return
    }
    updateMobileBankingConfigs(mobileBankingConfigs.filter(c => c.id !== id))
  }

  const updateMobileBankingConfig = (id: string, updates: Partial<MobileBankingConfig>) => {
    updateMobileBankingConfigs(
      mobileBankingConfigs.map(c => c.id === id ? { ...c, ...updates } : c)
    )
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
        <DollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Payment Settings
        </h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Stripe Integration
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enable Stripe payment processing
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.stripeEnabled}
              onChange={(e) => setSettings({ ...settings, stripeEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {settings.stripeEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
            <div>
              <Input
                label="Stripe Publishable Key"
                type="text"
                value={settings.stripePublishableKey}
                onChange={(e) => {
                  setSettings({ ...settings, stripePublishableKey: e.target.value })
                  if (validationErrors.stripePublishableKey) {
                    setValidationErrors({ ...validationErrors, stripePublishableKey: '' })
                  }
                }}
                placeholder="pk_test_... or pk_live_..."
              />
              {validationErrors.stripePublishableKey && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.stripePublishableKey}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your Stripe publishable key (starts with pk_test_ or pk_live_)
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stripe Secret Key
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showSecretKey ? (
                    <EyeOff className="h-4 w-4 inline mr-1" />
                  ) : (
                    <Eye className="h-4 w-4 inline mr-1" />
                  )}
                  {showSecretKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input
                type={showSecretKey ? "text" : "password"}
                value={settings.stripeSecretKey}
                onChange={(e) => {
                  setSettings({ ...settings, stripeSecretKey: e.target.value })
                  if (validationErrors.stripeSecretKey) {
                    setValidationErrors({ ...validationErrors, stripeSecretKey: '' })
                  }
                }}
                placeholder="sk_test_... or sk_live_..."
              />
              {validationErrors.stripeSecretKey && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.stripeSecretKey}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your Stripe secret key (starts with sk_test_ or sk_live_). Keep this secure!
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stripe Webhook Secret
                </label>
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showWebhookSecret ? (
                    <EyeOff className="h-4 w-4 inline mr-1" />
                  ) : (
                    <Eye className="h-4 w-4 inline mr-1" />
                  )}
                  {showWebhookSecret ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input
                type={showWebhookSecret ? "text" : "password"}
                value={settings.stripeWebhookSecret}
                onChange={(e) => setSettings({ ...settings, stripeWebhookSecret: e.target.value })}
                placeholder="whsec_..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your Stripe webhook signing secret (starts with whsec_). Optional for local development.
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Key className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Security Note:</p>
                  <p>Secret keys are stored securely and masked when displayed. Only enter new keys if you need to update them.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Banking Settings */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Mobile Banking Configuration
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure bank account details for mobile banking payments
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.mobileBankingEnabled}
                onChange={(e) => setSettings({ ...settings, mobileBankingEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {settings.mobileBankingEnabled && (
            <div className="space-y-4">
              {mobileBankingConfigs.map((config, index) => (
                <div key={config.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => updateMobileBankingConfig(config.id, { enabled: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {config.name || `Bank ${index + 1}`}
                      </span>
                    </div>
                    {mobileBankingConfigs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMobileBankingConfig(config.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {config.enabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-primary-200 dark:border-primary-800">
                      <div>
                        <Input
                          label="Bank/Service Name"
                          value={config.name}
                          onChange={(e) => {
                            updateMobileBankingConfig(config.id, { name: e.target.value })
                            if (validationErrors[`mobileBanking_${index}_name`]) {
                              setValidationErrors({ ...validationErrors, [`mobileBanking_${index}_name`]: '' })
                            }
                          }}
                          placeholder="BDO, GCash, Zelle, etc."
                        />
                        {validationErrors[`mobileBanking_${index}_name`] && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {validationErrors[`mobileBanking_${index}_name`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <Input
                          label="Account Name"
                          value={config.accountName}
                          onChange={(e) => {
                            updateMobileBankingConfig(config.id, { accountName: e.target.value })
                            if (validationErrors[`mobileBanking_${index}_accountName`]) {
                              setValidationErrors({ ...validationErrors, [`mobileBanking_${index}_accountName`]: '' })
                            }
                          }}
                          placeholder="Account holder name"
                        />
                        {validationErrors[`mobileBanking_${index}_accountName`] && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {validationErrors[`mobileBanking_${index}_accountName`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <Input
                          label="Account Number"
                          value={config.accountNumber}
                          onChange={(e) => {
                            updateMobileBankingConfig(config.id, { accountNumber: e.target.value })
                            if (validationErrors[`mobileBanking_${index}_accountNumber`]) {
                              setValidationErrors({ ...validationErrors, [`mobileBanking_${index}_accountNumber`]: '' })
                            }
                          }}
                          placeholder="Account number or mobile number"
                        />
                        {validationErrors[`mobileBanking_${index}_accountNumber`] && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {validationErrors[`mobileBanking_${index}_accountNumber`]}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          This will be displayed to users when they select this payment method
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addMobileBankingConfig}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Mobile Banking Option
              </Button>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <strong>Note:</strong> These account details will be shown to users when they select mobile banking as their payment method. Make sure the information is accurate.
                </p>
              </div>
            </div>
          )}
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

