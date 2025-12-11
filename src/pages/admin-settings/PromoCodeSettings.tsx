import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { Plus, Trash2, Copy, Loader2, Tag } from 'lucide-react'
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
  const [maxUses, setMaxUses] = useState('')
  const [validUntil, setValidUntil] = useState('')
  
  const loadPromoCodes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('promo_codes')
        .insert({
          code: code.toUpperCase(),
          description,
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
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
      const { error } = await supabase
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
      const { error } = await supabase
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Promo Codes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage promotional discount codes for GritSync services
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Promo Code
        </Button>
      </div>
      
      {showForm && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Create Promo Code
          </h3>
          <div className="space-y-4">
            <div className="flex gap-2">
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
                className="mt-6"
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Max Uses (optional)"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                help="Leave empty for unlimited uses"
              />
              
              <Input
                label="Valid Until (optional)"
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                help="Leave empty for no expiration"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={createPromoCode} disabled={submitting}>
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
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Promo Code List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
        </div>
      ) : promoCodes.length === 0 ? (
        <Card className="p-12 text-center">
          <Tag className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Promo Codes Yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Create your first promo code to offer discounts to clients
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Promo Code
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {promoCodes.map((promo) => {
            const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date()
            const isMaxedOut = promo.max_uses && promo.current_uses >= promo.max_uses
            const isEffectivelyInactive = !promo.is_active || isExpired || isMaxedOut
            
            return (
              <Card key={promo.id} className={`p-4 sm:p-6 ${isEffectivelyInactive ? 'opacity-60' : ''}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-mono font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100">
                        {promo.code}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        promo.is_active && !isExpired && !isMaxedOut
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {isExpired ? 'Expired' : isMaxedOut ? 'Maxed Out' : promo.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{promo.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm">
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
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(promo.code)
                        showToast('Code copied to clipboard!', 'success')
                      }}
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePromoCode(promo.id, promo.is_active)}
                      disabled={isExpired || isMaxedOut}
                      title={isExpired ? 'Cannot activate expired code' : isMaxedOut ? 'Cannot activate maxed out code' : promo.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {promo.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePromoCode(promo.id, promo.code)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete promo code"
                    >
                      <Trash2 className="h-4 w-4" />
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

