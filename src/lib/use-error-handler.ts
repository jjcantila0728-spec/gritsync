/**
 * React hook for error handling
 * Provides easy-to-use error handling utilities in components
 */

import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { 
  normalizeError, 
  getUserFriendlyMessage, 
  handleError,
  safeAsync,
  retryWithBackoff,
  type AppError
} from './error-handler'

/**
 * Hook for handling errors in components
 * Automatically shows toast notifications and returns user-friendly messages
 */
export function useErrorHandler() {
  const { showToast } = useToast()

  const handleErrorWithToast = useCallback((error: any, context?: Record<string, any>) => {
    const errorMessage = handleError(error, context)
    showToast(errorMessage, 'error')
    return errorMessage
  }, [showToast])

  const handleErrorSilently = useCallback((error: any, context?: Record<string, any>): string => {
    return handleError(error, context)
  }, [])

  const executeWithErrorHandling = useCallback(async <T,>(
    fn: () => Promise<T>,
    options?: {
      showToast?: boolean
      context?: Record<string, any>
      retry?: boolean
      onError?: (error: AppError) => void
    }
  ): Promise<T | null> => {
    const { 
      showToast: showToastOnError = true, 
      context, 
      retry = false,
      onError 
    } = options || {}

    try {
      if (retry) {
        return await retryWithBackoff(fn, 3, 1000)
      }
      return await fn()
    } catch (error: any) {
      const normalizedError = normalizeError(error, context)
      
      if (onError) {
        onError(normalizedError)
      }

      if (showToastOnError) {
        handleErrorWithToast(normalizedError, context)
      }

      return null
    }
  }, [handleErrorWithToast])

  const getUserMessage = useCallback((error: any): string => {
    return getUserFriendlyMessage(error)
  }, [])

  return {
    handleError: handleErrorWithToast,
    handleErrorSilently,
    executeWithErrorHandling,
    getUserMessage,
    safeAsync: <T,>(fn: () => Promise<T>, context?: Record<string, any>) => 
      safeAsync(fn, context),
  }
}



