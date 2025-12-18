import { useEffect, useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

interface SignatureSuccessAnimationProps {
  onComplete: () => void
  message?: string
  loadingDuration?: number
  successDuration?: number
}

export function SignatureSuccessAnimation({ 
  onComplete, 
  message = 'Signature submitted successfully!',
  loadingDuration = 2000,
  successDuration = 3000
}: SignatureSuccessAnimationProps) {
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    // Show loading animation first
    const loadingTimer = setTimeout(() => {
      setShowSuccess(true)
      // After success animation, call onComplete
      const successTimer = setTimeout(() => {
        onComplete()
      }, successDuration)

      return () => clearTimeout(successTimer)
    }, loadingDuration)

    return () => clearTimeout(loadingTimer)
  }, [onComplete, loadingDuration, successDuration])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-gray-900">
      {!showSuccess ? (
        // Full Page Loading Animation with fast circling
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <div className="relative w-40 h-40 mb-8">
            {/* Fast spinning outer circle */}
            <div className="absolute inset-0 border-8 border-transparent border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin" style={{ animationDuration: '0.3s' }}></div>
            {/* Medium spinning circle */}
            <div className="absolute inset-2 border-6 border-transparent border-r-primary-500 dark:border-r-primary-500 rounded-full animate-spin" style={{ animationDuration: '0.4s', animationDirection: 'reverse' }}></div>
            {/* Inner fast spinning circle */}
            <div className="absolute inset-6 border-4 border-transparent border-b-primary-400 dark:border-b-primary-600 rounded-full animate-spin" style={{ animationDuration: '0.2s' }}></div>
            {/* Center pulsing dot */}
            <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary-600 dark:bg-primary-400 rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 animate-pulse">
            Processing...
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md text-center px-4">
            Please wait while we process your signature and create your documents
          </p>
        </div>
      ) : (
        // Full Page Success Animation
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-green-800/20">
          <div className="relative w-48 h-48 mb-8">
            <CheckCircle className="w-48 h-48 text-green-600 dark:text-green-400" strokeWidth={2.5} style={{ animation: 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
            <div className="absolute inset-0 bg-green-500/30 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-4 bg-green-500/20 rounded-full animate-pulse"></div>
            <div className="absolute inset-8 bg-green-500/10 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          </div>
          <h3 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            Success!
          </h3>
          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-lg text-center px-4 font-medium" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
            {message}
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400" style={{ animation: 'fadeIn 0.6s ease-out 0.4s both' }}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Your documents are being prepared...</span>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// Add CSS animations (you may need to add these to your global CSS)
// @keyframes scale-in {
//   from {
//     transform: scale(0);
//     opacity: 0;
//   }
//   to {
//     transform: scale(1);
//     opacity: 1;
//   }
// }
// @keyframes fade-in {
//   from {
//     opacity: 0;
//   }
//   to {
//     opacity: 1;
//   }
// }

