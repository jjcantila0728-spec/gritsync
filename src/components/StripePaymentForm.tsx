import { useState, FormEvent, useRef, useEffect } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { formatCurrency } from '@/lib/utils'
import { adminAPI } from '@/lib/api'
import { paymentSettings } from '@/lib/settings'
import { CreditCard, Loader2, Building2, Upload, X } from 'lucide-react'

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
  onSuccess: (paymentIntentId: string, paymentMethod?: PaymentMethod, details?: any, proofFile?: File) => void
  onError: (error: string) => void
  paymentIntentId?: string
}

export function StripePaymentForm({
  amount,
  onSuccess,
  onError
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
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
          reference: ''
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
          onSuccess(paymentIntent.id, 'card')
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
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Amount: {formatCurrency(amount)}
          </p>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Choose your payment method below.
        </p>
      </div>

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
                <div className={`bg-gradient-to-br ${
                  selectedConfig.id === 'bdo' 
                    ? 'from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-2 border-red-200 dark:border-red-800'
                    : selectedConfig.id === 'gcash'
                    ? 'from-blue-50 to-indigo-100/50 dark:from-blue-900/20 dark:to-indigo-800/10 border-2 border-blue-200 dark:border-blue-800'
                    : selectedConfig.id === 'zelle'
                    ? 'from-purple-50 to-violet-100/50 dark:from-purple-900/20 dark:to-violet-800/10 border-2 border-purple-200 dark:border-purple-800'
                    : 'from-gray-50 to-gray-100/50 dark:from-gray-900/20 dark:to-gray-800/10 border-2 border-gray-200 dark:border-gray-800'
                } rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-sm`}>
                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl flex items-center justify-center p-1.5 sm:p-2 shadow-md border ${
                      selectedConfig.id === 'bdo'
                        ? 'border-red-100 dark:border-red-900/50'
                        : selectedConfig.id === 'gcash'
                        ? 'border-blue-100 dark:border-blue-900/50'
                        : selectedConfig.id === 'zelle'
                        ? 'border-purple-100 dark:border-purple-900/50'
                        : 'border-gray-100 dark:border-gray-900/50'
                    } flex-shrink-0`}>
                      <img 
                        src={`/${selectedConfig.id.toLowerCase()} logo.png`}
                        alt={selectedConfig.name}
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            // Use createElement instead of innerHTML for security (prevents XSS)
                            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
                            svg.setAttribute('class', 'h-8 w-8 text-gray-600 dark:text-gray-400')
                            svg.setAttribute('fill', 'none')
                            svg.setAttribute('viewBox', '0 0 24 24')
                            svg.setAttribute('stroke', 'currentColor')
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
                            path.setAttribute('stroke-linecap', 'round')
                            path.setAttribute('stroke-linejoin', 'round')
                            path.setAttribute('stroke-width', '2')
                            path.setAttribute('d', 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4')
                            svg.appendChild(path)
                            parent.appendChild(svg)
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{selectedConfig.name}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {selectedConfig.id === 'gcash' ? 'Mobile Wallet' : selectedConfig.id === 'zelle' ? 'Digital Payment' : 'Bank Transfer'}
                      </p>
                    </div>
                  </div>
                  <div className={`bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3 border ${
                    selectedConfig.id === 'bdo'
                      ? 'border-red-100 dark:border-red-900/30'
                      : selectedConfig.id === 'gcash'
                      ? 'border-blue-100 dark:border-blue-900/30'
                      : selectedConfig.id === 'zelle'
                      ? 'border-purple-100 dark:border-purple-900/30'
                      : 'border-gray-100 dark:border-gray-900/30'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Account Name:</span>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 break-words sm:break-normal">{selectedConfig.accountName}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 py-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Account Number:</span>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 font-mono tracking-wider break-all sm:break-normal">{selectedConfig.accountNumber}</span>
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
                              ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount * usdToPhpRate)} PHP
                            </div>
                            <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                              ({formatCurrency(amount)} USD @ ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usdToPhpRate)}/USD)
                            </div>
                          </>
                        ) : (
                          <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">{formatCurrency(amount)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {selectedConfig && selectedConfig.name.toLowerCase() === 'zelle' && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-amber-300 dark:border-amber-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <span className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">Amount to Pay:</span>
                      <div className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100">
                        {formatCurrency(amount)}
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
        className="w-full" 
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
            Pay {formatCurrency(amount)}
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




