import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Link2, Save, Percent } from 'lucide-react'
import { Loading } from '@/components/ui/Loading'
import { useSettings } from './useSettings'

export function ReferralSettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { settings, setSettings, loading, saveSettings } = useSettings(
    { referralBonusPercent: '10' },
    (data) => ({ referralBonusPercent: data.referralBonusPercent ?? '10' })
  )

  const handleSave = async () => {
    const pct = parseFloat(settings.referralBonusPercent)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setErrors({ referralBonusPercent: 'Enter a percentage between 0 and 100' })
      showToast('Please fix the validation errors', 'error')
      return
    }
    setSaving(true)
    try {
      await saveSettings({ referralBonusPercent: String(pct) })
      setErrors({})
      showToast('Referral settings saved', 'success')
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
        <Link2 className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Referrals & Partner Bonuses</h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 text-sm text-gray-600 dark:text-gray-300">
          <p className="mb-1"><strong>Affiliates</strong> earn this percentage of every payment made by a client who registered through their referral link.</p>
          <p><strong>Advisors</strong> earn the same bonus and additionally have referred clients automatically assigned to them so they can manage those applications.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Referral bonus percentage
          </label>
          <div className="relative max-w-[180px]">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={settings.referralBonusPercent}
              onChange={(e) => {
                setSettings({ ...settings, referralBonusPercent: e.target.value })
                if (errors.referralBonusPercent) setErrors({})
              }}
              className="pr-9"
            />
            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          {errors.referralBonusPercent && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{errors.referralBonusPercent}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Applies to both affiliates and advisors. Changing this affects future earnings calculations across all partner panels.
          </p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
