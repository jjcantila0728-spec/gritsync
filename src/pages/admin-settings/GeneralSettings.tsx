import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Settings, Save, Palette, Share2 } from 'lucide-react'
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
      // Branding & Theme
      websiteUrl: 'https://gritsync.com',
      logoUrl: typeof window !== 'undefined' ? `${window.location.origin}/gritsync_logo.png` : '/gritsync_logo.png',
      primaryColor: '#dc2626', // Red from logo "SYNC" text
      secondaryColor: '#1f2937', // Dark gray/black from logo "GRIT" text
      companyAddress: '123 Main Street, City, State, ZIP Code',
      companyDescription: 'Your trusted partner for NCLEX processing. Fast, secure, and reliable application processing services.',
      // Social Media
      facebookUrl: '',
      twitterUrl: '',
      linkedinUrl: '',
      instagramUrl: '',
    },
    (data) => ({
      siteName: data.siteName || 'GritSync',
      siteEmail: data.siteEmail || 'admin@gritsync.com',
      supportEmail: data.supportEmail || 'support@gritsync.com',
      phoneNumber: data.phoneNumber || '+1 (509) 270-3437',
      maintenanceMode: String(data.maintenanceMode) === 'true',
      // Branding & Theme
      websiteUrl: data.websiteUrl || 'https://gritsync.com',
      logoUrl: data.logoUrl || (typeof window !== 'undefined' ? `${window.location.origin}/gritsync_logo.png` : '/gritsync_logo.png'),
      primaryColor: data.primaryColor || '#dc2626', // Red from logo "SYNC" text
      secondaryColor: data.secondaryColor || '#1f2937', // Dark gray/black from logo "GRIT" text
      companyAddress: data.companyAddress || '123 Main Street, City, State, ZIP Code',
      companyDescription: data.companyDescription || 'Your trusted partner for NCLEX processing. Fast, secure, and reliable application processing services.',
      // Social Media
      facebookUrl: data.facebookUrl || '',
      twitterUrl: data.twitterUrl || '',
      linkedinUrl: data.linkedinUrl || '',
      instagramUrl: data.instagramUrl || '',
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
      <div className="p-3 sm:p-4 md:p-5">
        <Loading text="Loading settings..." />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Settings className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          General Settings
        </h2>
      </div>

      <div className="space-y-3 max-w-2xl">
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

        {/* Branding & Theme Section */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Branding & Theme
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            These settings will be used in all email templates and across the application.
          </p>

          <div className="space-y-3">
            <div>
              <Input
                label="Website URL"
                type="url"
                value={settings.websiteUrl}
                onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
                placeholder="https://gritsync.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Used in email templates and links
              </p>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-1">
                  <Input
                    label="Logo URL"
                    type="url"
                    value={settings.logoUrl}
                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                    placeholder="https://gritsync.com/gritsync_logo.png"
                  />
                </div>
                {settings.logoUrl && (
                  <div className="mt-6">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center">
                      <img 
                        src={settings.logoUrl} 
                        alt="Logo Preview" 
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Full URL to your company logo (used in email headers). Default: /gritsync_logo.png
              </p>
              <button
                onClick={() => {
                  const defaultLogo = typeof window !== 'undefined' 
                    ? `${window.location.origin}/gritsync_logo.png` 
                    : '/gritsync_logo.png'
                  setSettings({ ...settings, logoUrl: defaultLogo })
                }}
                className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Use Default Logo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <Input
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    placeholder="#dc2626"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Red color from logo "SYNC" text - Used for primary actions, buttons, and highlights
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                    className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <Input
                    value={settings.secondaryColor}
                    onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                    placeholder="#1f2937"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Dark gray/black from logo "GRIT" text - Used for secondary elements and text
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Company Address
              </label>
              <textarea
                value={settings.companyAddress}
                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                placeholder="123 Main Street, City, State, ZIP Code"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Used in email footers and contact information. Example: "123 Main St, Anytown, ST 12345"
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Company Description
              </label>
              <textarea
                value={settings.companyDescription}
                onChange={(e) => setSettings({ ...settings, companyDescription: e.target.value })}
                placeholder="Brief description of your company..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Brief tagline or description (e.g., "Your trusted partner for NCLEX processing")
              </p>
            </div>
          </div>
        </div>

        {/* Social Media Links Section */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Social Media Links
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add your social media profiles to be included in email footers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Facebook"
                type="url"
                value={settings.facebookUrl}
                onChange={(e) => setSettings({ ...settings, facebookUrl: e.target.value })}
                placeholder="https://facebook.com/gritsync"
              />
            </div>
            <div>
              <Input
                label="Twitter/X"
                type="url"
                value={settings.twitterUrl}
                onChange={(e) => setSettings({ ...settings, twitterUrl: e.target.value })}
                placeholder="https://twitter.com/gritsync"
              />
            </div>
            <div>
              <Input
                label="LinkedIn"
                type="url"
                value={settings.linkedinUrl}
                onChange={(e) => setSettings({ ...settings, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/company/gritsync"
              />
            </div>
            <div>
              <Input
                label="Instagram"
                type="url"
                value={settings.instagramUrl}
                onChange={(e) => setSettings({ ...settings, instagramUrl: e.target.value })}
                placeholder="https://instagram.com/gritsync"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
            size="sm"
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

