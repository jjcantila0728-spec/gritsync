import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react'
import { normalizeError, logError, classifyError, type AppError, ErrorType } from '@/lib/error-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0
  private readonly maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Normalize and classify the error
    const normalizedError = normalizeError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    })

    // Log error with enhanced context
    logError(normalizedError, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      errorId: this.state.errorId,
    })
    
    // Store error in state for display
    this.setState({
      error: normalizedError,
      errorInfo,
    })
    
    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(normalizedError, errorInfo)
      } catch (e) {
        console.error('Error in onError callback:', e)
      }
    }
    
    // Send error to analytics/monitoring service
    if (typeof window !== 'undefined') {
      // Google Analytics
      if ((window as any).gtag) {
        try {
          (window as any).gtag('event', 'exception', {
            description: normalizedError.toString(),
            fatal: true,
            errorId: this.state.errorId,
          })
        } catch (e) {
          // Ignore analytics errors
        }
      }

      // Sentry (if available)
      if ((window as any).Sentry) {
        try {
          (window as any).Sentry.captureException(normalizedError, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack,
              },
            },
            tags: {
              errorId: this.state.errorId,
              errorBoundary: true,
            },
          })
        } catch (e) {
          // Ignore Sentry errors
        }
      }
    }
  }

  handleReset = () => {
    // Increment retry count
    this.retryCount++

    // If we've exceeded max retries, do a full page reload
    if (this.retryCount > this.maxRetries) {
      window.location.reload()
      return
    }

    // Otherwise, try to reset the error boundary
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyError = async () => {
    if (!this.state.error || !this.state.errorInfo) return

    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error.message,
      stack: this.state.error.stack,
      componentStack: this.state.errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    const errorText = JSON.stringify(errorDetails, null, 2)

    try {
      await navigator.clipboard.writeText(errorText)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorClassification = this.state.error 
        ? classifyError(this.state.error)
        : null
      
      const isNetworkError = errorClassification?.type === ErrorType.NETWORK
      const isAuthError = errorClassification?.type === ErrorType.AUTHENTICATION

      return (
        <div 
          className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <Card className="max-w-2xl w-full">
            <div className="text-center p-8">
              <div 
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4"
                aria-hidden="true"
              >
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                {isNetworkError 
                  ? 'Connection Problem'
                  : isAuthError
                  ? 'Session Expired'
                  : 'Something went wrong'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {this.state.error?.message || 
                 'We\'re sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.'}
              </p>

              {this.state.errorId && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Error ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">{this.state.errorId}</code>
                </p>
              )}

              {((import.meta as any).env?.MODE === 'development' || (import.meta as any).env?.DEV) && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                      Error Details (Development Only):
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={this.handleCopyError}
                      className="h-6 px-2"
                      aria-label="Copy error details"
                    >
                      {this.state.copied ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="text-xs text-red-700 dark:text-red-400 overflow-auto max-h-64">
                    {this.state.error.toString()}
                    {this.state.error.stack && (
                      <>
                        {'\n\nStack Trace:\n'}
                        {this.state.error.stack}
                      </>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        {'\n\nComponent Stack:\n'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={this.handleReset} 
                  variant="outline"
                  aria-label="Try again"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  {this.retryCount > 0 ? `Try Again (${this.retryCount}/${this.maxRetries})` : 'Try Again'}
                </Button>
                <Button 
                  onClick={this.handleReload}
                  variant="outline"
                  aria-label="Reload the page"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Reload Page
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'}
                  aria-label="Navigate to home page"
                >
                  <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                  Go Home
                </Button>
              </div>

              {this.retryCount >= this.maxRetries && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Multiple retry attempts failed. Please contact support with Error ID: <strong>{this.state.errorId}</strong>
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

