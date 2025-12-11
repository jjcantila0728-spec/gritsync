# Promo Code Feature Implementation Plan

## Overview
Add promo code functionality to allow discounts on GritSync service fees during checkout.

## Database Setup

### Step 1: Run SQL Migration
Execute `supabase/add-promo-codes-table.sql` to create:
- `promo_codes` table
- `promo_code_usage` table  
- Validation function
- RLS policies

```bash
# In Supabase Dashboard SQL Editor, run:
supabase/add-promo-codes-table.sql
```

## Frontend Implementation

### Step 2: Add Promo Code to Payment Form

**File:** `src/components/StripePaymentForm.tsx`

Add state and handlers:

```typescript
// Add new state variables
const [promoCode, setPromoCode] = useState('')
const [appliedPromo, setAppliedPromo] = useState<any>(null)
const [validatingPromo, setValidatingPromo] = useState(false)
const [discountAmount, setDiscountAmount] = useState(0)

// Add validation function
const validatePromoCode = async () => {
  if (!promoCode.trim()) return
  
  setValidatingPromo(true)
  try {
    const result = await supabase.rpc('validate_promo_code', {
      p_code: promoCode.toUpperCase(),
      p_amount: amount
    })
    
    if (result.data?.valid) {
      setAppliedPromo(result.data)
      setDiscountAmount(result.data.discount_amount)
      showToast(`Promo code applied! You save ${formatCurrency(result.data.discount_amount)}`, 'success')
    } else {
      showToast(result.data?.error || 'Invalid promo code', 'error')
    }
  } catch (error) {
    showToast('Failed to validate promo code', 'error')
  } finally {
    setValidatingPromo(false)
  }
}

// Calculate final amount
const finalAmount = amount - discountAmount
```

Add UI component (after amount display):

```tsx
{/* Promo Code Section */}
<div className="border-t border-gray-200 dark:border-gray-700 pt-4">
  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
    Have a Promo Code?
  </label>
  
  {!appliedPromo ? (
    <div className="flex gap-2">
      <Input
        value={promoCode}
        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
        placeholder="Enter promo code"
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        onClick={validatePromoCode}
        disabled={!promoCode.trim() || validatingPromo}
      >
        {validatingPromo ? 'Validating...' : 'Apply'}
      </Button>
    </div>
  ) : (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-green-800 dark:text-green-200">
            {appliedPromo.code}
          </div>
          <div className="text-sm text-green-600 dark:text-green-300">
            {appliedPromo.description}
          </div>
          <div className="text-sm font-bold text-green-700 dark:text-green-200 mt-1">
            Discount: -{formatCurrency(discountAmount)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setAppliedPromo(null)
            setDiscountAmount(0)
            setPromoCode('')
          }}
          className="text-red-600 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )}
</div>

{/* Show discounted amount */}
{discountAmount > 0 && (
  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">Original Amount:</span>
        <span className="line-through">{formatCurrency(amount)}</span>
      </div>
      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
        <span>Discount:</span>
        <span>-{formatCurrency(discountAmount)}</span>
      </div>
      <div className="flex justify-between text-lg font-bold pt-2 border-t">
        <span>Final Amount:</span>
        <span className="text-green-600 dark:text-green-400">
          {formatCurrency(finalAmount)}
        </span>
      </div>
    </div>
  </div>
)}

{/* Update Pay button to show final amount */}
<Button type="submit" className="w-full ...">
  Pay {formatCurrency(finalAmount)}
</Button>
```

### Step 3: Update Payment Submission

Pass promo code info to onSuccess callback:

```typescript
onSuccess(paymentIntent.id, 'card', {
  promo_code_id: appliedPromo?.promo_code_id,
  discount_amount: discountAmount
}, proofOfPaymentFile)
```

### Step 4: Admin Promo Code Generator

**File:** `src/pages/admin-settings/PromoCodeSettings.tsx` (create new)

