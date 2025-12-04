import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { Smartphone, Loader2, ExternalLink } from 'lucide-react'
import { applicationPaymentsAPI } from '@/lib/supabase-api'

interface AdyenGCashFormProps {
  paymentId: string
  amount: number
  onSuccess: (pspReference: string) => void
  onError: (error: string) => void
}

export function AdyenGCashForm({
  paymentId,
  amount,
  onSuccess,
  onError,
}: AdyenGCashFormProps) {
  const [loading, setLoading] = useState(false)
  const [adyenAction, setAdyenAction] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Create Adyen payment when component mounts
    createAdyenPayment()
  }, [])

  async function createAdyenPayment() {
    setLoading(true)
    setError('')

    try {
      const result = await applicationPaymentsAPI.createAdyenPayment(paymentId, amount)
      
      if (result.action && result.action.type === 'redirect') {
        // Store action for redirect
        setAdyenAction(result.action)
      } else if (result.resultCode === 'Authorised' || result.resultCode === 'Received') {
        // Payment already authorized or received
        if (result.pspReference) {
          onSuccess(result.pspReference)
        } else {
          throw new Error('Payment reference not received')
        }
      } else {
        throw new Error(result.resultCode || 'Payment failed')
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initialize GCash payment. Please try again.'
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function handleRedirect() {
    if (adyenAction && adyenAction.url) {
      // Redirect to Adyen GCash payment page
      window.location.href = adyenAction.url
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
        </div>
        <p className="text-center text-gray-600 dark:text-gray-400">
          Initializing GCash payment...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
        <Button onClick={createAdyenPayment} className="w-full">
          Try Again
        </Button>
      </div>
    )
  }

  if (adyenAction && adyenAction.type === 'redirect') {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Amount: {formatCurrency(amount)}
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You will be redirected to GCash to complete your payment.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            <strong>How to pay with GCash:</strong>
          </p>
          <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>Click the button below to open GCash</li>
            <li>Log in to your GCash account</li>
            <li>Confirm the payment amount</li>
            <li>Complete the payment</li>
            <li>You will be redirected back to confirm your payment</li>
          </ol>
        </div>

        <Button 
          onClick={handleRedirect}
          className="w-full"
          disabled={!adyenAction.url}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Continue to GCash
        </Button>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          🔒 Your payment is secured by Adyen
        </p>
      </div>
    )
  }

  return null
}

