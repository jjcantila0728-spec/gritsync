import { useState, FormEvent, useRef, useEffect } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { adminAPI } from '@/lib/api'
import { paymentSettings } from '@/lib/settings'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { CreditCard, Loader2, Building2, Upload, X, Tag } from 'lucide-react'

type PaymentMethod = 'card' | 'mobile_banking'

interface MobileBankingConfig {
  id: string
  name: string
  accountName: string
  accountNumber: string
  enabled: boolean
}

interface StripePaymentFormProps {
  amount: number
  serviceFeeAmount?: number // GritSync service fee portion (for promo code calculation)
  onSuccess: (paymentIntentId: string, paymentMethod?: PaymentMethod, details?: any, proofFile?: File) => void
  onError: (error: string) => void
  paymentIntentId?: string
}

export function StripePaymentForm({
  amount,
  serviceFeeAmount,
  onSuccess,
  onError
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_banking')
  const [mobileBankingConfigs, setMobileBankingConfigs] = useState<MobileBankingConfig[]>([])
  const [selectedMobileBankingId, setSelectedMobileBankingId] = useState<string>('')
  const [proofOfPaymentFile, setProofOfPaymentFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [usdToPhpRate, setUsdToPhpRate] = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<any>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)

  // Load mobile banking configs
  useEffect(() => {
    async function loadConfigs() {
      try {
        setLoadingConfigs(true)
        const configs = await paymentSettings.getMobileBankingConfigs()
        setMobileBankingConfigs(configs)
        if (configs.length > 0 && !selectedMobileBankingId) {
          setSelectedMobileBankingId(configs[0].id)
        }
      } catch (error) {
        console.error('Error loading mobile banking configs:', error)
        // Fallback to default configs
        const defaultConfigs: MobileBankingConfig[] = [
          { id: 'bdo', name: 'BDO', accountName: 'Joy Jeric Cantila', accountNumber: '0059 4600 0994', enabled: true },
          { id: 'gcash', name: 'GCash', accountName: 'Joy Jeric Cantila', accountNumber: '09691533239', enabled: true },
          { id: 'zelle', name: 'Zelle', accountName: 'Joy Jeric Cantila', accountNumber: '509 270 3437', enabled: true },
        ]
        setMobileBankingConfigs(defaultConfigs)
        setSelectedMobileBankingId('bdo')
      } finally {
        setLoadingConfigs(false)
      }
    }
    loadConfigs()
  }, [])

  // Get selected mobile banking config
  const selectedConfig = mobileBankingConfigs.find(c => c.id === selectedMobileBankingId)
  
  // Calculate final amount after discount
  const finalAmount = amount - discountAmount
  
  // Validate promo code
  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      showToast?.('Please enter a promo code', 'error')
      return
    }
    
    setValidatingPromo(true)
    try {
      // Pass service fee amount to ensure discount only applies to GritSync service fee
      const { data, error } = await supabase.rpc('validate_promo_code', {
        p_code: promoCode.toUpperCase(),
        p_amount: amount,
        p_service_fee_amount: serviceFeeAmount || null
      })
      
      if (error) throw error
      
      if (data?.valid) {
        setAppliedPromo(data)
        setDiscountAmount(data.discount_amount)
        showToast?.(`Promo code applied! You save ${formatCurrency(data.discount_amount)} on service fee`, 'success')
      } else {
        showToast?.(data?.error || 'Invalid promo code', 'error')
        setPromoCode('')
      }
    } catch (error: any) {
      console.error('Error validating promo code:', error)
      showToast?.('Failed to validate promo code', 'error')
      setPromoCode('')
    } finally {
      setValidatingPromo(false)
    }
  }
  
  // Remove promo code
  const removePromoCode = () => {
    setAppliedPromo(null)
    setDiscountAmount(0)
    setPromoCode('')
    showToast?.('Promo code removed', 'info')
  }

  // Fetch USD to PHP conversion rate (only for non-Zelle options)
  useEffect(() => {
    if (paymentMethod === 'mobile_banking' && selectedConfig) {
      const needsConversion = selectedConfig.name.toLowerCase() !== 'zelle'
      if (needsConversion) {
        setLoadingRate(true)
        adminAPI.getUsdToPhpRate()
          .then(rate => {
            setUsdToPhpRate(rate)
          })
          .catch(() => {
            setUsdToPhpRate(56.00) // Default fallback
          })
          .finally(() => {
            setLoadingRate(false)
          })
      } else {
        // Zelle is in USD, no conversion needed
        setUsdToPhpRate(null)
        setLoadingRate(false)
      }
    }
  }, [paymentMethod, selectedConfig])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    try {
      if (paymentMethod === 'mobile_banking') {
        // For mobile banking, require proof of payment file
        if (!proofOfPaymentFile) {
          const errorMsg = 'Please upload proof of payment (screenshot or receipt) before submitting.'
          setError(errorMsg)
          onError(errorMsg)
          setLoading(false)
          return
        }

        // Validate file type (images and PDFs)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
        if (!allowedTypes.includes(proofOfPaymentFile.type)) {
          const errorMsg = 'Please upload an image (JPG, PNG, WebP) or PDF file as proof of payment.'
          setError(errorMsg)
          onError(errorMsg)
          setLoading(false)
          return
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (proofOfPaymentFile.size > maxSize) {
          const errorMsg = 'Proof of payment file is too large. Maximum size is 10MB.'
          setError(errorMsg)
          onError(errorMsg)
          setLoading(false)
          return
        }

        // Submit with proof of payment
        onSuccess('mobile_banking', 'mobile_banking', {
          number: selectedConfig?.name || selectedMobileBankingId,
          reference: '',
          promo_code_id: appliedPromo?.promo_code_id,
          promo_code: appliedPromo?.code,
          discount_amount: discountAmount
        }, proofOfPaymentFile)
        setLoading(false)
        return
      }

      // Card payment flow
      if (!stripe || !elements) {
        const errorMsg = 'Stripe has not loaded yet. Please wait a moment and try again.'
        setError(errorMsg)
        onError(errorMsg)
        setLoading(false)
        return
      }

      // Submit the form to Stripe
      const { error: submitError } = await elements.submit()
      if (submitError) {
        const errorMsg = submitError.message || 'An error occurred while submitting your payment information.'
        setError(errorMsg)
        onError(errorMsg)
        setLoading(false)
        return
      }

      // Confirm the payment
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        const errorMsg = confirmError.message || 'Payment failed. Please try again.'
        console.error('Stripe payment confirmation error:', confirmError)
        setError(errorMsg)
        onError(errorMsg)
      } else if (paymentIntent) {
        if (paymentIntent.status === 'succeeded') {
          // Payment succeeded
          onSuccess(paymentIntent.id, 'card', {
            promo_code_id: appliedPromo?.promo_code_id,
            promo_code: appliedPromo?.code,
            discount_amount: discountAmount
          })
        } else if (paymentIntent.status === 'processing') {
          // Payment is processing
          const errorMsg = 'Payment is being processed. Please wait for confirmation.'
          setError(errorMsg)
          onError(errorMsg)
        } else if (paymentIntent.status === 'requires_action') {
          // Payment requires additional action (3D Secure, etc.)
          const errorMsg = 'Payment requires additional authentication. Please complete the verification.'
          setError(errorMsg)
          onError(errorMsg)
        } else {
          // Other status
          const errorMsg = `Payment status: ${paymentIntent.status}. Please contact support if this persists.`
          setError(errorMsg)
          onError(errorMsg)
        }
      } else {
        // No payment intent returned
        const errorMsg = 'Payment confirmation failed. Please try again.'
        console.error('No payment intent returned from Stripe')
        setError(errorMsg)
        onError(errorMsg)
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred. Please try again.'
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              Amount: {formatCurrency(amount)}
            </p>
          </div>
          {/* Payment Method Logos */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <img src="/bdo logo.png" alt="BDO" className="h-5 sm:h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <img src="/gcash logo.jpeg" alt="GCash" className="h-5 sm:h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <img src="/zelle logo.png" alt="Zelle" className="h-5 sm:h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div className="flex items-center gap-1 ml-1 opacity-70 hover:opacity-100 transition-opacity">
              {/* Visa */}
              <svg className="h-4 sm:h-5 w-auto" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#1A1F71"/>
                <text x="24" y="20" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">VISA</text>
              </svg>
              {/* Mastercard */}
              <svg className="h-4 sm:h-5 w-auto" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#000000"/>
                <circle cx="18" cy="16" r="7" fill="#EB001B"/>
                <circle cx="30" cy="16" r="7" fill="#F79E1B"/>
                <path d="M24 11c-1.3 1.2-2.1 2.9-2.1 4.8s0.8 3.6 2.1 4.8c1.3-1.2 2.1-2.9 2.1-4.8S25.3 12.2 24 11z" fill="#FF5F00"/>
              </svg>
              {/* American Express */}
              <svg className="h-4 sm:h-5 w-auto" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#006FCF"/>
                <text x="24" y="14" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">AMERICAN</text>
                <text x="24" y="22" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">EXPRESS</text>
              </svg>
              {/* Discover */}
              <svg className="h-4 sm:h-5 w-auto" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#FF6000"/>
                <circle cx="38" cy="16" r="8" fill="#FFAA00" opacity="0.3"/>
                <text x="10" y="20" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" fill="#000000">DISCOVER</text>
              </svg>
            </div>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Choose your payment method below.
        </p>
      </div>

      {/* Promo Code Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Have a Promo Code?
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Promo codes apply discounts to GritSync service fees only
        </p>
        
        {!appliedPromo ? (
          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter promo code"
              className="flex-1"
              disabled={validatingPromo}
            />
            <Button
              type="button"
              variant="outline"
              onClick={validatePromoCode}
              disabled={!promoCode.trim() || validatingPromo}
              className="px-4"
            >
              {validatingPromo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-800 dark:text-green-200">
                    {appliedPromo.code}
                  </span>
                </div>
                {appliedPromo.description && (
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-300 mt-1">
                    {appliedPromo.description}
                  </p>
                )}
                <p className="text-sm font-bold text-green-700 dark:text-green-200 mt-1">
                  Discount: -{formatCurrency(discountAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={removePromoCode}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                title="Remove promo code"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Show price breakdown if discount applied */}
      {discountAmount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Payment Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Government/Other Fees:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {formatCurrency(amount - (serviceFeeAmount || amount * 0.228))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">GritSync Service Fee:</span>
              <span className="line-through text-gray-500 dark:text-gray-400">
                {formatCurrency(serviceFeeAmount || amount * 0.228)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium pl-4">
              <span>Promo Discount (on service fee):</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-sm pl-4">
              <span className="text-gray-600 dark:text-gray-400">Service Fee After Discount:</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                {formatCurrency((serviceFeeAmount || amount * 0.228) - discountAmount)}
              </span>
            </div>
            <div className="flex justify-between text-base sm:text-lg font-bold pt-2 border-t border-blue-200 dark:border-blue-700">
              <span className="text-gray-900 dark:text-gray-100">Total Payment:</span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(finalAmount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Selection */}
      <div className="space-y-2 sm:space-y-3">
        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          Payment Method
        </label>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('mobile_banking')}
            className={`p-3 sm:p-4 border-2 rounded-lg transition-all ${
              paymentMethod === 'mobile_banking'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-xs sm:text-sm text-center">Mobile Banking</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`p-3 sm:p-4 border-2 rounded-lg transition-all ${
              paymentMethod === 'card'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5 sm:gap-2">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-xs sm:text-sm text-center">Credit/Debit Card</span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Banking Options */}
      {paymentMethod === 'mobile_banking' && (
        <div className="p-3 sm:p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 space-y-3 sm:space-y-4">
          {loadingConfigs ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary-600 dark:text-primary-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading payment options...</p>
            </div>
          ) : mobileBankingConfigs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">No mobile banking options available. Please contact support.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Bank/Service
                </label>
                <Select
                  value={selectedMobileBankingId}
                  onChange={(e) => setSelectedMobileBankingId(e.target.value)}
                  className="w-full"
                  options={mobileBankingConfigs.map(config => ({
                    value: config.id,
                    label: config.name,
                  }))}
                />
              </div>

              {/* Account Details - Dynamic based on selected config */}
              {selectedConfig && (
                <div className={`${
                  selectedConfig.id === 'bdo' 
                    ? 'bg-blue-900 dark:bg-blue-950'
                    : selectedConfig.id === 'gcash'
                    ? 'bg-gradient-to-br from-blue-900 to-blue-700 dark:from-blue-950 dark:to-blue-900'
                    : selectedConfig.id === 'zelle'
                    ? 'bg-gradient-to-br from-purple-900 to-purple-700 dark:from-purple-950 dark:to-purple-900'
                    : 'bg-gray-800 dark:bg-gray-900'
                } rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-lg`}>
                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-lg sm:rounded-xl flex items-center justify-center p-1.5 sm:p-2 shadow-md flex-shrink-0">
                      <img 
                        src={`/${selectedConfig.id.toLowerCase()} logo.png`}
                        alt={selectedConfig.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback: Try different variations
                          const target = e.target as HTMLImageElement
                          const currentSrc = target.src
                          
                          if (currentSrc.includes('logo.png')) {
                            // Try .jpeg extension
                            target.src = `/${selectedConfig.id.toLowerCase()} logo.jpeg`
                          } else if (currentSrc.includes('logo.jpeg')) {
                            // Try without space
                            target.src = `/${selectedConfig.id.toLowerCase()}logo.png`
                          } else {
                            // Final fallback: hide image
                            target.style.display = 'none'
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-white truncate">{selectedConfig.name}</h3>
                      <p className="text-xs text-gray-200 mt-0.5">
                        {selectedConfig.id === 'gcash' ? 'Mobile Wallet' : selectedConfig.id === 'zelle' ? 'Digital Payment' : 'Bank Transfer'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-lg p-2 sm:p-3 space-y-1 border border-white/20">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 py-1.5 border-b border-gray-200">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">Account Name:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedConfig.accountName)
                          showToast?.('Account name copied!', 'success')
                        }}
                        className="text-xs sm:text-sm font-bold text-gray-900 break-words sm:break-normal hover:text-primary-600 transition-colors cursor-pointer text-left sm:text-right"
                        title="Click to copy"
                      >
                        {selectedConfig.accountName}
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 py-1.5">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">Account Number:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedConfig.accountNumber)
                          showToast?.('Account number copied!', 'success')
                        }}
                        className="text-xs sm:text-sm font-bold text-gray-900 font-mono tracking-wider break-all sm:break-normal hover:text-primary-600 transition-colors cursor-pointer text-left sm:text-right"
                        title="Click to copy"
                      >
                        {selectedConfig.accountNumber}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 mb-2">
                  <strong>Instructions:</strong> Please transfer the payment amount to the account above. 
                  After completing the transfer, upload a screenshot or receipt as proof of payment below.
                </p>
                {selectedConfig && selectedConfig.name.toLowerCase() !== 'zelle' && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-amber-300 dark:border-amber-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <span className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">Amount to Pay:</span>
                      <div className="text-left sm:text-right">
                        {loadingRate ? (
                          <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">Loading rate...</span>
                        ) : usdToPhpRate ? (
                          <>
                            <div className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100">
                              ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(finalAmount * usdToPhpRate)} PHP
                            </div>
                            <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                              ({formatCurrency(finalAmount)} USD @ ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usdToPhpRate)}/USD)
                            </div>
                            {discountAmount > 0 && (
                              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Original: ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount * usdToPhpRate)} PHP
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">{formatCurrency(finalAmount)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {selectedConfig && selectedConfig.name.toLowerCase() === 'zelle' && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-amber-300 dark:border-amber-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <span className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">Amount to Pay:</span>
                      <div>
                        <div className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100">
                          {formatCurrency(finalAmount)}
                        </div>
                        {discountAmount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1 text-right">
                            Original: {formatCurrency(amount)}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Zelle payments are processed in USD
                    </p>
                  </div>
                )}
              </div>

              {/* Proof of Payment Upload */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Proof of Payment <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {proofOfPaymentFile ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{proofOfPaymentFile.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({(proofOfPaymentFile.size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProofOfPaymentFile(null)
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 sm:p-6 text-center hover:border-primary-500 dark:hover:border-primary-500 transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setProofOfPaymentFile(file)
                          }
                        }}
                        className="hidden"
                        id="proof-of-payment-upload"
                        required
                      />
                      <label
                        htmlFor="proof-of-payment-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Click to upload screenshot or receipt
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          JPG, PNG, WebP, or PDF (max 10MB)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Upload a screenshot or receipt showing your payment transaction. Your payment will be reviewed by an admin before approval.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Card Payment Form */}
      {paymentMethod === 'card' && (
        <div className="p-3 sm:p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          <PaymentElement
            options={{
              layout: 'tabs',
              fields: {
                billingDetails: {
                  email: 'auto',
                  phone: 'auto',
                  address: 'auto',
                },
              },
            }}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white" 
        disabled={loading || (paymentMethod === 'card' && (!stripe || !elements))}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay {formatCurrency(finalAmount)}
            {discountAmount > 0 && (
              <span className="ml-2 text-xs opacity-75 line-through">
                {formatCurrency(amount)}
              </span>
            )}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        {paymentMethod === 'card' 
          ? '🔒 Your payment information is secure and encrypted by Stripe'
          : '⚠️ Please ensure your payment is completed before submitting. Payment will be verified manually.'}
      </p>
    </form>
  )
}