```typescript
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { Plus, Trash2, Edit2, Copy } from 'lucide-react'

export function PromoCodeSettings() {
  const { showToast } = useToast()
  const [promoCodes, setPromoCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [validUntil, setValidUntil] = useState('')
  
  const loadPromoCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setPromoCodes(data || [])
    } catch (error) {
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
    try {
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
      showToast(error.message || 'Failed to create promo code', 'error')
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
    } catch (error) {
      showToast('Failed to update promo code', 'error')
    }
  }
  
  const deletePromoCode = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return
    
    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      showToast('Promo code deleted', 'success')
      loadPromoCodes()
    } catch (error) {
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
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Promo Codes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage promotional discount codes
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Promo Code
        </Button>
      </div>
      
      {showForm && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Create Promo Code</h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER2024"
                className="flex-1"
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
              placeholder="Summer sale discount"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Discount Type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                options={[
                  { value: 'percentage', label: 'Percentage (%)' },
                  { value: 'fixed', label: 'Fixed Amount ($)' }
                ]}
              />
              
              <Input
                label="Discount Value"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '10' : '50'}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Max Uses (optional)"
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
              
              <Input
                label="Valid Until (optional)"
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={createPromoCode}>Create</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Promo Code List */}
      <div className="grid gap-4">
        {promoCodes.map((promo) => (
          <Card key={promo.id}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="font-mono font-bold text-lg">
                    {promo.code}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    promo.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {promo.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{promo.description}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>
                    Discount: {promo.discount_type === 'percentage' 
                      ? `${promo.discount_value}%`
                      : `$${promo.discount_value}`}
                  </span>
                  {promo.max_uses && (
                    <span>
                      Uses: {promo.current_uses}/{promo.max_uses}
                    </span>
                  )}
                  {promo.valid_until && (
                    <span>
                      Expires: {new Date(promo.valid_until).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(promo.code)
                    showToast('Code copied!', 'success')
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePromoCode(promo.id, promo.is_active)}
                >
                  {promo.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deletePromoCode(promo.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### Step 5: Add to Admin Settings Navigation

**File:** `src/pages/admin-settings/AdminSettings.tsx`

Add new tab:

```typescript
const tabs = [
  // ... existing tabs
  { id: 'promo-codes', label: 'Promo Codes', icon: <Tag className="h-4 w-4" /> },
]

// In render:
{activeTab === 'promo-codes' && <PromoCodeSettings />}
```

## API Integration

### Step 6: Add Promo Code API Functions

**File:** `src/lib/api.ts` or `src/lib/supabase-api.ts`

```typescript
export const promoCodesAPI = {
  validate: async (code: string, amount: number) => {
    const { data, error } = await supabase.rpc('validate_promo_code', {
      p_code: code.toUpperCase(),
      p_amount: amount
    })
    
    if (error) throw error
    return data
  },
  
  recordUsage: async (promoCodeId: string, paymentId: string, discountAmount: number) => {
    const { data, error } = await supabase
      .from('promo_code_usage')
      .insert({
        promo_code_id: promoCodeId,
        payment_id: paymentId,
        discount_amount: discountAmount
      })
    
    if (error) throw error
    
    // Increment usage count
    await supabase.rpc('increment', {
      table_name: 'promo_codes',
      row_id: promoCodeId,
      column_name: 'current_uses'
    })
    
    return data
  }
}
```

## Important Notes

### Discount Application
- ✅ Promo codes ONLY discount the GritSync service fee
- ✅ Do NOT discount government fees or third-party fees
- ✅ Calculate discount on the service portion only

### Security
- ✅ Codes are case-insensitive (converted to uppercase)
- ✅ Validation happens server-side
- ✅ RLS policies protect admin-only operations
- ✅ Usage tracking prevents fraud

### Business Rules
- Promo codes can be percentage or fixed amount
- Can set expiration dates
- Can limit total uses
- Track all redemptions
- Admin can activate/deactivate anytime

## Testing Checklist

- [ ] Run SQL migration
- [ ] Test promo code validation
- [ ] Test discount calculation
- [ ] Test expired code handling
- [ ] Test max uses limit
- [ ] Test admin promo code creation
- [ ] Test admin promo code management
- [ ] Test promo code on mobile banking payment
- [ ] Test promo code on Stripe payment
- [ ] Verify discount only applies to service fee

## Sample Promo Codes

The migration includes two sample codes:
- `WELCOME10` - 10% off (unlimited uses)
- `SAVE50` - $50 off (100 uses max)

Remove these in production!

