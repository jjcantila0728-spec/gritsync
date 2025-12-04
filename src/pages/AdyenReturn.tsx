import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { applicationPaymentsAPI } from '@/lib/supabase-api'
import { useToast } from '@/components/ui/Toast'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function AdyenReturn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    handleAdyenReturn()
  }, [])

  async function handleAdyenReturn() {
    const paymentId = searchParams.get('payment_id')
    const resultCode = searchParams.get('resultCode')
    const pspReference = searchParams.get('pspReference')

    if (!paymentId) {
      setError('Payment ID is missing')
      setStatus('error')
      return
    }

    try {
      if (resultCode === 'Authorised' && pspReference) {
        // Payment successful
        await applicationPaymentsAPI.complete(
          paymentId,
          pspReference,
          undefined,
          'gcash'
        )
        
        setStatus('success')
        showToast('GCash payment completed successfully!', 'success')
        
        // Redirect to payment page after 2 seconds
        setTimeout(() => {
          navigate(`/applications/${searchParams.get('application_id')}/payment`)
        }, 2000)
      } else {
        // Payment failed or cancelled
        setError('Payment was not completed. Please try again.')
        setStatus('error')
        showToast('Payment was not completed', 'error')
      }
    } catch (err: any) {
      console.error('Error processing Adyen return:', err)
      setError(err.message || 'Failed to process payment return')
      setStatus('error')
      showToast(err.message || 'Failed to process payment', 'error')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 dark:text-primary-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Processing your payment...</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Payment Successful!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your GCash payment has been processed successfully. You will be redirected shortly.
          </p>
          <Button onClick={() => navigate(`/applications/${searchParams.get('application_id')}/payment`)}>
            Go to Payment Page
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center max-w-md mx-auto p-6">
        <XCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Payment Failed
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error || 'Your payment could not be processed. Please try again.'}
        </p>
        <Button onClick={() => navigate(`/applications/${searchParams.get('application_id')}/payment`)}>
          Try Again
        </Button>
      </div>
    </div>
  )
}

