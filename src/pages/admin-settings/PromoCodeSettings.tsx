import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { db } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'
import { Plus, Trash2, Copy, Loader2, Tag, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PromoCode {
  id: string
  code: string
  description: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  application_type?: 'NCLEX' | 'ALL'
  created_at: string
}

export function PromoCodeSettings() {
  const { showToast } = useToast()
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [applicationType, setApplicationType] = useState<'NCLEX' | 'ALL'>('ALL')
  const [maxUses, setMaxUses] = useState('')
  const [validUntil, setValidUntil] = useState('')
  
  const loadPromoCodes = async () => {
    try {
      setLoading(true)
      const { data, error } = await db
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setPromoCodes(data || [])
    } catch (error: any) {
      console.error('Error loading promo codes:', error)
      showToast('Failed to load promo codes', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadPromoCodes()
  }, [])
  
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCode(result)
  }
  
  const createPromoCode = async () => {
    // Validation
    if (!code.trim()) {
      showToast('Please enter a promo code', 'error')
      return
    }
    if (!description.trim()) {
      showToast('Please enter a description', 'error')
      return
    }
    if (!discountValue || parseFloat(discountValue) <= 0) {
      showToast('Please enter a valid discount value', 'error')
      return
    }
    if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
      showToast('Percentage discount cannot exceed 100%', 'error')
      return
    }
    
    try {
      setSubmitting(true)
      const { error } = await db
        .from('promo_codes')
        .insert({
          code: code.toUpperCase(),
          description,
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          application_type: applicationType,
          max_uses: maxUses ? parseInt(maxUses) : null,
          valid_until: validUntil || null
        })
        .select()
        .single()
      
      if (error) throw error
      
      showToast('Promo code created successfully', 'success')
      setShowForm(false)
      resetForm()
      loadPromoCodes()
    } catch (error: any) {
      console.error('Error creating promo code:', error)
      if (error.code === '23505') {
        showToast('This promo code already exists', 'error')
      } else {
        showToast(error.message || 'Failed to create promo code', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }
  
  const togglePromoCode = async (id: string, isActive: boolean) => {
    try {
      const { error } = await db
        .from('promo_codes')
        .update({ is_active: !isActive })
        .eq('id', id)
      
      if (error) throw error
      
      showToast(`Promo code ${!isActive ? 'activated' : 'deactivated'}`, 'success')
      loadPromoCodes()
    } catch (error: any) {
      console.error('Error updating promo code:', error)
      showToast('Failed to update promo code', 'error')
    }
  }
  
  const deletePromoCode = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete the promo code "${code}"?`)) return
    
    try {
      const { error } = await db
        .from('promo_codes')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      showToast('Promo code deleted', 'success')
      loadPromoCodes()
    } catch (error: any) {
      console.error('Error deleting promo code:', error)
      showToast('Failed to delete promo code', 'error')
    }
  }
  
  const resetForm = () => {
    setCode('')
    setDescription('')
    setDiscountType('percentage')
    setDiscountValue('')
    setApplicationType('ALL')
    setMaxUses('')
    setValidUntil('')
  }
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  return (
    <div className="p-3 sm:p-4 md:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Promo Codes</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage promotional discount codes for GritSync services
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Promo Code
        </Button>
      </div>

      {/* Info Card: Promo Code Application Rules */}
      <Card className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2 sm:gap-3">
          <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Promo Code Application Rules
            </h3>
            <ul className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li className="break-words">• <strong>Promo codes can be set for NCLEX or ALL applications</strong></li>
              <li className="break-words">• <strong>Discounts only apply to the GritSync Service Fee</strong> (not government fees or third-party fees)</li>
              <li className="break-words">• Service fee amounts: Full payment = $150, Staggered payments = $75 per step</li>
              <li className="break-words">• Discounts are automatically capped at the service fee amount</li>
            </ul>
          </div>
        </div>
      </Card>
      
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          resetForm()
        }}
        title="Create Promo Code"
        size="sm"
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER2024"
              className="flex-1"
              maxLength={50}
            />
            <Button
              type="button"
              variant="outline"
              onClick={generateRandomCode}
              className="sm:mt-6 w-full sm:w-auto"
            >
              Generate
            </Button>
          </div>
          
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summer sale discount - 10% off"
          />
          
          <Select
            label="Application Type"
            value={applicationType}
            onChange={(e) => setApplicationType(e.target.value as 'NCLEX' | 'ALL')}
            options={[
              { value: 'ALL', label: 'All Applications' },
              { value: 'NCLEX', label: 'NCLEX Only' },
            ]}
            help="Select which application types this promo code applies to"
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Discount Type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
              options={[
                { value: 'percentage', label: 'Percentage (%)' },
                { value: 'fixed', label: 'Fixed Amount ($)' }
              ]}
            />
            
            <Input
              label={`Discount ${discountType === 'percentage' ? 'Percentage' : 'Amount'}`}
              type="number"
              step={discountType === 'percentage' ? '1' : '0.01'}
              min="0"
              max={discountType === 'percentage' ? '100' : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? '10' : '50.00'}
              help={discountType === 'fixed' ? 'Applies to Service Fee only' : 'Applies to Service Fee only'}
            />
          </div>
          
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> This promo code applies to {applicationType === 'ALL' ? 'all' : applicationType} applications. Discount only on GritSync Service Fee ($150 full, $75 per step).
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Max Uses (optional)"
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              help="Leave empty for unlimited"
            />
            
            <Input
              label="Valid Until (optional)"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              help="Leave empty for no expiration"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button 
              onClick={createPromoCode} 
              disabled={submitting} 
              className="w-full sm:flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Promo Code'
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Promo Code List */}
      {loading ? (
        <div className="flex items-center justify-center py-6 sm:py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600 dark:text-primary-400" />
        </div>
      ) : promoCodes.length === 0 ? (
        <Card className="p-4 sm:p-6 text-center">
          <Tag className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Promo Codes Yet
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
            Create your first promo code to offer discounts to clients
          </p>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Promo Code
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {promoCodes.map((promo) => {
            const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date()
            const isMaxedOut = promo.max_uses && promo.current_uses >= promo.max_uses
            const isEffectivelyInactive = !promo.is_active || isExpired || isMaxedOut
            
            return (
              <Card key={promo.id} className={`p-3 sm:p-4 ${isEffectivelyInactive ? 'opacity-60' : ''}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-2">
                      <div className="font-mono font-bold text-base sm:text-lg md:text-xl text-gray-900 dark:text-gray-100 break-all">
                        {promo.code}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                        promo.is_active && !isExpired && !isMaxedOut
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {isExpired ? 'Expired' : isMaxedOut ? 'Maxed Out' : promo.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words">{promo.description}</p>
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs text-gray-600 dark:text-gray-400 break-words">
                      <span className="block sm:inline">
                        Applies to: <strong>
                          {promo.application_type === 'ALL' ? 'All Applications' : 
                           promo.application_type === 'NCLEX' ? 'NCLEX Only' : 'All Applications'}
                        </strong>
                      </span>
                      <span className="hidden sm:inline"> | </span>
                      <span className="block sm:inline">Discount on: <strong>GritSync Service Fee only</strong></span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs sm:text-sm">
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        Discount: {promo.discount_type === 'percentage' 
                          ? `${promo.discount_value}%`
                          : formatCurrency(promo.discount_value)}
                      </span>
                      {promo.max_uses && (
                        <span className="text-gray-600 dark:text-gray-400">
                          Uses: {promo.current_uses}/{promo.max_uses}
                        </span>
                      )}
                      {!promo.max_uses && promo.current_uses > 0 && (
                        <span className="text-gray-600 dark:text-gray-400">
                          Used: {promo.current_uses} times
                        </span>
                      )}
                      {promo.valid_until && (
                        <span className={`${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          Expires: {formatDate(promo.valid_until)}
                        </span>
                      )}
                      <span className="text-gray-500 dark:text-gray-500">
                        Created: {formatDate(promo.created_at)}
                      </span>
                    </div>
                  </div>
                  
                    <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(promo.code)
                        showToast('Code copied to clipboard!', 'success')
                      }}
                      title="Copy code"
                      className="flex-1 sm:flex-initial"
                    >
                      <Copy className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePromoCode(promo.id, promo.is_active)}
                      disabled={Boolean(isExpired || isMaxedOut)}
                      title={isExpired ? 'Cannot activate expired code' : isMaxedOut ? 'Cannot activate maxed out code' : promo.is_active ? 'Deactivate' : 'Activate'}
                      className="flex-1 sm:flex-initial"
                    >
                      <span className="hidden sm:inline">{promo.is_active ? 'Deactivate' : 'Activate'}</span>
                      <span className="sm:hidden">{promo.is_active ? 'Off' : 'On'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePromoCode(promo.id, promo.code)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-1 sm:flex-initial"
                      title="Delete promo code"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

