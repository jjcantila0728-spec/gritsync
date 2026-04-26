import { useState, useEffect, useRef, FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { adminAPI } from '@/lib/api'
import { paymentSettings } from '@/lib/settings'
import { useToast } from '@/components/ui/Toast'
import { db } from '@/lib/api-client'
import {
  CreditCard,
  Loader2,
  Building2,
  Upload,
  X,
  Tag,
  Image as ImageIcon,
  FileText,
  CheckCircle,
} from 'lucide-react'

interface MobileBankingConfig {
  id: string
  name: string
  accountName: string
  accountNumber: string
  enabled: boolean
}

interface MobileBankingCheckoutFormProps {
  amount: number
  serviceFeeAmount?: number
  applicationType?: 'NCLEX'
  phpAmount?: number
  onSuccess: (
    paymentIntentId: string,
    paymentMethod?: 'card' | 'mobile_banking',
    details?: any,
    proofFile?: File
  ) => void
  onError: (error: string) => void
  processingPayment?: boolean
}

export function MobileBankingCheckoutForm({
  amount,
  serviceFeeAmount,
  applicationType,
  phpAmount,
  onSuccess,
  onError,
  processingPayment: externalProcessing = false,
}: MobileBankingCheckoutFormProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const isProcessing = loading || externalProcessing
  const [error, setError] = useState('')
  const [mobileBankingConfigs, setMobileBankingConfigs] = useState<MobileBankingConfig[]>([])
  const [selectedMobileBankingId, setSelectedMobileBankingId] = useState<string>('')
  const [proofOfPaymentData, setProofOfPaymentData] = useState<{
    arrayBuffer: ArrayBuffer
    fileName: string
    fileType: string
    fileSize: number
  } | null>(null)
  const [proofOfPaymentPreview, setProofOfPaymentPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [usdToPhpRate, setUsdToPhpRate] = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)
  const [loadingConfigs, setLoadingConfigs] = useState(true)

  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<any>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)

  useEffect(() => {
    async function loadConfigs() {
      try {
        setLoadingConfigs(true)
        const configs = await paymentSettings.getMobileBankingConfigs()
        setMobileBankingConfigs(configs)
        if (configs.length > 0) setSelectedMobileBankingId(configs[0].id)
      } catch {
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

  const selectedConfig = mobileBankingConfigs.find((c) => c.id === selectedMobileBankingId)
  const finalAmount = amount - discountAmount

  useEffect(() => {
    if (selectedConfig) {
      const needsConversion = selectedConfig.name.toLowerCase() !== 'zelle'
      if (needsConversion) {
        setLoadingRate(true)
        adminAPI
          .getUsdToPhpRate()
          .then((rate) => setUsdToPhpRate(rate))
          .catch(() => setUsdToPhpRate(56.0))
          .finally(() => setLoadingRate(false))
      } else {
        setUsdToPhpRate(null)
        setLoadingRate(false)
      }
    }
  }, [selectedConfig])

  async function handleFileSelect(file: File) {
    setUploadError(null)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
    if (!allowedExts.includes(fileExt)) {
      setUploadError('Please upload an image (JPG, PNG, WebP) or PDF file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 10MB.')
      return
    }
    try {
      const arrayBuffer = await file.arrayBuffer()
      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', pdf: 'application/pdf',
      }
      const detectedType = mimeTypes[fileExt] || 'application/octet-stream'
      setProofOfPaymentData({ arrayBuffer, fileName: file.name, fileType: detectedType, fileSize: file.size })
      if (detectedType.startsWith('image/')) {
        const blob = new Blob([arrayBuffer], { type: detectedType })
        setProofOfPaymentPreview(URL.createObjectURL(blob))
      } else {
        setProofOfPaymentPreview(null)
      }
      showToast?.('File ready for upload!', 'success')
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to read file. Please try again.')
    }
  }

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      showToast?.('Please enter a promo code', 'error')
      return
    }
    setValidatingPromo(true)
    try {
      const { data, error } = await db.rpc('validate_promo_code', {
        p_code: promoCode.toUpperCase(),
        p_amount: amount,
        p_service_fee_amount: serviceFeeAmount || null,
        p_application_type: applicationType || null,
      })
      if (error) throw error
      if (data?.valid) {
        setAppliedPromo(data)
        setDiscountAmount(data.discount_amount)
        showToast?.(`Promo code applied! You save ${formatCurrency(data.discount_amount)}`, 'success')
      } else {
        showToast?.(data?.error || 'Invalid promo code', 'error')
        setPromoCode('')
      }
    } catch {
      showToast?.('Failed to validate promo code', 'error')
      setPromoCode('')
    } finally {
      setValidatingPromo(false)
    }
  }

  const removePromoCode = () => {
    setAppliedPromo(null)
    setDiscountAmount(0)
    setPromoCode('')
    showToast?.('Promo code removed', 'info')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!proofOfPaymentData) {
      const msg = 'Please upload proof of payment before submitting.'
      setError(msg)
      onError(msg)
      setLoading(false)
      return
    }
    if (!proofOfPaymentData.arrayBuffer || proofOfPaymentData.fileSize === 0) {
      const msg = 'Proof of payment file is invalid. Please upload again.'
      setError(msg)
      onError(msg)
      setLoading(false)
      return
    }

    const blob = new Blob([proofOfPaymentData.arrayBuffer], { type: proofOfPaymentData.fileType })
    const file = new File([blob], proofOfPaymentData.fileName, { type: proofOfPaymentData.fileType })

    onSuccess('mobile_banking', 'mobile_banking', {
      number: selectedConfig?.name || selectedMobileBankingId,
      reference: '',
      promo_code_id: appliedPromo?.promo_code_id,
      promo_code: appliedPromo?.code,
      discount_amount: discountAmount,
    }, file)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Header row */}
      <div className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              Amount: {phpAmount != null ? `₱${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(phpAmount)}` : formatCurrency(amount)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <img src="/bdo logo.png" alt="BDO" className="h-5 sm:h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <img src="/gcash logo.jpeg" alt="GCash" className="h-5 sm:h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <img src="/zelle logo.png" alt="Zelle" className="h-5 sm:h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Choose your payment method below.</p>
      </div>

      {/* Promo Code */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Have a Promo Code?
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Promo codes apply discounts to GritSync service fees only</p>
        {!appliedPromo ? (
          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter promo code"
              className="flex-1"
              disabled={validatingPromo}
            />
            <Button type="button" variant="outline" onClick={validatePromoCode} disabled={!promoCode.trim() || validatingPromo} className="px-4">
              {validatingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-800 dark:text-green-200">{appliedPromo.code}</span>
                </div>
                {appliedPromo.description && (
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-300 mt-1">{appliedPromo.description}</p>
                )}
                <p className="text-sm font-bold text-green-700 dark:text-green-200 mt-1">Discount: -{formatCurrency(discountAmount)}</p>
              </div>
              <button type="button" onClick={removePromoCode} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discount breakdown */}
      {discountAmount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Payment Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Government/Other Fees:</span>
              <span className="font-medium">{formatCurrency(amount - (serviceFeeAmount || amount * 0.228))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">GritSync Service Fee:</span>
              <span className="line-through text-gray-500">{formatCurrency(serviceFeeAmount || amount * 0.228)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium pl-4">
              <span>Promo Discount:</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-base sm:text-lg font-bold pt-2 border-t border-blue-200 dark:border-blue-700">
              <span className="text-gray-900 dark:text-gray-100">Total Payment:</span>
              <span className="text-green-600 dark:text-green-400">{formatCurrency(finalAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method tabs */}
      <div className="space-y-2 sm:space-y-3">
        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            className="p-3 sm:p-4 border-2 rounded-lg border-primary-600 bg-primary-50 dark:bg-primary-900/20"
          >
            <div className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-xs sm:text-sm text-center">Mobile Banking</span>
            </div>
          </button>
          <div className="p-3 sm:p-4 border-2 rounded-lg border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed relative">
            <div className="flex flex-col items-center gap-1.5 sm:gap-2">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-xs sm:text-sm text-center">Credit/Debit Card</span>
            </div>
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gray-500 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
              Unavailable
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Banking Options */}
      <div className="p-3 sm:p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 space-y-3 sm:space-y-4">
        {loadingConfigs ? (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary-600 dark:text-primary-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading payment options...</p>
          </div>
        ) : mobileBankingConfigs.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">No mobile banking options available. Please contact support.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Bank/Service</label>
              <Select
                value={selectedMobileBankingId}
                onChange={(e) => setSelectedMobileBankingId(e.target.value)}
                className="w-full"
                options={mobileBankingConfigs.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>

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
                        const t = e.target as HTMLImageElement
                        if (t.src.includes('logo.png')) t.src = `/${selectedConfig.id.toLowerCase()} logo.jpeg`
                        else t.style.display = 'none'
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
                      onClick={() => { navigator.clipboard.writeText(selectedConfig.accountName); showToast?.('Account name copied!', 'success') }}
                      className="text-xs sm:text-sm font-bold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer text-left sm:text-right"
                      title="Click to copy"
                    >
                      {selectedConfig.accountName}
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 py-1.5">
                    <span className="text-xs sm:text-sm font-medium text-gray-600">Account Number:</span>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(selectedConfig.accountNumber); showToast?.('Account number copied!', 'success') }}
                      className="text-xs sm:text-sm font-bold text-gray-900 font-mono tracking-wider hover:text-primary-600 transition-colors cursor-pointer text-left sm:text-right"
                      title="Click to copy"
                    >
                      {selectedConfig.accountNumber}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions + Amount */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 mb-2">
                <strong>Instructions:</strong> Transfer the payment amount to the account above.
                After completing the transfer, upload a screenshot or receipt as proof of payment below.
              </p>
              {selectedConfig && (
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-amber-300 dark:border-amber-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <span className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">Amount to Pay:</span>
                    <div className="text-left sm:text-right">
                      {phpAmount != null ? (
                        <div className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100">
                          ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(phpAmount)}
                        </div>
                      ) : selectedConfig.name.toLowerCase() === 'zelle' ? (
                        <>
                          <div className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100">{formatCurrency(finalAmount)}</div>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Zelle payments are in USD</p>
                        </>
                      ) : loadingRate ? (
                        <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">Loading rate...</span>
                      ) : usdToPhpRate ? (
                        <>
                          <div className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100">
                            ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(finalAmount * usdToPhpRate)} PHP
                          </div>
                          <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            ({formatCurrency(finalAmount)} USD @ ₱{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usdToPhpRate)}/USD)
                          </div>
                        </>
                      ) : (
                        <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">{formatCurrency(finalAmount)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Proof of Payment Upload */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proof of Payment <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {proofOfPaymentData ? (
                  <div className="space-y-3">
                    <div className="relative border border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-green-50 dark:bg-green-900/20">
                      {proofOfPaymentPreview ? (
                        <div className="relative">
                          <img src={proofOfPaymentPreview} alt="Proof preview" className="w-full h-48 object-contain" />
                          <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Ready
                          </div>
                        </div>
                      ) : proofOfPaymentData.fileType === 'application/pdf' ? (
                        <div className="flex flex-col items-center justify-center p-8">
                          <FileText className="h-16 w-16 text-green-600 dark:text-green-400 mb-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{proofOfPaymentData.fileName}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8">
                          <ImageIcon className="h-16 w-16 text-green-600 dark:text-green-400 mb-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{proofOfPaymentData.fileName}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{proofOfPaymentData.fileName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{(proofOfPaymentData.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProofOfPaymentData(null)
                          if (proofOfPaymentPreview) URL.revokeObjectURL(proofOfPaymentPreview)
                          setProofOfPaymentPreview(null)
                          setUploadError(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={dropZoneRef}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 sm:p-8 text-center hover:border-primary-500 dark:hover:border-primary-500 transition-colors bg-gray-50 dark:bg-gray-800/50"
                    onDragOver={(e) => { e.preventDefault(); dropZoneRef.current?.classList.add('border-primary-500', 'bg-primary-50') }}
                    onDragLeave={(e) => { e.preventDefault(); dropZoneRef.current?.classList.remove('border-primary-500', 'bg-primary-50') }}
                    onDrop={(e) => {
                      e.preventDefault()
                      dropZoneRef.current?.classList.remove('border-primary-500', 'bg-primary-50')
                      const file = e.dataTransfer.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                      className="hidden"
                      id="mb-proof-upload"
                    />
                    <label htmlFor="mb-proof-upload" className="cursor-pointer flex flex-col items-center gap-3">
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Click to upload or drag and drop</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">Screenshot or receipt (JPG, PNG, WebP, or PDF)</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Maximum file size: 10MB</span>
                    </label>
                  </div>
                )}
                {uploadError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isProcessing || !proofOfPaymentData}
        className="w-full py-3 text-base font-semibold"
      >
        {isProcessing ? (
          <><Loader2 className="h-5 w-5 animate-spin mr-2" />Processing...</>
        ) : (
          `Submit Payment — ${formatCurrency(finalAmount)}`
        )}
      </Button>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        Your payment will be reviewed and confirmed by our team within 24 hours.
      </p>
    </form>
  )
}
