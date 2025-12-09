# Error Handling Guide

This guide explains how to use the enhanced error handling system in the MVP.

## Overview

The error handling system provides:
- **Centralized error classification** - Automatically categorizes errors (network, auth, validation, etc.)
- **User-friendly messages** - Converts technical errors into actionable messages
- **Retry logic** - Automatically retries transient errors (network, timeouts)
- **Error logging** - Structured logging with context
- **Error boundaries** - React error boundaries with recovery options

## Basic Usage

### In Components (Recommended)

Use the `useErrorHandler` hook for easy error handling:

```typescript
import { useErrorHandler } from '@/lib/use-error-handler'

function MyComponent() {
  const { handleError, executeWithErrorHandling } = useErrorHandler()
  const { showToast } = useToast()

  // Option 1: Execute with automatic error handling
  const handleSubmit = async () => {
    const result = await executeWithErrorHandling(
      async () => {
        return await someAPI.call()
      },
      {
        showToast: true, // Automatically show toast on error
        context: { operation: 'submitForm' },
        retry: true, // Enable retry for network errors
      }
    )

    if (result) {
      showToast('Success!', 'success')
    }
  }

  // Option 2: Manual error handling
  const handleAction = async () => {
    try {
      await someAPI.call()
    } catch (error) {
      handleError(error, { operation: 'action' })
    }
  }

  return <div>...</div>
}
```

### In API Functions

Use the error handling utilities directly:

```typescript
import { normalizeError, handleSupabaseError, retryWithBackoff } from '@/lib/error-handler'

export const myAPI = {
  getData: async () => {
    try {
      const { data, error } = await supabase
        .from('table')
        .select('*')

      if (error) {
        throw normalizeError(error, { operation: 'myAPI.getData' })
      }

      return data
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error
      }
      throw normalizeError(error, { operation: 'myAPI.getData' })
    }
  },

  // With retry logic
  fetchWithRetry: async () => {
    return await retryWithBackoff(
      async () => {
        const { data, error } = await supabase.from('table').select('*')
        if (error) throw normalizeError(error)
        return data
      },
      3, // max retries
      1000 // initial delay
    )
  }
}
```

### Error Types

The system automatically classifies errors:

- **NETWORK** - Connection issues (retryable)
- **AUTHENTICATION** - Session expired, invalid credentials
- **AUTHORIZATION** - Permission denied
- **VALIDATION** - Invalid input data
- **NOT_FOUND** - Resource not found
- **SERVER** - Server errors (retryable)
- **TIMEOUT** - Request timeout (retryable)
- **RATE_LIMIT** - Too many requests (retryable)
- **UNKNOWN** - Unclassified errors

### Error Severity

- **LOW** - Informational (validation errors, not found)
- **MEDIUM** - Warning (network issues, timeouts)
- **HIGH** - Error (auth failures, server errors)
- **CRITICAL** - Critical (system failures)

## Advanced Usage

### Custom Error Classification

```typescript
import { AppError, ErrorType, ErrorSeverity } from '@/lib/error-handler'

throw new AppError(
  'Custom error message',
  ErrorType.VALIDATION,
  ErrorSeverity.LOW,
  false, // not retryable
  originalError,
  { customContext: 'value' }
)
```

### Safe Async Wrapper

```typescript
import { safeAsync } from '@/lib/error-handler'

const { data, error } = await safeAsync(
  async () => await someAPI.call(),
  { operation: 'myOperation' }
)

if (error) {
  // Handle error
} else {
  // Use data
}
```

### Error Boundary

The `ErrorBoundary` component automatically:
- Catches React errors
- Shows user-friendly error UI
- Provides retry options
- Logs errors with context
- Supports error reporting services

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

<ErrorBoundary
  onError={(error, errorInfo) => {
    // Custom error handler
    console.log('Error caught:', error)
  }}
>
  <YourComponent />
</ErrorBoundary>
```

## Best Practices

1. **Always use error handling** - Don't let errors go unhandled
2. **Provide context** - Include operation names and relevant data
3. **Use retry for transient errors** - Network, timeout, and server errors
4. **Show user-friendly messages** - Use `getUserFriendlyMessage()` or `handleError()`
5. **Log errors appropriately** - Errors are automatically logged with context
6. **Use ErrorBoundary** - Wrap major sections in error boundaries

## Migration from Old Code

### Before:
```typescript
try {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw new Error(error.message)
  return data
} catch (error) {
  showToast(error.message, 'error')
}
```

### After:
```typescript
import { normalizeError } from '@/lib/error-handler'
import { useErrorHandler } from '@/lib/use-error-handler'

const { executeWithErrorHandling } = useErrorHandler()

const result = await executeWithErrorHandling(
  async () => {
    const { data, error } = await supabase.from('table').select('*')
    if (error) throw normalizeError(error, { operation: 'getData' })
    return data
  },
  { showToast: true, retry: true }
)
```

## Error Reporting

The system is ready for integration with error reporting services:

- **Sentry** - Automatically detected and used if available
- **Google Analytics** - Automatically sends error events
- **Custom services** - Add in `error-handler.ts` `logError()` function

## Testing

Errors can be tested by:

```typescript
import { AppError, ErrorType } from '@/lib/error-handler'

// Test error classification
const error = new AppError('Test', ErrorType.NETWORK)
expect(error.retryable).toBe(true)
```

