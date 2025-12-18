/**
 * Centralized Error Handling System
 * Provides consistent error handling, classification, and user-friendly messages
 */

// Error types for classification
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Error classification interface
export interface ErrorClassification {
  type: ErrorType
  severity: ErrorSeverity
  userMessage: string
  retryable: boolean
  retryDelay?: number
  logLevel: 'error' | 'warn' | 'info'
}

// Custom error class with classification
export class AppError extends Error {
  public readonly type: ErrorType
  public readonly severity: ErrorSeverity
  public readonly retryable: boolean
  public readonly retryDelay?: number
  public readonly originalError?: any
  public readonly context?: Record<string, any>

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryable: boolean = false,
    originalError?: any,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    this.type = type
    this.severity = severity
    this.retryable = retryable
    this.originalError = originalError
    this.context = context

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

/**
 * Classify and normalize errors from various sources
 */
export function classifyError(error: any): ErrorClassification {
  const errorMessage = error?.message || String(error || 'Unknown error')
  const errorCode = error?.code || error?.status || error?.statusCode
  const errorName = error?.name || ''

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorName === 'NetworkError' ||
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ENOTFOUND'
  ) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      retryable: true,
      retryDelay: 2000,
      logLevel: 'warn',
    }
  }

  // Timeout errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('Timeout') ||
    errorName === 'TimeoutError' ||
    errorCode === 'ETIMEDOUT'
  ) {
    return {
      type: ErrorType.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'The request took too long. Please try again.',
      retryable: true,
      retryDelay: 3000,
      logLevel: 'warn',
    }
  }

  // Authentication errors
  if (
    errorMessage.includes('Not authenticated') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Invalid credentials') ||
    errorMessage.includes('authentication') ||
    errorCode === 401 ||
    error?.status === 401
  ) {
    return {
      type: ErrorType.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      userMessage: 'Your session has expired. Please log in again.',
      retryable: false,
      logLevel: 'warn',
    }
  }

  // Authorization errors
  if (
    errorMessage.includes('Forbidden') ||
    errorMessage.includes('Permission denied') ||
    errorMessage.includes('Not authorized') ||
    errorMessage.includes('Access denied') ||
    errorCode === 403 ||
    error?.status === 403
  ) {
    return {
      type: ErrorType.AUTHORIZATION,
      severity: ErrorSeverity.HIGH,
      userMessage: 'You do not have permission to perform this action.',
      retryable: false,
      logLevel: 'warn',
    }
  }

  // Not found errors
  if (
    errorMessage.includes('Not found') ||
    errorMessage.includes('does not exist') ||
    errorCode === 404 ||
    error?.status === 404
  ) {
    return {
      type: ErrorType.NOT_FOUND,
      severity: ErrorSeverity.LOW,
      userMessage: 'The requested resource was not found.',
      retryable: false,
      logLevel: 'info',
    }
  }

  // Validation errors
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('Invalid') ||
    errorMessage.includes('required') ||
    errorCode === 400 ||
    error?.status === 400
  ) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      userMessage: errorMessage || 'Please check your input and try again.',
      retryable: false,
      logLevel: 'info',
    }
  }

  // Rate limit errors
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorCode === 429 ||
    error?.status === 429
  ) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'Too many requests. Please wait a moment and try again.',
      retryable: true,
      retryDelay: 5000,
      logLevel: 'warn',
    }
  }

  // Server errors (5xx)
  if (errorCode >= 500 || (error?.status && error.status >= 500)) {
    return {
      type: ErrorType.SERVER,
      severity: ErrorSeverity.HIGH,
      userMessage: 'A server error occurred. Please try again later or contact support if the problem persists.',
      retryable: true,
      retryDelay: 5000,
      logLevel: 'error',
    }
  }

  // Supabase-specific errors
  if (error?.code) {
    // Supabase error codes
    const supabaseErrorMap: Record<string, ErrorClassification> = {
      'PGRST116': {
        type: ErrorType.NOT_FOUND,
        severity: ErrorSeverity.LOW,
        userMessage: 'The requested resource was not found.',
        retryable: false,
        logLevel: 'info',
      },
      '23505': {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'This record already exists. Please check for duplicates.',
        retryable: false,
        logLevel: 'info',
      },
      '23503': {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'Invalid reference. Please check your input.',
        retryable: false,
        logLevel: 'info',
      },
      '42501': {
        type: ErrorType.AUTHORIZATION,
        severity: ErrorSeverity.HIGH,
        userMessage: 'You do not have permission to perform this action.',
        retryable: false,
        logLevel: 'warn',
      },
    }

    if (supabaseErrorMap[error.code]) {
      return supabaseErrorMap[error.code]
    }
  }

  // Default/unknown error
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    userMessage: errorMessage || 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    retryable: false,
    logLevel: 'error',
  }
}

/**
 * Create a user-friendly error message
 */
export function getUserFriendlyMessage(error: any, fallback?: string): string {
  const classification = classifyError(error)
  return classification.userMessage || fallback || 'An unexpected error occurred.'
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  const classification = classifyError(error)
  return classification.retryable
}

/**
 * Get retry delay for an error
 */
export function getRetryDelay(error: any): number {
  const classification = classifyError(error)
  return classification.retryDelay || 1000
}

/**
 * Normalize error to AppError
 */
export function normalizeError(error: any, context?: Record<string, any>): AppError {
  if (error instanceof AppError) {
    return error
  }

  const classification = classifyError(error)
  const userMessage = classification.userMessage

  return new AppError(
    userMessage,
    classification.type,
    classification.severity,
    classification.retryable,
    error,
    context
  )
}

/**
 * Log error with appropriate level
 */
export function logError(error: any, context?: Record<string, any>): void {
  const classification = classifyError(error)
  const errorDetails = {
    message: error?.message || String(error),
    type: classification.type,
    severity: classification.severity,
    stack: error?.stack,
    context,
    timestamp: new Date().toISOString(),
  }

  // Log based on severity
  switch (classification.logLevel) {
    case 'error':
      console.error('Error:', errorDetails)
      break
    case 'warn':
      console.warn('Warning:', errorDetails)
      break
    case 'info':
      console.info('Info:', errorDetails)
      break
  }

  // In production, send to error tracking service
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    // Example: Send to error tracking service (Sentry, LogRocket, etc.)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { extra: context })
    // }
  }
}

/**
 * Handle error with logging and return user-friendly message
 */
export function handleError(error: any, context?: Record<string, any>): string {
  const normalizedError = normalizeError(error, context)
  logError(normalizedError, context)
  return normalizedError.message
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  error?: any
): Promise<T> {
  const delay = error ? getRetryDelay(error) : initialDelay
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err

      // Don't retry if error is not retryable
      if (!isRetryableError(err)) {
        throw err
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break
      }

      // Calculate exponential backoff delay
      const backoffDelay = delay * Math.pow(2, attempt)

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, backoffDelay))
    }
  }

  throw lastError
}

/**
 * Safe async wrapper that handles errors gracefully
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn()
    return { data, error: null }
  } catch (error: any) {
    const errorMessage = handleError(error, context)
    return { data: null, error: errorMessage }
  }
}

/**
 * Enhanced Supabase error handler
 */
export function handleSupabaseError(error: any, context?: Record<string, any>): never {
  const normalizedError = normalizeError(error, context)
  logError(normalizedError, context)
  throw normalizedError
}



